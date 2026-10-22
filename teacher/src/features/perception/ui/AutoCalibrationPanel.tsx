/**
 * Status of the automatic calibration, with the one action that makes sense right now
 * (cancel while running, try again after a failure, recalibrate when done).
 */
import { useAtomValue } from 'jotai';
import { StyleSheet, Text, View } from 'react-native';
import { tvConnectedAtom } from '../../link/application/linkService';
import { Button, StatusDot } from '../../../ui-kit/components';
import { colors, radius, space, type } from '../../../ui-kit/theme';
import { autoCalibrationAtom } from '../application/autoCalibration';
import { calibrationAtom } from '../application/calibration';

export function AutoCalibrationPanel({ onStart, onCancel }: { readonly onStart: () => void; readonly onCancel: () => void }) {
  const status = useAtomValue(autoCalibrationAtom);
  const calibrated = useAtomValue(calibrationAtom) !== null;
  const tvConnected = useAtomValue(tvConnectedAtom);

  if (status.state === 'running') {
    return (
      <View style={styles.panel}>
        <StatusDot tone="wait" label={`Calibrating automatically · ${status.step + 1} of ${status.steps}`} />
        <Text style={type.caption}>The TV shows white squares for a moment. Keep the projection clear.</Text>
        <Text style={type.caption}>
          {status.tvConfirmed ? 'TV: showing the pattern ✓' : 'TV: asked to show the pattern…'}
          {'   ·   '}
          {status.frames > 0 ? `Camera: ${status.frames} pictures ✓` : 'Camera: waiting for pictures…'}
        </Text>
        <Button label="Cancel" variant="secondary" onPress={onCancel} />
      </View>
    );
  }
  if (status.state === 'failed') {
    return (
      <View style={[styles.panel, styles.failed]}>
        <StatusDot tone="bad" label="Calibration failed" />
        <Text style={type.caption}>{status.reason}</Text>
        <Button label="Try again" disabled={!tvConnected} onPress={onStart} />
      </View>
    );
  }
  if (calibrated) {
    return (
      <View style={styles.panel}>
        <StatusDot tone="ok" label={status.state === 'done' ? 'Projection found automatically' : 'Calibrated'} />
        <Button label="Recalibrate" variant="secondary" disabled={!tvConnected} onPress={onStart} />
      </View>
    );
  }
  return (
    <View style={styles.panel}>
      <StatusDot tone="wait" label={tvConnected ? 'Starting calibration…' : 'Connect the TV to calibrate automatically'} />
      <Button label="Calibrate automatically" disabled={!tvConnected} onPress={onStart} />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: space.sm, backgroundColor: colors.overlay, padding: space.md, borderRadius: radius.md, maxWidth: 420 },
  failed: { borderColor: colors.danger, borderWidth: 1 },
});
