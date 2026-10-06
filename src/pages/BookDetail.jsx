import React, { useState, useEffect, useContext } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, ShoppingCart, BookOpen, ArrowLeft, Users, Clock, Award, Sparkles } from 'lucide-react';
import api from '../api/axios';
import { useCart } from '../context/CartContext';
import { ToastContext } from '../context/ToastContext';
import { AuthContext } from '../context/AuthContext';

function StarRating({ rating, interactive = false, onRate }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          onClick={() => interactive && onRate && onRate(s)}
          onMouseEnter={() => interactive && setHover(s)}
          onMouseLeave={() => interactive && setHover(0)}
          className={`w-5 h-5 transition-colors ${
            interactive ? 'cursor-pointer' : ''
          } ${s <= (interactive ? hover || rating : Math.round(rating))
            ? 'text-amber-400 fill-amber-400'
            : 'text-gray-300 dark:text-gray-600'
          }`}
        />
      ))}
    </div>
  );
}

function ReviewCard({ review }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
          {(review.user?.name || 'A')[0].toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{review.user?.name || 'Anonymous'}</p>
          <StarRating rating={review.rating} />
        </div>
        <span className="ml-auto text-xs text-gray-400">{new Date(review.createdAt).toLocaleDateString()}</span>
      </div>
      {review.title && <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">{review.title}</p>}
      {review.body && <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{review.body}</p>}
    </div>
  );
}

export default function BookDetail() {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const { addItem, items } = useCart();
  const { showToast } = useContext(ToastContext) || {};
  const { user } = useContext(AuthContext);

  const [book, setBook] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [isPurchased, setIsPurchased] = useState(false);
  const [loading, setLoading] = useState(true);

  const [myRating, setMyRating] = useState(0);
  const [myTitle, setMyTitle] = useState('');
  const [myBody, setMyBody] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewMsg, setReviewMsg] = useState('');
  const [imgFailed, setImgFailed] = useState(false);

  const isInCart = items.some((i) => String(i._id) === String(bookId));

  useEffect(() => {
    setLoading(true);
    api.get(`/marketplace/${bookId}`)
      .then(({ data }) => {
        setBook(data?.data?.book || null);
        setReviews(data?.data?.reviews || []);
        setIsPurchased(data?.data?.isPurchased || false);
      })
      .catch(() => setBook(null))
      .finally(() => setLoading(false));

    if (user) {
      api.get(`/reviews/my/${bookId}`).then(({ data }) => {
        const r = data?.data?.review;
        if (r) { setMyRating(r.rating); setMyTitle(r.title || ''); setMyBody(r.body || ''); }
      }).catch(() => {});
    }
  }, [bookId, user]);

  const handleAddToCart = () => {
    addItem(book);
    showToast?.(`"${book.title}" added to cart!`);
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!myRating) return setReviewMsg('Please select a rating.');
    setSubmittingReview(true);
    try {
      await api.post(`/reviews/${bookId}`, { rating: myRating, title: myTitle, body: myBody });
      setReviewMsg('Review submitted!');
      const { data } = await api.get(`/marketplace/${bookId}`);
      setReviews(data?.data?.reviews || []);
      setBook(data?.data?.book || book);
    } catch (err) {
      setReviewMsg(err?.response?.data?.message || 'Failed to submit review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="animate-spin w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!book) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 dark:bg-gray-950">
        <p className="text-gray-500 dark:text-gray-400">Book not found.</p>
        <button onClick={() => navigate('/marketplace')} className="text-violet-600 hover:underline font-medium">← Back to Marketplace</button>
      </div>
    );
  }

  const cover = book.cover || book.coverImage || book.thumbnail;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Back nav */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <button onClick={() => navigate('/marketplace')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors font-medium mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Marketplace
        </button>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Left – Cover + buy panel */}
          <div className="lg:col-span-1">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="sticky top-24 space-y-4">
              <div className="aspect-[2/3] rounded-2xl overflow-hidden bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-950 dark:to-indigo-950 shadow-2xl">
                {cover && !imgFailed ? (
                  <img src={cover} alt={book.title} className="w-full h-full object-cover" onError={() => setImgFailed(true)} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <BookOpen className="w-16 h-16 text-violet-300 dark:text-violet-700" />
                  </div>
                )}
              </div>

              {/* Purchase panel */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-violet-600 dark:text-violet-400">
                    {book.price ? `₹${book.price.toFixed(2)}` : 'Free'}
                  </span>
                  {book.isFeatured && (
                    <span className="flex items-center gap-1 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-xs font-bold px-2 py-1 rounded-full">
                      <Sparkles className="w-3 h-3" /> Featured
                    </span>
                  )}
                </div>

                {isPurchased ? (
                  <div className="space-y-2">
                    <div className="w-full py-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-xl text-center font-semibold text-sm">
                      ✓ Purchased – In Your Library
                    </div>
                    <Link to="/dashboard" className="block w-full py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-center text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      Go to Library →
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={handleAddToCart}
                      disabled={isInCart}
                      className={`w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                        isInCart
                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                          : 'bg-violet-600 hover:bg-violet-700 text-white active:scale-[0.98]'
                      }`}
                    >
                      <ShoppingCart className="w-4 h-4" />
                      {isInCart ? 'Added to Cart' : 'Add to Cart'}
                    </button>
                    {isInCart && (
                      <Link to="/cart" className="block w-full py-3 border border-violet-300 dark:border-violet-700 rounded-xl text-center text-sm font-medium text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors">
                        View Cart & Checkout →
                      </Link>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> {book.pages || 0} pages</div>
                  <div className="flex items-center gap-1.5"><Award className="w-3.5 h-3.5" /> {book.language || 'English'}</div>
                  {book.salesCount > 0 && <div className="flex items-center gap-1.5 col-span-2"><Users className="w-3.5 h-3.5" /> {book.salesCount} readers</div>}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right – Book info + reviews */}
          <div className="lg:col-span-2 space-y-8">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <div className="flex flex-wrap gap-2 mb-3">
                {(book.genre || []).map((g) => (
                  <span key={g} className="text-xs bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 px-3 py-1 rounded-full border border-violet-100 dark:border-violet-800">{g}</span>
                ))}
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">{book.title}</h1>
              <p className="text-lg text-gray-500 dark:text-gray-400 mb-4">by {book.author}</p>

              {book.averageRating > 0 && (
                <div className="flex items-center gap-3 mb-6">
                  <StarRating rating={book.averageRating} />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {book.averageRating.toFixed(1)} ({book.reviewCount} review{book.reviewCount !== 1 ? 's' : ''})
                  </span>
                </div>
              )}

              {book.description && (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">About this book</h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{book.description}</p>
                </div>
              )}
            </motion.div>

            {/* Reviews section */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Reviews {reviews.length > 0 && <span className="text-gray-400 font-normal text-base">({reviews.length})</span>}
              </h3>

              {/* Write review */}
              {user && (isPurchased || !book.price) && (
                <form onSubmit={handleSubmitReview} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 mb-6 space-y-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white text-sm">Write a review</h4>
                  <StarRating rating={myRating} interactive onRate={setMyRating} />
                  <input value={myTitle} onChange={(e) => setMyTitle(e.target.value)} placeholder="Review title (optional)"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500" />
                  <textarea value={myBody} onChange={(e) => setMyBody(e.target.value)} placeholder="Share your thoughts…" rows={3}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
                  {reviewMsg && <p className={`text-xs font-medium ${reviewMsg.includes('!') ? 'text-emerald-600' : 'text-red-500'}`}>{reviewMsg}</p>}
                  <button type="submit" disabled={submittingReview}
                    className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold disabled:opacity-60 transition-colors">
                    {submittingReview ? 'Submitting…' : 'Submit Review'}
                  </button>
                </form>
              )}

              <div className="space-y-3">
                {reviews.length > 0
                  ? reviews.map((r) => <ReviewCard key={r._id} review={r} />)
                  : <p className="text-sm text-gray-500 dark:text-gray-400">No reviews yet. Be the first!</p>}
              </div>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}
