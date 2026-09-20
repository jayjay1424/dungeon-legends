"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
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

  useEffect(() => {
    const startAudio = () => startLoginMusic();
    startAudio();
    window.addEventListener("pointerdown", startAudio, { once: true });
    return () => {
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
    setMessage("Password changed successfully!");

    setTimeout(() => {
      router.push("/login");
    }, 2000);
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

        <p className={styles.footer}>PRESS START TO CONTINUE</p>
      </div>
    </main>
  );
}
