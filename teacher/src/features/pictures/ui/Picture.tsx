import { useAtomValue } from 'jotai';
import { memo } from 'react';
import { Text } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { iconArtAtom } from '../application/pictures';

/** "1f438" → 🐸: what to show if an icon has no bundled art (a lesson from a newer app). */
function emojiOf(icon: string): string {
  try {
    return String.fromCodePoint(...icon.split('-').map((hex) => parseInt(hex, 16)));
  } catch {
    return '?';
  }
}

export const Picture = memo(function Picture({ icon, size }: { readonly icon: string; readonly size: number }) {
  const svg = useAtomValue(iconArtAtom)[icon];
  if (!svg) return <Text style={{ fontSize: size * 0.8, lineHeight: size }}>{emojiOf(icon)}</Text>;
  return <SvgXml xml={svg} width={size} height={size} />;
});
