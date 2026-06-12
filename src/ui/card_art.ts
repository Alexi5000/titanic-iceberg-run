// file: src/ui/card_art.ts
// description: Procedural card art - freeze-frame captures of the live renderer for Moments/Ships cards and 2D-canvas emblems for Feats cards
// reference: src/gameplay/cards.ts, src/ui/card_ui.ts, src/main.ts

import { CardDef, CardRarity } from '../gameplay/cards';

const ART_WIDTH = 360;
const ART_HEIGHT = 270;

const RARITY_ACCENT: Record<CardRarity, string> = {
  common: '#e8dcc0',
  uncommon: '#46c2b8',
  rare: '#7d6bde',
  legendary: '#e9b44c',
};

/** Capture the current WebGL canvas as a downscaled center-cropped JPEG data URL. */
export function capture_freeze_frame(source: HTMLCanvasElement): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = ART_WIDTH;
    canvas.height = ART_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const src_aspect = source.width / source.height;
    const dst_aspect = ART_WIDTH / ART_HEIGHT;
    let sw = source.width;
    let sh = source.height;
    if (src_aspect > dst_aspect) {
      sw = sh * dst_aspect;
    } else {
      sh = sw / dst_aspect;
    }
    const sx = (source.width - sw) / 2;
    const sy = (source.height - sh) / 2;

    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, ART_WIDTH, ART_HEIGHT);
    return canvas.toDataURL('image/jpeg', 0.72);
  } catch {
    return '';
  }
}

/** Procedural emblem art for Feats cards - a medallion badge drawn on a 2D canvas. */
export function generate_emblem(def: CardDef): string {
  const canvas = document.createElement('canvas');
  canvas.width = ART_WIDTH;
  canvas.height = ART_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const accent = RARITY_ACCENT[def.rarity];

  // Background: deep sea gradient.
  const bg = ctx.createLinearGradient(0, 0, 0, ART_HEIGHT);
  bg.addColorStop(0, '#10243a');
  bg.addColorStop(1, '#061320');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, ART_WIDTH, ART_HEIGHT);

  // Faint rays.
  ctx.save();
  ctx.translate(ART_WIDTH / 2, ART_HEIGHT / 2);
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 10;
  for (let i = 0; i < 12; i++) {
    ctx.rotate(Math.PI / 6);
    ctx.beginPath();
    ctx.moveTo(0, 40);
    ctx.lineTo(0, ART_HEIGHT);
    ctx.stroke();
  }
  ctx.restore();

  // Medallion.
  const cx = ART_WIDTH / 2;
  const cy = ART_HEIGHT / 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 86, 0, Math.PI * 2);
  const medal = ctx.createRadialGradient(cx, cy - 24, 12, cx, cy, 90);
  medal.addColorStop(0, '#1d3a54');
  medal.addColorStop(1, '#0b1d30');
  ctx.fillStyle = medal;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = accent;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 74, 0, Math.PI * 2);
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.6;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Iceberg glyph.
  ctx.beginPath();
  ctx.moveTo(cx - 44, cy + 30);
  ctx.lineTo(cx - 18, cy - 34);
  ctx.lineTo(cx - 2, cy - 6);
  ctx.lineTo(cx + 16, cy - 44);
  ctx.lineTo(cx + 44, cy + 30);
  ctx.closePath();
  ctx.fillStyle = '#dcecf6';
  ctx.fill();

  // Waterline.
  ctx.strokeStyle = accent;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx - 56, cy + 30);
  ctx.quadraticCurveTo(cx - 28, cy + 38, cx, cy + 30);
  ctx.quadraticCurveTo(cx + 28, cy + 22, cx + 56, cy + 30);
  ctx.stroke();

  return canvas.toDataURL('image/jpeg', 0.85);
}

export function card_art_for(def: CardDef, renderer_canvas: HTMLCanvasElement): string {
  if (def.suit === 'feats') return generate_emblem(def);
  return capture_freeze_frame(renderer_canvas) || generate_emblem(def);
}
