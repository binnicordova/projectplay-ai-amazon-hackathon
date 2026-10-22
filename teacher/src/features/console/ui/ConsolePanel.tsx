import { DEFAULT_TEAM_COUNT, GAME_MODES, SKILLS, type GameMode, type SkillId, type TeacherMessage, type TeamCount } from '@projectplay/contracts';
import { useAtom, useAtomValue } from 'jotai';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, SectionLabel, Segmented, StatusDot } from '../../../ui-kit/components';
import { colors, space, type } from '../../../ui-kit/theme';
import { roundResultsAtom, tvConnectedAtom, tvSnapshotAtom } from '../../link/application/linkService';
import {
  MODE_LABELS,
  ROUND_OPTIONS,
  SKILL_LABELS,
  TEAM_LABELS,
  TEAM_OPTIONS,
  endCommand,
  nextCommand,
  resultLabel,
  selectedModeAtom,
  selectedRoundsAtom,
  selectedSkillAtom,
  selectedTeamsAtom,
  sessionConfigAtom,
  startCommand,
} from '../application/console';

/** Session setup before a class, live controls during it. */
export function ConsolePanel({ send }: { readonly send: (message: TeacherMessage) => void }) {
  const snapshot = useAtomValue(tvSnapshotAtom);
  const live = snapshot !== null && snapshot.phase !== 'lobby';
  return <ScrollView contentContainerStyle={styles.column}>{live ? <LiveSession send={send} /> : <SessionSetup send={send} />}</ScrollView>;
}

function SessionSetup({ send }: { readonly send: (message: TeacherMessage) => void }) {
  const [skill, setSkill] = useAtom(selectedSkillAtom);
  const [mode, setMode] = useAtom(selectedModeAtom);
  const [rounds, setRounds] = useAtom(selectedRoundsAtom);
  const [teams, setTeams] = useAtom(selectedTeamsAtom);
  const config = useAtomValue(sessionConfigAtom);
  const connected = useAtomValue(tvConnectedAtom);

  return (
    <Card>
      <SectionLabel>Who plays</SectionLabel>
      <Segmented<TeamCount> options={TEAM_OPTIONS} value={teams} onChange={setTeams} labelFor={(t) => TEAM_LABELS[t].title} />
      <Text style={type.caption}>{TEAM_LABELS[teams].howTo}</Text>
      <SectionLabel>Skill</SectionLabel>
      <Segmented<SkillId> options={SKILLS} value={skill} onChange={setSkill} labelFor={(s) => SKILL_LABELS[s]} />
      <SectionLabel>How children answer</SectionLabel>
      <Segmented<GameMode> options={GAME_MODES} value={mode} onChange={setMode} labelFor={(m) => MODE_LABELS[m].title} />
      <Text style={type.caption}>{MODE_LABELS[mode].howTo}</Text>
      <SectionLabel>Questions</SectionLabel>
      <Segmented<number> options={ROUND_OPTIONS} value={rounds} onChange={setRounds} labelFor={(r) => `${r}`} />
      <Button label={connected ? 'Start on the TV' : 'Connect the TV first'} disabled={!connected} onPress={() => send(startCommand(config))} />
    </Card>
  );
}

function LiveSession({ send }: { readonly send: (message: TeacherMessage) => void }) {
  const snapshot = useAtomValue(tvSnapshotAtom);
  const results = useAtomValue(roundResultsAtom);
  if (!snapshot) return null;
  const finished = snapshot.phase === 'summary';
  const teams = snapshot.teams ?? DEFAULT_TEAM_COUNT;

  return (
    <Card>
      <SectionLabel>{finished ? 'Class summary' : `Question ${snapshot.round} of ${snapshot.rounds}`}</SectionLabel>
      {snapshot.prompt ? <Text style={type.title}>{snapshot.prompt}</Text> : null}
      <View style={styles.scores}>
        {teams === 1 ? (
          <Text style={[type.heading, { color: colors.teamA }]}>
            One player · {snapshot.scores.A} right
          </Text>
        ) : (
          <>
            <Text style={[type.heading, { color: colors.teamA }]}>Team A · {snapshot.scores.A}</Text>
            <Text style={[type.heading, { color: colors.teamB }]}>Team B · {snapshot.scores.B}</Text>
          </>
        )}
      </View>
      <View style={styles.results}>
        {results.map((r) => (
          <StatusDot key={`${r.round}-${r.team ?? 'none'}`} tone={r.correct ? 'ok' : 'bad'} label={resultLabel(r, teams)} />
        ))}
      </View>
      <View style={styles.actions}>
        {!finished ? <Button label="Next question" onPress={() => send(nextCommand)} /> : null}
        <Button label={finished ? 'Back to lobby' : 'End class'} variant={finished ? 'primary' : 'danger'} onPress={() => send(endCommand)} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  column: { gap: space.lg, padding: space.lg },
  scores: { flexDirection: 'row', gap: space.xl },
  results: { gap: space.xs },
  actions: { flexDirection: 'row', gap: space.md, flexWrap: 'wrap' },
});
