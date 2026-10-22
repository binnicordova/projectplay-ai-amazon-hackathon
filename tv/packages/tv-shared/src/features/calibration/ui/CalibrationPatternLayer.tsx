/**
 * Full-screen calibration pattern, drawn above every screen while the phone films it:
 * pure black with white squares at the positions both apps agree on. Once the pattern
 * has actually been drawn (two animation frames later) the TV tells the phone.
 */
import { MARKER_SIZE, markersFor, type CalibrationPattern } from '@projectplay/contracts';
import { useAtomValue } from 'jotai';
import { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { calibrationPatternAtom } from '../application/calibrationPattern';

export function CalibrationPatternLayer({ onShown }: { readonly onShown: (pattern: CalibrationPattern) => void }) {
  const request = useAtomValue(calibrationPatternAtom);
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    if (!request) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => onShown(request.pattern));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [request, onShown]);

  if (!request) return null;
  const side = MARKER_SIZE * height;
  return (
    <View pointerEvents="none" style={styles.cover}>
      {markersFor(request.pattern).map((m) => (
        <View key={`${m.x}:${m.y}`} style={[styles.marker, { left: m.x * width - side / 2, top: m.y * height - side / 2, width: side, height: side }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000', zIndex: 1000, elevation: 1000 },
  marker: { position: 'absolute', backgroundColor: '#fff' },
});
