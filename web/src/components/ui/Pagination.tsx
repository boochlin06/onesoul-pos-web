import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Optional: total number of items across all pages */
  totalItems?: number;
}

export function Pagination({ currentPage, totalPages, onPageChange, totalItems }: PaginationProps) {
  if (totalPages <= 1) return null;

  const go = (page: number) => {
    onPageChange(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Build visible page numbers with ellipsis
  const getPageNumbers = (): (number | '...')[] => {
    const pages: (number | '...')[] = [];
    const delta = 1; // how many pages to show around current

    // Always show first page
    pages.push(1);

    const rangeStart = Math.max(2, currentPage - delta);
    const rangeEnd = Math.min(totalPages - 1, currentPage + delta);

    if (rangeStart > 2) pages.push('...');
    for (let i = rangeStart; i <= rangeEnd; i++) pages.push(i);
    if (rangeEnd < totalPages - 1) pages.push('...');

    // Always show last page
    if (totalPages > 1) pages.push(totalPages);

    return pages;
  };

  const btnBase = 'inline-flex items-center justify-center transition-all font-semibold rounded-lg text-sm select-none';
  const btnPage = (active: boolean) =>
    `${btnBase} w-10 h-10 ${
      active
        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30 scale-105'
        : 'text-slate-600 bg-white border border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 active:scale-95'
    }`;
  const btnNav = (disabled: boolean) =>
    `${btnBase} w-10 h-10 bg-white border border-slate-200 ${
      disabled
        ? 'opacity-40 cursor-not-allowed'
        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 active:scale-95'
    }`;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2 py-5 border-t border-slate-200 mt-4">
      {/* Info */}
      <p className="text-sm text-slate-400 font-medium order-2 sm:order-1">
        第 <span className="text-slate-700 font-bold">{currentPage}</span> / <span className="text-slate-700 font-bold">{totalPages}</span> 頁
        {totalItems != null && (
          <span className="ml-2 text-slate-300">
            ・共 <span className="text-slate-500 font-bold">{totalItems.toLocaleString()}</span> 筆
          </span>
        )}
      </p>

      {/* Controls */}
      <div className="flex items-center gap-1.5 order-1 sm:order-2">
        {/* First */}
        <button onClick={() => go(1)} disabled={currentPage === 1} className={btnNav(currentPage === 1)} title="第一頁">
          <ChevronsLeft className="w-4 h-4" />
        </button>
        {/* Prev */}
        <button onClick={() => go(currentPage - 1)} disabled={currentPage === 1} className={btnNav(currentPage === 1)} title="上一頁">
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Page numbers */}
        {getPageNumbers().map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="w-10 h-10 flex items-center justify-center text-slate-300 font-bold select-none">⋯</span>
          ) : (
            <button
              key={p}
              onClick={() => go(p)}
              className={btnPage(p === currentPage)}
            >
              {p}
            </button>
          )
        )}

        {/* Next */}
        <button onClick={() => go(currentPage + 1)} disabled={currentPage === totalPages} className={btnNav(currentPage === totalPages)} title="下一頁">
          <ChevronRight className="w-4 h-4" />
        </button>
        {/* Last */}
        <button onClick={() => go(totalPages)} disabled={currentPage === totalPages} className={btnNav(currentPage === totalPages)} title="最後一頁">
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
