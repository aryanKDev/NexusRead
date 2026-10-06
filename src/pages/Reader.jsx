import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, Minimize2,
  Moon, Sun, Bookmark, BookmarkCheck, Highlighter, MessageSquare,
  Settings, Timer, Zap, X, BookOpen, AlignJustify, ChevronDown,
  Play, Pause, Eye, EyeOff, FileText
} from 'lucide-react';
import api from '../api/axios';
const AIAssistant = React.lazy(() => import('../components/AIAssistant'));

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

const THEMES = [
  { id: 'dark',  label: 'Dark',  bg: '#0a0a0f',  text: '#e2e8f0', accent: '#7c3aed' },
  { id: 'oled',  label: 'OLED',  bg: '#000000',  text: '#ffffff',  accent: '#a78bfa' },
  { id: 'sepia', label: 'Sepia', bg: '#f4ece0',  text: '#3d2b1f', accent: '#92400e' },
  { id: 'white', label: 'White', bg: '#ffffff',  text: '#1a1a1a', accent: '#6d28d9' },
];

const FONT_SIZES = [14, 16, 18, 20, 22, 24];
const FONT_FAMILIES = [
  { label: 'Serif',       value: '"Georgia", "Times New Roman", serif' },
  { label: 'Sans-serif',  value: '"Inter", "Helvetica Neue", sans-serif' },
  { label: 'Dyslexic',    value: '"OpenDyslexic", sans-serif' },
];
const LINE_HEIGHTS = [1.4, 1.6, 1.8, 2.0, 2.2];

// Returns true for any absolute http/https URL (e.g. Cloudinary CDN links).
// These must NOT be loaded with credentials because CDNs return
// `Access-Control-Allow-Origin: *`, which browsers reject when
// `credentials: 'include'` is also set.
const isExternalUrl = (url) =>
  typeof url === 'string' && /^https?:\/\//i.test(url);

const HIGHLIGHT_COLORS = [
  { id: 'yellow', label: 'Yellow', bg: 'rgba(253,224,71,0.35)', border: 'rgba(253,224,71,0.7)' },
  { id: 'cyan',   label: 'Cyan',   bg: 'rgba(6,182,212,0.25)',  border: 'rgba(6,182,212,0.7)' },
  { id: 'green',  label: 'Green',  bg: 'rgba(16,185,129,0.25)', border: 'rgba(16,185,129,0.7)' },
  { id: 'pink',   label: 'Pink',   bg: 'rgba(236,72,153,0.25)', border: 'rgba(236,72,153,0.7)' },
];

// Fallback handler for external images that fail to load (ERR_CONNECTION_RESET etc.)
const FALLBACK_IMG_SRC = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="160" fill="none">' +
  '<rect width="120" height="160" rx="8" fill="#1e1b4b"/>' +
  '<text x="60" y="85" text-anchor="middle" fill="#7c3aed" font-size="14" font-family="sans-serif">No Cover</text>' +
  '</svg>'
);

/** Attach to any <img> `onError` to swap in a placeholder */
const handleImgError = (e) => {
  if (e.target.src !== FALLBACK_IMG_SRC) {
    e.target.src = FALLBACK_IMG_SRC;
  }
};

