---
name: dungeon-legends-workflow
description: >-
  Comprehensive guide and procedures for building, maintaining, testing, and deploying Dungeon Legends,
  including Supabase database management, Next.js App Router architecture, combat mechanics, and real-time multiplayer.
---

# Dungeon Legends Development & Maintenance Skill

This skill documents the architecture, database procedures, authentication flows, and development runbooks for **Dungeon Legends**.

---

## 1. Project Architecture

### Front-End & Routing (Next.js 16 App Router)
- **`/`**: Landing page & splash screen.
- **`/login` & `/register`**: Supabase authentication with pixel-art theme, audio controls, and cookie synchronization.
- **`/auth/callback`**: Next.js server route exchanging PKCE `code` for session cookies with automatic routing.
- **`/forgot-password` & `/reset-password`**: Password recovery with URL error detection and token renewal.
- **`/dashboard`**: Hero stats display, loadout viewer, character portrait, and game mode selector.
- **`/survival`**: Endless Survival Arena (slimes, demons, skeleton kings, necromancers).
- **`/defence`**: Base Defence mode (wave defense, fortification).
- **`/test-db`**: Live connectivity check for Supabase database tables.

### Key Directories
- **`app/survival/arena/`**: Combat calculations, enemies, biomes, NPC logic, warriors.
- **`app/survival/items/`**: Equipment systems, loot drops, inventory, crafting, database persistence.
- **`app/multiplayer/`**: Realtime multiplayer hooks (`useMultiplayer.ts`) and `Lobby.tsx` component.
- **`utils/supabase/`**: Client (`client.ts`), Server (`server.ts`), and Middleware (`middleware.ts`) SSR helpers.
- **`supabase/`**: Safe SQL migration scripts (`schema_safe_migration.sql`).

---

## 2. Supabase Database Rules & Runbook

### CRITICAL: Non-Destructive Migrations Only
- **NEVER** run `DROP TABLE ... CASCADE` on production. Existing player saves, levels, and profiles must be preserved.
- Always use `IF NOT EXISTS` for table and column definitions.
- Always use `DROP POLICY IF EXISTS` before `CREATE POLICY` to avoid duplicate policy errors.
- Always use `CREATE OR REPLACE FUNCTION ... SECURITY DEFINER` with explicit `SET search_path = public, extensions;`.

### Auth & User Trigger
- The `handle_new_user()` trigger on `auth.users` automatically initializes rows in `public.profiles`, `public.player_stats`, and `public.player_saves` upon registration.
- If email confirmation is disabled in Supabase, signups are immediate and unthrottled.

### Multiplayer Tables & Realtime
- `public.game_sessions`: Active multiplayer rooms with creator ID and max player cap.
- `public.session_players`: Live presence of players in a session.
- Realtime publication `supabase_realtime` must include `game_sessions` and `session_players`.

---

## 3. Build & Deployment Runbook

### Local Verification
Run before committing any code changes:
```bash
npx next build
```
Requirements:
- 0 TypeScript compiler errors.
- All static routes (`○`) and dynamic route handlers (`ƒ`) generated.

### Vercel Deployment Settings
- **Framework Preset**: Must be set to `Next.js` (NOT `Other`).
- **Build / Output / Install Commands**: Keep all overrides OFF (use Next.js defaults).
- **Environment Variables**:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

