export type DraftCard = {
  id: string;
  title: string;
  desc: string;
  kind: "character" | "guard" | "base";
};

export const DRAFT_POOL: DraftCard[] = [
  { id: "char-atk", title: "SHARP BLADES", desc: "+8 attack", kind: "character" },
  { id: "char-hp", title: "IRON HEART", desc: "+40 max HP, heal to full", kind: "character" },
  { id: "char-speed", title: "SWIFT BOOTS", desc: "+0.08 move speed", kind: "character" },
  { id: "char-crit", title: "DEADEYE", desc: "+3% crit chance", kind: "character" },
  { id: "char-skill", title: "ARCANE FOCUS", desc: "+8 skill power", kind: "character" },
  { id: "guard-dmg", title: "RALLY CRY", desc: "Guards deal +25% damage", kind: "guard" },
  { id: "guard-hp", title: "SHIELD WALL", desc: "Guards +30 max HP, healed", kind: "guard" },
  { id: "guard-ally", title: "NEW RECRUIT", desc: "+1 guard at the base (max 30)", kind: "guard" },
  { id: "base-repair", title: "REBUILD", desc: "Repair base +250 HP", kind: "base" },
  { id: "base-max", title: "FORTIFY", desc: "+100 max base HP", kind: "base" },
];

/** Pick N distinct cards (Fisher-Yates, injectable rand for tests). */
export function pickDraftCards(count = 3, rand: () => number = Math.random): DraftCard[] {
  const pool = [...DRAFT_POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}
