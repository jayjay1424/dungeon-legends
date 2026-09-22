"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./reset-password.module.css";
import DungeonBackdrop from "../components/DungeonBackdrop";
import { startLoginMusic, stopLoginMusic } from "../survival/audio";

export default function ResetPassword() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isInvalidToken, setIsInvalidToken] = useState(false);

  useEffect(() => {
    const startAudio = () => startLoginMusic();
    startAudio();
    window.addEventListener("pointerdown", startAudio, { once: true });

    // 1. Check for error parameters in query string or URL hash
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const errDesc =
      searchParams.get("error_description") ||
      hashParams.get("error_description") ||
      searchParams.get("error") ||
      hashParams.get("error");

    if (errDesc) {
      setIsInvalidToken(true);
      setMessage(
        "This reset link is invalid or has expired. Please request a new password reset."
      );
      return () => {
        window.removeEventListener("pointerdown", startAudio);
        stopLoginMusic();
      };
    }

    // 2. Exchange code or token_hash if present directly in URL
    const code = searchParams.get("code");
    const token_hash = searchParams.get("token_hash");
    const type = searchParams.get("type");
    const supabase = createClient();

    if (token_hash && (type === "recovery" || type === "email")) {
      supabase.auth
        .verifyOtp({ token_hash, type: "recovery" })
        .then(({ error }) => {
          if (error) {
            setIsInvalidToken(true);
            setMessage("Reset link expired or invalid: " + error.message);
          }
        });
    } else if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          setIsInvalidToken(true);
          setMessage("Reset link expired or invalid: " + error.message);
        }
      });
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsInvalidToken(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("pointerdown", startAudio);
      stopLoginMusic();
    };
  }, []);

  async function updatePassword(e?: React.FormEvent) {
    e?.preventDefault();
    if (loading) return;
    setLoading(true);
    setMessage("");
    setIsSuccess(false);

    const supabase = createClient();

    const { error } = await supabase.auth.updateUser({
      password: password,
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setIsSuccess(true);
    setMessage("Password changed successfully! Entering dungeon...");

    setTimeout(() => {
      window.location.href = "/dashboard";
    }, 1500);
  }

  return (
    <main className={styles.page}>
      <DungeonBackdrop />
      <div className={styles.overlay} aria-hidden="true" />
      <div className={styles.scanlines} aria-hidden="true" />

      <div className={styles.card}>
        <h1>New Passcode</h1>
        <p>Create your new dungeon password</p>

        <form onSubmit={updatePassword}>
          <div className={styles.field}>
            <label htmlFor="password">New Passcode</label>
            <div className={styles.passwordWrap}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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

          <button onClick={updatePassword} disabled={loading} type="submit">
            {loading ? "SAVING..." : "CHANGE PASSWORD"}
          </button>
        </form>

        {message ? (
          <p className={isSuccess ? styles.messageSuccess : styles.message} role={isSuccess ? "status" : "alert"}>
            {message}
          </p>
        ) : null}

        {isInvalidToken ? (
          <div style={{ marginTop: "16px", textAlign: "center" }}>
            <Link
              href="/forgot-password"
              className={styles.peekButton}
              style={{
                display: "inline-block",
                padding: "8px 16px",
                textDecoration: "none",
                color: "#ffcd75",
                background: "rgba(255, 205, 117, 0.15)",
                border: "1px solid #ffcd75",
                borderRadius: "4px",
                fontSize: "0.8rem",
              }}
            >
              Request New Link
            </Link>
          </div>
        ) : null}

        <div style={{ marginTop: "16px", textAlign: "center" }}>
          <Link
            href="/login"
            style={{
              color: "#9ca3af",
              fontSize: "0.75rem",
              textDecoration: "underline",
            }}
          >
            Back to login
          </Link>
        </div>

        <p className={styles.footer}>PRESS START TO CONTINUE</p>
      </div>
    </main>
  );
}
