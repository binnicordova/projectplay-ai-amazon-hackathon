// Composition
export { createTvServices, type TvPlatform, type TvServices } from './composition/createTvServices';
export { ScreenFor, TvApp, TvServicesProvider, useCurrentScreen, useTvServices } from './composition/TvServicesProvider';

// Game
export { screenFor, type GameServices, type Screen } from './features/game/application/gameServices';

// Link adapters (platform-specific files are resolved by Metro: networkInfo.kepler.ts on Vega)
export { networkInfo } from './features/link/infrastructure/networkInfo';
export { webSocketTransport } from './features/link/infrastructure/webSocketTransport';
export { linkStatusAtom, type LinkStatus } from './features/link/application/linkClient';

// Theme & TV building blocks from the Amazon multi-TV sample
export * from './theme';
export { default as FocusablePressable } from './components/FocusablePressable';
export { scaledPixels } from './hooks/useScale';
