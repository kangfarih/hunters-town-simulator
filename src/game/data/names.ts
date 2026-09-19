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

/** `Firstname Title` — unique against `taken` (live roster or save).
 * Retries random combos, then falls back to a numbered suffix (`Name II`,
 * `Name III`, …) so summons never duplicate even once the pool is exhausted. */
export function makeHunterName(taken?: Iterable<string>): string {
  const used = new Set<string>();
  if (taken) {
    for (const n of taken) {
      if (typeof n === 'string' && n.trim()) used.add(n.trim());
    }
  }
  const poolSize = HUNTER_FIRST_NAMES.length * HUNTER_TITLES.length;
  // Random sampling: enough attempts to find a free combo when one exists.
  const attempts = Math.max(20, Math.min(poolSize * 2, 200 + used.size * 2));
  for (let i = 0; i < attempts; i++) {
    const firstName = HUNTER_FIRST_NAMES[Math.floor(Math.random() * HUNTER_FIRST_NAMES.length)];
    const title = HUNTER_TITLES[Math.floor(Math.random() * HUNTER_TITLES.length)];
    const candidate = `${firstName} ${title}`;
    if (!used.has(candidate)) return candidate;
  }
  // Pool exhausted (or unlucky): derive from a random base + numeral suffix.
  const firstName = HUNTER_FIRST_NAMES[Math.floor(Math.random() * HUNTER_FIRST_NAMES.length)];
  const title = HUNTER_TITLES[Math.floor(Math.random() * HUNTER_TITLES.length)];
  const base = `${firstName} ${title}`;
  if (!used.has(base)) return base;
  const numerals = ['II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  for (const n of numerals) {
    if (!used.has(`${base} ${n}`)) return `${base} ${n}`;
  }
  let i = 11;
  while (used.has(`${base} ${i}`)) i++;
  return `${base} ${i}`;
}
