"use client";
import { useEffect, useState } from "react";
import { useRealtimeSessions, joinSession, createSession, leaveSession, type GameSession, type SessionPlayer, type GameMode } from "./useMultiplayer";

interface LobbyProps { mode: GameMode; onJoin?: (id: string) => void; currentSessionId?: string | null; }
export default function Lobby({ mode, onJoin, currentSessionId }: LobbyProps) {
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [players, setPlayers] = useState<Map<string, SessionPlayer[]>>(new Map());
  const [maxP, setMaxP] = useState(8);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [msg, setMsg] = useState("");
  const { refetch } = useRealtimeSessions(mode, true);
  useEffect(() => { refetch().then(r => { if (!r.error) setSessions(r.sessions); }); }, [mode, refetch]);
  async function create() {
    setCreating(true); setMsg("");
    const r = await createSession(mode, maxP);
    setCreating(false);
    if (r.error) { setMsg("Failed: " + r.error); return; }
    setMsg("Created! Joining...");
    const j = await joinSession(r.sessionId);
    if (j.error) { setMsg("Join failed: " + j.error); return; }
    setMsg("Joined!"); onJoin?.(r.sessionId);
  }
  async function join(id: string) {
    setJoining(true); setMsg("");
    const r = await joinSession(id);
    setJoining(false);
    if (r.error) { setMsg("Failed: " + r.error); return; }
    setMsg("Joined!"); onJoin?.(id);
  }
  async function leave(id: string) {
    const r = await leaveSession(id);
    if (!r.error) { onJoin?.(null); setMsg("Left"); }
  }
  const total = sessions.reduce((s, x) => s + (players.get(x.id)?.length ?? 0), 0);
  return (
    <div style={{ background: "rgba(24,20,37,0.95)", border: "2px solid #3a3f58", borderRadius: 8, padding: 14, fontFamily: "var(--font-pixel), monospace", color: "#ffcd75", fontSize: "0.7rem", maxHeight: "60vh", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <h3 style={{ margin: 0, color: "#ffcd75", textShadow: "0 0 8px #ffcd75", fontSize: "0.8rem" }}>MULTIPLAYER</h3>
        <span style={{ color: "#888" }}>{total} online</span>
      </div>
      <div style={{ marginBottom: 10, padding: 8, background: "rgba(0,0,0,0.3)", borderRadius: 4 }}>
        <p style={{ margin: "0 0 6px", color: "#a08050", fontSize: "0.65rem" }}>CREATE:</p>
        <div style={{ display: "flex", gap: 6 }}>
          <select value={maxP} onChange={e => setMaxP(Number(e.target.value))} style={{ background: "#1a1a2e", color: "#ffcd75", border: "1px solid #3a3f58", borderRadius: 4, padding: "4px", fontSize: "0.65rem" }}>
            {[2,4,8,12,16].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <button onClick={create} disabled={creating} style={{ background: "#ffcd75", color: "#1a1a2e", border: "none", borderRadius: 4, padding: "5px 10px", cursor: creating ? "wait" : "pointer", fontSize: "0.65rem", fontWeight: "bold" }}>{creating ? "..." : "CREATE+JOIN"}</button>
        </div>
      </div>
      {msg && <p style={{ margin: "0 0 6px", color: "#4fc3f7", fontSize: "0.6rem", padding: 4, background: "rgba(79,195,247,0.1)", borderRadius: 3 }}>{msg}</p>}
      <p style={{ margin: "0 0 4px", color: "#a08050", fontSize: "0.65rem" }}>SESSIONS ({sessions.length}):</p>
      {sessions.length === 0 ? <p style={{ color: "#555", fontStyle: "italic", fontSize: "0.6rem" }}>None. Create one!</p> : sessions.map(s => {
        const ps = players.get(s.id) ?? [];
        const full = ps.length >= s.max_players;
        const me = currentSessionId === s.id;
        return (
          <div key={s.id} style={{ padding: "6px 8px", marginBottom: 4, background: me ? "rgba(255,205,117,0.2)" : full ? "rgba(255,80,80,0.15)" : "rgba(0,0,0,0.2)", borderRadius: 4, border: me ? "1px solid #ffcd75" : "1px solid #2a2a3e" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <strong>{s.name}</strong>
              <span style={{ color: "#888", fontSize: "0.55rem" }}>{ps.length}/{s.max_players}{full ? " FULL" : ""}</span>
            </div>
            {ps.length > 0 && <div style={{ color: "#a08050", fontSize: "0.55rem", marginBottom: 3 }}>PLAYERS: {ps.map(p => <span key={p.id} style={{ display: "inline-block", background: "rgba(255,205,117,0.15)", padding: "1px 5px", borderRadius: 2, marginRight: 3, fontSize: "0.55rem" }}>{p.display_name} (Lv.{p.level})</span>)}</div>}
            {me ? <button onClick={() => leave(s.id)} style={{ width: "100%", background: "rgba(255,80,80,0.2)", color: "#ff5050", border: "1px solid #ff5050", borderRadius: 3, padding: "4px", cursor: "pointer", fontSize: "0.6rem" }}>LEAVE</button>
              : <button onClick={() => join(s.id)} disabled={full || joining} style={{ width: "100%", background: full ? "rgba(255,80,80,0.1)" : "#ffcd75", color: full ? "#ff5050" : "#1a1a2e", border: "none", borderRadius: 3, padding: "4px", cursor: full || joining ? "not-allowed" : "pointer", fontSize: "0.6rem", fontWeight: "bold", opacity: full ? 0.5 : 1 }}>{joining ? "..." : full ? "FULL" : "JOIN"}</button>}
          </div>
        );
      })}
    </div>
  );
}
