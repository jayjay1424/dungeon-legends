"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import styles from "./hunt.module.css";
import DungeonBackdrop from "../components/DungeonBackdrop";
import { SlimeSprite, BloodMonsterSprite } from "../components/MonsterSprite";

type MonsterTarget = {
  id: string;
  name: string;
  rarity: string;
  health: number;
  attack: number;
  speed: number;
  catch_rate: number;
  encounter_rate?: number;
};

export default function HuntPage() {
  const supabase = createClient();

  const [monster, setMonster] = useState<MonsterTarget | null>(null);
  const [netLevel] = useState(1);
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [searching, setSearching] = useState(false);
  const [catching, setCatching] = useState(false);

  async function searchMonster() {
    if (searching) return;
    setSearching(true);
    setMessage("");
    setIsSuccess(false);
    setMonster(null);

    // Dungeon monsters table (falls back to legacy spiders table)
    let data: MonsterTarget[] | null = null;

    const monstersRes = await supabase.from("monsters").select("*");

    if (monstersRes.data && monstersRes.data.length > 0) {
      data = monstersRes.data;
    } else {
      const legacy = await supabase.from("spiders").select("*");
      data = legacy.data;
    }

    if (!data || data.length === 0) {
      setMessage("No dungeon monsters found");
      setSearching(false);
      return;
    }

    const totalRate = data.reduce(
      (sum, item) => sum + (item.encounter_rate ?? 1),
      0
    );

    let random = Math.random() * totalRate;
    let selected = null;

    for (const item of data) {
      random -= item.encounter_rate ?? 1;
      if (random <= 0) {
        selected = item;
        break;
      }
    }

    setMonster(selected);
    setSearching(false);
  }

  async function catchMonster() {
    if (!monster || catching) return;
    setCatching(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("Login to catch monsters");
      setCatching(false);
      return;
    }

    // Net bonus
    const netBonus = netLevel * 5;
    const finalChance = Math.min(monster.catch_rate + netBonus, 95);
    const roll = Math.random() * 100;

    if (roll <= finalChance) {
      // Prefer new player_monsters table, fall back to legacy player_spiders
      const monsterPayload = {
        player_id: user.id,
        level: 1,
        experience: 0,
        health: monster.health,
        attack: monster.attack,
        speed: monster.speed,
      };

      const primary = await supabase.from("player_monsters").insert({
        ...monsterPayload,
        monster_id: monster.id,
      });

      if (primary.error) {
        await supabase.from("player_spiders").insert({
          ...monsterPayload,
          spider_id: monster.id,
        });
      }

      setIsSuccess(true);
      setMessage(`Captured ${monster.name}!`);
    } else {
      setIsSuccess(false);
      setMessage(`${monster.name} escaped!`);
    }

    setCatching(false);
  }

  const messageClass = message
    ? isSuccess
      ? `${styles.message} ${styles.messageSuccess}`
      : message.includes("escaped") || message.includes("No ") || message.includes("Login")
        ? `${styles.message} ${styles.messageError}`
        : styles.message
    : styles.message;

  return (
    <div className={styles.dungeonLobby}>
      <div className={styles.backdropWrap} aria-hidden="true">
        <DungeonBackdrop />
      </div>
      <div className={styles.overlay} aria-hidden="true" />
      <div className={styles.scanlines} aria-hidden="true" />

      <header className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <span className={styles.brandMark} aria-hidden="true" />
          <p className={styles.gameTitle}>Monster Hunt</p>
        </div>
      </header>

      <main className={styles.content}>
        <section className={styles.heroPanel} aria-labelledby="hunt-heading">
          <div className={styles.heroVisual}>
            <SlimeSprite scale={2} color="green" />
          </div>
          <div>
            <p className={styles.eyebrow}>Dungeon hunting grounds</p>
            <h1 id="hunt-heading" className={styles.heroTitle}>
              Dungeon Monster Hunt
            </h1>
            <p className={styles.heroDesc}>
              Track, weaken, and recruit dungeon monsters — slimes, demons, and
              deep crawlers.
            </p>
            <div className={styles.actionRow}>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={searchMonster}
                disabled={searching}
              >
                {searching ? "SEARCHING…" : "SEARCH DUNGEON"}
              </button>
            </div>
          </div>
        </section>

        {monster && (
          <section className={styles.monsterCard} aria-label="Wild monster">
            <div className={styles.heroVisual}>
              <BloodMonsterSprite scale={0.7} />
            </div>
            <div>
              <h2 className={styles.monsterName}>{monster.name}</h2>
              <dl className={styles.statGrid}>
                <div className={styles.stat}>
                  <dt className={styles.statLabel}>RARITY</dt>
                  <dd className={styles.statVal}>{monster.rarity}</dd>
                </div>
                <div className={styles.stat}>
                  <dt className={styles.statLabel}>HP</dt>
                  <dd className={styles.statVal}>{monster.health}</dd>
                </div>
                <div className={styles.stat}>
                  <dt className={styles.statLabel}>ATK</dt>
                  <dd className={styles.statVal}>{monster.attack}</dd>
                </div>
                <div className={styles.stat}>
                  <dt className={styles.statLabel}>SPD</dt>
                  <dd className={styles.statVal}>{monster.speed}</dd>
                </div>
                <div className={styles.stat}>
                  <dt className={styles.statLabel}>CATCH</dt>
                  <dd className={styles.statVal}>{monster.catch_rate}%</dd>
                </div>
                <div className={styles.stat}>
                  <dt className={styles.statLabel}>TRAP</dt>
                  <dd className={styles.statVal}>LV {netLevel}</dd>
                </div>
              </dl>
              <div className={styles.actionRow}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={catchMonster}
                  disabled={catching}
                >
                  {catching ? "TRAPPING…" : "USE DUNGEON TRAP"}
                </button>
              </div>
            </div>
          </section>
        )}

        {message ? (
          <p className={messageClass} role="status">
            {message}
          </p>
        ) : null}
      </main>

      <nav className={styles.navBar} aria-label="Primary">
        <Link href="/dashboard" className={styles.navBtn}>
          <span aria-hidden="true">🏠</span> Dungeon
        </Link>
        <Link href="/survival" className={styles.navBtn}>
          <span aria-hidden="true">⚔️</span> Survival
        </Link>
        <Link href="/hunt" aria-current="page" className={`${styles.navBtn} ${styles.active}`}>
          <span aria-hidden="true">👹</span> Hunt
        </Link>
      </nav>
    </div>
  );
}
