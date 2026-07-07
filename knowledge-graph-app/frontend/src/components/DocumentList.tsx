import React, { useEffect, useRef } from "react";
import { DocumentRecord } from "../api/documents";

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
            <th style={{ ...thStyle, width: "30%" }}>Filename</th>
            <th style={{ ...thStyle, width: "10%" }}>Type</th>
            <th style={{ ...thStyle, width: "25%" }}>Category</th>
            <th style={{ ...thStyle, width: "20%" }}>Uploaded</th>
            <th style={{ ...thStyle, width: "15%" }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => {
            const status = getStatus(doc);
            return (
              <tr key={doc.id}>
                <td
                  style={{
                    ...tdStyle,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={doc.filename}
                >
                  {doc.filename}
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
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
