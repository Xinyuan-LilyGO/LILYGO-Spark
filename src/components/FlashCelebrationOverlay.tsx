import React from 'react';
import type { FlashCelebrationStyle } from '../contexts/ThemeContext';
import FireworksCanvas from './FireworksCanvas';

interface FlashCelebrationOverlayProps {
  style: FlashCelebrationStyle;
}

const FlashCelebrationOverlay: React.FC<FlashCelebrationOverlayProps> = ({ style }) => {
  const baseClass = 'absolute inset-0 z-50 flex items-center justify-center pointer-events-none';

  if (style === 'fireworks') {
    return (
      <div className="fixed inset-0 z-50 pointer-events-none">
        <FireworksCanvas />
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="font-mono text-2xl font-bold text-white drop-shadow-[0_0_8px_rgba(0,0,0,0.8)] tracking-wider">FLASH COMPLETE ✓</p>
        </div>
      </div>
    );
  }

  if (style === 'hacker') {
    return (
      <div className={baseClass}>
        <div className="animate-hacker-flash bg-black/85 backdrop-blur-sm rounded-xl px-8 py-6 border-2 border-emerald-500/60 shadow-[0_0_40px_rgba(16,185,129,0.35)]">
          <p className="font-mono text-xl font-bold text-emerald-400 tracking-wider">FLASH COMPLETE ✓</p>
          <p className="font-mono text-xs text-emerald-500/80 mt-1">0x00 WRITTEN</p>
        </div>
      </div>
    );
  }

  if (style === 'minimal') {
    return (
      <div className={baseClass}>
        <div className="animate-hacker-flash bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-2xl px-10 py-8 border border-slate-200 dark:border-slate-600 shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 dark:bg-emerald-500/30 flex items-center justify-center mx-auto mb-3">
            <span className="text-3xl text-emerald-600 dark:text-emerald-400">✓</span>
          </div>
          <p className="text-lg font-semibold text-slate-800 dark:text-slate-200">Flash Complete</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Firmware written successfully</p>
        </div>
      </div>
    );
  }

  if (style === 'neon') {
    return (
      <div className={baseClass}>
        <div className="animate-hacker-flash bg-slate-950/90 backdrop-blur-sm rounded-xl px-8 py-6 border-2 border-violet-400/80 shadow-[0_0_30px_rgba(139,92,246,0.5),inset_0_0_20px_rgba(139,92,246,0.1)]">
          <p className="font-mono text-xl font-bold text-violet-300 tracking-wider drop-shadow-[0_0_8px_rgba(139,92,246,0.8)]">FLASH COMPLETE ✓</p>
          <p className="font-mono text-xs text-violet-400/90 mt-1">0x00 WRITTEN</p>
        </div>
      </div>
    );
  }

  if (style === 'terminal') {
    return (
      <div className={baseClass}>
        <div className="animate-hacker-flash bg-black rounded-lg px-8 py-6 border-2 border-green-500/70 font-mono shadow-[0_0_20px_rgba(34,197,94,0.3)]">
          <p className="text-green-400 text-lg">$ flash --write</p>
          <p className="text-green-500 text-sm mt-1">[OK] 0x0000 - 0xFFFF</p>
          <p className="text-green-400 text-lg mt-2">FLASH COMPLETE ✓</p>
          <p className="text-slate-500 text-xs mt-1">Press any key to continue...</p>
        </div>
      </div>
    );
  }

  if (style === 'gradient') {
    return (
      <div className={baseClass}>
        <div className="animate-hacker-flash bg-gradient-to-br from-emerald-500/20 via-teal-500/20 to-cyan-500/20 dark:from-emerald-600/30 dark:via-teal-600/30 dark:to-cyan-600/30 backdrop-blur-md rounded-2xl px-10 py-8 border border-white/20 dark:border-white/10 shadow-xl">
          <div className="bg-gradient-to-r from-emerald-500 to-cyan-500 bg-clip-text text-transparent">
            <p className="font-bold text-2xl tracking-wide">FLASH COMPLETE ✓</p>
          </div>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-2">Firmware written successfully</p>
        </div>
      </div>
    );
  }

  // fallback to hacker
  return (
    <div className={baseClass}>
      <div className="animate-hacker-flash bg-black/85 backdrop-blur-sm rounded-xl px-8 py-6 border-2 border-emerald-500/60 shadow-[0_0_40px_rgba(16,185,129,0.35)]">
        <p className="font-mono text-xl font-bold text-emerald-400 tracking-wider">FLASH COMPLETE ✓</p>
        <p className="font-mono text-xs text-emerald-500/80 mt-1">0x00 WRITTEN</p>
      </div>
    </div>
  );
};

export default FlashCelebrationOverlay;
