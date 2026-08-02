import { useState } from "react";
import Badge from "./Badge.jsx";

const inputClass =
  "rounded-md border border-hairline bg-paper px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-accent";

function ScoreForm({ candidate, onSubmit }) {
  const [category, setCategory] = useState(candidate.skills[0] || "");
  const [score, setScore] = useState(3);
  const [note, setNote] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({ category, score: Number(score), note: note || null });
      setNote("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (candidate.skills.length === 0) {
    return <p className="text-sm text-ink-faint">This candidate has no listed skills to score against.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 border-t border-hairline pt-4">
      <div className="flex gap-3">
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={`flex-1 ${inputClass}`}>
          {candidate.skills.map((skill) => (
            <option key={skill} value={skill}>
              {skill}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          max={5}
          value={score}
          onChange={(e) => setScore(e.target.value)}
          className={`tabular w-20 text-center ${inputClass}`}
        />
      </div>
      <textarea
        placeholder="Note (optional)"
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className={`w-full resize-none ${inputClass}`}
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {submitting ? "Submitting…" : "Submit score"}
      </button>
    </form>
  );
}

function AiSummaryPanel({ summary, onGenerate }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      await onGenerate();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {loading && (
        <div className="flex items-center gap-2 text-sm text-ink-faint">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent-soft border-t-accent" />
          Generating summary… (simulated ~2s call)
        </div>
      )}
      {!loading && error && <p className="text-sm text-danger">Failed to generate summary: {error}</p>}
      {!loading && !error && summary && (
        <p className="font-serif text-[15px] leading-relaxed text-ink">{summary}</p>
      )}
      {!loading && !error && !summary && <p className="text-sm text-ink-faint">No summary generated yet.</p>}
      <button
        onClick={handleClick}
        disabled={loading}
        className="mt-4 rounded-md border border-hairline px-3 py-1.5 text-sm text-ink-muted transition-colors hover:border-ink-faint hover:text-ink disabled:opacity-60"
      >
        {summary ? "Regenerate" : "Generate AI summary"}
      </button>
    </div>
  );
}

function InternalNotesPanel({ notes, onSave }) {
  const [value, setValue] = useState(notes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await onSave(value);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <textarea
        rows={4}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={`w-full resize-none ${inputClass}`}
      />
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-3 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save notes"}
      </button>
    </div>
  );
}

function Section({ title, aside, tone, children }) {
  return (
    <section
      className={`rounded-lg border bg-surface p-6 ${tone === "warning" ? "border-status-reviewed-soft" : "border-hairline"}`}
    >
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="font-serif text-base font-semibold text-ink">{title}</h3>
        {aside && <span className="text-xs text-ink-faint">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

export default function CandidateDetail({
  candidate,
  currentUser,
  onSubmitScore,
  onGenerateSummary,
  onSaveNotes,
  onArchive,
}) {
  const isAdmin = currentUser?.role === "admin";
  const avgScore =
    candidate.scores.length > 0
      ? (candidate.scores.reduce((sum, s) => sum + s.score, 0) / candidate.scores.length).toFixed(1)
      : null;

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-hairline bg-surface p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-serif text-2xl font-semibold tracking-tight text-ink">{candidate.name}</h2>
            <p className="mt-0.5 text-sm text-ink-muted">{candidate.email}</p>
          </div>
          <Badge status={candidate.status} />
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-hairline pt-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-faint">Role applied</dt>
            <dd className="mt-1 text-sm text-ink">{candidate.role_applied}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-faint">Skills</dt>
            <dd className="mt-1 text-sm text-ink">{candidate.skills.join(", ") || "none listed"}</dd>
          </div>
          {avgScore && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-faint">Average score</dt>
              <dd className="tabular mt-1 font-serif text-lg font-semibold text-accent">{avgScore} / 5</dd>
            </div>
          )}
        </dl>
        {isAdmin && candidate.status !== "archived" && (
          <button
            onClick={onArchive}
            className="mt-5 rounded-md border border-status-rejected-soft px-3 py-1.5 text-sm text-status-rejected transition-colors hover:bg-status-rejected-soft"
          >
            Archive candidate
          </button>
        )}
      </section>

      <Section title="Scores" aside={!isAdmin ? "yours only" : `${candidate.scores.length} total`}>
        {candidate.scores.length === 0 && <p className="text-sm text-ink-faint">No scores submitted yet.</p>}
        <div className="mb-1 space-y-0">
          {candidate.scores.map((s, i) => (
            <div
              key={s.id}
              className={`flex items-center justify-between gap-4 py-2.5 ${
                i !== candidate.scores.length - 1 ? "border-b border-hairline" : ""
              }`}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{s.category}</p>
                {s.note && <p className="mt-0.5 text-sm text-ink-muted">{s.note}</p>}
              </div>
              <div className="flex items-center gap-3 text-right">
                {isAdmin && s.reviewer_email && (
                  <span className="text-xs text-ink-faint">{s.reviewer_email}</span>
                )}
                <span className="tabular font-serif text-base font-semibold text-ink">{s.score}/5</span>
              </div>
            </div>
          ))}
        </div>
        <ScoreForm candidate={candidate} onSubmit={onSubmitScore} />
      </Section>

      <Section title="AI Summary">
        <AiSummaryPanel summary={candidate.ai_summary} onGenerate={onGenerateSummary} />
      </Section>

      {isAdmin && (
        <Section title="Internal Notes" aside="admin only" tone="warning">
          <InternalNotesPanel notes={candidate.internal_notes} onSave={onSaveNotes} />
        </Section>
      )}
    </div>
  );
}
