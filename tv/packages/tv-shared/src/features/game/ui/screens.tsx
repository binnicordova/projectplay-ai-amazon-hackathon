/**
 * Pairing, lobby and summary screens. Kid-facing text is in Spanish, like the lessons.
 * Lessons always come from the teacher's phone: without it the TV shows how to connect.
 */
import { DEFAULT_PORT, UI_ICONS, type TeamId } from '@projectplay/contracts';
import { useAtomValue } from 'jotai';
import { StyleSheet, Text, View } from 'react-native';
import { SpatialNavigationRoot, SpatialNavigationView } from 'react-tv-space-navigation';
import FocusablePressable from '../../../components/FocusablePressable';
import { scaledPixels } from '../../../hooks/useScale';
import { colors, teamColor } from '../../../theme/colors';
import { linkStatusAtom } from '../../link/application/linkClient';
import { artAtom, sessionAtom } from '../../session/application/sessionStore';
import { playingTeams, summaryOf, type Finished } from '../../session/domain/session';
import type { GameServices } from '../application/gameServices';
import { Picture } from './Picture';
import { Body, Heading, Panel, SpaceBackground } from './primitives';

const HOW_TO = [
  { title: 'Señala', body: 'Estira el brazo hacia tu respuesta en la pared' },
  { title: 'Quédate quieto', body: 'La tarjeta se llena con el color de tu equipo' },
  { title: '¿Cambiaste de idea?', body: 'Señala otra antes de que acabe el tiempo' },
];

export function PairingScreen() {
  const status = useAtomValue(linkStatusAtom);
  const searching =
    status.state === 'searching' ? `Buscando el celular de la profesora… (intento ${status.attempt})` : status.state === 'offline' ? status.reason : 'Conectado';
  return (
    <SpaceBackground>
      <View style={styles.centered}>
        <Heading style={styles.centeredText}>ProjectPlay</Heading>
        <Body style={styles.centeredText}>Este proyector se convierte en una pared táctil</Body>
        <Panel style={styles.panel}>
          <Text style={styles.status}>{searching}</Text>
          <Body>1. En el celular de la profesora, activa el punto de acceso (hotspot).</Body>
          <Body>2. Conecta este Fire TV a ese punto de acceso.</Body>
          <Body>3. Abre ProjectPlay Teacher. Esta pantalla se conecta sola (puerto {DEFAULT_PORT}).</Body>
        </Panel>
      </View>
    </SpaceBackground>
  );
}

export function LobbyScreen() {
  return (
    <SpaceBackground>
      <View style={styles.centered}>
        <Heading style={styles.centeredText}>¡Listos para jugar!</Heading>
        <Body style={styles.centeredText}>La profesora elige una lección en su celular</Body>
        <View style={styles.howTo}>
          {HOW_TO.map((item) => (
            <Panel key={item.title} style={styles.howToCard}>
              <Text style={[styles.howToTitle, styles.centeredText]}>{item.title}</Text>
              <Body style={styles.centeredText}>{item.body}</Body>
            </Panel>
          ))}
        </View>
      </View>
    </SpaceBackground>
  );
}

export function SummaryScreen({ services }: { readonly services: GameServices }) {
  const session = useAtomValue(sessionAtom);
  const art = useAtomValue(artAtom);
  if (session.phase !== 'summary') return null;
  const view = summaryOf(session);
  const teams = playingTeams(session.config);
  return (
    <SpaceBackground>
      <SpatialNavigationRoot>
        <View style={styles.centered}>
          <Text style={styles.lessonTitle}>{session.config.lesson.title}</Text>
          <Heading style={styles.centeredText}>{view.title}</Heading>
          {view.stars ? (
            <View style={styles.stars}>
              {[1, 2, 3].map((n) => (
                <View key={n} style={{ opacity: n <= view.stars! ? 1 : 0.2 }}>
                  <Picture svg={art[UI_ICONS.star]} icon={UI_ICONS.star} size={scaledPixels(120)} />
                </View>
              ))}
            </View>
          ) : null}
          <View style={styles.finalScores}>
            {teams.map((team) => (
              <TeamResult key={team} team={team} finished={session} solo={teams.length === 1} winner={view.winner === team} />
            ))}
          </View>
          <Body style={styles.centeredText}>
            {view.newRecord
              ? '¡Nuevo récord en esta lección!'
              : session.config.record !== undefined
                ? `Récord de esta lección: ${session.config.record} puntos`
                : `Llegaron hasta el nivel ${session.topLevel}. ¡Gracias por jugar!`}
          </Body>
          <SpatialNavigationView direction="horizontal">
            <FocusablePressable text="Volver" onSelect={services.backToLobby} />
          </SpatialNavigationView>
        </View>
      </SpatialNavigationRoot>
    </SpaceBackground>
  );
}

function TeamResult({ team, finished, solo, winner }: { readonly team: TeamId; readonly finished: Finished; readonly solo: boolean; readonly winner: boolean }) {
  const stats = finished.teams[team];
  return (
    <View style={[styles.finalScore, { borderColor: teamColor(team) }, winner && styles.winner]}>
      <Text style={[styles.finalTeam, { color: teamColor(team) }]}>{solo ? 'Puntos' : `Equipo ${team}`}</Text>
      <Text style={styles.finalValue}>{stats.points}</Text>
      <Text style={styles.finalDetail}>
        {stats.correct} de {finished.rounds} correctas · racha {stats.bestStreak}
      </Text>
    </View>
  );
}

/**
 * Everything on these screens sits on the projection's vertical centre line, which is also
 * where the teacher's phone splits the two teams. An element even slightly off it looks
 * misaligned on the wall, so blocks are centred by the column and wrapped text by textAlign.
 */
const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: scaledPixels(28), paddingHorizontal: scaledPixels(120) },
  centeredText: { textAlign: 'center' },
  panel: { width: scaledPixels(1200) },
  status: { color: colors.primary, fontSize: scaledPixels(36), fontWeight: '900' },
  howTo: { flexDirection: 'row', gap: scaledPixels(32) },
  howToCard: { width: scaledPixels(480), alignItems: 'center' },
  howToTitle: { color: colors.text, fontSize: scaledPixels(40), fontWeight: '900' },
  lessonTitle: { color: colors.textTertiary, fontSize: scaledPixels(32), fontWeight: '800', textAlign: 'center' },
  stars: { flexDirection: 'row', gap: scaledPixels(24) },
  finalScores: { flexDirection: 'row', gap: scaledPixels(64) },
  finalScore: { width: scaledPixels(420), alignItems: 'center', borderWidth: scaledPixels(6), borderRadius: scaledPixels(40), paddingVertical: scaledPixels(20) },
  winner: { backgroundColor: colors.cardElevated },
  finalTeam: { fontSize: scaledPixels(44), fontWeight: '900' },
  finalValue: { color: colors.text, fontSize: scaledPixels(140), fontWeight: '900' },
  finalDetail: { color: colors.textSecondary, fontSize: scaledPixels(28), fontWeight: '700' },
});
