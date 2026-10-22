import { LogBox } from 'react-native';
import { Stack } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';
import { ServicesProvider } from '../composition/ServicesProvider';
import { colors } from '../ui-kit/theme';

LogBox.ignoreAllLogs();

export default function RootLayout() {
  // The phone sits on a tripod for the whole class: never let it sleep.
  useKeepAwake();
  return (
    <ServicesProvider>
      <StatusBar hidden />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'fade' }} />
    </ServicesProvider>
  );
}
