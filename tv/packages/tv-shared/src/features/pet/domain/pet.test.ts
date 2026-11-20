import { MOODS, SALTO, energyBeats, granTiming, lineOf, sameCue, type PetCue } from '@mimikai/pet';
import { describe, expect, it } from 'vitest';
import { BIG_STREAK_PARTY_MS, LEVEL_UP_PARTY_MS } from '../../session/domain/session';
import { INVITE, NAP_AFTER_MS, cueOf } from './cue';
import { INITIAL_PET_MEMORY, reducePet, type PetMemory } from './memory';
import type { Celebration, ClassMoment, TeamResult } from './moment';
import { ringsAt } from './rings';
import { LOBBY_PET, sceneStageAround, spotlightOf } from './stage';

const LOBBY: ClassMoment = { kind: 'lobby' };

const question = (overrides: Partial<Extract<ClassMoment, { kind: 'question' }>> = {}): ClassMoment => ({
  kind: 'question',
  round: 2,
  title: 'Sumas',
  startedAt: 10_000,
  endsAt: 30_000,
  hurryAt: 25_000,
  chosen: false,
  level: 1,
  teams: [{ team: 'A', streak: 0 }],
  ...overrides,
});

const feedback = (teams: readonly TeamResult[], overrides: Partial<Extract<ClassMoment, { kind: 'feedback' }>> = {}): ClassMoment => ({
  kind: 'feedback',
  round: 4,
  at: 50_000,
  level: 2,
  levelChange: null,
  teams,
  celebration: null,
  ...overrides,
});

/** The party starts after the 4 s answer panel. */
const PARTY_AT = 54_000;
const levelUp = (level: 2 | 3): Celebration => ({ at: PARTY_AT, kind: 'levelUp', level });
const streak = (teams: readonly ('A' | 'B')[], count: number, big = false): Celebration => ({ at: PARTY_AT, kind: 'streak', teams, streak: count, big });

const right = (team: 'A' | 'B', count = 1): TeamResult => ({ team, correct: true, streak: count });
const wrong = (team: 'A' | 'B'): TeamResult => ({ team, correct: false, streak: 0 });
const moodAt = (moment: ClassMoment, now: number, memory: PetMemory = INITIAL_PET_MEMORY): PetCue => cueOf(moment, memory, now);

describe('rings in a class', () => {
  it('starts every class with one ring', () => {
    expect(ringsAt(LOBBY, 0)).toEqual(['sun']);
    expect(ringsAt({ kind: 'offline' }, 0)).toEqual(['sun']);
  });

  it('brings the new level ring in once Rayitas has jumped through it, and drops a ring at once when the class goes down', () => {
    const up = feedback([right('A')], { level: 3, levelChange: 'up', celebration: levelUp(3) });
    expect(ringsAt(up, PARTY_AT + SALTO.ringsBackMs - 1)).toHaveLength(2);
    expect(ringsAt(up, PARTY_AT + SALTO.ringsBackMs)).toHaveLength(3);
    expect(ringsAt(feedback([wrong('A')], { level: 1, levelChange: 'down' }), 50_000)).toEqual(['sun']);
  });
});

