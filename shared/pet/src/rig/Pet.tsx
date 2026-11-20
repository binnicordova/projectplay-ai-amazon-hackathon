/**
 * Mimikai on the wall: the logo cut into layers (shadow, arms, skirt, head, eyes, mouth), each
 * turning about its own pivot, plus the rings it juggles and a few effects. Everything moves with
 * transforms and opacity on the native driver, so the pet costs the JS thread nothing between
 * mood changes, even on a Fire TV stick that is also tracking children's hands.
 *
 * React Native 0.72 (Vega) has no transformOrigin, so a turn about a point is written as
 * translate to the point, turn, translate back (`about`).
 */
import { memo, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import type { PetCue } from '../cue';
import { PIVOT, RIG_BOX, type Point } from '../juggle';
import { MOODS } from '../moods';
import type { Ring } from '../rings';
import { degrees, sum, useJuggler, useMoodMotion, type FxNodes } from './motion';
import { RigPart, type RigPartName } from './RigPart';

/** Width over height of the rig box. */
export const PET_ASPECT = RIG_BOX.width / RIG_BOX.height;

export const RING_COLOR: Readonly<Record<Ring, string>> = {
  sun: '#FFD23F',
  lilac: '#C9BCFF',
  white: '#FFFFFF',
  mint: '#2EE0C3',
  coral: '#FF6B9A',
};

const SUN = '#FFD23F';
const INK = '#1E1747';

const CENTRE: Point = { x: RIG_BOX.x + RIG_BOX.width / 2, y: RIG_BOX.y + RIG_BOX.height / 2 };
/** Squash and stretch scale from the floor; the head nods from the neck; flips turn the body's middle. */
const FLOOR: Point = { x: 128, y: 250 };
const BODY: Point = { x: 128, y: 150 };
const NECK: Point = { x: 128, y: 200 };
const EYES: Point = { x: 128, y: 145 };
const SKIRT: Point = { x: 128, y: 185 };
const SHADOW: Point = { x: 128, y: 254 };
/** How far the face slides when the pet looks at one edge of the wall, rig units. */
const GAZE_UNITS = 7;
/** A ring's outer radius: radius 17 with a 10-unit stroke, as in the logo. */
const RING_RADIUS = 22;
const RING_STROKE = 10;

const FX_ORIGIN: Readonly<Record<FxNodes['kind'], Point>> = {
  confetti: { x: 128, y: 120 },
  hearts: { x: 200, y: 80 },
  heart: { x: 184, y: 28 },
  zzz: { x: 216, y: 40 },
  spark: { x: 128, y: 66 },
  twinkle: { x: 128, y: 100 },
  rays: { x: 128, y: 140 },
  badge: { x: 218, y: 200 },
  dwell: { x: 211, y: 84 },
};

/** One entry of an animated transform list. */
type Turn = Extract<NonNullable<Animated.WithAnimatedValue<ViewStyle>['transform']>, readonly unknown[]>[number];

/** An always-on loop: a blink every few seconds, or the skirt's slow sway. */
function useLoop(make: (value: Animated.Value) => Animated.CompositeAnimation, initial: number): Animated.Value {
  const value = useRef(new Animated.Value(initial)).current;
  useEffect(() => {
    const loop = Animated.loop(make(value));
    loop.start();
    return () => loop.stop();
    // `make` is a constant recipe per call site.
  }, [value]);
  return value;
}

const blinkOf = (v: Animated.Value) =>
  Animated.sequence([
    Animated.delay(3_900),
    Animated.timing(v, { toValue: 0.08, duration: 70, useNativeDriver: true }),
    Animated.timing(v, { toValue: 1, duration: 90, useNativeDriver: true }),
  ]);
const swayOf = (v: Animated.Value) =>
  Animated.sequence([
    Animated.timing(v, { toValue: 1, duration: 1_700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    Animated.timing(v, { toValue: -1, duration: 1_700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
  ]);

export interface PetProps {
  readonly cue: PetCue;
  readonly rings: readonly Ring[];
  /** Height of the rig box in pixels; the octopus is the lower three quarters, throws use the rest. */
  readonly size: number;
  /** Where the pet looks: -1 the wall's left edge, 1 its right edge. Driven by children's hands. */
  readonly gaze?: Animated.Value;
}

/** Memoised: a parent re-render must not rebuild the animation graph (see motion.ts). */
export const Pet = memo(function Pet({ cue, rings, size, gaze }: PetProps) {
  const unit = size / RIG_BOX.height;
  const width = size * PET_ASPECT;
  const { channels: c, fx } = useMoodMotion(cue, unit);
  const juggler = useJuggler(MOODS[cue.mood].rings, rings, unit);
  const blink = useLoop(blinkOf, 1);
  const sway = useLoop(swayOf, -1);
  const face = MOODS[cue.mood].face;

  const about = (p: Point, ...turns: Turn[]): Turn[] => {
    const dx = (p.x - CENTRE.x) * unit;
    const dy = (p.y - CENTRE.y) * unit;
    return [{ translateX: dx }, { translateY: dy }, ...turns, { translateX: -dx }, { translateY: -dy }];
  };
  const layer = { position: 'absolute' as const, left: 0, top: 0, width, height: size };
  // Each drawing is rasterised once into its own GPU texture, so moving a layer moves a texture
  // instead of redrawing its SVG paths every frame.
  const part = (name: RigPartName) => (
    <View style={layer} renderToHardwareTextureAndroid>
      <RigPart part={name} face={face} width={width} height={size} />
    </View>
  );
  // Built once per mood and juggling pattern: every new node is a round trip to the native side.
  const moved = useMemo(
    () => ({
      look: gaze ? sum(c.look, gaze.interpolate({ inputRange: [-1, 1], outputRange: [-GAZE_UNITS * unit, GAZE_UNITS * unit] })) : c.look,
      // The shadow shrinks and fades as the pet jumps.
      lift: typeof c.y === 'number' ? 1 : c.y.interpolate({ inputRange: [-60 * unit, 0], outputRange: [0.55, 1], extrapolate: 'clamp' }),
      spin: degrees(c.spin),
      nod: degrees(c.nod),
      armL: degrees(sum(c.armL, juggler.armL)),
      armR: degrees(sum(c.armR, juggler.armR)),
      sway: sway.interpolate({ inputRange: [-1, 1], outputRange: ['-1.4deg', '1.4deg'] }),
    }),
    [c, juggler, gaze, sway, unit],
  );
  const { look, lift } = moved;
  const fxOf = (kind: FxNodes['kind']) => fx.find((f) => f.kind === kind);

  /** An effect drawn as art, scaled and turned about its own origin. */
  const artFx = (f: FxNodes) =>
    f.kind === 'badge' || f.kind === 'dwell' ? null : (
      <Animated.View key={f.kind} style={[layer, { opacity: f.opacity, transform: [{ translateY: f.y }, ...about(FX_ORIGIN[f.kind], { scale: f.scale }, { rotate: f.spin })] }]}>
        {part(f.kind)}
      </Animated.View>
    );

  /** A circle drawn as a view (it carries a number, or must ride on the arm). */
  const circle = (at: Point, radius: number) => ({
    position: 'absolute' as const,
    left: (at.x - radius - RIG_BOX.x) * unit,
    top: (at.y - radius - RIG_BOX.y) * unit,
    width: 2 * radius * unit,
    height: 2 * radius * unit,
    borderRadius: radius * unit,
  });

  const dwell = fxOf('dwell');
  const badge = fxOf('badge');
  const rays = fxOf('rays');

  return (
    <View pointerEvents="none" style={{ width, height: size }}>
      {rays ? artFx(rays) : null}
      <Animated.View style={[layer, { opacity: lift, transform: about(SHADOW, { scaleX: lift }, { scaleY: lift }) }]}>{part('shadow')}</Animated.View>
      <Animated.View style={[layer, { transform: [{ translateY: c.y }, ...about(BODY, { rotate: moved.spin })] }]}>
        <Animated.View style={[layer, { transform: about(FLOOR, { scaleX: c.sx }, { scaleY: c.sy }) }]}>
          <Animated.View style={[layer, { transform: about(PIVOT.L, { rotate: moved.armL }) }]}>{part('armL')}</Animated.View>
          <Animated.View style={[layer, { transform: about(PIVOT.R, { rotate: moved.armR }) }]}>
            {part('armR')}
            {dwell ? (
              <Animated.View style={[circle(FX_ORIGIN.dwell, 30), { borderWidth: 7 * unit, borderColor: SUN, opacity: dwell.opacity, transform: [{ scale: dwell.scale }] }]} />
            ) : null}
          </Animated.View>
          <Animated.View style={[layer, { transform: about(SKIRT, { rotate: moved.sway }) }]}>{part('skirt')}</Animated.View>
          <Animated.View style={[layer, { transform: [{ translateY: c.headY }, ...about(NECK, { rotate: moved.nod })] }]}>
            {part('head')}
            <Animated.View style={[layer, { transform: [{ translateX: look }] }]}>
              <Animated.View style={[layer, { transform: about(EYES, { scaleY: blink }) }]}>{part('eyes')}</Animated.View>
              {part('mouth')}
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </Animated.View>
      {juggler.rings.map(({ ring, x, y, flat, presence }) => (
        <Animated.View
          key={ring}
          style={[
            circle({ x: 0, y: 0 }, RING_RADIUS),
            styles.ring,
            { borderWidth: RING_STROKE * unit, borderColor: RING_COLOR[ring], transform: [{ translateX: x }, { translateY: y }, { scale: presence }, { scaleY: flat }] },
          ]}
        />
      ))}
      {fx.filter((f) => f !== rays).map(artFx)}
      {badge && cue.count !== null ? (
        <Animated.View style={[circle(FX_ORIGIN.badge, 30), styles.badge, { backgroundColor: SUN, opacity: badge.opacity, transform: [{ scale: badge.scale }] }]}>
          <Text style={[styles.badgeText, { fontSize: 30 * unit }]}>×{cue.count}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  ring: { backgroundColor: 'transparent' },
  badge: { alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: INK, fontWeight: '900' },
});
