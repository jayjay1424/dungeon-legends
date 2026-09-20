import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default async function TestDB() {
  const { data, error } = await supabase.from("test").select("*");

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 16px",
        backgroundColor: "#050508",
        color: "#fff",
        fontFamily: 'var(--font-pixel), "Press Start 2P", monospace',
      }}
    >
      <div
        style={{
          width: 480,
          maxWidth: "100%",
          padding: "32px 25px 25px",
          backgroundColor: "rgba(24, 20, 37, 0.92)",
          border: "4px solid #3a3f58",
          outline: "4px solid #000",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            fontSize: "0.9rem",
            lineHeight: 1.5,
            margin: "0 0 10px",
            color: "#ffcd75",
            textTransform: "uppercase",
            textShadow: "2px 2px #000, -2px -2px #5a1111",
          }}
        >
          Supabase Test
        </h1>
        <p style={{ fontSize: "0.5rem", color: "#a0a5c0", textTransform: "uppercase" }}>
          {error ? `Error: ${error.message}` : "Connected Successfully"}
        </p>
        <pre
          style={{
            textAlign: "left",
            marginTop: 16,
            padding: 12,
            background: "#0f0a1e",
            border: "3px solid #3a3f58",
            color: "#ffcd75",
            fontSize: 11,
            overflow: "auto",
          }}
        >
          {JSON.stringify(data, null, 2)}
        </pre>
        <Link
          href="/login"
          style={{ display: "inline-block", marginTop: 20, fontSize: "0.5rem", color: "#ffcd75" }}
        >
          ← Back to login
        </Link>
      </div>
    </main>
  );
}
