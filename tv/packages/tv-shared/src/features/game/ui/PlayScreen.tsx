/**
 * The projected game. Each team owns one half of the wall (or one player all of it); the
 * question sits on top. Children answer by pointing: a hand held on a tile chooses it (number
 * tiles, or TRUE and FALSE). A choice can change until the countdown ends; only then is it marked.
 */
import type { TeamId } from '@projectplay/contracts';
import { useAtomValue } from 'jotai';
import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { scaledPixels } from '../../../hooks/useScale';
import { colors, teamColor } from '../../../theme/colors';
import { choiceTargets, truthTargets, type BoardTarget } from '../../interaction/domain/layout';
import { activeTeamsAtom, clockAtom, sessionAtom } from '../../session/application/sessionStore';
import { playingTeams, promptOf, timeLeftMs, QUESTION_TIME_MS, type Round, type SessionState } from '../../session/domain/session';
import type { GameServices } from '../application/gameServices';
import { BoardTile, type TileState } from './BoardTile';
import { CursorLayer } from './CursorLayer';
import { SpaceBackground } from './primitives';

type Playing = Extract<SessionState, { phase: 'question' | 'feedback' }>;

export function PlayScreen({ services }: { readonly services: GameServices }) {
  const session = useAtomValue(sessionAtom);
  if (session.phase !== 'question' && session.phase !== 'feedback') return null;
  return (
    <SpaceBackground>
      <TopBar session={session} />
      <TileBoard session={session} services={services} />
      {session.phase === 'feedback' ? <Feedback session={session} /> : null}
      {/* With one player, "A" over the cursor would only raise the question of where B is. */}
      <CursorLayer pointers={services.pointers} showTeam={playingTeams(session.config).length > 1} />
    </SpaceBackground>
  );
}

/** The countdown turns to the warning colour for the last seconds: last chance to change your mind. */
const HURRY_MS = 5_000;

function TopBar({ session }: { readonly session: Playing }) {
  const now = useAtomValue(clockAtom);
  const total = QUESTION_TIME_MS[session.config.mode];
  const left = session.phase === 'question' ? timeLeftMs(session, now) : 0;
  const hurry = session.phase === 'question' && left <= HURRY_MS;
  const instruction = session.config.mode === 'trueFalse' ? 'Point at TRUE or FALSE and hold still' : 'Point at the answer and hold still';
  const solo = playingTeams(session.config).length === 1;
  return (
    <View style={styles.topBar}>
      <View style={styles.topRow}>
        <Score team="A" value={session.scores.A} label={solo ? 'Score' : undefined} />
        <View style={styles.promptBox}>
          <Text style={styles.round}>
            Question {session.round.number} of {session.config.rounds}
          </Text>
          <Text style={styles.prompt} adjustsFontSizeToFit numberOfLines={1}>
            {promptOf(session.round.question, session.config.mode)}
          </Text>
          <Text style={styles.instruction}>{instruction}</Text>
        </View>
        {/* An empty box of the same width keeps the question on the wall's centre line. */}
        {solo ? <View style={styles.scoreSlot} /> : <Score team="B" value={session.scores.B} />}
      </View>
      <View style={styles.timerRow}>
        <View style={styles.timerTrack}>
          <View style={[styles.timerFill, hurry && styles.timerHurry, { width: `${(left / total) * 100}%` }]} />
        </View>
        <Text style={[styles.seconds, hurry && styles.secondsHurry]}>{session.phase === 'question' ? Math.ceil(left / 1000) : 0}</Text>
      </View>
    </View>
  );
}

/** Each team's score box sits over its own half; the dot lights up while one of its children is seen. */
function Score({ team, value, label = `Team ${team}` }: { readonly team: TeamId; readonly value: number; readonly label?: string }) {
  const active = useAtomValue(activeTeamsAtom).includes(team);
  return (
    <View style={[styles.score, { borderColor: teamColor(team), opacity: active ? 1 : 0.7 }]}>
      <Text style={[styles.scoreTeam, { color: teamColor(team) }]}>
        {label} {active ? '●' : '○'}
      </Text>
      <Text style={styles.scoreValue}>{value}</Text>
    </View>
  );
}

