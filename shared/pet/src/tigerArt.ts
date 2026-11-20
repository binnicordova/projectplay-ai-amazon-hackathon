/**
 * Rayitas cut into layers, generated from the tiger in docs/brand/motion/mimikai-moods.html
 * (regenerate rather than hand-edit). Every layer is drawn in tiger units with the feet at (0, 0),
 * so the layers stack exactly and each turns about its own joint (see TIGER_PIVOT).
 * Tiger orange is Rayitas's colour only; its stripes are the brand Ink.
 */
import type { TigerFace } from './tiger';

export type TigerPart = 'tail' | 'farBack' | 'farFront' | 'body' | 'nearBack' | 'nearFront' | 'head';

export const TIGER_ART: Readonly<Record<TigerPart, string>> = {
  tail: "<path d=\"M-34 -40 C-54 -42 -62 -58 -56 -78\" fill=\"none\" stroke=\"#FF9A3D\" stroke-width=\"10\" stroke-linecap=\"round\"/><path d=\"M-50.8 -47.1 L-51.3 -47.6 L-51.8 -48.1 L-52.3 -48.7 L-52.7 -49.2 L-53.1 -49.7 L-53.5 -50.3\" fill=\"none\" stroke=\"#1E1747\" stroke-width=\"10\" stroke-linecap=\"butt\"/><path d=\"M-56.8 -57.0 L-56.9 -57.7 L-57.1 -58.4 L-57.3 -59.1 L-57.4 -59.9 L-57.6 -60.6 L-57.7 -61.3\" fill=\"none\" stroke=\"#1E1747\" stroke-width=\"10\" stroke-linecap=\"butt\"/><circle cx=\"-56\" cy=\"-78\" r=\"5\" fill=\"#1E1747\"/>",
  farBack: "<rect x=\"-30\" y=\"-34\" width=\"16\" height=\"34\" rx=\"8\" fill=\"#E07A26\"/>",
  farFront: "<rect x=\"12\" y=\"-34\" width=\"16\" height=\"34\" rx=\"8\" fill=\"#E07A26\"/>",
  body: "<ellipse cx=\"0\" cy=\"-36\" rx=\"38\" ry=\"22\" fill=\"#FF9A3D\"/><ellipse cx=\"4\" cy=\"-22\" rx=\"26\" ry=\"8.5\" fill=\"#FFE9C9\"/><path d=\"M-24 -57 q-2 7 2 12\" fill=\"none\" stroke=\"#1E1747\" stroke-width=\"5\" stroke-linecap=\"round\"/><path d=\"M-10 -58 q-2 8 2 13\" fill=\"none\" stroke=\"#1E1747\" stroke-width=\"5\" stroke-linecap=\"round\"/><path d=\"M4 -57 q-2 7 2 11\" fill=\"none\" stroke=\"#1E1747\" stroke-width=\"5\" stroke-linecap=\"round\"/>",
  nearBack: "<rect x=\"-30\" y=\"-34\" width=\"16\" height=\"34\" rx=\"8\" fill=\"#FF9A3D\"/><path d=\"M-29 -20 h6\" fill=\"none\" stroke=\"#1E1747\" stroke-width=\"4\" stroke-linecap=\"round\"/>",
  nearFront: "<rect x=\"12\" y=\"-34\" width=\"16\" height=\"34\" rx=\"8\" fill=\"#FF9A3D\"/>",
  head: "<g transform=\"translate(34 -66)\"><circle cx=\"-19\" cy=\"-24\" r=\"10\" fill=\"#FF9A3D\"/><circle cx=\"19\" cy=\"-24\" r=\"10\" fill=\"#FF9A3D\"/><circle cx=\"-19\" cy=\"-25\" r=\"5\" fill=\"#FFE9C9\"/><circle cx=\"19\" cy=\"-25\" r=\"5\" fill=\"#FFE9C9\"/><ellipse rx=\"31\" ry=\"27\" fill=\"#FF9A3D\"/><path d=\"M-7 -24 l2 7\" fill=\"none\" stroke=\"#1E1747\" stroke-width=\"3.5\" stroke-linecap=\"round\"/><path d=\"M0 -26 v8\" fill=\"none\" stroke=\"#1E1747\" stroke-width=\"3.5\" stroke-linecap=\"round\"/><path d=\"M7 -24 l-2 7\" fill=\"none\" stroke=\"#1E1747\" stroke-width=\"3.5\" stroke-linecap=\"round\"/><path d=\"M-30 -3 h7\" fill=\"none\" stroke=\"#1E1747\" stroke-width=\"3.5\" stroke-linecap=\"round\"/><path d=\"M-29 6 h6\" fill=\"none\" stroke=\"#1E1747\" stroke-width=\"3.5\" stroke-linecap=\"round\"/><path d=\"M30 -3 h-7\" fill=\"none\" stroke=\"#1E1747\" stroke-width=\"3.5\" stroke-linecap=\"round\"/><path d=\"M29 6 h-6\" fill=\"none\" stroke=\"#1E1747\" stroke-width=\"3.5\" stroke-linecap=\"round\"/><ellipse cx=\"-22\" cy=\"9\" rx=\"5\" ry=\"3\" fill=\"#FF8FBF\"/><ellipse cx=\"22\" cy=\"9\" rx=\"5\" ry=\"3\" fill=\"#FF8FBF\"/><ellipse cx=\"-7\" cy=\"10\" rx=\"10\" ry=\"7.5\" fill=\"#FFE9C9\"/><ellipse cx=\"7\" cy=\"10\" rx=\"10\" ry=\"7.5\" fill=\"#FFE9C9\"/><path d=\"M-4.5 4.5 h9 l-4.5 4.5 z\" fill=\"#1E1747\" stroke=\"#1E1747\" stroke-width=\"2\" stroke-linejoin=\"round\"/><path d=\"M-6 13.5 q3 3.5 6 0 q3 3.5 6 0\" fill=\"none\" stroke=\"#1E1747\" stroke-width=\"2.6\" stroke-linecap=\"round\"/></g>",
};

