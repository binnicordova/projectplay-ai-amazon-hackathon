import { router, useLocalSearchParams } from 'expo-router';
import { useAtomValue } from 'jotai';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useServices } from '../../composition/ServicesProvider';
import { lessonsAtom } from '../../features/library/application/library';
import { SUBJECT_INFO, audienceLabel, levelCounts } from '../../features/library/domain/catalog';
import { LessonPreview } from '../../features/library/ui/LessonPreview';
import { Button } from '../../ui-kit/components';
import { colors, space, type } from '../../ui-kit/theme';

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const lesson = useAtomValue(lessonsAtom).find((l) => l.id === id);
  const { library } = useServices();
  if (!lesson) {
    return (
      <SafeAreaView style={styles.screen}>
        <Text style={type.body}>Esta lección ya no existe.</Text>
        <Button label="Volver" variant="secondary" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }
  const levels = levelCounts(lesson);
  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <LessonPreview
        lesson={lesson}
        header={
          <View style={styles.header}>
            <Text style={type.label}>
              {SUBJECT_INFO[lesson.subject].label} · {audienceLabel(lesson)}
              {lesson.source === 'ai' ? ' · creada con IA' : ''}
            </Text>
            <Text style={type.title}>{lesson.title}</Text>
            {lesson.request ? <Text style={type.caption}>Pedido: «{lesson.request}»</Text> : null}
            <Text style={type.caption}>
              {lesson.cards.length} ejercicios: {levels[1]} fáciles, {levels[2]} medios, {levels[3]} difíciles. En clase la TV sube de nivel cuando aciertan seguido.
            </Text>
            <View style={styles.actions}>
              <Button
                label="Usar en clase"
                onPress={() => {
                  library.choose(lesson.id);
                  router.push('/class');
                }}
              />
              {lesson.source === 'ai' ? (
                <Button
                  label="Borrar"
                  variant="danger"
                  onPress={() => {
                    void library.remove(lesson.id).then(() => router.back());
                  }}
                />
              ) : null}
              <Button label="Volver" variant="secondary" onPress={() => router.back()} />
            </View>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: space.lg, backgroundColor: colors.background },
  header: { gap: space.sm, marginBottom: space.md },
  actions: { flexDirection: 'row', gap: space.md, flexWrap: 'wrap' },
});
