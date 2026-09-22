"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./login.module.css";
import DungeonBackdrop from "../components/DungeonBackdrop";
import { startLoginMusic, stopLoginMusic } from "../survival/audio";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const startAudio = () => startLoginMusic();
    startAudio();
    window.addEventListener("pointerdown", startAudio, { once: true });

    // Check URL parameters for messages or errors (e.g. from auth callback)
    const params = new URLSearchParams(window.location.search);
    const urlError = params.get("error_description") || params.get("error");
    const urlMessage = params.get("message");
    if (urlError) {
      setMessage(decodeURIComponent(urlError.replace(/\+/g, " ")));
    } else if (urlMessage) {
      setMessage(decodeURIComponent(urlMessage.replace(/\+/g, " ")));
    }

    // Check if user already has an active session
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) {
        window.location.href = "/dashboard";
      }
    });

    return () => {
      window.removeEventListener("pointerdown", startAudio);
      stopLoginMusic();
    };
  }, []);

  async function resendConfirmation() {
    if (resending || !email.trim()) return;
    setResending(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        },
      });
      if (error) {
        setMessage(error.message);
      } else {
        setMessage(`Confirmation email resent to ${email.trim()}! Please check your inbox and spam folder.`);
        setNeedsEmailConfirmation(false);
      }
    } catch {
      setMessage("Failed to resend confirmation email. Please try again later.");
    } finally {
      setResending(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setMessage("");
    setNeedsEmailConfirmation(false);

    try {
      const supabase = createClient();

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        if (error.message.toLowerCase().includes("email not confirmed")) {
          setNeedsEmailConfirmation(true);
          setMessage("Email not confirmed yet. Click below to resend the confirmation link to your email.");
        } else if (error.message.toLowerCase().includes("invalid login credentials")) {
          setMessage("Incorrect passcode or hero email. Need to recover your account? Click 'Forgot?' above.");
        } else {
          setMessage(error.message);
        }
        setLoading(false);
        return;
      }

      // Hard redirect guarantees newly written auth cookies are sent to middleware
      const redirectTarget = new URLSearchParams(window.location.search).get("redirect");
      window.location.href =
        redirectTarget && redirectTarget.startsWith("/") ? redirectTarget : "/dashboard";
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "An unexpected error occurred during login.";
      setMessage(errMsg);
      setLoading(false);
    }
  }

  const hasError = message.length > 0;

  return (
    <main className={styles.loginPage}>
      {/* Animated dungeon backdrop — busy scene from public/ sprites */}
      <DungeonBackdrop />
      <div className={styles.overlay} aria-hidden="true" />
      <div className={styles.scanlines} aria-hidden="true" />

      <section className={styles.loginCard} aria-labelledby="login-title">
        <h1 id="login-title" className={styles.gameTitle}>
          Enter Dungeon
        </h1>
        <p className={styles.gameSubtitle}>
          Face enemies · Loot · Survive
        </p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label htmlFor="email" className={styles.label}>
              Hero Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="PLAYER_1@dungeon.gg"
              className={styles.inputField}
              aria-invalid={hasError}
              aria-describedby={hasError ? "login-error" : undefined}
            />
          </div>

          <div className={styles.field}>
            <div className={styles.labelRow}>
              <label htmlFor="password" className={styles.label}>
                Passcode
              </label>
              <Link href="/forgot-password" className={styles.forgotLink}>
                Forgot?
              </Link>
            </div>
            <div className={styles.passwordWrap}>
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={styles.inputField}
                aria-invalid={hasError}
                aria-describedby={hasError ? "login-error" : undefined}
              />
              <button
                type="button"
                className={styles.peekButton}
                onClick={() => setShowPassword((v) => !v)}
                aria-pressed={showPassword}
                aria-label={showPassword ? "Hide passcode" : "Show passcode"}
              >
                {showPassword ? "HIDE" : "SHOW"}
              </button>
            </div>
          </div>

          {hasError ? (
            <p id="login-error" role="alert" className={styles.message}>
              {message}
            </p>
          ) : null}

          {needsEmailConfirmation ? (
            <div style={{ marginBottom: "12px", textAlign: "center" }}>
              <button
                type="button"
                onClick={resendConfirmation}
                disabled={resending}
                style={{
                  background: "rgba(255, 205, 117, 0.15)",
                  color: "#ffcd75",
                  border: "1px solid #ffcd75",
                  borderRadius: "4px",
                  padding: "8px 12px",
                  fontSize: "0.75rem",
                  cursor: resending ? "wait" : "pointer",
                  fontFamily: "var(--font-pixel), monospace",
                }}
              >
                {resending ? "SENDING LINK…" : "RESEND CONFIRMATION EMAIL"}
              </button>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className={styles.loginButton}
            aria-busy={loading}
          >
            {loading ? "ENTERING…" : "START QUEST"}
          </button>
        </form>

        <p className={styles.registerPrompt}>
          NEW HERE?{" "}
          <Link href="/register" className={styles.registerLink}>
            CREATE LEGEND
          </Link>
        </p>
        <p className={styles.footer}>PRESS START TO CONTINUE</p>
      </section>
    </main>
  );
}
