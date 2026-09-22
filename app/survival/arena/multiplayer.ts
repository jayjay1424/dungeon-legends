// arena/multiplayer.ts
import { createClient } from "@/utils/supabase/client";
import { PlayerDir } from "./types";
import { drawGroundShadow, renderHpLabel, Z_BASE } from "./world";
import styles from "../survival.module.css";

export const PLAYER_FRAME_W = 96;
export const PLAYER_FRAME_H = 80;
export const PLAYER_COLS = 8;
export const PLAYER_SCALE = 3;
export const PLAYER_DISPLAY_W = PLAYER_FRAME_W * PLAYER_SCALE;
export const PLAYER_DISPLAY_H = PLAYER_FRAME_H * PLAYER_SCALE;
export const PLAYER_IDLE_ANIM_MS = 160;
export const PLAYER_RUN_ANIM_MS = 90;
export const PLAYER_ATTACK_ANIM_MS = 55;

export type RemotePlayerPacket = {
  id: string;
  name: string;
  level: number;
  x: number;
  y: number;
  dir: PlayerDir;
  state: "idle" | "run" | "attack1" | "attack2" | "dead";
  hp: number;
  maxHp: number;
  timestamp: number;
};

export type RemotePlayerActionPacket = {
  id: string;
  kind: "attack1" | "attack2" | "spin" | "flash" | "dodge";
  x: number;
  y: number;
  dir: PlayerDir;
  timestamp: number;
};

export type ChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
};

export type RemotePlayerEntity = {
  id: string;
  name: string;
  level: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  dir: PlayerDir;
  state: "idle" | "run" | "attack1" | "attack2" | "dead";
  hp: number;
  maxHp: number;
  action: { kind: "attack1" | "attack2"; startedAt: number } | null;
  lastPacketAt: number;
  el: HTMLDivElement | null;
  hpEl: HTMLDivElement | null;
  bubbleEl: HTMLDivElement | null;
  bubbleUntil: number;
};

export type MultiplayerRoomHandle = {
  broadcastPosition: (packet: Omit<RemotePlayerPacket, "timestamp">) => void;
  broadcastAction: (action: Omit<RemotePlayerActionPacket, "timestamp">) => void;
  broadcastChat: (text: string) => void;
  leaveRoom: () => void;
  getRemotePlayers: () => RemotePlayerEntity[];
};

