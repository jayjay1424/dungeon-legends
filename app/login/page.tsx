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

  useEffect(() => {
    const startAudio = () => startLoginMusic();
    startAudio();
    window.addEventListener("pointerdown", startAudio, { once: true });
    return () => {
      window.removeEventListener("pointerdown", startAudio);
      stopLoginMusic();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setMessage("");

    const supabase = createClient();

    // Rate limit check: is this email locked out?
    const { data: locked, error: lockErr } = await supabase
      .rpc("is_account_locked", { p_email: email.trim() })
      .catch(() => ({}));
    if (!lockErr && locked === true) {
      setMessage("Too many failed attempts. Please wait 15 minutes before trying again.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      // Record failed attempt server-side
      await supabase.rpc("record_login_attempt", {
        p_email: email.trim(),
        p_success: false,
      }).catch(() => {});
      setMessage(error.message);
      setLoading(false);
      return;
    }

    // Record successful login
    await supabase.rpc("record_login_attempt", {
      p_email: email.trim(),
      p_success: true,
    }).catch(() => {});

    router.push("/dashboard");
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
