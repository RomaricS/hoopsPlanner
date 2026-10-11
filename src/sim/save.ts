import { emptyRes, SAVE_VERSION, type GameState } from './state';

const KEY = 'sankofa.save.v1';

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    if (s.version !== SAVE_VERSION || !Array.isArray(s.terrain)) return null;
    // Fill fields added after the save was written.
    s.res = { ...emptyRes(), ...s.res };
    s.stats.gathered = { ...emptyRes(), ...s.stats.gathered };
    return s;
  } catch {
    return null;
  }
}

export function saveGame(state: GameState) {
  try {
    state.lastSeen = Date.now();
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage can be unavailable (private mode); the game still runs.
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
