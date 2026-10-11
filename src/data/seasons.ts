import type { ResId } from './resources';

export interface SeasonDef {
  id: string;
  name: string;
  desc: string;
  /** Production multipliers; crops use `crop` instead of `food`. */
  mult: Partial<Record<ResId | 'crop', number>>;
  /** Ground tint applied to the terrain. */
  tint: number;
  weather: 'clear' | 'rain' | 'dust' | 'heat';
  /** Raid strength multiplier. */
  raid: number;
}

export const SEASONS: SeasonDef[] = [
  {
    id: 'longrains',
    name: 'Long Rains',
    desc: 'Rivers swell and fields turn green. Crops and wells thrive.',
    mult: { crop: 1.5, food: 1.15, water: 1.5 },
    tint: 0xd8f0c0,
    weather: 'rain',
    raid: 0.9,
  },
  {
    id: 'harvest',
    name: 'Harvest Moon',
    desc: 'Golden grass and full granaries. Raiders grow bold.',
    mult: { crop: 1.2, food: 1.1 },
    tint: 0xffefc8,
    weather: 'clear',
    raid: 1.15,
  },
  {
    id: 'harmattan',
    name: 'Harmattan',
    desc: 'A dry, dusty wind from the Sahara. Towers see less far; water is scarcer.',
    mult: { crop: 0.7, water: 0.8, wood: 1.1 },
    tint: 0xf4d8b0,
    weather: 'dust',
    raid: 1.1,
  },
  {
    id: 'dry',
    name: 'Dry Season',
    desc: 'The land cracks under the sun. Wells run low and crops wither.',
    mult: { crop: 0.5, food: 0.85, water: 0.6, stone: 1.15 },
    tint: 0xf8d49c,
    weather: 'heat',
    raid: 1.0,
  },
];

/** Real-time seconds in one in-game day. */
export const DAY_LENGTH = 240;
/** Fraction of the day that is night (at the end of the day). */
export const NIGHT_FRACTION = 0.25;
export const DAYS_PER_SEASON = 3;

export function seasonAt(time: number): SeasonDef {
  const day = Math.floor(time / DAY_LENGTH);
  return SEASONS[Math.floor(day / DAYS_PER_SEASON) % SEASONS.length];
}

export function dayAt(time: number): number {
  return Math.floor(time / DAY_LENGTH) + 1;
}

/** 0..1 progress through the current day. */
export function dayPhase(time: number): number {
  return (time % DAY_LENGTH) / DAY_LENGTH;
}

export function isNight(time: number): boolean {
  return dayPhase(time) >= 1 - NIGHT_FRACTION;
}
