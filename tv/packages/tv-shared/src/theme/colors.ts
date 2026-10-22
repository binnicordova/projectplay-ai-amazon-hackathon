/**
 * Deep-space classroom palette, tuned for projectors: very dark background (projects
 * as "no light"), saturated tiles and high-contrast text that survive a washed-out
 * daylight classroom. Team colours match the teacher app.
 */
export const colors = {
  // Brand
  primary: '#FFB547',
  secondary: '#8C7BFF',

  // Backgrounds
  background: '#0B1026',
  backgroundElevated: '#121A3D',
  card: '#1A2350',
  cardElevated: '#26306A',
  overlay: 'rgba(11, 16, 38, 0.86)',

  // Text
  text: '#FFFFFF',
  textSecondary: '#C9D1F5',
  textTertiary: '#8F99CC',
  textOnPrimary: '#2A1A00',

  // Lines
  border: '#3A4687',
  borderLight: '#2C376E',
  divider: '#26306A',

  // Teams
  teamA: '#3DD9C1',
  teamASoft: 'rgba(61, 217, 193, 0.18)',
  teamB: '#FF7AA8',
  teamBSoft: 'rgba(255, 122, 168, 0.18)',

  // Feedback
  success: '#5BE38A',
  error: '#FF6B6B',
  warning: '#FFD25E',
  info: '#6CB8FF',
  notification: '#FF6B6B',

  // Focus (TV remote)
  focus: '#FFFFFF',
  focusBorder: '#FFFFFF',
  focusBackground: '#FFB547',
  focusBackgroundSecondary: 'rgba(255, 255, 255, 0.15)',
  focusGlow: 'rgba(255, 181, 71, 0.45)',

  // Interaction
  pressedOverlay: 'rgba(255, 255, 255, 0.1)',
  hoverOverlay: 'rgba(255, 255, 255, 0.08)',
  scrimLight: 'rgba(0, 0, 0, 0.4)',
  scrimMedium: 'rgba(0, 0, 0, 0.6)',
  scrimDark: 'rgba(0, 0, 0, 0.85)',
};

export const teamColor = (team: 'A' | 'B') => (team === 'A' ? colors.teamA : colors.teamB);
export const teamSoftColor = (team: 'A' | 'B') => (team === 'A' ? colors.teamASoft : colors.teamBSoft);
