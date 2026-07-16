import React, { useEffect, useRef, useState } from "react";

interface Props {
  /** The original filename from the dropped/selected file. */
  originalName: string;
  /** If true, the rename is required (name collision) — the user cannot skip it. */
  required: boolean;
  /** Current value of the "always ask for rename" preference checkbox. */
  alwaysRename: boolean;
  /** Called when the user confirms. newName may equal originalName if not required. */
  onConfirm: (newName: string, alwaysRename: boolean) => void;
  /** Called when the user cancels (only available when rename is not required). */
  onCancel: () => void;
}

export default function RenameModal({
  originalName,
  required,
  alwaysRename: initialAlwaysRename,
  onConfirm,
  onCancel,
}: Props) {
  const ext = originalName.includes(".")
    ? "." + originalName.split(".").pop()!
    : "";
  const baseName = ext
    ? originalName.slice(0, originalName.length - ext.length)
    : originalName;

  const [name, setName] = useState(baseName);
  const [alwaysRename, setAlwaysRename] = useState(initialAlwaysRename);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus and select the name field on mount
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function validate(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return "Filename cannot be empty.";
    if (/[/\\:*?"<>|]/.test(trimmed)) return 'Name cannot contain: / \\ : * ? " < > |';
    return null;
  }

  function handleConfirm() {
    const err = validate(name);
    if (err) { setError(err); return; }
    onConfirm(name.trim() + ext, alwaysRename);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleConfirm();
    if (e.key === "Escape" && !required) onCancel();
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={(e) => { if (e.target === e.currentTarget && !required) onCancel(); }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "8px",
          padding: "1.5rem",
          width: "420px",
          maxWidth: "calc(100vw - 2rem)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          fontFamily: '-apple-system, "Segoe UI", system-ui, sans-serif',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: "1rem" }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: "15px", color: "#1f2328" }}>
            {required ? "⚠️ Rename Required" : "✏️ Rename File"}
          </p>
          <p style={{ margin: "0.35rem 0 0 0", fontSize: "13px", color: "#57606a" }}>
            {required
              ? `A file named "${originalName}" already exists. You must rename this file before uploading.`
              : `Optionally rename "${originalName}" before uploading.`}
          </p>
        </div>

        {/* Name input */}
        <div style={{ marginBottom: "0.75rem" }}>
          <label style={{ fontSize: "12px", fontWeight: 600, color: "#57606a", display: "block", marginBottom: "4px" }}>
            Filename
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null); }}
              onKeyDown={handleKeyDown}
              style={{
                flex: 1,
                padding: "6px 8px",
                fontSize: "14px",
                border: error ? "1px solid #dc2626" : "1px solid #d1d5db",
                borderRight: ext ? "none" : undefined,
                borderRadius: ext ? "4px 0 0 4px" : "4px",
                outline: "none",
                color: "#1f2328",
              }}
            />
            {ext && (
              <span
                style={{
                  padding: "6px 10px",
                  fontSize: "14px",
                  background: "#f7f8fa",
                  border: "1px solid #d1d5db",
                  borderRadius: "0 4px 4px 0",
                  color: "#57606a",
                  whiteSpace: "nowrap",
                }}
              >
                {ext}
              </span>
            )}
          </div>
          {error && (
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#dc2626" }}>{error}</p>
          )}
        </div>

        {/* Always rename checkbox */}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "13px",
            color: "#57606a",
            cursor: "pointer",
            marginBottom: "1.25rem",
            userSelect: "none",
          }}
        >
          <input
            type="checkbox"
            checked={alwaysRename}
            onChange={(e) => setAlwaysRename(e.target.checked)}
            style={{ width: "14px", height: "14px", cursor: "pointer" }}
          />
          Always ask to rename on every upload
        </label>

        {/* Buttons */}
        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          {/* Cancel — always available; when required it cancels the whole upload */}
          <button
            onClick={onCancel}
            style={{
              padding: "6px 16px",
              fontSize: "13px",
              background: "#e5e7eb",
              color: "#374151",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            {required ? "Cancel Upload" : "Cancel"}
          </button>

          {/* Keep original name — only available when rename is optional */}
          {!required && (
            <button
              onClick={() => onConfirm(originalName, alwaysRename)}
              style={{
                padding: "6px 16px",
                fontSize: "13px",
                background: "#fff",
                color: "#374151",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Keep original name
            </button>
          )}

          <button
            onClick={handleConfirm}
            style={{
              padding: "6px 16px",
              fontSize: "13px",
              fontWeight: 600,
              background: "#3b82d4",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Rename &amp; Upload
          </button>
        </div>
      </div>
    </div>
  );
}
