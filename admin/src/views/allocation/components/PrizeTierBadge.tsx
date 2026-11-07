import React from 'react';
import { Crown, Sparkles, Gem, Layers, Gift, Coins, Flame } from 'lucide-react';

interface PrizeTierBadgeProps {
  grade: string;
  className?: string;
}

export const PrizeTierBadge: React.FC<PrizeTierBadgeProps> = ({ grade, className = '' }) => {
  const g = (grade || '').trim().toUpperCase();

  if (g === '1' || g === 'A') {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono font-black text-xs bg-gradient-to-r from-amber-500/20 to-yellow-500/10 text-amber-300 border border-amber-400/60 shadow-[0_0_8px_rgba(245,158,11,0.25)] select-none shrink-0 ${className}`}
      >
        <Crown className="w-3 h-3 text-amber-400 fill-amber-400/30" />
        <span>{grade}賞 · 大賞</span>
      </span>
    );
  }

  if (g === '2' || g === 'B') {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono font-bold text-xs bg-gradient-to-r from-violet-500/20 to-purple-500/10 text-violet-300 border border-violet-400/50 select-none shrink-0 ${className}`}
      >
        <Sparkles className="w-3 h-3 text-violet-400" />
        <span>{grade}賞 · 次賞</span>
      </span>
    );
  }

  if (g === '3' || g === 'C') {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono font-bold text-xs bg-blue-500/20 text-blue-300 border border-blue-400/50 select-none shrink-0 ${className}`}
      >
        <Gem className="w-3 h-3 text-blue-400" />
        <span>{grade}賞</span>
      </span>
    );
  }

  if (g === 'X') {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono font-black text-xs bg-gradient-to-r from-fuchsia-500/20 to-pink-500/10 text-fuchsia-300 border border-fuchsia-400/60 select-none shrink-0 ${className}`}
      >
        <Gift className="w-3 h-3 text-fuchsia-400" />
        <span>X · 盲盒</span>
      </span>
    );
  }

  if (g === 'Z' || g.includes('0P') || g.includes('1P')) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono font-bold text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-400/50 select-none shrink-0 ${className}`}
      >
        <Coins className="w-3 h-3 text-emerald-400" />
        <span>Z · 保底小賞</span>
      </span>
    );
  }

  if (g === 'LAST' || g === 'LS' || g.includes('最後')) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono font-black text-xs bg-slate-950 text-amber-300 border border-amber-400 ring-1 ring-amber-400/50 shadow-[0_0_10px_rgba(245,158,11,0.3)] select-none shrink-0 ${className}`}
      >
        <Flame className="w-3 h-3 text-amber-400 fill-amber-400 animate-pulse" />
        <span>LAST 最後賞</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono font-bold text-xs bg-slate-800 text-slate-300 border border-slate-700 select-none shrink-0 ${className}`}
    >
      <Layers className="w-3 h-3 text-slate-400" />
      <span>{grade}賞</span>
    </span>
  );
};
