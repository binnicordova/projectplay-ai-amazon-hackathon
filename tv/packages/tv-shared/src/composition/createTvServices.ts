/**
 * Composition root for the TV: wires the phone link, the pointer hub, the remote
 * control and the session reducer around one Jotai store.
 */
import { DEFAULT_TEAM_COUNT, TEAMS, type AgeBand, type CalibrationPattern, type PlayerId, type TeamId } from '@mimikai/contracts';
import { createStore } from 'jotai';
import { PATTERN_TIMEOUT_MS, calibrationPatternAtom } from '../features/calibration/application/calibrationPattern';
import type { GameServices } from '../features/game/application/gameServices';
import { PointerHub } from '../features/interaction/application/pointerHub';
import { DEFAULT_DWELL } from '../features/interaction/domain/dwell';
import { LinkClient, linkStatusAtom, type NetworkInfo, type Transport } from '../features/link/application/linkClient';
import { activeTeamsAtom, clockAtom, sessionAtom } from '../features/session/application/sessionStore';
import { roundResults, snapshotOf, teamCountOf, type SessionEvent } from '../features/session/domain/session';
import RemoteControlManager from '../platform/remote-control/RemoteControlManager';
import { SupportedKeys } from '../platform/remote-control/SupportedKeys';

export interface TvPlatform {
  readonly transport: Transport;
  readonly network: NetworkInfo;
  /** Reported to the phone, e.g. "firetv-fireos", "firetv-vega". */
  readonly platform: string;
  readonly preferredHosts?: readonly string[];
}

export interface TvServices extends GameServices {
  readonly store: ReturnType<typeof createStore>;
  readonly link: LinkClient;
  /** The calibration pattern the phone asked for is now on screen. */
  calibrationShown(pattern: CalibrationPattern): void;
  start(): void;
  dispose(): void;
}

const TICK_MS = 200;
/** A team counts as playing (its label lights up) if one of its children was seen this recently. */
const PRESENCE_MS = 8000;
const REMOTE_PLAYER: PlayerId = 1;
const REMOTE_STEP = 0.06;
const REMOTE_HAND = 0;
/** The remote cursor stays on screen this long after the last key press. */
const REMOTE_HOLD_MS = 10_000;
/** Pre-readers' arms waver more: they hold a little longer before a tile counts as chosen. */
const DWELL_MS: Readonly<Record<AgeBand, number>> = { inicial: 750, primaria: DEFAULT_DWELL.dwellMs, secundaria: DEFAULT_DWELL.dwellMs };

