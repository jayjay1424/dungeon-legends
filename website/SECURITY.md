# Dungeon Legends — Security Measures

## What's protected

### 1. Network / Transport
- **HTTPS only** — Vercel enforces HTTPS automatically
- **HSTS** — browser will refuse HTTP connections after first HTTPS visit
- **Upgrade insecure requests** — CSP directive automatically upgrades HTTP→HTTPS

### 2. Headers (set in `next.config.ts`)
| Header | Value | Purpose |
|--------|-------|---------|
| `X-Frame-Options` | `DENY` | Prevents clickjacking — site cannot be embedded in iframe |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-type confusion attacks |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limits referrer leakage to other sites |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` | Disables browser APIs we don't use |
| `Content-Security-Policy` | See below | Restricts what resources can load |

### 3. Content Security Policy (CSP)
```
default-src 'self'
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.supabase.co
style-src 'self' 'unsafe-inline'
img-src 'self' data: https: blob:
connect-src 'self' https://*.supabase.co wss://*.supabase.co
font-src 'self' data:
frame-ancestors 'none'
form-action 'self'
base-uri 'self'
object-src 'none'
upgrade-insecure-requests
```

- **`script-src`** — only allows scripts from your own domain, inline scripts (required by Next.js), `eval` (required by Webpack/Next.js in dev), and Supabase CDN. Blocks third-party script injection.
- **`connect-src`** — only allows API calls to your own domain and Supabase. Blocks data exfiltration to attacker servers.
- **`frame-ancestors 'none'`** — reinforces X-Frame-Options, prevents embedding.
- **`object-src 'none'`** — blocks Flash/PDF plugins (legacy attack vector).

### 4. Supabase Row Level Security (RLS)
Run `website/supabase/player_saves.sql` in your Supabase SQL editor to set up:

- **`player_saves` table** — each user has exactly one row, keyed by `user_id`
- **RLS policies** — users can only SELECT/INSERT/UPDATE/DELETE their own row
- Even if someone extracts your Supabase anon key, they can only access their own data
- No API endpoint exposes other users' saves

### 5. Authentication
- Supabase Auth handles login/signup/password reset
- Auth tokens are stored in HTTP-only cookies (not accessible to JavaScript)
- Middleware (`middleware.ts`) protects `/dashboard/*` routes — unauthenticated users are redirected to `/login`
- No custom auth logic that could be bypassed

## What's NOT protected (and can't be, client-side)

### Client-side game state
- The game runs entirely in the browser. A user with DevTools open can:
  - Modify their in-game stats (HP, attack, gold)
  - Add items to their inventory
  - Speed up cooldowns
- **This is inherent to client-side games.** To prevent this, you'd need a server-authoritative game server that validates every action — which is a massive architecture change.

### Mitigations in place:
- Server-side saves (via Supabase) mean progress persists across sessions
- If someone modifies localStorage, the server save (debounced, 2s after last change) will overwrite it with the last known good state
- The RESET button in the bag panel wipes both localStorage AND the server save

## Recommendations for production

1. **Enable Supabase rate limiting** — in Supabase dashboard, set up rate limits on the API to prevent abuse
2. **Use environment variables** — never commit `.env` with real credentials; use Vercel's environment variable UI
3. **Monitor for abuse** — set up Supabase audit logs to watch for unusual API patterns
4. **Keep dependencies updated** — run `npm audit` regularly to catch known vulnerabilities
5. **Consider stricter CSP for production** — once you know all your script sources, remove `'unsafe-eval'` (requires building with `TIMING=1` or similar webpack config)

## Incident response

If you suspect a breach:
1. Rotate your Supabase anon key in the Supabase dashboard
2. Update the environment variable in Vercel
3. Redeploy
4. Review Supabase audit logs for suspicious activity
