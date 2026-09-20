import { Warrior } from "./types";
import { VILLAGE_BASE_CENTER } from "./world";

// Defensive ring posts around the campfire. Knights hold the line:
// engage nearby foes, then walk back to post.
export const FORMATION_RADIUS = 180;
export const FORMATION_GUARD_RADIUS = 200;

export function assignFormationSlots(
  warriors: Warrior[],
  radius: number = FORMATION_RADIUS
) {
  const line = warriors.filter((w) => w.state !== "dead");
  line.forEach((w, i) => {
    const angle = (i / Math.max(1, line.length)) * Math.PI * 2;
    w.homeX = VILLAGE_BASE_CENTER.x + Math.cos(angle) * radius;
    w.homeY = VILLAGE_BASE_CENTER.y + Math.sin(angle) * radius;
    w.formation = true;
  });
}
