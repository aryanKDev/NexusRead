import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, TrendingUp, Clock, Target, Award, Zap } from 'lucide-react';

function AnimatedCounter({ value, duration = 1200 }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    const start = performance.now();
    const startVal = 0;
    const endVal = Number(value) || 0;

    const tick = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(startVal + (endVal - startVal) * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => rafRef.current && cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return <span>{display.toLocaleString()}</span>;
}

function RadialProgress({ value = 0, size = 120, strokeWidth = 10 }) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      {/* Track */}
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke="rgba(255,255,255,0.05)" strokeWidth={strokeWidth} />
      {/* Fill */}
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke="url(#radial-grad)" strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }}
      />
      <defs>
        <linearGradient id="radial-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function StatsPanel({ books = [], analytics }) {
  const bookList = Array.isArray(books) ? books : [];
  const completed   = bookList.filter(b => b.status === 'completed').length;
  const reading     = bookList.filter(b => b.status === 'reading').length;
  const wishlist    = bookList.filter(b => b.status === 'wishlist').length;
  // Backend getDashboardStats returns 'pagesRead' (not 'totalPagesRead').
  const totalPages  = analytics?.pagesRead ?? bookList.reduce((s, b) => s + (b.currentPage || 0), 0);
  const goalProgress = analytics?.yearlyGoalProgress || 0;
  const avgRating    = analytics?.averageRating || 0;

  const stats = [
    {
      label: 'Total Books',
      value: bookList.length,
      icon: BookOpen,
      color: '#7c3aed',
      glow: 'rgba(124,58,237,0.3)',
      sub: `${completed} completed`,
    },
    {
      label: 'Pages Read',
      value: totalPages,
      icon: TrendingUp,
      color: '#06b6d4',
      glow: 'rgba(6,182,212,0.3)',
      sub: `${reading} in progress`,
    },
    {
      label: 'Avg Rating',
      value: avgRating.toFixed ? avgRating.toFixed(1) : avgRating,
      icon: Award,
      color: '#f59e0b',
      glow: 'rgba(245,158,11,0.3)',
      sub: `out of 5.0`,
      noCounter: true,
    },
    {
      label: 'Wishlist',
      value: wishlist,
      icon: Zap,
      color: '#10b981',
      glow: 'rgba(16,185,129,0.3)',
      sub: `books to read`,
    },
  ];

  return (
    <div className="mb-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color, glow, sub, noCounter }) => (
          <div
            key={label}
            className="relative overflow-hidden rounded-2xl p-5 animate-slide-in-up"
            style={{
              background: 'rgba(15,15,26,0.8)',
              border: `1px solid rgba(255,255,255,0.07)`,
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = `${color}44`; e.currentTarget.style.boxShadow = `0 0 20px ${glow}`; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            {/* Background glow blob */}
            <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full opacity-20 blur-xl"
              style={{ background: color }} />

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2.5 rounded-xl" style={{ background: `${color}20` }}>
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <div className="text-right">
                  <div className="text-2xl font-extrabold text-white font-display">
                    {noCounter ? value : <AnimatedCounter value={value} />}
                  </div>
                </div>
              </div>
              <p className="text-sm font-semibold text-slate-300 mb-0.5">{label}</p>
              <p className="text-xs text-slate-500">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Goal ring panel */}
      {goalProgress > 0 && (
        <div className="mt-4 glass-card p-5 flex items-center gap-6">
          <div className="relative flex-shrink-0">
            <RadialProgress value={goalProgress} />
            <div className="absolute inset-0 flex items-center justify-center rotate-90">
              <div className="text-center">
                <div className="text-xl font-extrabold text-white">{Math.round(goalProgress)}%</div>
                <div className="text-xs text-slate-500">done</div>
              </div>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-4 h-4 text-violet-400" />
              <span className="text-sm font-bold text-white">Reading Goal {analytics?.year || new Date().getFullYear()}</span>
            </div>
            <p className="text-slate-400 text-sm">
              <span className="text-violet-400 font-bold">{analytics?.totalBooksRead ?? completed}</span>
              {' of '}
              <span className="text-white font-bold">{analytics?.targetBooks || '?'}</span> books completed
            </p>
            <div className="mt-2 progress-bar w-48">
              <div className="progress-fill" style={{ width: `${Math.min(goalProgress, 100)}%` }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}