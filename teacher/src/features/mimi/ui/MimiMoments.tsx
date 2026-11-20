/**
 * Mimi's celebrations, full screen like Duo's: after a class, when Mimi learns to juggle another
 * ring, and for each achievement. One at a time, over whatever screen is open; the camera keeps
 * running underneath (this overlay has its own atom, so the camera screen never re-renders).
 */
import { useAtomValue } from 'jotai';
import { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View, useAnimatedValue, useWindowDimensions } from 'react-native';
import { Button } from '../../../ui-kit/components';
import { colors, space, type } from '../../../ui-kit/theme';
import { Picture } from '../../pictures/ui/Picture';
import { mimiMomentsAtom, mimiRingsAtom } from '../application/mimi';
import { momentView } from '../domain/voice';
import { MimiPet } from './MimiPet';

export function MimiMoments({ onDismiss }: { readonly onDismiss: () => void }) {
  const moments = useAtomValue(mimiMomentsAtom);
  const rings = useAtomValue(mimiRingsAtom);
  const { height } = useWindowDimensions();
  // Counts celebrations shown, so the same mood twice in a row still plays again.
  const [shown, setShown] = useState(0);
  const appear = useAnimatedValue(0);
  const moment = moments[0];

  useEffect(() => {
    if (!moment) return;
    appear.setValue(0);
    Animated.spring(appear, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }).start();
  }, [moment, appear]);

  if (!moment) return null;
  const view = momentView(moment, rings, shown);
  const dismiss = () => {
    setShown((n) => n + 1);
    onDismiss();
  };
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, { opacity: appear }]}>
      <Animated.View style={[styles.content, { transform: [{ scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }]}>
        <MimiPet cue={view.cue} rings={view.rings} size={Math.min(260, height * 0.56)} />
        <View style={styles.words}>
          {view.icon ? <Picture icon={view.icon} size={40} /> : null}
          <Text style={styles.title}>{view.title}</Text>
          <Text style={styles.detail}>{view.detail}</Text>
        </View>
        <Button label={moments.length > 1 ? 'Siguiente' : 'Continuar'} onPress={dismiss} style={styles.button} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: 'rgba(11, 16, 38, 0.96)', alignItems: 'center', justifyContent: 'center', zIndex: 100, elevation: 100 },
  content: { alignItems: 'center', gap: space.sm, paddingHorizontal: space.xl },
  words: { alignItems: 'center', gap: space.xs },
  title: { ...type.title, fontSize: 28, textAlign: 'center' },
  detail: { ...type.body, color: colors.primary, textAlign: 'center' },
  button: { minWidth: 220, marginTop: space.sm },
});
