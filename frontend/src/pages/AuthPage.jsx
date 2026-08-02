import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, saveSession } from "../api/client";
import AuthForm from "../components/AuthForm.jsx";

export default function AuthPage() {
  const [mode, setMode] = useState("login");
  const navigate = useNavigate();

  async function handleSubmit(email, password) {
    if (mode === "register") {
      await api.register(email, password);
    }
    const { access_token, user } = await api.login(email, password);
    saveSession(access_token, user);
    navigate("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="font-serif text-2xl font-semibold tracking-tight text-ink">TechKraft</p>
          <p className="mt-1 text-xs uppercase tracking-[0.14em] text-ink-faint">Reviewer Ledger</p>
        </div>
        <div className="rounded-lg border border-hairline bg-surface p-6 shadow-sm">
          <h1 className="mb-4 font-serif text-lg font-semibold text-ink">
            {mode === "login" ? "Log in" : "Register as reviewer"}
          </h1>
          <AuthForm mode={mode} onSubmit={handleSubmit} />
          <p className="mt-5 text-sm text-ink-muted">
            {mode === "login" ? "New here?" : "Already have an account?"}{" "}
            <button
              onClick={() => setMode(mode === "login" ? "register" : "login")}
              className="font-medium text-accent hover:underline"
            >
              {mode === "login" ? "Register" : "Log in"}
            </button>
          </p>
        </div>
        <p className="mt-4 text-center text-xs text-ink-faint">
          Seeded accounts: admin@example.com / reviewer@example.com — see README for password.
        </p>
      </div>
    </div>
  );
}
