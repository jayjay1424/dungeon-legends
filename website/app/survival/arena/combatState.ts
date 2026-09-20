// Combat phases: aggression starts COMBAT; 3s with no damage exchanged
// drops to COOLDOWN (10s, visible); then SAFE. Only the player's own hits
// START combat — being mauled without fighting back never does.
export const COMBAT_ACTIVITY_MS = 3000;
export const COMBAT_COOLDOWN_MS = 10000;

export type CombatPhase = "combat" | "cooldown" | "safe";

type CombatPhaseListener = (phase: CombatPhase) => void;

export class CombatStateManager {
  private active = false;
  private phase: CombatPhase = "safe";
  private activityDeadline = 0;
  private cooldownDeadline: number | null = null;
  private timer: number | null = null;
  private listener: CombatPhaseListener;

  constructor(listener: CombatPhaseListener) {
    this.listener = listener;
  }

  private notify(phase: CombatPhase) {
    if (this.phase === phase) return;
    this.phase = phase;
    this.listener(phase);
  }

  /** Player aggression: enters (or re-enters) COMBAT. */
  startCombat(now = performance.now()) {
    this.active = true;
    this.activityDeadline = now + COMBAT_ACTIVITY_MS;
    this.cooldownDeadline = null;
    this.notify("combat");
  }

  /** Any damage exchanged: refreshes the window, but never STARTS combat. */
  ping(now = performance.now()) {
    if (!this.active) return;
    this.activityDeadline = now + COMBAT_ACTIVITY_MS;
    this.cooldownDeadline = null;
    this.notify("combat");
  }

  tick(now = performance.now()) {
    if (!this.active) return;
    if (this.cooldownDeadline !== null) {
      if (now >= this.cooldownDeadline) this.endCombat();
      return;
    }
    if (now >= this.activityDeadline) {
      this.cooldownDeadline = now + COMBAT_COOLDOWN_MS;
      this.notify("cooldown");
    }
  }

  start() {
    if (this.timer !== null || typeof window === "undefined") return;
    this.timer = window.setInterval(() => this.tick(), 250);
  }

  endCombat() {
    if (!this.active && this.phase === "safe") return;
    this.active = false;
    this.activityDeadline = 0;
    this.cooldownDeadline = null;
    this.notify("safe");
  }

  dispose() {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    this.endCombat();
  }

  isActive() {
    return this.active;
  }
}
