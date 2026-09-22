"use client";

import { useEffect, useState } from "react";

interface MobileControlsProps {
  onDirectionChange: (dx: number, dy: number) => void;
  onAttack: () => void;
  onDodge: () => void;
  onSpin: () => void;
  onClones: () => void;
  onFlash: () => void;
}

export default function MobileControls({
  onDirectionChange,
  onAttack,
  onDodge,
  onSpin,
  onClones,
  onFlash,
}: MobileControlsProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkTouch = () => {
      const hasTouch =
        typeof window !== "undefined" &&
        ("ontouchstart" in window ||
          navigator.maxTouchPoints > 0 ||
          window.innerWidth <= 820);
      setIsMobile(hasTouch);
    };
    checkTouch();
    window.addEventListener("resize", checkTouch);
    return () => window.removeEventListener("resize", checkTouch);
  }, []);

  if (!isMobile) return null;

  const triggerHaptic = (ms = 12) => {
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(ms);
      }
    } catch {
      // ignore
    }
  };

  const handlePad = (dx: number, dy: number) => {
    triggerHaptic(8);
    onDirectionChange(dx, dy);
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 9000000,
        fontFamily: 'var(--font-pixel), "Press Start 2P", monospace',
        userSelect: "none",
        touchAction: "none",
      }}
    >
      {/* ── Virtual D-Pad (Bottom-Left) ── */}
      <div
        style={{
          position: "absolute",
          left: 16,
          bottom: 24,
          width: 140,
          height: 140,
          pointerEvents: "auto",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gridTemplateRows: "repeat(3, 1fr)",
          gap: 3,
        }}
      >
        <div />
        {/* UP */}
        <button
          type="button"
          onTouchStart={(e) => {
            e.preventDefault();
            handlePad(0, -1);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            handlePad(0, 0);
          }}
          onMouseDown={() => handlePad(0, -1)}
          onMouseUp={() => handlePad(0, 0)}
          style={dpadButtonStyle}
          aria-label="Move Up"
        >
          ▲
        </button>
        <div />

        {/* LEFT */}
        <button
          type="button"
          onTouchStart={(e) => {
            e.preventDefault();
            handlePad(-1, 0);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            handlePad(0, 0);
          }}
          onMouseDown={() => handlePad(-1, 0)}
          onMouseUp={() => handlePad(0, 0)}
          style={dpadButtonStyle}
          aria-label="Move Left"
        >
          ◀
        </button>

        {/* CENTER PIVOT */}
        <div
          style={{
            display: "grid",
            placeItems: "center",
            background: "rgba(15, 10, 30, 0.75)",
            border: "2px solid #3a3f58",
            color: "#6b7280",
            fontSize: "10px",
          }}
        >
          ●
        </div>

        {/* RIGHT */}
        <button
          type="button"
          onTouchStart={(e) => {
            e.preventDefault();
            handlePad(1, 0);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            handlePad(0, 0);
          }}
          onMouseDown={() => handlePad(1, 0)}
          onMouseUp={() => handlePad(0, 0)}
          style={dpadButtonStyle}
          aria-label="Move Right"
        >
          ▶
        </button>

        <div />
        {/* DOWN */}
        <button
          type="button"
          onTouchStart={(e) => {
            e.preventDefault();
            handlePad(0, 1);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            handlePad(0, 0);
          }}
          onMouseDown={() => handlePad(0, 1)}
          onMouseUp={() => handlePad(0, 0)}
          style={dpadButtonStyle}
          aria-label="Move Down"
        >
          ▼
        </button>
        <div />
      </div>

      {/* ── Action Buttons Cluster (Bottom-Right) ── */}
      <div
        style={{
          position: "absolute",
          right: 16,
          bottom: 20,
          pointerEvents: "auto",
          display: "flex",
          alignItems: "flex-end",
          gap: 10,
        }}
      >
        {/* Skills Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
          {/* Flash */}
          <button
            type="button"
            onTouchStart={(e) => {
              e.preventDefault();
              triggerHaptic(15);
              onFlash();
            }}
            style={smallSkillStyle("#a855f7")}
            aria-label="Flash Skill"
          >
            ⚡
            <small style={badgeStyle}>R</small>
          </button>

          {/* Clones */}
          <button
            type="button"
            onTouchStart={(e) => {
              e.preventDefault();
              triggerHaptic(15);
              onClones();
            }}
            style={smallSkillStyle("#38bdf8")}
            aria-label="Clones Skill"
          >
            👥
            <small style={badgeStyle}>E</small>
          </button>

          {/* Spin */}
          <button
            type="button"
            onTouchStart={(e) => {
              e.preventDefault();
              triggerHaptic(15);
              onSpin();
            }}
            style={smallSkillStyle("#eab308")}
            aria-label="Spin Skill"
          >
            🌀
            <small style={badgeStyle}>Q</small>
          </button>
        </div>

        {/* Big Action Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
          {/* Dodge */}
          <button
            type="button"
            onTouchStart={(e) => {
              e.preventDefault();
              triggerHaptic(15);
              onDodge();
            }}
            style={{
              ...actionBtnStyle,
              width: 52,
              height: 52,
              background: "#0284c7",
              borderColor: "#38bdf8",
              fontSize: "1.1rem",
            }}
            aria-label="Dodge Dash"
          >
            💨
            <small style={badgeStyle}>SHIFT</small>
          </button>

          {/* Primary Attack (Extra Large) */}
          <button
            type="button"
            onTouchStart={(e) => {
              e.preventDefault();
              triggerHaptic(20);
              onAttack();
            }}
            style={{
              ...actionBtnStyle,
              width: 68,
              height: 68,
              background: "#b13434",
              borderColor: "#ffcd75",
              fontSize: "1.5rem",
              boxShadow: "0 6px 0 #5a1111, 0 8px 16px rgba(0,0,0,0.6)",
            }}
            aria-label="Sword Attack"
          >
            ⚔️
            <small style={badgeStyle}>ATK</small>
          </button>
        </div>
      </div>
    </div>
  );
}

const dpadButtonStyle: React.CSSProperties = {
  background: "rgba(24, 20, 37, 0.92)",
  border: "2px solid #ffcd75",
  color: "#ffcd75",
  fontSize: "14px",
  display: "grid",
  placeItems: "center",
  cursor: "pointer",
  boxShadow: "0 3px 0 rgba(0,0,0,0.6)",
  touchAction: "none",
};

const actionBtnStyle: React.CSSProperties = {
  borderRadius: "50%",
  border: "3px solid #ffcd75",
  display: "grid",
  placeItems: "center",
  color: "#fff",
  cursor: "pointer",
  position: "relative",
  touchAction: "none",
  fontFamily: "inherit",
};

const smallSkillStyle = (borderColor: string): React.CSSProperties => ({
  ...actionBtnStyle,
  width: 48,
  height: 48,
  background: "rgba(24, 20, 37, 0.95)",
  borderColor: borderColor,
  fontSize: "1.1rem",
  boxShadow: `0 3px 0 rgba(0,0,0,0.7), 0 0 8px ${borderColor}44`,
});

const badgeStyle: React.CSSProperties = {
  position: "absolute",
  bottom: -2,
  right: -2,
  background: "#0f0a1e",
  border: "1px solid #3a3f58",
  color: "#a0a5c0",
  fontSize: "0.42rem",
  padding: "1px 3px",
  borderRadius: 2,
};

