const PREVENT = new Set(['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F5', 'F6']);

export class Input {
  constructor(canvas) {
    this.down = new Set();
    this.pressed = new Set();
    this.mouse = { left: false, right: false };
    this.dx = 0;
    this.dy = 0;
    this.locked = false;
    this.onLockChange = null;
    this.onLockError = null;
    this.onEscape = null;
    this.touch = false;
    this.stick = null;
    this.drive = null;
    this.wheel = 0;
    window.addEventListener('wheel', (e) => {
      this.wheel += Math.sign(e.deltaY);
    }, { passive: true });

    window.addEventListener('keydown', (e) => {
      if (PREVENT.has(e.code)) e.preventDefault();
      if (e.code === 'Escape') this.onEscape?.();
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => {
      this.down.clear();
      this.mouse.left = false;
      this.mouse.right = false;
    });
    window.addEventListener('mousedown', (e) => {
      if (this.touch) return;
      if (e.button === 0) this.mouse.left = true;
      if (e.button === 2) this.mouse.right = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (this.touch) return;
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
    });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      if (this.locked) {
        this.dx += e.movementX;
        this.dy += e.movementY;
      }
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      this.onLockChange?.(this.locked);
    });
    document.addEventListener('pointerlockerror', () => this.onLockError?.());
  }

  get aimActive() {
    return this.locked || this.touch;
  }

  isDown(code) {
    return this.down.has(code);
  }

  wasPressed(code) {
    return this.pressed.has(code);
  }

  setDown(code, on) {
    if (on) this.down.add(code);
    else this.down.delete(code);
  }

  press(code) {
    this.pressed.add(code);
  }

  addAim(dx, dy) {
    this.dx += dx;
    this.dy += dy;
  }

  endFrame() {
    this.pressed.clear();
    this.dx = 0;
    this.dy = 0;
    this.wheel = 0;
  }
}
