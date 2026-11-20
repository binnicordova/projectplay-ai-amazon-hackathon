import { router } from 'expo-router';
import { useAtomValue } from 'jotai';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { lessonsAtom, selectedLessonAtom } from '../features/library/application/library';
import { tvConnectedAtom } from '../features/link/application/linkService';
import { ConnectionPanel } from '../features/link/ui/ConnectionPanel';
import { MimiHero } from '../features/mimi/ui/MimiHero';
import { homographyAtom } from '../features/perception/application/calibration';
import { Picture } from '../features/pictures/ui/Picture';
import { Button, Card, SectionLabel, StatusDot } from '../ui-kit/components';
import { space, type } from '../ui-kit/theme';

/** Home: Mimi first (the class pet and the teacher's journey with it), then what to do next. */
export default function HomeScreen() {
  const calibrated = useAtomValue(homographyAtom) !== null;
  const tvConnected = useAtomValue(tvConnectedAtom);
  const lessons = useAtomValue(lessonsAtom);
  const selected = useAtomValue(selectedLessonAtom);
  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      {/* Each column scrolls on its own: in landscape the cards are taller than a phone screen. */}
      <ScrollView style={styles.column} contentContainerStyle={styles.columnContent}>
        <MimiHero />
      </ScrollView>
      <ScrollView style={styles.column} contentContainerStyle={styles.columnContent}>
        <Card>
          <SectionLabel>Clase</SectionLabel>
          <Text style={type.caption}>{selected ? `Lección elegida: ${selected.title}` : 'Elige una lección en la biblioteca.'}</Text>
          <Button label="Empezar clase" onPress={() => router.push('/class')} />
          <StatusDot tone={tvConnected ? 'ok' : 'wait'} label={tvConnected ? 'TV conectada' : 'Esperando a la TV'} />
          <StatusDot tone={calibrated ? 'ok' : 'wait'} label={calibrated ? 'Proyección calibrada' : 'Se calibra al empezar la clase'} />
        </Card>
        <Card>
          <View style={styles.titleRow}>
            <Picture icon="2728" size={22} />
            <SectionLabel>Crea con Mimi</SectionLabel>
          </View>
          <Text style={type.caption}>
            Pídele a Mimi una lección: el tema, cuántos ejercicios y la edad. Necesita internet; jugar en clase no. Ya tienes {lessons.length} lecciones.
          </Text>
          <View style={styles.row}>
            <Button label="Crea con Mimi" onPress={() => router.push('/create')} />
            <Button label="Biblioteca" variant="secondary" onPress={() => router.push('/library')} />
          </View>
        </Card>
        <ConnectionPanel />
        <Card>
          <SectionLabel>Cámara</SectionLabel>
          <Text style={type.caption}>
            Pon el celular en un trípode detrás de los niños, mirando la imagen proyectada. Se calibra solo: la TV muestra cuatro cuadros blancos por un momento. La
            cámara trabaja en este celular y no envía imágenes a ningún lado.
          </Text>
          <Button label="Revisar la cámara" variant="secondary" onPress={() => router.push('/calibrate')} />
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
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
