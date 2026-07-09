import React, { useState, useEffect } from "react";
import {
  WatchSource,
  WatchSourceCreate,
  WatchSourceUpdate,
  WatchSourceType,
} from "../api/watch";

interface Props {
  /** null = create mode, WatchSource = edit mode */
  source: WatchSource | null;
  onSave: (data: WatchSourceCreate | WatchSourceUpdate) => Promise<void>;
  onClose: () => void;
}

const INPUT: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  fontSize: 13.5,
  background: "#f9fafb",
  color: "#111",
  boxSizing: "border-box",
};

const LABEL: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "#374151",
  marginBottom: 4,
  marginTop: 12,
};

export default function WatchSourceModal({ source, onSave, onClose }: Props) {
  const isEdit = source !== null;

  const [name, setName] = useState(source?.name ?? "");
  const [srcType, setSrcType] = useState<WatchSourceType>(
    source?.source_type ?? "filesystem"
  );
  // Filesystem fields
  const [fsPath, setFsPath] = useState(source?.fs_path ?? "");
  const [fileGlob, setFileGlob] = useState(source?.file_glob ?? "**/*");
  // GitHub fields
  const [ghRepo, setGhRepo] = useState(source?.github_repo ?? "");
  const [ghBranch, setGhBranch] = useState(source?.github_branch ?? "main");
  const [ghPath, setGhPath] = useState(source?.github_path ?? "");
  const [ghToken, setGhToken] = useState("");
  const [enabled, setEnabled] = useState(source?.enabled ?? true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset token field on open (never pre-populate for security)
  useEffect(() => {
    setGhToken("");
  }, [source]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required."); return; }
    if (srcType === "filesystem" && !fsPath.trim()) {
      setError("Filesystem path is required."); return;
    }
    if (srcType === "github" && !ghRepo.trim()) {
      setError("GitHub repo (owner/repo) is required."); return;
    }

    setError(null);
    setSaving(true);
    try {
      const payload: WatchSourceCreate & WatchSourceUpdate = {
        name: name.trim(),
        source_type: srcType,
        fs_path: srcType === "filesystem" ? fsPath.trim() : undefined,
        file_glob: srcType === "filesystem" ? (fileGlob.trim() || "**/*") : undefined,
        github_repo: srcType === "github" ? ghRepo.trim() : undefined,
        github_branch: srcType === "github" ? (ghBranch.trim() || "main") : undefined,
        github_path: srcType === "github" ? ghPath.trim() : undefined,
        github_token: srcType === "github" && ghToken.trim() ? ghToken.trim() : undefined,
        enabled,
      };
      await onSave(payload);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 8000,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: "24px 28px",
          width: 460,
          maxWidth: "96vw",
          boxShadow: "0 8px 32px rgba(0,0,0,.18)",
          fontFamily: '-apple-system,"Segoe UI",system-ui,sans-serif',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 700, color: "#111" }}>
          {isEdit ? "Edit Watch Source" : "Add Watch Source"}
        </h2>

        {/* Name */}
        <label style={LABEL}>Name</label>
        <input
          style={INPUT}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My meeting notes folder"
          autoFocus
        />

        {/* Source type toggle */}
        <label style={LABEL}>Source Type</label>
        <div style={{ display: "flex", gap: 8 }}>
          {(["filesystem", "github"] as WatchSourceType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setSrcType(t)}
              style={{
                flex: 1,
                padding: "7px 0",
                borderRadius: 7,
                border: `2px solid ${srcType === t ? "#3b82f6" : "#e5e7eb"}`,
                background: srcType === t ? "#eff6ff" : "#f9fafb",
                color: srcType === t ? "#1d4ed8" : "#374151",
                fontWeight: srcType === t ? 600 : 400,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {t === "filesystem" ? "📁 Filesystem" : "🐙 GitHub"}
            </button>
          ))}
        </div>

        {/* Filesystem fields */}
        {srcType === "filesystem" && (
          <>
            <label style={LABEL}>Directory Path</label>
            <input
              style={INPUT}
              value={fsPath}
              onChange={(e) => setFsPath(e.target.value)}
              placeholder="/home/user/documents  or  C:\Users\you\Documents"
            />
            <label style={LABEL}>File Glob <span style={{ fontWeight: 400, color: "#6b7280" }}>(optional)</span></label>
            <input
              style={INPUT}
              value={fileGlob}
              onChange={(e) => setFileGlob(e.target.value)}
              placeholder="**/*  or  *.pdf  or  meetings/**"
            />
          </>
        )}

        {/* GitHub fields */}
        {srcType === "github" && (
          <>
            <label style={LABEL}>Repository <span style={{ fontWeight: 400, color: "#6b7280" }}>(owner/repo)</span></label>
            <input
              style={INPUT}
              value={ghRepo}
              onChange={(e) => setGhRepo(e.target.value)}
              placeholder="my-org/my-repo"
            />
            <label style={LABEL}>Branch</label>
            <input
              style={INPUT}
              value={ghBranch}
              onChange={(e) => setGhBranch(e.target.value)}
              placeholder="main"
            />
            <label style={LABEL}>Sub-directory <span style={{ fontWeight: 400, color: "#6b7280" }}>(optional)</span></label>
            <input
              style={INPUT}
              value={ghPath}
              onChange={(e) => setGhPath(e.target.value)}
              placeholder="docs/meetings"
            />
            <label style={LABEL}>
              Personal Access Token{" "}
              <span style={{ fontWeight: 400, color: "#6b7280" }}>(required for private repos)</span>
            </label>
            <input
              style={INPUT}
              type="password"
              value={ghToken}
              onChange={(e) => setGhToken(e.target.value)}
              placeholder={isEdit ? "Leave blank to keep existing token" : "ghp_…"}
              autoComplete="new-password"
            />
          </>
        )}

        {/* Enabled toggle */}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 16,
            fontSize: 13,
            color: "#374151",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            style={{ width: 14, height: 14 }}
          />
          Enable this source (scan on demand)
        </label>

        {error && (
          <p style={{ color: "#b91c1c", fontSize: 13, marginTop: 10 }}>{error}</p>
        )}

        {/* Buttons */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 18px",
              border: "1px solid #e5e7eb",
              borderRadius: 7,
              background: "#f9fafb",
              color: "#374151",
              fontSize: 13.5,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: "8px 22px",
              border: "none",
              borderRadius: 7,
              background: saving ? "#93c5fd" : "#3b82f6",
              color: "#fff",
              fontSize: 13.5,
              fontWeight: 600,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Source"}
          </button>
        </div>
      </form>
    </div>
  );
}
