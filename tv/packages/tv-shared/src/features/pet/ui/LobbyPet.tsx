/**
 * Mimikai centre stage in the lobby, where children meet it before the class: it waves at each
 * one who steps in, its eyes follow their hands, and holding a hand on it makes it giggle. That
 * hold is the same gesture that answers a question, so the class practises it while the teacher
 * gets ready. A sun ring grows round it under the hand, like a tile filling. Rayitas, its tiger
 * cub, plays beside it: it pounces on a ring, misses, and the ring rolls to Mimikai and back.
 */
import { jugarScene } from '@mimikai/pet';
import { useAtomValue } from 'jotai';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import { scaledPixels } from '../../../hooks/useScale';
import { useRectStyle } from '../../game/ui/primitives';
import type { PointerHub } from '../../interaction/application/pointerHub';
import { petCueAtom } from '../application/petStore';
import { LOBBY_PET, PET_TARGET, sceneStageAround } from '../domain/stage';
import { ClassPet } from './ClassPet';
import { PET_ASPECT, RayitasScene } from '@mimikai/pet/rig';
import { SpeechBubble } from './SpeechBubble';

/** Progress arrives 5–15 times per second; easing between samples keeps the glow smooth. */
const GLOW_STEP_MS = 90;

export function LobbyPet({ pointers }: { readonly pointers: PointerHub }) {
  const rect = useRectStyle()(LOBBY_PET);
  const screen = useWindowDimensions();
  const cue = useAtomValue(petCueAtom);
  const glow = useRef(new Animated.Value(0)).current;
  const size = Math.min(LOBBY_PET.height * screen.height, (LOBBY_PET.width * screen.width) / PET_ASPECT);
  // Rayitas plays beside Mimikai on its floor: the pet box is centred in the lobby rectangle.
  const stage = useMemo(
    () =>
      sceneStageAround({
        left: (LOBBY_PET.x + LOBBY_PET.width / 2) * screen.width - (size * PET_ASPECT) / 2,
        top: (LOBBY_PET.y + LOBBY_PET.height / 2) * screen.height - size / 2,
        size,
      }),
    [screen.width, screen.height, size],
  );
  const scene = useMemo(() => jugarScene(stage), [stage]);
  const [since] = useState(() => Date.now());

  useEffect(
    () =>
      pointers.subscribeProgress((targetId, progress) => {
        if (targetId !== PET_TARGET.id) return;
        Animated.timing(glow, { toValue: progress, duration: GLOW_STEP_MS, easing: Easing.linear, useNativeDriver: true }).start();
      }),
    [pointers, glow],
  );

  // A ring wider than the octopus, centred on its body (rig y 150, below the box's middle).
  // A bright outline, not a fill: a dim yellow disc reads as a shadow on a projected wall.
  const glowSize = size * 0.95;
  return (
    <>
    {/* Rayitas chases a ring around Mimikai's feet while the class waits. */}
    <RayitasScene scene={scene} stage={stage} startAt={since} playKey={`lobby:${screen.width}x${screen.height}`} />
    <View style={[rect, styles.stage]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          {
            width: glowSize,
            height: glowSize,
            borderRadius: glowSize / 2,
            borderWidth: scaledPixels(14),
            opacity: glow.interpolate({ inputRange: [0, 0.05, 1], outputRange: [0, 0.6, 1] }),
            transform: [{ translateY: size * 0.15 }, { scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) }],
          },
        ]}
      />
      <ClassPet size={size} pointers={pointers} />
      <SpeechBubble text={cue.line} style={styles.bubble} />
    </View>
    </>
  );
}

const styles = StyleSheet.create({
  stage: { alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', borderColor: '#FFD23F' },
  // The rig box keeps its top quarter for throws; one ring never goes that high, so the bubble does.
  bubble: { position: 'absolute', bottom: '80%', left: -scaledPixels(200), right: -scaledPixels(200) },
});
