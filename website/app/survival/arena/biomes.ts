// arena/biomes.ts
// Per-lane visual identity for the 8 progression lanes:
// base -> slime -> blood (forest) -> goblin -> graveyard -> night -> demon -> final.
// Canvas-only, chunky pixel rects. No DOM, no collisions, no gameplay changes.

import {
  TERRITORY_ZONES,
  VILLAGE_BASE_CENTER,
  CAMPFIRE_WORLD_X,
  CAMPFIRE_WORLD_Y,
  tileNoise,
  worldZoneAt,
} from "./world";

// Zone id -> lane key. Forest doubles as the blood lane (red clay ground).
function laneForZone(zoneId: string | null): string {
  if (zoneId === "forest") return "blood";
  if (zoneId === "beginner") return "slime";
  return zoneId ?? "wild";
}

const LANE_TINT: Record<string, string> = {
  slime: "rgba(74, 222, 128, 0.10)",
  blood: "rgba(153, 27, 27, 0.16)",
  goblin: "rgba(120, 84, 45, 0.14)",
  graveyard: "rgba(100, 116, 139, 0.20)",
  night: "rgba(49, 23, 110, 0.24)",
  demon: "rgba(127, 29, 29, 0.22)",
  final: "rgba(109, 106, 128, 0.20)",
};

function hash2(x: number, y: number): number {
  return tileNoise(x * 1.7 + 31, y * 1.3 + 57);
}

