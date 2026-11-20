/**
 * One layer of Rayitas, drawn over the whole tiger box so the layers stack exactly. Static: the
 * rig only moves the views around them. Also the energy ball's star and heart.
 */
import { memo } from 'react';
import { StyleSheet } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { TIGER_BOX, type TigerFace } from '../tiger';
import { HEART_PATH, STAR_PATH, TIGER_ART, TIGER_FACE_ART, type TigerPart as Part } from '../tigerArt';

const VIEW_BOX = `${TIGER_BOX.x} ${TIGER_BOX.y} ${TIGER_BOX.width} ${TIGER_BOX.height}`;

export type TigerLayer = Part | `face:${TigerFace}`;

const artOf = (layer: TigerLayer) => (layer.startsWith('face:') ? TIGER_FACE_ART[layer.slice(5) as TigerFace] : TIGER_ART[layer as Part]);

export const TigerPart = memo(function TigerPart({ layer, width, height }: { readonly layer: TigerLayer; readonly width: number; readonly height: number }) {
  return <SvgXml xml={`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEW_BOX}">${artOf(layer)}</svg>`} width={width} height={height} style={StyleSheet.absoluteFill} />;
});

/** A star or a heart filling a square `size` across. */
export const Shape = memo(function Shape({ kind, color, size }: { readonly kind: 'star' | 'heart'; readonly color: string; readonly size: number }) {
  const d = kind === 'star' ? STAR_PATH : HEART_PATH;
  const outline = kind === 'star' ? ' stroke="#1E1747" stroke-width="0.12" stroke-linejoin="round"' : '';
  return <SvgXml xml={`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1.1 -1.1 2.2 2.2"><path d="${d}" fill="${color}"${outline}/></svg>`} width={size} height={size} />;
});

/** Half a hoop seen side on: the back half (left) goes behind Rayitas, the front half in front. */
export const HoopArc = memo(function HoopArc({ half, color, rx, ry, stroke }: { readonly half: 'back' | 'front'; readonly color: string; readonly rx: number; readonly ry: number; readonly stroke: number }) {
  const w = 2 * (rx + stroke);
  const h = 2 * (ry + stroke);
  const sweep = half === 'back' ? 0 : 1;
  const path = `M${w / 2} ${stroke} A${rx} ${ry} 0 0 ${sweep} ${w / 2} ${h - stroke}`;
  return (
    <SvgXml
      xml={`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><path d="${path}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"/></svg>`}
      width={w}
      height={h}
    />
  );
});
