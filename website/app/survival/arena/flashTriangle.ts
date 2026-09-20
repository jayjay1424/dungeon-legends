import { CombatContext, damageEnemy, rollPlayerDamage } from "./combat";
import { Enemy } from "./types";

export const FLASH_TRIANGLE_COOLDOWN_MS = 8_000;
const TRIANGLE_RADIUS = 290;
const TRIANGLE_HIT_WIDTH = 90;
const FLASH_SEGMENT_DURATION_MS = 14;
const FLASH_TOTAL_HITS = 15;
const FLASH_DAMAGE_DELAY_MS = 1_000;
const FLASH_BURST_HIT_INTERVAL_MS = 35;
const FLASH_STUN_DURATION_MS = FLASH_SEGMENT_DURATION_MS * 4 + FLASH_DAMAGE_DELAY_MS + FLASH_TOTAL_HITS * FLASH_BURST_HIT_INTERVAL_MS + 250;
const FLASH_KNOCKBACK_PER_HIT = 11;

type Point = { x: number; y: number };

function distanceToSegment(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const projection = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + projection * dx), point.y - (start.y + projection * dy));
}

export function createTrianglePath(origin: Point): [Point, Point, Point] {
  return [
    { x: origin.x, y: origin.y - TRIANGLE_RADIUS },
    { x: origin.x - TRIANGLE_RADIUS * 0.9, y: origin.y + TRIANGLE_RADIUS * 0.7 },
    { x: origin.x + TRIANGLE_RADIUS * 0.9, y: origin.y + TRIANGLE_RADIUS * 0.7 },
  ];
}

function detectEnemies(enemies: Enemy[], start: Point, end: Point) {
  return enemies.filter((enemy) => distanceToSegment(enemy, start, end) <= TRIANGLE_HIT_WIDTH);
}

function dealDamage(context: CombatContext, enemies: Enemy[], origin: Point) {
  for (const enemy of enemies) {
    if (enemy.hp <= 0) continue;
    const hit = rollPlayerDamage(4, context.combatStatsRef.current, { attackRatio: 0.5, skillRatio: 0.5 });
    const damage = hit.damage * (enemy.kind === "skeletonKing" ? 0.5 : 1);
    const screenX = enemy.x - context.camPos.x + context.containerWidth / 2;
    damageEnemy(enemy, damage, context, "player", screenX, hit.crit);

    const dx = enemy.x - origin.x;
    const dy = enemy.y - origin.y;
    const distance = Math.hypot(dx, dy) || 1;
    enemy.x += (dx / distance) * FLASH_KNOCKBACK_PER_HIT;
    enemy.y += (dy / distance) * FLASH_KNOCKBACK_PER_HIT;
    enemy.stunnedUntil = performance.now() + FLASH_STUN_DURATION_MS;
    enemy.bmBehavior = "idle";
    enemy.skBehavior = "idle";
    enemy.attackAudioStop?.();
    enemy.attackAudioStop = undefined;
  }
}

function findTriangleTargets(enemies: Enemy[], origin: Point, points: [Point, Point, Point]) {
  const path = [points[0], points[1], points[2], origin];
  return enemies.filter((enemy) => path.some((point, index) => {
    const nextPoint = path[index + 1];
    return nextPoint ? distanceToSegment(enemy, point, nextPoint) <= TRIANGLE_HIT_WIDTH : false;
  }));
}

function freezeEnemies(enemies: Enemy[], until: number) {
  for (const enemy of enemies) {
    enemy.stunnedUntil = until;
    enemy.bmBehavior = "idle";
    enemy.skBehavior = "idle";
    enemy.attackAudioStop?.();
    enemy.attackAudioStop = undefined;
  }
}

