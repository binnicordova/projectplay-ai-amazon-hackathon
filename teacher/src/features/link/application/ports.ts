/**
 * Port for the local-network server. The application layer only knows this
 * interface; the TCP/WebSocket adapter lives in infrastructure/.
 */

export type ServerStatus =
  | { readonly state: 'stopped' }
  | { readonly state: 'starting' }
  | { readonly state: 'listening'; readonly port: number }
  | { readonly state: 'error'; readonly message: string };

export type ClientId = number;

export interface LinkServerEvents {
  onStatus(status: ServerStatus): void;
  onClientConnected(client: ClientId, address: string): void;
  onClientDisconnected(client: ClientId): void;
  onText(client: ClientId, text: string): void;
}

export interface LinkServer {
  start(port: number, events: LinkServerEvents): void;
  stop(): void;
  /** Sends a text message to every connected TV. */
  broadcast(text: string): void;
}
