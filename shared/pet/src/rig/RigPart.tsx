/**
 * One layer of the rig, drawn over the whole rig box so every layer stacks exactly. Each layer is
 * a static drawing: Pet.tsx only moves the views around them, so the SVG is drawn once per mood.
 */
import { memo } from 'react';
import { StyleSheet } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { RIG_BOX } from '../juggle';
import type { Face } from '../moods';
import { BODY_ART, FACE_ART, FX_ART, type BodyPart } from '../art';

export type ArtFx = keyof typeof FX_ART;
export type RigPartName = BodyPart | 'eyes' | 'mouth' | ArtFx;

const VIEW_BOX = `${RIG_BOX.x} ${RIG_BOX.y} ${RIG_BOX.width} ${RIG_BOX.height}`;

function artOf(part: RigPartName, face: Face): string {
  if (part === 'eyes' || part === 'mouth') return FACE_ART[face][part];
  return part in BODY_ART ? BODY_ART[part as BodyPart] : FX_ART[part as ArtFx];
}

export const RigPart = memo(function RigPart({ part, face = 'happy', width, height }: { readonly part: RigPartName; readonly face?: Face; readonly width: number; readonly height: number }) {
  const art = artOf(part, face);
  if (!art) return null;
  return <SvgXml xml={`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEW_BOX}">${art}</svg>`} width={width} height={height} style={StyleSheet.absoluteFill} />;
});
