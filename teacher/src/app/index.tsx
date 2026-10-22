import { router } from 'expo-router';
import { useAtomValue } from 'jotai';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ConnectionPanel } from '../features/link/ui/ConnectionPanel';
import { homographyAtom } from '../features/perception/application/calibration';
import { Button, Card, SectionLabel, StatusDot } from '../ui-kit/components';
import { space, type } from '../ui-kit/theme';

export default function HomeScreen() {
  const calibrated = useAtomValue(homographyAtom) !== null;
  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      <View style={styles.column}>
        <Text style={type.title}>ProjectPlay</Text>
        <Text style={type.caption}>Turn any projector into a touch wall. Children answer by pointing at the wall; nothing leaves this phone.</Text>
        <ConnectionPanel />
      </View>
      <View style={styles.column}>
        <Card>
          <SectionLabel>1 · Camera</SectionLabel>
          <Text style={type.caption}>
            Put the phone on a tripod behind the children, facing the projected image. It finds the projection by itself: the TV
            shows four white squares for a moment.
          </Text>
          <StatusDot tone={calibrated ? 'ok' : 'wait'} label={calibrated ? 'Projection calibrated' : 'Calibrates when the class starts'} />
          <Button label="Check camera view" variant="secondary" onPress={() => router.push('/calibrate')} />
        </Card>
        <Card>
          <SectionLabel>2 · Class</SectionLabel>
          <Button label="Start class" onPress={() => router.push('/class')} />
          <Button label="Use phone as touchpad (no camera)" variant="secondary" onPress={() => router.push('/touchpad')} />
        </Card>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, flexDirection: 'row', gap: space.xl, padding: space.xl },
  column: { flex: 1, gap: space.lg },
});
