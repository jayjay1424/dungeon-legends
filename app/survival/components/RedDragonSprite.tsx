'use client';

import { CSSProperties, useEffect, useState } from 'react';
import type { PlayerDir } from '../arena/types';

// Native resolution of each file in /public/red_dragon (820x644, 4x4 grid).
export const RED_DRAGON_FRAME_W = 205;
export const RED_DRAGON_FRAME_H = 161;
export const RED_DRAGON_COLS = 4;
export const RED_DRAGON_ROWS = 4;
export const RED_DRAGON_FRAME_COUNT = RED_DRAGON_COLS * RED_DRAGON_ROWS; // 16

export type DragonDir = PlayerDir;
export type DragonColor = "red" | "black" | "blue" | "green" | "purple" | "rainbow" | "white" | "yellow";

export function dragonSrcForColor(color: DragonColor, dir: DragonDir): string {
  if (color === "red") {
    switch (dir) {
      case 'up':
        return '/red_dragon/reddragonfly_up.png';
      case 'down':
        return '/red_dragon/reddragonfly_down.png';
      case 'left':
        return '/red_dragon/reddragonfly_left.png';
      case 'right':
      default:
        return '/red_dragon/reddragonfly_right.png';
    }
  }
  const d = dir === 'up' || dir === 'down' || dir === 'left' ? dir : 'right';
  return `/dragons/${color}/${color}dragonfly_${d}.png`;
}

export function redDragonSrc(dir: DragonDir, color: DragonColor = 'red'): string {
  return dragonSrcForColor(color, dir);
}

/** Visual scale per hatched tier — elder dragons look bigger. */
export const RED_DRAGON_SCALE_BY_TIER: Record<string, number> = {
  dragon_whelp: 0.45,
  dragon_yellow: 0.5,
  dragon_drake: 0.55,
  dragon_blue: 0.6,
  dragon_wyvern: 0.65,
  dragon_white: 0.72,
  dragon_elder: 0.8,
  dragon_rainbow: 0.9,
};

const DRAGON_TIER_COLOR_FALLBACK: Record<string, DragonColor> = {
  dragon_whelp: 'red',
  dragon_yellow: 'yellow',
  dragon_drake: 'green',
  dragon_blue: 'blue',
  dragon_wyvern: 'purple',
  dragon_white: 'white',
  dragon_elder: 'black',
  dragon_rainbow: 'rainbow',
};

export function dragonColorForId(companionId?: string | null): DragonColor {
  if (!companionId) return 'red';
  return DRAGON_TIER_COLOR_FALLBACK[companionId] ?? 'red';
}

export function redDragonScaleFor(companionId?: string | null): number {
  if (!companionId) return 0.55;
  return RED_DRAGON_SCALE_BY_TIER[companionId] ?? 0.55;
}

export interface RedDragonSpriteProps {
  dir?: DragonDir;
  fps?: number;
  playing?: boolean;
  scale?: number;
  /** Sprite color. Defaults to "red" (/red_dragon). Others use /dragons/<color>. */
  color?: DragonColor;
  /** Convenience: derive color from equipped companion id. Overrides `color` when set. */
  companionId?: string | null;
}

/**
 * UI preview for the red dragon. The sheets are 4x4 grids, so we step
 * through all 16 cells with a small timer (CSS alone can't easily do
 * 2-axis steps).
 */
export default function RedDragonSprite({
  dir = 'down',
  fps = 10,
  playing = true,
  scale = 0.55,
  color = 'red',
  companionId = null,
}: RedDragonSpriteProps) {
  const [frame, setFrame] = useState(0);
  const resolvedColor: DragonColor = companionId ? dragonColorForId(companionId) : color;

  useEffect(() => {
    if (!playing) {
      setFrame(0);
      return;
    }
    const id = window.setInterval(() => {
      setFrame((f) => (f + 1) % RED_DRAGON_FRAME_COUNT);
    }, 1000 / fps);
    return () => window.clearInterval(id);
  }, [fps, playing, dir]);

  const col = frame % RED_DRAGON_COLS;
  const row = Math.floor(frame / RED_DRAGON_COLS) % RED_DRAGON_ROWS;

  const w = RED_DRAGON_FRAME_W * scale;
  const h = RED_DRAGON_FRAME_H * scale;

  const wrapperStyle: CSSProperties = {
    width: w,
    height: h,
    overflow: 'hidden',
    imageRendering: 'pixelated',
    flexShrink: 0,
  };

  const innerStyle: CSSProperties = {
    width: w,
    height: h,
    backgroundImage: `url(${redDragonSrc(dir, resolvedColor)})`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${RED_DRAGON_FRAME_W * RED_DRAGON_COLS * scale}px ${
      RED_DRAGON_FRAME_H * RED_DRAGON_ROWS * scale
    }px`,
    backgroundPosition: `-${col * w}px -${row * h}px`,
    imageRendering: 'pixelated',
  };

  return (
    <div style={wrapperStyle}>
      <div style={innerStyle} />
    </div>
  );
}
