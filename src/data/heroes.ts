import type { ResId } from './resources';

export type HeroRole = 'Warrior' | 'Archer' | 'Sage' | 'Ruler' | 'Builder';
export type Headwear = 'lionmane' | 'crown' | 'nemes' | 'wrap' | 'plume' | 'braids' | 'turban' | 'helm' | 'beads';

export type HeroBonus =
  | { kind: 'production'; res: ResId; pct: number }
  | { kind: 'buildSpeed'; pct: number }
  | { kind: 'defense'; pct: number }
  | { kind: 'wallHp'; pct: number }
  | { kind: 'guards'; pct: number }
  | { kind: 'growth'; pct: number };

export interface HeroDef {
  id: string;
  name: string;
  title: string;
  /** Realm and period, shown on the hero card. */
  origin: string;
  /** Short, factual note about the historical figure. */
  story: string;
  era: number;
  role: HeroRole;
  /** Legend tokens to summon. */
  cost: number;
  hp: number;
  damage: number;
  /** Attack range in tiles; > 1.5 means ranged. */
  range: number;
  speed: number;
  bonus: HeroBonus;
  look: { skin: string; robe: string; accent: string; headwear: Headwear; bg: string };
}

export const HEROES: HeroDef[] = [
  {
    id: 'sundiata',
    name: 'Sundiata Keita',
    title: 'The Lion of Mali',
    origin: 'Mali Empire, 13th century',
    story: 'Founder of the Mali Empire. The Epic of Sundiata, still sung by griots, tells how a boy who could not walk became a king.',
    era: 1,
    role: 'Warrior',
    cost: 3,
    hp: 520,
    damage: 26,
    range: 1.1,
    speed: 2.1,
    bonus: { kind: 'production', res: 'food', pct: 15 },
    look: { skin: '#6b3f24', robe: '#c9a227', accent: '#7a1f1f', headwear: 'lionmane', bg: '#b5651d' },
  },
  {
    id: 'amina',
    name: 'Queen Amina',
    title: 'Builder of Walls',
    origin: 'Zazzau (Zaria), 16th century',
    story: 'Warrior queen of the Hausa city-state of Zazzau. Earthen walls around Hausa towns are still called "ganuwar Amina" — Amina\'s walls.',
    era: 1,
    role: 'Warrior',
    cost: 5,
    hp: 460,
    damage: 30,
    range: 1.2,
    speed: 2.6,
    bonus: { kind: 'wallHp', pct: 40 },
    look: { skin: '#5a321c', robe: '#2e6b4f', accent: '#e0b84a', headwear: 'plume', bg: '#2e6b4f' },
  },
  {
    id: 'imhotep',
    name: 'Imhotep',
    title: 'The Architect',
    origin: 'Egypt, 27th century BCE',
    story: 'Chancellor to the pharaoh Djoser and designer of the Step Pyramid at Saqqara, the oldest great stone monument known.',
    era: 1,
    role: 'Builder',
    cost: 5,
    hp: 300,
    damage: 12,
    range: 3.5,
    speed: 1.8,
    bonus: { kind: 'buildSpeed', pct: 30 },
    look: { skin: '#8a5a36', robe: '#efe6cf', accent: '#2a5c9a', headwear: 'nemes', bg: '#c9a46a' },
  },
  {
    id: 'amanirenas',
    name: 'Amanirenas',
    title: 'The One-Eyed Kandake',
    origin: 'Kingdom of Kush, 1st century BCE',
    story: 'Queen of Kush who led her armies against Rome and won a favourable peace treaty from Emperor Augustus.',
    era: 2,
    role: 'Archer',
    cost: 8,
    hp: 380,
    damage: 24,
    range: 5,
    speed: 2.0,
    bonus: { kind: 'defense', pct: 20 },
    look: { skin: '#4a2a17', robe: '#8c2f39', accent: '#e6c35c', headwear: 'crown', bg: '#6d2531' },
  },
  {
    id: 'ezana',
    name: 'Ezana of Aksum',
    title: 'King of Kings',
    origin: 'Aksum, 4th century',
    story: 'Ruler of Aksum, a great trading kingdom of the Red Sea whose giant carved stelae still stand in Ethiopia.',
    era: 2,
    role: 'Ruler',
    cost: 8,
    hp: 420,
    damage: 18,
    range: 1.2,
    speed: 2.0,
    bonus: { kind: 'production', res: 'stone', pct: 25 },
    look: { skin: '#6a4127', robe: '#f2ecdc', accent: '#c8a03a', headwear: 'crown', bg: '#4a5d8a' },
  },
  {
    id: 'nzinga',
    name: 'Nzinga Mbande',
    title: 'Queen of Ndongo and Matamba',
    origin: 'Ndongo & Matamba, 17th century',
    story: 'A brilliant diplomat and military leader who resisted Portuguese colonisation for decades.',
    era: 2,
    role: 'Warrior',
    cost: 10,
    hp: 480,
    damage: 32,
    range: 1.2,
    speed: 2.4,
    bonus: { kind: 'guards', pct: 30 },
    look: { skin: '#3f2414', robe: '#a2522e', accent: '#f0d27a', headwear: 'beads', bg: '#7b3b22' },
  },
  {
    id: 'mansamusa',
    name: 'Mansa Musa',
    title: 'Lord of Gold',
    origin: 'Mali Empire, 14th century',
    story: 'Ruler of Mali whose pilgrimage to Mecca carried so much gold that it changed prices in Cairo for years.',
    era: 3,
    role: 'Ruler',
    cost: 14,
    hp: 400,
    damage: 16,
    range: 1.2,
    speed: 1.9,
    bonus: { kind: 'production', res: 'gold', pct: 40 },
    look: { skin: '#4d2c18', robe: '#f2d36b', accent: '#7b4bb3', headwear: 'turban', bg: '#9b7a1d' },
  },
  {
    id: 'makeda',
    name: 'Makeda',
    title: 'Queen of Sheba',
    origin: 'Ethiopian tradition',
    story: 'Celebrated in the Kebra Nagast as the queen who journeyed to Jerusalem; Ethiopian tradition calls her mother of the Solomonic line.',
    era: 3,
    role: 'Ruler',
    cost: 14,
    hp: 380,
    damage: 18,
    range: 4,
    speed: 2.0,
    bonus: { kind: 'growth', pct: 40 },
    look: { skin: '#5c3720', robe: '#3c7a89', accent: '#e8c25a', headwear: 'wrap', bg: '#2f6170' },
  },
  {
    id: 'askia',
    name: 'Askia the Great',
    title: 'Restorer of Songhai',
    origin: 'Songhai Empire, 15th–16th century',
    story: 'Organised the Songhai Empire and made Timbuktu a centre of learning, with scholars and libraries of manuscripts.',
    era: 3,
    role: 'Sage',
    cost: 16,
    hp: 360,
    damage: 20,
    range: 4.5,
    speed: 1.9,
    bonus: { kind: 'production', res: 'iron', pct: 30 },
    look: { skin: '#40251a', robe: '#f4f1e8', accent: '#2c6e49', headwear: 'turban', bg: '#2c6e49' },
  },
  {
    id: 'yaa',
    name: 'Yaa Asantewaa',
    title: 'Queen Mother of Ejisu',
    origin: 'Asante, 1900',
    story: 'Led the War of the Golden Stool in 1900 to defend the sacred symbol of the Asante nation.',
    era: 4,
    role: 'Warrior',
    cost: 20,
    hp: 520,
    damage: 36,
    range: 4,
    speed: 2.1,
    bonus: { kind: 'defense', pct: 35 },
    look: { skin: '#3a2214', robe: '#e2a52b', accent: '#1f6b3a', headwear: 'wrap', bg: '#a8741a' },
  },
  {
    id: 'shaka',
    name: 'Shaka kaSenzangakhona',
    title: 'King of the Zulu',
    origin: 'Zulu Kingdom, 19th century',
    story: 'Reorganised the Zulu army with the short stabbing spear and the "horns of the buffalo" formation.',
    era: 4,
    role: 'Warrior',
    cost: 20,
    hp: 640,
    damage: 42,
    range: 1.1,
    speed: 2.6,
    bonus: { kind: 'guards', pct: 50 },
    look: { skin: '#3b2316', robe: '#d9cbb0', accent: '#2a2a2a', headwear: 'helm', bg: '#5a4632' },
  },
  {
    id: 'taytu',
    name: 'Taytu Betul',
    title: 'Light of Ethiopia',
    origin: 'Ethiopia, 19th century',
    story: 'Empress of Ethiopia and strategist at the Battle of Adwa (1896), where Ethiopia defeated an invading Italian army.',
    era: 4,
    role: 'Ruler',
    cost: 22,
    hp: 420,
    damage: 22,
    range: 4.5,
    speed: 2.0,
    bonus: { kind: 'production', res: 'water', pct: 30 },
    look: { skin: '#5a3520', robe: '#f3efe2', accent: '#1d4e89', headwear: 'braids', bg: '#1d4e89' },
  },
];

export const HERO_BY_ID: Record<string, HeroDef> = Object.fromEntries(HEROES.map((h) => [h.id, h]));

export function heroUpgradeCost(level: number) {
  return { legend: 2 + level, food: 80 * level * level };
}

export function heroStats(def: HeroDef, level: number) {
  const m = 1 + 0.2 * (level - 1);
  return { hp: Math.round(def.hp * m), damage: def.damage * m };
}

export function bonusText(b: HeroBonus): string {
  switch (b.kind) {
    case 'production':
      return `+${b.pct}% ${b.res} production`;
    case 'buildSpeed':
      return `+${b.pct}% build speed`;
    case 'defense':
      return `+${b.pct}% tower damage`;
    case 'wallHp':
      return `+${b.pct}% wall & building HP`;
    case 'guards':
      return `+${b.pct}% guard strength`;
    case 'growth':
      return `+${b.pct}% survivor arrivals`;
  }
}
