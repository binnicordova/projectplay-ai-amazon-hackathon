import { ScreenFor, useCurrentScreen } from '@projectplay/tv-shared';

/** Home: pairing with the teacher's phone, then the lobby once connected. */
export default function HomeRoute() {
  const screen = useCurrentScreen();
  return <ScreenFor screen={screen === 'lobby' ? 'lobby' : 'pairing'} />;
}
