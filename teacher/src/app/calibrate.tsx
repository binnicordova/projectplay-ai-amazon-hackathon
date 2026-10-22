import { router } from 'expo-router';
import { useAtomValue } from 'jotai';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useServices } from '../composition/ServicesProvider';
import { TrackingCamera } from '../composition/TrackingCamera';
import { calibrationAtom } from '../features/perception/application/calibration';
import { cameraStatusAtom } from '../features/perception/application/poseFeed';
import { AutoCalibrationPanel } from '../features/perception/ui/AutoCalibrationPanel';
import { BrightnessControl, CalibrationOverlay, SkeletonOverlay } from '../features/perception/ui/overlays';
import { Button } from '../ui-kit/components';
import { colors, space, type } from '../ui-kit/theme';

export default function CalibrateScreen() {
  const calibrated = useAtomValue(calibrationAtom) !== null;
  const camera = useAtomValue(cameraStatusAtom);
  const { autoCalibrate, cancelAutoCalibration } = useServices();
  // Edge-to-edge: keep controls clear of the navigation bar and camera cutout.
  const insets = useSafeAreaInsets();
  const edges = { bottom: space.lg + insets.bottom, left: space.lg + insets.left, right: space.lg + insets.right };

  return (
    <View style={styles.screen}>
      <TrackingCamera style={StyleSheet.absoluteFill}>
        <SkeletonOverlay />
        <CalibrationOverlay />
      </TrackingCamera>
      <View style={[styles.toolbar, { bottom: edges.bottom, right: edges.right }]}>
        <BrightnessControl />
        <Button label="Back" variant="secondary" onPress={() => router.back()} />
        <Button label="Done" disabled={!calibrated} onPress={() => router.back()} />
      </View>
      <View style={[styles.notice, { bottom: edges.bottom, left: edges.left }]}>
        {camera.state === 'error' || camera.state === 'needs-permission' ? (
          <Text style={[type.heading, styles.cameraError]}>{camera.state === 'error' ? camera.message : 'Allow camera access to calibrate.'}</Text>
        ) : (
          <AutoCalibrationPanel onStart={autoCalibrate} onCancel={cancelAutoCalibration} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  // Right half of the screen, wrapping instead of pushing "Done" off screen on narrow phones.
  toolbar: {
    position: 'absolute',
    bottom: space.lg,
    right: space.lg,
    left: '50%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: space.md,
  },
  notice: { position: 'absolute', bottom: space.lg, left: space.lg, maxWidth: '45%' },
  cameraError: { backgroundColor: colors.overlay, padding: space.md, borderRadius: 12 },
});
