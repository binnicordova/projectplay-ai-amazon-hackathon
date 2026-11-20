/**
 * The pet as the class sees it: its mood and rings come from the store, and its eyes follow the
 * children's raised hands. Hands arrive 5–15 times per second each, so the gaze goes straight to
 * an Animated value from the pointer listener, never through React state.
 */
import { useAtomValue } from 'jotai';
import { memo, useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import type { PointerHub } from '../../interaction/application/pointerHub';
import { petCueAtom, petRingsAtom } from '../application/petStore';
import { Pet } from '@mimikai/pet/rig';

/** Looking from the wall's centre line: a hand at either edge turns the eyes all the way. */
const GAZE_SPAN = 2.2;
/** Ignore smaller changes: a still hand should not make the eyes tremble. */
const GAZE_STEP = 0.05;

function useGaze(pointers: PointerHub | undefined): Animated.Value {
  const gaze = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!pointers) return;
    const hands = new Map<number, number>();
    let aim = 0;
    return pointers.subscribe(({ pointerId, point }) => {
      if (point) hands.set(pointerId, point.x);
      else hands.delete(pointerId);
      const xs = [...hands.values()];
      const next = xs.length === 0 ? 0 : Math.max(-1, Math.min(1, (xs.reduce((a, b) => a + b, 0) / xs.length - 0.5) * GAZE_SPAN));
      if (Math.abs(next - aim) < GAZE_STEP) return;
      aim = next;
      Animated.timing(gaze, { toValue: aim, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    });
  }, [pointers, gaze]);
  return gaze;
}

/** Memoised: screens re-render for their own reasons; the pet re-renders only when it changes. */
export const ClassPet = memo(function ClassPet({ size, pointers }: { readonly size: number; readonly pointers?: PointerHub }) {
  const cue = useAtomValue(petCueAtom);
  const rings = useAtomValue(petRingsAtom);
  const gaze = useGaze(pointers);
  return <Pet cue={cue} rings={rings} size={size} gaze={gaze} />;
});
