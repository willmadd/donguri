// Levels and unlockable Donguri accessories. Each accessory unlocks at its
// own `threshold` XP — several can share one threshold (e.g. the level-2
// set below), so a level's XP boundary is the *distinct* sorted set of
// thresholds (see LEVEL_THRESHOLDS), not one-per-accessory. Add another
// entry here (with a matching image in public/costumes/) to add a costume;
// give it a new threshold value to also add a new level.
export type AccessoryId =
  | "beard"
  | "mohawk"
  | "high-vis"
  | "unicycle"
  | "stilts"
  | "hair"
  | "flower"
  | "juggle"
  | "viking"
  | "dinosaur"
  | "shark"
  | "pirate";

export type Accessory = {
  id: AccessoryId;
  label: string;
  threshold: number;
  image: string;
};

export const ACCESSORIES: Accessory[] = [
  { id: "beard", label: "Beard", threshold: 10, image: "/costumes/beard.webp" },
  { id: "mohawk", label: "Mohawk", threshold: 10, image: "/costumes/mohawk.webp" },
  { id: "high-vis", label: "Hi-Vis Vest", threshold: 50, image: "/costumes/high-vis.webp" },
  { id: "unicycle", label: "Unicycle", threshold: 50, image: "/costumes/unicycle.webp" },
  { id: "stilts", label: "Stilts", threshold: 50, image: "/costumes/stilts.webp" },
  { id: "hair", label: "Flowing hair", threshold: 120, image: "/costumes/hair.webp" },
  { id: "flower", label: "Flower", threshold: 120, image: "/costumes/flower.webp" },
  { id: "juggle", label: "Juggle", threshold: 120, image: "/costumes/juggle.webp" },
  { id: "viking", label: "Viking", threshold: 120, image: "/costumes/viking.webp" },
  { id: "dinosaur", label: "Dinosaur", threshold: 250, image: "/costumes/dinosaur.webp" },
  { id: "shark", label: "Shark", threshold: 250, image: "/costumes/shark.webp" },
  { id: "pirate", label: "Pirate", threshold: 250, image: "/costumes/pirate.webp" },
];

const LEVEL_THRESHOLDS = [...new Set(ACCESSORIES.map((accessory) => accessory.threshold))].sort(
  (a, b) => a - b,
);

export function levelForXp(xp: number): number {
  let level = 0;
  for (const threshold of LEVEL_THRESHOLDS) {
    if (xp >= threshold) {
      level += 1;
    } else {
      break;
    }
  }
  return level;
}

// Inclusive lower bound / exclusive upper bound (null = no ceiling) of XP for
// a given level — e.g. level 1 is [10, 50).
export function xpRangeForLevel(level: number): { min: number; max: number | null } {
  const min = level <= 0 ? 0 : (LEVEL_THRESHOLDS[level - 1] ?? 0);
  const max = level < LEVEL_THRESHOLDS.length ? LEVEL_THRESHOLDS[level] : null;
  return { min, max };
}

export function isAccessoryId(value: string): value is AccessoryId {
  return ACCESSORIES.some((accessory) => accessory.id === value);
}

// XP is a float (the streak bonus awards half-points), but only ever lands
// on a whole number or a half — so this only ever needs zero or one decimal
// place, never "15.00" or similar.
export function formatXp(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

// The `donguri_config` column is a free-form JSON blob the user can also
// hand-edit as raw text from the profile page, so this only ever reads the
// two keys the accessory system owns and otherwise leaves the object alone
// — every write spreads the existing parsed value first so unrelated
// hand-edited keys survive.
export type DonguriConfig = {
  unlockedAccessories?: string[];
  equippedAccessory?: string | null;
  // Whether the outfit choice is currently open — set true by a level-up,
  // set false the moment the learner actually equips something (any pick,
  // including "None," counts). Absent (older data, before this existed)
  // reads as unlocked, matching "no explicit lock means not locked."
  canChooseOutfit?: boolean;
  [key: string]: unknown;
};

export function parseDonguriConfig(value: unknown): DonguriConfig {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as DonguriConfig)
    : {};
}
