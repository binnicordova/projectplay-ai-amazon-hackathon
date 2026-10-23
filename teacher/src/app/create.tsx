import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import { useServices } from '../composition/ServicesProvider';
import { LessonChatView } from '../features/authoring/ui/LessonChatView';
import { colors } from '../ui-kit/theme';

export default function CreateScreen() {
  const { chat, library } = useServices();
  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <LessonChatView
        actions={{
          send: (text) => void chat.send(text),
          reset: chat.reset,
          save: (lesson) => {
            void library.save(lesson).then((saved) => saved.ok && router.push({ pathname: '/lesson/[id]', params: { id: lesson.id } }));
          },
          saveAndPlay: (lesson) => {
            void library.save(lesson).then((saved) => {
              if (!saved.ok) return;
              library.choose(lesson.id);
              router.push('/class');
            });
          },
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.background } });
