import React, { useCallback, useEffect, useState } from "react";
import {
  WatchSource,
  WatchSourceCreate,
  WatchSourceUpdate,
  WatchedFile,
  WatchedFileStatus,
  listSources,
  createSource,
  updateSource,
  deleteSource,
  triggerScan,
  listWatchedFiles,
  reviewFile,
  reingestFile,
  ScanResult,
} from "../api/watch";
import WatchSourceModal from "./WatchSourceModal";

// ---------------------------------------------------------------------------
// Status badge helpers
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<WatchedFileStatus, { bg: string; color: string; label: string }> = {
  pending:   { bg: "#fef3c7", color: "#92400e", label: "⏳ Pending"   },
  approved:  { bg: "#d1fae5", color: "#065f46", label: "✅ Approved"  },
  rejected:  { bg: "#fee2e2", color: "#991b1b", label: "✗ Rejected"  },
  ingesting: { bg: "#dbeafe", color: "#1e40af", label: "⚙ Ingesting" },
  failed:    { bg: "#fce7f3", color: "#9d174d", label: "⚠ Failed"    },
};

function StatusBadge({ status }: { status: WatchedFileStatus }) {
  const s = STATUS_COLORS[status];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 9px",
        borderRadius: 20,
        fontSize: 11.5,
        fontWeight: 600,
        background: s.bg,
        color: s.color,
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// File size formatter
// ---------------------------------------------------------------------------

function fmtSize(bytes?: number): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type StatusFilter = WatchedFileStatus | "all";

export default function WatchInbox() {
  const [sources, setSources] = useState<WatchSource[]>([]);
  const [files, setFiles] = useState<WatchedFile[]>([]);
  const [selectedSource, setSelectedSource] = useState<number | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [loading, setLoading] = useState(false);
  const [scanResults, setScanResults] = useState<Record<number, ScanResult>>({});
  const [scanning, setScanning] = useState<Record<number, boolean>>({});
  const [reviewing, setReviewing] = useState<Record<number, boolean>>({});

  // Modal state
  const [modalSource, setModalSource] = useState<WatchSource | null | "new">(null);

  // Confirmation state for source deletion
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Note modal for rejection
  const [noteModal, setNoteModal] = useState<{ fileId: number; action: "approved" | "rejected" } | null>(null);
  const [noteText, setNoteText] = useState("");

  // Toast message
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const showToast = (kind: "ok" | "err", text: string) => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 4000);
  };

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const loadSources = useCallback(async () => {
    try {
      const s = await listSources();
      setSources(s);
    } catch (err) {
      showToast("err", err instanceof Error ? err.message : "Failed to load sources.");
    }
  }, []);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const params: { source_id?: number; status?: WatchedFileStatus } = {};
      if (selectedSource !== "all") params.source_id = selectedSource;
      if (statusFilter !== "all") params.status = statusFilter;
      const f = await listWatchedFiles(params);
      setFiles(f);
    } catch (err) {
      showToast("err", err instanceof Error ? err.message : "Failed to load files.");
    } finally {
      setLoading(false);
    }
  }, [selectedSource, statusFilter]);

  useEffect(() => { loadSources(); }, [loadSources]);
  useEffect(() => { loadFiles(); }, [loadFiles]);

  // ---------------------------------------------------------------------------
  // Source actions
  // ---------------------------------------------------------------------------

  async function handleSaveSource(data: WatchSourceCreate | WatchSourceUpdate) {
    if (modalSource === "new") {
      const created = await createSource(data as WatchSourceCreate);
      setSources((prev) => [created, ...prev]);
      showToast("ok", `Source "${created.name}" added.`);
    } else if (modalSource !== null) {
      const updated = await updateSource(modalSource.id, data as WatchSourceUpdate);
      setSources((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      showToast("ok", `Source "${updated.name}" updated.`);
    }
  }

  async function handleDeleteSource(id: number) {
    try {
      await deleteSource(id);
      setSources((prev) => prev.filter((s) => s.id !== id));
      if (selectedSource === id) setSelectedSource("all");
      setFiles((prev) => prev.filter((f) => f.source_id !== id));
      showToast("ok", "Source deleted.");
    } catch (err) {
      showToast("err", err instanceof Error ? err.message : "Delete failed.");
    }
    setConfirmDeleteId(null);
  }

  async function handleScan(sourceId: number) {
    setScanning((prev) => ({ ...prev, [sourceId]: true }));
    try {
      const result = await triggerScan(sourceId);
      setScanResults((prev) => ({ ...prev, [sourceId]: result }));
      showToast(
        "ok",
        `Scan complete — ${result.new_files_found} new file(s) found.`
      );
      loadFiles();
      loadSources();
    } catch (err) {
      showToast("err", err instanceof Error ? err.message : "Scan failed.");
    } finally {
      setScanning((prev) => ({ ...prev, [sourceId]: false }));
    }
  }

  // ---------------------------------------------------------------------------
  // File review actions
  // ---------------------------------------------------------------------------

  function openReview(fileId: number, action: "approved" | "rejected") {
    setNoteText("");
    setNoteModal({ fileId, action });
  }

  async function submitReview() {
    if (!noteModal) return;
    const { fileId, action } = noteModal;
    setReviewing((prev) => ({ ...prev, [fileId]: true }));
    setNoteModal(null);
    try {
      const updated = await reviewFile(fileId, {
        status: action,
        review_note: noteText.trim() || undefined,
      });
      setFiles((prev) => prev.map((f) => (f.id === fileId ? updated : f)));
      showToast(
        "ok",
        action === "approved"
          ? `"${updated.filename}" approved — ingestion started.`
          : `"${updated.filename}" rejected.`
      );
    } catch (err) {
      showToast("err", err instanceof Error ? err.message : "Review failed.");
    } finally {
      setReviewing((prev) => ({ ...prev, [fileId]: false }));
    }
  }

  async function handleReingest(fileId: number, filename: string) {
    setReviewing((prev) => ({ ...prev, [fileId]: true }));
    try {
      const updated = await reingestFile(fileId);
      setFiles((prev) => prev.map((f) => (f.id === fileId ? updated : f)));
      showToast("ok", `"${filename}" queued for re-ingestion.`);
    } catch (err) {
      showToast("err", err instanceof Error ? err.message : "Re-ingest failed.");
    } finally {
      setReviewing((prev) => ({ ...prev, [fileId]: false }));
    }
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const pendingCount = files.filter((f) => f.status === "pending").length;

  function sourceName(sourceId: number): string {
    return sources.find((s) => s.id === sourceId)?.name ?? `Source #${sourceId}`;
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      style={{
        fontFamily: '-apple-system,"Segoe UI",system-ui,sans-serif',
        maxWidth: 980,
        margin: "0 auto",
        padding: "2rem 1rem",
        color: "#111",
      }}
    >
      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 56,
            right: 20,
            zIndex: 9999,
            padding: "10px 18px",
            borderRadius: 8,
            fontSize: 13.5,
            background: toast.kind === "ok" ? "#d1fae5" : "#fee2e2",
            color: toast.kind === "ok" ? "#065f46" : "#991b1b",
            border: `1px solid ${toast.kind === "ok" ? "#6ee7b7" : "#fca5a5"}`,
            boxShadow: "0 4px 12px rgba(0,0,0,.12)",
          }}
        >
          {toast.text}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>File Sources</h1>
        {pendingCount > 0 && statusFilter !== "pending" && (
          <span
            style={{
              background: "#fbbf24",
              color: "#78350f",
              borderRadius: 20,
              padding: "2px 9px",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {pendingCount} pending
          </span>
        )}
        <button
          onClick={() => setModalSource("new")}
          style={{
            marginLeft: "auto",
            padding: "7px 18px",
            borderRadius: 7,
            border: "none",
            background: "#3b82f6",
            color: "#fff",
            fontSize: 13.5,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          + Add Source
        </button>
      </div>

      {/* Sources list */}
      {sources.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "3rem 1rem",
            color: "#9ca3af",
            border: "2px dashed #e5e7eb",
            borderRadius: 10,
            marginBottom: "2rem",
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 8 }}>📂</div>
          <p style={{ margin: 0 }}>No sources configured yet.</p>
          <p style={{ margin: "4px 0 0", fontSize: 13 }}>
            Add a filesystem path or GitHub repo to start monitoring for new files.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: "2rem" }}>
          {sources.map((src) => {
            const lastScan = src.last_scanned_at
              ? new Date(src.last_scanned_at).toLocaleString()
              : "Never";
            const scanRes = scanResults[src.id];
            const isScanning = scanning[src.id] ?? false;

            return (
              <div
                key={src.id}
                style={{
                  border: `2px solid ${selectedSource === src.id ? "#3b82f6" : "#e5e7eb"}`,
                  borderRadius: 10,
                  padding: "14px 18px",
                  background: selectedSource === src.id ? "#eff6ff" : "#fafafa",
                  cursor: "pointer",
                  transition: "border-color .15s",
                }}
                onClick={() =>
                  setSelectedSource((prev) => (prev === src.id ? "all" : src.id))
                }
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 20 }}>
                    {src.source_type === "filesystem" ? "📁" : "🐙"}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{src.name}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2, wordBreak: "break-all" }}>
                      {src.source_type === "filesystem"
                        ? `${src.fs_path}  ·  glob: ${src.file_glob}`
                        : `${src.github_repo}  ·  ${src.github_branch}${src.github_path ? " / " + src.github_path : ""}`}
                    </div>
                  </div>

                  {/* enabled badge */}
                  <span
                    style={{
                      fontSize: 11,
                      padding: "2px 7px",
                      borderRadius: 20,
                      background: src.enabled ? "#d1fae5" : "#f3f4f6",
                      color: src.enabled ? "#065f46" : "#6b7280",
                      fontWeight: 600,
                    }}
                  >
                    {src.enabled ? "Enabled" : "Disabled"}
                  </span>

                  {/* Scan button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleScan(src.id); }}
                    disabled={isScanning}
                    style={{
                      padding: "5px 12px",
                      border: "1px solid #3b82f6",
                      borderRadius: 6,
                      background: isScanning ? "#bfdbfe" : "#fff",
                      color: "#1d4ed8",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: isScanning ? "wait" : "pointer",
                    }}
                  >
                    {isScanning ? "Scanning…" : "↻ Scan Now"}
                  </button>

                  {/* Edit button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setModalSource(src); }}
                    style={{
                      padding: "5px 10px",
                      border: "1px solid #e5e7eb",
                      borderRadius: 6,
                      background: "#fff",
                      color: "#374151",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    ✏ Edit
                  </button>

                  {/* Delete button */}
                  {confirmDeleteId === src.id ? (
                    <span style={{ display: "flex", gap: 4 }} onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleDeleteSource(src.id)}
                        style={{ padding: "4px 10px", borderRadius: 5, border: "none", background: "#dc2626", color: "#fff", fontSize: 12, cursor: "pointer" }}
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        style={{ padding: "4px 10px", borderRadius: 5, border: "1px solid #e5e7eb", background: "#f9fafb", color: "#374151", fontSize: 12, cursor: "pointer" }}
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(src.id); }}
                      style={{
                        padding: "5px 10px",
                        border: "1px solid #fca5a5",
                        borderRadius: 6,
                        background: "#fff",
                        color: "#dc2626",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      🗑 Delete
                    </button>
                  )}
                </div>

                {/* Scan summary */}
                <div style={{ marginTop: 6, fontSize: 11.5, color: "#9ca3af" }}>
                  Last scanned: {lastScan}
                  {scanRes && (
                    <span style={{ marginLeft: 12 }}>
                      → {scanRes.new_files_found} new · {scanRes.already_known} known
                      {scanRes.errors.length > 0 && (
                        <span style={{ color: "#dc2626", marginLeft: 6 }}>
                          ⚠ {scanRes.errors[0]}
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* File inbox */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
          Discovered Files
          {selectedSource !== "all" && (
            <span style={{ fontWeight: 400, color: "#6b7280", fontSize: 13, marginLeft: 8 }}>
              — {sourceName(selectedSource as number)}
            </span>
          )}
        </h2>

        {/* Status filter pills */}
        <div style={{ display: "flex", gap: 6, marginLeft: "auto", flexWrap: "wrap" }}>
          {(["all", "pending", "approved", "rejected", "failed"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                padding: "4px 12px",
                borderRadius: 20,
                border: `1.5px solid ${statusFilter === s ? "#3b82f6" : "#e5e7eb"}`,
                background: statusFilter === s ? "#eff6ff" : "#f9fafb",
                color: statusFilter === s ? "#1d4ed8" : "#6b7280",
                fontSize: 12,
                fontWeight: statusFilter === s ? 600 : 400,
                cursor: "pointer",
              }}
            >
              {s === "all" ? "All" : STATUS_COLORS[s as WatchedFileStatus].label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p style={{ color: "#9ca3af", fontSize: 13 }}>Loading…</p>
      ) : files.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "2.5rem 1rem",
            color: "#9ca3af",
            border: "1px dashed #e5e7eb",
            borderRadius: 8,
          }}
        >
          {statusFilter === "pending"
            ? "No pending files — scan a source to discover new documents."
            : `No files with status "${statusFilter}".`}
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
            }}
          >
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e5e7eb" }}>
                {["File", "Source", "Path", "Size", "Discovered", "Status", "Actions"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: "8px 12px",
                      fontWeight: 600,
                      color: "#374151",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {files.map((file, i) => {
                const isReviewing = reviewing[file.id] ?? false;
                return (
                  <tr
                    key={file.id}
                    style={{
                      background: i % 2 === 0 ? "#fff" : "#f9fafb",
                      borderBottom: "1px solid #f3f4f6",
                    }}
                  >
                    <td style={{ padding: "9px 12px", fontWeight: 500, wordBreak: "break-word", maxWidth: 200 }}>
                      {file.filename}
                      {file.review_note && (
                        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2, fontStyle: "italic" }}>
                          {file.review_note}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "9px 12px", color: "#6b7280", whiteSpace: "nowrap" }}>
                      {sourceName(file.source_id)}
                    </td>
                    <td style={{ padding: "9px 12px", color: "#9ca3af", fontSize: 11.5, wordBreak: "break-all", maxWidth: 220 }}>
                      {file.relative_path ?? file.file_key}
                    </td>
                    <td style={{ padding: "9px 12px", whiteSpace: "nowrap", color: "#6b7280" }}>
                      {fmtSize(file.file_size_bytes)}
                    </td>
                    <td style={{ padding: "9px 12px", whiteSpace: "nowrap", color: "#6b7280" }}>
                      {new Date(file.discovered_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: "9px 12px" }}>
                      <StatusBadge status={file.status} />
                    </td>
                    <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}>
                      {isReviewing ? (
                        <span style={{ color: "#9ca3af", fontSize: 12 }}>Working…</span>
                      ) : (
                        <div style={{ display: "flex", gap: 5 }}>
                          {/* Pending — show approve + reject */}
                          {file.status === "pending" && (
                            <>
                              <button
                                onClick={() => openReview(file.id, "approved")}
                                style={btnStyle("#065f46", "#d1fae5")}
                              >
                                ✓ Approve
                              </button>
                              <button
                                onClick={() => openReview(file.id, "rejected")}
                                style={btnStyle("#991b1b", "#fee2e2")}
                              >
                                ✗ Reject
                              </button>
                            </>
                          )}

                          {/* Approved — can reject (reverse) */}
                          {file.status === "approved" && (
                            <button
                              onClick={() => openReview(file.id, "rejected")}
                              style={btnStyle("#991b1b", "#fee2e2")}
                            >
                              ✗ Reject
                            </button>
                          )}

                          {/* Rejected — can approve (reverse) */}
                          {file.status === "rejected" && (
                            <button
                              onClick={() => openReview(file.id, "approved")}
                              style={btnStyle("#065f46", "#d1fae5")}
                            >
                              ✓ Approve
                            </button>
                          )}

                          {/* Failed — can re-ingest */}
                          {file.status === "failed" && (
                            <button
                              onClick={() => handleReingest(file.id, file.filename)}
                              style={btnStyle("#1e40af", "#dbeafe")}
                            >
                              ↺ Retry
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit source modal */}
      {modalSource !== null && (
        <WatchSourceModal
          source={modalSource === "new" ? null : modalSource}
          onSave={handleSaveSource}
          onClose={() => setModalSource(null)}
        />
      )}

      {/* Note / confirm modal for approve/reject */}
      {noteModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9000,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 10,
              padding: "22px 26px",
              width: 380,
              maxWidth: "94vw",
              boxShadow: "0 8px 30px rgba(0,0,0,.18)",
            }}
          >
            <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700 }}>
              {noteModal.action === "approved" ? "✓ Approve File" : "✗ Reject File"}
            </h3>
            <p style={{ margin: "0 0 10px", fontSize: 13, color: "#6b7280" }}>
              {noteModal.action === "approved"
                ? "The file will be downloaded and ingested into the knowledge graph."
                : "The file will be marked as rejected. You can reverse this later."}
            </p>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>
              Note <span style={{ fontWeight: 400, color: "#9ca3af" }}>(optional)</span>
            </label>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={2}
              placeholder={
                noteModal.action === "rejected"
                  ? "e.g. Duplicate, out of scope…"
                  : "e.g. Priority document…"
              }
              style={{
                width: "100%",
                marginTop: 6,
                padding: "7px 10px",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                fontSize: 13,
                resize: "vertical",
                boxSizing: "border-box",
              }}
              autoFocus
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              <button
                onClick={() => setNoteModal(null)}
                style={{ padding: "7px 16px", border: "1px solid #e5e7eb", borderRadius: 6, background: "#f9fafb", color: "#374151", fontSize: 13, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={submitReview}
                style={{
                  padding: "7px 18px",
                  border: "none",
                  borderRadius: 6,
                  background: noteModal.action === "approved" ? "#16a34a" : "#dc2626",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Confirm {noteModal.action === "approved" ? "Approval" : "Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Button style helper
// ---------------------------------------------------------------------------

function btnStyle(color: string, bg: string): React.CSSProperties {
  return {
    padding: "4px 10px",
    border: `1px solid ${color}22`,
    borderRadius: 5,
    background: bg,
    color,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  };
}
