/**
 * One glowing cursor per raised hand. Positions arrive 5–15 times per second per hand
 * (slower when the phone runs hot) and are applied straight to Animated values (no React
 * re-render per sample). Each move glides over most of the measured gap between samples:
 * smooth at any rate, and the cursor is already resting when the next sample lands.
 */
import type { TeamId } from '@projectplay/contracts';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { scaledPixels } from '../../../hooks/useScale';
import { colors, teamColor } from '../../../theme/colors';
import type { PointerHub } from '../../interaction/application/pointerHub';

const SIZE = scaledPixels(96);
/**
 * Glide over this share of the sample gap. A full gap would add a whole gap of lag (66–200 ms);
 * a short pause before the next sample is not noticeable, the lag is.
 */
const GLIDE_SHARE = 0.7;
const MIN_GLIDE_MS = 30;
const MAX_GLIDE_MS = 90;
/** Starting guess for the gap between samples: the 15 Hz the phone aims for. */
const INITIAL_GAP_MS = 66;

interface CursorAnim {
  readonly team: TeamId;
  readonly position: Animated.ValueXY;
  readonly opacity: Animated.Value;
  visible: boolean;
  lastAt: number;
  /** Smoothed gap between samples, ms. */
  gap: number;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** `showTeam` labels each cursor with its team's letter (pointless when one player has the wall). */
export function CursorLayer({ pointers, showTeam = true }: { readonly pointers: PointerHub; readonly showTeam?: boolean }) {
  const { width, height } = useWindowDimensions();
  const cursors = useRef(new Map<number, CursorAnim>()).current;
  const [ids, setIds] = useState<readonly number[]>([]);

  useEffect(
    () =>
      pointers.subscribe(({ pointerId, team, point }) => {
        let cursor = cursors.get(pointerId);
        // A hand that changed team (two teams ⇄ one player) gets a fresh cursor in its new colour.
        if (!cursor || cursor.team !== team) {
          cursor = {
            team,
            position: new Animated.ValueXY({ x: 0, y: 0 }),
            opacity: new Animated.Value(0),
            visible: false,
            lastAt: 0,
            gap: INITIAL_GAP_MS,
          };
          cursors.set(pointerId, cursor);
          setIds([...cursors.keys()]);
        }
        if (point) {
          const to = { x: point.x * width - SIZE / 2, y: point.y * height - SIZE / 2 };
          const now = Date.now();
          if (cursor.visible) {
            cursor.gap += 0.3 * (clamp(now - cursor.lastAt, 20, 300) - cursor.gap);
            const duration = clamp(cursor.gap * GLIDE_SHARE, MIN_GLIDE_MS, MAX_GLIDE_MS);
            Animated.timing(cursor.position, { toValue: to, duration, easing: Easing.linear, useNativeDriver: true }).start();
          } else {
            cursor.position.setValue(to);
            cursor.opacity.setValue(1);
            cursor.visible = true;
          }
          cursor.lastAt = now;
        } else if (cursor.visible) {
          cursor.visible = false;
          Animated.timing(cursor.opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start();
        }
      }),
    [pointers, cursors, width, height],
  );

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {ids.map((id) => {
        const cursor = cursors.get(id)!;
        const color = teamColor(cursor.team);
        return (
          <Animated.View
            // Keyed by team too: a recoloured cursor remounts with its new Animated values.
            key={`${id}-${cursor.team}`}
            style={[styles.cursor, { borderColor: color, opacity: cursor.opacity, transform: cursor.position.getTranslateTransform() }]}
          >
            <View style={[styles.dot, { backgroundColor: color }]} />
            {showTeam ? <Text style={styles.label}>{cursor.team}</Text> : null}
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  cursor: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: scaledPixels(8),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  dot: { width: scaledPixels(20), height: scaledPixels(20), borderRadius: scaledPixels(10) },
  label: { position: 'absolute', top: -scaledPixels(44), color: colors.text, fontSize: scaledPixels(28), fontWeight: '900' },
});
