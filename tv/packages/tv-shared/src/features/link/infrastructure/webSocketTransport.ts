/**
 * Transport adapter over React Native's built-in WebSocket, available on
 * Fire OS (react-native-tvos), Vega OS and web without any native module.
 */
import type { Transport } from '../application/linkClient';

export const webSocketTransport: Transport = {
  connect(url, handlers) {
    const socket = new WebSocket(url);
    socket.onopen = () => handlers.onOpen();
    socket.onmessage = (event) => {
      if (typeof event.data === 'string') handlers.onText(event.data);
    };
    // A failed connection fires onerror and then onclose; onclose is enough for us.
    socket.onerror = () => {};
    socket.onclose = () => handlers.onClose();
    return {
      send(text) {
        if (socket.readyState === WebSocket.OPEN) socket.send(text);
      },
      close() {
        try {
          socket.close();
        } catch {
          // already closed
        }
      },
    };
  },
};
