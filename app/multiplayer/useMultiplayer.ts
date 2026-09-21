import { useEffect, useState, useCallback, useRef } from 'react';
import { createBrowserClient, createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export type GameMode = 'survival' | 'defence' | 'hunt';

export interface GameSession {
  id: string;
  mode: GameMode;
  name: string;
  creator_id: string;
  max_players: number;
  is_private: boolean;
  is_full: boolean;
  created_at: string;
  player_count: number;
}

export interface SessionPlayer {
  id: string;
  session_id: string;
  player_id: string;
  display_name: string;
  level: number;
  hp: number;
  gold: number;
  joined_at: string;
}

// ── Server-side client (for SSR) ──────────────────────────────────────────────
export async function getMultiplayerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options));
          } catch {}
        },
      },
    }
  );
}

// ── Hook: get active sessions for a mode ─────────────────────────────────────
export async function getSessionsForMode(mode: GameMode) {
  const supabase = await getMultiplayerClient();
  const { data, error } = await supabase
    .from('game_sessions')
    .select(`
      *,
      player_count:(
        select count(*) from session_players where session_id = game_sessions.id
      )
    `)
    .eq('mode', mode)
    .eq('is_private', false)
    .order('created_at', { ascending: false });

  if (error) return { sessions: [], error };
  return { sessions: (data || []) as GameSession[], error: null };
}

// ── Hook: join a session ──────────────────────────────────────────────────────
export async function joinSession(sessionId: string) {
  const supabase = await getMultiplayerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // Get display name and level
  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .single();

  const { data: stats } = await supabase
    .from('player_stats')
    .select('hunter_level')
    .eq('id', user.id)
    .single();

  const { error } = await supabase
    .from('session_players')
    .insert({
      session_id: sessionId,
      player_id: user.id,
      display_name: profile?.username ?? 'Adventurer',
      level: stats?.hunter_level ?? 1,
    });

  if (error) return { error: error.message };
  return { success: true };
}

// ── Hook: leave a session ─────────────────────────────────────────────────────
export async function leaveSession(sessionId: string) {
  const supabase = await getMultiplayerClient();
  const { error } = await supabase.rpc('leave_game_session', { p_session_id: sessionId });
  return { error: error?.message ?? null };
}

// ── Hook: create a session ────────────────────────────────────────────────────
export async function createSession(mode: GameMode, maxPlayers = 8) {
  const supabase = await getMultiplayerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data, error } = await supabase
    .rpc('create_game_session', { p_mode: mode, p_max_players: maxPlayers });

  if (error) return { error: error.message };
  return { sessionId: data as string };
}

// ── Client-only hook: realtime subscription ───────────────────────────────────
export function useRealtimeSessions(mode: GameMode, enabled = true) {
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [players, setPlayers] = useState<Map<string, SessionPlayer[]>>(new Map());
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!enabled) return;

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Subscribe to session changes
    const sessionChannel = supabase
      .channel('public:sessions')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'game_sessions',
        filter: `mode=eq.${mode}`,
      }, (payload) => {
        // Reload sessions on any change
        getSessionsForMode(mode).then(({ sessions }) => {
          setSessions(sessions);
        });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'session_players',
      }, (payload) => {
        // Reload players for affected session
        const sessionId = payload.new?.session_id ?? payload.old?.session_id;
        if (sessionId) {
          const { data } = supabase
            .from('session_players')
            .select('*')
            .eq('session_id', sessionId);
          if (data) {
            setPlayers(prev => new Map(prev.set(sessionId, data as SessionPlayer[])));
          }
        }
      })
      .subscribe();

    // Initial load
    getSessionsForMode(mode).then(({ sessions }) => {
      setSessions(sessions);
    });

    // Load players for existing sessions
    sessions.forEach(session => {
      const { data } = supabase
        .from('session_players')
        .select('*')
        .eq('session_id', session.id);
      if (data) {
        setPlayers(prev => new Map(prev.set(session.id, data as SessionPlayer[])));
      }
    });

    channelRef.current = sessionChannel;

    return () => {
      supabase.removeChannel(sessionChannel);
    };
  }, [mode, enabled]);

  return { sessions, players, refetch: () => getSessionsForMode(mode) };
}
