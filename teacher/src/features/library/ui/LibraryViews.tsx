/** Library gallery: big subject tiles, an age filter, and one card per lesson. */
import { AGE_BANDS, SUBJECTS, type AgeBand, type Lesson, type Subject } from '@mimikai/contracts';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Segmented } from '../../../ui-kit/components';
import { colors, radius, space, type } from '../../../ui-kit/theme';
import { Picture } from '../../pictures/ui/Picture';
import { BAND_LABELS, SUBJECT_INFO, audienceLabel, countBySubject, coverIcon } from '../domain/catalog';

export function SubjectTiles({
  lessons,
  selected,
  onSelect,
}: {
  readonly lessons: readonly Lesson[];
  readonly selected: Subject | null;
  readonly onSelect: (subject: Subject | null) => void;
}) {
  const counts = countBySubject(lessons);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tiles}>
      {SUBJECTS.map((subject) => {
        const info = SUBJECT_INFO[subject];
        const active = selected === subject;
        return (
          <Pressable
            key={subject}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(active ? null : subject)}
            style={[styles.tile, { backgroundColor: info.color }, selected !== null && !active && styles.dim]}
          >
            <Picture icon={info.icon} size={48} />
            <Text style={styles.tileTitle} numberOfLines={2}>
              {info.label}
            </Text>
            <Text style={styles.tileCount}>{counts[subject]} lecciones</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

type BandChoice = AgeBand | 'todas';
const BAND_CHOICES: readonly BandChoice[] = ['todas', ...AGE_BANDS];

export function BandFilter({ value, onChange }: { readonly value: AgeBand | null; readonly onChange: (band: AgeBand | null) => void }) {
  return (
    <Segmented<BandChoice>
      options={BAND_CHOICES}
      value={value ?? 'todas'}
      onChange={(v) => onChange(v === 'todas' ? null : v)}
      labelFor={(v) => (v === 'todas' ? 'Todas' : BAND_LABELS[v])}
    />
  );
}

export function LessonCard({ lesson, record, onPress }: { readonly lesson: Lesson; readonly record?: number; readonly onPress: () => void }) {
  const info = SUBJECT_INFO[lesson.subject];
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={[styles.cover, { backgroundColor: info.color }]}>
        <Picture icon={coverIcon(lesson)} size={56} />
        {lesson.source === 'ai' ? <Text style={styles.badge}>IA</Text> : null}
      </View>
      <View style={styles.cardBody}>
        <Text style={type.heading} numberOfLines={2}>
          {lesson.title}
        </Text>
        <Text style={type.caption} numberOfLines={1}>
          {info.label} · {audienceLabel(lesson)}
        </Text>
        <Text style={type.caption}>
          {lesson.cards.length} ejercicios{record ? ` · récord ${record}` : ''}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tiles: { gap: space.md, paddingVertical: space.xs },
  tile: { width: 150, height: 120, borderRadius: radius.lg, padding: space.md, justifyContent: 'space-between' },
  dim: { opacity: 0.45 },
  tileTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  tileCount: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
  card: { flexDirection: 'row', gap: space.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.sm, borderWidth: 1, borderColor: colors.border },
  pressed: { opacity: 0.8 },
  cover: { width: 84, height: 84, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 4, right: 4, backgroundColor: colors.background, color: colors.primary, fontSize: 11, fontWeight: '900', paddingHorizontal: 6, borderRadius: radius.pill, overflow: 'hidden' },
  cardBody: { flex: 1, gap: 2, justifyContent: 'center' },
});
