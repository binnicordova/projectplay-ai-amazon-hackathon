/**
 * The projected game. Each team owns one half of the wall (or one player all of it); the
 * question sits on top. Children answer by pointing: a hand held on a tile chooses it. A choice
 * can change until the countdown ends; only then is it marked, scored and explained.
 *
 * What keeps children playing: points that grow with harder cards and quick answers, a fire
 * streak per team, and a banner when the class climbs a level.
 */
import { UI_ICONS, type Card, type IconArt, type TeamId } from '@projectplay/contracts';
import { useAtomValue } from 'jotai';
import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { scaledPixels } from '../../../hooks/useScale';
import { colors, teamColor } from '../../../theme/colors';
import { choiceTargets, truthTargets, type BoardTarget } from '../../interaction/domain/layout';
import { activeTeamsAtom, artAtom, clockAtom, sessionAtom } from '../../session/application/sessionStore';
import { playingTeams, questionTimeMs, roundsOf, solutionOf, timeLeftMs, type Round, type SessionState } from '../../session/domain/session';
import type { GameServices } from '../application/gameServices';
import { BoardTile, type TileState } from './BoardTile';
import { CursorLayer } from './CursorLayer';
import { Picture } from './Picture';
import { SpaceBackground } from './primitives';
import { VisualView } from './VisualView';

type Playing = Extract<SessionState, { phase: 'question' | 'feedback' }>;

export function PlayScreen({ services }: { readonly services: GameServices }) {
  const session = useAtomValue(sessionAtom);
  const art = useAtomValue(artAtom);
  if (session.phase !== 'question' && session.phase !== 'feedback') return null;
  return (
    <SpaceBackground>
      <TopBar session={session} art={art} />
      <TileBoard session={session} services={services} art={art} />
      {session.phase === 'feedback' ? <Feedback session={session} art={art} /> : null}
      {/* With one player, "A" over the cursor would only raise the question of where B is. */}
      <CursorLayer pointers={services.pointers} showTeam={playingTeams(session.config).length > 1} />
    </SpaceBackground>
  );
}

/** The countdown turns to the warning colour for the last seconds: last chance to change your mind. */
const HURRY_MS = 5_000;

