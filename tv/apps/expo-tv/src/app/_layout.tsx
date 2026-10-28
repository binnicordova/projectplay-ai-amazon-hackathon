import { TvServicesProvider, networkInfo, useCurrentScreen, webSocketTransport, type Screen, type TvPlatform } from '@mimikai/tv-shared';
import { Stack, router, usePathname } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { useEffect } from 'react';
import { BackHandler, LogBox, Platform } from 'react-native';

LogBox.ignoreAllLogs();

const devTeacherHost = process.env.EXPO_PUBLIC_TEACHER_HOST;

const platform: TvPlatform = {
  transport: webSocketTransport,
  network: networkInfo,
  platform: Platform.OS === 'android' ? 'firetv-fireos' : `${Platform.OS}-tv`,
  preferredHosts: devTeacherHost ? [devTeacherHost] : [],
};

const ROUTE_FOR: Readonly<Record<Screen, '/' | '/play' | '/summary'>> = {
  pairing: '/',
  lobby: '/',
  play: '/play',
  summary: '/summary',
};

/** The game state decides the screen; routes follow it. */
function FollowGameState() {
  const screen = useCurrentScreen();
  const pathname = usePathname();
  useEffect(() => {
    const target = ROUTE_FOR[screen];
    if (pathname !== target) router.replace(target);
  }, [screen, pathname]);

  // A child grabbing the remote must not close the class: Back is ignored during a game.
  useEffect(() => {
    if (screen !== 'play') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, [screen]);
  return null;
}

export default function RootLayout() {
  // Classes are long and nobody touches the remote: keep the Fire TV screensaver away.
  useKeepAwake();
  return (
    <TvServicesProvider platform={platform}>
      <FollowGameState />
      <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: '#0B1026' } }} />
    </TvServicesProvider>
  );
}

