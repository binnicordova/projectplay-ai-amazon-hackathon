import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, space, type } from './theme';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
}: {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: ButtonVariant;
  readonly disabled?: boolean;
  readonly style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, buttonVariants[variant], pressed && styles.pressed, disabled && styles.disabled, style]}
    >
      <Text style={[styles.buttonLabel, variant === 'primary' && { color: colors.onPrimary }]}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { readonly children: ReactNode; readonly style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionLabel({ children }: { readonly children: string }) {
  return <Text style={type.label}>{children}</Text>;
}

export function StatusDot({ tone, label }: { readonly tone: 'ok' | 'wait' | 'bad'; readonly label: string }) {
  const color = tone === 'ok' ? colors.success : tone === 'wait' ? colors.warning : colors.danger;
  return (
    <View style={styles.status}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={type.body}>{label}</Text>
    </View>
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  labelFor,
}: {
  readonly options: readonly T[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly labelFor: (value: T) => string;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={String(option)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option)}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            <Text style={[type.caption, selected && styles.segmentLabelSelected]}>{labelFor(option)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const buttonVariants: Record<ButtonVariant, ViewStyle> = {
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderWidth: 1 },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: 'transparent', borderColor: colors.danger, borderWidth: 1 },
};

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    paddingHorizontal: space.xl,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: { ...type.heading, fontSize: 16 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.4 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderColor: colors.border,
    borderWidth: 1,
    padding: space.lg,
    gap: space.md,
  },
  status: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  segmented: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: space.xs,
  },
  segment: { paddingVertical: space.sm, paddingHorizontal: space.md, borderRadius: radius.sm },
  segmentSelected: { backgroundColor: colors.surfaceRaised },
  segmentLabelSelected: { color: colors.text },
});
