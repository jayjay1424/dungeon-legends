"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "../survival/survival.module.css";
import InfiniteArena, {
  ArenaHandle,
  SKILL_MANA_COSTS,
} from "../survival/InfiniteArena";
import type { Stats as ArenaStats, SkillCooldowns } from "../survival/arena/types";
import { applyEquipmentStats } from "../survival/items/statSystem";
import { EquipmentState } from "../survival/items/equipmentSystem";
import { InventoryEntry, ItemRarity } from "../survival/items/types";
import { loadItemSave, saveItemData } from "../survival/items/persistence";
import { addItem } from "../survival/items/inventorySystem";
import { ItemIcon } from "../survival/items/ItemIcon";
import { loadDiscoveredIds, saveDiscoveredIds } from "../survival/items/codex";
import ItemCodex from "../survival/components/ItemCodex";
import HowToPlay from "../survival/components/HowToPlay";
import {
  BASE_MAX_HP,
  DEFENCE_WAVES,
  INTERMISSION_MS,
  MILESTONE_BONUS_GOLD,
  waveFor,
} from "./waves";
import { DraftCard, pickDraftCards } from "./draft";
import { buffGuardDamage, buffGuardMaxHp, resetGuardBuffs } from "../survival/arena/warriors";
import { startCombatMusic, stopCombatMusic } from "../survival/audio";

type Phase = "ready" | "story" | "intermission" | "wave" | "draft" | "defeat";

const BASE_RUN: ArenaStats = {
  hp: 100,
  maxHp: 100,
  mana: 50,
  maxMana: 50,
  level: 1,
  xp: 0,
  xpToNext: 1,
  skillPoints: 0,
  power: 12,
  speed: 1,
  gold: 100,
  wave: 1,
  attack: 10,
  defense: 5,
  critChance: 5,
  critDamage: 150,
  moveSpeed: 1,
  attackSpeed: 1,
  skillPower: 10,
  armor: 0,
  luck: 1,
};

const panelStyle: React.CSSProperties = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  zIndex: 90,
  width: "min(420px, 90vw)",
  padding: "28px 24px",
  backgroundColor: "rgba(24, 20, 37, 0.97)",
  border: "4px solid #3a3f58",
  outline: "4px solid #000",
  textAlign: "center",
  fontFamily: 'var(--font-pixel), "Press Start 2P", monospace',
};

