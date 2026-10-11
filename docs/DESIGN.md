# Sankofa design notes

## Pillars

1. **The ad, for real.** The fantasy those mobile ads sell: start alone, gather by hand, recruit, expand, defend against waves. No bait-and-switch into a different game.
2. **Idle once established.** Manual gathering is only for the first minutes. Buildings with workers automate every resource, and progress continues offline.
3. **Africa across the ages.** The savanna, the Iron Age of Nok, the trading kingdoms (Aksum, Mali, Songhai), and the stone cities (Great Zimbabwe). Architecture, crafts and heroes come from real history; enemies are raiders, wild beasts and folklore creatures, never real peoples.
4. **Survival pressure without punishment.** Raids, seasons and hunger create tension, but losing a raid costs stores, not your village.

## Core loops

| Loop | Time scale | What happens |
| --- | --- | --- |
| Tap | seconds | Chief gathers from trees, bushes, boulders |
| Build | 5 s – minutes | Place and upgrade buildings with limited builders |
| Day | 4 minutes | Production ticks; 3 min day, 1 min night |
| Raid | every 2nd night from day 3 | Defend with towers, walls, guards and heroes |
| Season | 3 days | Long Rains → Harvest → Harmattan → Dry, each shifting production and raids |
| Age | Hearth levels 1 / 4 / 7 / 10 | New buildings, resources and legends |

## Economy

- Resources: food, water, wood, stone (age 1), iron (age 2), gold (age 3). Legend tokens are the hero currency.
- Survivors eat 0.6 food and drink 0.5 water per minute. A shortage halves all production and stops arrivals.
- Producers: rate × workers × (1 + 25% per level) × season × hero bonus.
- One shared storage cap (100 + Hearth and Granary levels); upgrades become the gate.
- Building levels are capped by the Hearth level, as in Clash of Clans.

## Raids

Composition grows with raid number (`waveComposition`). Stats scale by `waveStrength` and the season. Enemy roles:

- **Beasts** (hyena, jackal, lion) go for the nearest thing.
- **Dust Raiders** prefer stores and producers; **slingers** target defenses from range.
- **Bosses** every fifth raid: Raider Warlord, **Impundulu** the lightning bird (flies over walls), **Ninki Nanka** the swamp dragon.

Walls block walkers, who attack whatever is in their way.

## Roadmap

- **Next:** sound and music (kora, djembe, ambient savanna), tutorial pointers, a tap-to-collect bonus, building info tooltips, balance pass with a bot playthrough.
- **Age of Iron content:** forge (tower damage), iron-tipped spears for guards, clay pottery, river fishing docks.
- **Age of Kingdoms:** market and trade caravans (salt ↔ gold), Sudano-Sahelian architecture tier, scholars and a library (research tree), city walls.
- **Age of Empires:** Great Zimbabwe stone enclosures, a monument wonder, multi-district map expansion.
- **Systems:** expeditions beyond the territory (idle missions with heroes), random events (locust swarm, drought, river flood, wandering trader), hero skills and gear, achievements, cloud-free save export/import.
- **Platform:** Capacitor Android/iOS builds, haptics, notifications for finished upgrades and raids.
