/**
 * An answer tile children select by holding a hand on it. The fill rises with the
 * hold progress reported by the pointer hub (and sinks again if the hand slips off),
 * so children see the selection coming and learn to keep their hand still.
 * The team's chosen tile turns solid in its colour; the others stay open to change to.
 */
import type { IconArt } from '@mimikai/contracts';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import { scaledPixels } from '../../../hooks/useScale';
import { colors, teamColor, teamSoftColor } from '../../../theme/colors';
import type { PointerHub } from '../../interaction/application/pointerHub';
import type { BoardTarget } from '../../interaction/domain/layout';
import { useRectStyle } from './primitives';
import { VisualView } from './VisualView';

export type TileState = 'open' | 'chosen' | 'dimmed' | 'correct' | 'wrong';

/** Progress arrives 5–15 times per second; easing between samples keeps the fill smooth. */
const FILL_STEP_MS = 90;
const BORDER = scaledPixels(6);

export function BoardTile({
  target,
  state,
  pointers,
  art,
}: {
  readonly target: BoardTarget;
  readonly state: TileState;
  readonly pointers: PointerHub;
  readonly art: IconArt;
}) {
  const rectStyle = useRectStyle();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;
  const [hover, setHover] = useState(false);
  // Read by the listener: only an open tile fills (the chosen one is already solid).
  const open = useRef(state === 'open');

  useEffect(
    () =>
      pointers.subscribeProgress((targetId, value) => {
        if (targetId !== target.id || !open.current) return;
        // Native driver: the fill animates off the JS thread, which on a TV stick also has to
        // keep up with every hand position arriving from the phone.
        Animated.timing(progress, { toValue: value, duration: FILL_STEP_MS, easing: Easing.linear, useNativeDriver: true }).start();
        setHover(value > 0);
      }),
    [pointers, target.id, progress],
  );

  useEffect(() => {
    open.current = state === 'open';
    if (state === 'open') return;
    progress.stopAnimation();
    progress.setValue(0);
    setHover(false);
  }, [state, progress]);

  const color = teamColor(target.team);
  const hovered = hover && state === 'open';
  // The fill rises from the bottom: scale the full-height fill, then slide it down so its
  // bottom edge stays put (transformOrigin is not available on every TV platform).
  const innerHeight = target.rect.height * screenHeight - 2 * BORDER;
  const innerWidth = target.rect.width * screenWidth - 2 * BORDER;
  const onColor = state !== 'open' && state !== 'dimmed';
  return (
    <View
      style={[
        rectStyle(target.rect),
        styles.tile,
        { borderColor: hovered ? colors.text : color, backgroundColor: teamSoftColor(target.team) },
        state === 'dimmed' && styles.dimmed,
        state === 'chosen' && { backgroundColor: color },
        state === 'correct' && { backgroundColor: colors.success, borderColor: colors.success },
        state === 'wrong' && { backgroundColor: colors.error, borderColor: colors.error },
        hovered && styles.hovered,
      ]}
    >
      <Animated.View
        style={[
          styles.fill,
          {
            backgroundColor: color,
            transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [innerHeight / 2, 0] }) }, { scaleY: progress }],
          },
        ]}
      />
      <View style={styles.content}>
        <VisualView visual={target.visual} art={art} width={innerWidth * 0.9} height={innerHeight * 0.86} textStyle={onColor ? styles.labelOnColor : undefined} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: scaledPixels(36),
    borderWidth: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  hovered: { transform: [{ scale: 1.04 }] },
  dimmed: { opacity: 0.25 },
  fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, opacity: 0.55 },
  content: { alignItems: 'center', justifyContent: 'center' },
  labelOnColor: { color: colors.background },
});
