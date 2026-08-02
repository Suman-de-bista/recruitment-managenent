import { useNavigate } from "react-router-dom";
import { api, clearSession, getSession } from "../api/client";

export default function AppHeader() {
  const { isAuthed, user } = getSession();
  const navigate = useNavigate();
  if (!isAuthed) return null;

  return (
    <header className="border-b border-hairline bg-surface">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-lg font-semibold tracking-tight text-ink">TechKraft</span>
          <span className="text-xs uppercase tracking-[0.14em] text-ink-faint">Reviewer Ledger</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium capitalize text-accent">
              {user?.role}
            </span>
            <span className="text-ink-muted">{user?.email}</span>
          </div>
          <button
            onClick={async () => {
              try {
                await api.logout();
              } finally {
                clearSession();
                navigate("/login");
              }
            }}
            className="rounded-md border border-hairline px-3 py-1.5 text-sm text-ink-muted transition-colors hover:border-ink-faint hover:text-ink"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
