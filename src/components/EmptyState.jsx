import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { Search, Inbox, BookOpen, Library, TrendingUp, Plus } from 'lucide-react';

const VARIANT_CONFIG = {
  'no-results': {
    Icon: Inbox,
    gradient: 'from-slate-800/60 to-slate-900/80',
    iconColor: 'text-slate-500',
    glow: 'rgba(100,116,139,0.15)',
  },
  'empty-library': {
    Icon: Library,
    gradient: 'from-violet-900/40 to-indigo-900/30',
    iconColor: 'text-violet-400',
    glow: 'rgba(124,58,237,0.2)',
  },
  'no-analytics': {
    Icon: TrendingUp,
    gradient: 'from-cyan-900/30 to-slate-900/60',
    iconColor: 'text-cyan-400',
    glow: 'rgba(6,182,212,0.15)',
  },
  prompt: {
    Icon: Search,
    gradient: 'from-violet-900/30 to-slate-900/60',
    iconColor: 'text-violet-400',
    glow: 'rgba(124,58,237,0.15)',
  },
};

function EmptyState({
  variant = 'prompt',
  title,
  description,
  actionLabel,
  onAction,
  icon: CustomIcon,
}) {
  const config = VARIANT_CONFIG[variant] || VARIANT_CONFIG.prompt;
  const Icon = CustomIcon || config.Icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative rounded-2xl border border-dashed border-white/[0.08] p-10 text-center overflow-hidden"
      style={{
        background: `radial-gradient(ellipse at center top, ${config.glow}, transparent 70%), rgba(12,12,26,0.6)`,
      }}
    >
      {/* Subtle animated grid background */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
        className={`relative mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br ${config.gradient} border border-white/[0.06]`}
        style={{ boxShadow: `0 0 30px ${config.glow}` }}
      >
        <Icon className={`h-7 w-7 ${config.iconColor}`} />
      </motion.div>

      <h3 className="text-base font-bold text-white mb-1.5">{title}</h3>

      {description && (
        <p className="text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
          {description}
        </p>
      )}

      {actionLabel && typeof onAction === 'function' && (
        <motion.div className="mt-6" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <button
            type="button"
            onClick={onAction}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-500 hover:to-violet-600 text-white text-sm font-semibold transition-all shadow-[0_0_20px_rgba(124,58,237,0.3)] hover:shadow-[0_0_30px_rgba(124,58,237,0.5)]"
          >
            <Plus className="w-4 h-4" />
            {actionLabel}
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}

export default memo(EmptyState);
