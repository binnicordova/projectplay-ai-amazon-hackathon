/**
 * The class energy ball (energy.ts), played on one native clock: the sparks of every right answer
 * flying into a ball above Mimikai, the charge, the ending (hearts, fireworks, or the super ball
 * with its beam, flash and rain of stars), then the stars the class earned. Mimikai itself is
 * drawn by the screen; its moods follow the same show (`mimiMoodAt`).
 *
 * Only the record's number is counted by JavaScript: text can't run on the native driver.
 */
import { memo, useEffect, useMemo, useState } from 'react';
import { Animated, StyleSheet, Text, View, type TextStyle } from 'react-native';
import type { EnergyShow, Sprite } from '../energy';
import { keyed } from '../keys';
import { played, playedDegrees, useShowClock } from './clock';
import { Shape } from './TigerPart';

const SUN = '#FFD23F';
const SUN_LIGHT = '#FFE47A';
const RAYS = 12;

export interface EnergyBallProps {
  readonly show: EnergyShow;
  /** When the show starts (epoch ms). */
  readonly startAt: number;
  readonly playKey: string;
  /** Stage units per design pixel (energy.ts `EnergyStage.unit`). */
  readonly unit: number;
  readonly width: number;
  readonly height: number;
  /** The record rolling up, from the old number to the new one (a record ending only). */
  readonly record: { readonly from: number; readonly to: number } | null;
  readonly lineStyle: TextStyle;
  /** Where the line sits, from the top. */
  readonly lineTop: number;
}

export const EnergyBall = memo(function EnergyBall({ show, startAt, playKey, unit, width, height, record, lineStyle, lineTop }: EnergyBallProps) {
  const clock = useShowClock(show.ms, startAt, false, playKey);
  const ms = show.ms;
  const radius = 80 * unit;
  const layout = useMemo(() => {
    const p = (keys: Parameters<typeof played>[1], scale = 1) => played(clock, keys, ms, scale);
    return {
      ball: {
        opacity: p(show.ball.opacity),
        transform: [{ translateX: p(show.ball.x) }, { translateY: p(show.ball.y) }, { scale: p(show.ball.radius, 1 / radius) }],
      },
      rays: {
        opacity: p(show.rays.opacity),
        transform: [{ translateX: p(show.ball.x) }, { translateY: p(show.ball.y) }, { scale: p(show.rays.scale) }, { rotate: playedDegrees(clock, show.rays.rotate, ms) }],
      },
      beam: { opacity: p(show.beam, 0.75) },
      flash: { opacity: p(show.flash) },
      line: { opacity: p(keyed([[show.lineAt - 1, 0], [show.lineAt + 300, 1]])) },
    };
  }, [clock, ms, show, radius]);
  const ballX = show.ball.x.v[0] ?? width / 2;
  const ballY = show.ball.y.v[0] ?? height / 3;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.beam, { left: ballX - 26 * unit, width: 52 * unit, height: ballY, borderRadius: 26 * unit }, layout.beam]} />
      <Animated.View style={[styles.abs, { left: -150 * unit, top: -150 * unit, width: 300 * unit, height: 300 * unit }, layout.rays]}>
        {Array.from({ length: RAYS }, (_, i) => (
          <View key={i} style={[StyleSheet.absoluteFill, { transform: [{ rotate: `${(i * 360) / RAYS}deg` }] }]}>
            <View style={[styles.ray, { left: 145 * unit, width: 10 * unit, height: 44 * unit, borderRadius: 5 * unit }]} />
          </View>
        ))}
      </Animated.View>
      <Animated.View style={[styles.abs, { left: -radius * 1.9, top: -radius * 1.9, width: radius * 3.8, height: radius * 3.8 }, layout.ball]}>
        <View style={[styles.glow, { borderRadius: radius * 1.9 }]} />
        <View style={[styles.core, { left: radius * 0.9, top: radius * 0.9, width: radius * 2, height: radius * 2, borderRadius: radius }]}>
          <View style={[styles.highlight, { width: radius * 0.7, height: radius * 0.5, borderRadius: radius * 0.35, left: radius * 0.45, top: radius * 0.35 }]} />
        </View>
      </Animated.View>
      {show.sprites.map((sprite, i) => (
        <SpriteView key={i} sprite={sprite} clock={clock} ms={ms} />
      ))}
      {show.stars.map((sprite, i) => (
        <SpriteView key={`star-${i}`} sprite={sprite} clock={clock} ms={ms} />
      ))}
      {record && show.recordRoll ? <RecordRoll roll={show.recordRoll} from={record.from} to={record.to} startAt={startAt} top={(show.stars[0]?.y.v[0] ?? 0) + 70 * unit} unit={unit} /> : null}
      <Animated.View style={[styles.lineBox, { top: lineTop }, layout.line]}>
        <Text style={lineStyle}>{show.line}</Text>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.flash, layout.flash]} />
    </View>
  );
});

