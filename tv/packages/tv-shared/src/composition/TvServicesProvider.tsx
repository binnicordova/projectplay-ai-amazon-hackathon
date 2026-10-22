import { Provider, useAtomValue } from 'jotai';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
// Hooks the TV remote (D-pad) into spatial navigation, once, for every platform.
import '../platform/configureRemoteControl';
import { CalibrationPatternLayer } from '../features/calibration/ui/CalibrationPatternLayer';
import { screenFor, type Screen } from '../features/game/application/gameServices';
import { PlayScreen } from '../features/game/ui/PlayScreen';
import { LobbyScreen, PairingScreen, SummaryScreen } from '../features/game/ui/screens';
import { linkStatusAtom } from '../features/link/application/linkClient';
import { sessionAtom } from '../features/session/application/sessionStore';
import { createTvServices, type TvPlatform, type TvServices } from './createTvServices';

const TvServicesContext = createContext<TvServices | null>(null);

/** Creates the TV services once, provides the Jotai store, starts the phone link. */
export function TvServicesProvider({ platform, children }: { readonly platform: TvPlatform; readonly children: ReactNode }) {
  const [services] = useState(() => createTvServices(platform));
  useEffect(() => {
    services.start();
    return () => services.dispose();
  }, [services]);
  return (
    <TvServicesContext.Provider value={services}>
      <Provider store={services.store}>
        <View style={styles.root}>
          {children}
          {/* Above every screen: the phone films it to find the projection. */}
          <CalibrationPatternLayer onShown={services.calibrationShown} />
        </View>
      </Provider>
    </TvServicesContext.Provider>
  );
}

export function useTvServices(): TvServices {
  const services = useContext(TvServicesContext);
  if (!services) throw new Error('useTvServices must be used inside <TvServicesProvider>');
  return services;
}

/** The screen the current link + session state calls for. */
export function useCurrentScreen(): Screen {
  return screenFor(useAtomValue(linkStatusAtom), useAtomValue(sessionAtom));
}

const SCREENS: Readonly<Record<Screen, (props: { services: TvServices }) => ReactNode>> = {
  pairing: PairingScreen,
  lobby: LobbyScreen,
  play: PlayScreen,
  summary: SummaryScreen,
};

export function ScreenFor({ screen }: { readonly screen: Screen }) {
  const services = useTvServices();
  const Component = SCREENS[screen];
  return <Component services={services} />;
}

/** Router-less shell, used by the Vega OS app. */
export function TvApp({ platform }: { readonly platform: TvPlatform }) {
  return (
    <TvServicesProvider platform={platform}>
      <CurrentScreen />
    </TvServicesProvider>
  );
}

function CurrentScreen() {
  return <ScreenFor screen={useCurrentScreen()} />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
