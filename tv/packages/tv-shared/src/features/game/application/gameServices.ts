/**
 * What the game screens need from the outside world. Screens depend on this
 * interface; the composition root provides the implementation.
 */
import type { LinkStatus } from '../../link/application/linkClient';
import type { PointerHub } from '../../interaction/application/pointerHub';
import type { SessionState } from '../../session/domain/session';

export interface GameServices {
  readonly pointers: PointerHub;
  /** Leaves a finished session. */
  backToLobby(): void;
}

export type Screen = 'pairing' | 'lobby' | 'play' | 'summary';

/**
 * Which screen to show. Lessons come from the teacher's phone, so without it the TV can only
 * wait for it; a class already running carries on if the phone drops out for a moment.
 */
export function screenFor(link: LinkStatus, session: SessionState): Screen {
  if (session.phase === 'question' || session.phase === 'feedback') return 'play';
  if (session.phase === 'summary') return 'summary';
  return link.state === 'connected' ? 'lobby' : 'pairing';
}
