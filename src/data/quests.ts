import type { GameState } from '../sim/state';
import type { ResBag } from './resources';

export interface QuestDef {
  id: string;
  title: string;
  hint: string;
  /** Returns [current, target]. */
  progress: (s: GameState) => [number, number];
  reward: ResBag & { legend?: number };
}

const built = (s: GameState, type: string) => s.buildings.filter((b) => b.type === type && b.level > 0).length;
const level = (s: GameState, type: string) => Math.max(0, ...s.buildings.filter((b) => b.type === type).map((b) => b.level));
const hq = (s: GameState) => level(s, 'hearth');

export const QUESTS: QuestDef[] = [
  { id: 'wood1', title: 'Gather 15 wood', hint: 'Tap an acacia tree near your fire.', progress: (s) => [s.stats.gathered.wood, 15], reward: { food: 10 } },
  { id: 'hut1', title: 'Build a Mud Hut', hint: 'Open Build and place a hut. Others will come to share your fire.', progress: (s) => [built(s, 'hut'), 1], reward: { wood: 15 } },
  { id: 'forager', title: "Build a Forager's Camp", hint: 'Survivors who work there gather food on their own.', progress: (s) => [built(s, 'forager'), 1], reward: { wood: 20 } },
  { id: 'stone1', title: 'Gather 10 stone', hint: 'Tap the granite boulders.', progress: (s) => [s.stats.gathered.stone, 10], reward: { wood: 10 } },
  { id: 'well', title: 'Dig a Well', hint: 'Everyone needs water — more so in the dry season.', progress: (s) => [built(s, 'well'), 1], reward: { food: 20 } },
  { id: 'pop4', title: 'Reach 4 survivors', hint: 'Huts give room; food and water make people stay.', progress: (s) => [s.pop, 4], reward: { wood: 30, legend: 1 } },
  { id: 'wood', title: "Build a Woodcutter's Lodge", hint: 'No more chopping by hand.', progress: (s) => [built(s, 'woodcutter'), 1], reward: { food: 30 } },
  { id: 'hq2', title: 'Upgrade the Hearth to level 2', hint: 'Tap the Hearth. A bigger fire unlocks walls, towers and more.', progress: (s) => [hq(s), 2], reward: { wood: 40, stone: 20 } },
  { id: 'tower', title: 'Build a Watchtower', hint: 'Raiders come at night. An archer on a tower will see them first.', progress: (s) => [built(s, 'watchtower'), 1], reward: { food: 40 } },
  { id: 'quarry', title: 'Build a Stone Quarry', hint: 'Stone will be needed for everything that lasts.', progress: (s) => [built(s, 'quarry'), 1], reward: { wood: 40 } },
  { id: 'raid1', title: 'Survive a raid', hint: 'Raids come on the night of day 3 and every second night after.', progress: (s) => [s.stats.raidsWon, 1], reward: { legend: 2, food: 50 } },
  { id: 'hq3', title: 'Upgrade the Hearth to level 3', hint: 'Unlocks the Griot Baobab, maize fields and the Warrior Lodge.', progress: (s) => [hq(s), 3], reward: { wood: 80, stone: 60 } },
  { id: 'griot', title: 'Plant the Griot Baobab', hint: 'Under the baobab, legends of Africa answer the call.', progress: (s) => [built(s, 'griot'), 1], reward: { legend: 2 } },
  { id: 'hero1', title: 'Summon your first legend', hint: 'Open Legends and summon a hero with legend tokens.', progress: (s) => [s.heroes.length, 1], reward: { food: 80, water: 60 } },
  { id: 'pop12', title: 'Reach 12 survivors', hint: 'A camp becomes a village.', progress: (s) => [s.pop, 12], reward: { wood: 120, legend: 2 } },
  { id: 'lodge', title: 'Train guards at a Warrior Lodge', hint: 'Assign survivors to the lodge; they fight at night.', progress: (s) => [built(s, 'lodge'), 1], reward: { stone: 100 } },
  { id: 'raid3', title: 'Repel 3 raids', hint: 'Walls slow raiders while towers shoot.', progress: (s) => [s.stats.raidsWon, 3], reward: { legend: 3 } },
  { id: 'hq4', title: 'Enter the Age of Iron', hint: 'Upgrade the Hearth to level 4.', progress: (s) => [hq(s), 4], reward: { legend: 3, wood: 200 } },
  { id: 'smelter', title: 'Build an Iron Smelter', hint: 'Iron for stronger walls and a greater Hearth.', progress: (s) => [built(s, 'smelter'), 1], reward: { food: 200 } },
  { id: 'kraal', title: 'Build a Cattle Kraal', hint: 'Cattle feed you even in the dry season.', progress: (s) => [built(s, 'kraal'), 1], reward: { water: 200 } },
  { id: 'pop25', title: 'Reach 25 survivors', hint: 'Your village is becoming a town.', progress: (s) => [s.pop, 25], reward: { legend: 4 } },
  { id: 'hq5', title: 'Upgrade the Hearth to level 5', hint: 'Unlocks stone walls in the style of Great Zimbabwe.', progress: (s) => [hq(s), 5], reward: { legend: 4, iron: 100 } },
  { id: 'heroes3', title: 'Gather 3 legends', hint: 'Every legend strengthens your people.', progress: (s) => [s.heroes.length, 3], reward: { legend: 5 } },
  { id: 'raid10', title: 'Repel 10 raids', hint: 'Every fifth raid brings something terrible.', progress: (s) => [s.stats.raidsWon, 10], reward: { legend: 8 } },
  { id: 'hq7', title: 'Enter the Age of Kingdoms', hint: 'Upgrade the Hearth to level 7.', progress: (s) => [hq(s), 7], reward: { legend: 10 } },
];
