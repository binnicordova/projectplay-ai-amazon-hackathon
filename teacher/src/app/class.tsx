import { router } from 'expo-router';
import { useAtomValue } from 'jotai';
import { StyleSheet, View } from 'react-native';
import { useServices } from '../composition/ServicesProvider';
import { TrackingCamera } from '../composition/TrackingCamera';
import { ConsolePanel } from '../features/console/ui/ConsolePanel';
import { calibrationAtom } from '../features/perception/application/calibration';
import { autoCalibrationStateAtom } from '../features/perception/application/autoCalibration';
import { AutoCalibrationPanel } from '../features/perception/ui/AutoCalibrationPanel';
import { BrightnessControl, SkeletonOverlay, TrackingStatus } from '../features/perception/ui/overlays';
import { Button } from '../ui-kit/components';
import { colors, radius, space } from '../ui-kit/theme';

export default function ClassScreen() {
  const { send, autoCalibrate, cancelAutoCalibration } = useServices();
  // The panel stays on screen until the projection is found; then a small button is enough.
  const calibrated = useAtomValue(calibrationAtom) !== null;
  const autoState = useAtomValue(autoCalibrationStateAtom);
  const showPanel = !calibrated || autoState === 'running' || autoState === 'failed';

  return (
    <View style={styles.screen}>
      <View style={styles.cameraColumn}>
        <TrackingCamera style={styles.camera}>
          <SkeletonOverlay />
          {showPanel ? (
            <View style={styles.panel}>
              <AutoCalibrationPanel onStart={autoCalibrate} onCancel={cancelAutoCalibration} />
            </View>
          ) : null}
        </TrackingCamera>
        <View style={styles.row}>
          <Button label="Home" variant="secondary" onPress={() => router.back()} />
          <TrackingStatus />
          <View style={styles.spacer} />
          {showPanel ? null : <Button label="Recalibrate" variant="secondary" onPress={autoCalibrate} />}
          <BrightnessControl />
        </View>
      </View>
      <View style={styles.consoleColumn}>
        <ConsolePanel send={send} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, flexDirection: 'row', backgroundColor: colors.background, padding: space.lg, gap: space.lg },
  cameraColumn: { flex: 3, gap: space.md },
  camera: { flex: 1, borderRadius: radius.lg },
  // Wraps on narrow phones: the brightness control must stay reachable, not slide under the console.
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.md, columnGap: space.lg },
  spacer: { flex: 1 },
  panel: { position: 'absolute', left: space.md, bottom: space.md, right: space.md },
  consoleColumn: { flex: 2 },
});
