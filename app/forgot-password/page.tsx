"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import styles from "./forgot-password.module.css";
import DungeonBackdrop from "../components/DungeonBackdrop";
import { startLoginMusic, stopLoginMusic } from "../survival/audio";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    const startAudio = () => startLoginMusic();
    startAudio();
    window.addEventListener("pointerdown", startAudio, { once: true });
    return () => {
      window.removeEventListener("pointerdown", startAudio);
      stopLoginMusic();
    };
  }, []);

  async function sendReset(e?: React.FormEvent) {
    e?.preventDefault();
    if (loading || cooldown > 0) return;
    setLoading(true);
    setMessage("");
    setIsSuccess(false);

    const supabase = createClient();

    const redirectUrl = `${window.location.origin}/auth/callback?next=/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: redirectUrl,
    });

    if (error) {
      if (
        error.message.toLowerCase().includes("security purposes") ||
        error.message.toLowerCase().includes("rate limit")
      ) {
        setMessage("Please wait 60 seconds before requesting another reset code.");
        setCooldown(60);
      } else {
        setMessage(error.message);
      }
    } else {
      setIsSuccess(true);
      setMessage(`Reset link sent to ${email.trim()}! Please check your inbox and spam folder.`);
      setCooldown(60);
    }

    setLoading(false);
  }

  return (
    <main className={styles.page}>
      <DungeonBackdrop />
      <div className={styles.overlay} aria-hidden="true" />
      <div className={styles.scanlines} aria-hidden="true" />

      <div className={styles.card}>
        <h1>Reset Password</h1>
        <p>Recover hero · Return to dungeon</p>

        <form onSubmit={sendReset}>
          <div className={styles.field}>
            <label htmlFor="email">Hero Email</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="PLAYER_1@dungeon.gg"
            />
          </div>

          <button onClick={sendReset} disabled={loading || cooldown > 0} type="submit">
            {loading ? "SENDING..." : cooldown > 0 ? `WAIT ${cooldown}s` : "SEND CODE"}
          </button>
        </form>

        {message ? (
          <p className={isSuccess ? styles.messageSuccess : styles.message} role={isSuccess ? "status" : "alert"}>
            {message}
          </p>
        ) : null}

        <Link href="/login" className={styles.backLink}>
          ← Back to login
        </Link>
        <p className={styles.footer}>PRESS START TO CONTINUE</p>
      </div>
    </main>
  );
}
