// arena/minimap.ts
import { Enemy, Npc, Clone, Warrior } from "./types";
import { TERRITORY_ZONES, VILLAGE_BASE_CENTER } from "./world";

const WORLD_BOUNDS = { minX: -34500, minY: -34500, maxX: 34500, maxY: 34500 };
const ZONE_COLORS: Record<string, string> = {
  beginner: "#4ade80",
  forest: "#fb923c",
  goblin: "#818cf8",
  graveyard: "#cbd5e1",
  night: "#a78bfa",
  demon: "#f87171",
  final: "#d8b4fe",
};

export function renderMinimap(
  canvas: HTMLCanvasElement | null,
  px: number,
  py: number,
  enemies: Enemy[],
  npcs: Npc[],
  clones: Clone[],
  warriors: Warrior[],
  remotePlayers?: { x: number; y: number }[]
) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const mmW = canvas.width;
  const mmH = canvas.height;
  ctx.clearRect(0, 0, mmW, mmH);

  const worldWidth = WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX;
  const worldHeight = WORLD_BOUNDS.maxY - WORLD_BOUNDS.minY;
  const scale = Math.min(mmW / worldWidth, mmH / worldHeight) * 0.9;
  const offsetX = (mmW - worldWidth * scale) / 2;
  const offsetY = (mmH - worldHeight * scale) / 2;
  const worldToMmX = (wx: number) => offsetX + (wx - WORLD_BOUNDS.minX) * scale;
  const worldToMmY = (wy: number) => offsetY + (wy - WORLD_BOUNDS.minY) * scale;

  // Background
  ctx.fillStyle = "rgba(7, 18, 28, 0.94)";
  ctx.fillRect(0, 0, mmW, mmH);

  // Bullseye lanes: concentric rings around the base, outer lanes first
  // so inner fills overdraw them.
  const vbX = worldToMmX(VILLAGE_BASE_CENTER.x);
  const vbY = worldToMmY(VILLAGE_BASE_CENTER.y);
  const ordered = [...TERRITORY_ZONES].reverse();
  for (const zone of ordered) {
    const color = ZONE_COLORS[zone.id] ?? "#94a3b8";
    ctx.fillStyle = `${color}18`;
    ctx.beginPath();
    ctx.arc(vbX, vbY, zone.outerR * scale, 0, Math.PI * 2);
    ctx.arc(vbX, vbY, zone.innerR * scale, 0, Math.PI * 2, true);
    ctx.fill();
  }
  for (const zone of TERRITORY_ZONES) {
    const color = ZONE_COLORS[zone.id] ?? "#94a3b8";
    ctx.strokeStyle = `${color}88`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(vbX, vbY, zone.outerR * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(vbX, vbY, zone.innerR * scale, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Base marker.
  ctx.fillStyle = "#fbbf24";
  ctx.fillRect(vbX - 3, vbY - 3, 6, 6);

  // Enemies & Bosses
  for (const enemy of enemies) {
    const mx = worldToMmX(enemy.x);
    const my = worldToMmY(enemy.y);
    if (mx >= 0 && mx <= mmW && my >= 0 && my <= mmH) {
      if (enemy.kind === "skeletonKing") {
        ctx.fillStyle = "#c026d3"; // distinct purple boss marker
        ctx.fillRect(mx - 3, my - 3, 6, 6);
      } else if (enemy.kind === "necromancer") {
        ctx.fillStyle = "#a855f7"; // purple caster marker
        ctx.fillRect(mx - 2, my - 2, 4, 4);
      } else {
        ctx.fillStyle = "#f87171";
        ctx.fillRect(mx - 1.5, my - 1.5, 3, 3);
      }
    }
  }

  // NPCs (Yellow)
  ctx.fillStyle = "#facc15";
  for (const npc of npcs) {
    const mx = worldToMmX(npc.x);
    const my = worldToMmY(npc.y);
    if (mx >= 0 && mx <= mmW && my >= 0 && my <= mmH) {
      ctx.fillRect(mx - 2, my - 2, 4, 4);
    }
  }

  // Clones (Cyan / Sky-blue)
  ctx.fillStyle = "#38bdf8";
  for (const clone of clones) {
    const mx = worldToMmX(clone.x);
    const my = worldToMmY(clone.y);
    if (mx >= 0 && mx <= mmW && my >= 0 && my <= mmH) {
      ctx.fillRect(mx - 2, my - 2, 4, 4);
    }
  }

  // Warriors (Orange)
  ctx.fillStyle = "#fb923c";
  for (const warrior of warriors) {
    if (warrior.state === "dead") continue;
    const mx = worldToMmX(warrior.x);
    const my = worldToMmY(warrior.y);
    if (mx >= 0 && mx <= mmW && my >= 0 && my <= mmH) {
      ctx.fillRect(mx - 2, my - 2, 4, 4);
    }
  }

  // Teammates / Remote Players (Cyan with blue border)
  if (remotePlayers) {
    for (const rp of remotePlayers) {
      const rx = worldToMmX(rp.x);
      const ry = worldToMmY(rp.y);
      if (rx >= 0 && rx <= mmW && ry >= 0 && ry <= mmH) {
        ctx.fillStyle = "#38bdf8";
        ctx.beginPath();
        ctx.arc(rx, ry, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#0284c7";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }

  // Player (Green)
  const playerMx = worldToMmX(px);
  const playerMy = worldToMmY(py);
  ctx.fillStyle = "#f8fafc";
  ctx.beginPath();
  ctx.arc(playerMx, playerMy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#22c55e";
  ctx.lineWidth = 2;
  ctx.stroke();
}

