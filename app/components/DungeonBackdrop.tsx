"use client";

import { useEffect, useRef } from "react";

/**
 * Pixel dungeon animated backdrop, ported from docs/SAMPLE.html.
 * Busy battle scene — same brick/floor/torch/ember base, plus:
 * - main character running (public/player/run_right.png, 96x80 x8)
 * - skeleton king hunting the runner (public/SkeletonKingRightWalk.png, 48x48 x10)
 * - knights marching (public/WarriorRightWalk.png / WarriorLeftWalk.png, 48x48 x8)
 * - dragons of every color flying (820x644 sheets, 4x4 grid of 205x161)
 * - slimes hopping (public/slime-sheet.png, 32x32 x6, blue/green/red)
 */
export default function DungeonBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const SCALE = 4;
    const resize = () => {
      canvas.width = Math.ceil(window.innerWidth / SCALE);
      canvas.height = Math.ceil(window.innerHeight / SCALE);
    };
    window.addEventListener("resize", resize);
    resize();

    const reduceMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let frame = 0;
    let raf = 0;

    function loadSprite(src: string) {
      const img = new Image();
      (img as HTMLImageElement & { ready?: boolean }).ready = false;
      img.onload = () => {
        (img as HTMLImageElement & { ready?: boolean }).ready = true;
      };
      img.src = src;
      return img;
    }
    const slimeImg = loadSprite("/slime-sheet.png");
    const mainRunnerImg = loadSprite("/player/run_right.png"); // 768x80, 8x 96x80
    const skeletonKingImg = loadSprite("/SkeletonKingRightWalk.png"); // 480x48, 10x 48x48
    const knightImgR = loadSprite("/WarriorRightWalk.png"); // 384x48, 8x 48x48
    const knightImgL = loadSprite("/WarriorLeftWalk.png");
    // Dragons: every color, LEFT-facing sheets (they fly right -> left).
    // Ordered common -> rarest (same tiers as the game: whelp/red smallest,
    // rainbow/prismatic biggest).
    const dragonColors = [
      "red",
      "yellow",
      "green",
      "blue",
      "purple",
      "white",
      "black",
      "rainbow",
    ] as const;
    const dragonImgs = dragonColors.map((c) =>
      c === "red"
        ? loadSprite("/red_dragon/reddragonfly_left.png")
        : loadSprite(`/dragons/${c}/${c}dragonfly_left.png`)
    );
    const isReady = (img: HTMLImageElement) =>
      (img as HTMLImageElement & { ready?: boolean }).ready === true &&
      img.naturalWidth > 0;

    function drawTorch(x: number, y: number) {
      if (!ctx) return;
      ctx.fillStyle = "#3a3f58";
      ctx.fillRect(x, y + 6, 4, 2);
      ctx.fillRect(x + 1, y + 4, 2, 4);
      const flicker = Math.floor(Math.sin(frame * 0.2) + Math.random() * 2);
      ctx.fillStyle = "#e86a17";
      ctx.fillRect(x - 1, y - 2 + flicker, 4, 6);
      ctx.fillStyle = "#ffcd75";
      ctx.fillRect(x, y - 1 + flicker, 2, 4);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x, y + flicker, 2, 1);
    }

    // --- Slimes from public/slime-sheet.png (blue/green/red rows) ---
    const slimes = [
      { x: -20, speed: 0.25, row: 1, size: 14 },
      { x: 80, speed: 0.18, row: 2, size: 12 },
      { x: 200, speed: 0.3, row: 0, size: 10 },
      { x: 300, speed: 0.22, row: 1, size: 12 },
    ];
    function drawPublicSlimes(floorY: number) {
      if (!ctx || !canvas) return;
      const animFrame = Math.floor(frame / 12) % 6;
      for (const s of slimes) {
        s.x += s.speed;
        if (s.x > canvas.width + 20) s.x = -20;
        const hop = Math.abs(Math.sin(frame * 0.15 + s.x)) * 3;
        const dx = Math.floor(s.x);
        const dy = Math.floor(floorY - s.size - hop);
        if (isReady(slimeImg)) {
          ctx.drawImage(
            slimeImg,
            animFrame * 32,
            s.row * 32,
            32,
            32,
            dx - Math.floor(s.size / 2),
            dy,
            s.size,
            s.size
          );
        } else {
          ctx.fillStyle = "#38b764";
          ctx.fillRect(dx - 6, dy, 12, 8);
        }
      }
    }

    // --- Main character running + skeleton king hunting him ---
    let heroRunX = -50;
    function drawChase(floorY: number) {
      if (!ctx || !canvas) return;
      heroRunX += 0.7;
      if (heroRunX > canvas.width + 60) heroRunX = -60;
      const bob = Math.floor(Math.sin(frame * 0.4) * 1);

      // main character (player run, 96x80 cells) — big so he's clearly visible
      if (isReady(mainRunnerImg)) {
        const f = Math.floor(frame / 5) % 8;
        const w = 88;
        const h = 76;
        ctx.drawImage(
          mainRunnerImg,
          f * 96,
          0,
          96,
          80,
          Math.floor(heroRunX),
          Math.floor(floorY - h + bob),
          w,
          h
        );
      } else {
        ctx.fillStyle = "#8b9bb4";
        ctx.fillRect(Math.floor(heroRunX), Math.floor(floorY - 10 + bob), 6, 6);
      }

      // skeleton king boss hunting behind (10 frames of 48x48) — big hunter
      const kingX = heroRunX - 128 + Math.sin(frame * 0.05) * 4;
      if (isReady(skeletonKingImg)) {
        const kf = Math.floor(frame / 7) % 10;
        const kw = 96;
        const kh = 96;
        ctx.drawImage(
          skeletonKingImg,
          kf * 48,
          0,
          48,
          48,
          Math.floor(kingX),
          Math.floor(floorY - kh + bob),
          kw,
          kh
        );
      } else {
        ctx.fillStyle = "#c0cbd2";
        ctx.fillRect(Math.floor(kingX), Math.floor(floorY - 14), 10, 12);
      }
    }

    // --- Knights marching across the floor (public/Warrior sheets), big ---
    const knights = [
      { offset: -140, speed: 0.32, size: 60 },
      { offset: -205, speed: 0.32, size: 52 },
    ];
    let marchX = -40;
    function drawKnights(floorY: number) {
      if (!ctx || !canvas) return;
      // knights marching across the floor
      marchX += 0.32;
      if (marchX > canvas.width + 80) marchX = -80;
      for (const k of knights) {
        const kx = Math.floor(marchX + k.offset);
        const marchBob = Math.floor(Math.sin(frame * 0.35 + k.offset) * 1);
        const img = k.offset % 2 === 0 ? knightImgR : knightImgL;
        if (isReady(img)) {
          const kf = Math.floor(frame / 6 + k.offset) % 8;
          // modulo of negative numbers: normalize
          const nf = ((kf % 8) + 8) % 8;
          ctx.drawImage(
            img,
            nf * 48,
            0,
            48,
            48,
            kx,
            Math.floor(floorY - k.size + marchBob),
            k.size,
            k.size
          );
        } else {
          ctx.fillStyle = "#8b9bb4";
          ctx.fillRect(kx, Math.floor(floorY - 10), 6, 8);
        }
      }
    }

    // --- Dragons of every color flying (4x4 grid of 205x161) ---
    const DRAGON_FW = 205;
    const DRAGON_FH = 161;
    const DRAGON_COLS = 4;
    // Size + speed by rarity (game tiers): common small/slow,
    // rainbow prismatic huge + super fast.
    const dragonRarity: Record<string, { w: number; h: number; speed: number }> =
      {
        red: { w: 44, h: 34, speed: 0.22 },
        yellow: { w: 48, h: 38, speed: 0.26 },
        green: { w: 52, h: 40, speed: 0.3 },
        blue: { w: 56, h: 44, speed: 0.34 },
        purple: { w: 62, h: 48, speed: 0.38 },
        white: { w: 68, h: 54, speed: 0.42 },
        black: { w: 78, h: 61, speed: 0.48 },
        rainbow: { w: 104, h: 82, speed: 0.95 },
      };
    const dragonState = dragonColors.map((c, i) => ({
      x: 40 + i * 70,
      speed: dragonRarity[c].speed,
      height: 118 + (i % 4) * 22,
      sizeW: dragonRarity[c].w,
      sizeH: dragonRarity[c].h,
    }));
    function drawDragonSwarm(floorY: number) {
      if (!ctx || !canvas) return;
      dragonState.forEach((d, i) => {
        d.x -= d.speed;
        if (d.x < -50) d.x = canvas.width + 40;
        const y =
          Math.floor(floorY - d.height + Math.sin(frame * 0.07 + i * 1.7) * 5);
        const img = dragonImgs[i];
        if (isReady(img)) {
          const dFrame = Math.floor(frame / 8 + i * 2) % 16;
          const col = dFrame % DRAGON_COLS;
          const row = Math.floor(dFrame / DRAGON_COLS);
          ctx.drawImage(
            img,
            col * DRAGON_FW,
            row * DRAGON_FH,
            DRAGON_FW,
            DRAGON_FH,
            Math.floor(d.x),
            y,
            d.sizeW,
            d.sizeH
          );
        } else {
          ctx.fillStyle = "#b13434";
          ctx.fillRect(Math.floor(d.x), y, 14, 8);
        }
      });
    }

    const embers = Array.from({ length: 35 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      speedY: -(Math.random() * 0.3 + 0.1),
      speedX: (Math.random() - 0.5) * 0.15,
      size: Math.random() > 0.6 ? 1 : 2,
      color: Math.random() > 0.4 ? "#ffcd75" : "#e86a17",
      alpha: Math.random(),
    }));

    function render() {
      if (!ctx || !canvas) return;
      frame++;

      ctx.fillStyle = "#0f0a1e";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const tileSize = 16;
      const floorY = canvas.height - tileSize;

      for (let y = 0; y < floorY; y += tileSize) {
        const row = Math.floor(y / tileSize);
        const offset = (row % 2) * 8;
        for (let x = -8; x < canvas.width + 8; x += tileSize) {
          const bx = x + offset;
          ctx.fillStyle = "#181425";
          ctx.fillRect(bx, y, tileSize - 1, tileSize - 1);
          ctx.fillStyle = "#262135";
          ctx.fillRect(bx + 1, y + 1, tileSize - 3, 1);
          ctx.fillRect(bx + 1, y + 1, 1, tileSize - 3);
          ctx.fillStyle = "#0f0a1e";
          ctx.fillRect(bx, y + tileSize - 1, tileSize, 1);
        }
      }

      for (let x = 0; x < canvas.width; x += tileSize) {
        ctx.fillStyle = "#262135";
        ctx.fillRect(x, floorY, tileSize - 1, tileSize);
        ctx.fillStyle = "#3a3f58";
        ctx.fillRect(x, floorY, tileSize - 1, 2);
      }

      const torchY = Math.floor(canvas.height / 3);
      drawTorch(30, torchY);
      drawTorch(canvas.width - 34, torchY);

      const glowPulse = Math.sin(frame * 0.1) * 3;
      const leftGlow = ctx.createRadialGradient(
        32,
        torchY,
        2,
        32,
        torchY,
        40 + glowPulse
      );
      leftGlow.addColorStop(0, "rgba(232, 106, 23, 0.35)");
      leftGlow.addColorStop(1, "rgba(15, 10, 30, 0)");
      ctx.fillStyle = leftGlow;
      ctx.fillRect(0, 0, 100, canvas.height);

      const rightGlow = ctx.createRadialGradient(
        canvas.width - 32,
        torchY,
        2,
        canvas.width - 32,
        torchY,
        40 + glowPulse
      );
      rightGlow.addColorStop(0, "rgba(232, 106, 23, 0.35)");
      rightGlow.addColorStop(1, "rgba(15, 10, 30, 0)");
      ctx.fillStyle = rightGlow;
      ctx.fillRect(canvas.width - 100, 0, 100, canvas.height);

      // busy cast: dragons swarm sky, slimes hop, hero runs from skeleton king,
      // knights march across the floor
      drawDragonSwarm(floorY);
      drawPublicSlimes(floorY);
      drawChase(floorY);
      drawKnights(floorY);

      embers.forEach((ember) => {
        ember.y += ember.speedY;
        ember.x += ember.speedX;
        ember.alpha -= 0.004;
        if (ember.y < -5 || ember.alpha <= 0) {
          ember.y = canvas.height + 5;
          ember.x = Math.random() * canvas.width;
          ember.alpha = Math.random() * 0.8 + 0.2;
        }
        ctx.fillStyle = ember.color;
        ctx.globalAlpha = Math.max(0, ember.alpha);
        ctx.fillRect(
          Math.floor(ember.x),
          Math.floor(ember.y),
          ember.size,
          ember.size
        );
      });
      ctx.globalAlpha = 1.0;

      if (!reduceMotion) raf = requestAnimationFrame(render);
    }

    render();
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        imageRendering: "pixelated",
      }}
    />
  );
}
