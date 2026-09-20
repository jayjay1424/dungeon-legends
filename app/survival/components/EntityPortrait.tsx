'use client';

import type { CSSProperties } from "react";
import type { PortraitSpec } from "../arena/inspect";

interface EntityPortraitProps {
  spec: PortraitSpec;
  /** Rendered height in px (width follows the frame aspect). */
  height?: number;
  label?: string;
}

/**
 * Static portrait cropped from a sprite sheet — shows the spec frame
 * (first idle frame, facing down) scaled to the requested height.
 */
export default function EntityPortrait({ spec, height = 128, label = "portrait" }: EntityPortraitProps) {
  const scale = height / spec.fh;
  const w = Math.max(1, Math.round(spec.fw * scale));
  const h = Math.max(1, Math.round(spec.fh * scale));

  const frameStyle: CSSProperties = {
    width: w,
    height: h,
    backgroundImage: `url(${spec.src})`,
    backgroundRepeat: "no-repeat",
    backgroundSize: `${Math.round(spec.sheetW * scale)}px ${Math.round(spec.sheetH * scale)}px`,
    backgroundPosition: `-${Math.round(spec.fx * scale)}px -${Math.round(spec.fy * scale)}px`,
    imageRendering: "pixelated",
    flexShrink: 0,
  };

  return (
    <div
      role="img"
      aria-label={label}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 10,
        background: "rgba(2, 6, 16, 0.6)",
        border: "2px solid #a87332",
        boxShadow: "inset 0 0 0 2px rgba(0, 0, 0, 0.6)",
        borderRadius: 8,
      }}
    >
      <div style={frameStyle} />
    </div>
  );
}
