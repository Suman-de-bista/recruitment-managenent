const selectClass =
  "rounded-md border border-hairline bg-surface px-3 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent";

export default function CandidateFilters({ filters, options, onChange }) {
  function update(field, value) {
    onChange({ ...filters, [field]: value, page: 1 });
  }

  return (
    <div className="mb-5 flex flex-wrap gap-2">
      <select value={filters.status} onChange={(e) => update("status", e.target.value)} className={selectClass}>
        <option value="">All statuses</option>
        {(options?.statuses || []).map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <select
        value={filters.role_applied}
        onChange={(e) => update("role_applied", e.target.value)}
        className={selectClass}
      >
        <option value="">All roles</option>
        {(options?.roles || []).map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <select value={filters.skill} onChange={(e) => update("skill", e.target.value)} className={selectClass}>
        <option value="">All skills</option>
        {(options?.skills || []).map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <input
        placeholder="Search name or email…"
        value={filters.keyword}
        onChange={(e) => update("keyword", e.target.value)}
        className={`${selectClass} flex-1 min-w-[180px]`}
      />
    </div>
  );
}
