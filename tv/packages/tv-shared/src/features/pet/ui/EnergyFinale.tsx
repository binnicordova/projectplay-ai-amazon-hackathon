/**
 * How every class ends: Mimikai's energy ball, full screen. Every right answer flies up as a
 * spark from the children's half of the wall, and the ball ends the way the class earned (see
 * shared/pet energy.ts). Mimikai stands big at the bottom, juggling the rings the ending earned;
 * its moods follow the same show. The summary's scores come after it.
 */
import { energyShow, type EnergyStage } from '@mimikai/pet';
import { EnergyBall, PET_ASPECT } from '@mimikai/pet/rig';
import { useAtomValue } from 'jotai';
import { useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { scaledPixels } from '../../../hooks/useScale';
import { colors } from '../../../theme/colors';
import { sessionAtom } from '../../session/application/sessionStore';
import { playingTeams, summaryOf } from '../../session/domain/session';
import { classMomentAtom } from '../application/petStore';
import { ClassPet } from './ClassPet';

/** The design page's layout on a 540-tall wall: Mimikai's box, the ball above its head, the stars at the top. */
const PET = { top: 0.376, share: 0.615 } as const;
const BALL_Y = 196 / 540;
const STARS_Y = 92 / 540;

export function EnergyFinale() {
  const moment = useAtomValue(classMomentAtom);
  const session = useAtomValue(sessionAtom);
  const { width, height } = useWindowDimensions();
  const ball = moment.kind === 'summary' ? moment.ball : null;
  const teams = session.phase === 'summary' ? playingTeams(session.config).length : 1;
  const show = useMemo(() => {
    if (!ball) return null;
    const stage: EnergyStage = { width, height, ball: { x: width / 2, y: height * BALL_Y }, starsY: height * STARS_Y, unit: height / 540, teams: teams > 1 ? 2 : 1 };
    return energyShow(ball.ending, ball.rightAnswers, stage);
  }, [ball?.at, ball?.ending, ball?.rightAnswers, width, height, teams]);
  if (!ball || !show || session.phase !== 'summary') return null;
  // The record rolls up from the old one to the class's best today.
  const record = ball.ending === 'record' && session.config.record !== undefined ? { from: session.config.record, to: summaryOf(session).best } : null;
  const size = height * PET.share;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.pet, { left: width / 2 - (size * PET_ASPECT) / 2, top: height * PET.top }]}>
        <ClassPet size={size} />
      </View>
      <EnergyBall
        show={show}
        startAt={ball.at}
        playKey={`ball:${ball.at}`}
        unit={height / 540}
        width={width}
        height={height}
        record={record}
        lineStyle={styles.line}
        lineTop={height * 0.02}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pet: { position: 'absolute' },
  line: { color: colors.text, fontSize: scaledPixels(84), fontWeight: '900', textAlign: 'center', letterSpacing: -1 },
});
