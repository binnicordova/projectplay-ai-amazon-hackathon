import { LogBox } from 'react-native';
import { Stack } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';
import { ServicesProvider, useServices } from '../composition/ServicesProvider';
import { MimiMoments } from '../features/mimi/ui/MimiMoments';
import { colors } from '../ui-kit/theme';

LogBox.ignoreAllLogs();

/** Mimi's full-screen celebrations, above every screen. */
function Celebrations() {
  const { mimi } = useServices();
  return <MimiMoments onDismiss={mimi.dismissMoment} />;
}

export default function RootLayout() {
  // The phone sits on a tripod for the whole class: never let it sleep.
  useKeepAwake();
  return (
    <ServicesProvider>
      <StatusBar hidden />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'fade' }} />
      <Celebrations />
    </ServicesProvider>
  );
}
