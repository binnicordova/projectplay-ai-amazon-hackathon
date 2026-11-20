/**
 * Mimi on the phone: the same rig as on the wall (@mimikai/pet), juggling the rings the teacher
 * has earned. Everything moves on the native driver, so it costs the JS thread nothing.
 */
import { firstRings, type PetCue } from '@mimikai/pet';
import { Pet } from '@mimikai/pet/rig';
import { useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, space, type } from '../../../ui-kit/theme';

export function MimiPet({ cue, rings, size }: { readonly cue: PetCue; readonly rings: number; readonly size: number }) {
  const juggled = useMemo(() => firstRings(rings), [rings]);
  return <Pet cue={cue} rings={juggled} size={size} />;
}

/** What Mimi says, in a bubble pointing back at it (the tail is on the left). */
export function Bubble({ text, style }: { readonly text: string | null; readonly style?: StyleProp<ViewStyle> }) {
  if (!text) return null;
  return (
    <View style={[styles.bubble, style]}>
      <View style={styles.tail} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { backgroundColor: colors.text, borderRadius: radius.lg, paddingHorizontal: space.lg, paddingVertical: space.md, alignSelf: 'flex-start', maxWidth: '100%' },
  tail: { position: 'absolute', left: -6, top: 16, width: 14, height: 14, backgroundColor: colors.text, transform: [{ rotate: '45deg' }] },
  text: { ...type.heading, color: colors.background },
});
