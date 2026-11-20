/**
 * Pairing, lobby and summary screens. Kid-facing text is in Spanish, like the lessons.
 * Lessons always come from the teacher's phone: without it the TV shows how to connect.
 * Mimikai is on every one of them: waiting (or napping) for the phone, playing with the children
 * in the lobby, and praising the class's effort at the end.
 */
import { DEFAULT_PORT, UI_ICONS, type TeamId } from '@mimikai/contracts';
import { useAtomValue } from 'jotai';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SpatialNavigationRoot, SpatialNavigationView } from 'react-tv-space-navigation';
import FocusablePressable from '../../../components/FocusablePressable';
import { scaledPixels } from '../../../hooks/useScale';
import { colors, teamColor } from '../../../theme/colors';
import { linkStatusAtom } from '../../link/application/linkClient';
import { energyBallOnAtom, petCueAtom } from '../../pet/application/petStore';
import { ClassPet } from '../../pet/ui/ClassPet';
import { EnergyFinale } from '../../pet/ui/EnergyFinale';
import { LobbyPet } from '../../pet/ui/LobbyPet';
import { artAtom, sessionAtom } from '../../session/application/sessionStore';
import { playingTeams, summaryOf, type Finished } from '../../session/domain/session';
import type { GameServices } from '../application/gameServices';
import { CursorLayer } from './CursorLayer';
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
        <ClassPet size={PAIRING_PET} />
        <Heading style={styles.centeredText}>Mimikai</Heading>
        <Body style={styles.centeredText}>Este proyector se convierte en una pared táctil</Body>
        <Panel style={styles.panel}>
          <Text style={styles.status}>{searching}</Text>
          <Body>1. En el celular de la profesora, activa el punto de acceso (hotspot).</Body>
          <Body>2. Conecta este Fire TV a ese punto de acceso.</Body>
          <Body>3. Abre Mimikai en el celular. Esta pantalla se conecta sola (puerto {DEFAULT_PORT}).</Body>
        </Panel>
      </View>
    </SpaceBackground>
  );
}

/**
 * While the teacher picks a lesson, children meet Mimikai: its eyes follow their hands and
 * holding a hand on it makes it giggle, which practises the gesture that answers questions.
 */
export function LobbyScreen({ services }: { readonly services: GameServices }) {
  return (
    <SpaceBackground>
      <View style={styles.lobbyTop}>
        <Heading style={styles.centeredText}>¡Listos para jugar!</Heading>
        <Body style={styles.centeredText}>La profesora elige una lección en su celular</Body>
      </View>
      <LobbyPet pointers={services.pointers} />
      <View style={[styles.howTo, styles.lobbyBottom]}>
        {HOW_TO.map((item) => (
          <Panel key={item.title} style={styles.howToCard}>
            <Text style={[styles.howToTitle, styles.centeredText]}>{item.title}</Text>
            <Body style={styles.centeredText}>{item.body}</Body>
          </Panel>
        ))}
      </View>
      {/* No team letters yet: the teacher hasn't chosen one player or two teams. */}
      <CursorLayer pointers={services.pointers} showTeam={false} />
    </SpaceBackground>
  );
}

/** The teams' scores fade in under Mimikai once its energy ball has played, the way Duo celebrates before the stats. */
const FINALE_REVEAL_MS = 300;

export function SummaryScreen({ services }: { readonly services: GameServices }) {
  // Every class ends with Mimikai's energy ball, full screen; the scores come after it.
  if (useAtomValue(energyBallOnAtom)) {
    return (
      <SpaceBackground>
        <EnergyFinale />
      </SpaceBackground>
    );
  }
  return <Scores services={services} />;
}

function Scores({ services }: { readonly services: GameServices }) {
  const session = useAtomValue(sessionAtom);
  const art = useAtomValue(artAtom);
  const cue = useAtomValue(petCueAtom);
  const { height } = useWindowDimensions();
  const reveal = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(reveal, { toValue: 1, duration: 500, delay: FINALE_REVEAL_MS, useNativeDriver: true }).start();
  }, [reveal]);
  if (session.phase !== 'summary') return null;
  const view = summaryOf(session);
  const teams = playingTeams(session.config);
  return (
    <SpaceBackground>
      <SpatialNavigationRoot>
        <View style={styles.finale}>
          <Text style={styles.lessonTitle}>{session.config.lesson.title}</Text>
          {/* Mimikai owns the end of the class: big, praising the whole class, not only the winner. */}
          <ClassPet size={height * FINALE_SHARE} />
          <Heading style={styles.centeredText}>{view.title}</Heading>
          <Text style={styles.petLine}>{cue.line}</Text>
          <Animated.View style={[styles.reveal, { opacity: reveal, transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [scaledPixels(40), 0] }) }] }]}>
            {view.stars ? (
              <View style={styles.stars}>
                {[1, 2, 3].map((n) => (
                  <View key={n} style={{ opacity: n <= view.stars! ? 1 : 0.2 }}>
                    <Picture svg={art[UI_ICONS.star]} icon={UI_ICONS.star} size={scaledPixels(84)} />
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
          </Animated.View>
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
const PAIRING_PET = scaledPixels(320);
/** The finale's Mimikai: a third of the wall's height and more. */
const FINALE_SHARE = 0.36;

const styles = StyleSheet.create({
  lobbyTop: { position: 'absolute', top: '3%', left: 0, right: 0, alignItems: 'center', gap: scaledPixels(8) },
  lobbyBottom: { position: 'absolute', top: '76%', left: 0, right: 0, justifyContent: 'center' },
  finale: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: scaledPixels(10), paddingHorizontal: scaledPixels(120) },
  reveal: { alignItems: 'center', gap: scaledPixels(14) },
  petLine: { color: colors.primary, fontSize: scaledPixels(36), fontWeight: '900', textAlign: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: scaledPixels(28), paddingHorizontal: scaledPixels(120) },
  centeredText: { textAlign: 'center' },
  panel: { width: scaledPixels(1200) },
  status: { color: colors.primary, fontSize: scaledPixels(36), fontWeight: '900' },
  howTo: { flexDirection: 'row', gap: scaledPixels(32) },
  howToCard: { width: scaledPixels(480), alignItems: 'center' },
  howToTitle: { color: colors.text, fontSize: scaledPixels(40), fontWeight: '900' },
  lessonTitle: { color: colors.textTertiary, fontSize: scaledPixels(32), fontWeight: '800', textAlign: 'center' },
  stars: { flexDirection: 'row', gap: scaledPixels(24) },
  finalScores: { flexDirection: 'row', alignItems: 'center', gap: scaledPixels(32) },
  finalScore: { width: scaledPixels(420), alignItems: 'center', borderWidth: scaledPixels(6), borderRadius: scaledPixels(40), paddingVertical: scaledPixels(12) },
  winner: { backgroundColor: colors.cardElevated },
  finalTeam: { fontSize: scaledPixels(44), fontWeight: '900' },
  finalValue: { color: colors.text, fontSize: scaledPixels(96), fontWeight: '900' },
  finalDetail: { color: colors.textSecondary, fontSize: scaledPixels(28), fontWeight: '700' },
});
