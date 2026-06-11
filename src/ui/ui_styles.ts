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
    animation: toast-in 0.35s ease, toast-out 0.5s ease 3.4s forwards;
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
`;

let injected = false;

export function inject_ui_styles(): void {
  if (injected) return;
  injected = true;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
}
