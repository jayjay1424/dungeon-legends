"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../arena/multiplayer";

interface InGameChatProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  localPlayerName: string;
}

const QUICK_PHRASES = [
  "⚔️ Attack!",
  "🛡️ Help me!",
  "👉 Follow me!",
  "👑 Boss here!",
  "✨ GG!",
];

export default function InGameChat({
  messages,
  onSendMessage,
  localPlayerName,
}: InGameChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new message
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  // Enter hotkey to open chat and focus
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl?.tagName === "INPUT" ||
        activeEl?.tagName === "TEXTAREA" ||
        activeEl?.tagName === "SELECT";

      if (e.key === "Enter") {
        if (!isOpen) {
          e.preventDefault();
          setIsOpen(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        } else if (isInput && activeEl === inputRef.current) {
          e.preventDefault();
          send();
        }
      } else if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, inputVal]);

  const send = (overrideText?: string) => {
    const text = (overrideText ?? inputVal).trim();
    if (!text) return;
    onSendMessage(text);
    setInputVal("");
    inputRef.current?.blur();
  };

  return (
    <div
      style={{
        position: "absolute",
        left: 14,
        // On mobile with controls: push the chat up above the joystick area (220px),
        // on desktop keep it near the bottom (74px)
        bottom: "clamp(74px, 14vw + 120px, 240px)",
        zIndex: 10000000,
        fontFamily: 'var(--font-pixel), "Press Start 2P", monospace',
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        pointerEvents: "auto",
        maxWidth: "min(340px, calc(100vw - 28px))",
      }}
    >
      {/* Toggle Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) setTimeout(() => inputRef.current?.focus(), 50);
        }}
        style={{
          background: isOpen ? "#b13434" : "rgba(24, 20, 37, 0.95)",
          border: "2px solid #ffcd75",
          color: "#ffcd75",
          padding: "5px 10px",
          cursor: "pointer",
          fontSize: "0.58rem",
          display: "flex",
          alignItems: "center",
          gap: 6,
          boxShadow: "0 4px 8px rgba(0,0,0,0.5)",
          fontFamily: "inherit",
          marginBottom: 4,
        }}
      >
        <span>💬 {isOpen ? "CLOSE CHAT [ESC]" : "CHAT [ENTER]"}</span>
        {messages.length > 0 && !isOpen && (
          <span
            style={{
              background: "#38bdf8",
              color: "#0f172a",
              borderRadius: "50%",
              padding: "1px 5px",
              fontSize: "0.5rem",
              fontWeight: 800,
            }}
          >
            {messages.length}
          </span>
        )}
      </button>

      {/* Expanded Chat Box */}
      {isOpen && (
        <div
          style={{
            width: "100%",
            background: "rgba(15, 10, 30, 0.97)",
            border: "3px solid #3a3f58",
            outline: "2px solid #000",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.85)",
            padding: 8,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {/* Quick Phrases */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 4,
              borderBottom: "1px solid #3a3f58",
              paddingBottom: 6,
            }}
          >
            {QUICK_PHRASES.map((phrase) => (
              <button
                key={phrase}
                type="button"
                onClick={() => send(phrase)}
                style={{
                  background: "rgba(24, 20, 37, 0.8)",
                  border: "1px solid #38bdf8",
                  color: "#38bdf8",
                  padding: "3px 6px",
                  fontSize: "0.52rem",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {phrase}
              </button>
            ))}
          </div>

          {/* Messages Log */}
          <div
            ref={listRef}
            style={{
              height: 140,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 5,
              paddingRight: 4,
            }}
          >
            {messages.length === 0 ? (
              <div
                style={{
                  color: "#6b7280",
                  fontSize: "0.52rem",
                  textAlign: "center",
                  marginTop: 40,
                }}
              >
                No messages yet. Press Enter or click a quick phrase to chat!
              </div>
            ) : (
              messages.map((m) => {
                const isMe = m.senderName === localPlayerName;
                return (
                  <div
                    key={m.id}
                    style={{
                      fontSize: "0.54rem",
                      lineHeight: 1.35,
                      wordBreak: "break-word",
                    }}
                  >
                    <span
                      style={{
                        color: isMe ? "#bef264" : "#38bdf8",
                        fontWeight: 700,
                        marginRight: 4,
                      }}
                    >
                      {isMe ? "You" : m.senderName}:
                    </span>
                    <span style={{ color: "#fff" }}>{m.text}</span>
                  </div>
                );
              })
            )}
          </div>

          {/* Chat Input */}
          <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
            <input
              ref={inputRef}
              type="text"
              maxLength={80}
              placeholder="Say something..."
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              data-chat-input="true"
              style={{
                flex: 1,
                background: "#0f0a1e",
                border: "1px solid #3a3f58",
                color: "#ffcd75",
                padding: "5px 6px",
                fontFamily: "inherit",
                fontSize: "0.55rem",
              }}
            />
            <button
              type="button"
              onClick={() => send()}
              disabled={!inputVal.trim()}
              style={{
                background: "#b13434",
                border: "1px solid #ffcd75",
                color: "#fff",
                padding: "5px 8px",
                fontSize: "0.55rem",
                cursor: !inputVal.trim() ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                opacity: !inputVal.trim() ? 0.5 : 1,
              }}
            >
              SEND
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

