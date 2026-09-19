# Hunters Town — Idle Isometric RPG

An autonomous 16-bit isometric idle RPG. Heroes auto-summon, form parties, hunt monsters, cast animated skills, sell loot to NPC stores, and auto-upgrade. The player acts as an **Omniscience Spectator** — observe, inspect, fast-forward, tune the world.

> No direct control. No clicks-to-attack. You watch the town live.

## Omniscience Mode

* Live town economy: `townGold`, kill count, hunter cap, summon timer
* Speed controls: pause / 1x / 2x / 4x, rush-summon portal
* Camera: follow hunter / building, zoom 0.5x–2.5x, jump to Town / Forest / Graveyard / Volcano
* Inspectors: hero character sheet + party, building services + visitors + material stock
* Drawers: hunter roster (bottom-left), chronicle event log (bottom-right)
* World Config menu: difficulty, population, auto-director, agent AI knobs, full reset
* Autosave to `localStorage` every 5s + on tab hide/close. Reload resumes the same town.

## Gameplay Loop

1. Summon Portal spawns a hero every 30s (up to town cap).
2. Hunter registers at Sanctuary Hall, wanders town, looks for party.
3. Party (up to 5, leader level ±4, same preferred zone) travels to hunt.
4. Fight → loot (materials + gear drops) → return to town.
5. Sell loot at Merchant Bazaar → buy gear at Vulcan Forge → learn skills at Valor Academy → brew at Elixir Cauldron → rest at Tavern / heal at Clinic.
6. Buildings gain EXP per transaction, level 1–10, unlock tiers and bonuses.
7. Evil Lich Lord boss spawns in the Volcanic Crater roughly every 90–110s. Drops Tier-5 epics.

## Hunters

5 classes: `Berserker` / `Ranger` / `Sorcerer` / `Paladin` / `Cleric`

14 autonomous states:

`SPAWNING` → `REGISTERING` → `WANDERING_TOWN` → `LOOKING_FOR_PARTY` → `TRAVELING_TO_HUNT` → `HUNTING` / `FIGHTING` → `RETURNING_TO_TOWN` → `SELLING_LOOT` / `UPGRADING_GEAR` / `LEARNING_SKILL` / `BREWING_ELIXIR` / `RECOVERING_CLINIC` / `RESTING_TAVERN`

* Level / EXP, HP, ATK / DEF, mood, needs (hunger, fatigue, wounds)
* 7 skill VFX types: `slash`, `multishot`, `meteor`, `smite`, `whirlwind`, `holy_burst`, `heal` — with cooldowns, mastery levels
* Equipment slots: weapon / armor / accessory, tiers 1–5, rarities `Common` → `Epic`
* 8 epic-only effects: execution, deadeye, meteorfall, bossbane, lifesteal, swiftwind, focus, martyr
* Materials pipeline: `bone`, `pelt`, `horn`, `fang`, `magic_orb`, `dragon_scale`

## Buildings (7)

| Building | Service | Upgrade Effect |
|---|---|---|
| Sanctuary Hall | Town Governance | +2 hunter slots, +tax rate |
| Vulcan Forge | Weapon & Armor Crafting | Unlocks higher gear tiers |
| Elixir Cauldron | Potion Dispensing | Stronger instant-heal potions |
| Boar & Barrel Tavern | Food & Lodging | Morale ATK buff |
| Valor Academy | Skill Mastery | New masteries, -cooldowns |
| Merchant Bazaar | Loot Exchange | +15% sell price / level |
| Mercy Clinic | Emergency Healing | Faster wound recovery |

All buildings: level 1–10, EXP per transaction, visitor tracking, lifetime gold.

## World Zones

* Town center (grid ~20–38): roads, gates, summon portal at (29,22)
* Whispering Forest (E, 42–54 / 22–36): slimes, goblins, wolves — bands 1–5
* Gloomy Graveyard (S, 22–36 / 42–54): skeletons, ghouls, wights — bands 6–10
* Volcanic Ruins / Crater (SE, 42–56 / 42–56): drakes, golems, Evil Lich Lord — bands 11–15
* Gates: East Town Gate (38,30), South Gate (30,39). A* pathfinding with reservations.

## Tech Stack

* React 19 + TypeScript + Vite 8 (dev on `:3000`, host `0.0.0.0`)
* PixiJS 8 isometric renderer, procedural pixel-art textures
* Tailwind CSS 4, lucide-react icons, motion
* Custom simulation engine (`src/game/simulation.ts`), no backend
* Web Audio chiptune synth (`src/game/audioSynth.ts`), mutable

## Project Structure

```
src/
  App.tsx — spectator shell, tick sync, autosave, camera actions
  types.ts — Hunter, Monster, Building, Equipment, Skill, loot types
  components/
    GameCanvas.tsx — Pixi mount + picking
    OmniscienceHeader.tsx — gold / kills / summon / speed / zone jumps
    HeroInspector.tsx — character sheet + party
    BuildingInspector.tsx — services + visitors + stock
    HunterRosterDrawer.tsx — active hunters
    ChronicleLogDrawer.tsx — live event log
    WorldConfigMenu.tsx — difficulty / AI tuning / reset
  game/
    simulation.ts — authoritative tick, parties, economy, boss, save/load
    pixiRenderer.ts — iso tiles, sprites, VFX, floating text, camera
    isometric.ts — projection + facing
    pathfinding.ts — A* grid + gates
    pixelArtTextures.ts — procedural 16-bit tiles/sprites
    audioSynth.ts — coin / slash / skill / boss SFX
```

## Run Locally

Prerequisites: Node.js

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

No API keys required. If a `.env.local` / `GEMINI_API_KEY` reference remains from scaffolding, it is unused and can be ignored.

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev, port 3000 |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build |
| `npm run lint` | `tsc --noEmit` typecheck |

## World Tuning

`WorldConfigMenu` (gear icon, bottom bar) edits live simulation:

* Difficulty 1–10, monster population, auto-director on/off
* Retreat HP %, danger hits, gray-level gap, hunt drive, tavern mood, parties enabled
* Reset World: clears `hunters-town-save-v1` (legacy `evil-hunter-tycoon-save-v1` migrated) and reloads

Save keys: `hunters-town-save-v1` (v3, auto-migrates legacy + grid shift).

## Controls

* Click hunter / building: inspect + follow camera. Click again / X: unfollow.
* Bottom bar: zoom in/out, reset camera (center town 29,29), world config, spectator guide.
* Header: pause, speed, rush summon, zone jumps, mute, gold / slain counters.

