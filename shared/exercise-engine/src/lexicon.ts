/**
 * Words children know, each with a picture (a Twemoji code point) and, when it is a common
 * first word in English class, its English translation. Generators only use words from here,
 * so every picture on the wall exists and every answer is checkable.
 *
 * Choices follow the Andean and coastal classroom: llama, papa, maíz and choclo sit next to
 * the farm animals children see every day.
 */

export type Gender = 'f' | 'm';

export type Tag =
  | 'animal'
  /** Farm animals (granja / chacra). */
  | 'granja'
  | 'fruta'
  | 'comida'
  | 'cosa'
  | 'naturaleza'
  | 'transporte'
  /** Good for counting groups: simple, compact pictures. */
  | 'contar';

export const TAGS: readonly Tag[] = ['animal', 'granja', 'fruta', 'comida', 'cosa', 'naturaleza', 'transporte', 'contar'];

export interface Word {
  /** Spanish, lowercase, with accents. */
  readonly es: string;
  readonly gender: Gender;
  /** Twemoji code point of the picture. */
  readonly icon: string;
  readonly tags: readonly Tag[];
  /** English translation, for words taught in the first English classes. */
  readonly en?: string;
}

const w = (es: string, gender: Gender, icon: string, tags: readonly Tag[], en?: string): Word => (en ? { es, gender, icon, tags, en } : { es, gender, icon, tags });