const SpriteView = memo(function SpriteView({ sprite, clock, ms }: { readonly sprite: Sprite; readonly clock: Animated.Value; readonly ms: number }) {
  const style = useMemo(
    () => ({
      left: -sprite.size,
      top: -sprite.size,
      width: 2 * sprite.size,
      height: 2 * sprite.size,
      opacity: played(clock, sprite.opacity, ms),
      transform: [
        { translateX: played(clock, sprite.x, ms) },
        { translateY: played(clock, sprite.y, ms) },
        { scale: played(clock, sprite.scale, ms) },
        { rotate: playedDegrees(clock, sprite.rotate, ms) },
      ],
    }),
    [sprite, clock, ms],
  );
  const d = 2 * sprite.size;
  return (
    <Animated.View style={[styles.abs, style]}>
      {sprite.kind === 'star' || sprite.kind === 'heart' ? (
        <Shape kind={sprite.kind} color={sprite.color} size={d} />
      ) : sprite.kind === 'spark' ? (
        // A spark: a soft halo, the team's colour, a white heart.
        <View style={[styles.centre, { width: d, height: d }]}>
          <View style={[styles.round, { width: d * 2, height: d * 2, borderRadius: d, backgroundColor: sprite.color, opacity: 0.25 }]} />
          <View style={[styles.round, { width: d, height: d, borderRadius: d / 2, backgroundColor: sprite.color }]} />
          <View style={[styles.round, { width: d * 0.43, height: d * 0.43, borderRadius: d, backgroundColor: '#FFFFFF' }]} />
        </View>
      ) : (
        <View style={{ width: d, height: d, borderRadius: sprite.size, backgroundColor: sprite.color }} />
      )}
    </Animated.View>
  );
});

/** The class's record counting up to the new one, in the show's own time. */
function RecordRoll({ roll, from, to, startAt, top, unit }: { readonly roll: { readonly at: number; readonly ms: number }; readonly from: number; readonly to: number; readonly startAt: number; readonly top: number; readonly unit: number }) {
  const [value, setValue] = useState<number | null>(null);
  useEffect(() => {
    const begin = startAt + roll.at;
    const tick = setInterval(() => {
      const k = (Date.now() - begin) / roll.ms;
      if (k < 0) return;
      const eased = 1 - (1 - Math.min(1, k)) ** 3;
      setValue(Math.round(from + (to - from) * eased));
      if (k >= 1) clearInterval(tick);
    }, 50);
    return () => clearInterval(tick);
  }, [roll, from, to, startAt]);
  if (value === null) return null;
  return <Text style={[styles.record, { top, fontSize: 84 * unit, lineHeight: 96 * unit }]}>{value.toLocaleString('es-PE')}</Text>;
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  beam: { position: 'absolute', top: 0, backgroundColor: '#FFF6CC' },
  ray: { position: 'absolute', top: 0, backgroundColor: SUN },
  glow: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: SUN, opacity: 0.28 },
  core: { position: 'absolute', backgroundColor: SUN_LIGHT, borderWidth: 0 },
  highlight: { position: 'absolute', backgroundColor: '#FFFBE6', opacity: 0.85 },
  centre: { alignItems: 'center', justifyContent: 'center' },
  round: { position: 'absolute' },
  lineBox: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  record: { position: 'absolute', left: 0, right: 0, textAlign: 'center', color: SUN, fontWeight: '900' },
  flash: { backgroundColor: '#FFE9A0' },
});
