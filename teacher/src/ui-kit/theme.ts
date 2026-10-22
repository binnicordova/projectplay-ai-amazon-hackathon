/** Shared visual language with the TV app: deep-space navy, bright team colours. */
export const colors = {
  background: '#0B1026',
  surface: '#151C3F',
  surfaceRaised: '#1E2756',
  border: '#2C3870',
  text: '#F4F6FF',
  textMuted: '#A9B3E0',
  textFaint: '#6F7AB3',
  primary: '#FFB547',
  onPrimary: '#2A1A00',
  teamA: '#3DD9C1',
  teamB: '#FF7AA8',
  success: '#5BE38A',
  warning: '#FFD25E',
  danger: '#FF6B6B',
  overlay: 'rgba(11, 16, 38, 0.72)',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 18, pill: 999 } as const;

export const type = {
  title: { fontSize: 26, fontWeight: '800' as const, color: colors.text },
  heading: { fontSize: 18, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 15, fontWeight: '500' as const, color: colors.text },
  caption: { fontSize: 13, fontWeight: '500' as const, color: colors.textMuted },
  label: { fontSize: 12, fontWeight: '700' as const, color: colors.textFaint, letterSpacing: 0.8, textTransform: 'uppercase' as const },
} as const;