export const LEXICON: readonly Word[] = [
  // Animals
  w('abeja', 'f', '1f41d', ['animal'], 'bee'),
  w('araña', 'f', '1f577', ['animal'], 'spider'),
  w('ballena', 'f', '1f40b', ['animal'], 'whale'),
  w('búho', 'm', '1f989', ['animal'], 'owl'),
  w('burro', 'm', '1facf', ['animal', 'granja'], 'donkey'),
  w('caballo', 'm', '1f40e', ['animal', 'granja'], 'horse'),
  w('cabra', 'f', '1f410', ['animal', 'granja'], 'goat'),
  w('camello', 'm', '1f42b', ['animal'], 'camel'),
  w('canguro', 'm', '1f998', ['animal'], 'kangaroo'),
  w('caracol', 'm', '1f40c', ['animal'], 'snail'),
  w('cerdo', 'm', '1f416', ['animal', 'granja'], 'pig'),
  w('cocodrilo', 'm', '1f40a', ['animal'], 'crocodile'),
  w('conejo', 'm', '1f407', ['animal', 'granja'], 'rabbit'),
  w('delfín', 'm', '1f42c', ['animal'], 'dolphin'),
  w('elefante', 'm', '1f418', ['animal'], 'elephant'),
  w('foca', 'f', '1f9ad', ['animal'], 'seal'),
  w('gallina', 'f', '1f414', ['animal', 'granja'], 'hen'),
  w('gallo', 'm', '1f413', ['animal', 'granja'], 'rooster'),
  w('gato', 'm', '1f408', ['animal', 'granja'], 'cat'),
  w('gusano', 'm', '1fab1', ['animal'], 'worm'),
  w('hipopótamo', 'm', '1f99b', ['animal'], 'hippo'),
  w('hormiga', 'f', '1f41c', ['animal'], 'ant'),
  w('iguana', 'f', '1f98e', ['animal']),
  w('jirafa', 'f', '1f992', ['animal'], 'giraffe'),
  w('koala', 'm', '1f428', ['animal'], 'koala'),
  w('león', 'm', '1f981', ['animal'], 'lion'),
  w('llama', 'f', '1f999', ['animal', 'granja'], 'llama'),
  w('loro', 'm', '1f99c', ['animal'], 'parrot'),
  w('mariposa', 'f', '1f98b', ['animal'], 'butterfly'),
  w('mono', 'm', '1f412', ['animal'], 'monkey'),
  w('oso', 'm', '1f43b', ['animal'], 'bear'),
  w('oveja', 'f', '1f411', ['animal', 'granja'], 'sheep'),
  w('pájaro', 'm', '1f426', ['animal'], 'bird'),
  w('pato', 'm', '1f986', ['animal', 'granja', 'contar'], 'duck'),
  w('pavo', 'm', '1f983', ['animal', 'granja'], 'turkey'),
  w('perro', 'm', '1f415', ['animal', 'granja'], 'dog'),
  w('pez', 'm', '1f41f', ['animal', 'contar'], 'fish'),
  w('pingüino', 'm', '1f427', ['animal'], 'penguin'),
  w('pollito', 'm', '1f424', ['animal', 'granja', 'contar'], 'chick'),
  w('pulpo', 'm', '1f419', ['animal'], 'octopus'),
  w('rana', 'f', '1f438', ['animal'], 'frog'),
  w('ratón', 'm', '1f401', ['animal', 'granja'], 'mouse'),
  w('serpiente', 'f', '1f40d', ['animal'], 'snake'),
  w('tigre', 'm', '1f405', ['animal'], 'tiger'),
  w('toro', 'm', '1f402', ['animal', 'granja'], 'bull'),
  w('tortuga', 'f', '1f422', ['animal'], 'turtle'),
  w('vaca', 'f', '1f404', ['animal', 'granja'], 'cow'),
  w('zorro', 'm', '1f98a', ['animal'], 'fox'),
  w('cebra', 'f', '1f993', ['animal'], 'zebra'),
  w('águila', 'f', '1f985', ['animal'], 'eagle'),
  w('dinosaurio', 'm', '1f995', ['animal'], 'dinosaur'),
  // Fruit and food
  w('manzana', 'f', '1f34e', ['fruta', 'contar'], 'apple'),
  w('plátano', 'm', '1f34c', ['fruta'], 'banana'),
  w('naranja', 'f', '1f34a', ['fruta', 'contar'], 'orange'),
  w('pera', 'f', '1f350', ['fruta'], 'pear'),
  w('piña', 'f', '1f34d', ['fruta'], 'pineapple'),
  w('uvas', 'f', '1f347', ['fruta'], 'grapes'),
  w('fresa', 'f', '1f353', ['fruta', 'contar'], 'strawberry'),
  w('sandía', 'f', '1f349', ['fruta'], 'watermelon'),
  w('limón', 'm', '1f34b', ['fruta'], 'lemon'),
  w('mango', 'm', '1f96d', ['fruta'], 'mango'),
  w('palta', 'f', '1f951', ['fruta']),
  w('cereza', 'f', '1f352', ['fruta', 'contar'], 'cherry'),
  w('papa', 'f', '1f954', ['comida'], 'potato'),
  w('choclo', 'm', '1f33d', ['comida'], 'corn'),
  w('zanahoria', 'f', '1f955', ['comida'], 'carrot'),
  w('tomate', 'm', '1f345', ['comida'], 'tomato'),
  w('pan', 'm', '1f35e', ['comida'], 'bread'),
  w('queso', 'm', '1f9c0', ['comida'], 'cheese'),
  w('huevo', 'm', '1f95a', ['comida', 'contar'], 'egg'),
  w('leche', 'f', '1f95b', ['comida'], 'milk'),
  w('miel', 'f', '1f36f', ['comida'], 'honey'),
  w('helado', 'm', '1f366', ['comida'], 'ice cream'),
  w('galleta', 'f', '1f36a', ['comida', 'contar'], 'cookie'),
  w('hongo', 'm', '1f344', ['naturaleza'], 'mushroom'),
  // Things
  w('casa', 'f', '1f3e0', ['cosa'], 'house'),
  w('cama', 'f', '1f6cf', ['cosa'], 'bed'),
  w('silla', 'f', '1fa91', ['cosa'], 'chair'),
  w('puerta', 'f', '1f6aa', ['cosa'], 'door'),
  w('campana', 'f', '1f514', ['cosa'], 'bell'),
  w('corazón', 'm', '2764', ['cosa', 'contar'], 'heart'),
  w('dado', 'm', '1f3b2', ['cosa'], 'dice'),
  w('globo', 'm', '1f388', ['cosa', 'contar'], 'balloon'),
  w('guitarra', 'f', '1f3b8', ['cosa'], 'guitar'),
  w('tambor', 'm', '1f941', ['cosa'], 'drum'),
  w('jabón', 'm', '1f9fc', ['cosa'], 'soap'),
  w('libro', 'm', '1f4d5', ['cosa'], 'book'),
  w('llave', 'f', '1f511', ['cosa'], 'key'),
  w('lápiz', 'm', '270f', ['cosa'], 'pencil'),
  w('maleta', 'f', '1f9f3', ['cosa'], 'suitcase'),
  w('mano', 'f', '270b', ['cosa'], 'hand'),
  w('ojo', 'm', '1f441', ['cosa'], 'eye'),
  w('mapa', 'm', '1f5fa', ['cosa'], 'map'),
  w('paraguas', 'm', '2602', ['cosa'], 'umbrella'),
  w('pelota', 'f', '26bd', ['cosa', 'contar'], 'ball'),
  w('reloj', 'm', '23f0', ['cosa'], 'clock'),
  w('robot', 'm', '1f916', ['cosa'], 'robot'),
  w('ropa', 'f', '1f455', ['cosa'], 'shirt'),
  w('sombrero', 'm', '1f3a9', ['cosa'], 'hat'),
  w('taza', 'f', '2615', ['cosa'], 'cup'),
  w('vela', 'f', '1f56f', ['cosa'], 'candle'),
  w('zapato', 'm', '1f45f', ['cosa'], 'shoe'),
  w('regalo', 'm', '1f381', ['cosa'], 'gift'),
  w('casaca', 'f', '1f9e5', ['cosa'], 'coat'),
  w('medias', 'f', '1f9e6', ['cosa'], 'socks'),
  w('canasta', 'f', '1f9fa', ['cosa']),
  w('torre', 'f', '1f5fc', ['cosa'], 'tower'),
  // Transport
  w('carro', 'm', '1f697', ['transporte'], 'car'),
  w('avión', 'm', '2708', ['transporte'], 'airplane'),
  w('bicicleta', 'f', '1f6b2', ['transporte'], 'bike'),
  w('barco', 'm', '1f6a2', ['transporte'], 'ship'),
  w('tren', 'm', '1f686', ['transporte'], 'train'),
  w('cohete', 'm', '1f680', ['transporte'], 'rocket'),
  // Nature
  w('árbol', 'm', '1f333', ['naturaleza'], 'tree'),
  w('flor', 'f', '1f33c', ['naturaleza', 'contar'], 'flower'),
  w('rosa', 'f', '1f339', ['naturaleza'], 'rose'),
  w('girasol', 'm', '1f33b', ['naturaleza']),
  w('hoja', 'f', '1f343', ['naturaleza'], 'leaf'),
  w('planta', 'f', '1f331', ['naturaleza'], 'plant'),
  w('sol', 'm', '2600', ['naturaleza'], 'sun'),
  w('luna', 'f', '1f319', ['naturaleza'], 'moon'),
  w('estrella', 'f', '2b50', ['naturaleza', 'contar'], 'star'),
  w('nube', 'f', '2601', ['naturaleza'], 'cloud'),
  w('lluvia', 'f', '1f327', ['naturaleza'], 'rain'),
  w('fuego', 'm', '1f525', ['naturaleza'], 'fire'),
  w('gota', 'f', '1f4a7', ['naturaleza', 'contar'], 'drop'),
  w('montaña', 'f', '26f0', ['naturaleza'], 'mountain'),
  w('volcán', 'm', '1f30b', ['naturaleza'], 'volcano'),
  w('isla', 'f', '1f3dd', ['naturaleza'], 'island'),
  w('tierra', 'f', '1f30e', ['naturaleza'], 'earth'),
  w('nieve', 'f', '2744', ['naturaleza'], 'snow'),
];

export const wordsTagged = (tag: Tag): readonly Word[] => LEXICON.filter((word) => word.tags.includes(tag));

export const findWord = (es: string): Word | undefined => {
  const key = foldWord(es);
  return LEXICON.find((word) => foldWord(word.es) === key);
};

/** Lowercase without accents (keeps ñ): "Ratón" → "raton". */
export function foldWord(text: string): string {
  const map: Readonly<Record<string, string>> = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u' };
  return text
    .trim()
    .toLowerCase()
    .split('')
    .map((c) => map[c] ?? c)
    .join('');
}

/** "manzana" → "manzanas", "pez" → "peces", "flor" → "flores". Words ending in s stay. */
export function plural(word: string): string {
  if (/[sx]$/.test(word)) return word;
  if (word.endsWith('z')) return `${word.slice(0, -1)}ces`;
  if (/[aeiouáéó]$/.test(word)) return `${word}s`;
  return `${word}es`.replace(/ó(n|s)es$/, 'o$1es').replace(/á(n|s)es$/, 'a$1es').replace(/é(n|s)es$/, 'e$1es');
}

export const article = (word: Word): string => (word.gender === 'f' ? 'la' : 'el');
