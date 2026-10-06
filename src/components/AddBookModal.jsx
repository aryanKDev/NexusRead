import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Search, Plus } from 'lucide-react';
import { gsap } from 'gsap';

const AddBookModal = ({ isOpen, onClose, onAddBook }) => {
  const modalRef = useRef(null);
  const contentRef = useRef(null);
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    pages: '',
    genre: [],
    cover: '',
    status: 'wishlist',
    rating: 0,
    startDate: '',
    endDate: '',
    currentPage: 0
  });
  const [newGenre, setNewGenre] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const popularGenres = [
    'Fiction', 'Non-Fiction', 'Mystery', 'Romance', 'Sci-Fi', 'Fantasy',
    'Biography', 'History', 'Self-Help', 'Psychology', 'Philosophy', 'Poetry'
  ];

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
      onComplete: () => {
        onClose();
        setFormData({
          title: '',
          author: '',
          pages: '',
          genre: [],
          cover: '',
          status: 'wishlist',
          rating: 0,
          startDate: '',
          endDate: '',
          currentPage: 0
        });
        setSearchResults([]);
      }
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleGenreAdd = (genre) => {
    if (!formData.genre.includes(genre)) {
      setFormData(prev => ({
        ...prev,
        genre: [...prev.genre, genre]
      }));
    }
  };

  const handleGenreRemove = (genreToRemove) => {
    setFormData(prev => ({
      ...prev,
      genre: prev.genre.filter(g => g !== genreToRemove)
    }));
  };

  const handleNewGenreAdd = () => {
    if (newGenre.trim() && !formData.genre.includes(newGenre.trim())) {
      handleGenreAdd(newGenre.trim());
      setNewGenre('');
    }
  };

  const handleRatingClick = (rating) => {
    setFormData(prev => ({
      ...prev,
      rating: rating
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.title && formData.author) {
      const newBook = {
        ...formData,
        pages: parseInt(formData.pages) || 0,
        currentPage: parseInt(formData.currentPage) || 0,
        reactions: {},
        highlights: [],
        review: ''
      };
      try {
        await onAddBook(newBook);
        handleClose();
      } catch (err) {
        console.error('Failed to add book:', err);
        // Keep modal open on error so user can retry
      }
    }
  };

  const [searchError, setSearchError] = useState('');
  const searchDebounceRef = useRef(null);

  const searchBooks = (query) => {
    clearTimeout(searchDebounceRef.current);
    setSearchError('');

    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const { default: api } = await import('../api/axios');
        const res = await api.get('/books/search', { params: { q: query.trim() } });
        const raw = res.data?.data;
        const results = Array.isArray(raw) ? raw : [];
        setSearchResults(results.map(b => ({
          title: b.title || 'Untitled',
          author: Array.isArray(b.authors) && b.authors.length > 0
            ? b.authors.join(', ')
            : (b.author || ''),
          pages: b.pageCount || 0,
          genre: [],
          cover: b.thumbnail || '',
          externalId: b.id || '',
          source: b.source || '',
          description: b.description || '',
        })));
        setSearchError('');
      } catch (err) {
        setSearchResults([]);
        setSearchError('Search failed. Please try again.');
      } finally {
        setIsSearching(false);
      }
    }, 400);
  };

  const selectSearchResult = (book) => {
    setFormData(prev => ({
      ...prev,
      title: book.title,
      author: book.author,
      pages: book.pages.toString(),
      genre: book.genre,
      cover: book.cover
    }));
    setSearchResults([]);
  };

  if (!isOpen) return null;

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      <div
        ref={contentRef}
        className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Add New Book</h2>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors duration-200"
            >
              <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Search Section */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Search for a book
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by title or author..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onChange={(e) => searchBooks(e.target.value)}
                />
              </div>

              {isSearching && (
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Searching…</p>
              )}

              {searchError && !isSearching && (
                <p className="mt-2 text-sm text-red-500">{searchError}</p>
              )}

              {!isSearching && !searchError && searchResults.length > 0 && (
                <div className="mt-2 bg-gray-50 dark:bg-gray-700 rounded-lg p-3 space-y-2 max-h-56 overflow-y-auto">
                  {searchResults.map((book, index) => (
                    <div
                      key={index}
                      onClick={() => selectSearchResult(book)}
                      className="flex items-center space-x-3 p-2 hover:bg-white dark:hover:bg-gray-600 rounded-lg cursor-pointer transition-colors duration-200"
                    >
                      {book.cover ? (
                        <img src={book.cover} alt={book.title} className="w-10 h-12 object-cover rounded flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-12 rounded bg-gray-200 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
                          <Search className="h-4 w-4 text-gray-400" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">{book.title}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                          {book.author ? `by ${book.author}` : ''}
                          {book.pages ? ` · ${book.pages}pp` : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Or add manually:</p>
            </div>

            {/* Manual Entry */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Author *
                </label>
                <input
                  type="text"
                  name="author"
                  value={formData.author}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Pages
                </label>
                <input
                  type="number"
                  name="pages"
                  value={formData.pages}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Status
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="wishlist">Wishlist</option>
                  <option value="reading">Currently Reading</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>

            {/* Cover URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Cover Image URL
              </label>
              <input
                type="url"
                name="cover"
                value={formData.cover}
                onChange={handleInputChange}
                placeholder="https://example.com/book-cover.jpg"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Genres */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Genres
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {formData.genre.map((genre, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 text-sm rounded-full"
                  >
                    {genre}
                    <button
                      type="button"
                      onClick={() => handleGenreRemove(genre)}
                      className="ml-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              
              <div className="flex flex-wrap gap-2 mb-3">
                {popularGenres.filter(g => !formData.genre.includes(g)).map((genre) => (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => handleGenreAdd(genre)}
                    className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-full hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
                  >
                    {genre}
                  </button>
                ))}
              </div>

              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newGenre}
                  onChange={(e) => setNewGenre(e.target.value)}
                  placeholder="Add custom genre..."
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleNewGenreAdd())}
                />
                <button
                  type="button"
                  onClick={handleNewGenreAdd}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Rating */}
            {formData.status === 'completed' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Rating
                </label>
                <div className="flex space-x-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => handleRatingClick(star)}
                      className={`text-2xl transition-colors duration-200 ${
                        star <= formData.rating ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(formData.status === 'reading' || formData.status === 'completed') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}

              {formData.status === 'completed' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    name="endDate"
                    value={formData.endDate}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}
            </div>

            {/* Current Page */}
            {formData.status === 'reading' && formData.pages && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Current Page
                </label>
                <input
                  type="number"
                  name="currentPage"
                  value={formData.currentPage}
                  onChange={handleInputChange}
                  max={formData.pages}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {formData.pages && formData.currentPage && (
                  <div className="mt-2">
                    <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min((formData.currentPage / formData.pages) * 100, 100)}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {Math.round((formData.currentPage / formData.pages) * 100)}% complete
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={handleClose}
                className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!formData.title || !formData.author}
              >
                Add Book
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddBookModal;