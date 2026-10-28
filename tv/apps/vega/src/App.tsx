// Fire TV on Vega OS: the same game as the Fire OS app, without Expo Router.
// Vega's Metro resolves `*.kepler.ts` platform files (remote control, network info).
import React from 'react';
import {
  TvApp,
  networkInfo,
  webSocketTransport,
  type TvPlatform,
} from '@mimikai/tv-shared';

const platform: TvPlatform = {
  transport: webSocketTransport,
  network: networkInfo,
  platform: 'firetv-vega',
};

export const App = () => <TvApp platform={platform} />;
