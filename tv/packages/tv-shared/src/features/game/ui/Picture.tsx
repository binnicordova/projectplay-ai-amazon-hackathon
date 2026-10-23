/**
 * A lesson picture: Twemoji SVG markup the phone sent with the lesson (kept in memory only),
 * drawn crisp at any size on the projected wall.
 */
import { memo } from 'react';
import { SvgXml } from 'react-native-svg';
import { Text } from 'react-native';

export const Picture = memo(function Picture({ svg, icon, size }: { readonly svg: string | undefined; readonly icon: string; readonly size: number }) {
  if (!svg) return <Text style={{ fontSize: size * 0.8, lineHeight: size }}>{emojiOf(icon)}</Text>;
  return <SvgXml xml={svg} width={size} height={size} />;
});

/** The emoji character for a Twemoji code point id ("1f438" → 🐸), if the art is missing. */
export function emojiOf(icon: string): string {
  try {
    return String.fromCodePoint(...icon.split('-').map((hex) => parseInt(hex, 16)));
  } catch {
    return '?';
  }
}
