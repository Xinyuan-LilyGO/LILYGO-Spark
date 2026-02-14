import React, { useRef, useEffect } from 'react';

const COLORS = [
  [16, 185, 129],   // emerald
  [34, 211, 238],   // cyan
  [251, 191, 36],   // amber
  [139, 92, 246],   // violet
  [244, 63, 94],    // rose
];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  color: number[];
  size: number;
}

interface Rocket {
  x: number;
  y: number;
  vy: number;
  targetY: number;
  color: number[];
  particles: Particle[];
  exploded: boolean;
  launchAt: number;
}

const ROCKET_COUNT = 4;
const PARTICLES_PER_ROCKET = 32;
const DURATION_MS = 2600;

const FireworksCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startTimeRef = useRef<number>(0);
  const rocketsRef = useRef<Rocket[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    const w = window.innerWidth;
    const h = window.innerHeight;

    const createRockets = (): Rocket[] => {
      const rockets: Rocket[] = [];
      for (let i = 0; i < ROCKET_COUNT; i++) {
        const x = w * (0.15 + Math.random() * 0.7);
        const targetY = h * (0.2 + Math.random() * 0.45);
        const color = COLORS[i % COLORS.length];
        rockets.push({
          x,
          y: h + 20,
          vy: -11 - Math.random() * 3,
          targetY,
          color,
          particles: [],
          exploded: false,
          launchAt: i * 120,
        });
      }
      return rockets;
    };

    const explode = (r: Rocket) => {
      for (let i = 0; i < PARTICLES_PER_ROCKET; i++) {
        const angle = (Math.PI * 2 * i) / PARTICLES_PER_ROCKET + Math.random() * 0.5;
        const speed = 3 + Math.random() * 6;
        r.particles.push({
          x: r.x,
          y: r.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2,
          life: 1,
          decay: 0.015 + Math.random() * 0.01,
          color: r.color,
          size: 1.5 + Math.random() * 1.5,
        });
      }
      r.exploded = true;
    };

    rocketsRef.current = createRockets();
    startTimeRef.current = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTimeRef.current;
      if (elapsed > DURATION_MS) {
        window.removeEventListener('resize', resize);
        return;
      }

      ctx.clearRect(0, 0, w, h);

      const rockets = rocketsRef.current;
      for (const r of rockets) {
        if (elapsed < r.launchAt) continue;
        if (!r.exploded) {
          r.y += r.vy;
          r.vy += 0.14;
          if (r.y <= r.targetY) explode(r);
          ctx.fillStyle = `rgba(${r.color[0]},${r.color[1]},${r.color[2]},0.9)`;
          ctx.beginPath();
          ctx.arc(r.x, r.y, 2, 0, Math.PI * 2);
          ctx.fill();
        }

        for (let i = r.particles.length - 1; i >= 0; i--) {
          const p = r.particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.08;
          p.life -= p.decay;

          if (p.life <= 0) {
            r.particles.splice(i, 1);
            continue;
          }

          ctx.fillStyle = `rgba(${p.color[0]},${p.color[1]},${p.color[2]},${p.life})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
};

export default FireworksCanvas;
