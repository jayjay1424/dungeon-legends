"use client";

import { useEffect, useRef } from "react";

// Animated portrait using the real player sprite sheets (8 frames of
// 96x80 — the same character as the arena). Respects reduced motion.
const FRAME_W = 96;
const FRAME_H = 80;
const FRAME_COUNT = 8;
const FRAME_MS = 160;

export default function HeroSprite({
  sheet = "/player/idle_down.png",
  scale = 2,
  label = "Adventurer portrait",
}: {
  sheet?: string;
  scale?: number;
  label?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const img = new Image();
    let raf = 0;
    let start = performance.now();
    const reduceMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    const draw = (frame: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(
        img,
        frame * FRAME_W,
        0,
        FRAME_W,
        FRAME_H,
        0,
        0,
        FRAME_W * scale,
        FRAME_H * scale
      );
    };

    img.onload = () => {
      if (reduceMotion) {
        draw(0);
        return;
      }
      const loop = (now: number) => {
        const frame = Math.floor((now - start) / FRAME_MS) % FRAME_COUNT;
        draw(frame);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    };
    img.src = sheet;
    // Paint first frame ASAP once cached; onload covers the rest.
    if (img.complete && img.naturalWidth > 0 && reduceMotion) draw(0);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet]);

  return (
    <canvas
      ref={ref}
      width={FRAME_W * scale}
      height={FRAME_H * scale}
      role="img"
      aria-label={label}
      style={{ imageRendering: "pixelated", maxWidth: "100%", height: "auto" }}
    />
  );
}
