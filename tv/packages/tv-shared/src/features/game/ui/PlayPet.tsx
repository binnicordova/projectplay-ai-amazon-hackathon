/**
 * Mimikai during a class, in one of three places (see pet/domain/stage.ts):
 * - full screen, like Duo: it greets the class and throws the party for a level up or a streak,
 *   over a dark wall, with the moment's words under it;
 * - in the answer panel, reacting to each answer: the pet *is* the feedback;
 * - small at the bottom of the wall's centre line while children choose (the tiles are the star).
 *
 * One pet springs between the three, drawn at its full-screen size and scaled down elsewhere, so
 * its rings never stop and it never looks blurry when it grows.
 */
import { granScene, saltoScene, type SceneStage } from '@mimikai/pet';
import { PET_ASPECT, RayitasScene } from '@mimikai/pet/rig';
import { useAtomValue } from 'jotai';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, useWindowDimensions } from 'react-native';
import { scaledPixels } from '../../../hooks/useScale';
import { colors } from '../../../theme/colors';
import type { PointerHub } from '../../interaction/application/pointerHub';
import { spotlightAtom } from '../../pet/application/petStore';
import { sceneStageAround, type Place, type RayitasCall } from '../../pet/domain/stage';
import { ClassPet } from '../../pet/ui/ClassPet';

/** The pet's rig box in the answer panel; in its corner it is half that. */
export const STAGE_PET = scaledPixels(300);
export const STAGE_PET_WIDTH = STAGE_PET * PET_ASPECT;
const CORNER_SHARE = 0.5;
/** Full screen: the rig box is this share of the wall's height, centred a little above middle. */
const FULL_SHARE = 0.64;
const FULL_CENTRE_Y = 0.4;

/** The answer panel: the pet stands in a slot at its left end (PlayScreen leaves it empty). */
export const PANEL = { side: 0.18, bottom: scaledPixels(36), padding: scaledPixels(32) } as const;

const PLACE_VALUE: Readonly<Record<Place, number>> = { corner: 0, panel: 1, full: 2 };

export function PlayPet({ pointers }: { readonly pointers: PointerHub }) {
  const { width, height } = useWindowDimensions();
  const spotlight = useAtomValue(spotlightAtom);
  const place = useRef(new Animated.Value(PLACE_VALUE[spotlight.place])).current;
  const full = height * FULL_SHARE;
  const fullWidth = full * PET_ASPECT;

  useEffect(() => {
    Animated.spring(place, { toValue: PLACE_VALUE[spotlight.place], friction: 8, tension: 60, useNativeDriver: true }).start();
  }, [spotlight.place, place]);

  // Built once per screen size: each new interpolation is a round trip to the native driver.
  const motion = useMemo(() => {
    const centre = { x: width / 2, y: height * FULL_CENTRE_Y };
    const panel = { x: width * PANEL.side + PANEL.padding + STAGE_PET_WIDTH / 2, y: height - PANEL.bottom - STAGE_PET / 2 };
    const corner = { x: width / 2, y: height - (STAGE_PET * CORNER_SHARE) / 2 };
    const across = (values: readonly [number, number, number]) => place.interpolate({ inputRange: [0, 1, 2], outputRange: [...values] });
    return {
      pet: {
        left: centre.x - fullWidth / 2,
        top: centre.y - full / 2,
        transform: [
          { translateX: across([corner.x - centre.x, panel.x - centre.x, 0]) },
          { translateY: across([corner.y - centre.y, panel.y - centre.y, 0]) },
          { scale: across([(STAGE_PET * CORNER_SHARE) / full, STAGE_PET / full, 1]) },
        ],
      },
      // The wall goes dark only for a full-screen moment.
      scrim: place.interpolate({ inputRange: [0, 1, 1.4, 2], outputRange: [0, 0, 0.2, 1], extrapolate: 'clamp' }),
      words: place.interpolate({ inputRange: [0, 1.7, 2], outputRange: [0, 0, 1], extrapolate: 'clamp' }),
    };
  }, [place, width, height, full, fullWidth]);

  // Rayitas plays around Mimikai's full-screen place: the same floor, on its left.
  const stage = useMemo(() => sceneStageAround({ left: width / 2 - fullWidth / 2, top: height * FULL_CENTRE_Y - full / 2, size: full }), [width, height, full, fullWidth]);

  return (
    <>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.scrim, { opacity: motion.scrim }]} />
      {spotlight.rayitas ? <Rayitas call={spotlight.rayitas} stage={stage} /> : null}
      <Animated.View pointerEvents="none" style={[styles.pet, { width: fullWidth, height: full }, motion.pet]}>
        <ClassPet size={full} pointers={pointers} />
      </Animated.View>
      {spotlight.place === 'full' ? (
        <Animated.View pointerEvents="none" style={[styles.words, { top: height * (FULL_CENTRE_Y + FULL_SHARE / 2) - scaledPixels(24), opacity: motion.words }]}>
          {spotlight.title ? <Text style={styles.title}>{spotlight.title}</Text> : null}
          {spotlight.detail ? <Text style={styles.detail}>{spotlight.detail}</Text> : null}
        </Animated.View>
      ) : null}
    </>
  );
}

/** Rayitas's part in a party: it jumps through the new level's ring, or bounds through every ring. */
function Rayitas({ call, stage }: { readonly call: RayitasCall; readonly stage: SceneStage }) {
  const playKey = `${call.scene}:${call.at}`;
  const scene = useMemo(() => (call.scene === 'salto' ? saltoScene(stage, call.rings[0]!) : granScene(stage, call.rings)), [playKey, stage]);
  return <RayitasScene scene={scene} stage={stage} startAt={call.at} playKey={playKey} />;
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: 'rgba(11, 16, 38, 0.94)' },
  pet: { position: 'absolute' },
  words: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: scaledPixels(8) },
  title: { color: colors.text, fontSize: scaledPixels(96), fontWeight: '900', textAlign: 'center', letterSpacing: -1 },
  detail: { color: colors.primary, fontSize: scaledPixels(44), fontWeight: '800', textAlign: 'center' },
});