export function initMultiplayerRoom({
  roomId,
  localUser,
  remotePlayersRef,
  onPlayerCountChange,
  onRemoteAction,
  onChatMessage,
  onLocalBubble,
}: {
  roomId: string;
  localUser: { id: string; name: string; level: number };
  remotePlayersRef: { current: Map<string, RemotePlayerEntity> };
  onPlayerCountChange?: (count: number) => void;
  onRemoteAction?: (action: RemotePlayerActionPacket) => void;
  onChatMessage?: (msg: ChatMessage) => void;
  onLocalBubble?: (text: string) => void;
}): MultiplayerRoomHandle {
  const supabase = createClient();
  const channelName = `room:${roomId}`;
  const channel = supabase.channel(channelName, {
    config: {
      broadcast: { self: false },
      presence: { key: localUser.id },
    },
  });

  let lastBroadcastAt = 0;
  const BROADCAST_INTERVAL_MS = 50; // 20 Hz update rate for ultra-smooth movement

  channel
    .on("broadcast", { event: "pos" }, (event) => {
      const p = event.payload as RemotePlayerPacket;
      // Filter out invalid, generic or self packets to prevent "2 souls in 1 body" glitch
      if (!p || !p.id || p.id === "local" || p.id === localUser.id) return;

      const existing = remotePlayersRef.current.get(p.id);
      if (existing) {
        existing.targetX = p.x;
        existing.targetY = p.y;
        existing.dir = p.dir;
        existing.state = p.state;
        existing.hp = p.hp;
        existing.maxHp = p.maxHp;
        existing.name = p.name;
        existing.level = p.level;
        existing.lastPacketAt = performance.now();
      } else {
        remotePlayersRef.current.set(p.id, {
          id: p.id,
          name: p.name,
          level: p.level,
          x: p.x,
          y: p.y,
          targetX: p.x,
          targetY: p.y,
          dir: p.dir,
          state: p.state,
          hp: p.hp,
          maxHp: p.maxHp,
          action: null,
          lastPacketAt: performance.now(),
          el: null,
          hpEl: null,
          bubbleEl: null,
          bubbleUntil: 0,
        });
      }
    })
    .on("broadcast", { event: "action" }, (event) => {
      const act = event.payload as RemotePlayerActionPacket;
      if (!act || !act.id || act.id === "local" || act.id === localUser.id) return;

      const player = remotePlayersRef.current.get(act.id);
      if (player) {
        player.x = act.x;
        player.y = act.y;
        player.targetX = act.x;
        player.targetY = act.y;
        player.dir = act.dir;
        if (act.kind === "attack1" || act.kind === "attack2") {
          player.action = { kind: act.kind, startedAt: performance.now() };
        }
      }
      onRemoteAction?.(act);
    })
    .on("broadcast", { event: "chat" }, (event) => {
      const msg = event.payload as ChatMessage;
      if (!msg || !msg.senderId || msg.senderId === localUser.id) return;

      const player = remotePlayersRef.current.get(msg.senderId);
      if (player) {
        showPlayerSpeechBubble(player, msg.text);
      }
      onChatMessage?.(msg);
    })
    .on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const count = Object.keys(state).length;
      onPlayerCountChange?.(count);
    })
    .on("presence", { event: "leave" }, ({ leftPresences }) => {
      if (Array.isArray(leftPresences)) {
        for (const presence of leftPresences as any[]) {
          const leftId = presence?.id;
          if (leftId && remotePlayersRef.current.has(leftId)) {
            const player = remotePlayersRef.current.get(leftId);
            if (player) {
              player.el?.remove();
              player.hpEl?.remove();
              player.bubbleEl?.remove();
              remotePlayersRef.current.delete(leftId);
            }
          }
        }
      }
      const state = channel.presenceState();
      onPlayerCountChange?.(Object.keys(state).length);
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          id: localUser.id,
          name: localUser.name,
          level: localUser.level,
          joinedAt: new Date().toISOString(),
        });
      }
    });

  const broadcastPosition = (packet: Omit<RemotePlayerPacket, "timestamp">) => {
    // Strictly disallow broadcasting without real authenticated user id
    if (!packet.id || packet.id === "local") return;

    const now = performance.now();
    if (now - lastBroadcastAt < BROADCAST_INTERVAL_MS) return;
    lastBroadcastAt = now;

    channel.send({
      type: "broadcast",
      event: "pos",
      payload: { ...packet, timestamp: now },
    });
  };

  const broadcastAction = (action: Omit<RemotePlayerActionPacket, "timestamp">) => {
    if (!action.id || action.id === "local") return;

    channel.send({
      type: "broadcast",
      event: "action",
      payload: { ...action, timestamp: performance.now() },
    });
  };

  const broadcastChat = (text: string) => {
    const cleanText = text.trim().slice(0, 100);
    if (!cleanText) return;

    const msg: ChatMessage = {
      id: `${localUser.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      senderId: localUser.id,
      senderName: localUser.name,
      text: cleanText,
      timestamp: Date.now(),
    };

    channel.send({
      type: "broadcast",
      event: "chat",
      payload: msg,
    });

    onChatMessage?.(msg);
    onLocalBubble?.(cleanText);
  };

  const leaveRoom = () => {
    try {
      channel.untrack();
      supabase.removeChannel(channel);
    } catch {
      // ignore
    }
  };

  const getRemotePlayers = () => Array.from(remotePlayersRef.current.values());

  return {
    broadcastPosition,
    broadcastAction,
    broadcastChat,
    leaveRoom,
    getRemotePlayers,
  };
}

export function showPlayerSpeechBubble(player: RemotePlayerEntity, text: string) {
  if (player.bubbleEl) {
    player.bubbleEl.remove();
    player.bubbleEl = null;
  }
  const el = document.createElement("div");
  el.className = "speechBubble";
  el.textContent = text;
  el.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    padding: 4px 8px;
    background: rgba(15, 10, 30, 0.95);
    border: 2px solid #ffcd75;
    color: #fff;
    font-family: var(--font-pixel), "Press Start 2P", monospace;
    font-size: 8px;
    line-height: 1.2;
    pointer-events: none;
    z-index: ${Z_BASE * 2 + 100};
    white-space: pre-wrap;
    max-width: 140px;
    text-align: center;
    box-shadow: 0 4px 0 rgba(0, 0, 0, 0.65);
    animation: popIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
  `;
  player.bubbleEl = el;
  player.bubbleUntil = performance.now() + 4500;
}

export function updateRemotePlayers(
  worldLayer: HTMLDivElement | null,
  remotePlayersRef: { current: Map<string, RemotePlayerEntity> },
  now: number,
  dt: number,
  cx: number,
  cy: number,
  w: number,
  h: number,
  ctx: CanvasRenderingContext2D
) {
  if (!worldLayer) return;

  const STALE_TIMEOUT_MS = 12000;
  const toDelete: string[] = [];

  for (const [id, player] of remotePlayersRef.current) {
    if (now - player.lastPacketAt > STALE_TIMEOUT_MS) {
      toDelete.push(id);
      continue;
    }

    // Smooth movement interpolation
    const lerpFactor = Math.min(1, Math.max(0.1, dt * 0.016));
    player.x += (player.targetX - player.x) * lerpFactor;
    player.y += (player.targetY - player.y) * lerpFactor;

    const screenX = player.x - cx + w / 2;
    const screenY = player.y - cy + h / 2;
    const offscreen =
      screenX < -PLAYER_DISPLAY_W ||
      screenX > w + PLAYER_DISPLAY_W ||
      screenY < -PLAYER_DISPLAY_H ||
      screenY > h + PLAYER_DISPLAY_H;

    // Ground shadow
    drawGroundShadow(ctx, screenX, screenY + 38, 22, 9);

    // Create DOM element for remote player if missing
    if (!player.el) {
      const el = document.createElement("div");
      el.className = styles.player;
      el.style.pointerEvents = "none";
      worldLayer.appendChild(el);
      player.el = el;
    }

    if (!player.hpEl) {
      const hpEl = document.createElement("div");
      hpEl.className = styles.hpLabel;
      hpEl.style.pointerEvents = "none";
      worldLayer.appendChild(hpEl);
      player.hpEl = hpEl;
    }

    // Animation frame resolution
    let animState: "idle" | "run" | "attack1" | "attack2" =
      player.state === "dead" ? "attack2" : player.state;
    let frame = 0;

    if (player.action) {
      const actionFrameIdx = Math.floor(
        (now - player.action.startedAt) / PLAYER_ATTACK_ANIM_MS
      );
      if (actionFrameIdx >= PLAYER_COLS) {
        player.action = null;
        frame =
          animState === "run"
            ? Math.floor(now / PLAYER_RUN_ANIM_MS) % PLAYER_COLS
            : Math.floor(now / PLAYER_IDLE_ANIM_MS) % PLAYER_COLS;
      } else {
        animState = player.action.kind;
        frame = actionFrameIdx;
      }
    } else {
      frame =
        animState === "run"
          ? Math.floor(now / PLAYER_RUN_ANIM_MS) % PLAYER_COLS
          : Math.floor(now / PLAYER_IDLE_ANIM_MS) % PLAYER_COLS;
    }

    const sprite = player.el;
    if (sprite) {
      sprite.style.width = `${PLAYER_DISPLAY_W}px`;
      sprite.style.height = `${PLAYER_DISPLAY_H}px`;
      sprite.style.backgroundImage = `url(/player/${animState}_${player.dir}.png)`;
      sprite.style.backgroundSize = `${
        PLAYER_DISPLAY_W * PLAYER_COLS
      }px ${PLAYER_DISPLAY_H}px`;
      sprite.style.backgroundPosition = `-${frame * PLAYER_DISPLAY_W}px 0px`;
      sprite.style.transform = `translate(${
        screenX - PLAYER_DISPLAY_W / 2
      }px, ${screenY - PLAYER_DISPLAY_H / 2}px)`;
      sprite.style.opacity = offscreen || player.state === "dead" ? "0.3" : "1";
      sprite.style.zIndex = String(Z_BASE + Math.round(player.y + 38));
      sprite.style.filter = "drop-shadow(0 0 8px rgba(56, 189, 248, 0.55))";
    }

    // HP label with teammate badge & level
    renderHpLabel(
      player.hpEl,
      player.hp,
      player.maxHp,
      screenX - 37,
      screenY - PLAYER_DISPLAY_H / 2 - 22,
      offscreen,
      `⚔ ${player.name} (Lv.${player.level})`,
      true
    );

    // Speech bubble handling
    if (player.bubbleEl) {
      if (now > player.bubbleUntil || offscreen) {
        player.bubbleEl.remove();
        player.bubbleEl = null;
      } else {
        if (!player.bubbleEl.parentElement) {
          worldLayer.appendChild(player.bubbleEl);
        }
        player.bubbleEl.style.transform = `translate(${screenX}px, ${
          screenY - PLAYER_DISPLAY_H / 2 - 46
        }px) translateX(-50%)`;
      }
    }
  }

  for (const id of toDelete) {
    const player = remotePlayersRef.current.get(id);
    if (player) {
      player.el?.remove();
      player.hpEl?.remove();
      player.bubbleEl?.remove();
      remotePlayersRef.current.delete(id);
    }
  }
}

export function cleanupRemotePlayers(
  remotePlayersRef: { current: Map<string, RemotePlayerEntity> }
) {
  for (const player of remotePlayersRef.current.values()) {
    player.el?.remove();
    player.hpEl?.remove();
    player.bubbleEl?.remove();
  }
  remotePlayersRef.current.clear();
}
