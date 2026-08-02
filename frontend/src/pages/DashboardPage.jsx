import { useEffect, useState } from "react";
import { api, getSession } from "../api/client";
import CandidateFilters from "../components/CandidateFilters.jsx";
import CandidateList from "../components/CandidateList.jsx";
import CandidateCreateForm from "../components/CandidateCreateForm.jsx";
import Modal from "../components/Modal.jsx";

const PAGE_SIZE = 20;

export default function DashboardPage() {
  const { user } = getSession();
  const isAdmin = user?.role === "admin";

  const [filters, setFilters] = useState({ status: "", role_applied: "", skill: "", keyword: "", page: 1 });
  const [data, setData] = useState({ items: [], total: 0 });
  const [options, setOptions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    api.getCandidateOptions().then(setOptions).catch(() => {});
  }, []);

  function refresh() {
    setLoading(true);
    setError(null);
    return api
      .listCandidates({ ...filters, page_size: PAGE_SIZE })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .listCandidates({ ...filters, page_size: PAGE_SIZE })
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filters]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-ink">Candidates</h1>
          <p className="mt-1 text-sm text-ink-muted">Review, score, and track applicants under consideration.</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90"
          >
            + Add candidate
          </button>
        )}
      </div>

      <CandidateFilters filters={filters} options={options} onChange={setFilters} />

      {loading && <p className="text-sm text-ink-faint">Loading candidates…</p>}
      {error && <p className="text-sm text-danger">{error}</p>}

      {!loading && !error && (
        <CandidateList
          items={data.items}
          page={filters.page}
          pageSize={PAGE_SIZE}
          total={data.total}
          onPageChange={(page) => setFilters({ ...filters, page })}
        />
      )}

      {showCreateModal && (
        <Modal title="Add candidate" onClose={() => setShowCreateModal(false)}>
          <CandidateCreateForm
            options={options}
            onSubmit={async (payload) => {
              await api.createCandidate(payload);
              setShowCreateModal(false);
              await refresh();
            }}
          />
        </Modal>
      )}
    </div>
  );
}