export default function DefencePage() {
  const router = useRouter();
  const arenaRef = useRef<ArenaHandle>(null);

  // Shared save: gear earned in Survival carries into Defence.
  const [snapshot] = useState(() =>
    loadItemSave({ inventory: [], equipment: {}, gold: 100 })
  );
  const inventory: InventoryEntry[] = snapshot.inventory;
  const equipment = snapshot.equipment as EquipmentState;

  const [run, setRun] = useState<ArenaStats>({ ...BASE_RUN, gold: snapshot.gold });
  const [baseHp, setBaseHp] = useState(BASE_MAX_HP);
  const [baseMax, setBaseMax] = useState(BASE_MAX_HP);
  const [phase, setPhase] = useState<Phase>("ready");
  const [waveIndex, setWaveIndex] = useState(0);
  const [draftCards, setDraftCards] = useState<DraftCard[]>([]);
  const storyActiveRef = useRef(false);
  // Wave music runs the whole run, stops only when the base falls.
  const musicPlayingRef = useRef(false);

  // Fresh buffs every mount (module singletons would leak across runs).
  useEffect(() => {
    resetGuardBuffs();
  }, []);
  const [countdown, setCountdown] = useState(INTERMISSION_MS / 1000);
  const [message, setMessage] = useState("");
  const [stunActive, setStunActive] = useState(false);
  const [codexOpen, setCodexOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [discoveredIds, setDiscoveredIds] = useState<string[]>([]);
  const [spoils, setSpoils] = useState<{ id: string; name: string; icon: string; rarity: ItemRarity; amount: number; sellPrice?: number }[]>([]);
  const [spoilsOpen, setSpoilsOpen] = useState(false);
  const baseToastAt = useRef(0);

  const combined = useMemo(
    () => applyEquipmentStats(run, equipment),
    [run, equipment]
  );
  const ownedCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const entry of inventory) {
      if (!entry?.id) continue;
      counts[entry.id] = (counts[entry.id] ?? 0) + (entry.amount || 0);
    }
    for (const slot of Object.values(equipment)) {
      if (!slot?.id) continue;
      counts[slot.id] = (counts[slot.id] ?? 0) + 1;
    }
    return counts;
  }, [inventory, equipment]);

  // Codex discovery is shared across modes.
  useEffect(() => {
    setDiscoveredIds(loadDiscoveredIds());
  }, []);
  useEffect(() => {
    saveDiscoveredIds(discoveredIds);
  }, [discoveredIds]);

  // Persist gold rewards back to the shared save.
  useEffect(() => {
    saveItemData({ inventory, equipment, gold: run.gold });
  }, [run.gold, inventory, equipment]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 2200);
    return () => window.clearTimeout(timer);
  }, [message]);

  // Skill cooldown countdowns (attack never shows one).
  const [cooldowns, setCooldowns] = useState<SkillCooldowns>({
    spin: { remainingMs: 0, totalMs: 1, locked: false, unlockLevel: 20 },
    dodge: { remainingMs: 0, totalMs: 1, locked: false, unlockLevel: 5 },
    clones: { remainingMs: 0, totalMs: 1, locked: false, unlockLevel: 10 },
    flash: { remainingMs: 0, totalMs: 1, locked: false, unlockLevel: 25 },
  });
  const cooldownsRef = useRef(cooldowns);
  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = arenaRef.current?.getCooldowns();
      if (!next) return;
      const prev = cooldownsRef.current;
      if (
        prev.spin.remainingMs !== next.spin.remainingMs ||
        prev.dodge.remainingMs !== next.dodge.remainingMs ||
        prev.clones.remainingMs !== next.clones.remainingMs ||
        prev.flash.remainingMs !== next.flash.remainingMs
      ) {
        cooldownsRef.current = next;
        setCooldowns(next);
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, []);

  // Escape closes dialogs.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "escape") return;
      setCodexOpen(false);
      setHelpOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const startWave = (index: number) => {
    const wave = waveFor(DEFENCE_WAVES[index]?.no ?? index + 1);
    if (!wave) return;
    storyActiveRef.current = false;
    // Re-form the shield wall every wave — stragglers walk back to post.
    arenaRef.current?.formRanks?.();
    arenaRef.current?.spawnDefenceWave?.(wave.groups, wave.no);
    setWaveIndex(index);
    setPhase("wave");
    if (!musicPlayingRef.current) {
      musicPlayingRef.current = true;
      startCombatMusic();
    }
    setMessage(`WAVE ${wave.no} — DEFEND THE BASE!`);
  };

  // Intro story: 5 heralds ride in from afar to warn the base.
  const beginStory = () => {
    storyActiveRef.current = true;
    setPhase("story");
    setMessage("RIDERS FROM THE FAR LANES…");
    arenaRef.current?.beginWarningRun?.();
  };

  const skipStory = () => {
    storyActiveRef.current = false;
    const converted = arenaRef.current?.skipWarning?.() ?? 0;
    setMessage(
      converted > 0
        ? `${converted} VILLAGERS TAKE UP ARMS!`
        : "THE HORDE COMES!"
    );
    startWave(0);
  };

  // Intermission countdown → auto-start.
  useEffect(() => {
    if (phase !== "intermission") return;
    setCountdown(INTERMISSION_MS / 1000);
    const timer = window.setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          window.clearInterval(timer);
          startWave(waveIndex + 1);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Wave-cleared detection.
  useEffect(() => {
    if (phase !== "wave") return;
    const timer = window.setInterval(() => {
      if ((arenaRef.current?.getHostileCount?.() ?? 1) > 0) return;
      window.clearInterval(timer);
      const wave = waveFor(DEFENCE_WAVES[waveIndex]?.no ?? waveIndex + 1);
      const reward = wave?.rewardGold ?? 0;
      setRun((prev) => ({
        ...prev,
        gold: prev.gold + reward,
        hp: prev.maxHp,
        mana: prev.maxMana,
      }));
      if (wave.no % 10 === 0) {
        // Milestone: bonus gold + draft 1 of 3 upgrade cards.
        setRun((prev) => ({ ...prev, gold: prev.gold + MILESTONE_BONUS_GOLD }));
        setDraftCards(pickDraftCards(3));
        setMessage(`WAVE ${wave.no} HELD! +${reward + MILESTONE_BONUS_GOLD}G — CHOOSE AN UPGRADE`);
        setPhase("draft");
      } else {
        setMessage(`WAVE ${wave?.no} CLEARED! +${reward}G — HEALED`);
        setPhase("intermission");
      }
    }, 500);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, waveIndex]);

  // Defeat when the base falls (endless — no final victory).
  useEffect(() => {
    if (baseHp <= 0 && phase !== "defeat") {
      storyActiveRef.current = false;
      musicPlayingRef.current = false;
      stopCombatMusic();
      setPhase("defeat");
    }
  }, [baseHp, phase]);

  const applyDraft = (card: DraftCard) => {
    switch (card.id) {
      case "char-atk":
        setRun((prev) => ({ ...prev, attack: prev.attack + 8 }));
        break;
      case "char-hp":
        setRun((prev) => ({ ...prev, maxHp: prev.maxHp + 40, hp: prev.maxHp + 40 }));
        break;
      case "char-speed":
        setRun((prev) => ({ ...prev, moveSpeed: prev.moveSpeed + 0.08 }));
        break;
      case "char-crit":
        setRun((prev) => ({ ...prev, critChance: prev.critChance + 3 }));
        break;
      case "char-skill":
        setRun((prev) => ({ ...prev, skillPower: prev.skillPower + 8 }));
        break;
      case "guard-dmg":
        buffGuardDamage(0.25);
        break;
      case "guard-hp":
        buffGuardMaxHp(30);
        arenaRef.current?.reinforceGuards?.(30);
        break;
      case "guard-ally": {
        const added = arenaRef.current?.addGuardAlly?.() ?? false;
        if (!added) {
          setMessage("GUARD RANKS FULL (30)");
          return;
        }
        break;
      }
      case "base-repair":
        setBaseHp((prev) => Math.min(baseMax + 250, prev + 250));
        break;
      case "base-max":
        setBaseMax((prev) => prev + 100);
        setBaseHp((prev) => prev + 100);
        break;
    }
    setMessage(`DRAFTED ${card.title}!`);
    setPhase("intermission");
  };

  const handleBaseHit = (dmg: number) => {
    setBaseHp((prev) => Math.max(0, prev - dmg));
    const now = performance.now();
    if (now - baseToastAt.current > 4000) {
      baseToastAt.current = now;
      setMessage("BASE UNDER ATTACK!");
    }
  };

  const renderCooldownOverlay = (key: keyof SkillCooldowns) => {
    const cd = cooldowns[key];
    if (cd.remainingMs <= 0) return null;
    const pct = cd.totalMs > 0 ? Math.min(100, (cd.remainingMs / cd.totalMs) * 100) : 0;
    return (
      <>
        <span className={styles.cooldownOverlay} style={{ height: `${pct}%` }} aria-hidden="true" />
        <span className={styles.cooldownText}>{Math.ceil(cd.remainingMs / 1000)}</span>
      </>
    );
  };

  const lifePercent = Math.max(0, Math.min(100, (combined.hp / combined.maxHp) * 100));
  const manaPercent = Math.max(0, Math.min(100, (combined.mana / combined.maxMana) * 100));
  const basePercent = Math.max(0, Math.min(100, (baseHp / baseMax) * 100));

  return (
    <main className={styles.page}>
      <header className={styles.hudCompact}>
        <div className={styles.hudCompactRow}>
          <span className={styles.statusDot} />
          <h1>BASE DEFENCE</h1>
          <span className={styles.zoneBadge}>
            {phase === "wave"
              ? `WAVE ${waveIndex + 1}/${DEFENCE_WAVES.length}`
              : phase.toUpperCase()}
          </span>
          <span className={styles.hudCompactSpacer} />
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className={styles.exitButton}
            title="Back to dashboard"
          >
            EXIT
          </button>
          <span className={styles.hudRes}>
            GOLD<strong>{run.gold.toLocaleString()}</strong>
          </span>
        </div>

        <div className={styles.hudCompactBars}>
          <div className={styles.hudBar} title={`BASE ${baseHp} / ${baseMax}`}>
            <span className={styles.hudBarLabelHp}>BASE</span>
            <div className={styles.hudBarTrack}>
              <div className={styles.hudHpFill} style={{ width: `${basePercent}%` }} />
            </div>
            <strong>
              {baseHp}/{baseMax}
            </strong>
          </div>
          <div className={styles.hudBar} title={`HP ${Math.round(combined.hp)} / ${combined.maxHp}`}>
            <span className={styles.hudBarLabelHp}>HP</span>
            <div className={styles.hudBarTrack}>
              <div className={styles.hudHpFill} style={{ width: `${lifePercent}%` }} />
            </div>
            <strong>
              {Math.round(combined.hp)}/{combined.maxHp}
            </strong>
          </div>
          <div className={styles.hudBar} title={`MP ${Math.round(combined.mana)} / ${combined.maxMana}`}>
            <span className={styles.hudBarLabelMp}>MP</span>
            <div className={styles.hudBarTrack}>
              <div className={styles.hudMpFill} style={{ width: `${manaPercent}%` }} />
            </div>
            <strong>
              {Math.round(combined.mana)}/{combined.maxMana}
            </strong>
          </div>
        </div>
      </header>

      <div className={styles.mainGameArea}>
        {message && <div className={styles.lootMessage}>{message}</div>}
        {stunActive && <div className={styles.stunIndicator}>STUNNED</div>}

        <InfiniteArena
          ref={arenaRef}
          mode="defence"
          baseDestroyed={baseHp <= 0}
          playerHp={combined.hp}
          playerMaxHp={combined.maxHp}
          playerAttack={combined.attack}
          playerCritChance={combined.critChance}
          playerCritDamage={combined.critDamage}
          playerSkillPower={combined.skillPower}
          playerMoveSpeed={combined.moveSpeed}
          playerAttackSpeed={combined.attackSpeed}
          playerLuck={combined.luck}
          playerDefense={combined.defense}
          playerArmor={combined.armor}
          playerLevel={35}
          playerMana={combined.mana}
          playerMaxMana={combined.maxMana}
          onSkillDenied={() => setMessage("NOT ENOUGH MANA")}
          onStunChange={setStunActive}
          companionId={equipment.companion?.id ?? null}
          onStatsChange={setRun}
          onBaseHit={handleBaseHit}
          onHeraldArrived={(arrived, total) => {
            if (!storyActiveRef.current) return;
            if (arrived >= total) {
              // All riders in — the warning script takes it from here.
              arenaRef.current?.playWarning?.();
            } else {
              setMessage(`HERALD ${arrived}/${total} — WARNING INCOMING!`);
            }
          }}
          onStoryBanner={(line) => setMessage(line)}
          onIntroDone={() => {
            if (storyActiveRef.current) startWave(0);
          }}
          onLootCollected={() => {
            // Defence waves drop nothing (gold comes from wave-clear payouts).
          }}
          zoom={0.75}
        />

        <button
          type="button"
          className={styles.bagToggle}
          onClick={() => setCodexOpen((open) => !open)}
          aria-expanded={codexOpen}
          aria-label="Toggle item book"
          title="Item book (shared with Survival)"
        >
          BOOK
        </button>

        <button
          type="button"
          className={styles.bagToggle}
          style={{ top: 232, borderColor: "#ffcd75", color: "#ffcd75" }}
          onClick={() => setHelpOpen((open) => !open)}
          aria-expanded={helpOpen}
          aria-label="Toggle how to play"
          title="How to play (?)"
        >
          ?
        </button>

        <button
          type="button"
          className={styles.bagToggle}
          style={{ top: 272, borderColor: "#ffcd75", color: "#ffcd75" }}
          onClick={() => setSpoilsOpen((open) => !open)}
          aria-expanded={spoilsOpen}
          aria-label="Toggle war spoils"
          title="War spoils (E to loot)"
        >
          LOOT{spoils.length > 0 ? ` ${spoils.length}` : ""}
        </button>

        {spoilsOpen && (
          <div style={{ ...panelStyle, width: "min(460px, 92vw)" }} role="dialog" aria-label="War spoils">
            <h2 style={{ margin: "0 0 6px", fontSize: "0.8rem", color: "#ffcd75" }}>
              WAR SPOILS
            </h2>
            <p style={{ fontSize: "0.5rem", color: "#a0a5c0", margin: "0 0 14px" }}>
              Kept into Survival&apos;s shared save
            </p>
            {spoils.length === 0 ? (
              <p style={{ fontSize: "0.55rem", color: "#a0a5c0" }}>
                Nothing yet — defeat enemies and press E.
              </p>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "40vh", overflowY: "auto" }}>
                  {spoils.map((entry) => (
                    <div
                      key={entry.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 8px",
                        background: "#0f0a1e",
                        border: "1px solid #3a3f58",
                      }}
                    >
                      <ItemIcon icon={entry.icon} rarity={entry.rarity} size={28} />
                      <span style={{ flex: 1, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {entry.name} <small style={{ opacity: 0.75 }}>x{entry.amount}</small>
                      </span>
                      <small style={{ fontSize: 11, color: "#ffcd75" }}>
                        {(entry.sellPrice ?? 0) * entry.amount}G
                      </small>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const total = spoils.reduce(
                      (sum, e) => sum + (e.sellPrice ?? 0) * e.amount,
                      0
                    );
                    setSpoils([]);
                    setRun((prev) => ({ ...prev, gold: prev.gold + total }));
                    setMessage(`SOLD SPOILS +${total}G`);
                    setSpoilsOpen(false);
                  }}
                  style={{
                    width: "100%",
                    marginTop: 12,
                    padding: 12,
                    backgroundColor: "#b13434",
                    border: "3px solid #ffcd75",
                    color: "#fff",
                    fontFamily: "inherit",
                    fontSize: "0.6rem",
                    cursor: "pointer",
                  }}
                >
                  SELL ALL
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setSpoilsOpen(false)}
              style={{
                marginTop: 12,
                background: "transparent",
                border: "none",
                color: "#ffcd75",
                fontFamily: "inherit",
                fontSize: "0.5rem",
                cursor: "pointer",
              }}
            >
              CLOSE
            </button>
          </div>
        )}

        {codexOpen && (
          <ItemCodex
            discoveredIds={discoveredIds}
            ownedCounts={ownedCounts}
            onClose={() => setCodexOpen(false)}
          />
        )}
        {helpOpen && <HowToPlay onClose={() => setHelpOpen(false)} />}

        {phase === "ready" && (
          <div style={panelStyle} role="dialog" aria-label="Defend the base">
            <h2 style={{ margin: "0 0 10px", fontSize: "0.85rem", color: "#ffcd75" }}>
              BASE DEFENCE
            </h2>
            <p style={{ fontSize: "0.55rem", lineHeight: 1.9, color: "#a0a5c0" }}>
              Endless waves will march on your base. Your Survival gear
              carries over — bring good equipment. Loot converts to gold.
              Every 10 waves grants an upgrade draft. If the base falls, the
              run ends.
            </p>
            <button
              type="button"
              onClick={beginStory}
              style={{
                width: "100%",
                marginTop: 16,
                padding: 14,
                backgroundColor: "#b13434",
                border: "3px solid #ffcd75",
                color: "#fff",
                fontFamily: "inherit",
                fontSize: "0.65rem",
                cursor: "pointer",
                boxShadow: "0 6px #5a1111",
              }}
            >
              BEGIN THE SIEGE
            </button>
            <Link
              href="/dashboard"
              style={{ display: "inline-block", marginTop: 16, fontSize: "0.5rem", color: "#ffcd75" }}
            >
              ← BACK
            </Link>
          </div>
        )}

        {phase === "intermission" && (
          <div
            style={{
              position: "absolute",
              top: 12,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 70,
              padding: "10px 18px",
              backgroundColor: "rgba(24, 20, 37, 0.94)",
              border: "3px solid #3a3f58",
              color: "#ffcd75",
              fontFamily: 'var(--font-pixel), "Press Start 2P", monospace',
              fontSize: "0.6rem",
              textAlign: "center",
            }}
          >
            <div>
              WAVE {waveIndex + 2} IN {countdown}s
            </div>
            <button
              type="button"
              onClick={() => startWave(waveIndex + 1)}
              style={{
                marginTop: 8,
                padding: "8px 14px",
                backgroundColor: "#b13434",
                border: "3px solid #ffcd75",
                color: "#fff",
                fontFamily: "inherit",
                fontSize: "0.55rem",
                cursor: "pointer",
              }}
            >
              START NOW
            </button>
          </div>
        )}

        {phase === "story" && (
          <div
            style={{
              position: "absolute",
              bottom: 18,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 70,
              width: "min(480px, 92vw)",
              padding: "12px 16px",
              backgroundColor: "rgba(24, 20, 37, 0.94)",
              border: "3px solid #3a3f58",
              color: "#ffcd75",
              fontFamily: 'var(--font-pixel), "Press Start 2P", monospace',
              fontSize: "0.55rem",
              lineHeight: 1.8,
              textAlign: "center",
            }}
          >
            <div>5 HERALDS RIDE FOR THE BASE…</div>
            <button
              type="button"
              onClick={skipStory}
              style={{
                marginTop: 10,
                padding: "8px 16px",
                backgroundColor: "#b13434",
                border: "3px solid #ffcd75",
                color: "#fff",
                fontFamily: "inherit",
                fontSize: "0.55rem",
                cursor: "pointer",
              }}
            >
              SKIP TO WAVE 1
            </button>
          </div>
        )}

        {phase === "draft" && (
          <div style={{ ...panelStyle, width: "min(560px, 94vw)" }} role="dialog" aria-label="Choose an upgrade">
            <h2 style={{ margin: "0 0 6px", fontSize: "0.8rem", color: "#ffcd75" }}>
              WAVE {DEFENCE_WAVES[waveIndex]?.no ?? waveIndex + 1} HELD — CHOOSE 1
            </h2>
            <p style={{ fontSize: "0.5rem", color: "#a0a5c0", margin: "0 0 14px" }}>
              MILESTONE REWARD
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
              {draftCards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => applyDraft(card)}
                  style={{
                    padding: "14px 10px",
                    background: "#0f0a1e",
                    border: "3px solid #3a3f58",
                    color: "#fff",
                    fontFamily: "inherit",
                    cursor: "pointer",
                    display: "grid",
                    gap: 8,
                    justifyItems: "center",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#ffcd75";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#3a3f58";
                  }}
                >
                  <strong style={{ fontSize: "0.55rem", color: "#ffcd75", lineHeight: 1.6 }}>
                    {card.title}
                  </strong>
                  <span style={{ fontSize: "0.45rem", color: "#a0a5c0", lineHeight: 1.7 }}>
                    {card.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {phase === "defeat" && (
          <div style={panelStyle} role="dialog" aria-label="Defeat">
            <h2 style={{ margin: "0 0 10px", fontSize: "0.85rem", color: "#ffb4a2" }}>
              BASE DESTROYED
            </h2>
            <p style={{ fontSize: "0.55rem", lineHeight: 1.9, color: "#a0a5c0" }}>
              The dungeon overran your base on wave{" "}
              {DEFENCE_WAVES[waveIndex]?.no ?? waveIndex + 1}. Gear up in
              Survival and try again.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                width: "100%",
                marginTop: 16,
                padding: 14,
                backgroundColor: "#b13434",
                border: "3px solid #ffcd75",
                color: "#fff",
                fontFamily: "inherit",
                fontSize: "0.65rem",
                cursor: "pointer",
                boxShadow: "0 6px #5a1111",
              }}
            >
              RETRY
            </button>
            <Link
              href="/dashboard"
              style={{ display: "inline-block", marginTop: 16, fontSize: "0.5rem", color: "#ffcd75" }}
            >
              ← DASHBOARD
            </Link>
          </div>
        )}
      </div>

      <div className={styles.actionDock}>
        <section className={styles.interfaceBox}>
          <div className={styles.boxHeading}>SKILLS</div>
          <div className={styles.skillSlots}>
            <button
              className={`${styles.slot} ${styles.attackSlot}`}
              onClick={() => arenaRef.current?.attack()}
              title="Attack (no cooldown, no mana cost)"
            >
              <span className={styles.slotIcon}>⚔</span>
              <small>ATTACK</small>
              <kbd>◉</kbd>
            </button>
            <button
              className={`${styles.slot} ${styles.skillSlot}${cooldowns.spin.remainingMs > 0 ? ` ${styles.cooldownSlot}` : ""}`}
              onClick={() => arenaRef.current?.skill()}
              title={`Spin skill (${SKILL_MANA_COSTS.spin} MP)`}
            >
              <span className={styles.slotIcon}>✦</span>
              <small>SPIN</small>
              <kbd>2</kbd>
              {renderCooldownOverlay("spin")}
            </button>
            <button
              className={`${styles.slot} ${styles.dodgeSlot}${cooldowns.dodge.remainingMs > 0 ? ` ${styles.cooldownSlot}` : ""}`}
              onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "q" }))}
              title={`Dodge (${SKILL_MANA_COSTS.dodge} MP)`}
            >
              <span className={styles.slotIcon}>➤</span>
              <small>DODGE</small>
              <kbd>Q</kbd>
              {renderCooldownOverlay("dodge")}
            </button>
            <button
              className={`${styles.slot}${cooldowns.clones.remainingMs > 0 ? ` ${styles.cooldownSlot}` : ""}`}
              onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "1" }))}
              title={`Clone skill (${SKILL_MANA_COSTS.clones} MP)`}
            >
              <span className={styles.slotIcon}>◆</span>
              <small>CLONES</small>
              <kbd>1</kbd>
              {renderCooldownOverlay("clones")}
            </button>
            <button
              className={`${styles.slot} ${styles.flashTriangleSlot}${cooldowns.flash.remainingMs > 0 ? ` ${styles.cooldownSlot}` : ""}`}
              onClick={() => arenaRef.current?.flashTriangle()}
              title={`Flash triangle skill (${SKILL_MANA_COSTS.flash} MP)`}
            >
              <span className={styles.slotIcon}>✧</span>
              <small>FLASH</small>
              <kbd>3</kbd>
              {renderCooldownOverlay("flash")}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