// Inline toolbar shown on text selection
function SelectionToolbar({ pos, onHighlight, onAskAI, onClose }) {
  if (!pos) return null;
  return (
    <div
      className="fixed z-50 flex items-center gap-1 px-2 py-1.5 rounded-xl shadow-2xl animate-bounce-in"
      style={{
        top: pos.y - 50,
        left: pos.x - 80,
        background: 'rgba(15,15,26,0.95)',
        border: '1px solid rgba(124,58,237,0.4)',
        backdropFilter: 'blur(16px)',
      }}
    >
      {HIGHLIGHT_COLORS.map(c => (
        <button key={c.id} title={`Highlight ${c.label}`}
          onClick={() => onHighlight(c.id)}
          className="w-5 h-5 rounded-full border-2 border-white/20 hover:scale-125 transition-transform"
          style={{ background: c.bg, borderColor: c.border }}
        />
      ))}
      <div className="w-px h-4 bg-white/10 mx-1" />
      <button onClick={onAskAI}
        className="flex items-center gap-1 text-xs text-violet-300 hover:text-violet-200 px-2 py-0.5 rounded-lg hover:bg-violet-500/20 transition-colors font-semibold"
      >
        <Zap className="w-3 h-3" /> AI
      </button>
      <button onClick={onClose} className="p-0.5 text-slate-500 hover:text-white">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

// Bookmark sidebar
function BookmarkSidebar({ bookmarks, currentPage, onJump, onClose }) {
  return (
    <div className="w-72 h-full flex flex-col glass border-l border-white/8 animate-slide-in-right">
      <div className="flex items-center justify-between p-4 border-b border-white/8">
        <div className="flex items-center gap-2">
          <Bookmark className="w-4 h-4 text-amber-400" />
          <span className="font-bold text-white text-sm">Bookmarks</span>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/8 text-slate-400 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {bookmarks.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            <Bookmark className="w-8 h-8 mx-auto mb-2 opacity-30" />
            No bookmarks yet. Press B to add one.
          </div>
        ) : (
          bookmarks.map((bm, i) => (
            <button
              key={i}
              onClick={() => onJump(bm.page)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                currentPage === bm.page
                  ? 'bg-violet-600/20 border border-violet-500/40 text-violet-300'
                  : 'hover:bg-white/5 border border-transparent text-slate-300'
              }`}
            >
              <div className="p-1.5 rounded-lg bg-amber-500/20 flex-shrink-0">
                <Bookmark className="w-3 h-3 text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">{bm.label || `Page ${bm.page}`}</p>
                <p className="text-xs text-slate-500">Page {bm.page}</p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export default function Reader() {
  const { bookId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlPageParam = searchParams.get('page');
  const hasExplicitPageInUrl = urlPageParam != null && String(urlPageParam).trim() !== '';

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  // Book & PDF state
  const [book, setBook] = useState(null);
  const [pdfUrl, setPdfUrl] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(parseInt(urlPageParam || '1'));
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pdfError, setPdfError] = useState('');

  // Reader UI state
  const [theme, setTheme] = useState(THEMES[0]);
  const [fontSize, setFontSize] = useState(18);
  const [fontFamily, setFontFamily] = useState(FONT_FAMILIES[1]);
  const [lineHeight, setLineHeight] = useState(1.8);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [showToolbar, setShowToolbar] = useState(true);
  const [showAI, setShowAI] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [autoScroll, setAutoScroll] = useState(false);
  const [autoScrollSpeed, setAutoScrollSpeed] = useState(1);

  // Annotations
  const [bookmarks, setBookmarks] = useState([]);
  const [highlights, setHighlights] = useState([]);
  const [selectedText, setSelectedText] = useState('');
  const [selectionPos, setSelectionPos] = useState(null);
  const [activeHighlightColor, setActiveHighlightColor] = useState('yellow');

  // Timer
  const [sessionTime, setSessionTime] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(true);
  const timerRef = useRef(null);

  // Page input
  const [pageInput, setPageInput] = useState('');
  const [editingPage, setEditingPage] = useState(false);

  // ---------------------------------------------------------------------------
  // Memoized file prop for <Document>.
  // • Re-computed only when pdfUrl / retryCount changes.
  // • External URLs are plain strings (no credentials).
  // • Internal URLs keep withCredentials for session cookies.
  // ---------------------------------------------------------------------------
  const pdfFile = useMemo(() => {
    if (!pdfUrl) return null;
    if (isExternalUrl(pdfUrl)) return pdfUrl;
    return { url: pdfUrl, withCredentials: true };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfUrl, retryCount]);

  // ---------------------------------------------------------------------------
  // Refs
  // ---------------------------------------------------------------------------
  const iframeRef = useRef(null);
  const containerRef = useRef(null);
  const autoScrollRef = useRef(null);
  const toolbarHideTimer = useRef(null);
  const sessionStart = useRef(Date.now());
  const lastSavedPage = useRef(currentPage);
  const selectionTimerRef = useRef(null);
  const pageObserverRefs = useRef({});

  // ---------------------------------------------------------------------------
  // Callbacks — declared BEFORE any useEffect that references them.
  // This eliminates the Temporal Dead Zone (TDZ) crashes.
  // ---------------------------------------------------------------------------

  /** Persist reading progress + annotations to backend */
  const saveProgress = useCallback(() => {
    if (!bookId || !currentPage) return;
    const sessionDuration = Math.round((Date.now() - sessionStart.current) / 1000);
    const knownTotal = Number(totalPages || book?.pages || book?.totalPages || 0);
    const safeTotal = Number.isInteger(knownTotal) && knownTotal > 0
      ? knownTotal
      : Math.max(1, Number(currentPage) || 1);
    api.post(`/reader/progress/${bookId}`, {
      currentPage,
      totalPages: safeTotal,
      sessionDuration,
      bookmarks,
      userHighlights: highlights,
    }).catch(() => {});
  }, [bookId, currentPage, totalPages, book, bookmarks, highlights]);

  /** Navigate by delta pages */
  const handlePageChange = useCallback((delta) => {
    setCurrentPage(p => Math.max(1, Math.min(totalPages || p, p + delta)));
  }, [totalPages]);

  /** Toggle bookmark on current page */
  const addBookmark = useCallback(() => {
    setBookmarks(bs => {
      const existing = bs.find(b => b.page === currentPage);
      if (existing) return bs.filter(b => b.page !== currentPage);
      return [...bs, { page: currentPage, label: `Page ${currentPage}`, createdAt: new Date().toISOString() }];
    });
  }, [currentPage]);

  // Keep a ref to the latest saveProgress so interval/unmount callbacks
  // never go stale.
  const saveProgressRef = useRef(null);
  useEffect(() => { saveProgressRef.current = saveProgress; }, [saveProgress]);

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  // Load book metadata
  useEffect(() => {
    if (!bookId) return;
    api.get(`/books/${bookId}`)
      .then(({ data }) => {
        const b = data?.data?.book || data?.data || data?.book || data;
        setBook(b);
        const url = b?.pdfUrl || b?.fileUrl || b?.pdf;
        if (url) {
          setPdfUrl(url);
          setPdfError('');
        }
        else setError('No PDF file attached to this book.');
      })
      .catch(() => setError('Could not load book.'))
      .finally(() => setLoading(false));
  }, [bookId]);

  // Load saved annotations & resume page
  useEffect(() => {
    if (!bookId) return;
    api.get(`/reader/progress/${bookId}`)
      .then(({ data }) => {
        const d = data?.data;
        if (d?.bookmarks) setBookmarks(d.bookmarks);
        if (d?.userHighlights) setHighlights(d.userHighlights);
        if (!hasExplicitPageInUrl && d?.currentPage && d.currentPage > 1) {
          setCurrentPage(d.currentPage);
        }
      }).catch(() => {});
  }, [bookId, hasExplicitPageInUrl]);

  // Session timer
  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => setSessionTime(t => t + 1), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [isTimerRunning]);

  // Auto-save progress every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (currentPage !== lastSavedPage.current) {
        saveProgressRef.current?.();
        lastSavedPage.current = currentPage;
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [currentPage, bookId]);

  // Save on unmount — uses ref so it always calls the latest version
  useEffect(() => {
    return () => { saveProgressRef.current?.(); };
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      autoScrollRef.current = setInterval(() => {
        if (containerRef.current) containerRef.current.scrollTop += autoScrollSpeed;
      }, 16);
    }
    return () => clearInterval(autoScrollRef.current);
  }, [autoScroll, autoScrollSpeed]);

  // Keyboard shortcuts — depends on stable useCallback references
  useEffect(() => {
    const handler = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') handlePageChange(1);
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') handlePageChange(-1);
      if (e.key === 'b' || e.key === 'B') addBookmark();
      if (e.key === 'f' || e.key === 'F') setFocusMode(f => !f);
      if (e.key === 'a' || e.key === 'A') setShowAI(a => !a);
      if (e.key === 'Escape') { setShowAI(false); setShowBookmarks(false); setShowSettings(false); setFocusMode(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handlePageChange, addBookmark]);

  // ---------------------------------------------------------------------------
  // Event handlers (non-hook)
  // ---------------------------------------------------------------------------

  const handlePageJump = () => {
    const n = parseInt(pageInput);
    if (n >= 1 && n <= (totalPages || Infinity)) setCurrentPage(n);
    setEditingPage(false);
    setPageInput('');
  };

  const isBookmarked = bookmarks.some(b => b.page === currentPage);

  // Text selection handler — debounced to avoid rapid state updates on drag-select
  const handleTextSelection = () => {
    clearTimeout(selectionTimerRef.current);
    selectionTimerRef.current = setTimeout(() => {
      const sel = window.getSelection();
      const text = sel?.toString()?.trim();
      if (!text || text.length < 3) {
        setSelectionPos(null);
        setSelectedText('');
        return;
      }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelectedText(text);
      setSelectionPos({ x: rect.left + rect.width / 2, y: rect.top });
    }, 150);
  };

  const handleHighlight = (colorId) => {
    if (!selectedText) return;
    setHighlights(h => [...h, { text: selectedText, colorId, page: currentPage, createdAt: new Date().toISOString() }]);
    setSelectionPos(null);
    window.getSelection()?.removeAllRanges();
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const estimatedSpeed = sessionTime > 60 ? Math.round(((currentPage - 1) / (sessionTime / 3600)) || 0) : null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) return (
    <div className="min-h-screen bg-nx-gradient flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center mx-auto mb-4 animate-pulse-glow">
          <BookOpen className="w-8 h-8 text-violet-400" />
        </div>
        <p className="text-slate-400 animate-pulse">Loading reader…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-nx-gradient flex flex-col items-center justify-center gap-4">
      <div className="p-4 rounded-2xl bg-red-950/30 border border-red-800/30">
        <p className="text-red-400">{error}</p>
      </div>
      <button onClick={() => navigate(-1)} className="btn-nx-ghost">← Go Back</button>
    </div>
  );

  const currentTheme = theme;

  return (
    <div
      className="flex flex-col min-h-screen transition-colors duration-500"
      style={{ background: currentTheme.bg, color: currentTheme.text }}
      onMouseUp={handleTextSelection}
    >
      {/* Text selection toolbar */}
      <SelectionToolbar
        pos={selectionPos}
        onHighlight={handleHighlight}
        onAskAI={() => { setShowAI(true); setSelectionPos(null); }}
        onClose={() => { setSelectionPos(null); window.getSelection()?.removeAllRanges(); }}
      />

      {/* ── Top toolbar ───────────────────────── */}
      <div
        className={`sticky top-0 z-40 flex items-center justify-between px-4 h-14 transition-all duration-300 ${
          focusMode ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
        style={{
          background: currentTheme.id === 'white' || currentTheme.id === 'sepia'
            ? `${currentTheme.bg}ee`
            : 'rgba(8,8,16,0.9)',
          backdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${currentTheme.id === 'dark' || currentTheme.id === 'oled' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}`,
        }}
      >
        {/* Left: Back + title */}
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => { saveProgress(); navigate(-1); }}
            className="p-2 rounded-xl hover:bg-white/8 transition-colors flex-shrink-0" style={{ color: currentTheme.text + '99' }}>
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <p className="font-bold text-sm truncate" style={{ color: currentTheme.text }}>{book?.title}</p>
            <p className="text-xs opacity-50 truncate">{book?.author}</p>
          </div>
        </div>

        {/* Center: Page controls */}
        <div className="flex items-center gap-2">
          <button onClick={() => handlePageChange(-1)} disabled={currentPage <= 1}
            className="p-1.5 rounded-lg hover:bg-white/8 disabled:opacity-30 transition-colors" style={{ color: currentTheme.text }}>
            <ChevronLeft className="w-4 h-4" />
          </button>

          {editingPage ? (
            <input
              autoFocus type="number" value={pageInput}
              onChange={e => setPageInput(e.target.value)}
              onBlur={handlePageJump}
              onKeyDown={e => e.key === 'Enter' && handlePageJump()}
              className="w-16 text-center text-sm rounded-lg border border-violet-500 bg-transparent outline-none py-0.5"
              style={{ color: currentTheme.text }}
            />
          ) : (
            <button
              onClick={() => { setEditingPage(true); setPageInput(String(currentPage)); }}
              className="text-sm font-semibold px-2 py-0.5 rounded-lg hover:bg-white/8 transition-colors"
              style={{ color: currentTheme.text }}
            >
              {currentPage} <span className="opacity-40">/ {totalPages || book?.pages || '?'}</span>
            </button>
          )}

          <button onClick={() => handlePageChange(1)} disabled={totalPages > 0 && currentPage >= totalPages}
            className="p-1.5 rounded-lg hover:bg-white/8 disabled:opacity-30 transition-colors" style={{ color: currentTheme.text }}>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-1">
          {/* Timer */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono opacity-60"
            style={{ color: currentTheme.text, background: `${currentTheme.text}10` }}>
            <Timer className="w-3 h-3" />
            {formatTime(sessionTime)}
            {estimatedSpeed && <span className="opacity-60">· {estimatedSpeed}p/h</span>}
          </div>

          {/* Zoom */}
          <button onClick={() => setScale(s => Math.max(0.7, s - 0.1))} className="p-1.5 rounded-lg hover:bg-white/8 opacity-70 hover:opacity-100 transition-all" style={{ color: currentTheme.text }}>
            <ZoomOut className="w-4 h-4" />
          </button>
          <button onClick={() => setScale(s => Math.min(2.5, s + 0.1))} className="p-1.5 rounded-lg hover:bg-white/8 opacity-70 hover:opacity-100 transition-all" style={{ color: currentTheme.text }}>
            <ZoomIn className="w-4 h-4" />
          </button>

          {/* Bookmark */}
          <button onClick={addBookmark}
            className={`p-1.5 rounded-lg hover:bg-white/8 transition-all ${isBookmarked ? 'text-amber-400' : 'opacity-60 hover:opacity-100'}`}
            style={{ color: isBookmarked ? '#f59e0b' : currentTheme.text }} title="Bookmark (B)">
            {isBookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
          </button>

          {/* Bookmark panel */}
          <button onClick={() => setShowBookmarks(b => !b)}
            className={`p-1.5 rounded-lg hover:bg-white/8 transition-all ${showBookmarks ? 'text-amber-400' : 'opacity-60 hover:opacity-100'}`}
            style={{ color: showBookmarks ? '#f59e0b' : currentTheme.text }}>
            <AlignJustify className="w-4 h-4" />
          </button>

          {/* Focus mode */}
          <button onClick={() => setFocusMode(f => !f)}
            className={`p-1.5 rounded-lg hover:bg-white/8 transition-all ${focusMode ? 'text-cyan-400' : 'opacity-60 hover:opacity-100'}`} title="Focus mode (F)">
            {focusMode ? <EyeOff className="w-4 h-4 text-cyan-400" /> : <Eye className="w-4 h-4" style={{ color: currentTheme.text }} />}
          </button>

          {/* Auto-scroll */}
          <button onClick={() => setAutoScroll(a => !a)}
            className={`p-1.5 rounded-lg hover:bg-white/8 transition-all ${autoScroll ? 'text-emerald-400' : 'opacity-60 hover:opacity-100'}`} title="Auto-scroll">
            {autoScroll ? <Pause className="w-4 h-4 text-emerald-400" /> : <Play className="w-4 h-4" style={{ color: currentTheme.text }} />}
          </button>

          {/* AI */}
          <button onClick={() => setShowAI(a => !a)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              showAI ? 'bg-violet-600/30 text-violet-300 border border-violet-500/40' : 'hover:bg-white/8 opacity-70 hover:opacity-100'
            }`} style={{ color: showAI ? undefined : currentTheme.text }} title="AI Assistant (A)">
            <Zap className="w-3.5 h-3.5" /> AI
          </button>

          {/* Settings */}
          <button onClick={() => setShowSettings(s => !s)}
            className={`p-1.5 rounded-lg hover:bg-white/8 transition-all ${showSettings ? 'text-violet-400' : 'opacity-60 hover:opacity-100'}`}
            style={{ color: showSettings ? '#a78bfa' : currentTheme.text }}>
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div
          className="fixed top-14 right-4 z-50 rounded-2xl shadow-2xl p-4 w-72 animate-slide-in-up"
          style={{ background: 'rgba(10,10,20,0.97)', border: '1px solid rgba(124,58,237,0.3)', backdropFilter: 'blur(24px)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="font-bold text-white text-sm">Reader Settings</span>
            <button onClick={() => setShowSettings(false)} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
          </div>

          {/* Theme */}
          <div className="mb-4">
            <p className="text-xs text-slate-500 font-semibold mb-2">THEME</p>
            <div className="grid grid-cols-4 gap-2">
              {THEMES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t)}
                  className="h-8 rounded-lg border-2 transition-all flex items-center justify-center text-xs font-bold"
                  style={{
                    background: t.bg,
                    color: t.text,
                    borderColor: theme.id === t.id ? t.accent : 'transparent',
                    boxShadow: theme.id === t.id ? `0 0 8px ${t.accent}80` : 'none',
                  }}
                >
                  {t.label[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Font size */}
          <div className="mb-4">
            <div className="flex justify-between mb-2">
              <p className="text-xs text-slate-500 font-semibold">FONT SIZE</p>
              <span className="text-xs text-violet-400">{fontSize}px</span>
            </div>
            <input type="range" min="14" max="24" step="2" value={fontSize}
              onChange={e => setFontSize(Number(e.target.value))}
              className="w-full slider" />
          </div>

          {/* Line height */}
          <div className="mb-4">
            <div className="flex justify-between mb-2">
              <p className="text-xs text-slate-500 font-semibold">LINE HEIGHT</p>
              <span className="text-xs text-violet-400">{lineHeight}</span>
            </div>
            <input type="range" min="1.4" max="2.2" step="0.2" value={lineHeight}
              onChange={e => setLineHeight(Number(e.target.value))}
              className="w-full slider" />
          </div>

          {/* Font family */}
          <div className="mb-4">
            <p className="text-xs text-slate-500 font-semibold mb-2">FONT</p>
            <div className="space-y-1">
              {FONT_FAMILIES.map(f => (
                <button key={f.label}
                  onClick={() => setFontFamily(f)}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors ${
                    fontFamily.label === f.label
                      ? 'bg-violet-600/20 text-violet-300 border border-violet-500/40'
                      : 'text-slate-400 hover:bg-white/5'
                  }`}
                  style={{ fontFamily: f.value }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Auto-scroll speed */}
          {autoScroll && (
            <div>
              <div className="flex justify-between mb-2">
                <p className="text-xs text-slate-500 font-semibold">SCROLL SPEED</p>
                <span className="text-xs text-emerald-400">{autoScrollSpeed}</span>
              </div>
              <input type="range" min="0.5" max="5" step="0.5" value={autoScrollSpeed}
                onChange={e => setAutoScrollSpeed(Number(e.target.value))}
                className="w-full slider" />
            </div>
          )}
        </div>
      )}

      {/* Progress bar (top) */}
      <div className="fixed top-14 left-0 right-0 z-30 h-0.5">
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${totalPages > 0 ? (currentPage / totalPages) * 100 : 0}%`,
            background: `linear-gradient(90deg, ${currentTheme.accent}, #06b6d4)`,
            boxShadow: `0 0 8px ${currentTheme.accent}80`,
          }}
        />
      </div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* PDF viewer */}
        <main
          ref={containerRef}
          className="flex-1 overflow-y-auto relative"
          style={{ background: currentTheme.bg }}
        >
          <div
            className="flex flex-col items-center py-8 px-4 pb-24 min-h-full transition-all duration-300"
            style={{
              filter: focusMode ? 'contrast(1.05)' : 'none',
            }}
          >
            {pdfFile ? (
              <div
                className="w-full max-w-4xl shadow-2xl rounded-2xl overflow-hidden bg-white/5"
                style={{
                  minHeight: '85vh',
                  boxShadow: `0 20px 60px rgba(0,0,0,0.8)`,
                }}
              >
                <div className="w-full h-full overflow-auto flex flex-col items-center p-6 gap-6">
                  <Document
                    file={pdfFile}
                    onLoadSuccess={({ numPages }) => {
                      setTotalPages(numPages);
                      setPdfError('');
                      setCurrentPage((p) => Math.min(Math.max(1, p), numPages));
                    }}
                    onLoadError={(err) => {
                      const msg = err?.message || '';
                      if (msg.includes('Worker')) {
                        setPdfError('PDF worker failed to start. Please retry.');
                      } else if (msg.includes('fetch') || msg.includes('network')) {
                        setPdfError('Network error — could not fetch the PDF. Check your connection.');
                      } else {
                        setPdfError(msg || 'Failed to load the PDF file.');
                      }
                    }}
                    loading={
                      <div className="p-10 text-center text-slate-500">
                        Loading PDF…
                      </div>
                    }
                    error={
                      <div className="p-10 flex flex-col items-center gap-3 text-center">
                        <FileText className="w-10 h-10 text-red-400 opacity-60" />
                        <p className="text-red-400 font-semibold text-sm">PDF failed to load</p>
                        <p className="text-slate-500 text-xs max-w-xs">
                          {pdfError || 'The file could not be fetched. Check your connection or try again.'}
                        </p>
                        <button
                          onClick={() => { setPdfError(''); setRetryCount(c => c + 1); }}
                          className="mt-2 px-4 py-1.5 rounded-lg bg-violet-600/20 text-violet-300 text-xs hover:bg-violet-600/30 transition-colors border border-violet-500/30"
                        >
                          Retry
                        </button>
                      </div>
                    }
                    renderMode="canvas"
                  >
                    {/* Virtualized page window — renders currentPage ± 1 */}
                    {(() => {
                      const windowSize = 1; // pages before/after current
                      const startPage = Math.max(1, currentPage - windowSize);
                      const endPage = totalPages > 0 ? Math.min(totalPages, currentPage + windowSize) : currentPage + windowSize;
                      const pages = [];
                      for (let p = startPage; p <= endPage; p++) {
                        pages.push(
                          <div
                            key={p}
                            data-page-number={p}
                            className="rounded-xl overflow-hidden bg-white mb-4 last:mb-0"
                            ref={(el) => {
                              if (!el) { delete pageObserverRefs.current[p]; return; }
                              pageObserverRefs.current[p] = el;
                              // Use IntersectionObserver to update currentPage on scroll
                              const observer = new IntersectionObserver(
                                ([entry]) => {
                                  if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
                                    setCurrentPage(prev => {
                                      const pageNum = Number(entry.target.dataset.pageNumber);
                                      return pageNum !== prev ? pageNum : prev;
                                    });
                                  }
                                },
                                { threshold: 0.5 }
                              );
                              observer.observe(el);
                              // Cleanup on unmount
                              el._observer = observer;
                              return () => observer.disconnect();
                            }}
                          >
                            <Page
                              pageNumber={p}
                              scale={scale}
                              renderTextLayer={false}
                              renderAnnotationLayer={false}
                              loading={<div className="p-10 text-center text-slate-500">Rendering page {p}…</div>}
                            />
                          </div>
                        );
                      }
                      return pages;
                    })()}
                  </Document>

                  {pdfError && (
                    <div className="p-4 bg-red-950/20 border-t border-red-800/30 flex items-center justify-between gap-4 w-full rounded-xl">
                      <p className="text-red-300 text-sm flex-1">{pdfError}</p>
                      <button
                        onClick={() => { setPdfError(''); setRetryCount(c => c + 1); }}
                        className="px-3 py-1 rounded-lg bg-violet-600/20 text-violet-300 text-xs hover:bg-violet-600/30 transition-colors border border-violet-500/30 flex-shrink-0"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-96 gap-4">
                <div className="w-16 h-16 rounded-2xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center">
                  <FileText className="w-8 h-8 text-violet-400" />
                </div>
                <p className="text-slate-400">No PDF source available</p>
              </div>
            )}
          </div>
        </main>

        {/* Sidebar: Bookmarks or AI */}
        {showBookmarks && (
          <BookmarkSidebar
            bookmarks={bookmarks}
            currentPage={currentPage}
            onJump={(p) => { setCurrentPage(p); setShowBookmarks(false); }}
            onClose={() => setShowBookmarks(false)}
          />
        )}

        {showAI && (
          <div className="w-96 h-full overflow-hidden animate-slide-in-right">
            <React.Suspense fallback={
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center mx-auto mb-3 animate-pulse">
                    <Zap className="w-5 h-5 text-violet-400" />
                  </div>
                  <p className="text-slate-500 text-sm">Loading AI Assistant…</p>
                </div>
              </div>
            }>
              <AIAssistant
                book={book}
                currentPage={currentPage}
                selectedText={selectedText}
                onClose={() => setShowAI(false)}
              />
            </React.Suspense>
          </div>
        )}
      </div>

      {/* Focus mode exit hint */}
      {focusMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="glass px-4 py-2 rounded-full text-xs text-slate-400 animate-fade-in">
            Focus mode — press <kbd className="bg-white/10 px-1.5 py-0.5 rounded font-mono">F</kbd> or <kbd className="bg-white/10 px-1.5 py-0.5 rounded font-mono">Esc</kbd> to exit
          </div>
        </div>
      )}

      {/* Bottom page controls (always visible) */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between px-6 py-3 transition-all duration-300 ${
          focusMode ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
        style={{
          background: currentTheme.id === 'white' || currentTheme.id === 'sepia'
            ? `${currentTheme.bg}dd` : 'rgba(8,8,16,0.9)',
          backdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <button onClick={() => handlePageChange(-10)} className="text-xs text-slate-500 hover:text-white px-3 py-1 rounded-lg hover:bg-white/5 transition-colors">
          ← -10
        </button>
        <div className="flex items-center gap-6">
          <button onClick={() => handlePageChange(-1)} disabled={currentPage <= 1}
            className="p-2 rounded-xl hover:bg-white/8 disabled:opacity-30 transition-colors" style={{ color: currentTheme.text }}>
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="text-center">
            <div className="text-xs text-slate-500 mb-0.5">
              {totalPages > 0 ? `${Math.round((currentPage / totalPages) * 100)}%` : ''}
            </div>
            <div className="text-sm font-bold" style={{ color: currentTheme.text }}>
              {currentPage} <span className="opacity-40 font-normal">of {totalPages || book?.pages || '?'}</span>
            </div>
          </div>

          <button onClick={() => handlePageChange(1)} disabled={totalPages > 0 && currentPage >= totalPages}
            className="p-2 rounded-xl hover:bg-white/8 disabled:opacity-30 transition-colors" style={{ color: currentTheme.text }}>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <button onClick={() => handlePageChange(10)} className="text-xs text-slate-500 hover:text-white px-3 py-1 rounded-lg hover:bg-white/5 transition-colors">
          +10 →
        </button>
      </div>
    </div>
  );
}
