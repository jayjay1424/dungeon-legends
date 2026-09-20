"use client";

import { CSSProperties } from "react";
import RedDragonSprite from "../survival/components/RedDragonSprite";

/**
 * Single-frame (or animated-row) sprite from a sheet in public/.
 * Shows one frame correctly instead of squishing the whole sheet.
 */

interface SheetSpriteProps {
  src: string;
  frameW: number;
  frameH: number;
  frames: number;
  row?: number;
  scale?: number;
  fps?: number;
  playing?: boolean;
  alt?: string;
}

export function SheetSprite({
  src,
  frameW,
  frameH,
  frames,
  row = 0,
  scale = 2,
  fps = 8,
  playing = true,
  alt = "monster",
}: SheetSpriteProps) {
  const duration = frames / fps;
  // Unique animation per config so multiple instances don't clash.
  const animName = `sheet_${frameW}x${frameH}x${frames}r${row}f${fps}`.replace(
    /[^\w]/g,
    ""
  );
  const w = frameW * scale;
  const h = frameH * scale;

  const wrapperStyle: CSSProperties = {
    width: w,
    height: h,
    overflow: "hidden",
    flexShrink: 0,
    imageRendering: "pixelated",
  };
  const innerStyle: CSSProperties = {
    width: w,
    height: h,
    backgroundImage: `url(${src})`,
    backgroundRepeat: "no-repeat",
    backgroundSize: `${frameW * frames * scale}px ${frameH * scale}`,
    backgroundPosition: `0px -${row * frameH * scale}px`,
    animation: playing
      ? `${animName} ${duration}s steps(${frames}) infinite`
      : "none",
    imageRendering: "pixelated",
  };
  return (
    <div style={wrapperStyle} role="img" aria-label={alt}>
      <div style={innerStyle} />
      <style>{`
        @keyframes ${animName} {
          from { background-position-x: 0px; }
          to { background-position-x: -${frameW * frames * scale}px; }
        }
      `}</style>
    </div>
  );
}

/** Green slime from /slime-sheet.png (192x192, 32px cells, row 1 = green). */
export function SlimeSprite({
  scale = 2,
  color = "green",
}: {
  scale?: number;
  color?: "blue" | "green" | "red";
}) {
  const row = color === "blue" ? 0 : color === "green" ? 1 : 2;
  return (
    <SheetSprite
      src="/slime-sheet.png"
      frameW={32}
      frameH={32}
      frames={6}
      row={row}
      scale={scale}
      alt={`Dungeon ${color} slime`}
    />
  );
}

/** Blood monster idle (/blood-monster-idle.png, 600x100, 6x 100px frames). */
export function BloodMonsterSprite({ scale = 0.6 }: { scale?: number }) {
  return (
    <SheetSprite
      src="/blood-monster-idle.png"
      frameW={100}
      frameH={100}
      frames={6}
      scale={scale}
      alt="Blood monster"
    />
  );
}

/** Boss demon walk (/Demon_A_Walk.png, 800x100, 8x 100px frames). */
export function BossSprite({ scale = 0.5 }: { scale?: number }) {
  return (
    <SheetSprite
      src="/Demon_A_Walk.png"
      frameW={100}
      frameH={100}
      frames={8}
      scale={scale}
      alt="Dungeon boss demon"
    />
  );
}

/** Running warrior (/WarriorRightWalk.png, 384x48, 8x 48px frames). */
export function WarriorRunSprite({ scale = 1.5 }: { scale?: number }) {
  return (
    <SheetSprite
      src="/WarriorRightWalk.png"
      frameW={48}
      frameH={48}
      frames={8}
      scale={scale}
      fps={10}
      alt="Running warrior"
    />
  );
}

export { RedDragonSprite };
