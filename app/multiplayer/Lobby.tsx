"use client";
import { useEffect, useState } from "react";
import {
  useRealtimeSessions,
  joinSession,
  createSession,
  leaveSession,
  type GameSession,
  type SessionPlayer,
  type GameMode,
} from "./useMultiplayer";

interface LobbyProps {
  mode: GameMode;
  onJoin?: (id: string | null) => void;
  currentSessionId?: string | null;
  onClose?: () => void;
}

export default function Lobby({ mode, onJoin, currentSessionId, onClose }: LobbyProps) {
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [maxP, setMaxP] = useState(4);
  const [customRoomId, setCustomRoomId] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [msg, setMsg] = useState("");
  const { sessions: realtimeSessions, players, refetch } = useRealtimeSessions(mode, true);

  useEffect(() => {
    if (realtimeSessions && realtimeSessions.length > 0) {
      setSessions(realtimeSessions);
    } else {
      refetch().then((r) => {
        if (!r.error && r.sessions) setSessions(r.sessions);
      });
    }
  }, [realtimeSessions, refetch]);

  async function create() {
    setCreating(true);
    setMsg("");
    const r = await createSession(mode, maxP);
    setCreating(false);
    if (r.error) {
      setMsg("Failed to create room: " + r.error);
      return;
    }
    setMsg("Room created! Joining...");
    const j = await joinSession(r.sessionId);
    if (j.error) {
      setMsg("Joined room (syncing): " + r.sessionId);
    }
    onJoin?.(r.sessionId);
  }

  async function join(id: string) {
    const targetId = id.trim();
    if (!targetId) return;
    setJoining(true);
    setMsg("");
    const r = await joinSession(targetId);
    setJoining(false);
    if (r.error) {
      setMsg("Joining: " + r.error);
    } else {
      setMsg("Joined!");
    }
    onJoin?.(targetId);
  }

  async function leave(id: string) {
    const r = await leaveSession(id);
    if (!r.error) {
      onJoin?.(null);
      setMsg("Left room");
    }
  }

  const totalOnline = sessions.reduce(
    (acc, s) => acc + (players.get(s.id)?.length ?? s.player_count ?? 1),
    0
  );

  return (
    <div
      style={{
        background: "rgba(15, 10, 30, 0.98)",
        border: "3px solid #ffcd75",
        boxShadow: "0 0 20px rgba(0,0,0,0.8), inset 0 0 10px rgba(255,205,117,0.1)",
        padding: 16,
        fontFamily: "var(--font-pixel), monospace",
        color: "#fff",
        fontSize: "0.68rem",
        maxHeight: "80vh",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "2px solid #3a3f58",
          paddingBottom: 8,
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              color: "#ffcd75",
              fontSize: "0.85rem",
              letterSpacing: "0.1em",
              textShadow: "2px 2px #5a1111",
            }}
          >
            ⚔️ MULTIPLAYER LOBBY
          </h2>
          <span style={{ color: "#a0a5c0", fontSize: "0.58rem" }}>
            Real-time Co-Op Arena ({totalOnline} heroes online)
          </span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "#b13434",
              border: "2px solid #ffcd75",
              color: "#fff",
              cursor: "pointer",
              padding: "4px 8px",
              fontFamily: "inherit",
              fontSize: "0.65rem",
            }}
          >
            ✕
          </button>
        )}
      </div>

      {msg && (
        <div
          style={{
            padding: "6px 10px",
            background: "rgba(56, 189, 248, 0.15)",
            border: "1px solid #38bdf8",
            color: "#38bdf8",
            fontSize: "0.6rem",
          }}
        >
          {msg}
        </div>
      )}

      {/* Quick Action: Join by Room Code */}
      <div
        style={{
          background: "rgba(24, 20, 37, 0.85)",
          border: "2px solid #3a3f58",
          padding: 10,
        }}
      >
        <p
          style={{
            margin: "0 0 6px",
            color: "#ffcd75",
            fontSize: "0.62rem",
            letterSpacing: "0.08em",
          }}
        >
          JOIN WITH ROOM CODE:
        </p>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            type="text"
            placeholder="Paste room ID or link..."
            value={customRoomId}
            onChange={(e) => {
              const val = e.target.value;
              if (val.includes("room=")) {
                const match = val.match(/room=([a-zA-Z0-9_-]+)/);
                if (match) {
                  setCustomRoomId(match[1]);
                  return;
                }
              }
              setCustomRoomId(val);
            }}
            style={{
              flex: 1,
              background: "#0f0a1e",
              border: "1px solid #3a3f58",
              color: "#fff",
              padding: "6px 8px",
              fontFamily: "inherit",
              fontSize: "0.62rem",
            }}
          />
          <button
            type="button"
            disabled={!customRoomId.trim() || joining}
            onClick={() => join(customRoomId)}
            style={{
              background: "#38bdf8",
              border: "2px solid #0284c7",
              color: "#0f172a",
              fontWeight: 800,
              padding: "6px 12px",
              cursor: !customRoomId.trim() || joining ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              fontSize: "0.62rem",
            }}
          >
            {joining ? "JOINING..." : "ENTER"}
          </button>
        </div>
      </div>

      {/* Create Room Box */}
      <div
        style={{
          background: "rgba(24, 20, 37, 0.85)",
          border: "2px solid #3a3f58",
          padding: 10,
        }}
      >
        <p
          style={{
            margin: "0 0 6px",
            color: "#ffcd75",
            fontSize: "0.62rem",
            letterSpacing: "0.08em",
          }}
        >
          CREATE NEW ROOM:
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ color: "#a0a5c0", fontSize: "0.6rem" }}>Max Players:</label>
          <select
            value={maxP}
            onChange={(e) => setMaxP(Number(e.target.value))}
            style={{
              background: "#0f0a1e",
              color: "#ffcd75",
              border: "1px solid #3a3f58",
              padding: "4px 6px",
              fontFamily: "inherit",
              fontSize: "0.62rem",
            }}
          >
            {[2, 4, 8, 12, 16].map((n) => (
              <option key={n} value={n}>
                {n} Players
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={create}
            disabled={creating}
            style={{
              background: "#b13434",
              border: "2px solid #ffcd75",
              color: "#fff",
              fontWeight: 800,
              padding: "6px 14px",
              cursor: creating ? "wait" : "pointer",
              fontFamily: "inherit",
              fontSize: "0.62rem",
              boxShadow: "2px 2px 0 #5a1111",
            }}
          >
            {creating ? "CREATING..." : "⚔️ HOST ROOM"}
          </button>
        </div>
      </div>

      {/* Active Sessions List */}
      <div>
        <p
          style={{
            margin: "4px 0 8px",
            color: "#a0a5c0",
            fontSize: "0.62rem",
            letterSpacing: "0.08em",
          }}
        >
          ACTIVE ROOMS ({sessions.length}):
        </p>
        {sessions.length === 0 ? (
          <div
            style={{
              padding: 16,
              background: "rgba(0,0,0,0.3)",
              border: "1px dashed #3a3f58",
              textAlign: "center",
              color: "#6b7280",
              fontSize: "0.62rem",
            }}
          >
            No active rooms found. Host a new room to play together!
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {sessions.map((s) => {
              const ps = players.get(s.id) ?? [];
              const count = ps.length || s.player_count || 1;
              const full = count >= s.max_players;
              const isMeInRoom = currentSessionId === s.id;

              return (
                <div
                  key={s.id}
                  style={{
                    padding: 8,
                    background: isMeInRoom
                      ? "rgba(56, 189, 248, 0.12)"
                      : "rgba(24, 20, 37, 0.7)",
                    border: isMeInRoom ? "1px solid #38bdf8" : "1px solid #3a3f58",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <strong style={{ color: "#ffcd75", fontSize: "0.68rem" }}>
                      {s.name || `Arena Room #${s.id.substring(0, 6)}`}
                    </strong>
                    <span
                      style={{
                        color: full ? "#f87171" : "#4ade80",
                        fontSize: "0.58rem",
                      }}
                    >
                      {count} / {s.max_players} {full ? "(FULL)" : ""}
                    </span>
                  </div>

                  {ps.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {ps.map((p) => (
                        <span
                          key={p.id}
                          style={{
                            background: "rgba(255,205,117,0.15)",
                            padding: "1px 5px",
                            borderRadius: 2,
                            fontSize: "0.55rem",
                            color: "#ffcd75",
                          }}
                        >
                          👤 {p.display_name} (Lv.{p.level})
                        </span>
                      ))}
                    </div>
                  )}

                  <div style={{ marginTop: 4 }}>
                    {isMeInRoom ? (
                      <button
                        type="button"
                        onClick={() => leave(s.id)}
                        style={{
                          width: "100%",
                          background: "rgba(225, 29, 72, 0.2)",
                          color: "#f43f5e",
                          border: "1px solid #f43f5e",
                          padding: "5px",
                          cursor: "pointer",
                          fontFamily: "inherit",
                          fontSize: "0.6rem",
                        }}
                      >
                        LEAVE ROOM
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={full || joining}
                        onClick={() => join(s.id)}
                        style={{
                          width: "100%",
                          background: full ? "rgba(100,100,100,0.2)" : "#ffcd75",
                          color: full ? "#666" : "#1a1a2e",
                          border: "none",
                          fontWeight: 800,
                          padding: "5px",
                          cursor: full || joining ? "not-allowed" : "pointer",
                          fontFamily: "inherit",
                          fontSize: "0.6rem",
                        }}
                      >
                        {joining ? "ENTERING..." : full ? "ROOM FULL" : "JOIN BATTLE"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
