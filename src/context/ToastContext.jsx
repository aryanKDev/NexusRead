import { createContext, useState, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

export const ToastContext = createContext(null);

const TOAST_ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const TOAST_STYLES = {
  success: 'bg-emerald-950/90 border-emerald-500/30 text-emerald-200',
  error: 'bg-red-950/90 border-red-500/30 text-red-200',
  warning: 'bg-amber-950/90 border-amber-500/30 text-amber-200',
  info: 'bg-sky-950/90 border-sky-500/30 text-sky-200',
};

const PROGRESS_COLORS = {
  success: 'bg-emerald-500',
  error: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-sky-500',
};

let toastId = 0;

function Toast({ toast, onDismiss }) {
  const Icon = TOAST_ICONS[toast.type] || TOAST_ICONS.info;
  const style = TOAST_STYLES[toast.type] || TOAST_STYLES.info;
  const progressColor = PROGRESS_COLORS[toast.type] || PROGRESS_COLORS.info;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.9 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className={`relative flex items-start gap-3 px-4 py-3.5 rounded-xl border backdrop-blur-xl shadow-2xl overflow-hidden min-w-[280px] max-w-sm ${style}`}
      role="alert"
    >
      <Icon className="w-4.5 h-4.5 mt-0.5 flex-shrink-0" />
      <p className="text-sm font-medium flex-1 leading-relaxed">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="p-0.5 rounded-lg opacity-50 hover:opacity-100 transition-opacity flex-shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
      {/* Auto-dismiss progress bar */}
      <motion.div
        className={`absolute bottom-0 left-0 h-0.5 ${progressColor}`}
        initial={{ width: '100%' }}
        animate={{ width: '0%' }}
        transition={{ duration: toast.duration / 1000, ease: 'linear' }}
      />
    </motion.div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (timersRef.current.has(id)) {
      clearTimeout(timersRef.current.get(id));
      timersRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback((message, type = 'success', duration = 4000) => {
    const id = ++toastId;
    setToasts((prev) => [...prev.slice(-4), { id, message, type, duration }]); // Keep max 5 toasts
    const timer = setTimeout(() => dismiss(id), duration);
    timersRef.current.set(id, timer);
    return () => dismiss(id);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2.5 items-end pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => (
            <div key={t.id} className="pointer-events-auto">
              <Toast toast={t} onDismiss={dismiss} />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