describe('what Mimikai does before a class', () => {
  it('waits for the phone, then naps after two minutes without one', () => {
    const offline: ClassMoment = { kind: 'offline' };
    const memory = reducePet(INITIAL_PET_MEMORY, { type: 'unlinked', now: 1_000 });
    expect(moodAt(offline, 1_000 + NAP_AFTER_MS - 1, memory).mood).toBe('waiting');
    expect(moodAt(offline, 1_000 + NAP_AFTER_MS, memory).mood).toBe('nap');
  });

  it('invites children to hold a hand on it in the lobby', () => {
    expect(moodAt(LOBBY, 0)).toMatchObject({ mood: 'waiting', line: INVITE });
  });

  it('giggles when tickled, with a new line each time, then waits again', () => {
    const once = reducePet(INITIAL_PET_MEMORY, { type: 'tickled', team: 'B', now: 5_000 });
    const twice = reducePet(once, { type: 'tickled', team: 'A', now: 9_000 });
    expect(moodAt(LOBBY, 5_100, once)).toMatchObject({ mood: 'tickled', side: 'B', line: lineOf('tickled', 0) });
    expect(moodAt(LOBBY, 9_100, twice)).toMatchObject({ mood: 'tickled', side: 'A', line: lineOf('tickled', 1) });
    expect(moodAt(LOBBY, 9_000 + MOODS.tickled.ms, twice).mood).toBe('waiting');
  });

  it('waves at the half of the wall where a child just appeared; the latest thing a child did wins', () => {
    const arrived = reducePet(INITIAL_PET_MEMORY, { type: 'arrived', team: 'A', now: 2_000 });
    expect(moodAt(LOBBY, 2_500, arrived)).toMatchObject({ mood: 'wave', side: 'A' });
    const tickled = reducePet(arrived, { type: 'tickled', team: 'B', now: 2_600 });
    expect(moodAt(LOBBY, 2_700, tickled).mood).toBe('tickled');
  });

  it('remembers the first moment the link went, and forgets it once linked', () => {
    const lost = reducePet(INITIAL_PET_MEMORY, { type: 'unlinked', now: 100 });
    expect(reducePet(lost, { type: 'unlinked', now: 900 }).offlineSince).toBe(100);
    expect(reducePet(lost, { type: 'linked' }).offlineSince).toBeNull();
    expect(reducePet(INITIAL_PET_MEMORY, { type: 'linked' })).toBe(INITIAL_PET_MEMORY);
  });

  it('stands where children can reach it from either half of the wall', () => {
    expect(LOBBY_PET.x + LOBBY_PET.width / 2).toBeCloseTo(0.5);
  });

  it("gives Rayitas Mimikai's floor and its left side, at a cub's size", () => {
    const box = { left: 600, top: 100, size: 680 };
    const stage = sceneStageAround(box);
    // Mimikai's floor is at rig y 250 of a box running from -72 to 268.
    expect(stage.ground).toBeCloseTo(100 + (322 / 340) * 680);
    expect(stage.mimiLeft).toBeGreaterThan(box.left);
    expect(stage.mimiLeft).toBeLessThan(box.left + box.size / 4);
    expect(stage.mimiTop.y).toBeLessThan(stage.mimiHand.y);
    // About 100 tiger units tall: a little over half of the octopus (about 227 rig units).
    expect((100 * stage.unit) / ((227 / 340) * box.size)).toBeGreaterThan(0.5);
  });
});

describe('what Mimikai does during a question', () => {
  it('greets the class full screen until the first card opens, saying what they play', () => {
    const first = question({ round: 1 });
    const hello = moodAt(first, 9_000);
    expect(hello).toMatchObject({ mood: 'hello', line: lineOf('hello', 0) });
    expect(spotlightOf(first, hello)).toEqual({ place: 'full', title: lineOf('hello', 0), detail: 'Hoy jugamos: Sumas', rayitas: null });
    expect(moodAt(first, 10_000).mood).toBe('think');
  });

  it('waits small in its corner while children choose', () => {
    const think = moodAt(question(), 12_000);
    expect(think.mood).toBe('think');
    expect(spotlightOf(question(), think).place).toBe('corner');
  });

  it('shows the gesture once, at half time, when nobody has chosen', () => {
    expect(moodAt(question(), 19_999).mood).toBe('think');
    expect(moodAt(question(), 20_000)).toMatchObject({ mood: 'showMe', line: 'Pon tu mano sobre una respuesta' });
    expect(moodAt(question(), 20_000 + MOODS.showMe.ms).mood).toBe('think');
    expect(moodAt(question({ chosen: true }), 20_500).mood).toBe('think');
  });

  it('hurries in the same last seconds that turn the countdown to its warning colour', () => {
    expect(moodAt(question(), 24_999).mood).toBe('think');
    expect(moodAt(question(), 25_000).mood).toBe('hurry');
  });
});

