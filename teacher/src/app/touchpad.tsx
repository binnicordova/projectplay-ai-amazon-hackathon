import { router } from 'expo-router';
import { useAtomValue } from 'jotai';
import { StyleSheet, View } from 'react-native';
import { useServices } from '../composition/ServicesProvider';
import { ConsolePanel } from '../features/console/ui/ConsolePanel';
import { Touchpad } from '../features/console/ui/Touchpad';
import { teamCountAtom } from '../features/perception/application/poseFeed';
import { Button } from '../ui-kit/components';
import { colors, space } from '../ui-kit/theme';

export default function TouchpadScreen() {
  const { send } = useServices();
  // The same count the camera uses: the TV's running session, else the teacher's choice.
  const teams = useAtomValue(teamCountAtom);
  return (
    <View style={styles.screen}>
      <View style={styles.padColumn}>
        <Touchpad send={send} teams={teams} />
        <Button label="Home" variant="secondary" onPress={() => router.back()} />
      </View>
      <View style={styles.consoleColumn}>
        <ConsolePanel send={send} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, flexDirection: 'row', backgroundColor: colors.background, padding: space.lg, gap: space.lg },
  padColumn: { flex: 3, gap: space.md },
  consoleColumn: { flex: 2 },
});
