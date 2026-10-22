/**
 * Overlays drawn on top of the camera preview. Both use the same letterbox
 * geometry as the preview (resizeMode "contain"), so what you see lines up with
 * what the model sees. If the skeleton sits on the child, coordinates are right.
 */
import type { TeamId } from '@projectplay/contracts';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { colors, radius, space, type } from '../../../ui-kit/theme';
import {
  addCornerAtom,
  calibrationAtom,
  calibrationErrorAtom,
  draftCornersAtom,
  nextCornerLabelAtom,
  teamZonesAtom,
} from '../application/calibration';
import { autoCalibrationStateAtom, lumaCaptureAtom } from '../application/autoCalibration';
import {
  cameraAspectAtom,
  cameraBrightnessAtom,
  cameraStatusAtom,
  perceptionViewAtom,
  slowTrackingFpsAtom,
  type CameraBrightness,
} from '../application/poseFeed';
import { cameraToView, frameRect, viewToCamera, type Rect } from '../domain/previewGeometry';
import type { TeamZone } from '../domain/teamZones';
import { KEYPOINT_COUNT, MIN_KEYPOINT_SCORE, type Point2 } from '../domain/pose';
import { Segmented, StatusDot } from '../../../ui-kit/components';

function useImageRect() {
  const aspect = useAtomValue(cameraAspectAtom);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const onLayout = (e: LayoutChangeEvent) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height });
  return { rect: frameRect(size.width, size.height, aspect), onLayout };
}

const LANE_COLORS = [colors.teamA, colors.teamB];
const TEAM_COLORS: Record<TeamId, string> = { A: colors.teamA, B: colors.teamB };

/**
 * What the TV will use: each team's half of the projection, the joints of each child being
 * tracked and, as rings, the hands sent as pointers. An empty lane shows nothing, even when
 * the model "sees" a body in the projected picture. If a child's hand has no ring, the TV
 * cannot see it either; usually the fix is light on the children or moving the phone closer.
 */
export function SkeletonOverlay() {
  // While calibrating the camera films markers instead of running the model.
  const capturing = useAtomValue(lumaCaptureAtom);
  const latest = useAtomValue(perceptionViewAtom);
  const view = capturing ? null : latest;
  const { rect, onLayout } = useImageRect();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={onLayout}>
      <TeamZones rect={rect} />
      {view?.lanes.map(({ pose }, lane) =>
        pose
          ? Array.from({ length: KEYPOINT_COUNT }, (_, k) => {
              const score = pose[k * 3 + 2] ?? 0;
              if (score < MIN_KEYPOINT_SCORE) return null;
              const p = cameraToView({ x: pose[k * 3]!, y: pose[k * 3 + 1]! }, rect);
              return <View key={`${lane}-${k}`} style={[styles.joint, { left: p.x - 5, top: p.y - 5, backgroundColor: LANE_COLORS[lane] }]} />;
            })
          : null,
      )}
      {view?.lanes.map(({ pointers }, lane) =>
        pointers.map((point, i) => {
          const p = cameraToView(point, rect);
          return <View key={`hand-${lane}-${i}`} style={[styles.hand, { left: p.x - 14, top: p.y - 14, borderColor: LANE_COLORS[lane] }]} />;
        }),
      )}
    </View>
  );
}

/** Camera state in a few words, with a nudge when tracking runs too slowly to feel responsive. */
export function TrackingStatus() {
  const camera = useAtomValue(cameraStatusAtom);
  const slowFps = useAtomValue(slowTrackingFpsAtom);
  if (camera.state === 'running') {
    // A hot phone throttles its processor: frames slow down and pointers lag.
    return slowFps === null ? (
      <StatusDot tone="ok" label="Tracking children" />
    ) : (
      <StatusDot tone="wait" label={`Slow tracking (${slowFps} fps): let the phone cool`} />
    );
  }
  return <StatusDot tone={camera.state === 'starting' ? 'wait' : 'bad'} label={camera.state === 'error' ? camera.message : 'Starting camera…'} />;
}

/**
 * The two team halves, split where the TV splits them (`teamForX`), so they always sit on
 * the calibrated projection (one player: the whole projection, no split). The model's crops
 * (lanes.ts) are deliberately not drawn: they are square and padded for the body, so they
 * never line up with the picture and only confuse.
 */
function TeamZones({ rect }: { readonly rect: Rect }) {
  const zones = useAtomValue(teamZonesAtom);
  if (!zones) return null;
  return (
    <>
      {zoneLines(zones).map(([from, to, color], i) => (
        <Segment key={`zone-${i}`} from={cameraToView(from, rect)} to={cameraToView(to, rect)} color={color} thickness={2} />
      ))}
      {zones.map((zone) => {
        const p = cameraToView(zone.labelAt, rect);
        return (
          <View key={`label-${zone.team}`} style={[styles.zoneLabelSlot, { left: p.x - ZONE_LABEL_SLOT / 2, top: p.y - 12 }]}>
            <View style={[styles.zoneLabel, { backgroundColor: TEAM_COLORS[zone.team] }]}>
              <Text style={styles.zoneLabelText}>{zones.length === 1 ? 'One player' : `Team ${zone.team}`}</Text>
            </View>
          </View>
        );
      })}
    </>
  );
}

