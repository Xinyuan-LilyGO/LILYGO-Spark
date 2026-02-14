import React, { useEffect, useState } from 'react';

interface HackerEasterEggProps {
  show: boolean;
  onComplete: () => void;
  message?: string;
  duration?: number;
}

export const HackerEasterEgg: React.FC<HackerEasterEggProps> = ({
  show,
  onComplete,
  message = 'ACCESS GRANTED',
  duration = 2000,
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      const t = setTimeout(() => {
        setVisible(false);
        onComplete();
      }, duration);
      return () => clearTimeout(t);
    }
  }, [show, duration, onComplete]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
      <div className="animate-hacker-flash bg-black/90 backdrop-blur-sm rounded-2xl px-12 py-8 border-2 border-emerald-500/50 shadow-[0_0_60px_rgba(16,185,129,0.4)]">
        <p className="font-mono text-2xl sm:text-3xl font-bold text-emerald-400 tracking-widest">
          // {message}
        </p>
        <p className="font-mono text-xs text-emerald-500/70 mt-2 tracking-wider">
          [0x00] ROOT
        </p>
      </div>
    </div>
  );
};
