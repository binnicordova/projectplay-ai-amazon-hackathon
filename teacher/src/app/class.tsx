import { router } from 'expo-router';
import { useAtomValue } from 'jotai';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
    // Landscape puts the navigation bar on a side: keep the pinned "Jugar" button clear of it.
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <View style={styles.cameraColumn}>
        <TrackingCamera style={styles.camera}>
          <SkeletonOverlay />
          {/* Camera state and its fix sit on the picture they describe, so the toolbar fits on one line. */}
          <View style={styles.cameraBar} pointerEvents="box-none">
            <View pointerEvents="none" style={styles.status}>
              <TrackingStatus />
            </View>
            {showPanel ? null : <Button label="Recalibrar" variant="secondary" style={styles.compact} onPress={autoCalibrate} />}
          </View>
          {showPanel ? (
            <View style={styles.panel}>
              <AutoCalibrationPanel onStart={autoCalibrate} onCancel={cancelAutoCalibration} />
            </View>
          ) : null}
        </TrackingCamera>
        <View style={styles.toolbar}>
          <Button label="Inicio" variant="secondary" style={styles.compact} onPress={() => router.back()} />
          <BrightnessControl />
        </View>
      </View>
      <View style={styles.consoleColumn}>
        <ConsolePanel send={send} onChooseLesson={() => router.push('/library')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, flexDirection: 'row', backgroundColor: colors.background, padding: space.lg, gap: space.lg },
  cameraColumn: { flex: 3, gap: space.md },
  camera: { flex: 1, borderRadius: radius.lg },
  cameraBar: {
    position: 'absolute',
    top: space.md,
    left: space.md,
    right: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  status: {
    flexShrink: 1,
    backgroundColor: colors.overlay,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  // Wraps on narrow phones: the brightness control must stay reachable, not slide under the console.
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  compact: { minHeight: 40, paddingHorizontal: space.lg },
  panel: { position: 'absolute', left: space.md, bottom: space.md, right: space.md },
  consoleColumn: { flex: 2 },
});