describe('what Mimikai does on the answer screen', () => {
  it('reacts in the answer panel: cheers a right answer, meets a wrong one with a warm nice try', () => {
    const got = moodAt(feedback([right('A')]), 50_100);
    expect(got.mood).toBe('gotIt');
    expect(spotlightOf(feedback([right('A')]), got).place).toBe('panel');
    expect(moodAt(feedback([wrong('A')]), 50_100).mood).toBe('niceTry');
    expect(moodAt(feedback([wrong('A'), wrong('B')]), 50_100).mood).toBe('niceTry');
  });

  it('celebrates both teams together, and turns one arm to each team when only one is right', () => {
    expect(moodAt(feedback([right('A'), right('B')]), 50_100).mood).toBe('highFive');
    expect(moodAt(feedback([wrong('A'), right('B')]), 50_100)).toMatchObject({ mood: 'oneArmEach', side: 'B', line: '¡Bien, equipo B!' });
  });

  it('throws a full-screen level-up party after the answer panel, with the new ring', () => {
    const up = feedback([right('A')], { level: 3, levelChange: 'up', celebration: levelUp(3) });
    expect(moodAt(up, PARTY_AT - 1).mood).toBe('gotIt');
    const party = moodAt(up, PARTY_AT);
    expect(party).toMatchObject({ mood: 'levelUp', line: '¡Subimos al nivel 3!' });
    expect(spotlightOf(up, party)).toEqual({
      place: 'full',
      title: '¡Subimos al nivel 3!',
      detail: 'Mimikai ya hace malabares con 3 anillos',
      // Rayitas jumps through the new level's ring.
      rayitas: { scene: 'salto', at: PARTY_AT, rings: ['white'] },
    });
  });

  it("throws every ring up for Rayitas's big jump at a first five in a row, then cheers once they are back", () => {
    const five = feedback([right('A', 5)], { level: 2, celebration: streak(['A'], 5, true) });
    const rings = 3; // sun, lilac and team A's streak ring
    const jump = moodAt(five, PARTY_AT);
    expect(jump).toMatchObject({ mood: 'bigJump', line: '¡5 seguidas!' });
    expect(spotlightOf(five, jump).rayitas).toEqual({ scene: 'gran', at: PARTY_AT, rings: ['sun', 'lilac', 'mint'] });
    const back = moodAt(five, PARTY_AT + granTiming(rings).ringsBackMs);
    expect(back.mood).toBe('onFire');
    expect(spotlightOf(five, back).rayitas?.scene).toBe('gran');
    expect(spotlightOf(feedback([right('A', 3)], { celebration: streak(['A'], 3) }), moodAt(feedback([right('A', 3)], { celebration: streak(['A'], 3) }), PARTY_AT)).rayitas).toBeNull();
  });

  it("fits Rayitas's scenes in the parties the session gives them, with any number of rings", () => {
    expect(SALTO.ms).toBeLessThanOrEqual(LEVEL_UP_PARTY_MS);
    [1, 2, 3, 4, 5].forEach((rings) => expect(granTiming(rings).ms).toBeLessThanOrEqual(BIG_STREAK_PARTY_MS));
  });

  it('never brings Rayitas while children choose', () => {
    expect(spotlightOf(question(), moodAt(question(), 12_000)).rayitas).toBeNull();
    expect(spotlightOf(question({ round: 1 }), moodAt(question({ round: 1 }), 9_000)).rayitas).toBeNull();
  });

  it('gets fired up full screen for a streak, turning to the team on fire', () => {
    const solo = feedback([right('A', 3)], { celebration: streak(['A'], 3) });
    expect(moodAt(solo, PARTY_AT)).toMatchObject({ mood: 'onFire', count: 3, line: '¡3 seguidas!', side: null });
    expect(spotlightOf(solo, moodAt(solo, PARTY_AT)).detail).toBe('¡Imparables!');
    const teams = feedback([right('A', 5), wrong('B')], { celebration: streak(['A'], 5) });
    const party = moodAt(teams, PARTY_AT);
    expect(party).toMatchObject({ mood: 'onFire', count: 5, side: 'A' });
    expect(spotlightOf(teams, party).detail).toBe('¡El equipo A está imparable!');
  });

  it('plays the same reaction again on the next round (a new key)', () => {
    const a = moodAt(feedback([right('A')], { round: 4 }), 50_100);
    const b = moodAt(feedback([right('A')], { round: 5 }), 50_100);
    expect(a.mood).toBe(b.mood);
    expect(sameCue(a, b)).toBe(false);
  });
});

describe('the summary', () => {
  const BALL_AT = 100_000;
  const summary = (bestStreak: number, ending: 'spark' | 'super' = 'super'): ClassMoment => ({
    kind: 'summary',
    level: 2,
    teams: [{ team: 'A', streak: 0 }],
    bestStreak,
    ball: { at: BALL_AT, ending, rightAnswers: 9 },
  });

  it("follows the energy ball: excited while it gathers, a superhero flip for a super ball, the ball's own words", () => {
    const beats = energyBeats('super', 9);
    expect(moodAt(summary(1), BALL_AT - 500).mood).toBe('hurry');
    expect(moodAt(summary(1), BALL_AT + 100)).toMatchObject({ mood: 'hurry', line: null });
    expect(moodAt(summary(1), BALL_AT + beats.launch).mood).toBe('onFire');
  });

  it('then praises effort, and the best streak when there was one', () => {
    const after = BALL_AT + energyBeats('super', 9).ms;
    expect(moodAt(summary(1), after)).toMatchObject({ mood: 'greatEffort', line: '¡Qué gran esfuerzo, clase!' });
    expect(moodAt(summary(4), after).line).toBe('¡Qué gran esfuerzo! Racha de 4');
  });

  it('ends the class juggling the rings the ending earned', () => {
    expect(ringsAt(summary(1, 'spark'), BALL_AT)).toHaveLength(2);
    expect(ringsAt(summary(1, 'super'), BALL_AT)).toHaveLength(5);
  });
});
