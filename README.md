# Sankofa

*Sankofa* is an Akan word meaning "go back and fetch it": learn from the past to build the future.

An offline, landscape, isometric survival city-builder for mobile. You start as a lone survivor with a fire on the savanna, gather by hand, raise huts, and survivors find their way to you. Buildings put them to work so food, water, wood and stone flow in on their own, even while the app is closed. Grow from camp to village to kingdom across four ages, summon legends from Africa's history, and hold out against night raids, wild beasts and folklore bosses while the seasons turn.

No PvP, no accounts, no server. Everything runs and saves on the device.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173 (also on your LAN, so you can open it on a phone)
npm test           # economy / simulation tests
npm run build      # production build in dist/
```

Open the dev URL on a phone in landscape and use "Add to Home Screen" to play it fullscreen as a web app.

### Native Android / iOS builds (Capacitor)

The project is already configured for [Capacitor](https://capacitorjs.com). On a machine with Android Studio (or Xcode):

```bash
npm run build
npx cap add android      # or: npx cap add ios
npx cap sync
npx cap open android     # build / run from Android Studio
```

To lock the app to landscape, set `android:screenOrientation="sensorLandscape"` on the activity in `android/app/src/main/AndroidManifest.xml` (on iOS, untick the portrait orientations in Xcode).

## How to play

- **Tap** trees, bushes and boulders: your chief walks over and gathers wood, food or stone.
- **Build** opens the build menu. Drag or tap to position, then confirm with ✓. Walls keep chaining so you can draw a line of them.
- **Tap a building** to see what it does, add or remove workers, upgrade it, or move it.
- **The Hearth** is your town hall. Upgrading it unlocks buildings, grows your territory, adds builders and opens new ages.
- **Survivors** arrive while you have free housing plus food and water. New arrivals go to the most vital empty job automatically.
- **Seasons** last three days each: Long Rains, Harvest Moon, Harmattan, Dry Season. They change crop, water and wood output and raid strength.
- **Raids** come at nightfall on day 3 and then every second night. Watchtowers shoot, guards from the Warrior Lodge and your legends fight, and villagers hide in the hearth. Win for legend tokens; if raiders survive until dawn they steal part of your stores. Every fifth raid brings a boss.
- **Legends** are summoned at the Griot Baobab with legend tokens from raids and quests. Each one fights at night and gives a permanent bonus.
- **Offline progress**: production, construction and arrivals keep running for up to 8 hours while you are away (raids don't).

## Project layout

```
src/
  data/       buildings, heroes, enemies, seasons, eras, quests, resources (all game content)
  sim/        pure simulation: state, world generation, economy tick, saving (no Phaser; unit-tested)
  art/        every texture is painted in code on <canvas> at boot (buildings, terrain, units, icons)
  world/      iso math and the Unit class
  scenes/     Phaser scenes: Boot (textures), World (map, input, raids), Fx (lighting, weather)
  ui/         DOM interface (HUD, build menu, panels, modals) and its CSS
  game.ts     game controller: state owner, event bus, player actions
public/assets/kenney/   CC0 farm props from Kenney (maize, hay, sacks, fences)
tests/        Vitest tests for the simulation
```

Content is data-driven: adding a building means adding an entry to `src/data/buildings.ts` and a painter in `src/art/buildings.ts`; heroes, enemies, seasons and quests work the same way.

### Dev helpers

`art.html` (at `/art.html` on the dev server) lays out every generated texture for review. In dev builds the console exposes `sankofa.cheats` (`give()`, `finishAll()`, `goto(day, phase)`) and `sankofa.game.speed`.

## Credits

- Farm props: [Kenney](https://kenney.nl), *Isometric Miniature Farm* (CC0).
- Fonts: Lilita One and Nunito (SIL Open Font License), via Fontsource.
- Everything else (buildings, terrain, characters, animals, effects, icons and portraits) is drawn procedurally in `src/art/`.
- Heroes are inspired by real historical figures; their cards carry short factual summaries.
