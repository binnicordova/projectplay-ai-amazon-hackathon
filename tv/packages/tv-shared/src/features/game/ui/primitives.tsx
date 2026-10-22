import type { ReactNode } from 'react';
import { StyleSheet, Text, View, useWindowDimensions, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { scaledPixels } from '../../../hooks/useScale';
import { colors } from '../../../theme/colors';
import type { NormalizedRect } from '../../interaction/domain/dwell';

/** Converts a projection-space rectangle into absolute pixel styles for the current screen. */
export function useRectStyle() {
  const { width, height } = useWindowDimensions();
  return (rect: NormalizedRect): ViewStyle => ({
    position: 'absolute',
    left: rect.x * width,
    top: rect.y * height,
    width: rect.width * width,
    height: rect.height * height,
  });
}

/** Deterministic star field: decoration that costs nothing per frame. */
const STARS = Array.from({ length: 70 }, (_, i) => {
  const r = (n: number) => {
    const x = Math.sin((i + 1) * n) * 10000;
    return x - Math.floor(x);
  };
  return { x: r(12.9898), y: r(78.233), size: 2 + Math.round(r(37.719) * 3), opacity: 0.25 + r(93.989) * 0.6 };
});

export function SpaceBackground({ children }: { readonly children?: ReactNode }) {
  return (
    <View style={styles.background}>
      {STARS.map((s, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: `${s.x * 100}%`,
            top: `${s.y * 100}%`,
            width: s.size,
            height: s.size,
            borderRadius: s.size,
            backgroundColor: '#FFFFFF',
            opacity: s.opacity,
          }}
        />
      ))}
      {children}
    </View>
  );
}

export function Heading({ children, style }: { readonly children: ReactNode; readonly style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.heading, style]}>{children}</Text>;
}

export function Body({ children, style }: { readonly children: ReactNode; readonly style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.body, style]}>{children}</Text>;
}

export function Panel({ children, style }: { readonly children: ReactNode; readonly style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: colors.background, overflow: 'hidden' },
  heading: { color: colors.text, fontSize: scaledPixels(72), fontWeight: '900', letterSpacing: -1 },
  body: { color: colors.textSecondary, fontSize: scaledPixels(30), fontWeight: '600', lineHeight: scaledPixels(42) },
  panel: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: scaledPixels(2),
    borderRadius: scaledPixels(28),
    padding: scaledPixels(40),
    gap: scaledPixels(20),
  },
});
