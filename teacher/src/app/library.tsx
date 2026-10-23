import { router } from 'expo-router';
import { useAtom, useAtomValue } from 'jotai';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { bandFilterAtom, lessonsAtom, recordsAtom, subjectFilterAtom } from '../features/library/application/library';
import { lessonsIn, recordOf } from '../features/library/domain/catalog';
import { BandFilter, LessonCard, SubjectTiles } from '../features/library/ui/LibraryViews';
import { Button } from '../ui-kit/components';
import { colors, space, type } from '../ui-kit/theme';

export default function LibraryScreen() {
  const lessons = useAtomValue(lessonsAtom);
  const records = useAtomValue(recordsAtom);
  const [subject, setSubject] = useAtom(subjectFilterAtom);
  const [band, setBand] = useAtom(bandFilterAtom);
  const shown = lessonsIn(lessons, subject, band);
  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <View style={styles.header}>
        <Text style={type.title}>Biblioteca</Text>
        <View style={styles.spacer} />
        <Button label="Crear con IA" onPress={() => router.push('/create')} />
        <Button label="Volver" variant="secondary" onPress={() => router.back()} />
      </View>
      <SubjectTiles lessons={lessons} selected={subject} onSelect={setSubject} />
      <BandFilter value={band} onChange={setBand} />
      <FlatList
        data={shown}
        keyExtractor={(lesson) => lesson.id}
        numColumns={2}
        columnWrapperStyle={styles.columns}
        contentContainerStyle={styles.grid}
        ListEmptyComponent={<Text style={type.caption}>No hay lecciones con ese filtro. Crea una con IA.</Text>}
        renderItem={({ item }) => (
          <View style={styles.cell}>
            <LessonCard lesson={item} record={recordOf(records, item.id, 2) ?? recordOf(records, item.id, 1)} onPress={() => router.push({ pathname: '/lesson/[id]', params: { id: item.id } })} />
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: space.lg, gap: space.md, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  spacer: { flex: 1 },
  grid: { gap: space.md, paddingBottom: space.xxl },
  columns: { gap: space.md },
  cell: { flex: 1 },
});