// ---------- Ground pass (called right after renderFloor) ----------
export function renderBiomeGround(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cx: number,
  cy: number,
  now: number
) {
  // 1. Lane tints (concentric bands around the base).
  ctx.save();
  const tbx = VILLAGE_BASE_CENTER.x - cx + w / 2;
  const tby = VILLAGE_BASE_CENTER.y - cy + h / 2;
  const viewR = Math.hypot(w, h) / 2 + 40;
  const distCam = Math.hypot(tbx, tby);
  for (const zone of TERRITORY_ZONES) {
    const tint = LANE_TINT[laneForZone(zone.id)];
    if (!tint) continue;
    if (distCam > zone.outerR + viewR) continue;
    if (distCam + viewR < zone.innerR) continue;
    ctx.fillStyle = tint;
    ctx.beginPath();
    ctx.arc(tbx, tby, zone.outerR, 0, Math.PI * 2);
    ctx.arc(tbx, tby, zone.innerR, 0, Math.PI * 2, true);
    ctx.fill();
  }
  ctx.restore();

  // 2. Safe-base plaza ring (warm packed earth around the village).
  const bx = VILLAGE_BASE_CENTER.x - cx + w / 2;
  const by = VILLAGE_BASE_CENTER.y - cy + h / 2;
  if (bx > -360 && by > -360 && bx < w + 360 && by < h + 360) {
    ctx.save();
    ctx.fillStyle = "rgba(214, 178, 128, 0.20)";
    ctx.beginPath();
    ctx.arc(bx, by, 320, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 236, 190, 0.35)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(bx, by, 320, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 3. Per-cell pixel details.
  const cell = 100;
  const startX = Math.floor((cx - w / 2) / cell) - 1;
  const endX = Math.floor((cx + w / 2) / cell) + 1;
  const startY = Math.floor((cy - h / 2) / cell) - 1;
  const endY = Math.floor((cy + h / 2) / cell) + 1;
  ctx.save();
  for (let gx = startX; gx <= endX; gx++) {
    for (let gy = startY; gy <= endY; gy++) {
      const wx = gx * cell + 50 + (hash2(gx, gy) - 0.5) * 44;
      const wy = gy * cell + 50 + (hash2(gy, gx) - 0.5) * 44;
      const lane = laneForZone(worldZoneAt(wx, wy)?.id ?? null);
      const v = hash2(gx * 3 + 5, gy * 3 + 11);
      const sx = wx - cx + w / 2;
      const sy = wy - cy + h / 2;

      if (lane === "slime") {
        // Goo tufts + acid pools with slow bubbles.
        if (v > 0.88) {
          ctx.fillStyle = "#16a34a";
          ctx.fillRect(sx - 9, sy - 4, 18, 9);
          ctx.fillRect(sx - 6, sy - 7, 12, 15);
          ctx.fillStyle = "#4ade80";
          ctx.fillRect(sx - 6, sy - 7, 12, 3);
          const bubble = Math.sin(now / 500 + gx * 2 + gy) > 0.4;
          ctx.fillStyle = bubble ? "#d1fae5" : "#065f46";
          ctx.fillRect(sx - 1, sy - 3, 4, 4);
        } else if (v > 0.72) {
          ctx.fillStyle = "#15803d";
          ctx.fillRect(sx - 5, sy - 8, 3, 8);
          ctx.fillRect(sx - 1, sy - 11, 3, 11);
          ctx.fillRect(sx + 3, sy - 7, 3, 7);
        }
      } else if (lane === "blood") {
        // Dark flesh blobs + vein slashes.
        if (v > 0.86) {
          ctx.fillStyle = "#7f1d1d";
          ctx.fillRect(sx - 8, sy - 5, 16, 10);
          ctx.fillRect(sx - 5, sy - 8, 10, 16);
          ctx.fillStyle = "#ef4444";
          ctx.fillRect(sx - 5, sy - 1, 10, 2);
          ctx.fillRect(sx - 1, sy - 5, 2, 10);
        } else if (v > 0.7) {
          ctx.fillStyle = "#991b1b";
          ctx.fillRect(sx - 7, sy, 14, 3);
        }
      } else if (lane === "goblin") {
        // Scrap planks + war paint.
        if (v > 0.86) {
          ctx.fillStyle = "#5b3416";
          ctx.fillRect(sx - 9, sy - 3, 18, 6);
          ctx.fillStyle = "#9c6a35";
          ctx.fillRect(sx - 9, sy - 3, 18, 2);
          ctx.fillStyle = "#3f2a12";
          ctx.fillRect(sx - 2, sy - 3, 2, 6);
        } else if (v > 0.78) {
          ctx.fillStyle = "#b91c1c";
          ctx.fillRect(sx - 5, sy - 5, 4, 10);
          ctx.fillRect(sx + 1, sy - 5, 4, 10);
        } else if (v > 0.66) {
          ctx.fillStyle = "#78716c";
          ctx.fillRect(sx, sy, 5, 4);
        }
      } else if (lane === "graveyard") {
        // Fallen bones + cracked dirt.
        if (v > 0.86) {
          ctx.fillStyle = "#e2e8f0";
          ctx.fillRect(sx - 8, sy - 2, 16, 4);
          ctx.fillRect(sx - 8, sy - 4, 4, 8);
          ctx.fillRect(sx + 4, sy - 4, 4, 8);
        } else if (v > 0.72) {
          ctx.fillStyle = "#475569";
          ctx.fillRect(sx - 6, sy, 12, 2);
          ctx.fillRect(sx, sy - 4, 2, 8);
        }
      } else if (lane === "night") {
        // Star flecks + glowcaps.
        if (v > 0.86) {
          const tw = Math.abs(Math.sin(now / 600 + gx + gy * 2)) > 0.4;
          ctx.fillStyle = tw ? "#e9d5ff" : "#5b21b6";
          ctx.fillRect(sx - 1, sy - 4, 3, 9);
          ctx.fillRect(sx - 4, sy - 1, 9, 3);
        } else if (v > 0.76) {
          ctx.fillStyle = "#164e63";
          ctx.fillRect(sx - 3, sy - 5, 6, 8);
          ctx.fillStyle = "#22d3ee";
          ctx.fillRect(sx - 3, sy - 5, 6, 2);
        }
      } else if (lane === "demon") {
        // Glowing lava fissures + cold cinders.
        if (v > 0.8) {
          const flick = 0.5 + 0.5 * Math.sin(now / 260 + gx * 2.3 + gy * 1.9);
          ctx.fillStyle = "#450a0a";
          ctx.fillRect(sx - 12, sy - 3, 24, 6);
          ctx.fillRect(sx - 3, sy - 10, 6, 20);
          ctx.fillStyle = flick > 0.35 ? "#f97316" : "#7c2d12";
          ctx.fillRect(sx - 10, sy - 1, 20, 2);
          ctx.fillRect(sx - 1, sy - 8, 2, 16);
          if (flick > 0.6) {
            ctx.fillStyle = "#fef08a";
            ctx.fillRect(sx - 4, sy - 1, 8, 2);
          }
        } else if (v > 0.66) {
          ctx.fillStyle = "#292524";
          ctx.fillRect(sx, sy, 5, 4);
        }
      } else if (lane === "final") {
        // Shattered pale cracks + rune shards.
        if (v > 0.84) {
          ctx.fillStyle = "#1c1917";
          ctx.fillRect(sx - 10, sy - 1, 20, 2);
          ctx.fillRect(sx + 2, sy - 7, 2, 12);
          ctx.fillStyle = "#a78bfa";
          ctx.fillRect(sx - 2, sy - 2, 4, 4);
        } else if (v > 0.7) {
          ctx.fillStyle = "#57534e";
          ctx.fillRect(sx - 6, sy, 12, 2);
        }
      }
    }
  }
  ctx.restore();
}

// ---------- Weather pass (called after entities, before lighting) ----------
// Fog sits above entities so the graveyard really does cut visibility.
export function renderBiomeWeather(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cx: number,
  cy: number,
  now: number
) {
  const camZone = worldZoneAt(cx, cy)?.id ?? null;

  if (camZone === "graveyard") {
    ctx.save();
    for (let i = 0; i < 12; i++) {
      const seed = i * 173.3;
      const speed = 12 + (i % 4) * 6;
      const span = w + 480;
      const sx = ((seed * 37 + (now / 1000) * speed) % span + span) % span - 240;
      const sy = ((seed * 91) % (h + 320) + h + 320) % (h + 320) - 160 +
        Math.sin(now / 2400 + seed) * 24;
      const r = 110 + (i % 5) * 26;
      const g = ctx.createRadialGradient(sx, sy, 10, sx, sy, r);
      g.addColorStop(0, "rgba(148, 163, 184, 0.16)");
      g.addColorStop(1, "rgba(148, 163, 184, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
    }
    ctx.restore();
  }

  if (camZone === "final") {
    // Levitating rock shards with ground shadows.
    ctx.save();
    const cell = 260;
    const startX = Math.floor((cx - w / 2) / cell);
    const endX = Math.floor((cx + w / 2) / cell);
    const startY = Math.floor((cy - h / 2) / cell);
    const endY = Math.floor((cy + h / 2) / cell);
    for (let gx = startX; gx <= endX; gx++) {
      for (let gy = startY; gy <= endY; gy++) {
        if (hash2(gx, gy) < 0.55) continue;
        const wx = gx * cell + hash2(gx * 2, gy) * cell;
        const wy = gy * cell + hash2(gx, gy * 2) * cell;
        if ((worldZoneAt(wx, wy)?.id ?? null) !== "final") continue;
        const sx = wx - cx + w / 2;
        const sy = wy - cy + h / 2;
        const s = 8 + Math.floor(hash2(gy, gx) * 10);
        const bob = Math.sin(now / 700 + gx * 1.3 + gy) * 7;
        ctx.fillStyle = "rgba(0, 0, 0, 0.30)";
        ctx.beginPath();
        ctx.ellipse(sx, sy + 6, s, s * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
        const lift = 26 + bob;
        ctx.fillStyle = "#44403c";
        ctx.fillRect(sx - s / 2, sy - lift - s / 2, s, s);
        ctx.fillStyle = "#a8a29e";
        ctx.fillRect(sx - s / 2, sy - lift - s / 2, s, 2);
        ctx.fillStyle = "#a78bfa";
        ctx.fillRect(sx - 1, sy - lift - 1, 2, 2);
      }
    }
    ctx.restore();
  }

  if (camZone === "demon") {
    // Rising heat embers.
    ctx.save();
    for (let i = 0; i < 24; i++) {
      const seed = i * 91.7;
      const rise = (now / 30 + seed * 53) % (h + 60);
      const sx = ((seed * 197) % (w + 60) + w + 60) % (w + 60) - 30 +
        Math.sin(now / 800 + seed) * 18;
      const sy = h + 30 - rise;
      ctx.fillStyle = `rgba(249, 115, 22, ${0.45 + 0.35 * Math.sin(now / 280 + seed)})`;
      ctx.fillRect(sx, sy, 3, 3);
    }
    ctx.restore();
  }
}

// ---------- Lighting pass (called right after renderLightingOverlay) ----------
export function renderBiomeLighting(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cx: number,
  cy: number,
  gameMinute: number,
  playerZoneId: string | null
) {
  const cycle = ((gameMinute % 1440) + 1440) % 1440;
  const nightAmount =
    cycle < 300 || cycle >= 1260
      ? 1
      : cycle < 420
      ? 1 - (cycle - 300) / 120
      : cycle < 1080
      ? 0
      : (cycle - 1080) / 180;

  ctx.save();
  // The Night lane is pitch black even at midday.
  if (playerZoneId === "night") {
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(4, 6, 20, 0.55)";
    ctx.fillRect(0, 0, w, h);
  }
  // The base is a warm sanctuary: gentle glow at all hours.
  const fx = CAMPFIRE_WORLD_X - cx + w / 2;
  const fy = CAMPFIRE_WORLD_Y - cy + h / 2;
  if (fx > -420 && fy > -420 && fx < w + 420 && fy < h + 420) {
    const flick = 0.9 + 0.1 * Math.sin(Date.now() / 400);
    ctx.globalCompositeOperation = "screen";
    const glow = ctx.createRadialGradient(fx, fy, 20, fx, fy, 420 * flick);
    glow.addColorStop(0, `rgba(255, 205, 130, ${0.14 + 0.22 * nightAmount})`);
    glow.addColorStop(1, "rgba(255, 205, 130, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(fx - 420, fy - 420, 840, 840);
  }
  ctx.restore();
}
