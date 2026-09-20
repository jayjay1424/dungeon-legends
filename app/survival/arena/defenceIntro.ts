import { Npc, Warrior } from "./types";
import { nearestHouse } from "./world";

export type IntroStage = "idle" | "warning" | "arming" | "uprising" | "done";

export type IntroState = {
  stage: IntroStage;
  stageAt: number;
  lineAt: number;
  lineIndex: number;
};

export type IntroCallbacks = {
  onBanner: (line: string) => void;
  onConvert: () => number;
  onDone: () => void;
};

export const WARNING_LINES = [
  "THE HORDE COMES!",
  "VILLAGERS! TO ARMS — DEFEND THE FIRE!",
] as const;

const LINE_MS = 3000;
const ARM_TIMEOUT_MS = 9000;
const ARM_HIDE_MS = 1500;

export function createIntroState(): IntroState {
  return { stage: "idle", stageAt: 0, lineAt: 0, lineIndex: -1 };
}

function speaker(warriors: Warrior[]): Warrior | null {
  let best: Warrior | null = null;
  let bestDist = Infinity;
  for (const w of warriors) {
    if (w.state === "dead" || w.role === "herald") continue;
    const d = Math.hypot(w.x, w.y);
    if (d < bestDist) {
      bestDist = d;
      best = w;
    }
  }
  return best ?? warriors.find((w) => w.state !== "dead") ?? null;
}

function clearSpeech(warriors: Warrior[]) {
  for (const w of warriors) {
    w.sayText = null;
    w.sayUntil = 0;
  }
}

/** Drive the warning script. Call every frame while the story is active. */
export function updateDefenceIntro(
  state: IntroState,
  warriors: Warrior[],
  npcs: Npc[],
  now: number,
  cb: IntroCallbacks
) {
  if (state.stage === "idle" || state.stage === "done") return;

  if (state.stage === "warning") {
    const elapsed = now - state.stageAt;
    const index = Math.min(WARNING_LINES.length - 1, Math.floor(elapsed / LINE_MS));
    if (index !== state.lineIndex) {
      state.lineIndex = index;
      const voice = speaker(warriors);
      if (voice) {
        voice.sayText = WARNING_LINES[index];
        voice.sayUntil = now + LINE_MS;
      }
      cb.onBanner(WARNING_LINES[index]);
    }
    if (elapsed >= WARNING_LINES.length * LINE_MS) {
      // Villagers flee indoors to arm themselves.
      for (const npc of npcs) {
        if (npc.hp <= 0) continue;
        const door = nearestHouse(npc.x, npc.y);
        npc.state = "goHome";
        npc.fightTargetId = null;
        npc.chatPartnerId = null;
        npc.dialogueOpen = false;
        npc.restDoorX = door.x;
        npc.restDoorY = door.y;
      }
      cb.onBanner("VILLAGERS FLEE INDOORS…");
      state.stage = "arming";
      state.stageAt = now;
    }
    return;
  }

  if (state.stage === "arming") {
    const living = npcs.filter((n) => n.hp > 0);
    const inside = living.filter((n) => n.state === "resting");
    const allInside = living.length > 0 && inside.length === living.length;
    if (allInside || now - state.stageAt > ARM_TIMEOUT_MS) {
      // Hide them inside the houses for a beat, then they emerge armed.
      for (const npc of living) {
        npc.el?.style.setProperty("display", "none");
        npc.statusEl?.style.setProperty("display", "none");
        npc.hpEl?.style.setProperty("display", "none");
        npc.menuEl?.style.setProperty("display", "none");
      }
      cb.onBanner("STEEL IS HANDED OUT…");
      state.stage = "uprising";
      state.stageAt = now;
    }
    return;
  }

  if (state.stage === "uprising") {
    if (now - state.stageAt >= ARM_HIDE_MS) {
      const converted = cb.onConvert();
      const voice = speaker(warriors);
      if (voice) {
        voice.sayText = "FOR THE BASE!";
        voice.sayUntil = now + 2500;
      }
      cb.onBanner(
        converted > 0
          ? `${converted} VILLAGERS RISE AS KNIGHTS!`
          : "THE HORDE COMES!"
      );
      state.stage = "done";
      cb.onDone();
    }
  }
}

/** Abort the script (SKIP): silence heralds, jump straight to arming. */
export function skipIntroSpeech(warriors: Warrior[]) {
  clearSpeech(warriors);
}
