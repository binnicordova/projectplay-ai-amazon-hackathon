import { ScreenFor, useCurrentScreen } from '@mimikai/tv-shared';

/**
 * Home: pairing with the teacher's phone, then the lobby once connected. While a class starts
 * (or a summary opens) the route changes a moment later: the lobby stays on screen until then,
 * instead of flashing the pairing screen and building its Mimikai for nothing.
 */
export default function HomeRoute() {
  const screen = useCurrentScreen();
  return <ScreenFor screen={screen === 'pairing' ? 'pairing' : 'lobby'} />;
}