function TopBar({ session, art }: { readonly session: Playing; readonly art: IconArt }) {
  const now = useAtomValue(clockAtom);
  const { width, height } = useWindowDimensions();
  const { card } = session.round;
  const total = questionTimeMs(session.config, card);
  const left = session.phase === 'question' ? timeLeftMs(session, now) : 0;
  const hurry = session.phase === 'question' && left <= HURRY_MS;
  const solo = playingTeams(session.config).length === 1;
  const preReaders = session.config.lesson.audience.band === 'inicial';
  const instruction = preReaders && card.prompt.say ? 'Escucha a tu profe y señala' : 'Señala tu respuesta y quédate quieto';
  return (
    <View style={styles.topBar}>
      <View style={styles.topRow}>
        <Score team="A" session={session} art={art} label={solo ? 'Puntos' : undefined} />
        <View style={styles.promptBox}>
          <Text style={styles.round}>
            Pregunta {session.round.number} de {roundsOf(session.config)} · Nivel {card.level}
          </Text>
          <View style={styles.promptRow}>
            {card.prompt.visual ? (
              <View style={[styles.promptVisual, { width: width * 0.26, height: height * 0.16 }]}>
                <VisualView visual={card.prompt.visual} art={art} width={width * 0.26} height={height * 0.16} textStyle={styles.promptVisualText} />
              </View>
            ) : null}
            <Text style={[styles.prompt, card.prompt.visual ? styles.promptBeside : null]} numberOfLines={2} adjustsFontSizeToFit>
              {card.prompt.text}
            </Text>
          </View>
          <Text style={styles.instruction}>{instruction}</Text>
        </View>
        {/* An empty box of the same width keeps the question on the wall's centre line. */}
        {solo ? <View style={styles.scoreSlot} /> : <Score team="B" session={session} art={art} />}
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

/** Each team's score sits over its own half; the dot lights up while one of its children is seen. */
function Score({ team, session, art, label = `Equipo ${team}` }: { readonly team: TeamId; readonly session: Playing; readonly art: IconArt; readonly label?: string }) {
  const active = useAtomValue(activeTeamsAtom).includes(team);
  const { points, streak } = session.teams[team];
  return (
    <View style={[styles.score, { borderColor: teamColor(team), opacity: active ? 1 : 0.75 }]}>
      <Text style={[styles.scoreTeam, { color: teamColor(team) }]}>
        {label} {active ? '●' : '○'}
      </Text>
      <Text style={styles.scoreValue} adjustsFontSizeToFit numberOfLines={1}>
        {points}
      </Text>
      {streak >= 2 ? (
        <View style={styles.streak}>
          <Picture svg={art[UI_ICONS.fire]} icon={UI_ICONS.fire} size={scaledPixels(40)} />
          <Text style={styles.streakText}>×{streak}</Text>
        </View>
      ) : null}
    </View>
  );
}

function tileState(target: BoardTarget, round: Round, phase: Playing['phase'], correct: number | boolean): TileState {
  const answer = round.answers[target.team];
  if (phase === 'feedback') {
    if (target.value === correct) return 'correct';
    return answer?.value === target.value ? 'wrong' : 'dimmed';
  }
  // Every other tile stays open: the team may still change its mind.
  return answer?.value === target.value ? 'chosen' : 'open';
}

const correctValue = (card: Card): number | boolean => card.answer;

function TileBoard({ session, services, art }: { readonly session: Playing; readonly services: GameServices; readonly art: IconArt }) {
  const { card } = session.round;
  const teams = playingTeams(session.config);
  const targets = useMemo(() => (card.kind === 'trueFalse' ? truthTargets(teams) : choiceTargets(card.options, teams)), [card, teams]);

  // Every tile stays a target for the whole question (a choice can change). Targets are only
  // replaced when the card or phase changes: replacing them resets every hand's hold.
  useEffect(() => {
    services.pointers.setTargets(session.phase === 'question' ? targets : []);
  }, [services, targets, session.phase]);

  return (
    <>
      {targets.map((target) => (
        <BoardTile key={target.id} target={target} state={tileState(target, session.round, session.phase, correctValue(card))} pointers={services.pointers} art={art} />
      ))}
    </>
  );
}

function Feedback({ session, art }: { readonly session: Extract<SessionState, { phase: 'feedback' }>; readonly art: IconArt }) {
  const { card } = session.round;
  const teams = playingTeams(session.config);
  const anyCorrect = teams.some((t) => session.round.answers[t]?.correct);
  const answerVisual = card.kind === 'choice' ? card.options[card.answer] : undefined;
  const levelUp = session.outcome.level === 'up';
  return (
    <>
      {levelUp ? (
        <View pointerEvents="none" style={styles.levelBanner}>
          <Text style={styles.levelBannerText}>¡Subimos al nivel {session.progress.level}!</Text>
        </View>
      ) : null}
      <View pointerEvents="none" style={styles.feedback}>
        <Text style={styles.feedbackTitle}>{anyCorrect ? '¡Muy bien!' : '¡Casi! Veamos juntos'}</Text>
        <View style={styles.solutionRow}>
          {answerVisual && answerVisual.kind !== 'text' ? (
            <VisualView visual={answerVisual} art={art} width={scaledPixels(260)} height={scaledPixels(110)} />
          ) : (
            <Text style={styles.feedbackSolution}>{solutionOf(card)}</Text>
          )}
        </View>
        {card.explain ? (
          <Text style={styles.explain} numberOfLines={2}>
            {card.explain}
          </Text>
        ) : null}
        <View style={styles.pointsRow}>
          {teams
            .filter((t) => session.outcome.points[t] > 0)
            .map((t) => (
              <Text key={t} style={[styles.points, { color: teamColor(t) }]}>
                {teams.length > 1 ? `Equipo ${t} ` : ''}+{session.outcome.points[t]}
              </Text>
            ))}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  topBar: { position: 'absolute', top: scaledPixels(24), left: scaledPixels(56), right: scaledPixels(56), gap: scaledPixels(12) },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: scaledPixels(32) },
  promptBox: { flex: 1, alignItems: 'center' },
  round: { color: colors.textTertiary, fontSize: scaledPixels(26), fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase' },
  promptRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: scaledPixels(24), maxWidth: '100%' },
  promptVisual: { alignItems: 'center', justifyContent: 'center' },
  promptVisualText: { color: colors.primary },
  prompt: { color: colors.text, fontSize: scaledPixels(76), fontWeight: '900', textAlign: 'center', flexShrink: 1 },
  promptBeside: { fontSize: scaledPixels(60), textAlign: 'left' },
  instruction: { color: colors.primary, fontSize: scaledPixels(30), fontWeight: '800' },
  score: { width: scaledPixels(240), alignItems: 'center', borderWidth: scaledPixels(4), borderRadius: scaledPixels(28), paddingVertical: scaledPixels(10) },
  scoreSlot: { width: scaledPixels(240) },
  scoreTeam: { fontSize: scaledPixels(26), fontWeight: '900' },
  scoreValue: { color: colors.text, fontSize: scaledPixels(68), fontWeight: '900' },
  streak: { flexDirection: 'row', alignItems: 'center', gap: scaledPixels(4) },
  streakText: { color: colors.warning, fontSize: scaledPixels(32), fontWeight: '900' },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: scaledPixels(24) },
  timerTrack: { flex: 1, height: scaledPixels(14), borderRadius: scaledPixels(7), backgroundColor: colors.cardElevated, overflow: 'hidden' },
  timerFill: { height: '100%', backgroundColor: colors.primary },
  timerHurry: { backgroundColor: colors.error },
  seconds: { minWidth: scaledPixels(90), textAlign: 'right', color: colors.text, fontSize: scaledPixels(52), fontWeight: '900' },
  secondsHurry: { color: colors.error },
  feedback: {
    position: 'absolute',
    left: '18%',
    right: '18%',
    bottom: scaledPixels(36),
    alignItems: 'center',
    backgroundColor: colors.overlay,
    borderRadius: scaledPixels(32),
    paddingVertical: scaledPixels(20),
    paddingHorizontal: scaledPixels(32),
    gap: scaledPixels(8),
  },
  feedbackTitle: { color: colors.primary, fontSize: scaledPixels(56), fontWeight: '900', textAlign: 'center' },
  solutionRow: { alignItems: 'center', justifyContent: 'center', minHeight: scaledPixels(80) },
  feedbackSolution: { color: colors.text, fontSize: scaledPixels(64), fontWeight: '900', textAlign: 'center' },
  explain: { color: colors.textSecondary, fontSize: scaledPixels(32), fontWeight: '700', textAlign: 'center' },
  pointsRow: { flexDirection: 'row', gap: scaledPixels(48) },
  points: { fontSize: scaledPixels(48), fontWeight: '900' },
  levelBanner: {
    position: 'absolute',
    top: '36%',
    alignSelf: 'center',
    backgroundColor: colors.primary,
    borderRadius: scaledPixels(40),
    paddingVertical: scaledPixels(20),
    paddingHorizontal: scaledPixels(56),
  },
  levelBannerText: { color: colors.textOnPrimary, fontSize: scaledPixels(72), fontWeight: '900' },
});
