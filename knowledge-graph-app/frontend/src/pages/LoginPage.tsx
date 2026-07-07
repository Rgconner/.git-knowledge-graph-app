import React, { useState, FormEvent } from "react";
import { useAuth } from "../hooks/useAuth";

interface Props {
  onNavigateToRegister: () => void;
}

export default function LoginPage({ onNavigateToRegister }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      // App.tsx will detect the token and render the main app
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Knowledge Graph</h1>
        <p style={styles.subtitle}>Sign in to your account</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              style={styles.input}
              placeholder="you@example.com"
            />
          </label>

          <label style={styles.label}>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={styles.input}
              placeholder="••••••••"
            />
          </label>

          {error && <p style={styles.error}>{error}</p>}

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p style={styles.footer}>
          Don&apos;t have an account?{" "}
          <button onClick={onNavigateToRegister} style={styles.link}>
            Register
          </button>
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f7f8fa",
    fontFamily: '-apple-system, "Segoe UI", system-ui, sans-serif',
  },
  card: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: "40px 36px",
    width: "100%",
    maxWidth: 380,
  },
  title: {
    margin: "0 0 4px",
    fontSize: 22,
    fontWeight: 700,
    color: "#1f2328",
  },
  subtitle: {
    margin: "0 0 28px",
    fontSize: 14,
    color: "#57606a",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontSize: 13,
    fontWeight: 500,
    color: "#1f2328",
  },
  input: {
    padding: "8px 10px",
    fontSize: 14,
    border: "1px solid #e5e7eb",
    borderRadius: 5,
    outline: "none",
    color: "#1f2328",
  },
  error: {
    margin: 0,
    fontSize: 13,
    color: "#c0392b",
    background: "#fdf2f2",
    border: "1px solid #f5c6cb",
    borderRadius: 4,
    padding: "6px 10px",
  },
  button: {
    marginTop: 4,
    padding: "10px 0",
    fontSize: 14,
    fontWeight: 600,
    color: "#fff",
    background: "#3b82d4",
    border: "none",
    borderRadius: 5,
    cursor: "pointer",
  },
  footer: {
    marginTop: 20,
    textAlign: "center",
    fontSize: 13,
    color: "#57606a",
  },
  link: {
    background: "none",
    border: "none",
    color: "#3b82d4",
    cursor: "pointer",
    padding: 0,
    fontSize: 13,
    textDecoration: "underline",
  },
};
