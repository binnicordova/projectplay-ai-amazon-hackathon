/**
 * Rayitas plays a scene (scenes.ts) on the wall: the tiger cut into layers, each turning about its
 * joint, its shadow, the hoops it jumps through (back half behind it, front half in front, so it
 * really goes through) and the ring it chases in the lobby. One native clock drives everything.
 *
 * The scene is drawn in its parent's coordinates: the stage the app measured (SceneStage).
 */
import { memo, useMemo } from 'react';
import { Animated, StyleSheet, View, type ViewStyle } from 'react-native';
import type { Point } from '../juggle';
import { FLOOR_RING, sampleScene, type HoopTracks, type Scene, type SceneStage, type TigerTracks } from '../scenes';
import { TIGER_BOX, TIGER_FACES, TIGER_PIVOT } from '../tiger';
import { played, playedDegrees, useShowClock } from './clock';
import { RING_COLOR } from './Pet';
import { HoopArc, TigerPart, type TigerLayer } from './TigerPart';

/** One entry of an animated transform list. */
type Turn = Extract<NonNullable<Animated.WithAnimatedValue<ViewStyle>['transform']>, readonly unknown[]>[number];

/** The middle of the tiger box, in tiger units: transforms turn about it unless moved. */
const BOX_CENTRE: Point = { x: TIGER_BOX.x + TIGER_BOX.width / 2, y: TIGER_BOX.y + TIGER_BOX.height / 2 };
const ORIGIN: Point = { x: 0, y: 0 };
/** A hoop at full size, in tiger units (scenes.ts sizes it on the stage). */
const HOOP = { rx: 20, ry: 62, stroke: 9 } as const;

export interface RayitasSceneProps {
  readonly scene: Scene;
  readonly stage: SceneStage;
  /** When the scene starts (epoch ms), so it stays in step with the rules that timed it. */
  readonly startAt: number;
  /** Changes when the scene should start again. */
  readonly playKey: string;
}

export const RayitasScene = memo(function RayitasScene({ scene, stage, startAt, playKey }: RayitasSceneProps) {
  const tracks = useMemo(() => sampleScene(scene, stage), [playKey]);
  const clock = useShowClock(tracks.ms, startAt, tracks.loop, playKey);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {tracks.hoops.map((hoop) => (
        <Hoop key={`back-${hoop.ring}`} hoop={hoop} half="back" clock={clock} ms={tracks.ms} unit={stage.unit} />
      ))}
      <Shadow tiger={tracks.tiger} clock={clock} ms={tracks.ms} unit={stage.unit} ground={stage.ground} />
      {tracks.floorRing ? <FloorRing ring={tracks.floorRing} clock={clock} ms={tracks.ms} unit={stage.unit} ground={stage.ground} /> : null}
      <Tiger tiger={tracks.tiger} clock={clock} ms={tracks.ms} unit={stage.unit} />
      {tracks.hoops.map((hoop) => (
        <Hoop key={`front-${hoop.ring}`} hoop={hoop} half="front" clock={clock} ms={tracks.ms} unit={stage.unit} />
      ))}
    </View>
  );
});

interface Played {
  readonly clock: Animated.Value;
  readonly ms: number;
  readonly unit: number;
}

