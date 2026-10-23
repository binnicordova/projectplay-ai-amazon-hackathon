/**
 * Draws a lesson visual inside a box of a given size: words, one picture, or a group of
 * pictures to count (laid out in even rows so children can count them one by one).
 */
import type { IconArt, Visual } from '@projectplay/contracts';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';
import { colors } from '../../../theme/colors';
import { Picture } from './Picture';

/** Rows and columns for a group of n pictures that fill a box of this aspect ratio. */
export function groupGrid(n: number, aspect: number): { readonly columns: number; readonly rows: number } {
  let best = { columns: n, rows: 1, size: 0 };
  for (let columns = 1; columns <= n; columns++) {
    const rows = Math.ceil(n / columns);
    const size = Math.min(aspect / columns, 1 / rows);
    if (size > best.size) best = { columns, rows, size };
  }
  return { columns: best.columns, rows: best.rows };
}

export function VisualView({
  visual,
  art,
  width,
  height,
  textStyle,
}: {
  readonly visual: Visual;
  readonly art: IconArt;
  readonly width: number;
  readonly height: number;
  readonly textStyle?: TextStyle;
}) {
  switch (visual.kind) {
    case 'text': {
      // Long words shrink: "despacio" must fit a narrow tile on one or two lines.
      const size = Math.min(height * 0.55, (width / Math.max(2, visual.text.length)) * 1.7);
      return (
        <Text style={[styles.text, { fontSize: size }, textStyle]} numberOfLines={2} adjustsFontSizeToFit>
          {visual.text}
        </Text>
      );
    }
    case 'icon': {
      const size = Math.min(width, height) * 0.82;
      return <Picture svg={art[visual.icon]} icon={visual.icon} size={size} />;
    }
    case 'group': {
      const { columns, rows } = groupGrid(visual.count, width / height);
      const size = Math.min(width / columns, height / rows) * 0.86;
      return (
        <View style={[styles.group, { width: columns * size * 1.08 }]}>
          {Array.from({ length: visual.count }, (_, i) => (
            <View key={i} style={{ width: size * 1.08, height: size * 1.04, alignItems: 'center', justifyContent: 'center' }}>
              <Picture svg={art[visual.icon]} icon={visual.icon} size={size} />
            </View>
          ))}
        </View>
      );
    }
  }
}

const styles = StyleSheet.create({
  text: { color: colors.text, fontWeight: '900', textAlign: 'center' },
  group: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' },
});
