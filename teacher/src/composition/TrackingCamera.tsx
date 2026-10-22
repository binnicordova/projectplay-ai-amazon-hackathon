/**
 * The camera wired to the perception pipeline: reads where to look (lane crops follow the
 * calibration) and how bright to expose, and feeds every frame to the app services.
 * Routes use this instead of wiring PoseCamera themselves, so both screens behave the same.
 *
 * It also calibrates by itself: as soon as the TV is connected and the camera runs, an
 * uncalibrated phone asks the TV for the markers and finds the projection on its own.
 */
import { useAtomValue } from 'jotai';
import { useEffect, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { tvConnectedAtom } from '../features/link/application/linkService';
import { autoCalibrationStateAtom, lumaCaptureAtom } from '../features/perception/application/autoCalibration';
import { calibrationAtom, laneLayoutAtom } from '../features/perception/application/calibration';
import { busyLanesAtom, cameraBrightnessAtom, cameraStatusAtom } from '../features/perception/application/poseFeed';
import { PoseCamera } from '../features/perception/infrastructure/PoseCamera';
import { useServices } from './ServicesProvider';

export function TrackingCamera({ style, children }: { readonly style?: StyleProp<ViewStyle>; readonly children?: ReactNode }) {
  const { feedPoseFrame, feedLumaFrame, reportCameraStatus } = useServices();
  const lanes = useAtomValue(laneLayoutAtom);
  const busyLanes = useAtomValue(busyLanesAtom);
  const brightness = useAtomValue(cameraBrightnessAtom);
  const captureLuma = useAtomValue(lumaCaptureAtom);
  useAutoCalibrateWhenReady();
  return (
    <PoseCamera
      isActive
      lanes={lanes}
      busyLanes={busyLanes}
      brightness={brightness}
      captureLuma={captureLuma}
      onPoseFrame={feedPoseFrame}
      onLumaFrame={feedLumaFrame}
      onStatus={reportCameraStatus}
      style={style}
    >
      {children}
    </PoseCamera>
  );
}

/** Starts automatic calibration once everything it needs is there (a failure waits for "Try again"). */
function useAutoCalibrateWhenReady(): void {
  const { autoCalibrate } = useServices();
  const tvConnected = useAtomValue(tvConnectedAtom);
  const cameraRunning = useAtomValue(cameraStatusAtom).state === 'running';
  const calibrated = useAtomValue(calibrationAtom) !== null;
  const idle = useAtomValue(autoCalibrationStateAtom) === 'idle';
  useEffect(() => {
    if (tvConnected && cameraRunning && !calibrated && idle) autoCalibrate();
  }, [tvConnected, cameraRunning, calibrated, idle, autoCalibrate]);
}
