import { describe, expect, it } from 'vitest';
import { clapped, soundOf, soundPositions, syllabify } from './syllables';

const CASES: Readonly<Record<string, string>> = {
  perro: 'pe-rro',
  carro: 'ca-rro',
  burro: 'bu-rro',
  zorro: 'zo-rro',
  mariposa: 'ma-ri-po-sa',
  manzana: 'man-za-na',
  paraguas: 'pa-ra-guas',
  bicicleta: 'bi-ci-cle-ta',
  gallina: 'ga-lli-na',
  chancho: 'chan-cho',
  árbol: 'ár-bol',
  ciencia: 'cien-cia',
  instrucción: 'ins-truc-ción',
  transporte: 'trans-por-te',
  león: 'le-ón',
  día: 'dí-a',
  país: 'pa-ís',
  cuatro: 'cua-tro',
  fuego: 'fue-go',
  juguete: 'ju-gue-te',
  guitarra: 'gui-ta-rra',
  queso: 'que-so',
  pingüino: 'pin-güi-no',
  hipopótamo: 'hi-po-pó-ta-mo',
  caballo: 'ca-ba-llo',
  elefante: 'e-le-fan-te',
  abeja: 'a-be-ja',
  cocodrilo: 'co-co-dri-lo',
  cerdo: 'cer-do',
  oveja: 'o-ve-ja',
  ratón: 'ra-tón',
  sol: 'sol',
  rey: 'rey',
  muy: 'muy',
  ahora: 'a-ho-ra',
  taxi: 'ta-xi',
  extraño: 'ex-tra-ño',
  plátano: 'plá-ta-no',
  pájaro: 'pá-ja-ro',
  agua: 'a-gua',
  búho: 'bú-ho',
  maíz: 'ma-íz',
  aéreo: 'a-é-re-o',
  cabra: 'ca-bra',
  hormiga: 'hor-mi-ga',
  llama: 'lla-ma',
  choclo: 'cho-clo',
  dinosaurio: 'di-no-sau-rio',
  sandía: 'san-dí-a',
  mayo: 'ma-yo',
  canguro: 'can-gu-ro',
  'águila': 'á-gui-la',
};

describe('syllabify (Spanish rules, no dictionary)', () => {
  it.each(Object.entries(CASES))('%s → %s', (word, expected) => {
    expect(clapped(word)).toBe(expected);
  });

  it('never loses or adds letters', () => {
    for (const word of Object.keys(CASES)) expect(syllabify(word).join('')).toBe(word);
  });

  it('keeps anything that is not a single Spanish word in one piece', () => {
    expect(syllabify('ice cream')).toEqual(['ice cream']);
    expect(syllabify('')).toEqual([]);
  });
});

describe('sounds', () => {
  it('reads RR as a strong R and ignores accents', () => {
    expect(soundOf('RRO')).toBe('ro');
    expect(soundOf('tón')).toBe('ton');
  });

  it('finds the strong R sound only where it is strong', () => {
    expect(soundPositions('perro', 'RO')).toEqual([1]);
    expect(soundPositions('rosa', 'ro')).toEqual([0]);
    expect(soundPositions('toro', 'ro')).toEqual([]);
    expect(soundPositions('pato', 'pa')).toEqual([0]);
  });
});
