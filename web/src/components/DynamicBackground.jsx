import { useEffect, useRef } from 'react';

// Fondo espacial: estrellas que caen despacio (canvas) con alguna estrella fugaz ocasional,
// más un degradado violeta que sigue al mouse. Con prefers-reduced-motion la caída es 4 veces más lenta,
// sin titileo ni estrellas fugaces.
const CONFIG = {
  app: { density: 0.00007, maxStars: 140, speed: 0.12, alpha: 0.55, shootingEveryMs: 14000 },
  login: { density: 0.00012, maxStars: 240, speed: 0.18, alpha: 0.85, shootingEveryMs: 6000 },
};

const rand = (a, b) => a + Math.random() * (b - a);

export default function DynamicBackground({ variant = 'app' }) {
  const ref = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const el = ref.current;
    const canvas = canvasRef.current;
    if (!el || !canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    const cfg = CONFIG[variant] || CONFIG.app;
    const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const speed = reduced ? 0.25 : 1;

    let w = 0;
    let h = 0;
    let stars = [];
    let shooting = null;
    let nextShot = performance.now() + cfg.shootingEveryMs;
    let raf = 0;
    let last = performance.now();

    const makeStar = (y = rand(0, h)) => {
      const depth = Math.random(); // 0 = lejos (pequeña, lenta), 1 = cerca (grande, más rápida)
      return {
        x: rand(0, w),
        y,
        r: 0.4 + depth * 1.3,
        vy: cfg.speed * (0.25 + depth),          // px por frame a 60 fps: caída lenta
        vx: cfg.speed * (0.15 + depth * 0.25),   // leve diagonal
        a: (0.25 + depth * 0.75) * cfg.alpha,
        tw: rand(0, Math.PI * 2),                // fase del titileo
        violet: Math.random() < 0.25,
      };
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const target = Math.min(cfg.maxStars, Math.round(w * h * cfg.density));
      stars = Array.from({ length: target }, () => makeStar());
    };

    const draw = (dt, now) => {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        s.y += s.vy * dt * speed;
        s.x += s.vx * dt * speed;
        if (s.y > h + 4 || s.x > w + 4) Object.assign(s, makeStar(-4), { x: rand(-w * 0.2, w) });
        const twinkle = reduced ? 1 : 0.75 + 0.25 * Math.sin(now / 900 + s.tw);
        ctx.globalAlpha = s.a * twinkle;
        ctx.fillStyle = s.violet ? '#cfc8ff' : '#ffffff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      // Estrella fugaz lenta y discreta
      if (!reduced && !shooting && now > nextShot) {
        shooting = { x: rand(w * 0.1, w * 0.7), y: rand(0, h * 0.3), life: 0 };
        nextShot = now + cfg.shootingEveryMs * rand(0.7, 1.4);
      }
      if (shooting) {
        shooting.life += dt;
        const t = shooting.life / 90; // ~1.5 s a 60 fps
        const len = 90;
        const x = shooting.x + t * 260;
        const y = shooting.y + t * 120;
        const grad = ctx.createLinearGradient(x, y, x - len, y - len * 0.46);
        grad.addColorStop(0, 'rgba(255,255,255,0.9)');
        grad.addColorStop(1, 'rgba(180,171,255,0)');
        ctx.globalAlpha = Math.max(0, 1 - t) * cfg.alpha;
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - len, y - len * 0.46);
        ctx.stroke();
        if (t >= 1) shooting = null;
      }
      ctx.globalAlpha = 1;
    };

    const loop = (now) => {
      // Normaliza a 60 fps; el primer frame puede traer un tiempo anterior a `last` (dt negativo) y al volver
      // a la pestaña un salto grande: ambos se acotan.
      const raw = (now - last) / 16.67;
      const dt = Number.isFinite(raw) ? Math.min(3, Math.max(0, raw)) : 1;
      last = now;
      draw(dt, now);
      raf = requestAnimationFrame(loop);
    };

    resize();
    raf = requestAnimationFrame(loop);

    // Degradado que sigue al mouse (solo escritorio)
    let glowFrame = 0;
    let mx = 0;
    let my = 0;
    const paintGlow = () => {
      glowFrame = 0;
      el.style.setProperty('--x', `${mx}px`);
      el.style.setProperty('--y', `${my}px`);
    };
    const onMove = (e) => {
      mx = e.clientX;
      my = e.clientY;
      if (!glowFrame) glowFrame = requestAnimationFrame(paintGlow);
    };
    const onVisibility = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else { last = performance.now(); raf = requestAnimationFrame(loop); }
    };
    let resizeTimer = 0;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 150);
    };

    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
    if (!reduced) window.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      if (glowFrame) cancelAnimationFrame(glowFrame);
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [variant]);

  return (
    <div ref={ref} aria-hidden="true" className={`dyn-bg ${variant === 'login' ? 'dyn-bg--login' : ''}`}>
      <canvas ref={canvasRef} className="dyn-bg__canvas" />
    </div>
  );
}
