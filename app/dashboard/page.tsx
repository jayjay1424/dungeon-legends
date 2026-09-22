"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { loadPlayerSave } from "@/app/actions/saveGame";
import styles from "./dashboard.module.css";
import settingsStyles from "./settings.module.css";
import DungeonBackdrop from "../components/DungeonBackdrop";
import HeroSprite from "../components/HeroSprite";
import Lobby from "../multiplayer/Lobby";

export default function Dashboard() {
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lobbyOpen, setLobbyOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [level, setLevel] = useState<number | null>(null);
  const [hp, setHp] = useState<string>("—");
  const [atk, setAtk] = useState<string>("—");
  const [def, setDef] = useState<string>("—");

  useEffect(() => {
    if (!settingsOpen && !lobbyOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "escape") {
        setSettingsOpen(false);
        setLobbyOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settingsOpen, lobbyOpen]);

  // Load player save on mount
  useEffect(() => {
    loadPlayerSave()
      .then((save) => {
        if (!save) return;
        // Derive a display name from email (strip domain)
        const supabase = createClient();
        supabase.auth.getUser().then(({ data }) => {
          if (data?.user) {
            const email = data.user.email ?? "";
            setPlayerName(email.split("@")[0] ?? "Adventurer");
          }
        });
        if (save.stats) {
          setLevel(save.stats.level);
          setHp(`${Math.round(save.stats.hp)} / ${save.stats.maxHp}`);
          setAtk(String(save.stats.attack));
          setDef(String(save.stats.defense));
        }
      })
      .catch(() => {
        // Failed to load — show placeholders
      });
  }, []);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // proceed to login even if sign-out fails
    }
    router.push("/login");
  }

  const displayName = playerName ?? "Adventurer";
  const displayLevel = level ?? 1;

  return (
    <div className={styles.dungeonLobby}>
      <a href="#main" className={styles.skipLink}>
        Skip to content
      </a>
      <div className={styles.backdropWrap} aria-hidden="true">
        <DungeonBackdrop />
      </div>
      <div className={styles.overlay} aria-hidden="true" />
      <div className={styles.scanlines} aria-hidden="true" />

      <header className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <span className={styles.brandMark} aria-hidden="true" />
          <p className={styles.gameTitle}>Dungeon Legends</p>
        </div>
        <div className={styles.topBarRight}>
          <span className={styles.userChip}>
            <span className={styles.userDot} aria-hidden="true" />
            {displayName} · Lv {displayLevel}
          </span>
          <button
            type="button"
            onClick={() => setLobbyOpen(true)}
            className={styles.logoutBtn}
            style={{
              background: "rgba(14, 116, 144, 0.3)",
              borderColor: "#38bdf8",
              color: "#38bdf8",
              cursor: "pointer",
            }}
          >
            ⚔️ Co-Op
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className={styles.logoutBtn}
          >
            Setting
          </button>
        </div>
      </header>

      <main id="main" className={styles.content}>
        <section className={styles.heroPanel} aria-labelledby="hero-heading">
          <div className={styles.heroVisual}>
            <div className={styles.portraitFrame}>
              <HeroSprite />
            </div>
          </div>

          <div className={styles.heroInfo}>
            <p className={styles.eyebrow}>Your adventurer</p>
            <h1 id="hero-heading" className={styles.heroTitle}>
              {displayName}
            </h1>
            <p className={styles.heroDesc}>
              {level && level > 1
                ? `Veteran of ${level} dungeons. Equipment and loot are saved online.`
                : "Just stepped into the dungeon. Sharpen your blade, check your stats, then choose where to delve next."}
            </p>
            <dl className={styles.heroStats}>
              <div className={styles.stat}>
                <dt className={styles.statLabel}>HP</dt>
                <dd className={styles.statVal}>{hp}</dd>
              </div>
              <div className={styles.stat}>
                <dt className={styles.statLabel}>ATK</dt>
                <dd className={styles.statVal}>{atk}</dd>
              </div>
              <div className={styles.stat}>
                <dt className={styles.statLabel}>DEF</dt>
                <dd className={styles.statVal}>{def}</dd>
              </div>
              <div className={styles.stat}>
                <dt className={styles.statLabel}>Level</dt>
                <dd className={styles.statVal}>{displayLevel}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className={styles.modes} aria-labelledby="modes-heading">
          <div className={styles.sectionHead}>
            <div>
              <h2 id="modes-heading" className={styles.sectionTitle}>
                Choose your path
              </h2>
              <p className={styles.sectionSubtitle}>
                Survival or base defence. Pick your fight.
              </p>
            </div>
          </div>

          <div className={styles.modeGrid}>
            <Link
              href="/survival"
              className={`${styles.gameCard} ${styles.gameCardTextOnly}`}
            >
              <span className={styles.cardBody}>
                <span className={styles.cardTitle}>Survival Arena</span>
                <span className={styles.cardDesc}>
                  Fight endless waves — slimes, demons, skeleton kings, and
                  necromancers.
                </span>
                <span className={styles.cardEnter}>
                  Enter arena <span aria-hidden="true">→</span>
                </span>
              </span>
            </Link>

            <Link
              href="/defence"
              className={`${styles.gameCard} ${styles.gameCardTextOnly}`}
            >
              <span className={styles.cardBody}>
                <span className={styles.cardTitle}>Base Defence</span>
                <span className={styles.cardDesc}>
                  Hold the line — waves march on your base. Survive them all.
                </span>
                <span className={styles.cardEnter}>
                  Defend base <span aria-hidden="true">→</span>
                </span>
              </span>
            </Link>

            <button
              type="button"
              onClick={() => setLobbyOpen(true)}
              className={`${styles.gameCard} ${styles.gameCardTextOnly}`}
              style={{
                textAlign: "left",
                cursor: "pointer",
                border: "3px solid #38bdf8",
                background: "linear-gradient(180deg, #181425 0%, #0c2340 100%)",
              }}
            >
              <span className={styles.cardBody}>
                <span className={styles.cardTitle} style={{ color: "#38bdf8" }}>
                  ⚔️ Multiplayer Co-Op
                </span>
                <span className={styles.cardDesc}>
                  Meet and fight together in the same arena in real-time. Share battles with other players!
                </span>
                <span className={styles.cardEnter} style={{ color: "#7dd3fc" }}>
                  Join or Host Room <span aria-hidden="true">→</span>
                </span>
              </span>
            </button>
          </div>
        </section>
      </main>

      {lobbyOpen && (
        <div
          className={settingsStyles.backdrop}
          onClick={(e) => {
            if (e.target === e.currentTarget) setLobbyOpen(false);
          }}
        >
          <div style={{ width: "min(520px, 95vw)", zIndex: 110 }}>
            <Lobby
              mode="survival"
              onClose={() => setLobbyOpen(false)}
              onJoin={(sessionId) => {
                if (sessionId) {
                  router.push(`/survival?room=${sessionId}`);
                }
              }}
            />
          </div>
        </div>
      )}

      {settingsOpen && (
        <div
          className={settingsStyles.backdrop}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSettingsOpen(false);
          }}
        >
          <section
            className={settingsStyles.modal}
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
          >
            <div className={settingsStyles.scanlines} aria-hidden="true" />
            <div className={settingsStyles.header}>
              <h2 className={settingsStyles.title}>Setting</h2>
              <button
                type="button"
                className={settingsStyles.closeBtn}
                onClick={() => setSettingsOpen(false)}
                aria-label="Close settings"
              >
                ✕
              </button>
            </div>
            <div className={settingsStyles.body}>
              <div>
                <p className={settingsStyles.sectionLabel}>Developer</p>
                <div className={settingsStyles.devCard}>
                  <p className={settingsStyles.devName}>Jayrald Bonucan</p>
                  <p className={settingsStyles.devText}>Made this game</p>
                </div>
              </div>
              <div>
                <p className={settingsStyles.sectionLabel}>Account</p>
                <button
                  type="button"
                  className={settingsStyles.logoutBtn}
                  onClick={logout}
                  disabled={loggingOut}
                >
                  {loggingOut ? "LOGGING OUT…" : "LOG OUT"}
                </button>
              </div>
              <p className={settingsStyles.footer}>DUNGEON LEGENDS</p>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
