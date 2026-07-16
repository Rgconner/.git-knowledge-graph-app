import React, { useEffect, useRef, useState } from "react";
import { DocumentRecord, deleteDocument } from "../api/documents";

interface DocumentListProps {
  documents: DocumentRecord[];
  onRefresh: () => void;
}

function getStatus(doc: DocumentRecord): "processing" | "error" | "ready" {
  if (doc.processed_at === null) return "processing";
  if (doc.ai_category === "processing_error") return "error";
  return "ready";
}

const BADGE_STYLES: Record<string, React.CSSProperties> = {
  processing: {
    backgroundColor: "#fef3c7",
    color: "#92400e",
    border: "1px solid #fcd34d",
  },
  error: {
    backgroundColor: "#fee2e2",
    color: "#991b1b",
    border: "1px solid #fca5a5",
  },
  ready: {
    backgroundColor: "#d1fae5",
    color: "#065f46",
    border: "1px solid #6ee7b7",
  },
};

const BADGE_LABEL: Record<string, string> = {
  processing: "Processing",
  error: "Error",
  ready: "Ready",
};

export default function DocumentList({
  documents,
  onRefresh,
}: DocumentListProps) {
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete(id: number) {
    setDeletingId(id);
    setDeleteError(null);
    try {
      await deleteDocument(id);
      onRefreshRef.current();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  }

  useEffect(() => {
    const hasPending = documents.some(
      (doc) => getStatus(doc) === "processing"
    );
    if (!hasPending) return;

    const id = setInterval(() => {
      onRefreshRef.current();
    }, 3000);

    return () => clearInterval(id);
  }, [documents]);

  if (documents.length === 0) {
    return (
      <p style={{ color: "#57606a", fontSize: "14px", marginTop: "1rem" }}>
        No documents uploaded yet.
      </p>
    );
  }

  const thStyle: React.CSSProperties = {
    textAlign: "left",
    padding: "0.5rem 0.75rem",
    fontWeight: 600,
    fontSize: "13px",
    color: "#57606a",
    borderBottom: "1px solid #e5e7eb",
    backgroundColor: "#f7f8fa",
  };

  const tdStyle: React.CSSProperties = {
    padding: "0.5rem 0.75rem",
    fontSize: "14px",
    borderBottom: "1px solid #e5e7eb",
    color: "#1f2328",
    verticalAlign: "middle",
  };

  const badgeBase: React.CSSProperties = {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 600,
    whiteSpace: "nowrap",
  };

  return (
    <div style={{ overflowX: "auto", marginTop: "1rem" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          border: "1px solid #e5e7eb",
          borderRadius: "6px",
          tableLayout: "fixed",
        }}
      >
        <thead>
          <tr>
            <th style={{ ...thStyle, width: "22%" }}>AI Name</th>
            <th style={{ ...thStyle, width: "18%" }}>Original Filename</th>
            <th style={{ ...thStyle, width: "8%" }}>Type</th>
            <th style={{ ...thStyle, width: "16%" }}>Category</th>
            <th style={{ ...thStyle, width: "14%" }}>Uploaded</th>
            <th style={{ ...thStyle, width: "10%" }}>Status</th>
            <th style={{ ...thStyle, width: "12%" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => {
            const status = getStatus(doc);
            // Before pipeline completes, filename == original_filename
            const aiName = status !== "processing" && doc.original_filename
              ? doc.filename
              : null;
            const originalName = doc.original_filename ?? doc.filename;
            return (
              <tr key={doc.id}>
                {/* AI-generated descriptive name */}
                <td
                  style={{
                    ...tdStyle,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontWeight: aiName ? 500 : 400,
                    color: aiName ? "#1f2328" : "#9ca3af",
                  }}
                  title={aiName ?? "Processing…"}
                >
                  {status === "processing"
                    ? <span style={{ color: "#9ca3af", fontStyle: "italic" }}>Generating…</span>
                    : (aiName ?? <span style={{ color: "#9ca3af" }}>—</span>)}
                </td>
                {/* Original user-supplied filename */}
                <td
                  style={{
                    ...tdStyle,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    color: "#57606a",
                    fontSize: "13px",
                  }}
                  title={originalName}
                >
                  {originalName}
                </td>
                <td style={tdStyle}>{doc.file_type}</td>
                <td style={{ ...tdStyle, color: "#57606a" }}>
                  {status === "processing"
                    ? "Categorizing…"
                    : doc.ai_category ?? "—"}
                </td>
                <td style={tdStyle}>
                  {new Date(doc.created_at).toLocaleString()}
                </td>
                <td style={tdStyle}>
                  <span style={{ ...badgeBase, ...BADGE_STYLES[status] }}>
                    {BADGE_LABEL[status]}
                  </span>
                </td>
                <td style={tdStyle}>
                  {confirmId === doc.id ? (
                    // Confirmation row
                    <span style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                      <button
                        onClick={() => handleDelete(doc.id)}
                        disabled={deletingId === doc.id}
                        style={{
                          padding: "2px 8px",
                          fontSize: "12px",
                          backgroundColor: "#dc2626",
                          color: "#fff",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                      >
                        {deletingId === doc.id ? "…" : "Yes"}
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        style={{
                          padding: "2px 8px",
                          fontSize: "12px",
                          backgroundColor: "#e5e7eb",
                          color: "#374151",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                      >
                        No
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmId(doc.id)}
                      style={{
                        padding: "2px 8px",
                        fontSize: "12px",
                        backgroundColor: "transparent",
                        color: "#dc2626",
                        border: "1px solid #dc2626",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {deleteError && (
        <p style={{ color: "#dc2626", fontSize: "13px", marginTop: "0.5rem" }}>
          {deleteError}
        </p>
      )}
    </div>
  );
}
