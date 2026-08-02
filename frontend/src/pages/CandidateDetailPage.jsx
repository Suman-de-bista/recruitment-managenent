import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { API_BASE_URL, api, getSession } from "../api/client";
import CandidateDetail from "../components/CandidateDetail.jsx";

export default function CandidateDetailPage() {
  const { id } = useParams();
  const { user } = getSession();
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    return api
      .getCandidate(id)
      .then(setCandidate)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // SSE stretch goal: live score updates. The httpOnly auth cookie rides
  // along automatically because withCredentials is set — no token needs to
  // be exposed in the URL. Any score_updated event just re-fetches the
  // candidate, keeping this simple and consistent with every other mutation
  // in the app (no separate client-side merge logic to get wrong).
  useEffect(() => {
    const source = new EventSource(`${API_BASE_URL}/candidates/${id}/stream`, {
      withCredentials: true,
    });
    source.addEventListener("score_updated", () => {
      load();
    });
    return () => {
      source.close();
    };
  }, [id, load]);

  if (loading) {
    return <div className="mx-auto max-w-4xl px-4 py-8 text-sm text-ink-faint sm:px-6">Loading candidate…</div>;
  }
  if (error) {
    return <div className="mx-auto max-w-4xl px-4 py-8 text-sm text-danger sm:px-6">{error}</div>;
  }
  if (!candidate) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link
        to="/"
        className="mb-5 inline-flex items-center gap-1 text-sm text-ink-muted transition-colors hover:text-ink"
      >
        ← Back to candidates
      </Link>
      <CandidateDetail
        candidate={candidate}
        currentUser={user}
        onSubmitScore={async (payload) => {
          await api.submitScore(id, payload);
          await load();
        }}
        onGenerateSummary={async () => {
          await api.generateSummary(id);
          await load();
        }}
        onSaveNotes={async (notes) => {
          await api.updateCandidate(id, { internal_notes: notes });
          await load();
        }}
        onSaveStatus={async (status) => {
          await api.updateCandidate(id, { status });
          await load();
        }}
        onArchive={async () => {
          await api.archiveCandidate(id);
          navigate("/");
        }}
      />
    </div>
  );
}
