/**
 * Vega OS: the same pictures as system emoji, with no SVG renderer. react-native-svg ships for
 * Vega as a separate port; text emoji avoid a native dependency on that platform.
 */
import { memo } from 'react';
import { Text } from 'react-native';

export const Picture = memo(function Picture({ icon, size }: { readonly svg: string | undefined; readonly icon: string; readonly size: number }) {
  return <Text style={{ fontSize: size * 0.8, lineHeight: size, textAlign: 'center' }}>{emojiOf(icon)}</Text>;
});

export function emojiOf(icon: string): string {
  try {
    return String.fromCodePoint(...icon.split('-').map((hex) => parseInt(hex, 16)));
  } catch {
    return '?';
  }
}