function Tiger({ tiger, clock, ms, unit }: Played & { readonly tiger: TigerTracks }) {
  const layout = useMemo(() => {
    const about = (p: Point, ...turns: Turn[]): Turn[] => {
      const dx = (p.x - BOX_CENTRE.x) * unit;
      const dy = (p.y - BOX_CENTRE.y) * unit;
      return [{ translateX: dx }, { translateY: dy }, ...turns, { translateX: -dx }, { translateY: -dy }];
    };
    const j = tiger.joints;
    const deg = (keys: typeof j.lean) => playedDegrees(clock, keys, ms);
    return {
      box: { position: 'absolute' as const, left: TIGER_BOX.x * unit, top: TIGER_BOX.y * unit, width: TIGER_BOX.width * unit, height: TIGER_BOX.height * unit },
      root: [{ translateX: played(clock, tiger.x, ms) }, { translateY: played(clock, tiger.y, ms) }, ...about(ORIGIN, { scaleX: played(clock, tiger.dir, ms) })],
      body: [
        { translateY: played(clock, j.bob, ms, unit) },
        ...about(TIGER_PIVOT.body, { rotate: deg(j.lean) }),
        // Squash and stretch from the feet, so the paws stay on the floor.
        ...about(ORIGIN, { scaleX: played(clock, j.sx, ms) }, { scaleY: played(clock, j.sy, ms) }),
      ],
      tail: about(TIGER_PIVOT.tail, { rotate: deg(j.tail) }),
      farBack: about(TIGER_PIVOT.hips, { rotate: deg(j.farBack) }),
      farFront: about(TIGER_PIVOT.shoulders, { rotate: deg(j.farFront) }),
      nearBack: about(TIGER_PIVOT.hips, { rotate: deg(j.nearBack) }),
      nearFront: about(TIGER_PIVOT.shoulders, { rotate: deg(j.nearFront) }),
      head: about(TIGER_PIVOT.neck, { rotate: deg(j.tilt) }),
      faces: TIGER_FACES.map((face) => ({ face, opacity: played(clock, tiger.faces[face], ms) })),
    };
  }, [tiger, clock, ms, unit]);
  const { box } = layout;
  const fill = { position: 'absolute' as const, left: 0, top: 0, width: box.width, height: box.height };
  // Each drawing is rasterised once into a GPU texture: moving a layer moves a texture.
  const part = (layer: TigerLayer) => (
    <View style={fill} renderToHardwareTextureAndroid>
      <TigerPart layer={layer} width={box.width} height={box.height} />
    </View>
  );
  return (
    <Animated.View style={[box, { transform: layout.root }]}>
      <Animated.View style={[fill, { transform: layout.body }]}>
        <Animated.View style={[fill, { transform: layout.tail }]}>{part('tail')}</Animated.View>
        <Animated.View style={[fill, { transform: layout.farBack }]}>{part('farBack')}</Animated.View>
        <Animated.View style={[fill, { transform: layout.farFront }]}>{part('farFront')}</Animated.View>
        {part('body')}
        <Animated.View style={[fill, { transform: layout.nearBack }]}>{part('nearBack')}</Animated.View>
        <Animated.View style={[fill, { transform: layout.nearFront }]}>{part('nearFront')}</Animated.View>
        <Animated.View style={[fill, { transform: layout.head }]}>
          {part('head')}
          {layout.faces.map(({ face, opacity }) => (
            <Animated.View key={face} style={[fill, { opacity }]}>
              {part(`face:${face}`)}
            </Animated.View>
          ))}
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

function Shadow({ tiger, clock, ms, unit, ground }: Played & { readonly tiger: TigerTracks; readonly ground: number }) {
  const style = useMemo(
    () => ({
      left: -34 * unit,
      top: ground - 6 * unit,
      width: 68 * unit,
      height: 12 * unit,
      borderRadius: 34 * unit,
      opacity: played(clock, { t: tiger.shadowOpacity.t, v: tiger.shadowOpacity.v.map((v) => v * 0.35) }, ms),
      transform: [{ translateX: played(clock, tiger.x, ms) }, { scale: played(clock, tiger.shadowScale, ms) }],
    }),
    [tiger, clock, ms, unit, ground],
  );
  return <Animated.View style={[styles.shadow, style]} />;
}

function Hoop({ hoop, half, clock, ms, unit }: Played & { readonly hoop: HoopTracks; readonly half: 'back' | 'front' }) {
  const size = { rx: HOOP.rx * unit, ry: HOOP.ry * unit, stroke: HOOP.stroke * unit };
  const style = useMemo(
    () => ({
      left: -(size.rx + size.stroke),
      top: -(size.ry + size.stroke),
      opacity: played(clock, hoop.on, ms),
      transform: [
        { translateX: played(clock, hoop.x, ms) },
        { translateY: played(clock, hoop.y, ms) },
        { scaleX: played(clock, hoop.rx, ms, 1 / size.rx) },
        { scaleY: played(clock, hoop.ry, ms, 1 / size.ry) },
      ],
    }),
    [hoop, clock, ms, unit],
  );
  return (
    <Animated.View style={[styles.abs, style]}>
      <HoopArc half={half} color={RING_COLOR[hoop.ring]} rx={size.rx} ry={size.ry} stroke={size.stroke} />
    </Animated.View>
  );
}

function FloorRing({ ring, clock, ms, unit, ground }: Played & { readonly ring: NonNullable<ReturnType<typeof sampleScene>['floorRing']>; readonly ground: number }) {
  const r = FLOOR_RING.radius * unit;
  const style = useMemo(
    () => ({
      left: -r,
      top: ground - 2 * r,
      width: 2 * r,
      height: 2 * r,
      borderRadius: r,
      borderWidth: FLOOR_RING.stroke * unit,
      transform: [{ translateX: played(clock, ring.x, ms) }, { rotate: playedDegrees(clock, ring.spin, ms) }],
    }),
    [ring, clock, ms, unit, ground, r],
  );
  return (
    <Animated.View style={[styles.floorRing, style]}>
      {/* A shine on the rim, so children see it roll. */}
      <View style={[styles.shine, { width: 3 * unit, height: 3 * unit, borderRadius: 1.5 * unit, top: -FLOOR_RING.stroke * unit * 0.7 }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  shadow: { position: 'absolute', backgroundColor: '#000000' },
  floorRing: { position: 'absolute', borderColor: '#C9BCFF', alignItems: 'center' },
  shine: { position: 'absolute', backgroundColor: '#FFFFFF' },
});
