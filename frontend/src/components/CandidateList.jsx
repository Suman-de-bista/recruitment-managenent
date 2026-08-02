import { Link } from "react-router-dom";
import Badge from "./Badge.jsx";

export default function CandidateList({ items, page, pageSize, total, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className="overflow-hidden rounded-lg border border-hairline bg-surface">
        {items.length === 0 && (
          <p className="p-8 text-center text-sm text-ink-faint">No candidates match these filters.</p>
        )}
        {items.map((c, i) => (
          <Link
            key={c.id}
            to={`/candidates/${c.id}`}
            className={`flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-accent-soft/40 ${
              i !== items.length - 1 ? "border-b border-hairline" : ""
            }`}
          >
            <div className="min-w-0">
              <p className="font-serif text-[15px] font-semibold text-ink">{c.name}</p>
              <p className="mt-0.5 truncate text-sm text-ink-muted">
                {c.role_applied} <span className="text-ink-faint">·</span>{" "}
                {c.skills.join(", ") || "no skills listed"}
              </p>
            </div>
            <Badge status={c.status} />
          </Link>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="tabular text-ink-faint">
          Page {page} of {totalPages} · {total} candidate{total === 1 ? "" : "s"}
        </span>
        <div className="flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="rounded-md border border-hairline px-3 py-1.5 text-ink-muted transition-colors hover:border-ink-faint hover:text-ink disabled:opacity-40 disabled:hover:border-hairline disabled:hover:text-ink-muted"
          >
            Previous
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="rounded-md border border-hairline px-3 py-1.5 text-ink-muted transition-colors hover:border-ink-faint hover:text-ink disabled:opacity-40 disabled:hover:border-hairline disabled:hover:text-ink-muted"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
