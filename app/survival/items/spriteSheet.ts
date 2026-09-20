import { SpritePosition } from "./types";

export const ITEM_SPRITE_SHEET = "/spritesheet_48x48.png";
export const ITEM_SPRITE_CELL_SIZE = 48;

export function spriteCell(column: number, row: number): SpritePosition {
  return {
    x: column * ITEM_SPRITE_CELL_SIZE,
    y: row * ITEM_SPRITE_CELL_SIZE,
    width: ITEM_SPRITE_CELL_SIZE,
    height: ITEM_SPRITE_CELL_SIZE,
  };
}

export function spriteStyle(sprite: SpritePosition, size = 42) {
  return {
    width: size,
    height: size,
    backgroundImage: `url(${ITEM_SPRITE_SHEET})`,
    backgroundSize: `${768 * (size / sprite.width)}px ${1056 * (size / sprite.height)}px`,
    backgroundPosition: `-${sprite.x * (size / sprite.width)}px -${sprite.y * (size / sprite.height)}px`,
    backgroundRepeat: "no-repeat",
    imageRendering: "pixelated" as const,
  };
}