/** Each team's outer edges in its colour; the shared divider once, neutral, so neither hides the other. */
function zoneLines(zones: readonly TeamZone[]): readonly (readonly [Point2, Point2, string])[] {
  const [a, b] = zones;
  if (!a) return [];
  if (!b) {
    const [tl, tr, br, bl] = a.quad;
    return [
      [tl, tr, colors.teamA],
      [tr, br, colors.teamA],
      [br, bl, colors.teamA],
      [bl, tl, colors.teamA],
    ];
  }
  const [tl, top, bottom, bl] = a.quad;
  const [, tr, br] = b.quad;
  return [
    [tl, top, colors.teamA],
    [bl, tl, colors.teamA],
    [bottom, bl, colors.teamA],
    [top, tr, colors.teamB],
    [tr, br, colors.teamB],
    [br, bottom, colors.teamB],
    [top, bottom, colors.text],
  ];
}

const BRIGHTNESS_LEVELS: readonly CameraBrightness[] = [0, 1, 2];
const BRIGHTNESS_LABELS: Record<CameraBrightness, string> = { 0: 'Normal', 1: 'Bright', 2: 'Brighter' };

/** Exposure boost: in a dark room the projection is bright and the children are silhouettes. */
export function BrightnessControl() {
  const [brightness, setBrightness] = useAtom(cameraBrightnessAtom);
  return <Segmented options={BRIGHTNESS_LEVELS} value={brightness} onChange={setBrightness} labelFor={(level) => BRIGHTNESS_LABELS[level]} />;
}

export function CalibrationOverlay() {
  const { rect, onLayout } = useImageRect();
  const addCorner = useSetAtom(addCornerAtom);
  const draft = useAtomValue(draftCornersAtom);
  const committed = useAtomValue(calibrationAtom);
  const nextLabel = useAtomValue(nextCornerLabelAtom);
  const error = useAtomValue(calibrationErrorAtom);
  const auto = useAtomValue(autoCalibrationStateAtom);

  const corners: readonly Point2[] = draft.length > 0 ? draft : committed ?? [];
  const instruction =
    auto === 'running'
      ? 'Finding the projection… keep it clear for a few seconds'
      : error ??
        (draft.length > 0
          ? `Tap the ${nextLabel} corner of the projected image`
          : committed
            ? 'Projection found. Tap a corner to adjust it by hand.'
            : `Waiting for automatic calibration, or tap the ${nextLabel} corner yourself`);

  return (
    <Pressable
      style={StyleSheet.absoluteFill}
      onLayout={onLayout}
      disabled={auto === 'running'}
      onPress={(e) => {
        const camera = viewToCamera({ x: e.nativeEvent.locationX, y: e.nativeEvent.locationY }, rect);
        if (camera) addCorner(camera);
      }}
    >
      <QuadOutline corners={corners} rect={rect} closed={corners.length === 4} />
      <View style={[styles.banner, error ? styles.bannerError : null]}>
        <Text style={type.heading}>{instruction}</Text>
      </View>
    </Pressable>
  );
}

function QuadOutline({ corners, rect, closed }: { readonly corners: readonly Point2[]; readonly rect: Rect; readonly closed: boolean }) {
  const points = corners.map((c) => cameraToView(c, rect));
  const edges = closed ? points.map((p, i) => [p, points[(i + 1) % points.length]!] as const) : points.slice(1).map((p, i) => [points[i]!, p] as const);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {edges.map(([a, b], i) => (
        <Segment key={`edge-${i}`} from={a} to={b} color={colors.primary} thickness={3} />
      ))}
      {points.map((p, i) => (
        <View key={`corner-${i}`} style={[styles.corner, { left: p.x - 14, top: p.y - 14 }]}>
          <Text style={styles.cornerLabel}>{i + 1}</Text>
        </View>
      ))}
    </View>
  );
}

/** A straight line in view pixels: a thin view, rotated about its centre. */
function Segment({ from, to, color, thickness }: { readonly from: Point2; readonly to: Point2; readonly color: string; readonly thickness: number }) {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  return (
    <View
      style={{
        position: 'absolute',
        width: length,
        height: thickness,
        left: (from.x + to.x) / 2 - length / 2,
        top: (from.y + to.y) / 2 - thickness / 2,
        borderRadius: thickness / 2,
        backgroundColor: color,
        transform: [{ rotate: `${angle}rad` }],
      }}
    />
  );
}

/** Fixed width the team label is centred in, so it needs no measuring. */
const ZONE_LABEL_SLOT = 120;

const styles = StyleSheet.create({
  joint: { position: 'absolute', width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: '#0008' },
  zoneLabelSlot: { position: 'absolute', width: ZONE_LABEL_SLOT, alignItems: 'center' },
  zoneLabel: { paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill, opacity: 0.9 },
  zoneLabelText: { color: colors.background, fontSize: 13, fontWeight: '800' },
  hand: { position: 'absolute', width: 28, height: 28, borderRadius: 14, borderWidth: 3, backgroundColor: 'rgba(255,255,255,0.25)' },
  banner: {
    position: 'absolute',
    top: space.lg,
    alignSelf: 'center',
    backgroundColor: colors.overlay,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderRadius: radius.pill,
  },
  bannerError: { borderColor: colors.danger, borderWidth: 1 },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cornerLabel: { color: colors.onPrimary, fontWeight: '800' },
});
