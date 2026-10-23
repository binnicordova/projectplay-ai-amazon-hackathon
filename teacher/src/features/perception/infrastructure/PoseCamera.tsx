/**
 * Camera adapter: VisionCamera v5 frame output → GPU resizer → copy one lane's crop →
 * MoveNet (TFLite). Everything heavy runs on the camera thread inside a worklet; only
 * 51 numbers per frame cross over to the JS thread. Nothing ever leaves the phone.
 *
 * The model looks at one lane per frame, chosen by laneSchedule.ts from the lanes that have
 * a child (`busyLanes`): a pose reaches the TV one inference after the picture, not two.
 *
 * While auto-calibrating, the model is skipped and small greyscale frames are sent
 * instead, for the marker detector (see application/autoCalibration.ts).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  Camera,
  CommonResolutions,
  useCameraDevice,
  useCameraDevices,
  useCameraPermission,
  useFrameOutput,
  type CameraDevice,
} from 'react-native-vision-camera';
import { useResizer } from 'react-native-vision-camera-resizer';
import { createSynchronizable, scheduleOnRN } from 'react-native-worklets';
import type { LumaFrame } from '../application/autoCalibration';
import type { PoseFrame } from '../application/perceptionPipeline';
import type { CameraBrightness, CameraStatus } from '../application/poseFeed';
import { chooseTrackingCamera, describeCamera, type CameraCandidate, type CameraKind } from '../domain/cameraChoice';
import { laneForTurn, type BusyLanes } from '../domain/laneSchedule';
import type { LaneLayout } from '../domain/lanes';
import { CHANNELS, LANE_BYTES, MODEL_INPUT_SIZE, SOURCE_BYTES, SOURCE_HEIGHT, SOURCE_WIDTH, copyLane, decodeRoi, uprightAspect } from '../domain/moveNet';
import type { Pose } from '../domain/pose';
import { LUMA_BYTES, LUMA_HEIGHT, LUMA_WIDTH, decodeLuma, encodeLuma, lumaFromRgb } from '../domain/markers';
import { useMovenetModel } from './model';

export interface PoseCameraProps {
  readonly isActive: boolean;
  /** One crop per team, and the resizer scale that makes each crop the model's input (see lanes.ts). */
  readonly lanes: LaneLayout;
  /** Lanes with a child in them: they get most of the frames (see laneSchedule.ts). */
  readonly busyLanes: BusyLanes;
  /** Exposure boost for dark classrooms (EV steps, clamped to what the camera supports). */
  readonly brightness: CameraBrightness;
  readonly onPoseFrame: (frame: PoseFrame) => void;
  /** Send greyscale frames (for calibration) instead of poses. */
  readonly captureLuma: boolean;
  readonly onLumaFrame: (frame: LumaFrame) => void;
  readonly onStatus: (status: CameraStatus) => void;
  readonly style?: StyleProp<ViewStyle>;
  /** Overlays drawn on top of the preview (calibration, skeleton). */
  readonly children?: ReactNode;
}

const EXPECTED_SHAPE = [1, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE, 3].join('x');

function cameraKind(device: CameraDevice): CameraKind {
  if (device.isVirtualDevice) return 'multi';
  switch (device.type) {
    case 'wide-angle':
      return 'main';
    case 'ultra-wide-angle':
      return 'ultra-wide';
    case 'telephoto':
      return 'telephoto';
    case 'dual':
    case 'dual-wide':
    case 'triple':
    case 'quad':
      return 'multi';
    case 'true-depth':
    case 'lidar-depth':
    case 'time-of-flight-depth':
      return 'depth';
    default:
      return 'other';
  }
}

function asCandidate(device: CameraDevice): CameraCandidate & { readonly device: CameraDevice } {
  let pixels = 0;
  try {
    pixels = Math.max(0, ...device.getSupportedResolutions('photo').map((size) => size.width * size.height));
  } catch {
    // Some cameras cannot say; resolution only breaks ties anyway.
  }
  return { id: device.id, kind: cameraKind(device), pixels, aperture: device.lensAperture, device };
}

