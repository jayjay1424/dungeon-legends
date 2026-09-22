"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./register.module.css";
import DungeonBackdrop from "../components/DungeonBackdrop";
import { startLoginMusic, stopLoginMusic } from "../survival/audio";

export default function RegisterPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const startAudio = () => startLoginMusic();
    startAudio();
    window.addEventListener("pointerdown", startAudio, { once: true });
    return () => {
      window.removeEventListener("pointerdown", startAudio);
      stopLoginMusic();
    };
  }, []);

  async function register(e?: React.FormEvent) {
    e?.preventDefault();
    if (loading) return;
    setLoading(true);
    setMessage("");
    setIsSuccess(false);

    const supabase = createClient();

    // 1. Create Auth Account with user metadata and callback redirect
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          username: username.trim(),
        },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });

    if (authError) {
      setMessage(authError.message);
      setLoading(false);
      return;
    }

    const user = authData.user;
    const session = authData.session;

    if (!user) {
      setMessage("User creation failed. Please try again.");
      setLoading(false);
      return;
    }

    // Check if user is authenticated immediately (when email confirmation is turned off)
    if (!session) {
      setIsSuccess(true);
      setMessage("Account created! Please check your email to confirm your hero before logging in.");
      setLoading(false);
      return;
    }

    // 2. Ensure Profile exists (handles case where DB trigger already ran)
    try {
      await supabase.from("profiles").upsert(
        {
          id: user.id,
          username: username.trim(),
        },
        { onConflict: "id" }
      );
    } catch {
      // Non-blocking: DB trigger on_auth_user_created already populates this
    }

    // 3. Ensure Player Stats exist
    try {
      await supabase.from("player_stats").upsert(
        {
          id: user.id,
          hunter_level: 1,
          experience: 0,
          coins: 0,
        },
        { onConflict: "id" }
      );
    } catch {
      // Non-blocking: DB trigger on_auth_user_created already populates this
    }

    // Hard redirect guarantees newly written auth cookies sync with middleware
    window.location.href = "/dashboard";
  }

  const hasError = message.length > 0 && !isSuccess;

  return (
    <main className={styles.loginPage}>
      <DungeonBackdrop />
      <div className={styles.overlay} aria-hidden="true" />
      <div className={styles.scanlines} aria-hidden="true" />

      <section className={styles.loginCard} aria-labelledby="register-title">
        <h1 id="register-title" className={styles.gameTitle}>
          Create Legend
        </h1>
        <p className={styles.gameSubtitle}>Forge hero · Enter dungeon</p>

        <form className={styles.form} onSubmit={register}>
          <div className={styles.field}>
            <label htmlFor="username" className={styles.label}>
              Hero Name
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              minLength={3}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="PLAYER_1"
              className={styles.inputField}
              aria-invalid={hasError}
            />
          </div>

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
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="password" className={styles.label}>
              Passcode
            </label>
            <div className={styles.passwordWrap}>
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={styles.inputField}
                aria-invalid={hasError}
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

          {message ? (
            <p
              role={isSuccess ? "status" : "alert"}
              className={isSuccess ? styles.messageSuccess : styles.message}
            >
              {message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className={styles.loginButton}
            aria-busy={loading}
          >
            {loading ? "FORGING…" : "CREATE HERO"}
          </button>
        </form>

        <p className={styles.registerPrompt}>
          HAVE LEGEND?{" "}
          <Link href="/login" className={styles.registerLink}>
            ENTER DUNGEON
          </Link>
        </p>
        <p className={styles.footer}>PRESS START TO CONTINUE</p>
      </section>
    </main>
  );
}
