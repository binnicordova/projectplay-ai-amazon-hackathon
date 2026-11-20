/**
 * Plays keyframes (keys.ts) on one native clock: every value is an interpolation of the same
 * Animated.Value going 0 → 1 over the show, so a whole scene runs off the JS thread. Values that
 * never move stay plain numbers: each animated node is a round trip to the native side.
 */
import { useEffect, useMemo } from 'react';
import { Animated, Easing } from 'react-native';
import type { Keyed } from '../keys';

export type Played = Animated.AnimatedInterpolation<number> | number;

export function played(clock: Animated.Value, keys: Keyed, ms: number, scale = 1): Played {
  const first = keys.v[0] ?? 0;
  if (keys.v.every((v) => v === first)) return first * scale;
  return clock.interpolate({ inputRange: keys.t.map((t) => t / ms), outputRange: keys.v.map((v) => v * scale), extrapolate: 'clamp' });
}

export function playedDegrees(clock: Animated.Value, keys: Keyed, ms: number): Animated.AnimatedInterpolation<string> | string {
  const first = keys.v[0] ?? 0;
  if (keys.v.every((v) => v === first)) return `${first}deg`;
  return clock.interpolate({ inputRange: keys.t.map((t) => t / ms), outputRange: keys.v.map((v) => `${v}deg`), extrapolate: 'clamp' });
}

/**
 * A clock for a show `ms` long that starts at `startAt` (epoch ms): it waits if mounted early and
 * catches up if mounted late (a screen can take a moment to appear on a TV stick), so the show
 * stays in step with the rules that timed it. A looping show just loops from its start.
 */
export function useShowClock(ms: number, startAt: number, loop: boolean, key: string): Animated.Value {
  const clock = useMemo(() => new Animated.Value(0), [key]);
  useEffect(() => {
    const once = (duration: number, delay = 0) => Animated.timing(clock, { toValue: 1, duration, delay, easing: Easing.linear, useNativeDriver: true });
    let animation: Animated.CompositeAnimation;
    if (loop) {
      clock.setValue(0);
      animation = Animated.loop(once(ms));
    } else {
      const late = Date.now() - startAt;
      const offset = Math.max(0, Math.min(ms, late));
      clock.setValue(offset / ms);
      animation = once(Math.max(0, ms - offset), Math.max(0, -late));
    }
    animation.start();
    return () => animation.stop();
    // The key restarts the show; ms and startAt belong to it.
  }, [clock]);
  return clock;
}
