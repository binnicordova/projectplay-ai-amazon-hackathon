/**
 * Vega OS has no stock react-native-svg (see RigPart.kepler.tsx), so Rayitas is drawn with plain
 * views: ovals and rounded bars in its colours, at the art's positions. The rig moves them as on
 * Fire OS; stripes and whiskers are left out. Stars and hearts are text glyphs.
 */
import { memo, type ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { TIGER_BOX, type TigerFace } from '../tiger';
import type { TigerPart as Part } from '../tigerArt';

export type TigerLayer = Part | `face:${TigerFace}`;

const FUR = '#FF9A3D';
const FAR = '#E07A26';
const CREAM = '#FFE9C9';
const INK = '#1E1747';

const oval = (u: number, cx: number, cy: number, rx: number, ry: number, color: string, extra: ViewStyle = {}): ViewStyle => ({
  position: 'absolute',
  left: (cx - rx - TIGER_BOX.x) * u,
  top: (cy - ry - TIGER_BOX.y) * u,
  width: 2 * rx * u,
  height: 2 * ry * u,
  borderRadius: Math.max(rx, ry) * u,
  backgroundColor: color,
  ...extra,
});
const leg = (u: number, x: number, color: string) => oval(u, x + 8, -17, 8, 17, color, { borderRadius: 8 * u });

function shapes(layer: TigerLayer, u: number): ReactNode[] {
  switch (layer) {
    case 'tail':
      return [<View key="t" style={oval(u, -48, -58, 5, 22, FUR, { transform: [{ rotate: '-35deg' }] })} />];
    case 'farBack':
      return [<View key="l" style={leg(u, -30, FAR)} />];
    case 'farFront':
      return [<View key="l" style={leg(u, 12, FAR)} />];
    case 'body':
      return [<View key="b" style={oval(u, 0, -36, 38, 22, FUR)} />, <View key="c" style={oval(u, 4, -22, 26, 8.5, CREAM)} />];
    case 'nearBack':
      return [<View key="l" style={leg(u, -30, FUR)} />];
    case 'nearFront':
      return [<View key="l" style={leg(u, 12, FUR)} />];
    case 'head':
      return [
        <View key="el" style={oval(u, 15, -90, 10, 10, FUR)} />,
        <View key="er" style={oval(u, 53, -90, 10, 10, FUR)} />,
        <View key="h" style={oval(u, 34, -66, 31, 27, FUR)} />,
        <View key="m" style={oval(u, 34, -56, 16, 7.5, CREAM)} />,
      ];
    default: {
      const closed = layer === 'face:happy' || layer === 'face:focus';
      return [-12, 12].map((dx) => <View key={dx} style={oval(u, 34 + dx, -71, 5, closed ? 2 : 5.8, INK)} />);
    }
  }
}

export const TigerPart = memo(function TigerPart({ layer, width, height }: { readonly layer: TigerLayer; readonly width: number; readonly height: number }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { width, height }]}>
      {shapes(layer, height / TIGER_BOX.height)}
    </View>
  );
});

export const Shape = memo(function Shape({ kind, color, size }: { readonly kind: 'star' | 'heart'; readonly color: string; readonly size: number }) {
  return <Text style={{ color, fontSize: size * 0.9, lineHeight: size, width: size, textAlign: 'center' }}>{kind === 'star' ? '★' : '♥'}</Text>;
});

/** Half a hoop: a tall rounded outline with only one side showing. */
export const HoopArc = memo(function HoopArc({ half, color, rx, ry, stroke }: { readonly half: 'back' | 'front'; readonly color: string; readonly rx: number; readonly ry: number; readonly stroke: number }) {
  const hidden = 'transparent';
  return (
    <View
      style={{
        width: 2 * (rx + stroke),
        height: 2 * (ry + stroke),
        borderRadius: rx + stroke,
        borderWidth: stroke,
        borderColor: color,
        borderTopColor: hidden,
        borderBottomColor: hidden,
        borderLeftColor: half === 'back' ? color : hidden,
        borderRightColor: half === 'front' ? color : hidden,
      }}
    />
  );
});
