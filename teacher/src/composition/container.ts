/**
 * Composition root: the only place that knows concrete implementations.
 * Creates the single Jotai store and wires infrastructure adapters to use cases.
 */
import type { TeacherMessage } from '@projectplay/contracts';
import { createStore } from 'jotai';
import { makeAskForLesson, makeLessonChat, type LessonChat } from '../features/authoring/application/lessonChat';
import { aiSettingsFromEnv, chatModelFor } from '../features/authoring/infrastructure/providers';
import { selectedTeamsAtom, teamCountFor } from '../features/console/application/console';
import { makeLibrary, type Library } from '../features/library/application/library';
import { fileLessonStore } from '../features/library/infrastructure/fileLessonStore';
import { STARTER_LESSON_FILES } from '../features/library/infrastructure/starterLessons.generated';
import { iconArtAtom } from '../features/pictures/application/pictures';
import { TWEMOJI_ART } from '../features/pictures/infrastructure/twemojiArt.generated';
import { createLinkService, tvConnectedAtom, tvSnapshotAtom, type LinkService } from '../features/link/application/linkService';
import { TcpWebSocketServer } from '../features/link/infrastructure/tcpWebSocketServer';
import { AutoCalibrator, autoCalibrationAtom, type LumaFrame } from '../features/perception/application/autoCalibration';
import { calibrationAtom, homographyAtom, resetCalibrationAtom } from '../features/perception/application/calibration';
import { PerceptionPipeline, type PoseFrame } from '../features/perception/application/perceptionPipeline';
import {
  busyLanesAtom,
  cameraAspectAtom,
  cameraStatusAtom,
  frameRateAtom,
  perceptionViewAtom,
  teamCountAtom,
  type CameraStatus,
} from '../features/perception/application/poseFeed';
import { FrameRateMeter } from '../features/perception/domain/frameRate';
import { LANE_COUNT } from '../features/perception/domain/moveNet';

export interface AppServices {
  readonly store: ReturnType<typeof createStore>;
  readonly link: LinkService;
  /** Sends a message to the TV (used by the console). */
  readonly send: (message: TeacherMessage) => void;
  /** Feeds a camera frame through the perception pipeline. */
  readonly feedPoseFrame: (frame: PoseFrame) => void;
  readonly reportCameraStatus: (status: CameraStatus) => void;
  /** Finds the projection automatically: the TV shows markers, the camera films them. */
  readonly autoCalibrate: () => void;
  readonly cancelAutoCalibration: () => void;
  /** Greyscale camera frames, only while auto-calibrating. */
  readonly feedLumaFrame: (frame: LumaFrame) => void;
  /** Starter lessons and the teacher's own, records included. */
  readonly library: Library;
  /** Creating lessons by chatting with the AI (needs internet). */
  readonly chat: LessonChat;
}

const newLessonId = () => `ai-${Date.now().toString(36)}-${Math.floor(Math.random() * 36 ** 4).toString(36)}`;

