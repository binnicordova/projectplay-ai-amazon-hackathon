/**
 * Vega OS: expo-network is not available. Discovery falls back to the well-known
 * hotspot gateways (iPhone 172.20.10.1, Android 192.168.43.1, …).
 * TODO(vega): read the device IP from the Vega network APIs to enable the subnet sweep.
 */
import type { NetworkInfo } from '../application/linkClient';

export const networkInfo: NetworkInfo = {
  async ownIpAddress() {
    return null;
  },
};
