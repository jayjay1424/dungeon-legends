"use client";

import { RARITY_COLORS } from "./types";
import styles from "../survival.module.css";

export function ItemIcon({ icon, rarity, size = 42 }: { icon: string; rarity?: keyof typeof RARITY_COLORS; size?: number }) {
  return (
    <img
      className={styles.itemIcon}
      src={icon}
      width={size}
      height={size}
      alt=""
      style={{ borderColor: rarity ? RARITY_COLORS[rarity] : "transparent" }}
      aria-hidden="true"
    />
  );
}