export function createAppServices(appVersion: string): AppServices {
  const store = createStore();
  const link = createLinkService(new TcpWebSocketServer(), store, { appVersion });
  const pipeline = new PerceptionPipeline((message) => link.send(message));

  // Lessons: bundled pictures, the starter collection plus saved lessons, and the AI chat.
  store.set(iconArtAtom, TWEMOJI_ART);
  const library = makeLibrary({ store, files: fileLessonStore, starterFiles: STARTER_LESSON_FILES });
  void library.load().then(() => console.log(`[library] ${STARTER_LESSON_FILES.length} starter lessons loaded`));
  const chat = makeLessonChat(
    store,
    makeAskForLesson({ model: chatModelFor(aiSettingsFromEnv()), now: () => new Date().toISOString(), newId: newLessonId, random: Math.random }),
  );
  // The TV stores nothing: the best score of each lesson is kept here when a class ends.
  store.sub(tvSnapshotAtom, () => {
    const snapshot = store.get(tvSnapshotAtom);
    if (snapshot?.phase !== 'summary' || !snapshot.lessonId) return;
    const teams = snapshot.teams ?? 2;
    void library.recordScore(snapshot.lessonId, teams, teams === 1 ? snapshot.scores.A : Math.max(snapshot.scores.A, snapshot.scores.B));
  });

  const applyCalibration = () => pipeline.setCalibration(store.get(homographyAtom), store.get(calibrationAtom));
  applyCalibration();
  store.sub(homographyAtom, applyCalibration);

  // The camera looks for one child per team: one lane per half, or one over the whole wall.
  const syncTeamCount = () => {
    const count = teamCountFor(store.get(tvSnapshotAtom), store.get(selectedTeamsAtom));
    if (count !== store.get(teamCountAtom)) store.set(teamCountAtom, count);
  };
  syncTeamCount();
  store.sub(tvSnapshotAtom, syncTeamCount);
  store.sub(selectedTeamsAtom, syncTeamCount);
  store.sub(teamCountAtom, () => {
    const count = store.get(teamCountAtom);
    pipeline.setLaneCount(count);
    console.log(count === 1 ? '[camera] one player: one lane over the whole wall' : '[camera] two teams: one lane per half');
  });

  const calibrator = new AutoCalibrator({ store, send: (message) => link.send(message), isTvConnected: () => store.get(tvConnectedAtom) });
  link.onMessage((message) => {
    if (message.t === 'calib') calibrator.onPatternShown(message.shown);
  });
  store.sub(tvConnectedAtom, () => {
    if (store.get(tvConnectedAtom) || !calibrator.isRunning) return;
    calibrator.cancel('The TV disconnected during calibration. It will reconnect by itself; then tap "Try again".');
  });

  // One line per milestone in the device log (adb logcat -s ReactNativeJS), read by `scripts/devices.sh verify`.
  store.sub(tvConnectedAtom, () => console.log(store.get(tvConnectedAtom) ? '[link] TV connected' : '[link] TV disconnected'));
  let lastCalibLog = '';
  store.sub(autoCalibrationAtom, () => {
    const status = store.get(autoCalibrationAtom);
    const line =
      status.state === 'running'
        ? `[calib] step ${status.step + 1}/${status.steps}, TV ${status.tvConfirmed ? 'confirmed' : 'not confirmed yet'}`
        : status.state === 'done'
          ? `[calib] done, check marker off by ${status.centerError?.toFixed(4) ?? 'n/a'}`
          : status.state === 'failed'
            ? `[calib] failed: ${status.reason}`
            : '[calib] idle';
    if (line !== lastCalibLog) console.log((lastCalibLog = line));
  });

  const frameRate = new FrameRateMeter();
  let lastPerfLog = 0;
  // Pose updates per lane since the last [perf] line: what each child's pointer really gets.
  const laneUpdates = new Array<number>(LANE_COUNT).fill(0);

  return {
    store,
    link,
    send: link.send,
    feedPoseFrame: (frame) => {
      store.set(perceptionViewAtom, pipeline.process(frame));
      const busy = pipeline.busyLanes;
      if (busy !== store.get(busyLanesAtom)) store.set(busyLanesAtom, busy);
      const lanesInUse = store.get(teamCountAtom);
      frame.lanes.forEach((pose, lane) => {
        if (pose !== undefined && lane < lanesInUse) laneUpdates[lane]!++;
      });
      frameRate.add(frame.timestamp, frame.workMs ?? 0);
      const rate = frameRate.rate;
      store.set(frameRateAtom, rate);
      // How fast tracking really runs on this phone (it slows down when the phone gets hot).
      if (lastPerfLog === 0) lastPerfLog = frame.timestamp;
      const sinceLog = frame.timestamp - lastPerfLog;
      if (rate && sinceLog > 10) {
        const perLane = laneUpdates
          .slice(0, lanesInUse)
          .map((n, lane) => `${lanesInUse === 1 ? 'wall' : lane === 0 ? 'A' : 'B'} ${(n / sinceLog).toFixed(1)}/s${(busy >> lane) & 1 ? '' : ' (empty)'}`);
        console.log(`[perf] ${rate.fps.toFixed(1)} fps, ${rate.workMs.toFixed(0)} ms per frame on the camera thread; updates per lane: ${perLane.join(', ')}`);
        lastPerfLog = frame.timestamp;
        laneUpdates.fill(0);
      }
      if (Math.abs(store.get(cameraAspectAtom) - frame.aspect) > 0.01) {
        store.set(cameraAspectAtom, frame.aspect);
        // A calibration is only valid for the field of view it was found in: find it again.
        if (store.get(calibrationAtom) !== null) {
          store.set(resetCalibrationAtom);
          store.set(autoCalibrationAtom, { state: 'idle' });
        }
      }
    },
    reportCameraStatus: (status) => store.set(cameraStatusAtom, status),
    autoCalibrate: () => calibrator.start(),
    cancelAutoCalibration: () => calibrator.cancel(),
    feedLumaFrame: (frame) => calibrator.onLumaFrame(frame),
    library,
    chat,
  };
}
