export default class GradCapLoader {
  constructor(el, opts = {}) {
    this.el = el;
    this.speed = opts.speed || 1;
    this.duration = 3.4;
    this.running = false;
    this.t = 0;
    this.build();
    this.onResize = () => this.setStroke();
    window.addEventListener('resize', this.onResize);
    this.setStroke();
    this.render(0);
  }

  build() {
    this.el.innerHTML = `
    <svg viewBox="0 0 200 200" fill="none" stroke="var(--grad-loader-ink)" stroke-linecap="round" stroke-linejoin="round">
      <g data-part="cap">
        <path d="M56 95 V126 C56 148 144 148 144 126 V95" fill="none" vector-effect="non-scaling-stroke"/>
        <path d="M25 78 L100 45 L175 78 L100 111 Z" fill="var(--grad-loader-bg)" vector-effect="non-scaling-stroke"/>
        <path d="M52 82 L94 74" vector-effect="non-scaling-stroke"/>
        <g data-part="cord">
          <path d="M40 87 V117" vector-effect="non-scaling-stroke"/>
        </g>
        <g data-part="ring"><circle cx="40" cy="122" r="5" fill="var(--grad-loader-bg)" vector-effect="non-scaling-stroke"/></g>
        <g data-part="tassel">
          <path d="M40 127 C34 138 38 146 33 156 L44 150 C46 141 44 133 40 127 Z" fill="#1a2a5a" stroke="#1a2a5a" vector-effect="non-scaling-stroke"/>
        </g>
      </g>
    </svg>`;
    const q = id => this.el.querySelector('[data-part="' + id + '"]');
    this.svg = this.el.querySelector('svg');
    this.cap = q('cap'); this.cord = q('cord'); this.ring = q('ring'); this.tassel = q('tassel');
    this.paths = this.svg.querySelectorAll('path, circle');
  }

  setStroke() {
    // vector-effect keeps the line weight constant while the cap squashes, so size it in screen px
    const w = Math.max(2.5, this.el.clientWidth * 0.026);
    this.paths.forEach(p => p.setAttribute('stroke-width', w));
  }

  /* ---- easing helpers ---- */
  static clamp(x) { return Math.min(1, Math.max(0, x)); }
  static seg(t, a, b) { return GradCapLoader.clamp((t - a) / (b - a)); }
  static inOut(x) { return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  static out(x) { return 1 - Math.pow(1 - x, 3); }
  static inBack(x) { const c = 1.9; return (c + 1) * x * x * x - c * x * x; }
  static outBack(x) { const c = 2.2; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); }

  render(t) {
    const E = GradCapLoader, seg = E.seg;
    let swing = 0, tassel = 1, ring = 1, cord = 1;

    if (t < 1.1) {
      swing = -14 * E.inOut(seg(t, 0.05, 0.5));
      tassel = 1 - E.inBack(seg(t, 0.5, 0.95));
      ring = cord = 1 - E.inOut(seg(t, 0.9, 1.1));
    } else if (t < 2.2) {
      tassel = ring = cord = 0;
    } else {
      ring = E.outBack(seg(t, 2.2, 2.5));
      cord = E.out(seg(t, 2.3, 2.6));
      tassel = E.outBack(seg(t, 2.55, 3.0));
      const tt = Math.max(0, t - 2.55);
      swing = 16 * Math.exp(-5 * tt) * Math.sin(14 * tt);
    }

    // tassel: pivot around the ring; cord: grows down from under the board
    const eps = 0.0001;
    this.tassel.setAttribute('transform', `translate(40 127) rotate(${swing}) scale(${Math.max(eps, tassel)}) translate(-40 -127)`);
    this.ring.setAttribute('transform', `translate(40 122) scale(${Math.max(eps, ring)}) translate(-40 -122)`);
    this.cord.setAttribute('transform', `translate(40 87) scale(1 ${Math.max(eps, cord)}) translate(-40 -87)`);
    this.tassel.style.display = tassel < 0.01 ? 'none' : '';
    this.ring.style.display = ring < 0.01 ? 'none' : '';
    this.cord.style.display = cord < 0.01 ? 'none' : '';

    // cap: squeeze to a vertical diamond, rotate down to a dash, then mirror it back
    const p = seg(t, 1.0, 2.3);
    const s = Math.sin(Math.PI * p);
    const size = 1 - 0.96 * Math.pow(s, 0.75);
    const sx = 1 - 0.88 * Math.min(1, s * 3);
    const rot = 88 * Math.pow(s, 2);
    this.cap.setAttribute('transform',
      `translate(100 95) rotate(${rot}) scale(${Math.max(eps, sx * size)} ${Math.max(eps, size)}) translate(-100 -95)`);
  }

  play() {
    if (this.running) return;
    this.running = true;
    let last = performance.now();
    const tick = now => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.t = (this.t + dt * this.speed) % this.duration;
      this.render(this.t);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }
  pause() { this.running = false; cancelAnimationFrame(this.raf); }
  destroy() { this.pause(); window.removeEventListener('resize', this.onResize); this.el.innerHTML = ''; }
}
