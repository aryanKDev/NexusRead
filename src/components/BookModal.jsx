import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Star,
  Clock,
  BookOpen,
  Heart,
  MessageCircle,
  Share2,
  ChevronLeft,
  ChevronRight,
  Quote,
  Edit,
  Plus,
  Trash2,
} from 'lucide-react';
import { gsap } from 'gsap';
import api from '../api/axios';

const BookModal = ({ book, bookId: bookIdProp, isOpen, onClose, onReactionClick, onEdit }) => {
  const modalRef = useRef(null);
  const contentRef = useRef(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedEmoji, setSelectedEmoji] = useState('');
  const [newNote, setNewNote] = useState('');
  const [notes, setNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [noteError, setNoteError] = useState('');

  // Resolve bookId — prop takes priority, fall back to book._id / book.id
  const bookId = bookIdProp || book?._id || book?.id;

  const reviewSteps =
    book?.review && typeof book.review === 'string'
      ? book.review
          .split('. ')
          .map((step) => step.trim())
          .filter((step) => step.length > 10)
      : [];
  const availableEmojis = ['❤️', '😭', '🤔', '💪', '🎯', '✨', '📚', '🌟', '🔥', '👏', '😍', '🤯', '💡', '🙌'];

  // Load existing notes when modal opens or bookId changes.
  // CRITICAL: clear notes state immediately before each fetch so that
  // Book A's notes are never visible while Book B's notes are loading.
  useEffect(() => {
    // Always reset when bookId changes (prevents stale-note cross-book leakage).
    setNotes([]);
    setNoteError('');

    if (!isOpen || !bookId) return;

    // Guard against `/notes/undefined` calls — bookId must be a non-empty string.
    if (typeof bookId !== 'string' || !bookId.trim()) return;

    setNotesLoading(true);
    api.get(`/reader/notes/${bookId}`)
      .then(({ data }) => setNotes(Array.isArray(data?.data) ? data.data : []))
      .catch(() => setNoteError('Could not load notes.'))
      .finally(() => setNotesLoading(false));
  }, [isOpen, bookId]);

  useEffect(() => {
    if (isOpen && modalRef.current && contentRef.current) {
      gsap.fromTo(modalRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.3 }
      );
      
      gsap.fromTo(contentRef.current,
        { scale: 0.8, y: 50, opacity: 0 },
        { scale: 1, y: 0, opacity: 1, duration: 0.4, ease: "back.out(1.7)" }
      );
    }
  }, [isOpen]);

  const handleClose = () => {
    gsap.to(contentRef.current, {
      scale: 0.8,
      y: 50,
      opacity: 0,
      duration: 0.3,
      ease: "power2.in"
    });
    
    gsap.to(modalRef.current, {
      opacity: 0,
      duration: 0.3,
      delay: 0.1,
      onComplete: onClose
    });
  };

  const handleReaction = (emoji) => {
    if (!book || !book.id || typeof onReactionClick !== 'function') return;
    setSelectedEmoji(emoji);
    onReactionClick(book.id, emoji);
    
    // Add a little animation feedback
    gsap.to(`.emoji-${emoji.replace(/[^\w]/g, '')}`, {
      scale: 1.3,
      duration: 0.2,
      yoyo: true,
      repeat: 1,
      ease: "power2.out"
    });
  };

  const handleEdit = () => {
    if (typeof onEdit === 'function' && book) {
      onEdit(book);
    }
    handleClose();
  };

  const addQuickNote = async () => {
    const content = newNote.trim();
    if (!content || !bookId) return;
    setNoteError('');
    try {
      const { data } = await api.post(`/reader/notes/${bookId}`, { content });
      const created = data?.data;
      if (created) {
        setNotes(prev => [created, ...prev]);
      }
      setNewNote('');
    } catch {
      setNoteError('Failed to save note. Please try again.');
    }
  };

  const deleteNote = async (noteId) => {
    if (!bookId || !noteId) return;
    try {
      await api.delete(`/reader/notes/${bookId}/${noteId}`);
      setNotes(prev => prev.filter(n => (n._id || n.id) !== noteId));
    } catch {
      setNoteError('Failed to delete note.');
    }
  };

  if (!isOpen || !book) return null;

  const title = typeof book.title === 'string' ? book.title : 'Untitled';
  const author = typeof book.author === 'string' ? book.author : '';
  const pages = Number.isFinite(book.pages) ? book.pages : book.pages || null;
  const genreList = Array.isArray(book.genre ?? book.categories)
    ? (book.genre ?? book.categories)
    : [];
  const highlights = Array.isArray(book.highlights) ? book.highlights : [];
  const reactions = book.reactions || {};

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      <div
        ref={contentRef}
        className="bg-white dark:bg-gray-800 rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          <div className="absolute top-4 right-4 z-10 flex items-center space-x-2">
            <button
              onClick={handleEdit}
              className="p-2 bg-white/90 dark:bg-gray-800/90 rounded-full hover:bg-white dark:hover:bg-gray-800 transition-colors duration-200"
            >
              <Edit className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
            <button
              onClick={handleClose}
              className="p-2 bg-white/90 dark:bg-gray-800/90 rounded-full hover:bg-white dark:hover:bg-gray-800 transition-colors duration-200"
            >
              <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
            <div className="relative">
              <img
                src={book.thumbnail || book.cover}
                alt={title}
                className="w-full h-64 md:h-96 object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              
              {/* Reading Progress Overlay */}
              {book.status === 'reading' && book.currentPage && pages && (
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white text-sm font-medium">Reading Progress</span>
                      <span className="text-white text-sm">
                        {Math.round((book.currentPage / pages) * 100)}%
                      </span>
                    </div>
                    <div className="bg-white/20 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${(book.currentPage / pages) * 100}%` }}
                      ></div>
                    </div>
                    <p className="text-white text-xs mt-1">
                      Page {book.currentPage} of {pages}
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-6 overflow-y-auto max-h-96">
              <div className="mb-4">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  {title}
                </h2>
                {author && (
                  <p className="text-gray-600 dark:text-gray-400 mb-2">by {author}</p>
                )}
                
                <div className="flex items-center space-x-4 mb-4">
                  {book.rating && (
                    <div className="flex items-center space-x-1">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star 
                            key={star}
                            className={`h-4 w-4 ${star <= book.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`}
                          />
                        ))}
                      </div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        {book.rating}
                      </span>
                    </div>
                  )}
                  {pages && (
                    <div className="flex items-center space-x-1 text-gray-600 dark:text-gray-400">
                      <BookOpen className="h-4 w-4" />
                      <span>{pages} pages</span>
                    </div>
                  )}
                  {book.startDate && (
                    <div className="flex items-center space-x-1 text-gray-600 dark:text-gray-400">
                      <Clock className="h-4 w-4" />
                      <span>{new Date(book.startDate).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  {genreList.map((genre, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 text-sm rounded-full"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              </div>

              {/* Quick Note Section — persisted via /reader/notes/:bookId */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Quick Notes
                </h3>
                <div className="flex space-x-2 mb-2">
                  <input
                    type="text"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder={bookId ? 'Add a quick thought or note...' : 'Open a book to add notes'}
                    disabled={!bookId}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                    onKeyPress={(e) => e.key === 'Enter' && addQuickNote()}
                  />
                  <button
                    onClick={addQuickNote}
                    disabled={!newNote.trim() || !bookId}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                {noteError && (
                  <p className="text-xs text-red-500 mb-2">{noteError}</p>
                )}
                {notesLoading && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">Loading notes…</p>
                )}
                {!notesLoading && notes.length > 0 && (
                  <div className="space-y-2 max-h-36 overflow-y-auto">
                    {notes.map((note) => {
                      const nid = note._id || note.id;
                      return (
                        <div key={nid} className="flex items-start gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2">
                          <p className="flex-1 text-sm text-gray-800 dark:text-gray-200 leading-snug">{note.content}</p>
                          <button
                            onClick={() => deleteNote(nid)}
                            className="flex-shrink-0 p-0.5 text-gray-400 hover:text-red-500 transition-colors"
                            title="Delete note"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {highlights.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                    <Quote className="h-5 w-5 mr-2" />
                    Highlights ({highlights.length})
                  </h3>
                  <div className="space-y-3 max-h-40 overflow-y-auto">
                    {highlights.map((highlight, index) => (
                      <div key={index} className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-3 rounded-r-lg">
                        <p className="text-gray-800 dark:text-gray-200 italic mb-1">
                          "{highlight.text}"
                        </p>
                        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                          <span>Page {highlight.page}</span>
                          <span>{new Date(highlight.timestamp).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {reviewSteps.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Step-by-Step Review
                    </h3>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                        disabled={currentStep === 0}
                        className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {currentStep + 1} / {reviewSteps.length}
                      </span>
                      <button
                        onClick={() => setCurrentStep(Math.min(reviewSteps.length - 1, currentStep + 1))}
                        disabled={currentStep === reviewSteps.length - 1}
                        className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <p className="text-gray-800 dark:text-gray-200 leading-relaxed">
                      {reviewSteps[currentStep]}.
                    </p>
                  </div>
                  
                  <div className="flex justify-center mt-3">
                    <div className="flex space-x-1">
                      {reviewSteps.map((_, index) => (
                        <button
                          key={index}
                          onClick={() => setCurrentStep(index)}
                          className={`w-2 h-2 rounded-full transition-all duration-200 ${
                            index === currentStep ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  React to this book
                </h3>
                <div className="flex flex-wrap gap-2">
                    {availableEmojis.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleReaction(emoji)}
                        className={`emoji-${emoji.replace(/[^\w]/g, '')} p-2 rounded-full border-2 transition-all duration-200 hover:scale-110 ${
                        reactions && reactions[emoji]
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                      }`}
                    >
                      <span className="text-lg">{emoji}</span>
                    </button>
                  ))}
                </div>
              </div>

              {reactions && Object.keys(reactions).length > 0 && (
                <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center space-x-3 flex-wrap">
                    {Object.entries(reactions).map(([emoji, count]) => (
                      <div key={emoji} className="flex items-center space-x-1 bg-gray-50 dark:bg-gray-700 rounded-full px-2 py-1">
                        <span className="text-lg">{emoji}</span>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          {count}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors duration-200">
                      <Heart className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                    </button>
                    <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors duration-200">
                      <MessageCircle className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                    </button>
                    <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors duration-200">
                      <Share2 className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookModal;