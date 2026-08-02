import { useState } from "react";

const labelClass = "mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-faint";
const inputClass =
  "w-full rounded-md border border-hairline bg-paper px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-accent";

export default function CandidateCreateForm({ options, onSubmit }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleApplied, setRoleApplied] = useState(options?.roles?.[0] || "");
  const [skills, setSkills] = useState([]);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleSkill(skill) {
    setSkills((prev) => (prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({ name, email, role_applied: roleApplied, skills });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>Name</label>
        <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>Role applied</label>
        <select value={roleApplied} onChange={(e) => setRoleApplied(e.target.value)} className={inputClass}>
          {(options?.roles || []).map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Skills</label>
        <div className="flex flex-wrap gap-1.5">
          {(options?.skills || []).map((skill) => {
            const active = skills.includes(skill);
            return (
              <button
                type="button"
                key={skill}
                onClick={() => toggleSkill(skill)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  active
                    ? "border-accent bg-accent text-accent-ink"
                    : "border-hairline text-ink-muted hover:border-ink-faint"
                }`}
              >
                {skill}
              </button>
            );
          })}
        </div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {submitting ? "Creating…" : "Create candidate"}
      </button>
    </form>
  );
}
