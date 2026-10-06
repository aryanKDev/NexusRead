import { memo } from 'react';

function Shimmer({ className = '' }) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-white/[0.04] ${className}`}
    >
      <div
        className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite]"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)',
        }}
      />
    </div>
  );
}

function BookSkeleton() {
  return (
    <div className="book-card-explore overflow-hidden">
      {/* Cover shimmer */}
      <Shimmer className="rounded-none" style={{ aspectRatio: '2/3' }}>
        <div style={{ aspectRatio: '2/3' }} />
      </Shimmer>

      {/* Content shimmer */}
      <div className="p-4 space-y-3">
        <Shimmer className="h-4 w-4/5" />
        <Shimmer className="h-3 w-1/2" />
        <div className="flex gap-0.5 pt-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <Shimmer key={i} className="h-3 w-3 rounded-full" />
          ))}
        </div>
        <Shimmer className="h-3 w-full" />
        <Shimmer className="h-3 w-3/4" />
        <Shimmer className="h-9 w-full rounded-xl mt-2" />
      </div>
    </div>
  );
}

/** Grid of skeleton cards for loading states */
export function BookSkeletonGrid({ count = 8 }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <BookSkeleton key={i} />
      ))}
    </>
  );
}

export default memo(BookSkeleton);
