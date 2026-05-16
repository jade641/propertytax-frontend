interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "...")[] = [];

  const addRange = (start: number, end: number) => {
    for (let i = start; i <= end; i++) pages.push(i);
  };

  pages.push(1);

  if (current <= 4) {
    addRange(2, 5);
    pages.push("...");
    pages.push(total);
  } else if (current >= total - 3) {
    pages.push("...");
    addRange(total - 4, total);
  } else {
    pages.push("...");
    addRange(current - 1, current + 1);
    pages.push("...");
    pages.push(total);
  }

  return pages;
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = getPageNumbers(currentPage, totalPages);

  const btnBase = "px-3 py-1.5 rounded-lg text-xs border border-slate-200 hover:bg-white disabled:opacity-40 transition-colors";
  const btnActive = "text-white border-transparent";

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className={btnBase}
      >
        Prev
      </button>

      {pages.map((p, idx) =>
        p === "..." ? (
          <span key={`ellipsis-${idx}`} className="px-2 py-1.5 text-xs text-slate-400 select-none">
            ...
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p as number)}
            className={`${btnBase} ${p === currentPage ? btnActive : ""}`}
            style={p === currentPage ? { backgroundColor: "#0d2137" } : {}}
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        className={btnBase}
      >
        Next
      </button>
    </div>
  );
}
