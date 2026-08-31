import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ page, total, limit, onPageChange }) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;

  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) pages.push(i);
    else if (i === page - 2 || i === page + 2) pages.push('...');
  }
  // Deduplicate ...
  const unique = pages.filter((p, i) => p !== '...' || pages[i - 1] !== '...');

  return (
    <div className="flex items-center justify-between pt-4">
      <p className="text-sm text-gray-500">
        Showing {Math.min((page - 1) * limit + 1, total)}–{Math.min(page * limit, total)} of {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="btn-icon disabled:opacity-30"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {unique.map((p, i) =>
          p === '...' ? (
            <span key={i} className="px-2 text-gray-500 text-sm">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                p === page
                  ? 'bg-gradient-brand text-white shadow-brand'
                  : 'text-gray-400 hover:bg-surface-elevated hover:text-white'
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="btn-icon disabled:opacity-30"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
