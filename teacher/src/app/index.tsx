import { router } from 'expo-router';
import { useAtomValue } from 'jotai';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { lessonsAtom, selectedLessonAtom } from '../features/library/application/library';
import { ConnectionPanel } from '../features/link/ui/ConnectionPanel';
import { homographyAtom } from '../features/perception/application/calibration';
import { Picture } from '../features/pictures/ui/Picture';
import { Button, Card, SectionLabel, StatusDot } from '../ui-kit/components';
import { space, type } from '../ui-kit/theme';

export default function HomeScreen() {
  const calibrated = useAtomValue(homographyAtom) !== null;
  const lessons = useAtomValue(lessonsAtom);
  const selected = useAtomValue(selectedLessonAtom);
  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      {/* Each column scrolls on its own: in landscape the cards are taller than a phone screen. */}
      <ScrollView style={styles.column} contentContainerStyle={styles.columnContent}>
        <Text style={type.title}>Mimikai</Text>
        <Text style={type.caption}>
          El proyector se convierte en una pared táctil: los niños responden señalando. La cámara trabaja en este celular y no envía imágenes a ningún lado.
        </Text>
        <ConnectionPanel />
        <Card>
          <SectionLabel>Lecciones</SectionLabel>
          <Text style={type.caption}>
            {lessons.length} lecciones listas{selected ? ` · elegida: ${selected.title}` : ''}. Crea más chateando con la IA (necesita internet; jugar no).
          </Text>
          <View style={styles.row}>
            <Button label="Biblioteca" variant="secondary" onPress={() => router.push('/library')} />
            <View style={styles.aiButton}>
              <Picture icon="2728" size={20} />
              <Button label="Crear con IA" onPress={() => router.push('/create')} />
            </View>
          </View>
        </Card>
      </ScrollView>
      <ScrollView style={styles.column} contentContainerStyle={styles.columnContent}>
        <Card>
          <SectionLabel>1 · Cámara</SectionLabel>
          <Text style={type.caption}>
            Pon el celular en un trípode detrás de los niños, mirando la imagen proyectada. Se calibra solo: la TV muestra cuatro cuadros blancos por un momento.
          </Text>
          <StatusDot tone={calibrated ? 'ok' : 'wait'} label={calibrated ? 'Proyección calibrada' : 'Se calibra al empezar la clase'} />
          <Button label="Revisar la cámara" variant="secondary" onPress={() => router.push('/calibrate')} />
        </Card>
        <Card>
          <SectionLabel>2 · Clase</SectionLabel>
          <Button label="Empezar clase" onPress={() => router.push('/class')} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, flexDirection: 'row', gap: space.xl, paddingHorizontal: space.xl },
  column: { flex: 1 },
  columnContent: { gap: space.lg, paddingVertical: space.xl },
  row: { flexDirection: 'row', gap: space.md, flexWrap: 'wrap', alignItems: 'center' },
  aiButton: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
