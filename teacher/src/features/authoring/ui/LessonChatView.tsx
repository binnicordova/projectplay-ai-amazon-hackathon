/**
 * Chat with the AI to create a lesson: the conversation on the left, the latest draft on the
 * right with every card visible, and Save / Play once the teacher is happy with it.
 */
import type { Lesson } from '@mimikai/contracts';
import { useAtomValue } from 'jotai';
import { useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../../../ui-kit/components';
import { colors, radius, space, type } from '../../../ui-kit/theme';
import { SUBJECT_INFO, audienceLabel } from '../../library/domain/catalog';
import { LessonPreview } from '../../library/ui/LessonPreview';
import { Picture } from '../../pictures/ui/Picture';
import { chatStatusAtom, chatTurnsAtom, draftLessonAtom } from '../application/lessonChat';
import { EXAMPLE_REQUESTS, type ChatTurn } from '../domain/prompt';

const AI_ICON = '2728';

export interface LessonChatActions {
  readonly send: (text: string) => void;
  readonly reset: () => void;
  readonly save: (lesson: Lesson) => void;
  readonly saveAndPlay: (lesson: Lesson) => void;
}

export function LessonChatView({ actions }: { readonly actions: LessonChatActions }) {
  const turns = useAtomValue(chatTurnsAtom);
  const status = useAtomValue(chatStatusAtom);
  const draft = useAtomValue(draftLessonAtom);
  const [text, setText] = useState('');
  const list = useRef<FlatList<ChatTurn>>(null);
  const thinking = status.state === 'thinking';

  const submit = (value: string) => {
    if (!value.trim() || thinking) return;
    actions.send(value);
    setText('');
  };

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView style={styles.chat} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.titleRow}>
          <Picture icon={AI_ICON} size={28} />
          <Text style={type.title}>Crear con IA</Text>
          <View style={styles.spacer} />
          {turns.length > 0 ? <Button label="Nueva" variant="ghost" onPress={actions.reset} /> : null}
        </View>
        <FlatList
          ref={list}
          data={turns}
          keyExtractor={(_, i) => String(i)}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
          contentContainerStyle={styles.messages}
          ListEmptyComponent={<Examples onPick={submit} />}
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.role === 'teacher' ? styles.teacher : styles.assistant]}>
              <Text style={item.role === 'teacher' ? styles.teacherText : type.body}>{item.text}</Text>
            </View>
          )}
          ListFooterComponent={
            <>
              {thinking ? (
                <View style={[styles.bubble, styles.assistant, styles.row]}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={type.caption}>Preparando los ejercicios…</Text>
                </View>
              ) : null}
              {status.state === 'error' ? (
                <View style={[styles.bubble, styles.error]}>
                  <Text style={type.body}>{status.error.message}</Text>
                </View>
              ) : null}
            </>
          }
        />
        <View style={styles.inputRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Ej.: créame 8 ejercicios de la tabla del 7 para niños de 8 años"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            multiline
            editable={!thinking}
            onSubmitEditing={() => submit(text)}
            submitBehavior="submit"
            returnKeyType="send"
          />
          <Button label="Enviar" disabled={thinking || !text.trim()} onPress={() => submit(text)} />
        </View>
      </KeyboardAvoidingView>
      <View style={styles.draft}>
        {draft ? (
          <LessonPreview
            lesson={draft}
            header={
              <View style={styles.draftHeader}>
                <Text style={type.label}>Borrador</Text>
                <Text style={type.title}>{draft.title}</Text>
                <Text style={type.caption}>
                  {SUBJECT_INFO[draft.subject].label} · {audienceLabel(draft)} · {draft.cards.length} ejercicios
                </Text>
                <Text style={type.caption}>Revisa las tarjetas: las respuestas correctas están en verde.</Text>
                <View style={styles.row}>
                  <Button label="Guardar" variant="secondary" onPress={() => actions.save(draft)} />
                  <Button label="Guardar y jugar" onPress={() => actions.saveAndPlay(draft)} />
                </View>
              </View>
            }
          />
        ) : (
          <View style={styles.empty}>
            <Text style={type.heading}>Aquí verás tu lección</Text>
            <Text style={type.caption}>
              Escribe lo que necesitas: el tema, cuántos ejercicios y la edad. Puedes pedir cambios después («más fácil», «agrega 3», «para 5 años»).
              Necesita internet; jugar en clase no.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function Examples({ onPick }: { readonly onPick: (text: string) => void }) {
  return (
    <ScrollView contentContainerStyle={styles.examples}>
      <Text style={type.caption}>Ideas para empezar:</Text>
      {EXAMPLE_REQUESTS.map((example) => (
        <Pressable key={example} accessibilityRole="button" onPress={() => onPick(example)} style={({ pressed }) => [styles.example, pressed && styles.pressed]}>
          <Text style={type.body}>{example}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, flexDirection: 'row', gap: space.lg, padding: space.lg, backgroundColor: colors.background },
  chat: { flex: 1, gap: space.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  spacer: { flex: 1 },
  messages: { gap: space.sm, paddingBottom: space.md },
  bubble: { maxWidth: '88%', borderRadius: radius.lg, padding: space.md },
  teacher: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  teacherText: { color: colors.onPrimary, fontSize: 15, fontWeight: '600' },
  assistant: { alignSelf: 'flex-start', backgroundColor: colors.surfaceRaised },
  error: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderColor: colors.danger, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    color: colors.text,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    fontSize: 15,
  },
  draft: { flex: 1 },
  draftHeader: { gap: space.sm, marginBottom: space.md },
  empty: { flex: 1, justifyContent: 'center', gap: space.sm, padding: space.xl, backgroundColor: colors.surface, borderRadius: radius.lg },
  examples: { gap: space.sm },
  example: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, padding: space.md },
  pressed: { opacity: 0.8 },
});
