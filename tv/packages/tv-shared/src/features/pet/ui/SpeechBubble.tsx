/**
 * What Mimikai says, in a bubble. It pops in each time the words change; children read the face
 * first, so the words are short and the bubble is simple.
 */
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { scaledPixels } from '../../../hooks/useScale';

const INK = '#1E1747';

export function SpeechBubble({ text, style }: { readonly text: string | null; readonly style?: StyleProp<ViewStyle> }) {
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    pop.setValue(0);
    if (text) Animated.timing(pop, { toValue: 1, duration: 260, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true }).start();
  }, [text, pop]);
  if (!text) return null;
  return (
    <View pointerEvents="none" style={[styles.anchor, style]}>
      <Animated.View style={[styles.bubble, { opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]}>
        <Text style={styles.text}>{text}</Text>
        <View style={styles.tail} />
      </Animated.View>
    </View>
  );
}

const TAIL = scaledPixels(16);

const styles = StyleSheet.create({
  anchor: { alignItems: 'center' },
  bubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: scaledPixels(32),
    paddingHorizontal: scaledPixels(32),
    paddingVertical: scaledPixels(14),
    maxWidth: scaledPixels(760),
    alignItems: 'center',
  },
  text: { color: INK, fontSize: scaledPixels(38), fontWeight: '900', textAlign: 'center' },
  // A square turned 45° under the bubble, half hidden: a tail without SVG.
  tail: { position: 'absolute', bottom: -TAIL / 2, width: TAIL, height: TAIL, backgroundColor: '#FFFFFF', transform: [{ rotate: '45deg' }] },
});
