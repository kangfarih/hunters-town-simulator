// Random hunter name generation. Pure data + one helper.
// Edit these lists to add flavor without touching simulation logic.

export const HUNTER_FIRST_NAMES = [
  'Arthur', 'Kaelen', 'Valkor', 'Lyra', 'Seraphina', 'Garrick', 'Rowan',
  'Eldrin', 'Draven', 'Zephyr', 'Aria', 'Morrigan', 'Boran', 'Kallum',
  'Thorin', 'Ember', 'Ignis', 'Sylvia', 'Vance', 'Cassian'
];

export const HUNTER_TITLES = [
  'the Brave', 'Stormcaller', 'Ironclad', 'Shadowstrike', 'Lightbringer',
  'Flameheart', 'Swiftwind', 'Dragonbane', 'Oathkeeper', 'Gloomstalker'
];

/** `Firstname Title` — mirrors the inline summon logic. */
export function makeHunterName(): string {
  const firstName = HUNTER_FIRST_NAMES[Math.floor(Math.random() * HUNTER_FIRST_NAMES.length)];
  const title = HUNTER_TITLES[Math.floor(Math.random() * HUNTER_TITLES.length)];
  return `${firstName} ${title}`;
}
