/** Pairing, lobby and summary screens, navigable with the TV remote. */
import { DEFAULT_PORT } from '@projectplay/contracts';
import { useAtomValue } from 'jotai';
import { StyleSheet, Text, View } from 'react-native';
import { SpatialNavigationRoot, SpatialNavigationView } from 'react-tv-space-navigation';
import FocusablePressable from '../../../components/FocusablePressable';
import { scaledPixels } from '../../../hooks/useScale';
import { colors, teamColor } from '../../../theme/colors';
import { linkStatusAtom } from '../../link/application/linkClient';
import { sessionAtom } from '../../session/application/sessionStore';
import { playingTeams, summaryTitle } from '../../session/domain/session';
import type { GameServices } from '../application/gameServices';
import { Body, Heading, Panel, SpaceBackground } from './primitives';

const HOW_TO = [
  { title: 'Point', body: 'Reach for your answer on the wall' },
  { title: 'Hold still', body: 'The tile fills up and turns your colour' },
  { title: 'Changed your mind?', body: 'Hold another tile before the time runs out' },
];

export function PairingScreen({ services }: { readonly services: GameServices }) {
  const status = useAtomValue(linkStatusAtom);
  const searching = status.state === 'searching' ? `Looking for the teacher’s phone… (attempt ${status.attempt})` : status.state === 'offline' ? status.reason : 'Connected';
  return (
    <SpaceBackground>
      <SpatialNavigationRoot>
        <View style={styles.centered}>
          <Heading style={styles.centeredText}>ProjectPlay</Heading>
          <Body style={styles.centeredText}>Turn this projector into a touch wall</Body>
          <Panel style={styles.panel}>
            <Text style={styles.status}>{searching}</Text>
            <Body>1. On the teacher’s phone, turn on the hotspot.</Body>
            <Body>2. Connect this Fire TV to that hotspot.</Body>
            <Body>3. Open ProjectPlay Teacher. This screen connects by itself (port {DEFAULT_PORT}).</Body>
          </Panel>
          <SpatialNavigationView direction="horizontal">
            <FocusablePressable text="Practice with the remote" onSelect={services.startPractice} />
          </SpatialNavigationView>
        </View>
      </SpatialNavigationRoot>
    </SpaceBackground>
  );
}

export function LobbyScreen({ services }: { readonly services: GameServices }) {
  return (
    <SpaceBackground>
      <SpatialNavigationRoot>
        <View style={styles.centered}>
          <Heading style={styles.centeredText}>Ready to play!</Heading>
          <Body style={styles.centeredText}>Waiting for the teacher to start the class</Body>
          <View style={styles.howTo}>
            {HOW_TO.map((item) => (
              <Panel key={item.title} style={styles.howToCard}>
                <Text style={[styles.howToTitle, styles.centeredText]}>{item.title}</Text>
                <Body style={styles.centeredText}>{item.body}</Body>
              </Panel>
            ))}
          </View>
          <SpatialNavigationView direction="horizontal">
            <FocusablePressable text="Practice with the remote" onSelect={services.startPractice} />
          </SpatialNavigationView>
        </View>
      </SpatialNavigationRoot>
    </SpaceBackground>
  );
}

export function SummaryScreen({ services }: { readonly services: GameServices }) {
  const session = useAtomValue(sessionAtom);
  if (session.phase !== 'summary') return null;
  const teams = playingTeams(session.config);
  return (
    <SpaceBackground>
      <SpatialNavigationRoot>
        <View style={styles.centered}>
          <Heading style={styles.centeredText}>{summaryTitle(session.config, session.scores)}</Heading>
          <View style={styles.finalScores}>
            {teams.map((team) => (
              <View key={team} style={[styles.finalScore, { borderColor: teamColor(team) }]}>
                <Text style={[styles.finalTeam, { color: teamColor(team) }]}>{teams.length === 1 ? 'Correct' : `Team ${team}`}</Text>
                <Text style={styles.finalValue}>{session.scores[team]}</Text>
              </View>
            ))}
          </View>
          <Body style={styles.centeredText}>Out of {session.config.rounds} questions. Thanks for playing!</Body>
          <SpatialNavigationView direction="horizontal">
            <FocusablePressable text="Back to lobby" onSelect={services.backToLobby} />
          </SpatialNavigationView>
        </View>
      </SpatialNavigationRoot>
    </SpaceBackground>
  );
}

/**
 * Everything on these screens sits on the projection's vertical centre line, which is also
 * where the teacher's phone splits the two teams. An element even slightly off it looks
 * misaligned on the wall, so blocks are centred by the column and wrapped text by textAlign.
 */
const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: scaledPixels(32), paddingHorizontal: scaledPixels(120) },
  centeredText: { textAlign: 'center' },
  panel: { width: scaledPixels(1200) },
  status: { color: colors.primary, fontSize: scaledPixels(36), fontWeight: '900' },
  howTo: { flexDirection: 'row', gap: scaledPixels(32) },
  howToCard: { width: scaledPixels(480), alignItems: 'center' },
  howToTitle: { color: colors.text, fontSize: scaledPixels(40), fontWeight: '900' },
  finalScores: { flexDirection: 'row', gap: scaledPixels(64) },
  finalScore: { width: scaledPixels(360), alignItems: 'center', borderWidth: scaledPixels(6), borderRadius: scaledPixels(40), paddingVertical: scaledPixels(24) },
  finalTeam: { fontSize: scaledPixels(44), fontWeight: '900' },
  finalValue: { color: colors.text, fontSize: scaledPixels(160), fontWeight: '900' },
});
