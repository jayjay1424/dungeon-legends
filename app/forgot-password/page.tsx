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
    if (loading) return;
    setLoading(true);
    setMessage("");
    setIsSuccess(false);

    const supabase = createClient();

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setMessage(error.message);
    } else {
      setIsSuccess(true);
      setMessage("Check your Gmail for the password reset link.");
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

          <button onClick={sendReset} disabled={loading} type="submit">
            {loading ? "SENDING..." : "SEND CODE"}
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
