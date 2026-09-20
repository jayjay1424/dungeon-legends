"use client";

import styles from "./HowToPlay.module.css";

const CONTROLS: { keys: string; action: string }[] = [
  { keys: "WASD", action: "Move (arrows work too, SHIFT = sprint)" },
  { keys: "CLICK", action: "Attack nearby enemies" },
  { keys: "Q", action: "Dodge dash — brief invulnerability (unlocks LV 5)" },
  { keys: "1", action: "Summon clone fighters (unlocks LV 10)" },
  { keys: "2", action: "Spin attack — knocks enemies back (unlocks LV 20)" },
  { keys: "3", action: "Flash triangle burst — super skill (unlocks LV 25)" },
  { keys: "E", action: "Pick up nearby loot" },
  { keys: "F", action: "Open store at the shop stall" },
  { keys: "C", action: "Craft gear at the forge" },
  { keys: "V", action: "Hatch dragon eggs at the incubator" },
  { keys: "B", action: "Open the item collection book" },
  { keys: "O", action: "Toggle camera follow" },
  { keys: "ESC", action: "Close panels and dialogs" },
];

export default function HowToPlay({ onClose }: { onClose: () => void }) {
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
        aria-label="How to play"
      >
        <div className={styles.scanlines} aria-hidden="true" />

        <div className={styles.header}>
          <h2 className={styles.title}>How To Play</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            Close
          </button>
        </div>

        <div className={styles.body}>
          <section aria-label="Goal">
            <h3 className={styles.sectionTitle}>The Quest</h3>
            <p className={styles.text}>
              You are an adventurer in an endless dungeon. Slay waves of
              monsters, grab their loot, gear up from the bag, and take down
              the Skeleton King. Hatch boss eggs into dragon companions that
              fight at your side.
            </p>
          </section>

          <section aria-label="Controls">
            <h3 className={styles.sectionTitle}>Controls</h3>
            <ul className={styles.controls}>
              {CONTROLS.map((c) => (
                <li key={c.keys}>
                  <span className={styles.key}>{c.keys}</span>
                  {c.action}
                </li>
              ))}
            </ul>
          </section>

          <section aria-label="Tips">
            <h3 className={styles.sectionTitle}>Survival Tips</h3>
            <p className={styles.text}>
              Skills cost mana and grow back over time — watch the MP bar.
              Attack is free. Dodge through danger, not away from loot. Sell
              spare gear, craft upgrades, and check the BOOK (B) to track every
              item you have discovered.
            </p>
          </section>

          <p className={styles.footer}>PRESS ESC OR CLOSE TO RETURN</p>
        </div>
      </section>
    </div>
  );
}