/** The four faces, each drawn at the neck like the head. */
export const TIGER_FACE_ART: Readonly<Record<TigerFace, string>> = {
  open: "<g transform=\"translate(34 -66)\"><ellipse cx=\"-12\" cy=\"-5\" rx=\"4.8\" ry=\"5.8\" fill=\"#1E1747\"/><circle cx=\"-10.5\" cy=\"-7.2\" r=\"1.8\" fill=\"#fff\"/><ellipse cx=\"12\" cy=\"-5\" rx=\"4.8\" ry=\"5.8\" fill=\"#1E1747\"/><circle cx=\"13.5\" cy=\"-7.2\" r=\"1.8\" fill=\"#fff\"/></g>",
  happy: "<g transform=\"translate(34 -66)\"><path d=\"M-17 -3 q5 -7 10 0\" fill=\"none\" stroke=\"#1E1747\" stroke-width=\"3.4\" stroke-linecap=\"round\"/><path d=\"M7 -3 q5 -7 10 0\" fill=\"none\" stroke=\"#1E1747\" stroke-width=\"3.4\" stroke-linecap=\"round\"/></g>",
  focus: "<g transform=\"translate(34 -66)\"><ellipse cx=\"-12\" cy=\"-4\" rx=\"5\" ry=\"3.4\" fill=\"#1E1747\"/><circle cx=\"-10.5\" cy=\"-5\" r=\"1.3\" fill=\"#fff\"/><ellipse cx=\"12\" cy=\"-4\" rx=\"5\" ry=\"3.4\" fill=\"#1E1747\"/><circle cx=\"13.5\" cy=\"-5\" r=\"1.3\" fill=\"#fff\"/></g>",
  wow: "<g transform=\"translate(34 -66)\"><circle cx=\"-12\" cy=\"-5\" r=\"6.4\" fill=\"#1E1747\"/><circle cx=\"-10\" cy=\"-7.5\" r=\"2.4\" fill=\"#fff\"/><circle cx=\"12\" cy=\"-5\" r=\"6.4\" fill=\"#1E1747\"/><circle cx=\"14\" cy=\"-7.5\" r=\"2.4\" fill=\"#fff\"/></g>",
};

/** A five-point star and a heart, one unit across, for the energy ball's stars and hearts. */
export const STAR_PATH = "M0.000 -1.000 L0.282 -0.388 L0.951 -0.309 L0.457 0.148 L0.588 0.809 L0.000 0.480 L-0.588 0.809 L-0.457 0.148 L-0.951 -0.309 L-0.282 -0.388 Z";
export const HEART_PATH = "M0 0.55 C-0.95 -0.08 -0.7 -0.95 0 -0.4 C0.7 -0.95 0.95 -0.08 0 0.55 Z";
