import React, { memo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, ShoppingCart, BookOpen, Crown, TrendingUp } from 'lucide-react';
import { useCart } from '../context/CartContext';

function StarRating({ rating, count }) {
  const stars = Math.round(rating || 0);
  return (
    <div className="flex items-center gap-1">
      <div className="flex">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star key={s} className={`w-3 h-3 ${s <= stars ? 'fill-amber-400 text-amber-400' : 'text-gray-200 dark:text-gray-700'}`} />
        ))}
      </div>
      <span className="text-xs text-gray-400">({count || 0})</span>
    </div>
  );
}

function MarketplaceBookCard({ book }) {
  const { addItem, items } = useCart() || {};
  const inCart = (items || []).some((i) => String(i._id) === String(book._id));
  const isFree = !book.price || book.price === 0;
  const cover = book.cover || book.coverImage;
  const genres = Array.isArray(book.genre) ? book.genre : [];
  const [imgFailed, setImgFailed] = useState(false);

  const handleAddToCart = (e) => {
    e.preventDefault();
    if (addItem && !inCart) addItem(book);
  };

  return (
    <Link to={`/marketplace/${book._id}`} className="group block">
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 h-full flex flex-col">
        {/* Cover */}
        <div className="relative h-52 bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-950 dark:to-indigo-950 flex-shrink-0 overflow-hidden">
          {cover && !imgFailed ? (
            <img src={cover} alt={book.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" onError={() => setImgFailed(true)} />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-violet-300 dark:text-violet-700">
              <BookOpen className="w-10 h-10" />
              <span className="text-xs">No cover</span>
            </div>
          )}

          {/* Badges */}
          <div className="absolute top-2.5 left-2.5 flex flex-col gap-1">
            {book.isFeatured && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/90 backdrop-blur text-white text-xs font-bold shadow">
                <Crown className="w-3 h-3" /> Featured
              </span>
            )}
            {book.isPremium && (
              <span className="px-2 py-0.5 rounded-full bg-violet-600/90 backdrop-blur text-white text-xs font-bold shadow">Premium</span>
            )}
            {book.salesCount > 20 && !book.isFeatured && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/90 backdrop-blur text-white text-xs font-bold shadow">
                <TrendingUp className="w-3 h-3" /> Trending
              </span>
            )}
          </div>

          {/* Price badge */}
          <div className="absolute top-2.5 right-2.5">
            <span className={`px-2.5 py-1 rounded-full text-sm font-bold shadow backdrop-blur ${isFree ? 'bg-emerald-500/90 text-white' : 'bg-gray-900/80 text-white'}`}>
              {isFree ? 'Free' : `₹${book.price}`}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col flex-1">
          <div className="flex-1">
            <h3 className="font-bold text-gray-900 dark:text-white text-sm line-clamp-2 leading-tight mb-1 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
              {book.title}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{book.author}</p>

            {/* Genres */}
            {genres.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {genres.slice(0, 2).map((g) => (
                  <span key={g} className="text-xs px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400">{g}</span>
                ))}
              </div>
            )}

            <StarRating rating={book.averageRating} count={book.reviewCount} />
          </div>

          {/* Action button */}
          <button
            onClick={handleAddToCart}
            className={`mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold transition-all ${
              isFree
                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white'
                : inCart
                  ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 cursor-default'
                  : 'bg-violet-600 hover:bg-violet-700 text-white active:scale-95'
            }`}
          >
            {isFree ? (
              <><BookOpen className="w-4 h-4" /> Read Free</>
            ) : inCart ? (
              '✓ In Cart'
            ) : (
              <><ShoppingCart className="w-4 h-4" /> Add to Cart</>
            )}
          </button>
        </div>
      </div>
    </Link>
  );
}

export default memo(MarketplaceBookCard);
