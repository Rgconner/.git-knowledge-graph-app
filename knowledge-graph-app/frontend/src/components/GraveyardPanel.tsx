import React, { useCallback, useEffect, useState } from "react";
import { getGraveyard, restoreNode, NodeResponse } from "../api/nodes";

interface Props {
  open: boolean;
  onClose: () => void;
  onRestored: () => void;   // triggers graph reload
}

const TYPE_EMOJI: Record<string, string> = {
  person: "👤", idea: "💡", project: "📋", keyword: "🏷️",
  organization: "🏢", location: "📍", date: "📅",
};

export default function GraveyardPanel({ open, onClose, onRestored }: Props) {
  const [items, setItems]       = useState<NodeResponse[]>([]);
  const [loading, setLoading]   = useState(false);
  const [restoring, setRestoring] = useState<number | null>(null);
  const [error, setError]       = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getGraveyard();
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load graveyard.");
    } finally {
      setLoading(false);
    }
  }, [open]);

  useEffect(() => { load(); }, [load]);

  async function handleRestore(id: number) {
    setRestoring(id);
    try {
      await restoreNode(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      onRestored();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Restore failed.");
    } finally {
      setRestoring(null);
    }
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.3)", zIndex: 9100 }}
      />

      {/* Panel */}
      <div
        style={{
          position: "fixed",
          top: 44,
          right: 0,
          bottom: 0,
          width: 360,
          background: "#fff",
          borderLeft: "1px solid #e5e7eb",
          zIndex: 9150,
          display: "flex",
          flexDirection: "column",
          fontFamily: '-apple-system,"Segoe UI",system-ui,sans-serif',
          boxShadow: "-4px 0 20px rgba(0,0,0,.12)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "#1f2937",
          }}
        >
          <span style={{ fontSize: 20 }}>🪦</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: "#fff", fontSize: 14 }}>Node Graveyard</div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>
              {items.length} archived node{items.length !== 1 ? "s" : ""}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none",
              color: "#9ca3af", fontSize: 20, cursor: "pointer", lineHeight: 1,
              padding: "2px 6px",
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
          {loading && (
            <p style={{ color: "#9ca3af", fontSize: 13 }}>Loading…</p>
          )}
          {error && (
            <p style={{ color: "#dc2626", fontSize: 13 }}>{error}</p>
          )}
          {!loading && items.length === 0 && (
            <div style={{ textAlign: "center", marginTop: 60, color: "#9ca3af" }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🪦</div>
              <p style={{ margin: 0, fontSize: 13 }}>The graveyard is empty.</p>
              <p style={{ margin: "4px 0 0", fontSize: 12 }}>
                Right-click a node and choose "Send to graveyard" to remove it from the graph.
              </p>
            </div>
          )}
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: "10px 12px",
                marginBottom: 8,
                background: "#f9fafb",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>
                  {TYPE_EMOJI[item.entity_type] ?? "❓"}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "#111", wordBreak: "break-word" }}>
                    {item.display_label}
                  </div>
                  {item.label_override && (
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>
                      canonical: {item.canonical_name}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                    <span style={{ textTransform: "capitalize" }}>{item.entity_type}</span>
                    {item.archived_at && (
                      <span style={{ marginLeft: 8 }}>
                        · archived {new Date(item.archived_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {item.archive_note && (
                    <div style={{
                      marginTop: 4,
                      fontSize: 11,
                      color: "#6b7280",
                      background: "#f3f4f6",
                      borderRadius: 4,
                      padding: "3px 7px",
                      fontStyle: "italic",
                    }}>
                      "{item.archive_note}"
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleRestore(item.id)}
                  disabled={restoring === item.id}
                  title="Restore to graph"
                  style={{
                    padding: "5px 10px",
                    border: "1px solid #16a34a",
                    borderRadius: 6,
                    background: restoring === item.id ? "#dcfce7" : "#f0fdf4",
                    color: "#16a34a",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: restoring === item.id ? "wait" : "pointer",
                    flexShrink: 0,
                  }}
                >
                  {restoring === item.id ? "…" : "↩ Restore"}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div style={{
            padding: "10px 14px",
            borderTop: "1px solid #e5e7eb",
            fontSize: 12,
            color: "#9ca3af",
          }}>
            Restored nodes reappear on the next graph refresh.
          </div>
        )}
      </div>
    </>
  );
}
