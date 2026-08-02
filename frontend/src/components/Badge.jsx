const STATUS_TOKENS = {
  new: { dot: "bg-status-new", text: "text-status-new", bg: "bg-status-new-soft" },
  reviewed: { dot: "bg-status-reviewed", text: "text-status-reviewed", bg: "bg-status-reviewed-soft" },
  hired: { dot: "bg-status-hired", text: "text-status-hired", bg: "bg-status-hired-soft" },
  rejected: { dot: "bg-status-rejected", text: "text-status-rejected", bg: "bg-status-rejected-soft" },
  archived: { dot: "bg-status-archived", text: "text-status-archived", bg: "bg-status-archived-soft" },
};

export default function Badge({ status }) {
  const tokens = STATUS_TOKENS[status] || STATUS_TOKENS.archived;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium capitalize ${tokens.bg} ${tokens.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${tokens.dot}`} aria-hidden="true" />
      {status}
    </span>
  );
}
