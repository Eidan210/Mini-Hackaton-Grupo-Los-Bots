import { useEffect, useRef } from 'react';

// Fondo decorativo: degradado radial violeta que sigue al mouse (--x/--y vía requestAnimationFrame)
// y campo de estrellas en CSS. Con prefers-reduced-motion queda estático y sin listeners.
export default function DynamicBackground({ variant = 'app' }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window.matchMedia !== 'function') return undefined;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduced.matches) return undefined;

    let frame = 0;
    let x = 0;
    let y = 0;
    const paint = () => {
      frame = 0;
      el.style.setProperty('--x', `${x}px`);
      el.style.setProperty('--y', `${y}px`);
    };
    const onMove = (e) => {
      x = e.clientX;
      y = e.clientY;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={ref} aria-hidden="true" className={`dyn-bg ${variant === 'login' ? 'dyn-bg--login' : ''}`}>
      <div className="dyn-bg__stars" />
      <div className="dyn-bg__stars dyn-bg__stars--far" />
    </div>
  );
}
