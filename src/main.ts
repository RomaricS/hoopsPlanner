import '@fontsource/lilita-one';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import '@fontsource/nunito/900.css';
import './ui/style.css';
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { WorldScene } from './scenes/WorldScene';
import { FxScene } from './scenes/FxScene';
import { UI } from './ui/ui';
import { game } from './game';

const dpr = () => Math.min(2, window.devicePixelRatio || 1);
const size = () => ({ width: Math.round(window.innerWidth * dpr()), height: Math.round(window.innerHeight * dpr()) });

const phaser = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  ...size(),
  backgroundColor: '#1a0f08',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { antialias: true, roundPixels: false, powerPreference: 'high-performance' },
  input: { activePointers: 3 },
  scene: [BootScene, WorldScene, FxScene],
});

window.addEventListener('resize', () => {
  const s = size();
  phaser.scale.setGameSize(s.width, s.height);
});

const ui = new UI();
phaser.events.once('artReady', () => {
  const world = phaser.scene.getScene('world') as WorldScene;
  world.events.once('create', () => ui.attach(world));
});

// Console helpers for development and automated play-testing.
const cheats = {
  finishAll() {
    for (const b of game.state.buildings) if (b.construct) b.construct.end = game.state.time;
    game.update(0.001);
  },
  give(n = 1000) {
    for (const k of Object.keys(game.state.res)) (game.state.res as Record<string, number>)[k] += n;
    game.state.legend += 20;
    game.changed();
  },
  /** Jumps to a fraction of the given day (1-based). */
  goto(day: number, phase = 0.5) {
    game.state.time = (day - 1 + phase) * 240;
    game.update(0.001);
  },
};
if (import.meta.env.DEV) (window as unknown as { sankofa: unknown }).sankofa = { game, phaser, cheats };
