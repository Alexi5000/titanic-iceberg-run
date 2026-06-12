// file: src/ui/ui_styles.ts
// description: Injects the DOM overlay stylesheet for HUD, toasts, and menu screens
// reference: src/ui/hud.ts, src/ui/menus.ts

const CSS = `
  .overlay {
    position: fixed;
    inset: 0;
    pointer-events: none;
    color: #dbe6f2;
    font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    z-index: 10;
  }
  .hud-corner {
    position: absolute;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .hud-top-left { top: 18px; left: 18px; align-items: flex-start; }
  .hud-top-right { top: 18px; right: 18px; width: 270px; text-align: right; align-items: flex-end; }
  .hud-bottom-left { bottom: 18px; left: 18px; align-items: flex-start; }
  .hud-bottom-right { bottom: 18px; right: 18px; width: 270px; text-align: right; align-items: flex-end; }

  .hud-score {
    font-size: 30px;
    font-weight: 700;
    letter-spacing: 1px;
    text-shadow: 0 2px 8px rgba(0,0,0,0.8);
  }
  .hud-sub {
    font-size: 13px;
    opacity: 0.85;
    letter-spacing: 1.4px;
    text-transform: uppercase;
  }
  .hud-mult { color: #8fd0ff; font-weight: 600; }

  .bar-shell {
    width: 230px;
    height: 12px;
    background: rgba(8, 16, 28, 0.72);
    border: 1px solid rgba(170, 200, 230, 0.35);
    border-radius: 6px;
    overflow: hidden;
  }
  .bar-fill {
    height: 100%;
    width: 100%;
    background: linear-gradient(90deg, #3f8d5a, #62c47f);
    transition: width 0.25s ease;
  }
  .bar-fill.warn { background: linear-gradient(90deg, #a8772b, #d9a544); }
  .bar-fill.danger { background: linear-gradient(90deg, #8d2f26, #d9534f); }

  .telegraph {
    display: flex;
    gap: 4px;
    align-items: flex-end;
  }
  .telegraph-step {
    width: 30px;
    height: 16px;
    border: 1px solid rgba(170, 200, 230, 0.4);
    border-radius: 3px;
    background: rgba(8, 16, 28, 0.7);
    font-size: 0;
  }
  .telegraph-step.active { background: #c8a24a; border-color: #ecd9a0; box-shadow: 0 0 10px rgba(220, 180, 90, 0.6); }
  .telegraph-step.astern.active { background: #b05a3c; border-color: #e8b49a; }
  .telegraph-label {
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 2px;
    color: #ecd9a0;
    text-shadow: 0 2px 6px rgba(0,0,0,0.8);
  }

  .rudder-shell {
    width: 230px;
    height: 10px;
    background: rgba(8, 16, 28, 0.72);
    border: 1px solid rgba(170, 200, 230, 0.35);
    border-radius: 5px;
    position: relative;
  }
  .rudder-needle {
    position: absolute;
    top: -4px;
    left: 50%;
    width: 4px;
    height: 16px;
    background: #8fd0ff;
    border-radius: 2px;
    transform: translateX(-50%);
  }
  .rudder-center {
    position: absolute;
    top: 0;
    left: 50%;
    width: 1px;
    height: 100%;
    background: rgba(170, 200, 230, 0.4);
  }

  .missions {
    background: rgba(6, 12, 22, 0.82);
    border: 1px solid rgba(170, 200, 230, 0.35);
    border-radius: 8px;
    padding: 10px 14px;
    min-width: 240px;
    box-sizing: border-box;
    width: 100%;
  }
  .mission-row { font-size: 12.5px; margin: 5px 0; letter-spacing: 0.4px; }
  .mission-row.done { color: #7fd89a; }
  .mission-row .mission-progress { opacity: 0.7; float: right; margin-left: 12px; }

  .toasts {
    position: absolute;
    top: 86px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
  }
  .toast {
    background: rgba(10, 20, 34, 0.88);
    border: 1px solid rgba(200, 162, 74, 0.65);
    border-radius: 8px;
    padding: 10px 22px;
    text-align: center;
    animation: toast-in 0.45s cubic-bezier(0.2, 1.9, 0.4, 1), toast-out 0.5s ease 3.4s forwards;
  }
  .telegraph-label.pop { animation: hud-thunk 0.32s cubic-bezier(0.2, 2.4, 0.4, 1); }
  @keyframes hud-thunk { 0% { transform: scale(1.4) translateY(-2px); } 100% { transform: scale(1) translateY(0); } }
  .bar-shell.wobble { animation: hud-wobble 0.45s ease; }
  @keyframes hud-wobble {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-5px); }
    45% { transform: translateX(4px); }
    70% { transform: translateX(-2px); }
  }
  @media (prefers-reduced-motion: reduce) {
    .toast, .telegraph-label.pop, .bar-shell.wobble { animation: none; }
  }
  .toast-title { font-size: 15px; font-weight: 700; color: #ecd9a0; letter-spacing: 1.5px; }
  .toast-body { font-size: 12.5px; opacity: 0.85; margin-top: 2px; }
  @keyframes toast-in { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: none; } }
  @keyframes toast-out { to { opacity: 0; transform: translateY(-8px); } }

  .vignette {
    position: absolute;
    inset: 0;
    box-shadow: inset 0 0 180px 60px rgba(180, 30, 20, 0.55);
    opacity: 0;
    transition: opacity 1.1s ease;
  }
  .vignette.flash { opacity: 1; transition: opacity 0.06s ease; }

  .screen {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: radial-gradient(ellipse at center, rgba(4, 10, 20, 0.25) 0%, rgba(2, 5, 13, 0.78) 100%);
    text-align: center;
    pointer-events: none;
    color: #dbe6f2;
    font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    z-index: 20;
  }
  .screen.hidden { display: none; }
  .game-title {
    font-size: 64px;
    font-weight: 800;
    letter-spacing: 10px;
    color: #ecd9a0;
    text-shadow: 0 4px 30px rgba(0,0,0,0.9);
    margin: 0;
  }
  .game-subtitle {
    font-size: 18px;
    letter-spacing: 6px;
    text-transform: uppercase;
    opacity: 0.85;
    margin: 8px 0 30px;
  }
  .controls-card {
    background: rgba(6, 12, 22, 0.66);
    border: 1px solid rgba(170, 200, 230, 0.25);
    border-radius: 10px;
    padding: 16px 30px;
    font-size: 14.5px;
    line-height: 2;
    letter-spacing: 0.6px;
  }
  .controls-card b { color: #ecd9a0; font-weight: 700; }
  .press-start {
    margin-top: 34px;
    font-size: 17px;
    letter-spacing: 3px;
    color: #8fd0ff;
    animation: pulse 1.6s ease-in-out infinite;
  }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
  .stats-card {
    background: rgba(6, 12, 22, 0.72);
    border: 1px solid rgba(200, 162, 74, 0.4);
    border-radius: 10px;
    padding: 18px 40px;
    font-size: 16px;
    line-height: 2.1;
    letter-spacing: 0.8px;
    margin-top: 6px;
  }
  .stats-card .stat-value { color: #ecd9a0; font-weight: 700; }
  .gameover-title {
    font-size: 46px;
    font-weight: 800;
    letter-spacing: 7px;
    color: #d9534f;
    text-shadow: 0 4px 26px rgba(0,0,0,0.9);
    margin: 0 0 14px;
  }
  .career-line { margin-top: 16px; font-size: 13.5px; opacity: 0.8; letter-spacing: 1.2px; }

  /* ---------- Collectible cards ---------- */
  .card {
    width: 152px;
    border-radius: 10px;
    background: #0d1b2c;
    border: 2px solid #e8dcc0;
    overflow: hidden;
    position: relative;
    text-align: left;
    flex-shrink: 0;
  }
  .card-art {
    width: 100%;
    aspect-ratio: 4 / 3;
    object-fit: cover;
    display: block;
    background: #08141f;
  }
  .card-body { padding: 7px 9px 9px; }
  .card-title { font-size: 12.5px; font-weight: 700; letter-spacing: 0.6px; color: #f0e6cc; }
  .card-flavor { font-size: 9.5px; opacity: 0.72; font-style: italic; margin-top: 3px; line-height: 1.35; }
  .card-meta { font-size: 8.5px; opacity: 0.55; margin-top: 4px; letter-spacing: 0.4px; }
  .card-suit-tag {
    position: absolute;
    top: 6px;
    left: 6px;
    font-size: 8.5px;
    letter-spacing: 1px;
    text-transform: uppercase;
    background: rgba(5, 12, 20, 0.78);
    border-radius: 4px;
    padding: 2px 6px;
    color: #cfe0f0;
  }
  .card.rarity-uncommon { border-color: #46c2b8; }
  .card.rarity-uncommon::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(115deg, transparent 30%, rgba(120, 235, 220, 0.22) 48%, transparent 60%);
    background-size: 250% 250%;
    animation: foil-sweep 3.2s ease-in-out infinite;
  }
  .card.rarity-rare { border-color: #7d6bde; }
  .card.rarity-rare::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(120deg, rgba(94, 226, 160, 0.16), rgba(125, 107, 222, 0.18), rgba(70, 194, 184, 0.16));
    background-size: 300% 300%;
    animation: aurora-border 4s linear infinite;
  }
  .card.rarity-legendary { border-color: #e9b44c; box-shadow: 0 0 18px rgba(233, 180, 76, 0.35); }
  .card.rarity-legendary::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: conic-gradient(from 0deg, rgba(255,120,120,0.14), rgba(255,220,120,0.14), rgba(140,255,170,0.14), rgba(130,180,255,0.14), rgba(230,140,255,0.14), rgba(255,120,120,0.14));
    background-size: 200% 200%;
    animation: holo-spin 5s linear infinite;
    mix-blend-mode: screen;
  }
  @keyframes foil-sweep { 0%, 100% { background-position: 0% 0%; } 50% { background-position: 100% 100%; } }
  @keyframes aurora-border { 0% { background-position: 0% 50%; } 100% { background-position: 300% 50%; } }
  @keyframes holo-spin { 0% { filter: hue-rotate(0deg); } 100% { filter: hue-rotate(360deg); } }

  .card.silhouette { filter: grayscale(1) brightness(0.6); border-color: rgba(180, 200, 220, 0.25); }
  .card.silhouette .card-art { opacity: 0.18; }
  .card.silhouette .card-hint-mark {
    position: absolute;
    top: 26px;
    left: 0;
    right: 0;
    text-align: center;
    font-size: 42px;
    color: rgba(210, 226, 240, 0.5);
  }

  .card-reveal { animation: card-flip-in 0.7s cubic-bezier(0.2, 1.4, 0.4, 1) backwards; }
  @keyframes card-flip-in {
    0% { transform: rotateY(95deg) scale(0.8); opacity: 0; }
    100% { transform: rotateY(0) scale(1); opacity: 1; }
  }

  .gameover-cards {
    display: flex;
    gap: 14px;
    margin-top: 18px;
    justify-content: center;
    flex-wrap: wrap;
    max-width: 720px;
  }
  .gameover-cards-label {
    margin-top: 20px;
    font-size: 13px;
    letter-spacing: 2.5px;
    text-transform: uppercase;
    color: #ecd9a0;
  }

  /* ---------- Gallery ---------- */
  .gallery {
    position: fixed;
    inset: 0;
    background: rgba(3, 8, 16, 0.94);
    z-index: 40;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 28px 20px;
    overflow-y: auto;
    color: #dbe6f2;
    font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
  }
  .gallery.hidden { display: none; }
  .gallery-title { font-size: 26px; font-weight: 800; letter-spacing: 5px; color: #ecd9a0; margin: 0 0 4px; }
  .gallery-sub { font-size: 12.5px; opacity: 0.75; letter-spacing: 1.5px; margin-bottom: 18px; }
  .gallery-tabs { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; justify-content: center; }
  .gallery-tab {
    background: rgba(12, 24, 40, 0.85);
    border: 1px solid rgba(170, 200, 230, 0.3);
    border-radius: 18px;
    color: #cfe0f0;
    padding: 7px 18px;
    font-size: 12.5px;
    letter-spacing: 1.2px;
    cursor: pointer;
    text-transform: uppercase;
  }
  .gallery-tab.active { background: #c8a24a; color: #14202e; border-color: #ecd9a0; font-weight: 700; }
  .gallery-grid { display: flex; flex-wrap: wrap; gap: 16px; justify-content: center; max-width: 980px; }
  .gallery .card { cursor: pointer; transition: transform 0.18s ease; }
  .gallery .card:hover { transform: translateY(-5px) scale(1.04); }
  .gallery-close {
    position: absolute;
    top: 18px;
    right: 24px;
    background: none;
    border: 1px solid rgba(170, 200, 230, 0.4);
    border-radius: 50%;
    width: 38px;
    height: 38px;
    color: #dbe6f2;
    font-size: 17px;
    cursor: pointer;
  }

  .card-inspect-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(2, 5, 11, 0.88);
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .card-inspect-backdrop.hidden { display: none; }
  .card-inspect-backdrop .card {
    width: 320px;
    transition: transform 0.08s linear;
    will-change: transform;
  }
  .card-inspect-backdrop .card-title { font-size: 21px; }
  .card-inspect-backdrop .card-flavor { font-size: 14px; }
  .card-inspect-backdrop .card-meta { font-size: 12px; }

  .menu-button {
    pointer-events: auto;
    background: rgba(12, 24, 40, 0.85);
    border: 1px solid rgba(200, 162, 74, 0.55);
    border-radius: 20px;
    color: #ecd9a0;
    padding: 9px 24px;
    font-size: 13.5px;
    letter-spacing: 2px;
    cursor: pointer;
    text-transform: uppercase;
    margin-top: 18px;
  }
  .menu-button:hover { background: rgba(200, 162, 74, 0.25); }

  .onboarding-prompt {
    position: fixed;
    bottom: 120px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(8, 16, 28, 0.88);
    border: 1px solid rgba(200, 162, 74, 0.7);
    border-radius: 10px;
    padding: 14px 30px;
    color: #f0e6cc;
    font-size: 16.5px;
    letter-spacing: 1px;
    font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    z-index: 30;
    text-align: center;
    max-width: 84vw;
  }
  .onboarding-prompt.hidden { display: none; }
  .onboarding-prompt.pulse-once { animation: prompt-pop 0.5s cubic-bezier(0.2, 1.8, 0.4, 1); }
  @keyframes prompt-pop { 0% { transform: translateX(-50%) scale(0.7); opacity: 0; } 100% { transform: translateX(-50%) scale(1); opacity: 1; } }
`;

let injected = false;

export function inject_ui_styles(): void {
  if (injected) return;
  injected = true;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
}
