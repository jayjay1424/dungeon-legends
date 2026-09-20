'use client';

import { CSSProperties, useEffect, useId, useMemo, useState } from 'react';

export interface DragonSpriteProps {
  /** Path to the sprite sheet, e.g. "/sprites/dragon_up.png" */
  src: string;
  /** Width of a single frame in px (native sheet resolution) */
  frameWidth: number;
  /** Height of a single frame in px (native sheet resolution) */
  frameHeight: number;
  /** How many frames to play in this row */
  frameCount: number;
  /** Which row of the sheet to play (0-indexed) */
  row?: number;
  /** Frames per second */
  fps?: number;
  /** Whether the animation is currently playing (false = frozen on first frame of the row) */
  playing?: boolean;
  /** Uniform scale applied on top of the native frame size */
  scale?: number;
}

/**
 * Generic single-row sprite animator (fixed version of the original
 * snippet — uses a plain `<style>` tag so it works without styled-jsx).
 */
export default function DragonSprite({
  src,
  frameWidth,
  frameHeight,
  frameCount,
  row = 0,
  fps = 10,
  playing = true,
  scale = 1,
}: DragonSpriteProps) {
  const reactId = useId();
  const duration = frameCount / fps;
  const animName = useMemo(
    () => `dragonRun_${row}_${frameCount}_${fps}_${reactId}`.replace(/[^\w]/g, ''),
    [row, frameCount, fps, reactId]
  );

  const wrapperStyle: CSSProperties = {
    width: frameWidth * scale,
    height: frameHeight * scale,
    overflow: 'hidden',
    imageRendering: 'pixelated',
    flexShrink: 0,
  };

  const innerStyle: CSSProperties = {
    width: frameWidth * scale,
    height: frameHeight * scale,
    backgroundImage: `url(${src})`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${frameWidth * frameCount * scale}px ${frameHeight * scale}`,
    backgroundPosition: `0px -${row * frameHeight * scale}px`,
    animation: playing ? `${animName} ${duration}s steps(${frameCount}) infinite` : 'none',
    imageRendering: 'pixelated',
  };

  return (
    <div style={wrapperStyle}>
      <div style={innerStyle} />
      <style>{`
        @keyframes ${animName} {
          from {
            background-position-x: 0px;
          }
          to {
            background-position-x: -${frameWidth * frameCount * scale}px;
          }
        }
      `}</style>
    </div>
  );
}
