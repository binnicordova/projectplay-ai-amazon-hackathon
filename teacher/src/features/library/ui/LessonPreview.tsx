/** Every card of a lesson as the teacher will see it played: question, tiles, the right one marked. */
import type { Card, Lesson, Visual } from '@mimikai/contracts';
import type { ReactElement } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space, type } from '../../../ui-kit/theme';
import { Picture } from '../../pictures/ui/Picture';

const LEVEL_LABEL = { 1: 'Fácil', 2: 'Medio', 3: 'Difícil' } as const;

function VisualChip({ visual, correct = false }: { readonly visual: Visual; readonly correct?: boolean }) {
  return (
    <View style={[styles.chip, correct && styles.chipCorrect]}>
      {visual.kind === 'text' ? <Text style={[type.body, correct && styles.correctText]}>{visual.text}</Text> : null}
      {visual.kind === 'icon' ? <Picture icon={visual.icon} size={34} /> : null}
      {visual.kind === 'group' ? (
        <View style={styles.group}>
          <Text style={[type.body, correct && styles.correctText]}>{visual.count} ×</Text>
          <Picture icon={visual.icon} size={26} />
        </View>
      ) : null}
    </View>
  );
}

function CardRow({ card, index }: { readonly card: Card; readonly index: number }) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={type.label}>
          {index + 1} · {LEVEL_LABEL[card.level]}
        </Text>
      </View>
      <View style={styles.prompt}>
        {card.prompt.visual ? <VisualChip visual={card.prompt.visual} /> : null}
        <Text style={[type.heading, styles.promptText]}>{card.prompt.text}</Text>
      </View>
      <View style={styles.options}>
        {card.kind === 'choice'
          ? card.options.map((option, i) => <VisualChip key={i} visual={option} correct={i === card.answer} />)
          : [true, false].map((v) => <VisualChip key={String(v)} visual={{ kind: 'text', text: v ? 'VERDADERO' : 'FALSO' }} correct={card.answer === v} />)}
      </View>
      {card.prompt.say ? <Text style={styles.say}>Diga: {card.prompt.say}</Text> : null}
      {card.explain ? <Text style={type.caption}>{card.explain}</Text> : null}
    </View>
  );
}

export function LessonPreview({ lesson, header }: { readonly lesson: Lesson; readonly header?: ReactElement }) {
  return (
    <FlatList
      data={lesson.cards}
      keyExtractor={(card) => card.id}
      renderItem={({ item, index }) => <CardRow card={item} index={index} />}
      ListHeaderComponent={header}
      contentContainerStyle={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md, paddingBottom: space.xxl },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, gap: space.sm, borderWidth: 1, borderColor: colors.border },
  header: { flexDirection: 'row', justifyContent: 'space-between' },
  prompt: { flexDirection: 'row', alignItems: 'center', gap: space.md, flexWrap: 'wrap' },
  promptText: { flexShrink: 1 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { minHeight: 44, minWidth: 44, paddingHorizontal: space.md, borderRadius: radius.md, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  chipCorrect: { backgroundColor: colors.success },
  correctText: { color: colors.background, fontWeight: '800' },
  group: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  say: { color: colors.primary, fontSize: 14, fontWeight: '700' },
});
