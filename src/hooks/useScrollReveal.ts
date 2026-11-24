import { useEffect, useRef, useState } from 'react';

/**
 * Observes when a section enters the viewport and toggles `.is-in`
 * to trigger Fellowship-style staggered word and card reveals.
 */
export function useScrollReveal<T extends HTMLElement = HTMLElement>(threshold = 0.14) {
  const ref = useRef<T | null>(null);
  const [isIn, setIsIn] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setIsIn(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIsIn(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold, rootMargin: '0px 0px -40px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, isIn };
}

/**
 * Smoothly counts up a numeric stat once `active` becomes true.
 */
export function useCountUp(target: number, active: boolean, durationMs = 1100): number {
  const [value, setValue] = useState(target);

  useEffect(() => {
    if (!active) return;

    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setValue(target);
      return;
    }

    let rafId = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) {
        rafId = requestAnimationFrame(tick);
      }
    };

    setValue(0);
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [target, active, durationMs]);

  return value;
}
