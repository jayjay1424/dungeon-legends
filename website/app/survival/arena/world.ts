// arena/world.ts
import { Tree } from "./types";
import styles from "../survival.module.css";

export const DECOR_SPACING = 220;
export const FLOOR_TILE_SIZE = 160;
export const WORLD_SEED = 1337;
export const Z_BASE = 1_000_000;
export const VILLAGE_BASE_CENTER = { x: 0, y: -150 };
export const VILLAGE_TREE_WALL_INNER_RADIUS = 500;
export const VILLAGE_TREE_WALL_OUTER_RADIUS = 680;
export const GAME_DAY_LENGTH_MS = 180000;
export const GAME_START_MINUTE = 8 * 60;

export function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

export function tileNoise(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + WORLD_SEED * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

export const AUTUMN_FRAME_COUNT = 16;
export const AUTUMN_FRAME_MS = 130;
export const AUTUMN_DISPLAY_SIZE = 150;
// Respawn point must stay clear so players never spawn inside a tree.
export const RESPAWN_POINT = { x: 0, y: 0 };
export const RESPAWN_CLEAR_RADIUS = 380;
function treeHitsHouse(
  treeLeft: number,
  treeRight: number,
  treeTop: number,
  treeBottom: number
): boolean {
  const m = 24;
  for (const h of HOUSES) {
    const houseLeft = h.x - HOUSE_DISPLAY_W / 2 - m;
    const houseRight = h.x + HOUSE_DISPLAY_W / 2 + m;
    const houseTop = h.y - HOUSE_DISPLAY_H - m;
    const houseBottom = h.y + m;
    if (
      treeLeft < houseRight &&
      treeRight > houseLeft &&
      treeTop < houseBottom &&
      treeBottom > houseTop
    ) {
      return true;
    }
  }
  return false;
}

export function decorationFor(x: number, y: number): string | null {
  const treeCenterX = x * DECOR_SPACING + DECOR_SPACING / 2;
  const treeBaseY = (y + 1) * DECOR_SPACING - 18;
  const respawnDist = Math.hypot(
    treeCenterX - RESPAWN_POINT.x,
    treeBaseY - RESPAWN_POINT.y
  );
  if (respawnDist < RESPAWN_CLEAR_RADIUS) return null;
  // Never grow through a house (full sprite rect vs full house rect).
  const treeTop = (y + 1) * DECOR_SPACING - 18 - AUTUMN_DISPLAY_SIZE;
  if (
    treeHitsHouse(
      treeCenterX - AUTUMN_DISPLAY_SIZE / 2,
      treeCenterX + AUTUMN_DISPLAY_SIZE / 2,
      treeTop,
      treeBaseY
    )
  ) {
    return null;
  }
  // Keep the campfire clearing free.
  const fireDist = Math.hypot(
    treeCenterX - CAMPFIRE_WORLD_X,
    treeBaseY - CAMPFIRE_WORLD_Y
  );
  if (fireDist < 130) return null;
  // Keep vendor stalls (store/craft) clear of trees too.
  for (const vendor of BASE_PROPS) {
    const m = 20;
    const treeLeft = treeCenterX - AUTUMN_DISPLAY_SIZE / 2;
    const treeRight = treeCenterX + AUTUMN_DISPLAY_SIZE / 2;
    const treeTop = treeBaseY - AUTUMN_DISPLAY_SIZE;
    if (
      treeLeft < vendor.x + vendor.w / 2 + m &&
      treeRight > vendor.x - vendor.w / 2 - m &&
      treeTop < vendor.y + vendor.h / 2 + m &&
      treeBaseY > vendor.y - vendor.h / 2 - m
    ) {
      return null;
    }
  }
  const villageDistance = Math.hypot(
    treeCenterX - VILLAGE_BASE_CENTER.x,
    treeBaseY - VILLAGE_BASE_CENTER.y
  );
  if (
    villageDistance >= VILLAGE_TREE_WALL_INNER_RADIUS &&
    villageDistance <= VILLAGE_TREE_WALL_OUTER_RADIUS
  ) {
    return "tree_autumn_anim";
  }
  const v = tileNoise(x + 500, y + 500);
  if (v > 0.86) return "tree_autumn_anim";
  return null;
}

export const HOUSE_FRAME_W = 290;
export const HOUSE_FRAME_H = 142;
export const HOUSE_SCALE = 3;
export const HOUSE_DISPLAY_W = HOUSE_FRAME_W * HOUSE_SCALE;
export const HOUSE_DISPLAY_H = HOUSE_FRAME_H * HOUSE_SCALE;

export const HOUSES: { x: number; y: number; src: string }[] = [
  { x: -520, y: -300, src: "/house-teal.png" },
  { x: 0, y: -560, src: "/house-purple.png" },
  { x: 520, y: -300, src: "/house-red.png" },
];

export const HOUSE_COLLISION_HALF_W = HOUSE_DISPLAY_W * 0.44;
export const HOUSE_COLLISION_FRONT_Y = 10;
export const HOUSE_COLLISION_BACK = HOUSE_DISPLAY_H * 0.55;
export const PLAYER_COLLISION_RADIUS = 26;
export const TREE_TRUNK_RADIUS = 22;
export const CAMPFIRE_COLLISION_RADIUS = 30;

export const CAMPFIRE_FRAME_SIZE = 32;
export const CAMPFIRE_FRAME_COUNT = 8;
export const CAMPFIRE_SCALE = 3;
export const CAMPFIRE_DISPLAY = CAMPFIRE_FRAME_SIZE * CAMPFIRE_SCALE;
export const CAMPFIRE_ANIM_MS = 100;
export const CAMPFIRE_WORLD_X = 0;
export const CAMPFIRE_WORLD_Y = -150;

// Bullseye layout: concentric lanes around the base (VILLAGE_BASE_CENTER).
// innerR/outerR are distances from the base. 2500px of wilds between lanes.
export const TERRITORY_ZONES = [
  {
    id: "beginner",
    name: "Beginner Zone",
    innerR: 3300,
    outerR: 5500,
    color: "rgba(34, 197, 94, 0.12)",
    border: "rgba(74, 222, 128, 0.6)",
  },
  {
    id: "forest",
    name: "Forest Zone",
    innerR: 8000,
    outerR: 10200,
    color: "rgba(153, 78, 30, 0.12)",
    border: "rgba(251, 146, 60, 0.6)",
  },
  {
    id: "goblin",
    name: "Goblin Zone",
    innerR: 12700,
    outerR: 14900,
    color: "rgba(99, 102, 241, 0.12)",
    border: "rgba(129, 140, 248, 0.6)",
  },
  {
    id: "graveyard",
    name: "Graveyard",
    innerR: 17400,
    outerR: 19600,
    color: "rgba(148, 163, 184, 0.12)",
    border: "rgba(226, 232, 240, 0.7)",
  },
  {
    id: "night",
    name: "Night Zone",
    innerR: 22100,
    outerR: 24300,
    color: "rgba(79, 70, 229, 0.14)",
    border: "rgba(167, 139, 250, 0.75)",
  },
  {
    id: "demon",
    name: "Demon Area",
    innerR: 26800,
    outerR: 29000,
    color: "rgba(239, 68, 68, 0.14)",
    border: "rgba(248, 113, 113, 0.75)",
  },
  {
    id: "final",
    name: "Final Area",
    innerR: 31500,
    outerR: 33700,
    color: "rgba(168, 85, 247, 0.15)",
    border: "rgba(196, 181, 253, 0.8)",
  },
] as const;

export function distFromBase(x: number, y: number): number {
  return Math.hypot(x - VILLAGE_BASE_CENTER.x, y - VILLAGE_BASE_CENTER.y);
}

export const DEMON_FIRE_FRAME_COUNT = 5;
export const DEMON_FIRE_DISPLAY = 1;
export const DEMON_FIRE_LOCATIONS = [
  { x: 7260, y: 26740, sheet: 3 },
  { x: 7600, y: 26800, sheet: 4 },
  { x: 7820, y: 27020, sheet: 3 },
  { x: 7370, y: 27240, sheet: 4 },
  { x: 7700, y: 27380, sheet: 3 },
] as const;

// ---------- Base vendors (flanking the respawn point) ----------
// x/y is the sprite CENTER in world coordinates.
export type BaseProp = {
  id: string;
  label: string;
  x: number;
  y: number;
  src: string;
  w: number;
  h: number;
  hw: number;
  hh: number;
};

export const BASE_PROPS: BaseProp[] = [
  { id: "store", label: "STORE", x: -810, y: 40, src: "/store.png", w: 180, h: 232, hw: 76, hh: 98 },
  { id: "craft", label: "CRAFT", x: 810, y: 40, src: "/craft.png", w: 196, h: 233, hw: 84, hh: 98 },
  { id: "incubator", label: "HATCH", x: 1150, y: 40, src: "/incubator.png", w: 240, h: 271, hw: 100, hh: 120 },
];

export function resolveBasePropCollisions(x: number, y: number) {
  for (const prop of BASE_PROPS) {
    const minX = prop.x - prop.hw;
    const maxX = prop.x + prop.hw;
    const minY = prop.y - prop.hh;
    const maxY = prop.y + prop.hh;
    const closestX = Math.max(minX, Math.min(x, maxX));
    const closestY = Math.max(minY, Math.min(y, maxY));
    const dx = x - closestX;
    const dy = y - closestY;
    const distSq = dx * dx + dy * dy;
    if (distSq < PLAYER_COLLISION_RADIUS * PLAYER_COLLISION_RADIUS) {
      if (distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        const overlap = PLAYER_COLLISION_RADIUS - dist;
        x += (dx / dist) * overlap;
        y += (dy / dist) * overlap;
      } else {
        y = maxY + PLAYER_COLLISION_RADIUS;
      }
    }
  }
  return { x, y };
}

// ---------- Demon fortress props (cut from the demon asset sheet) ----------
// prop.x / prop.y is the sprite CENTER in world coordinates.
export type DemonPropCollider =
  | { kind: "circle"; r: number }
  | { kind: "rect"; hw: number; hh: number };

export type DemonProp = {
  id: string;
  x: number;
  y: number;
  src: string;
  w: number;
  h: number;
  collider: DemonPropCollider | null;
};

export const DEMON_PROPS: DemonProp[] = [
  { id: "prisonwall", x: 7430, y: 26660, src: "/demon_prisonwall.png", w: 482, h: 124, collider: { kind: "rect", hw: 235, hh: 30 } },
  { id: "archgate", x: 7440, y: 27080, src: "/demon_archgate.png", w: 259, h: 140, collider: { kind: "rect", hw: 110, hh: 32 } },
  { id: "portal", x: 7220, y: 26980, src: "/demon_portal.png", w: 133, h: 155, collider: { kind: "circle", r: 45 } },
  { id: "throne", x: 7580, y: 26980, src: "/demon_throne.png", w: 61, h: 150, collider: { kind: "circle", r: 28 } },
  { id: "forge", x: 7300, y: 26860, src: "/demon_forge.png", w: 92, h: 99, collider: { kind: "circle", r: 36 } },
  { id: "chest", x: 7510, y: 26810, src: "/demon_chest.png", w: 68, h: 70, collider: { kind: "circle", r: 26 } },
  { id: "skulls", x: 7250, y: 26910, src: "/demon_skulls.png", w: 90, h: 72, collider: null },
  { id: "candles", x: 7180, y: 26890, src: "/demon_candles.png", w: 70, h: 86, collider: null },
  { id: "candles2", x: 7560, y: 26890, src: "/demon_candles.png", w: 70, h: 86, collider: null },
  { id: "torch", x: 7310, y: 26700, src: "/demon_torch.png", w: 39, h: 110, collider: { kind: "circle", r: 12 } },
  { id: "torch2", x: 7550, y: 26700, src: "/demon_torch.png", w: 39, h: 110, collider: { kind: "circle", r: 12 } },
  { id: "weapons", x: 7335, y: 26895, src: "/demon_weapons.png", w: 110, h: 64, collider: null },
  { id: "lava1", x: 7700, y: 26750, src: "/demon_lava1.png", w: 70, h: 103, collider: { kind: "circle", r: 30 } },
  { id: "lava2", x: 7160, y: 27160, src: "/demon_lava2.png", w: 106, h: 110, collider: { kind: "circle", r: 44 } },
  { id: "lava3", x: 7780, y: 27180, src: "/demon_lava3.png", w: 106, h: 104, collider: { kind: "circle", r: 44 } },
];

export function worldZoneAt(x: number, y: number) {
  const d = distFromBase(x, y);
  return (
    TERRITORY_ZONES.find((zone) => d >= zone.innerR && d <= zone.outerR) ??
    null
  );
}

export function renderTerritoryZones(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cx: number,
  cy: number
) {
  const bx = VILLAGE_BASE_CENTER.x - cx + w / 2;
  const by = VILLAGE_BASE_CENTER.y - cy + h / 2;
  const viewR = Math.hypot(w, h) / 2 + 80;
  for (const zone of TERRITORY_ZONES) {
    const distCam = Math.hypot(bx, by);
    // Skip rings fully outside the view.
    if (distCam > zone.outerR + viewR) continue;
    if (distCam + viewR < zone.innerR) continue;

    ctx.save();
    // Tinted lane band.
    ctx.fillStyle = zone.color;
    ctx.beginPath();
    ctx.arc(bx, by, zone.outerR, 0, Math.PI * 2);
    ctx.arc(bx, by, zone.innerR, 0, Math.PI * 2, true);
    ctx.fill();
    // Glowing lane borders.
    ctx.strokeStyle = zone.border;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(bx, by, zone.outerR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(bx, by, zone.innerR, 0, Math.PI * 2);
    ctx.stroke();
    // Label pill at the south point of the lane.
    const midR = (zone.innerR + zone.outerR) / 2;
    const labelX = bx;
    const labelY = by + midR;
    if (labelX > -160 && labelY > -40 && labelX < w + 160 && labelY < h + 40) {
      ctx.font = "bold 16px sans-serif";
      const textW = ctx.measureText(zone.name).width;
      const pillW = textW + 24;
      const pillH = 28;
      ctx.fillStyle = "rgba(2,6,23,0.72)";
      ctx.strokeStyle = zone.border;
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(labelX - pillW / 2, labelY - pillH / 2, pillW, pillH, 9);
      else ctx.rect(labelX - pillW / 2, labelY - pillH / 2, pillW, pillH);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.textAlign = "center";
      ctx.fillText(zone.name, labelX, labelY + 6);
      ctx.textAlign = "left";
    }
    ctx.restore();
  }
}

export const SHADOW_OFFSET_X = -9;
export const SHADOW_OFFSET_Y = 7;
export const SHADOW_COLOR = "rgba(8,10,20,0.32)";

export function drawGroundShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number
) {
  ctx.save();
  ctx.fillStyle = SHADOW_COLOR;
  ctx.beginPath();
  ctx.ellipse(x + SHADOW_OFFSET_X, y + SHADOW_OFFSET_Y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function renderHpLabel(
  el: HTMLDivElement | null,
  hp: number,
  maxHp: number,
  screenX: number,
  screenY: number,
  offscreen: boolean,
  name?: string,
  showName = false,
  isBoss = false
) {
  if (!el) return;
  const pct = maxHp > 0 ? hp / maxHp : 0;
  const fillColor = pct > 0.5 ? "#35b94f" : pct > 0.25 ? "#ffb52e" : "#e11d2e";
  const percentage = Math.round(Math.max(0, Math.min(1, pct)) * 100);
  const signature = `${Math.round(hp)}:${maxHp}:${percentage}:${fillColor}:${name ?? ""}:${showName}:${isBoss}`;
  if (el.dataset.hpSignature !== signature) {
    el.innerHTML = `${showName && name ? `<span class="hpName">${name}</span>` : ""}<span class="hpTrack"><span class="hpFill" style="width:${percentage}%;background:${fillColor}"></span></span>`;
    el.dataset.hpSignature = signature;
  }
  el.classList.toggle("bossHpLabel", isBoss);
  el.style.transform = `translate(${screenX}px, ${screenY}px)`;
  el.style.opacity = offscreen || hp <= 0 ? "0" : "1";
  el.style.zIndex = String(Z_BASE * 2);
}

export function nearestHouse(x: number, y: number) {
  let best = HOUSES[0];
  let bestDist = Infinity;
  for (const h of HOUSES) {
    const d = Math.hypot(h.x - x, h.y - y);
    if (d < bestDist) {
      bestDist = d;
      best = h;
    }
  }
  return best;
}

export function resolveHouseCollisions(x: number, y: number) {
  for (const h of HOUSES) {
    const minX = h.x - HOUSE_COLLISION_HALF_W;
    const maxX = h.x + HOUSE_COLLISION_HALF_W;
    const maxY = h.y + HOUSE_COLLISION_FRONT_Y;
    const minY = h.y - HOUSE_COLLISION_BACK;

    const closestX = Math.max(minX, Math.min(x, maxX));
    const closestY = Math.max(minY, Math.min(y, maxY));
    const dx = x - closestX;
    const dy = y - closestY;
    const distSq = dx * dx + dy * dy;

    if (distSq < PLAYER_COLLISION_RADIUS * PLAYER_COLLISION_RADIUS) {
      if (distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        const overlap = PLAYER_COLLISION_RADIUS - dist;
        x += (dx / dist) * overlap;
        y += (dy / dist) * overlap;
      } else {
        const pushLeft = x - minX;
        const pushRight = maxX - x;
        const pushUp = y - minY;
        const pushDown = maxY - y;
        const smallest = Math.min(pushLeft, pushRight, pushUp, pushDown);
        if (smallest === pushLeft) x = minX - PLAYER_COLLISION_RADIUS;
        else if (smallest === pushRight) x = maxX + PLAYER_COLLISION_RADIUS;
        else if (smallest === pushUp) y = minY - PLAYER_COLLISION_RADIUS;
        else y = maxY + PLAYER_COLLISION_RADIUS;
      }
    }
  }
  return { x, y };
}

export function resolveTreeCollisions(
  x: number,
  y: number,
  trees: Map<string, Tree>
) {
  for (const tree of trees.values()) {
    const treeCenterX = tree.tx * DECOR_SPACING + DECOR_SPACING / 2;
    const treeBaseY = (tree.ty + 1) * DECOR_SPACING - 18;
    const dx = x - treeCenterX;
    const dy = y - treeBaseY;
    const dist = Math.hypot(dx, dy);
    const minDist = PLAYER_COLLISION_RADIUS + TREE_TRUNK_RADIUS;
    if (dist < minDist) {
      if (dist > 0.0001) {
        const overlap = minDist - dist;
        x += (dx / dist) * overlap;
        y += (dy / dist) * overlap;
      } else {
        x += minDist;
      }
    }
  }
  return { x, y };
}

export const CLONE_COLLISION_RADIUS = 26;
export const KNIGHT_COLLISION_RADIUS = 26;

/**
 * Equal-force shove: the enemy and the clone each absorb half the overlap,
 * so clones block without teleporting enemies. Dead clones are skipped.
 * Mutates clone positions in place; returns the enemy's resolved position.
 */
export function resolveCloneCollisions(
  x: number,
  y: number,
  clones: { x: number; y: number; hp: number }[]
) {
  for (const clone of clones) {
    if (clone.hp <= 0) continue;
    const dx = x - clone.x;
    const dy = y - clone.y;
    const dist = Math.hypot(dx, dy);
    const minDist = PLAYER_COLLISION_RADIUS + CLONE_COLLISION_RADIUS;
    if (dist < minDist) {
      if (dist > 0.0001) {
        const half = (minDist - dist) / 2;
        x += (dx / dist) * half;
        y += (dy / dist) * half;
        clone.x -= (dx / dist) * half;
        clone.y -= (dy / dist) * half;
      } else {
        x += minDist / 2;
        clone.x -= minDist / 2;
      }
    }
  }
  return { x, y };
}

/**
 * Knights hold the line: enemies cannot pass through living knights and
 * absorb the full push themselves. The player still walks through knights.
 */
export function resolveKnightCollisions(
  x: number,
  y: number,
  knights: { x: number; y: number; hp: number; state: string }[]
) {
  for (const knight of knights) {
    if (knight.hp <= 0 || knight.state === "dead") continue;
    const dx = x - knight.x;
    const dy = y - knight.y;
    const dist = Math.hypot(dx, dy);
    const minDist = PLAYER_COLLISION_RADIUS + KNIGHT_COLLISION_RADIUS;
    if (dist < minDist) {
      if (dist > 0.0001) {
        const overlap = minDist - dist;
        x += (dx / dist) * overlap;
        y += (dy / dist) * overlap;
      } else {
        x += minDist;
      }
    }
  }
  return { x, y };
}

export function resolveCampfireCollision(x: number, y: number) {
  const dx = x - CAMPFIRE_WORLD_X;
  const dy = y - CAMPFIRE_WORLD_Y;
  const dist = Math.hypot(dx, dy);
  const minDist = PLAYER_COLLISION_RADIUS + CAMPFIRE_COLLISION_RADIUS;
  if (dist < minDist) {
    if (dist > 0.0001) {
      const overlap = minDist - dist;
      x += (dx / dist) * overlap;
      y += (dy / dist) * overlap;
    } else {
      x += minDist;
    }
  }
  return { x, y };
}

export function resolveDemonPropCollisions(x: number, y: number) {
  for (const prop of DEMON_PROPS) {
    if (!prop.collider) continue;
    if (prop.collider.kind === "circle") {
      const dx = x - prop.x;
      const dy = y - prop.y;
      const dist = Math.hypot(dx, dy);
      const minDist = PLAYER_COLLISION_RADIUS + prop.collider.r;
      if (dist < minDist) {
        if (dist > 0.0001) {
          const overlap = minDist - dist;
          x += (dx / dist) * overlap;
          y += (dy / dist) * overlap;
        } else {
          x += minDist;
        }
      }
    } else {
      const minX = prop.x - prop.collider.hw;
      const maxX = prop.x + prop.collider.hw;
      const minY = prop.y - prop.collider.hh;
      const maxY = prop.y + prop.collider.hh;
      const closestX = Math.max(minX, Math.min(x, maxX));
      const closestY = Math.max(minY, Math.min(y, maxY));
      const dx = x - closestX;
      const dy = y - closestY;
      const distSq = dx * dx + dy * dy;
      if (distSq < PLAYER_COLLISION_RADIUS * PLAYER_COLLISION_RADIUS) {
        if (distSq > 0.0001) {
          const dist = Math.sqrt(distSq);
          const overlap = PLAYER_COLLISION_RADIUS - dist;
          x += (dx / dist) * overlap;
          y += (dy / dist) * overlap;
        } else {
          y = maxY + PLAYER_COLLISION_RADIUS;
        }
      }
    }
  }
  return { x, y };
}

export function resolveAllPlayerCollisions(
  x: number,
  y: number,
  trees: Map<string, Tree>
) {
  let resolved = resolveHouseCollisions(x, y);
  resolved = resolveTreeCollisions(resolved.x, resolved.y, trees);
  resolved = resolveCampfireCollision(resolved.x, resolved.y);
  resolved = resolveBasePropCollisions(resolved.x, resolved.y);
  resolved = resolveDemonPropCollisions(resolved.x, resolved.y);
  return resolved;
}

export function renderFloor(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cx: number,
  cy: number,
  pattern: CanvasPattern | null
) {
  ctx.clearRect(0, 0, w, h);
  if (pattern) {
    const offX = mod(w / 2 - cx, FLOOR_TILE_SIZE);
    const offY = mod(h / 2 - cy, FLOOR_TILE_SIZE);
    ctx.save();
    ctx.translate(offX, offY);
    ctx.fillStyle = pattern;
    ctx.fillRect(
      -offX - FLOOR_TILE_SIZE,
      -offY - FLOOR_TILE_SIZE,
      w + FLOOR_TILE_SIZE * 2,
      h + FLOOR_TILE_SIZE * 2
    );
    ctx.restore();
  } else {
    ctx.fillStyle = "#166534";
    ctx.fillRect(0, 0, w, h);
  }

}

export function updateEnvironmentDecor(
  container: HTMLDivElement,
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  now: number,
  treesMap: Map<string, Tree>,
  houseEls: HTMLDivElement[],
  campfireEl: HTMLDivElement | null,
  fireMap: Map<string, HTMLDivElement>,
  campfireLit: boolean = true
) {
  const startDecX = Math.floor((cx - w / 2) / DECOR_SPACING) - 1;
  const endDecX = Math.floor((cx + w / 2) / DECOR_SPACING) + 1;
  const startDecY = Math.floor((cy - h / 2) / DECOR_SPACING) - 1;
  const endDecY = Math.floor((cy + h / 2) / DECOR_SPACING) + 1;

  const activeTreeKeys = new Set<string>();

  for (let ty = startDecY; ty <= endDecY; ty++) {
    for (let tx = startDecX; tx <= endDecX; tx++) {
      const decoName = decorationFor(tx, ty);
      if (decoName !== "tree_autumn_anim") continue;

      const key = `${tx},${ty}`;
      activeTreeKeys.add(key);

      let tree = treesMap.get(key);
      if (!tree) {
        const el = document.createElement("div");
        el.className = styles.tree;
        el.style.width = `${AUTUMN_DISPLAY_SIZE}px`;
        el.style.height = `${AUTUMN_DISPLAY_SIZE}px`;
        el.style.backgroundImage = "url(/tree-autumn-animated.png)";
        el.style.backgroundSize = `${AUTUMN_FRAME_COUNT * AUTUMN_DISPLAY_SIZE}px ${AUTUMN_DISPLAY_SIZE}px`;
        container.appendChild(el);
        tree = { tx, ty, el };
        treesMap.set(key, tree);
      }

      const screenX = tx * DECOR_SPACING - cx + w / 2;
      const screenY = ty * DECOR_SPACING - cy + h / 2;
      const phase = Math.floor(tileNoise(tx * 13 + 7, ty * 17 + 3) * AUTUMN_FRAME_COUNT);
      const frame = (Math.floor(now / AUTUMN_FRAME_MS) + phase) % AUTUMN_FRAME_COUNT;
      const treeX = screenX + DECOR_SPACING / 2 - AUTUMN_DISPLAY_SIZE / 2;
      const treeY = screenY + DECOR_SPACING - AUTUMN_DISPLAY_SIZE;

      drawGroundShadow(
        ctx,
        treeX + AUTUMN_DISPLAY_SIZE / 2,
        treeY + AUTUMN_DISPLAY_SIZE - 10,
        AUTUMN_DISPLAY_SIZE * 0.3,
        AUTUMN_DISPLAY_SIZE * 0.12
      );

      tree.el.style.transform = `translate(${treeX}px, ${treeY}px)`;
      tree.el.style.backgroundPosition = `-${frame * AUTUMN_DISPLAY_SIZE}px 0px`;
      const treeAnchorY = (ty + 1) * DECOR_SPACING - 10;
      tree.el.style.zIndex = String(Z_BASE + Math.round(treeAnchorY));
    }
  }

  for (const [key, tree] of treesMap) {
    if (!activeTreeKeys.has(key)) {
      tree.el.remove();
      treesMap.delete(key);
    }
  }

  const activeFireKeys = new Set<string>();
  for (const fire of DEMON_FIRE_LOCATIONS) {
    const screenX = fire.x - cx + w / 2;
    const screenY = fire.y - cy + h / 2;
    const key = `${fire.x},${fire.y}`;
    activeFireKeys.add(key);

    let fireEl = fireMap.get(key);
    if (!fireEl) {
      fireEl = document.createElement("div");
      fireEl.className = styles.demonFire;
      fireEl.style.width = `${DEMON_FIRE_DISPLAY}px`;
      fireEl.style.height = `${DEMON_FIRE_DISPLAY}px`;
      fireEl.style.backgroundImage = `url(/Fire_0${fire.sheet}_160x160_Sheet.png)`;
      fireEl.style.backgroundSize = `${DEMON_FIRE_DISPLAY * DEMON_FIRE_FRAME_COUNT}px ${DEMON_FIRE_DISPLAY}px`;
      container.appendChild(fireEl);
      fireMap.set(key, fireEl);
    }

    const frame = Math.floor(now / 120) % DEMON_FIRE_FRAME_COUNT;
    fireEl.style.backgroundPosition = `-${frame * DEMON_FIRE_DISPLAY}px 0px`;
    fireEl.style.transform = `translate(${screenX - DEMON_FIRE_DISPLAY / 2}px, ${screenY - DEMON_FIRE_DISPLAY}px)`;
    fireEl.style.zIndex = String(Z_BASE - 100000);
  }

  for (const [key, fireEl] of fireMap) {
    if (!activeFireKeys.has(key)) {
      fireEl.remove();
      fireMap.delete(key);
    }
  }

  HOUSES.forEach((house, i) => {
    const houseScreenX = house.x - cx + w / 2;
    const houseScreenY = house.y - cy + h / 2;
    const el = houseEls[i];
    if (el) {
      el.style.transform = `translate(${houseScreenX - HOUSE_DISPLAY_W / 2}px, ${
        houseScreenY - HOUSE_DISPLAY_H
      }px)`;
    }
  });

  if (campfireEl) {
    const cfScreenX = CAMPFIRE_WORLD_X - cx + w / 2;
    const cfScreenY = CAMPFIRE_WORLD_Y - cy + h / 2;
    // Destroyed base: the fire freezes cold and grey until repaired.
    const frame = campfireLit
      ? Math.floor(now / CAMPFIRE_ANIM_MS) % CAMPFIRE_FRAME_COUNT
      : 0;
    campfireEl.style.filter = campfireLit
      ? ""
      : "grayscale(1) brightness(0.55)";
    drawGroundShadow(
      ctx,
      cfScreenX,
      cfScreenY + CAMPFIRE_DISPLAY * 0.32,
      CAMPFIRE_DISPLAY * 0.28,
      CAMPFIRE_DISPLAY * 0.1
    );
    campfireEl.style.backgroundPosition = `-${frame * CAMPFIRE_DISPLAY}px 0px`;
    campfireEl.style.transform = `translate(${
      cfScreenX - CAMPFIRE_DISPLAY / 2
    }px, ${cfScreenY - CAMPFIRE_DISPLAY / 2}px)`;
  }
}

export function renderLightingOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cx: number,
  cy: number,
  gameMinute: number
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
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = `rgba(7, 13, 43, ${0.64 * nightAmount})`;
  ctx.fillRect(0, 0, w, h);
  if (nightAmount > 0) {
    const fireX = CAMPFIRE_WORLD_X - cx + w / 2;
    const fireY = CAMPFIRE_WORLD_Y - cy + h / 2;
    const glow = ctx.createRadialGradient(fireX, fireY, 18, fireX, fireY, 300);
    glow.addColorStop(0, `rgba(255, 190, 74, ${0.5 * nightAmount})`);
    glow.addColorStop(0.35, `rgba(255, 128, 48, ${0.2 * nightAmount})`);
    glow.addColorStop(1, "rgba(255, 128, 48, 0)");
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
}

export function updateDemonProps(
  container: HTMLDivElement,
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  els: Map<string, HTMLDivElement>
) {
  const active = new Set<string>();
  for (const prop of DEMON_PROPS) {
    const sx = prop.x - cx + w / 2;
    const sy = prop.y - cy + h / 2;
    if (sx < -prop.w || sy < -prop.h || sx > w + prop.w || sy > h + prop.h) {
      continue;
    }
    active.add(prop.id);
    let el = els.get(prop.id);
    if (!el) {
      el = document.createElement("div");
      el.className = styles.demonProp;
      el.style.width = `${prop.w}px`;
      el.style.height = `${prop.h}px`;
      el.style.backgroundImage = `url(${prop.src})`;
      el.style.backgroundSize = `${prop.w}px ${prop.h}px`;
      container.appendChild(el);
      els.set(prop.id, el);
    }
    drawGroundShadow(ctx, sx, sy + prop.h * 0.3, prop.w * 0.26, prop.h * 0.09);
    el.style.transform = `translate(${sx - prop.w / 2}px, ${sy - prop.h / 2}px)`;
    el.style.zIndex = String(Z_BASE + Math.round(prop.y + prop.h / 2));
  }
  for (const [id, el] of els) {
    if (!active.has(id)) {
      el.remove();
      els.delete(id);
    }
  }
}

export function cleanupDemonProps(els: Map<string, HTMLDivElement>) {
  els.forEach((el) => el.remove());
  els.clear();
}

export function updateBaseProps(
  container: HTMLDivElement,
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  els: Map<string, HTMLDivElement>,
  labels: Map<string, HTMLDivElement>
) {
  const active = new Set<string>();
  for (const prop of BASE_PROPS) {
    const sx = prop.x - cx + w / 2;
    const sy = prop.y - cy + h / 2;
    if (sx < -prop.w || sy < -prop.h || sx > w + prop.w || sy > h + prop.h) {
      continue;
    }
    active.add(prop.id);
    let el = els.get(prop.id);
    if (!el) {
      el = document.createElement("div");
      el.className = styles.baseProp;
      el.style.width = `${prop.w}px`;
      el.style.height = `${prop.h}px`;
      el.style.backgroundImage = `url(${prop.src})`;
      el.style.backgroundSize = `${prop.w}px ${prop.h}px`;
      // Clickable so players can inspect the stall. Block the arena
      // attack swing on mousedown; selection is handled by the
      // arena's delegated click inspector via getBoundingClientRect.
      el.style.pointerEvents = "auto";
      el.style.cursor = "pointer";
      el.addEventListener("mousedown", (e) => e.stopPropagation());
      container.appendChild(el);
      els.set(prop.id, el);
    }
    drawGroundShadow(ctx, sx, sy + prop.h * 0.32, prop.w * 0.26, prop.h * 0.08);
    el.style.transform = `translate(${sx - prop.w / 2}px, ${sy - prop.h / 2}px)`;
    el.style.zIndex = String(Z_BASE + Math.round(prop.y + prop.h / 2));
    let label = labels.get(prop.id);
    if (!label) {
      label = document.createElement("div");
      label.className = styles.basePropLabel;
      label.textContent = prop.label;
      container.appendChild(label);
      labels.set(prop.id, label);
    }
    label.style.transform = `translate(${sx}px, ${sy - prop.h / 2 - 30}px) translateX(-50%)`;
    label.style.zIndex = String(Z_BASE + Math.round(prop.y + prop.h / 2) + 5);
  }
  for (const [id, el] of els) {
    if (!active.has(id)) {
      el.remove();
      els.delete(id);
    }
  }
  for (const [id, label] of labels) {
    if (!active.has(id)) {
      label.remove();
      labels.delete(id);
    }
  }
}

export function cleanupBaseProps(
  els: Map<string, HTMLDivElement>,
  labels: Map<string, HTMLDivElement>
) {
  els.forEach((el) => el.remove());
  els.clear();
  labels.forEach((label) => label.remove());
  labels.clear();
}

