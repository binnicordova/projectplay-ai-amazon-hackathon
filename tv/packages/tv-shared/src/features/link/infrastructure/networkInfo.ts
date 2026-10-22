/** Fire OS / Android TV / tvOS / web: the TV's own IP via expo-network. */
import * as Network from 'expo-network';
import type { NetworkInfo } from '../application/linkClient';

export const networkInfo: NetworkInfo = {
  async ownIpAddress() {
    try {
      const ip = await Network.getIpAddressAsync();
      return ip && ip !== '0.0.0.0' ? ip : null;
    } catch {
      return null;
    }
  },
};
