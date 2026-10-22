import { DEFAULT_PORT } from '@projectplay/contracts';
import { useAtomValue } from 'jotai';
import { StyleSheet, Text, View } from 'react-native';
import { Card, SectionLabel, StatusDot } from '../../../ui-kit/components';
import { space, type } from '../../../ui-kit/theme';
import { latencyMsAtom, serverStatusAtom, tvClientsAtom } from '../application/linkService';

const STEPS = [
  'Turn on this phone’s hotspot (no mobile data needed).',
  'On the Fire TV: Settings → Network → join the hotspot.',
  'Open ProjectPlay on the TV. It finds this phone on its own.',
];

export function ConnectionPanel() {
  const status = useAtomValue(serverStatusAtom);
  const clients = useAtomValue(tvClientsAtom);
  const latency = useAtomValue(latencyMsAtom);
  const connected = clients.length > 0;

  return (
    <Card>
      <SectionLabel>Fire TV link</SectionLabel>
      {status.state === 'error' ? (
        <StatusDot tone="bad" label={`Server error: ${status.message}`} />
      ) : connected ? (
        <StatusDot tone="ok" label={`TV connected${latency !== null ? ` · ${latency} ms` : ''}`} />
      ) : (
        <StatusDot tone="wait" label={status.state === 'listening' ? `Waiting for the TV on port ${DEFAULT_PORT}…` : 'Starting…'} />
      )}
      {connected ? (
        clients.map((c) => (
          <Text key={c.id} style={type.caption}>
            {c.platform ?? 'TV'} · {c.address}
          </Text>
        ))
      ) : (
        <View style={styles.steps}>
          {STEPS.map((step, i) => (
            <Text key={step} style={type.caption}>
              {i + 1}. {step}
            </Text>
          ))}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({ steps: { gap: space.xs } });
