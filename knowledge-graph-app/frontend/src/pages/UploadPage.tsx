import React, { useCallback, useEffect, useState } from "react";
import DropZone from "../components/DropZone";
import DocumentList from "../components/DocumentList";
import {
  listDocuments,
  uploadDocument,
  checkDuplicate,
  DocumentRecord,
  DuplicateMatch,
} from "../api/documents";

export default function UploadPage() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [message, setMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

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

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function doUpload(file: File) {
    setMessage(null);
    setPendingFile(null);
    setDuplicateMatches([]);
    try {
      const newDoc = await uploadDocument(file);
      setDocuments((prev) => [newDoc, ...prev]);
      setMessage({
        kind: "success",
        text: `"${file.name}" uploaded successfully — AI processing started.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessage({ kind: "error", text: `Upload failed: ${msg}` });
    }
  }

  async function handleFileSelected(file: File) {
    setMessage(null);
    setDuplicateMatches([]);
    setPendingFile(null);
    setChecking(true);
    try {
      const result = await checkDuplicate(file);
      if (result.has_duplicates) {
        // Show warning — wait for user to confirm or cancel
        setPendingFile(file);
        setDuplicateMatches(result.matches);
      } else {
        await doUpload(file);
      }
    } catch {
      // If duplicate check itself fails, proceed with upload anyway
      await doUpload(file);
    } finally {
      setChecking(false);
    }
  }

  function handleConfirmUpload() {
    if (pendingFile) doUpload(pendingFile);
  }

  function handleCancelUpload() {
    setPendingFile(null);
    setDuplicateMatches([]);
    setMessage({ kind: "error", text: "Upload cancelled." });
  }

  const pageStyle: React.CSSProperties = {
    fontFamily: '-apple-system, "Segoe UI", system-ui, sans-serif',
    maxWidth: "760px",
    margin: "0 auto",
    padding: "2rem 1rem",
    backgroundColor: "#ffffff",
    color: "#1f2328",
  };

  const headingStyle: React.CSSProperties = {
    fontSize: "22px",
    fontWeight: 700,
    marginBottom: "0.25rem",
  };

  const subheadStyle: React.CSSProperties = {
    fontSize: "14px",
    color: "#57606a",
    marginBottom: "1.5rem",
  };

  const messageStyle: React.CSSProperties = {
    marginTop: "0.75rem",
    padding: "0.5rem 0.75rem",
    borderRadius: "4px",
    fontSize: "14px",
    ...(message?.kind === "success"
      ? {
          backgroundColor: "#d1fae5",
          color: "#065f46",
          border: "1px solid #6ee7b7",
        }
      : {
          backgroundColor: "#fee2e2",
          color: "#991b1b",
          border: "1px solid #fca5a5",
        }),
  };

  return (
    <main style={pageStyle}>
      <h1 style={headingStyle}>Document Upload</h1>
      <p style={subheadStyle}>
        Upload any document. The AI pipeline will extract entities, relationships,
        and action items automatically.
      </p>

      <DropZone onFileSelected={handleFileSelected} />

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
            <strong>"{pendingFile.name}"</strong> is highly similar to{" "}
            {duplicateMatches.length === 1 ? "an existing document" : "existing documents"}:
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

      <h2 style={{ fontSize: "16px", fontWeight: 600, marginTop: "2rem", marginBottom: "0.5rem" }}>
        Uploaded Documents
      </h2>
      <DocumentList documents={documents} onRefresh={refresh} />
    </main>
  );
}