/** The main back camera (see cameraChoice.ts), or the system's default back camera. */
function useTrackingCamera(): { readonly device: CameraDevice | undefined; readonly description: string } {
  const devices = useCameraDevices();
  const fallback = useCameraDevice('back');
  const chosen = useMemo(() => chooseTrackingCamera(devices.filter((d) => d.position === 'back').map(asCandidate)), [devices]);
  if (chosen) return { device: chosen.device, description: describeCamera(chosen) };
  return { device: fallback, description: `default back camera ${fallback?.id ?? 'none'}` };
}

const lanePoses = (lane: number, pose: Pose, count: number): (Pose | undefined)[] => Array.from({ length: count }, (_, i) => (i === lane ? pose : undefined));

// "stretch" keeps the mapping from camera space to buffer linear, so crops are exact.
const RGB_OUTPUT = { channelOrder: 'rgb', dataType: 'uint8', scaleMode: 'stretch', pixelLayout: 'interleaved' } as const;

export function PoseCamera({ isActive, lanes, busyLanes, brightness, onPoseFrame, captureLuma, onLumaFrame, onStatus, style, children }: PoseCameraProps) {
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();
  const { device, description } = useTrackingCamera();
  const plugin = useMovenetModel();
  const model = plugin.state === 'loaded' ? plugin.model : undefined;
  // Two GPU resizers: one at the lanes' scale for the model, a fixed one for the marker detector.
  const laneResizerState = useResizer({ width: lanes.sourceWidth, height: lanes.sourceHeight, ...RGB_OUTPUT });
  const markerResizerState = useResizer({ width: SOURCE_WIDTH, height: SOURCE_HEIGHT, ...RGB_OUTPUT });
  const laneResizer = laneResizerState.resizer;
  const markerResizer = markerResizerState.resizer;
  // Read by the worklet on every frame instead of captured: a new frame callback is installed
  // through a job queued on the camera thread, and a hot phone processing frames back to back
  // ran it seconds late, after calibration had already given up waiting for pictures.
  const [lumaMode] = useState(() => createSynchronizable(captureLuma));
  useEffect(() => lumaMode.setBlocking(captureLuma), [lumaMode, captureLuma]);
  // Same for the lane schedule: which lanes have a child, and a frame counter only the worklet writes.
  const [busyMask] = useState(() => createSynchronizable(busyLanes));
  useEffect(() => busyMask.setBlocking(busyLanes), [busyMask, busyLanes]);
  const [laneTurn] = useState(() => createSynchronizable(0));
  const [frameSizeLogged] = useState(() => createSynchronizable(false));

  useEffect(() => {
    if (!hasPermission && canRequestPermission) void requestPermission();
  }, [hasPermission, canRequestPermission, requestPermission]);

  useEffect(() => {
    if (!hasPermission) return onStatus({ state: 'needs-permission' });
    if (plugin.state === 'error') return onStatus({ state: 'error', message: `Pose model failed to load: ${plugin.error.message}` });
    const resizerError = laneResizerState.error ?? markerResizerState.error;
    if (resizerError) return onStatus({ state: 'error', message: `GPU resizer unavailable on this phone: ${resizerError.message}` });
    if (model) {
      const input = model.inputs[0];
      const shape = input?.shape.join('x');
      if (input?.dataType !== 'uint8' || shape !== EXPECTED_SHAPE)
        return onStatus({ state: 'error', message: `Unexpected model input ${input?.dataType} ${shape}; expected uint8 ${EXPECTED_SHAPE}.` });
    }
    onStatus(model && laneResizer && markerResizer ? { state: 'running' } : { state: 'starting' });
  }, [hasPermission, plugin, laneResizerState, markerResizerState, model, laneResizer, markerResizer, onStatus]);

  const laneCount = lanes.rois.length;
  const deliver = useCallback(
    (lane: number, pose: number[], aspect: number, workMs: number) =>
      onPoseFrame({ lanes: lanePoses(lane, pose, laneCount), aspect, timestamp: performance.now() / 1000, workMs }),
    [onPoseFrame, laneCount],
  );
  // Which camera films the class, and at what size: the first thing to check when tracking is poor.
  const logCamera = useCallback(
    (width: number, height: number) => console.log(`[camera] ${description}, frames ${width}×${height}`),
    [description],
  );
  const deliverLuma = useCallback(
    (encoded: string) => onLumaFrame({ luma: decodeLuma(encoded), width: LUMA_WIDTH, height: LUMA_HEIGHT }),
    [onLumaFrame],
  );
  // Reported once: a resizer buffer of the wrong size would silently stop poses and calibration.
  const reportedSize = useRef(false);
  const reportBufferSize = useCallback(
    (bytes: number, expected: number) => {
      if (reportedSize.current) return;
      reportedSize.current = true;
      onStatus({ state: 'error', message: `Camera resizer returned ${bytes} bytes per frame, expected ${expected}.` });
    },
    [onStatus],
  );

  const frameOutput = useFrameOutput({
    // 4:3 like the preview, so both streams see the same field of view: what the teacher
    // sees on screen is exactly what the model and the calibration see (and it is taller,
    // so more of each child fits). frameRect() still copes if a phone picks another ratio.
    targetResolution: CommonResolutions.HD_4_3,
    pixelFormat: 'yuv',
    enablePreviewSizedOutputBuffers: true,
    dropFramesWhileBusy: true,
    onFrame(frame) {
      'worklet';
      const started = performance.now();
      try {
        if (lumaMode.getDirty()) {
          if (markerResizer == null) return;
          const resized = markerResizer.resize(frame);
          try {
            const rgb = new Uint8Array(resized.getPixelBuffer());
            if (rgb.length < SOURCE_BYTES) {
              scheduleOnRN(reportBufferSize, rgb.length, SOURCE_BYTES);
              return;
            }
            const luma = new Uint8Array(LUMA_BYTES);
            lumaFromRgb(rgb, luma);
            // A string crosses from the camera thread to JS more reliably than a typed array.
            scheduleOnRN(deliverLuma, encodeLuma(luma));
          } finally {
            resized.dispose();
          }
          return;
        }
        if (laneResizer == null || model == null) return;
        if (!frameSizeLogged.getDirty()) {
          frameSizeLogged.setBlocking(true);
          scheduleOnRN(logCamera, frame.width, frame.height);
        }
        const aspect = uprightAspect(frame.width, frame.height, frame.orientation);
        const resized = laneResizer.resize(frame);
        try {
          // Right after a new calibration the old resizer still runs for a frame or two.
          if (resized.width !== lanes.sourceWidth || resized.height !== lanes.sourceHeight) return;
          const rgb = new Uint8Array(resized.getPixelBuffer());
          const expected = lanes.sourceWidth * lanes.sourceHeight * CHANNELS;
          if (rgb.length < expected) {
            scheduleOnRN(reportBufferSize, rgb.length, expected);
            return;
          }
          const turn = laneTurn.getDirty();
          laneTurn.setBlocking(turn + 1);
          const lane = laneForTurn(turn, busyMask.getDirty(), lanes.rois.length);
          const origin = lanes.origins[lane]!;
          const input = new Uint8Array(LANE_BYTES);
          copyLane(rgb, lanes.sourceWidth, lanes.sourceHeight, origin.x, origin.y, input);
          const outputs = model.runSync([input.buffer]);
          const pose = decodeRoi(new Float32Array(outputs[0]!), lanes.rois[lane]!);
          scheduleOnRN(deliver, lane, pose, aspect, performance.now() - started);
        } finally {
          resized.dispose();
        }
      } finally {
        frame.dispose();
      }
    },
  });

  // Dark room + bright projection: auto-exposure keeps the projection readable and turns
  // the children into silhouettes. Bias exposure up and enable low-light boost when offered.
  // Low-light boost lengthens exposure (motion blur, lower fps), so only the top level uses it.
  // While calibrating, plain exposure: the markers are pure white and a boost makes them bloom.
  // (Only the exposure bias changes; toggling low-light boost would restart the camera session.)
  const exposureBias = captureLuma ? 0 : brightness;
  const exposure = device?.supportsExposureBias
    ? Math.min(device.maxExposureBias, Math.max(device.minExposureBias, exposureBias))
    : undefined;
  // Only touch low-light boost on cameras that have it: configuring it elsewhere throws.
  const lowLightBoost = device?.supportsLowLightBoost ? brightness === 2 : undefined;

  return (
    <View style={[styles.container, style]}>
      {hasPermission && device ? (
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={isActive}
          outputs={[frameOutput]}
          resizeMode="contain"
          exposure={exposure}
          enableLowLightBoost={lowLightBoost}
        />
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#000', overflow: 'hidden' },
});
