// file: src/core/input_manager.ts
// description: Keyboard input manager - tracks held keys and one-shot key presses for ship controls and camera/menu actions
// reference: src/main.ts, src/ship/ship_physics.ts, src/camera/camera_director.ts

export class InputManager {
  private readonly held = new Set<string>();
  private readonly pressed = new Set<string>();

  constructor() {
    window.addEventListener('keydown', (event) => {
      if (event.repeat) return;
      this.held.add(event.code);
      this.pressed.add(event.code);
    });
    window.addEventListener('keyup', (event) => {
      this.held.delete(event.code);
    });
    window.addEventListener('blur', () => {
      this.held.clear();
    });
  }

  is_held(code: string): boolean {
    return this.held.has(code);
  }

  /** True only on the frame the key went down. Consumed by end_frame(). */
  was_pressed(code: string): boolean {
    return this.pressed.has(code);
  }

  end_frame(): void {
    this.pressed.clear();
  }
}