function tileState(target: BoardTarget, round: Round, phase: Playing['phase'], correctValue: number | boolean): TileState {
  const answer = round.answers[target.team];
  if (phase === 'feedback') {
    if (target.value === correctValue) return 'correct';
    return answer?.value === target.value ? 'wrong' : 'dimmed';
  }
  // Every other tile stays open: the team may still change its mind.
  return answer?.value === target.value ? 'chosen' : 'open';
}

function TileBoard({ session, services }: { readonly session: Playing; readonly services: GameServices }) {
  const { question } = session.round;
  const mode = session.config.mode;
  const teams = playingTeams(session.config);
  const targets = useMemo(() => (mode === 'trueFalse' ? truthTargets(teams) : choiceTargets(question.options, teams)), [mode, question, teams]);
  const correctValue = mode === 'trueFalse' ? question.statement.isTrue : question.answer;

  // Every tile stays a target for the whole question (a choice can change). Targets are only
  // replaced when the question or phase changes: replacing them resets every hand's hold.
  useEffect(() => {
    services.pointers.setTargets(session.phase === 'question' ? targets : []);
  }, [services, targets, session.phase]);

  return (
    <>
      {targets.map((target) => (
        <BoardTile key={target.id} target={target} state={tileState(target, session.round, session.phase, correctValue)} pointers={services.pointers} />
      ))}
    </>
  );
}

function Feedback({ session }: { readonly session: Extract<SessionState, { phase: 'feedback' }> }) {
  const { question } = session.round;
  const anyCorrect = playingTeams(session.config).some((t) => session.round.answers[t]?.correct);
  const solution =
    session.config.mode === 'trueFalse'
      ? `${question.statement.text} is ${question.statement.isTrue ? 'TRUE' : 'FALSE'}`
      : question.prompt.replace('?', String(question.answer));
  return (
    <View pointerEvents="none" style={styles.feedback}>
      <Text style={styles.feedbackTitle}>{anyCorrect ? 'Great job!' : 'Let’s check it together'}</Text>
      <Text style={styles.feedbackSolution}>{solution}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { position: 'absolute', top: scaledPixels(32), left: scaledPixels(56), right: scaledPixels(56), gap: scaledPixels(16) },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: scaledPixels(32) },
  promptBox: { flex: 1, alignItems: 'center' },
  round: { color: colors.textTertiary, fontSize: scaledPixels(28), fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase' },
  prompt: { color: colors.text, fontSize: scaledPixels(120), fontWeight: '900' },
  instruction: { color: colors.primary, fontSize: scaledPixels(34), fontWeight: '800' },
  score: { width: scaledPixels(220), alignItems: 'center', borderWidth: scaledPixels(4), borderRadius: scaledPixels(28), paddingVertical: scaledPixels(12) },
  scoreSlot: { width: scaledPixels(220) },
  scoreTeam: { fontSize: scaledPixels(28), fontWeight: '900' },
  scoreValue: { color: colors.text, fontSize: scaledPixels(80), fontWeight: '900' },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: scaledPixels(24) },
  timerTrack: { flex: 1, height: scaledPixels(16), borderRadius: scaledPixels(8), backgroundColor: colors.cardElevated, overflow: 'hidden' },
  timerFill: { height: '100%', backgroundColor: colors.primary },
  timerHurry: { backgroundColor: colors.error },
  seconds: { minWidth: scaledPixels(90), textAlign: 'right', color: colors.text, fontSize: scaledPixels(56), fontWeight: '900' },
  secondsHurry: { color: colors.error },
  feedback: {
    position: 'absolute',
    left: '20%',
    right: '20%',
    bottom: scaledPixels(48),
    alignItems: 'center',
    backgroundColor: colors.overlay,
    borderRadius: scaledPixels(32),
    paddingVertical: scaledPixels(24),
    paddingHorizontal: scaledPixels(32),
  },
  feedbackTitle: { color: colors.primary, fontSize: scaledPixels(56), fontWeight: '900', textAlign: 'center' },
  feedbackSolution: { color: colors.text, fontSize: scaledPixels(64), fontWeight: '900', textAlign: 'center' },
});
