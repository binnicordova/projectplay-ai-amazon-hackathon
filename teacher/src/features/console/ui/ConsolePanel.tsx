import { DEFAULT_TEAM_COUNT, type TeacherMessage, type TeamCount } from '@mimikai/contracts';
import { useAtom, useAtomValue } from 'jotai';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, SectionLabel, Segmented, StatusDot } from '../../../ui-kit/components';
import { colors, radius, space, type } from '../../../ui-kit/theme';
import { recordsAtom, selectedLessonAtom } from '../../library/application/library';
import { SUBJECT_INFO, audienceLabel, coverIcon, recordOf } from '../../library/domain/catalog';
import { roundResultsAtom, tvConnectedAtom, tvSnapshotAtom } from '../../link/application/linkService';
import { iconArtAtom } from '../../pictures/application/pictures';
import { Picture } from '../../pictures/ui/Picture';
import {
  ROUND_OPTIONS,
  TEAM_LABELS,
  TEAM_OPTIONS,
  endCommand,
  nextCommand,
  resultLabel,
  selectedRoundsAtom,
  selectedTeamsAtom,
  startCommand,
} from '../application/console';

type Send = (message: TeacherMessage) => void;

/**
 * Lesson setup before a class, live controls during it. The settings scroll; the action
 * that starts or moves the class stays pinned below them, so it is never off screen.
 */
export function ConsolePanel({ send, onChooseLesson }: { readonly send: Send; readonly onChooseLesson: () => void }) {
  const snapshot = useAtomValue(tvSnapshotAtom);
  const live = snapshot !== null && snapshot.phase !== 'lobby';
  return (
    <View style={styles.panel}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.column}>
        {live ? <LiveSession /> : <SessionSetup onChooseLesson={onChooseLesson} />}
      </ScrollView>
      {live ? <LiveActions send={send} /> : <StartAction send={send} />}
    </View>
  );
}

function SessionSetup({ onChooseLesson }: { readonly onChooseLesson: () => void }) {
  const lesson = useAtomValue(selectedLessonAtom);
  const records = useAtomValue(recordsAtom);
  const [rounds, setRounds] = useAtom(selectedRoundsAtom);
  const [teams, setTeams] = useAtom(selectedTeamsAtom);
  const record = lesson ? recordOf(records, lesson.id, teams) : undefined;

  return (
    <Card>
      <SectionLabel>Lección</SectionLabel>
      {lesson ? (
        <View style={styles.lesson}>
          <View style={[styles.cover, { backgroundColor: SUBJECT_INFO[lesson.subject].color }]}>
            <Picture icon={coverIcon(lesson)} size={44} />
          </View>
          <View style={styles.lessonText}>
            <Text style={type.heading} numberOfLines={2}>
              {lesson.title}
            </Text>
            <Text style={type.caption}>
              {SUBJECT_INFO[lesson.subject].label} · {audienceLabel(lesson)} · {lesson.cards.length} ejercicios
              {record ? ` · récord ${record}` : ''}
            </Text>
          </View>
        </View>
      ) : (
        <Text style={type.caption}>Elige una lección de la biblioteca o crea una con IA.</Text>
      )}
      <Button label="Elegir otra lección" variant="secondary" onPress={onChooseLesson} />
      <SectionLabel>Quién juega</SectionLabel>
      <Segmented<TeamCount> options={TEAM_OPTIONS} value={teams} onChange={setTeams} labelFor={(t) => TEAM_LABELS[t].title} />
      <Text style={type.caption}>{TEAM_LABELS[teams].howTo}</Text>
      <SectionLabel>Ejercicios</SectionLabel>
      <Segmented<number> options={ROUND_OPTIONS} value={rounds} onChange={setRounds} labelFor={(r) => `${r}`} />
      <Text style={type.caption}>Empiezan fáciles; la TV sube de nivel cuando la clase acierta seguido.</Text>
    </Card>
  );
}

function StartAction({ send }: { readonly send: Send }) {
  const lesson = useAtomValue(selectedLessonAtom);
  const library = useAtomValue(iconArtAtom);
  const records = useAtomValue(recordsAtom);
  const rounds = useAtomValue(selectedRoundsAtom);
  const teams = useAtomValue(selectedTeamsAtom);
  const connected = useAtomValue(tvConnectedAtom);
  const record = lesson ? recordOf(records, lesson.id, teams) : undefined;
  return (
    <Button
      label={!connected ? 'Conecta la TV primero' : lesson ? 'Jugar en la TV' : 'Elige una lección'}
      disabled={!connected || !lesson}
      onPress={() => lesson && send(startCommand({ lesson, library, rounds, teams, ...(record === undefined ? {} : { record }) }))}
    />
  );
}

function LiveSession() {
  const snapshot = useAtomValue(tvSnapshotAtom);
  const results = useAtomValue(roundResultsAtom);
  if (!snapshot) return null;
  const finished = snapshot.phase === 'summary';
  const teams = snapshot.teams ?? DEFAULT_TEAM_COUNT;

  return (
    <Card>
      <SectionLabel>{finished ? 'Resumen de la clase' : `Pregunta ${snapshot.round} de ${snapshot.rounds}${snapshot.level ? ` · nivel ${snapshot.level}` : ''}`}</SectionLabel>
      {snapshot.prompt ? <Text style={type.title}>{snapshot.prompt}</Text> : null}
      {snapshot.say && !finished ? (
        <View style={styles.say}>
          <Text style={type.label}>Diga en voz alta</Text>
          <Text style={styles.sayText}>{snapshot.say}</Text>
        </View>
      ) : null}
      <View style={styles.scores}>
        {teams === 1 ? (
          <Text style={[type.heading, { color: colors.teamA }]}>Un jugador · {snapshot.scores.A} puntos</Text>
        ) : (
          <>
            <Text style={[type.heading, { color: colors.teamA }]}>Equipo A · {snapshot.scores.A}</Text>
            <Text style={[type.heading, { color: colors.teamB }]}>Equipo B · {snapshot.scores.B}</Text>
          </>
        )}
      </View>
      <View style={styles.results}>
        {results.map((r) => (
          <StatusDot key={`${r.round}-${r.team ?? 'none'}`} tone={r.correct ? 'ok' : 'bad'} label={resultLabel(r, teams)} />
        ))}
      </View>
    </Card>
  );
}

function LiveActions({ send }: { readonly send: Send }) {
  const finished = useAtomValue(tvSnapshotAtom)?.phase === 'summary';
  return (
    <View style={styles.actions}>
      {!finished ? <Button label="Siguiente" style={styles.action} onPress={() => send(nextCommand)} /> : null}
      <Button
        label={finished ? 'Volver al inicio' : 'Terminar clase'}
        variant={finished ? 'primary' : 'danger'}
        style={styles.action}
        onPress={() => send(endCommand)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, gap: space.md },
  scroll: { flex: 1 },
  // No top padding: the card's top lines up with the camera next to it.
  column: { gap: space.lg },
  lesson: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  cover: { width: 64, height: 64, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  lessonText: { flex: 1, gap: space.xs },
  say: { backgroundColor: colors.surfaceRaised, borderRadius: radius.md, padding: space.md, gap: space.xs, borderLeftWidth: 4, borderLeftColor: colors.primary },
  sayText: { color: colors.text, fontSize: 20, fontWeight: '800' },
  scores: { flexDirection: 'row', gap: space.xl },
  results: { gap: space.xs },
  actions: { flexDirection: 'row', gap: space.md },
  action: { flex: 1, paddingHorizontal: space.md },
});
