/**
 * Vega OS has no stock react-native-svg (see Picture.kepler.tsx), so the same layers are drawn
 * with plain views: ovals and rounded bars in the logo's colours, at the logo's positions. The
 * rig moves them exactly as on Fire OS; faces are simpler and the drawn effects are left out.
 */
import { memo, type ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { RIG_BOX, type Point } from '../juggle';
import type { Face } from '../moods';
import type { BodyPart } from '../art';

export type RigPartName = BodyPart | 'eyes' | 'mouth' | 'confetti' | 'hearts' | 'heart' | 'zzz' | 'spark' | 'twinkle' | 'rays';

const VIOLET = '#9B7BFF';
const SUCKER = '#E2D9FF';
const INK = '#1E1747';
const BLUSH = '#FF8FBF';

const oval = (u: number, c: Point, rx: number, ry: number, color: string, extra: ViewStyle = {}): ViewStyle => ({
  position: 'absolute',
  left: (c.x - rx - RIG_BOX.x) * u,
  top: (c.y - ry - RIG_BOX.y) * u,
  width: 2 * rx * u,
  height: 2 * ry * u,
  borderRadius: Math.max(rx, ry) * u,
  backgroundColor: color,
  ...extra,
});

/** A rounded bar from one point to another (a tentacle). */
function limb(u: number, from: Point, to: Point, thick: number): ViewStyle {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const angle = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI - 90;
  return { ...oval(u, { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }, thick / 2, length / 2, VIOLET), transform: [{ rotate: `${angle}deg` }] };
}

const SKIRT: readonly (readonly [Point, Point])[] = [
  [{ x: 88, y: 182 }, { x: 40, y: 192 }],
  [{ x: 102, y: 192 }, { x: 66, y: 222 }],
  [{ x: 120, y: 198 }, { x: 98, y: 236 }],
  [{ x: 136, y: 198 }, { x: 158, y: 236 }],
  [{ x: 154, y: 192 }, { x: 190, y: 222 }],
  [{ x: 168, y: 182 }, { x: 216, y: 192 }],
];

/** Faces whose eyes are round and blink; the others draw closed, curved eyes with the mouth. */
const OPEN_EYES: readonly Face[] = ['open', 'think', 'grin', 'wow', 'sparkle', 'wink'];

function shapes(part: RigPartName, face: Face, u: number): ReactNode[] {
  switch (part) {
    case 'shadow':
      return [<View key="s" style={oval(u, { x: 128, y: 254 }, 86, 9, 'rgba(0,0,0,0.28)')} />];
    case 'armL':
    case 'armR': {
      const side = part === 'armL' ? 1 : -1;
      const x = (v: number) => (side === 1 ? v : 256 - v);
      return [
        <View key="a" style={limb(u, { x: x(74), y: 160 }, { x: x(45), y: 92 }, 17)} />,
        <View key="t" style={oval(u, { x: x(45), y: 89 }, 8.5, 8.5, VIOLET)} />,
        <View key="s" style={oval(u, { x: x(54.3), y: 119.5 }, 5.6, 5.6, SUCKER)} />,
      ];
    }
    case 'skirt':
      return [
        <View key="b" style={oval(u, { x: 128, y: 186 }, 52, 16, VIOLET)} />,
        ...SKIRT.flatMap(([from, to], i) => [<View key={`l${i}`} style={limb(u, from, to, 16)} />, <View key={`t${i}`} style={oval(u, to, 7, 7, VIOLET)} />]),
      ];
    case 'head':
      return [
        <View key="h" style={oval(u, { x: 128, y: 140 }, 70, 62, VIOLET)} />,
        <View key="s" style={oval(u, { x: 94, y: 106 }, 14, 8.5, 'rgba(255,255,255,0.5)', { transform: [{ rotate: '-28deg' }] })} />,
        <View key="l" style={oval(u, { x: 82, y: 164 }, 12.5, 7.5, BLUSH)} />,
        <View key="r" style={oval(u, { x: 174, y: 164 }, 12.5, 7.5, BLUSH)} />,
      ];
    case 'eyes':
      if (!OPEN_EYES.includes(face)) return [];
      return (face === 'wink' ? [154] : [102, 154]).flatMap((cx) => [
        <View key={`e${cx}`} style={oval(u, { x: cx, y: 145 }, 10, 12.5, INK)} />,
        <View key={`p${cx}`} style={oval(u, { x: cx + 4, y: 139 }, 4, 4, '#FFFFFF')} />,
      ]);
    case 'mouth': {
      const closed = (OPEN_EYES.includes(face) ? (face === 'wink' ? [102] : []) : [102, 154]).map((cx) => (
        <View key={`c${cx}`} style={oval(u, { x: cx, y: 143 }, 12, 4, INK)} />
      ));
      const smile = face === 'sleepy' || face === 'think' ? oval(u, { x: 128, y: 170 }, 5, 4, INK) : { ...oval(u, { x: 128, y: 166 }, 14, 9, INK), borderTopLeftRadius: 0, borderTopRightRadius: 0 };
      return [...closed, <View key="m" style={smile} />];
    }
    default:
      return [];
  }
}

export const RigPart = memo(function RigPart({ part, face = 'happy', width, height }: { readonly part: RigPartName; readonly face?: Face; readonly width: number; readonly height: number }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { width, height }]}>
      {shapes(part, face, height / RIG_BOX.height)}
    </View>
  );
});
