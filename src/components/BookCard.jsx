import React, { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Plus, Check, Loader2, ExternalLink, Star } from 'lucide-react';
import api from '../api/axios';

function formatAuthors(authors) {
  if (!Array.isArray(authors) || authors.length === 0) return '';
  return authors.length > 2 ? `${authors[0]}, ${authors[1]} +${authors.length - 2}` : authors.join(', ');
}

function safeText(v) { return typeof v === 'string' ? v : ''; }

function getBookKey(book) {
  return `${safeText(book?.source)}:${safeText(book?.id)}`;
}

function StarRating({ rating }) {
  const r = Math.round(Math.max(0, Math.min(5, rating || 0)));
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(s => (
        <Star key={s} className={`w-3 h-3 ${s <= r ? 'text-amber-400 fill-amber-400' : 'text-slate-700'}`} />
      ))}
    </div>
  );
}

function BookCard({ book, onAdd, isAdded = false, isAdding = false }) {
  const title       = safeText(book?.title) || 'Untitled';
  const authors     = formatAuthors(book?.authors);
  const description = safeText(book?.description);
  const thumbnail   = safeText(book?.thumbnail);
  const pageCount   = typeof book?.pageCount === 'number' && Number.isFinite(book.pageCount) ? book.pageCount : null;
  const publishedDate = safeText(book?.publishedDate);
  const source      = safeText(book?.source);
  const previewLink = typeof book?.previewLink === 'string' && book.previewLink.trim() ? book.previewLink : null;
  const canAdd      = !isAdded && !isAdding && typeof onAdd === 'function';
  const sourceLabel = source === 'open-library' ? 'Open Library' : source === 'google' ? 'Google Books' : '';
  const rating      = book?.averageRating || 0;

  const [isOpening, setIsOpening] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const handlePreviewClick = () => {
    if (!previewLink || isOpening) return;
    setIsOpening(true);
    api.post('/books/preview-click', { externalId: book?.id, source }).catch(() => {});
    window.open(previewLink, '_blank', 'noopener,noreferrer');
    setTimeout(() => setIsOpening(false), 500);
  };

  return (
    <motion.div
      layout
      className="book-card-explore h-full flex flex-col"
      whileHover={{ y: -4 }}
      transition={{ duration: 0.25 }}
    >
      {/* Cover */}
      <div className="relative overflow-hidden flex-shrink-0" style={{ aspectRatio: '2/3' }}>
        {thumbnail && !imgFailed ? (
          <img
            src={thumbnail}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-violet-900/40 to-slate-900/80 gap-2">
            <BookOpen className="w-10 h-10 text-violet-600/50" />
            <span className="text-xs text-slate-700">No cover</span>
          </div>
        )}

        {/* Gradient overlay at bottom */}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />

        {/* Source badge */}
        {sourceLabel && (
          <div className="absolute top-2 left-2">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold backdrop-blur-md border ${
              source === 'google'
                ? 'bg-blue-500/30 border-blue-500/40 text-blue-300'
                : 'bg-emerald-500/30 border-emerald-500/40 text-emerald-300'
            }`}>
              {sourceLabel}
            </span>
          </div>
        )}

        {/* Page count badge */}
        {pageCount !== null && (
          <div className="absolute bottom-2 right-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-black/60 border border-white/10 text-slate-400 backdrop-blur-sm">
              {pageCount} pp
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="relative z-10 p-4 flex flex-col flex-1 gap-2.5">
        <div>
          <h3 className="text-sm font-semibold text-white line-clamp-2 leading-snug">{title}</h3>
          {authors && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{authors}</p>}
        </div>

        {rating > 0 && <StarRating rating={rating} />}

        {description && (
          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{description}</p>
        )}

        {publishedDate && (
          <span className="text-[10px] text-slate-700">{publishedDate}</span>
        )}

        {/* Actions */}
        <div className="mt-auto pt-2 space-y-2">
          <button
            type="button"
            onClick={() => canAdd && onAdd(book, getBookKey(book))}
            disabled={!canAdd}
            className={`
              w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200
              ${isAdded
                ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 cursor-default'
                : isAdding
                  ? 'bg-violet-600/30 border border-violet-500/30 text-violet-300 cursor-wait'
                  : 'bg-violet-600 hover:bg-violet-500 text-white shadow-[0_0_12px_rgba(124,58,237,0.3)] hover:shadow-[0_0_20px_rgba(124,58,237,0.5)] active:scale-95'
              }
            `}
          >
            {isAdded  ? <><Check className="w-3.5 h-3.5" /> In Library</> :
             isAdding ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Adding…</> :
                        <><Plus className="w-3.5 h-3.5" /> Add to Library</>}
          </button>

          {previewLink && (source === 'google' || source === 'open-library') && (
            <button
              type="button"
              onClick={handlePreviewClick}
              disabled={isOpening}
              className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-300 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-all"
            >
              <ExternalLink className="w-3 h-3" />
              {source === 'google' ? 'Preview on Google' : 'View on Open Library'}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default memo(BookCard);
