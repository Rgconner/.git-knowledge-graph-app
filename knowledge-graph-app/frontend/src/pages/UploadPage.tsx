import React, { useCallback, useEffect, useState } from "react";
import DropZone from "../components/DropZone";
import DocumentList from "../components/DocumentList";
import {
  listDocuments,
  uploadDocument,
  DocumentRecord,
} from "../api/documents";

export default function UploadPage() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [message, setMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

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

  async function handleFileSelected(file: File) {
    setMessage(null);
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

      {message && <p style={messageStyle}>{message.text}</p>}

      <h2 style={{ fontSize: "16px", fontWeight: 600, marginTop: "2rem", marginBottom: "0.5rem" }}>
        Uploaded Documents
      </h2>
      <DocumentList documents={documents} onRefresh={refresh} />
    </main>
  );
}
