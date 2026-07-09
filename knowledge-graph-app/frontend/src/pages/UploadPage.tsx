import React, { useCallback, useEffect, useState } from "react";
import DropZone from "../components/DropZone";
import DocumentList from "../components/DocumentList";
import RenameModal from "../components/RenameModal";
import {
  listDocuments,
  uploadDocument,
  checkDuplicate,
  DocumentRecord,
  DuplicateMatch,
} from "../api/documents";

const ALWAYS_RENAME_KEY = "kg_always_rename";

function getAlwaysRename(): boolean {
  return localStorage.getItem(ALWAYS_RENAME_KEY) === "true";
}
function setAlwaysRenamePreference(val: boolean) {
  localStorage.setItem(ALWAYS_RENAME_KEY, String(val));
}

export default function UploadPage() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [message, setMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  // Rename modal state
  const [renameFile, setRenameFile] = useState<File | null>(null);
  const [renameRequired, setRenameRequired] = useState(false);
  const [alwaysRename, setAlwaysRename] = useState<boolean>(getAlwaysRename);

  // Duplicate warning state
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([]);
  const [checking, setChecking] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const docs = await listDocuments();
      setDocuments(docs);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessage({ kind: "error", text: `Failed to load documents: ${msg}` });
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // ── Core upload (after rename + duplicate decisions are resolved) ──────────
  async function doUpload(file: File, overrideName?: string) {
    setMessage(null);
    setPendingFile(null);
    setDuplicateMatches([]);
    setRenameFile(null);
    try {
      const newDoc = await uploadDocument(file, overrideName);
      setDocuments((prev) => [newDoc, ...prev]);
      const displayName = overrideName ?? file.name;
      setMessage({
        kind: "success",
        text: `"${displayName}" uploaded successfully — AI processing started.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessage({ kind: "error", text: `Upload failed: ${msg}` });
    }
  }

  // ── Duplicate check then upload ────────────────────────────────────────────
  async function checkThenUpload(file: File, overrideName?: string) {
    setChecking(true);
    try {
      // Use a renamed File for the duplicate check too so the server sees
      // the final intended name when looking for collisions.
      const checkFile =
        overrideName && overrideName !== file.name
          ? new File([file], overrideName, { type: file.type })
          : file;

      const result = await checkDuplicate(checkFile);
      if (result.has_duplicates) {
        setPendingFile(file);
        // Store override name on the file via a custom property workaround:
        // pass it through the pending state below
        setDuplicateMatches(result.matches);
        // Stash the override name for when the user confirms
        setPendingOverrideName(overrideName ?? null);
      } else {
        await doUpload(file, overrideName);
      }
    } catch {
      await doUpload(file, overrideName);
    } finally {
      setChecking(false);
    }
  }

  // Stash the overrideName that was chosen in the rename modal so the
  // duplicate-confirm flow can pass it through to doUpload.
  const [pendingOverrideName, setPendingOverrideName] = useState<string | null>(null);

  // ── File selected from DropZone ────────────────────────────────────────────
  function handleFileSelected(file: File) {
    setMessage(null);
    setDuplicateMatches([]);
    setPendingFile(null);
    setPendingOverrideName(null);

    const nameCollision = documents.some(
      (d) => d.filename.toLowerCase() === file.name.toLowerCase()
    );

    if (nameCollision) {
      // Rename is REQUIRED — must rename before proceeding
      setRenameFile(file);
      setRenameRequired(true);
    } else if (alwaysRename) {
      // Rename is optional per user preference
      setRenameFile(file);
      setRenameRequired(false);
    } else {
      // Skip rename modal entirely
      checkThenUpload(file);
    }
  }

  // ── Rename modal confirmed ─────────────────────────────────────────────────
  function handleRenameConfirm(newName: string, newAlwaysRename: boolean) {
    if (newAlwaysRename !== alwaysRename) {
      setAlwaysRename(newAlwaysRename);
      setAlwaysRenamePreference(newAlwaysRename);
    }
    const file = renameFile!;
    setRenameFile(null);
    setRenameRequired(false);
    checkThenUpload(file, newName !== file.name ? newName : undefined);
  }

  // ── Rename modal cancelled ─────────────────────────────────────────────────
  function handleRenameCancel() {
    setRenameFile(null);
    setRenameRequired(false);
    setMessage({ kind: "error", text: "Upload cancelled." });
  }

  // ── Duplicate confirmed (upload anyway) ───────────────────────────────────
  function handleConfirmUpload() {
    if (pendingFile) doUpload(pendingFile, pendingOverrideName ?? undefined);
  }

  function handleCancelUpload() {
    setPendingFile(null);
    setDuplicateMatches([]);
    setPendingOverrideName(null);
    setMessage({ kind: "error", text: "Upload cancelled." });
  }

  // ── Styles ─────────────────────────────────────────────────────────────────
  const pageStyle: React.CSSProperties = {
    fontFamily: '-apple-system, "Segoe UI", system-ui, sans-serif',
    maxWidth: "760px",
    margin: "0 auto",
    padding: "2rem 1rem",
    backgroundColor: "#ffffff",
    color: "#1f2328",
  };

  const messageStyle: React.CSSProperties = {
    marginTop: "0.75rem",
    padding: "0.5rem 0.75rem",
    borderRadius: "4px",
    fontSize: "14px",
    ...(message?.kind === "success"
      ? { backgroundColor: "#d1fae5", color: "#065f46", border: "1px solid #6ee7b7" }
      : { backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5" }),
  };

  return (
    <main style={pageStyle}>
      <h1 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "0.25rem" }}>
        Document Upload
      </h1>
      <p style={{ fontSize: "14px", color: "#57606a", marginBottom: "1.5rem" }}>
        Upload any document. The AI pipeline will extract entities, relationships,
        and action items automatically.
      </p>

      <DropZone onFileSelected={handleFileSelected} />

      {/* Always-rename preference toggle (shown below the drop zone) */}
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginTop: "0.75rem",
          fontSize: "13px",
          color: "#57606a",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <input
          type="checkbox"
          checked={alwaysRename}
          onChange={(e) => {
            setAlwaysRename(e.target.checked);
            setAlwaysRenamePreference(e.target.checked);
          }}
          style={{ width: "14px", height: "14px", cursor: "pointer" }}
        />
        Always ask to rename before uploading
      </label>

      {checking && (
        <p style={{ fontSize: "14px", color: "#57606a", marginTop: "0.75rem" }}>
          ⏳ Checking for duplicates…
        </p>
      )}

      {/* Duplicate warning banner */}
      {duplicateMatches.length > 0 && pendingFile && (
        <div
          style={{
            marginTop: "0.75rem",
            padding: "1rem",
            backgroundColor: "#fffbeb",
            border: "1px solid #f59e0b",
            borderRadius: "6px",
            fontSize: "14px",
          }}
        >
          <p style={{ margin: "0 0 0.5rem 0", fontWeight: 600, color: "#92400e" }}>
            ⚠️ Possible duplicate detected
          </p>
          <p style={{ margin: "0 0 0.75rem 0", color: "#78350f" }}>
            <strong>"{pendingOverrideName ?? pendingFile.name}"</strong> is highly
            similar to{" "}
            {duplicateMatches.length === 1
              ? "an existing document"
              : "existing documents"}
            :
          </p>
          <ul style={{ margin: "0 0 0.75rem 1.25rem", padding: 0, color: "#78350f" }}>
            {duplicateMatches.map((m) => (
              <li key={m.document_id} style={{ marginBottom: "2px" }}>
                <strong>{m.filename}</strong> —{" "}
                <span style={{ color: "#b45309" }}>
                  {(m.similarity * 100).toFixed(1)}% identical
                </span>
              </li>
            ))}
          </ul>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={handleConfirmUpload}
              style={{
                padding: "6px 16px",
                backgroundColor: "#d97706",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Upload Anyway
            </button>
            <button
              onClick={handleCancelUpload}
              style={{
                padding: "6px 16px",
                backgroundColor: "#e5e7eb",
                color: "#374151",
                border: "none",
                borderRadius: "4px",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {message && <p style={messageStyle}>{message.text}</p>}

      <h2
        style={{
          fontSize: "16px",
          fontWeight: 600,
          marginTop: "2rem",
          marginBottom: "0.5rem",
        }}
      >
        Uploaded Documents
      </h2>
      <DocumentList documents={documents} onRefresh={refresh} />

      {/* Rename modal — rendered last so it overlays everything */}
      {renameFile && (
        <RenameModal
          originalName={renameFile.name}
          required={renameRequired}
          alwaysRename={alwaysRename}
          onConfirm={handleRenameConfirm}
          onCancel={handleRenameCancel}
        />
      )}
    </main>
  );
}