export function createTvServices({ transport, network, platform, preferredHosts = [] }: TvPlatform): TvServices {
  const store = createStore();
  const link = new LinkClient(transport, network, store, { platform, preferredHosts });
  const pointers = new PointerHub();
  const lastSeen = new Map<TeamId, number>();
  const disposers: (() => void)[] = [];
  let ticker: ReturnType<typeof setInterval> | null = null;
  let patternTimer: ReturnType<typeof setTimeout> | null = null;

  const dispatch = (event: SessionEvent) => store.set(sessionAtom, event);
  const seen = (player: PlayerId) => lastSeen.set(pointers.teamOf(player), Date.now());
  const answering = () => store.get(sessionAtom).phase === 'question';

  const showPattern = (pattern: CalibrationPattern | null) => {
    // Hiding is requested on every link-status change: only act when something is shown.
    if (pattern === null && store.get(calibrationPatternAtom) === null) return;
    if (patternTimer) clearTimeout(patternTimer);
    patternTimer = pattern ? setTimeout(() => showPattern(null), PATTERN_TIMEOUT_MS) : null;
    store.set(calibrationPatternAtom, pattern ? { pattern } : null);
    console.log(`[calib] ${pattern ? `showing ${pattern}` : 'pattern hidden'}`);
  };

  // Phone → TV
  disposers.push(
    link.onMessage((message) => {
      switch (message.t) {
        case 'ptr':
          seen(message.p);
          pointers.move(message.p, message.h ?? 0, { x: message.x, y: message.y });
          return;
        case 'lost':
          pointers.lost(message.p);
          return;
        case 'calib':
          showPattern(message.show);
          return;
        case 'ctl':
          if (message.a === 'start') {
            pointers.setDwellMs(DWELL_MS[message.config.lesson.audience.band]);
            console.log(`[lesson] ${message.config.lesson.id}: ${message.config.lesson.cards.length} cards, ${Object.keys(message.config.art).length} pictures (memory only)`);
            dispatch({ type: 'start', config: message.config, now: Date.now() });
          }
          else if (message.a === 'next') dispatch({ type: 'next', now: Date.now() });
          else dispatch({ type: 'end' });
          return;
        default:
          return;
      }
    }),
  );

  // A hand held on a tile chooses it for its team (a later choice replaces it until time is up).
  disposers.push(pointers.onSelect((team, target) => dispatch({ type: 'answer', team, value: target.value, now: Date.now() })));

  // TV remote: a virtual pointer during a class (handy on the Fire TV / Vega simulators).
  let remotePoint = { x: 0.25, y: 0.62 };
  let remoteUsedAt = -Infinity;
  const onKey = (key: SupportedKeys) => {
    if (!answering()) return;
    const moves: Partial<Record<SupportedKeys, [number, number]>> = {
      [SupportedKeys.Left]: [-REMOTE_STEP, 0],
      [SupportedKeys.Right]: [REMOTE_STEP, 0],
      [SupportedKeys.Up]: [0, -REMOTE_STEP],
      [SupportedKeys.Down]: [0, REMOTE_STEP],
    };
    const delta = moves[key];
    seen(REMOTE_PLAYER);
    remoteUsedAt = Date.now();
    if (delta) {
      remotePoint = { x: Math.min(0.98, Math.max(0.02, remotePoint.x + delta[0])), y: Math.min(0.98, Math.max(0.02, remotePoint.y + delta[1])) };
      pointers.move(REMOTE_PLAYER, REMOTE_HAND, remotePoint);
    } else if (key === SupportedKeys.Enter) {
      pointers.selectAt(REMOTE_PLAYER, remotePoint);
    } else if (key === SupportedKeys.FastForward) {
      // Same as the teacher's "Next" button: cards run their full time otherwise.
      dispatch({ type: 'next', now: Date.now() });
    }
  };

  // TV → phone: mirror the session and report each finished round.
  let lastSnapshot = '';
  let lastPhase = store.get(sessionAtom).phase;
  const publish = (force = false) => {
    const state = store.get(sessionAtom);
    pointers.setTeamCount(state.phase === 'lobby' ? DEFAULT_TEAM_COUNT : teamCountOf(state.config));
    const snapshot = snapshotOf(state);
    const json = JSON.stringify(snapshot);
    if (force || json !== lastSnapshot) {
      lastSnapshot = json;
      link.send({ t: 'state', ...snapshot });
    }
    if (state.phase === 'feedback' && lastPhase === 'question') roundResults(state).forEach((r) => link.send(r));
    if (state.phase !== lastPhase && state.phase === 'question') pointers.setTargets([]);
    lastPhase = state.phase;
  };
  disposers.push(store.sub(sessionAtom, () => publish()));
  disposers.push(
    store.sub(linkStatusAtom, () => {
      if (store.get(linkStatusAtom).state === 'connected') publish(true);
      else showPattern(null);
    }),
  );

  const tick = () => {
    const now = Date.now();
    const active = TEAMS.filter((t) => now - (lastSeen.get(t) ?? -Infinity) < PRESENCE_MS);
    if (active.join() !== store.get(activeTeamsAtom).join()) store.set(activeTeamsAtom, active);
    store.set(clockAtom, now);
    if (now - remoteUsedAt < REMOTE_HOLD_MS) pointers.keepAlive(REMOTE_PLAYER, REMOTE_HAND);
    pointers.sweep();
    dispatch({ type: 'tick', now });
  };

  return {
    store,
    link,
    pointers,
    start() {
      link.start();
      const listener = RemoteControlManager.addKeydownListener(onKey);
      disposers.push(() => RemoteControlManager.removeKeydownListener(listener));
      ticker = setInterval(tick, TICK_MS);
    },
    calibrationShown(pattern) {
      link.send({ t: 'calib', shown: pattern });
    },
    dispose() {
      if (ticker) clearInterval(ticker);
      if (patternTimer) clearTimeout(patternTimer);
      disposers.splice(0).forEach((d) => d());
      link.stop();
    },
    backToLobby() {
      const phase = store.get(sessionAtom).phase;
      if (phase !== 'lobby') dispatch({ type: 'end' });
      if (store.get(sessionAtom).phase !== 'lobby') dispatch({ type: 'end' });
    },
  };
}
