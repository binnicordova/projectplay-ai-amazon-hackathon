import type { Lesson } from '@mimikai/contracts';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import { useServices } from '../composition/ServicesProvider';
import { LessonChatView } from '../features/authoring/ui/LessonChatView';
import { colors } from '../ui-kit/theme';

export default function CreateScreen() {
  const { chat, library, mimi } = useServices();
  // Each lesson saved from the chat is one more lesson created with Mimi.
  const keep = (lesson: Lesson) =>
    library.save(lesson).then((saved) => {
      if (saved.ok) mimi.lessonCreated();
      return saved;
    });
  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <LessonChatView
        actions={{
          send: (text) => void chat.send(text),
          reset: chat.reset,
          save: (lesson) => {
            void keep(lesson).then((saved) => saved.ok && router.push({ pathname: '/lesson/[id]', params: { id: lesson.id } }));
          },
          saveAndPlay: (lesson) => {
            void keep(lesson).then((saved) => {
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