function createEffects(worldLayer: HTMLDivElement, points: [Point, Point, Point], context: CombatContext) {
  const screenPoints = points.map((point) => ({
    x: point.x - context.camPos.x + context.containerWidth / 2,
    y: point.y - context.camPos.y + worldLayer.clientHeight / 2,
  })) as [Point, Point, Point];
  const triangle = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  triangle.classList.add("flashTriangleSvg");
  triangle.setAttribute("viewBox", `0 0 ${worldLayer.clientWidth} ${worldLayer.clientHeight}`);
  triangle.setAttribute("width", String(worldLayer.clientWidth));
  triangle.setAttribute("height", String(worldLayer.clientHeight));
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", `M ${screenPoints[0].x} ${screenPoints[0].y} L ${screenPoints[1].x} ${screenPoints[1].y} L ${screenPoints[2].x} ${screenPoints[2].y} Z`);
  path.classList.add("flashTrianglePath");
  triangle.appendChild(path);

  const lightning = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  lightning.classList.add("flashTriangleLightning");
  lightning.setAttribute("viewBox", `0 0 ${worldLayer.clientWidth} ${worldLayer.clientHeight}`);
  lightning.setAttribute("width", String(worldLayer.clientWidth));
  lightning.setAttribute("height", String(worldLayer.clientHeight));
  for (let index = 0; index < screenPoints.length; index++) {
    const start = screenPoints[index];
    const end = screenPoints[(index + 1) % screenPoints.length];
    const segments = 7;
    const boltPoints = [`${start.x} ${start.y}`];
    for (let step = 1; step < segments; step++) {
      const progress = step / segments;
      const jitter = (Math.random() - 0.5) * 34;
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.hypot(dx, dy) || 1;
      boltPoints.push(`${start.x + dx * progress - (dy / length) * jitter} ${start.y + dy * progress + (dx / length) * jitter}`);
    }
    boltPoints.push(`${end.x} ${end.y}`);
    const bolt = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    bolt.setAttribute("points", boltPoints.join(" "));
    bolt.classList.add("flashTriangleBolt");
    lightning.appendChild(bolt);
  }
  worldLayer.appendChild(lightning);

  const screenFlash = document.createElement("div");
  screenFlash.className = "flashTriangleScreenFlash";
  worldLayer.appendChild(screenFlash);
  worldLayer.appendChild(triangle);

  const burst = document.createElement("div");
  burst.className = "flashTriangleBurst";
  burst.style.left = `${screenPoints[0].x - 36}px`;
  burst.style.top = `${screenPoints[0].y - 36}px`;
  worldLayer.appendChild(burst);

  for (const point of points) {
    const afterimage = document.createElement("div");
    afterimage.className = "flashTriangleAfterimage";
    const screenPoint = {
      x: point.x - context.camPos.x + context.containerWidth / 2,
      y: point.y - context.camPos.y + worldLayer.clientHeight / 2,
    };
    afterimage.style.left = `${screenPoint.x - 28}px`;
    afterimage.style.top = `${screenPoint.y - 38}px`;
    afterimage.style.backgroundImage = "url(/player/attack2_down.png)";
    worldLayer.appendChild(afterimage);
  }

  window.setTimeout(() => {
    triangle.remove();
    lightning.remove();
    burst.remove();
    screenFlash.remove();
    worldLayer.querySelectorAll(".flashTriangleAfterimage").forEach((element) => element.remove());
  }, 700);
}

export function activate(
  context: CombatContext,
  worldLayer: HTMLDivElement | null,
  posRef: { current: Point },
  playerActionRef: { current: { kind: "attack1" | "attack2" | "flashTriangle"; startedAt: number } | null },
  lastActivatedAtRef: { current: number },
  _attack: number,
  cameraFollowRef: { current: boolean },
  onComplete?: () => void
) {
  const now = performance.now();
  if (!worldLayer || now - lastActivatedAtRef.current < FLASH_TRIANGLE_COOLDOWN_MS) return false;
  lastActivatedAtRef.current = now;
  cameraFollowRef.current = false;
  const origin = { ...posRef.current };
  const points = createTrianglePath(origin);
  const triangleTargets = findTriangleTargets([...context.enemiesRef.current], origin, points);
  const burstEndAt = now + FLASH_STUN_DURATION_MS;
  freezeEnemies(triangleTargets, burstEndAt);
  createEffects(worldLayer, points, context);
  playerActionRef.current = { kind: "flashTriangle", startedAt: now };

  // Animate each side independently so the arena render loop can show the teleport path.
  const path = [origin, points[0], points[1], points[2], origin];
  let segmentIndex = 0;
  const flashMovement = (segmentStartedAt: number) => {
    const start = path[segmentIndex];
    const end = path[segmentIndex + 1];
    if (!start || !end) {
      posRef.current = origin;
      cameraFollowRef.current = true;
      onComplete?.();
      return;
    }

    const progress = Math.min(1, (performance.now() - segmentStartedAt) / FLASH_SEGMENT_DURATION_MS);
    const eased = progress * (2 - progress);
    posRef.current = {
      x: start.x + (end.x - start.x) * eased,
      y: start.y + (end.y - start.y) * eased,
    };

    if (progress >= 1) {
      segmentIndex += 1;
      if (segmentIndex >= path.length - 1) {
        posRef.current = origin;
        cameraFollowRef.current = true;
        onComplete?.();
        window.setTimeout(() => {
          let burstHit = 0;
          const damageBurst = () => {
            if (burstHit >= FLASH_TOTAL_HITS) return;
            dealDamage(context, triangleTargets, origin);
            burstHit += 1;
            window.setTimeout(damageBurst, FLASH_BURST_HIT_INTERVAL_MS);
          };
          damageBurst();
        }, FLASH_DAMAGE_DELAY_MS);
        return;
      }
      window.requestAnimationFrame(() => flashMovement(performance.now()));
      return;
    }
    window.requestAnimationFrame(() => flashMovement(segmentStartedAt));
  };

  window.requestAnimationFrame(() => flashMovement(performance.now()));
  return true;
}
