import Constants from 'expo-constants';
import { Provider } from 'jotai';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createAppServices, type AppServices } from './container';

const ServicesContext = createContext<AppServices | null>(null);

/** Creates the app services once, provides the Jotai store, and runs the link server. */
export function ServicesProvider({ children }: { readonly children: ReactNode }) {
  const [services] = useState(() => createAppServices(Constants.expoConfig?.version ?? '1.0.0'));

  useEffect(() => {
    services.link.start();
    return () => services.link.stop();
  }, [services]);

  return (
    <ServicesContext.Provider value={services}>
      <Provider store={services.store}>{children}</Provider>
    </ServicesContext.Provider>
  );
}

export function useServices(): AppServices {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('useServices must be used inside <ServicesProvider>');
  return services;
}
