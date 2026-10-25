// Move the supplied animated eye as one object, without modifying the video.
export class EntranceEye {
  constructor(element) {
    this.element = element;
    this.active = true;
    this.frame = 0;
    this.motion = matchMedia("(prefers-reduced-motion: reduce)");
    this.pointer = matchMedia("(any-pointer: fine)");
    this.park = () => {
      this.target = { x: innerWidth * 0.72, y: innerHeight * 0.48 };
      this.wake();
    };
    this.move = (event) => {
      if (!this.enabled() || event.pointerType === "touch") return;
      this.target = { x: event.clientX, y: event.clientY };
      this.wake();
    };
    this.reset = () => {
      this.stop();
      this.target = { x: innerWidth * 0.72, y: innerHeight * 0.48 };
      this.position = { ...this.target };
      this.draw();
    };
    this.visibility = () => {
      if (document.hidden) this.stop();
      else this.park();
    };
    this.reset();
    document.addEventListener("pointermove", this.move, { passive: true });
    document.documentElement.addEventListener("pointerleave", this.park);
    addEventListener("blur", this.park);
    addEventListener("resize", this.reset);
    document.addEventListener("visibilitychange", this.visibility);
    this.motion.addEventListener("change", this.reset);
    this.pointer.addEventListener("change", this.reset);
  }
  enabled() {
    return (
      this.active &&
      !document.hidden &&
      !this.motion.matches &&
      this.pointer.matches
    );
  }
  draw(tilt = 0) {
    this.element.style.transform = `translate3d(${this.position.x}px, ${this.position.y}px, 0) translate(-50%, -50%) rotate(${tilt}deg)`;
  }
  wake() {
    if (!this.enabled() || this.frame) return;
    this.last = performance.now();
    this.frame = requestAnimationFrame((now) => this.tick(now));
  }
  tick(now) {
    this.frame = 0;
    if (!this.enabled()) return;
    const delta = Math.min(64, now - this.last);
    this.last = now;
    const dx = this.target.x - this.position.x;
    const dy = this.target.y - this.position.y;
    const amount = 1 - Math.exp(-delta / 85);
    this.position.x += dx * amount;
    this.position.y += dy * amount;
    const moving = Math.hypot(dx, dy) > 0.15;
    if (!moving) this.position = { ...this.target };
    this.draw(moving ? Math.max(-4, Math.min(4, dx * 0.012)) : 0);
    if (moving) this.frame = requestAnimationFrame((time) => this.tick(time));
  }
  stop() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }
  setActive(active) {
    this.active = active;
    this.reset();
  }
}
