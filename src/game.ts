import { QUESTS } from './data/quests';
import type { ResBag, ResId } from './data/resources';
import * as eco from './sim/economy';
import { loadGame, saveGame, clearSave } from './sim/save';
import { newGame, type GameState } from './sim/state';

type Listener = (...args: any[]) => void;

/** Tiny typed-enough event bus shared by the scene and the DOM UI. */
export class Bus {
  private map = new Map<string, Set<Listener>>();
  on(ev: string, fn: Listener) {
    if (!this.map.has(ev)) this.map.set(ev, new Set());
    this.map.get(ev)!.add(fn);
    return () => this.map.get(ev)?.delete(fn);
  }
  emit(ev: string, ...args: unknown[]) {
    this.map.get(ev)?.forEach((fn) => fn(...args));
  }
}

export interface OfflineReport {
  elapsed: number;
  gained: ResBag;
  arrivals: number;
  built: number;
}

/**
 * Owns the game state, runs the economy every frame, saves, and is the single
 * entry point for player actions coming from the scene or the UI.
 */
export class Game {
  state: GameState;
  bus = new Bus();
  offline: OfflineReport | null = null;
  /** True while a raid is being fought in the world scene. */
  raidActive = false;
  /** Simulation speed multiplier (dev/testing only). */
  speed = 1;
  private saveTimer = 0;
  private uiTimer = 0;

  constructor() {
    const loaded = loadGame();
    if (loaded) {
      this.state = loaded;
      const away = (Date.now() - loaded.lastSeen) / 1000;
      if (away > 60) {
        const r = eco.catchUp(this.state, away);
        if (r.elapsed > 60) this.offline = r;
      }
    } else {
      this.state = newGame();
    }
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.save();
      else this.resumeFromBackground();
    });
    window.addEventListener('pagehide', () => this.save());
  }

  private resumeFromBackground() {
    const away = (Date.now() - this.state.lastSeen) / 1000;
    if (away > 60 && !this.raidActive) {
      const r = eco.catchUp(this.state, away);
      this.offline = r;
      this.bus.emit('offline', r);
      this.bus.emit('rebuild');
    }
    this.state.lastSeen = Date.now();
  }

  update(dt: number) {
    const events = eco.tick(this.state, dt);
    for (const e of events) this.bus.emit(e.type, e);
    this.saveTimer += dt;
    if (this.saveTimer > 10) {
      this.saveTimer = 0;
      this.save();
    }
    this.uiTimer += dt;
    if (this.uiTimer > 0.25 || events.length) {
      this.uiTimer = 0;
      this.bus.emit('changed');
    }
  }

  save() {
    saveGame(this.state);
  }

  reset() {
    clearSave();
    this.state = newGame();
    this.bus.emit('rebuild');
    this.bus.emit('changed');
  }

  changed() {
    this.bus.emit('changed');
  }

  toast(text: string, kind: 'info' | 'warn' | 'good' = 'info') {
    this.bus.emit('toast', text, kind);
  }

  // ------------------------------------------------------------ quests

  currentQuest() {
    return QUESTS[this.state.quest];
  }

  questDone(): boolean {
    const q = this.currentQuest();
    if (!q) return false;
    const [cur, target] = q.progress(this.state);
    return cur >= target;
  }

  claimQuest() {
    const q = this.currentQuest();
    if (!q || !this.questDone()) return;
    const { legend, ...res } = q.reward;
    eco.addRes(this.state, res as ResBag);
    if (legend) this.state.legend += legend;
    this.state.quest++;
    this.bus.emit('questClaimed', q);
    this.changed();
  }

  // ------------------------------------------------------------ actions

  place(type: string, x: number, y: number) {
    const r = eco.placeBuilding(this.state, type, x, y);
    if ('uid' in r) {
      this.bus.emit('placed', r);
      this.changed();
      return r;
    }
    this.toast(r.reason, 'warn');
    return null;
  }

  upgrade(uid: number) {
    const r = eco.startUpgrade(this.state, uid);
    if (!r.ok) this.toast(r.reason, 'warn');
    else this.bus.emit('upgradeStarted', uid);
    this.changed();
    return r.ok;
  }

  rush(uid: number) {
    if (!eco.rush(this.state, uid)) this.toast('Not enough legend tokens', 'warn');
    this.changed();
  }

  setWorkers(uid: number, n: number) {
    eco.setWorkers(this.state, uid, n);
    this.bus.emit('workers', uid);
    this.changed();
  }

  move(uid: number, x: number, y: number) {
    const r = eco.moveBuilding(this.state, uid, x, y);
    if (!r.ok) this.toast(r.reason, 'warn');
    else this.bus.emit('moved', uid);
    this.changed();
    return r.ok;
  }

  demolish(uid: number) {
    eco.demolish(this.state, uid);
    this.bus.emit('removed', uid);
    this.changed();
  }

  gather(nodeUid: number): { res: ResId; amount: number } | null {
    const r = eco.gather(this.state, nodeUid);
    this.changed();
    return r;
  }

  summon(id: string) {
    const r = eco.summonHero(this.state, id);
    if (!r.ok) this.toast(r.reason, 'warn');
    else {
      this.bus.emit('heroSummoned', id);
      this.save();
    }
    this.changed();
    return r.ok;
  }

  upgradeHero(id: string) {
    const r = eco.upgradeHero(this.state, id);
    if (!r.ok) this.toast(r.reason, 'warn');
    this.changed();
    return r.ok;
  }
}

export const game = new Game();
