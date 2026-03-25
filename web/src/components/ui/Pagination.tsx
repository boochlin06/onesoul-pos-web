interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-2 py-4 border-t border-slate-200 mt-4">
      <p className="text-sm font-medium text-slate-500">
        顯示第 <span className="text-slate-800">{currentPage}</span> 頁，共 <span className="text-slate-800">{totalPages}</span> 頁
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => {
            onPageChange(Math.max(1, currentPage - 1));
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          disabled={currentPage === 1}
          className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          上一頁
        </button>
        <button
          onClick={() => {
            onPageChange(Math.min(totalPages, currentPage + 1));
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          disabled={currentPage === totalPages}
          className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          下一頁
        </button>
      </div>
    </div>
  );
}
