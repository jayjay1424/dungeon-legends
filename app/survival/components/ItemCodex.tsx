"use client";

import { useMemo, useState } from "react";
import { ITEM_DATABASE } from "../items/database";
import { ItemDefinition, ItemRarity, RARITY_COLORS } from "../items/types";
import styles from "./ItemCodex.module.css";

type Props = {
  discoveredIds: string[];
  ownedCounts: Record<string, number>;
  onClose: () => void;
};

const ALL_RARITIES: ItemRarity[] = [
  "Common",
  "Uncommon",
  "Rare",
  "Epic",
  "Legendary",
  "Mythic",
];

export default function ItemCodex({ discoveredIds, ownedCounts, onClose }: Props) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [rarity, setRarity] = useState("all");
  const [status, setStatus] = useState<"all" | "unlocked" | "locked">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const discovered = useMemo(() => new Set(discoveredIds), [discoveredIds]);

  const allItems = useMemo(() => Object.values(ITEM_DATABASE), []);

  const categories = useMemo(() => {
    const set = new Set(allItems.map((item) => item.category));
    return ["all", ...[...set].sort()];
  }, [allItems]);

  const isUnlocked = (id: string) => discovered.has(id) || (ownedCounts[id] ?? 0) > 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allItems.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      if (rarity !== "all" && item.rarity !== rarity) return false;
      const unlocked = isUnlocked(item.id);
      if (status === "unlocked" && !unlocked) return false;
      if (status === "locked" && unlocked) return false;
      if (q && !`${item.name} ${item.id}`.toLowerCase().includes(q)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allItems, category, rarity, status, search, discoveredIds, ownedCounts]);

  const unlockedCount = useMemo(
    () => allItems.filter((item) => isUnlocked(item.id)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allItems, discoveredIds, ownedCounts]
  );

  const selected: ItemDefinition | null = selectedId
    ? (ITEM_DATABASE[selectedId] ?? null)
    : null;
  const selectedUnlocked = selected ? isUnlocked(selected.id) : false;

  return (
    <div
      className={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className={styles.book}
        role="dialog"
        aria-modal="true"
        aria-label="Item collection book"
      >
        <div className={styles.scanlines} aria-hidden="true" />

        <div className={styles.header}>
          <h2 className={styles.title}>Item Book</h2>
          <span className={styles.progress}>
            {unlockedCount}/{allItems.length} found
          </span>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            Close
          </button>
        </div>

        <div
          className={styles.progressTrack}
          role="progressbar"
          aria-valuenow={unlockedCount}
          aria-valuemin={0}
          aria-valuemax={allItems.length}
          aria-label="Codex progress"
        >
          <div
            className={styles.progressFill}
            style={{
              width: `${allItems.length > 0 ? (unlockedCount / allItems.length) * 100 : 0}%`,
            }}
          />
        </div>

        <div className={styles.filters}>
          <input
            className={styles.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="SEARCH ITEMS..."
            aria-label="Search items"
          />
          <select
            className={styles.select}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Filter by category"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === "all" ? "ALL TYPES" : c.toUpperCase()}
              </option>
            ))}
          </select>
          <select
            className={styles.select}
            value={rarity}
            onChange={(e) => setRarity(e.target.value)}
            aria-label="Filter by rarity"
          >
            <option value="all">ALL RARITY</option>
            {ALL_RARITIES.map((r) => (
              <option key={r} value={r}>
                {r.toUpperCase()}
              </option>
            ))}
          </select>
          <select
            className={styles.select}
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            aria-label="Filter by unlock status"
          >
            <option value="all">ALL STATUS</option>
            <option value="unlocked">UNLOCKED</option>
            <option value="locked">LOCKED</option>
          </select>
        </div>

        <div className={styles.body}>
          <div className={styles.grid} role="list" aria-label="Items">
            {filtered.length === 0 ? (
              <p className={styles.empty}>No entries match filters</p>
            ) : (
              filtered.map((item) => {
                const unlocked = isUnlocked(item.id);
                const owned = ownedCounts[item.id] ?? 0;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="listitem"
                    onClick={() => unlocked && setSelectedId(item.id)}
                    disabled={!unlocked}
                    className={`${styles.cell} ${selectedId === item.id ? styles.cellSelected : ""} ${!unlocked ? styles.cellLocked : ""}`}
                    style={{ borderColor: unlocked ? RARITY_COLORS[item.rarity] : undefined }}
                    title={unlocked ? item.name : "??? (not discovered yet)"}
                    aria-label={unlocked ? `${item.name}, ${item.rarity}` : "Locked item, not discovered yet"}
                  >
                    <span className={styles.cellIcon} aria-hidden="true">
                      {unlocked ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.icon} alt="" draggable={false} />
                      ) : (
                        <span className={styles.lockedGlyph}>?</span>
                      )}
                    </span>
                    <span className={`${styles.cellName} ${unlocked ? styles.cellNameUnlocked : ""}`}>
                      {unlocked ? item.name : "???"}
                    </span>
                    <span className={styles.cellMeta}>
                      {unlocked ? (owned > 0 ? `x${owned}` : item.rarity) : "LOCKED"}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <aside className={styles.detail} aria-label="Item details" aria-live="polite">
            {!selected || !selectedUnlocked ? (
              <>
                <h3 className={styles.detailTitle}>
                  {selected && !selectedUnlocked ? "???" : "Select entry"}
                </h3>
                <p className={styles.detailDesc}>
                  {selected && !selectedUnlocked
                    ? "This entry is still locked. Find it in the wild, shop, craft, or hatch to unlock."
                    : "Pick an unlocked entry to inspect stats. Locked entries stay ??? until discovered."}
                </p>
                <p className={styles.detailFoot}>
                  Discovery saves automatically once you loot, buy, craft, or hatch an item.
                </p>
              </>
            ) : (
              <>
                <h3 className={styles.detailTitle}>{selected.name}</h3>
                <span
                  className={styles.detailRarity}
                  style={{ color: RARITY_COLORS[selected.rarity] }}
                >
                  {selected.rarity}
                </span>
                <p className={styles.detailDesc}>{selected.description}</p>
                {Object.keys(selected.stats ?? {}).length > 0 && (
                  <dl className={styles.detailStats}>
                    {Object.entries(selected.stats).map(([k, v]) => (
                      <div key={k} className={styles.detailStat}>
                        <dt>{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                <p className={styles.detailFoot}>
                  {selected.category} · LV {selected.levelRequirement} ·{" "}
                  {(ownedCounts[selected.id] ?? 0) > 0
                    ? `OWNED x${ownedCounts[selected.id]}`
                    : "DISCOVERED"}
                </p>
              </>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}
