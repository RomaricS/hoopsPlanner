import Phaser from 'phaser';

/**
 * Screen-space effects drawn above the world without camera zoom: day/night
 * grading, rain, Harmattan dust and night lights that must not be darkened.
 */
export class FxScene extends Phaser.Scene {
  overlay!: Phaser.GameObjects.Rectangle;
  rain!: Phaser.GameObjects.Particles.ParticleEmitter;
  dust!: Phaser.GameObjects.Particles.ParticleEmitter;
  private glows: Phaser.GameObjects.Image[] = [];

  constructor() {
    super('fx');
  }

  create() {
    this.overlay = this.add.rectangle(0, 0, 10, 10, 0xffffff).setOrigin(0).setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.rain = this.add.particles(0, 0, 'fx_rain', {
      x: { min: -200, max: 3000 },
      y: -40,
      lifespan: 1100,
      speedY: { min: 900, max: 1200 },
      speedX: -220,
      quantity: 5,
      frequency: 16,
      alpha: { min: 0.25, max: 0.55 },
      scaleY: { min: 0.5, max: 0.9 },
      emitting: false,
    });
    this.dust = this.add.particles(0, 0, 'fx_dust', {
      x: { min: -400, max: 0 },
      y: { min: 0, max: 2000 },
      lifespan: 7000,
      speedX: { min: 120, max: 260 },
      speedY: { min: -20, max: 20 },
      scale: { min: 3, max: 7 },
      alpha: { start: 0.3, end: 0 },
      frequency: 90,
      emitting: false,
    });
    this.scale.on('resize', () => this.layout());
    this.layout();
  }

  private layout() {
    const w = this.scale.width;
    const h = this.scale.height;
    this.overlay.setSize(w, h);
    (this.rain as any).ops.x.loadConfig({ x: { min: -200, max: w + 400 } });
    (this.dust as any).ops.y.loadConfig({ y: { min: 0, max: h } });
  }

  setGrade(color: number) {
    this.overlay.setFillStyle(color);
  }

  setWeather(rain: boolean, dust: boolean) {
    if (rain !== this.rain.emitting) rain ? this.rain.start() : this.rain.stop();
    if (dust !== this.dust.emitting) dust ? this.dust.start() : this.dust.stop();
  }

  /** Places additive glows at screen positions; scale is in screen pixels per glow texture. */
  setLights(list: { x: number; y: number; scale: number; alpha: number }[]) {
    while (this.glows.length < list.length) this.glows.push(this.add.image(0, 0, 'fx_glow').setBlendMode(Phaser.BlendModes.ADD));
    this.glows.forEach((img, i) => {
      const l = list[i];
      img.setVisible(!!l);
      if (l) img.setPosition(l.x, l.y).setScale(l.scale).setAlpha(l.alpha);
    });
  }
}
