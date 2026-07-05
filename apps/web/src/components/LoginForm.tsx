import { useState } from "react";

const API_URL = import.meta.env.PUBLIC_API_URL;

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit: React.SubmitEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    setLoading(false);

    if (!res.ok) {
      setError("Invalid email or password");
      return;
    }

    window.location.href = "/dashboard";
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <label className="mb-1 block text-xs text-text-secondary">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded-md border border-border px-2.5 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-text-secondary">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full rounded-md border border-border px-2.5 py-2 text-sm"
        />
      </div>

      {error && <p className="text-xs text-text-danger">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="mt-2 rounded-md bg-text-primary py-2 text-sm text-white disabled:opacity-50"
      >
        {loading ? "Logging in…" : "Log in"}
      </button>

      <p className="mt-2 text-center text-xs text-text-secondary">
        Don't have an account? <a href="/signup" className="underline">Sign up</a>
      </p>
    </form>
  );
}