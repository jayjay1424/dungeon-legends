"use client";

import { useEffect, useRef, useState } from "react";

interface MobileControlsProps {
  onDirectionChange: (dx: number, dy: number) => void;
  onAttack: () => void;
  onDodge: () => void;
  onSpin: () => void;
  onClones: () => void;
  onFlash: () => void;
  onOpenChat?: () => void;
}

export default function MobileControls({
  onDirectionChange,
  onAttack,
  onDodge,
  onSpin,
  onClones,
  onFlash,
  onOpenChat,
}: MobileControlsProps) {
  const [isMobile, setIsMobile] = useState(false);
  const joystickRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const activePointerRef = useRef<number | null>(null);
  const joystickCenterRef = useRef({ x: 0, y: 0 });
  const currentDirRef = useRef({ x: 0, y: 0 });
  const joystickActiveRef = useRef(false);

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

  const triggerHaptic = (ms = 12) => {
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(ms);
      }
    } catch {
      // ignore
    }
  };

  // Analog joystick handlers
  const JOYSTICK_RADIUS = 70;

  const onJoystickStart = (clientX: number, clientY: number, pointerId?: number) => {
    const el = joystickRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    joystickCenterRef.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    joystickActiveRef.current = true;
    if (pointerId !== undefined) activePointerRef.current = pointerId;
    updateJoystick(clientX, clientY);
  };

  const updateJoystick = (clientX: number, clientY: number) => {
    const center = joystickCenterRef.current;
    let dx = clientX - center.x;
    let dy = clientY - center.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > JOYSTICK_RADIUS) {
      dx = (dx / dist) * JOYSTICK_RADIUS;
      dy = (dy / dist) * JOYSTICK_RADIUS;
    }
    // Move knob
    if (knobRef.current) {
      knobRef.current.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    }
    const ndx = dist > 8 ? dx / JOYSTICK_RADIUS : 0;
    const ndy = dist > 8 ? dy / JOYSTICK_RADIUS : 0;
    currentDirRef.current = { x: ndx, y: ndy };
    onDirectionChange(ndx, ndy);
  };

  const onJoystickEnd = () => {
    joystickActiveRef.current = false;
    activePointerRef.current = null;
    if (knobRef.current) {
      knobRef.current.style.transform = `translate(-50%, -50%)`;
    }
    currentDirRef.current = { x: 0, y: 0 };
    onDirectionChange(0, 0);
  };

  if (!isMobile) return null;

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
      {/* ── Analog Joystick (Bottom-Left) ── */}
      <div
        ref={joystickRef}
        onTouchStart={(e) => {
          e.preventDefault();
          const touch = e.changedTouches[0];
          onJoystickStart(touch.clientX, touch.clientY, touch.identifier);
        }}
        onTouchMove={(e) => {
          e.preventDefault();
          for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            if (activePointerRef.current === null || t.identifier === activePointerRef.current) {
              updateJoystick(t.clientX, t.clientY);
              break;
            }
          }
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          onJoystickEnd();
        }}
        onTouchCancel={(e) => {
          e.preventDefault();
          onJoystickEnd();
        }}
        style={{
          position: "absolute",
          left: 20,
          bottom: 28,
          width: 160,
          height: 160,
          borderRadius: "50%",
          background: "rgba(15, 10, 30, 0.6)",
          border: "3px solid rgba(255, 205, 117, 0.3)",
          boxShadow: "0 0 0 2px rgba(0,0,0,0.5), inset 0 0 20px rgba(0,0,0,0.4)",
          pointerEvents: "auto",
          touchAction: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Knob */}
        <div
          ref={knobRef}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "radial-gradient(circle at 35% 35%, rgba(255, 205, 117, 0.9), rgba(120, 80, 20, 0.9))",
            border: "3px solid #ffcd75",
            boxShadow: "0 4px 12px rgba(0,0,0,0.8), 0 0 8px rgba(255,205,117,0.3)",
            pointerEvents: "none",
            transition: "transform 0s",
          }}
        />
        {/* Cross lines indicator */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.15 }}>
          <div style={{ position: "absolute", top: "50%", left: 12, right: 12, height: 1, background: "#ffcd75", transform: "translateY(-50%)" }} />
          <div style={{ position: "absolute", left: "50%", top: 12, bottom: 12, width: 1, background: "#ffcd75", transform: "translateX(-50%)" }} />
        </div>
      </div>

      {/* ── Chat Button (Top-Right of game area) ── */}
      <button
        type="button"
        onTouchStart={(e) => {
          e.preventDefault();
          triggerHaptic(10);
          onOpenChat?.();
        }}
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "rgba(24, 20, 37, 0.9)",
          border: "2px solid #38bdf8",
          color: "#38bdf8",
          fontSize: "1.1rem",
          display: "grid",
          placeItems: "center",
          pointerEvents: "auto",
          touchAction: "none",
          boxShadow: "0 3px 0 rgba(0,0,0,0.7), 0 0 8px rgba(56,189,248,0.2)",
          cursor: "pointer",
        }}
        aria-label="Open Chat"
      >
        💬
      </button>

      {/* ── Action Buttons Cluster (Bottom-Right) ── */}
      <div
        style={{
          position: "absolute",
          right: 16,
          bottom: 28,
          pointerEvents: "auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 10,
        }}
      >
        {/* Top skill row */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {/* Flash */}
          <button
            type="button"
            onTouchStart={(e) => {
              e.preventDefault();
              triggerHaptic(15);
              onFlash();
            }}
            style={skillBtn("#a855f7", 52)}
            aria-label="Flash Skill"
          >
            ⚡
            <small style={badge}>R</small>
          </button>

          {/* Clones */}
          <button
            type="button"
            onTouchStart={(e) => {
              e.preventDefault();
              triggerHaptic(15);
              onClones();
            }}
            style={skillBtn("#38bdf8", 52)}
            aria-label="Clones Skill"
          >
            👥
            <small style={badge}>E</small>
          </button>

          {/* Spin */}
          <button
            type="button"
            onTouchStart={(e) => {
              e.preventDefault();
              triggerHaptic(15);
              onSpin();
            }}
            style={skillBtn("#eab308", 52)}
            aria-label="Spin Skill"
          >
            🌀
            <small style={badge}>Q</small>
          </button>
        </div>

        {/* Bottom action row: Dodge + Attack */}
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
          {/* Dodge */}
          <button
            type="button"
            onTouchStart={(e) => {
              e.preventDefault();
              triggerHaptic(15);
              onDodge();
            }}
            style={skillBtn("#38bdf8", 62)}
            aria-label="Dodge Dash"
          >
            💨
            <small style={badge}>SHIFT</small>
          </button>

          {/* Primary Attack */}
          <button
            type="button"
            onTouchStart={(e) => {
              e.preventDefault();
              triggerHaptic(25);
              onAttack();
            }}
            style={{
              ...skillBtn("#ffcd75", 80),
              background: "#b13434",
              borderColor: "#ffcd75",
              boxShadow: "0 6px 0 #5a1111, 0 8px 16px rgba(0,0,0,0.6), 0 0 12px rgba(255,205,117,0.2)",
              fontSize: "1.6rem",
            }}
            aria-label="Sword Attack"
          >
            ⚔️
            <small style={badge}>ATK</small>
          </button>
        </div>
      </div>
    </div>
  );
}

const skillBtn = (borderColor: string, size: number): React.CSSProperties => ({
  width: size,
  height: size,
  borderRadius: "50%",
  background: "rgba(24, 20, 37, 0.92)",
  border: `3px solid ${borderColor}`,
  color: "#fff",
  fontSize: "1.2rem",
  display: "grid",
  placeItems: "center",
  position: "relative",
  cursor: "pointer",
  touchAction: "none",
  fontFamily: 'var(--font-pixel), "Press Start 2P", monospace',
  boxShadow: `0 4px 0 rgba(0,0,0,0.7), 0 0 10px ${borderColor}33`,
});

const badge: React.CSSProperties = {
  position: "absolute",
  bottom: -3,
  right: -3,
  background: "#0f0a1e",
  border: "1px solid #3a3f58",
  color: "#a0a5c0",
  fontSize: "0.4rem",
  padding: "1px 3px",
  borderRadius: 2,
  lineHeight: 1.2,
};
