import React, { useEffect, useState } from "react";
import {
  listActionItems,
  updateActionItemStatus,
  ActionItemRecord,
} from "../api/action_items";

type FilterTab = "all" | "open" | "in_progress" | "closed";

const STATUS_COLORS: Record<string, string> = {
  open: "#F5A623",
  in_progress: "#4A90D9",
  closed: "#999",
};

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return d.slice(0, 10);
}

export default function ActionItemPanel() {
  const [items, setItems] = useState<ActionItemRecord[]>([]);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [collapsed, setCollapsed] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await listActionItems();
      setItems(data);
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleStatusChange(
    id: number,
    status: "open" | "in_progress" | "closed"
  ) {
    try {
      await updateActionItemStatus(id, status);
      await load();
    } catch (e: unknown) {
      setError(String(e));
    }
  }

  const openCount = items.filter((i) => i.status === "open").length;

  const filtered =
    filter === "all" ? items : items.filter((i) => i.status === filter);

  const TABS: FilterTab[] = ["all", "open", "in_progress", "closed"];

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: collapsed ? "auto" : 0,
        width: collapsed ? "auto" : "100%",
        background: "#fff",
        borderTop: "1px solid #e5e7eb",
        zIndex: 300,
        boxShadow: "0 -2px 8px rgba(0,0,0,0.06)",
      }}
    >
      {/* Toggle bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "6px 16px",
          cursor: "pointer",
          userSelect: "none",
        }}
        onClick={() => setCollapsed((v) => !v)}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: "#1f2328" }}>
          Action Items
        </span>
        {openCount > 0 && (
          <span
            style={{
              background: "#F5A623",
              color: "#fff",
              borderRadius: 10,
              padding: "1px 8px",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {openCount} open
          </span>
        )}
        <span style={{ fontSize: 12, color: "#57606a", marginLeft: "auto" }}>
          {collapsed ? "▲ Show" : "▼ Hide"}
        </span>
      </div>

      {/* Panel body */}
      {!collapsed && (
        <div style={{ maxHeight: 280, display: "flex", flexDirection: "column" }}>
          {/* Filter tabs */}
          <div
            style={{
              display: "flex",
              gap: 4,
              padding: "0 16px 8px",
              borderBottom: "1px solid #e5e7eb",
            }}
          >
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                style={{
                  padding: "3px 12px",
                  fontSize: 12,
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  cursor: "pointer",
                  background: filter === t ? "#3b82d4" : "#fff",
                  color: filter === t ? "#fff" : "#57606a",
                  fontWeight: filter === t ? 600 : 400,
                }}
              >
                {t.replace("_", " ")}
              </button>
            ))}
            <button
              onClick={load}
              style={{
                marginLeft: "auto",
                padding: "3px 10px",
                fontSize: 11,
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                cursor: "pointer",
                background: "#fff",
                color: "#57606a",
              }}
            >
              Refresh
            </button>
          </div>

          {/* Table area */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {loading && (
              <div style={{ padding: 16, fontSize: 13, color: "#57606a" }}>
                Loading…
              </div>
            )}
            {error && (
              <div style={{ padding: 16, fontSize: 13, color: "#D94A4A" }}>
                {error}
              </div>
            )}
            {!loading && !error && filtered.length === 0 && (
              <div style={{ padding: 16, fontSize: 13, color: "#aaa" }}>
                No action items.
              </div>
            )}
            {!loading && !error && filtered.length > 0 && (
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 12,
                }}
              >
                <thead>
                  <tr style={{ background: "#f7f8fa" }}>
                    <th
                      style={{
                        padding: "6px 12px",
                        textAlign: "left",
                        color: "#57606a",
                        fontWeight: 600,
                        borderBottom: "1px solid #e5e7eb",
                        width: "40%",
                      }}
                    >
                      Description
                    </th>
                    <th
                      style={{
                        padding: "6px 12px",
                        textAlign: "left",
                        color: "#57606a",
                        fontWeight: 600,
                        borderBottom: "1px solid #e5e7eb",
                      }}
                    >
                      Assignee
                    </th>
                    <th
                      style={{
                        padding: "6px 12px",
                        textAlign: "left",
                        color: "#57606a",
                        fontWeight: 600,
                        borderBottom: "1px solid #e5e7eb",
                      }}
                    >
                      Status
                    </th>
                    <th
                      style={{
                        padding: "6px 12px",
                        textAlign: "left",
                        color: "#57606a",
                        fontWeight: 600,
                        borderBottom: "1px solid #e5e7eb",
                      }}
                    >
                      Due
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr
                      key={item.id}
                      style={{ borderBottom: "1px solid #f0f0f0" }}
                    >
                      <td style={{ padding: "6px 12px", color: "#1f2328" }}>
                        {truncate(item.description, 80)}
                      </td>
                      <td style={{ padding: "6px 12px", color: "#57606a" }}>
                        {item.assignee_entity_id != null
                          ? String(item.assignee_entity_id)
                          : "—"}
                      </td>
                      <td style={{ padding: "6px 12px" }}>
                        <select
                          value={item.status}
                          onChange={(e) =>
                            handleStatusChange(
                              item.id,
                              e.target.value as "open" | "in_progress" | "closed"
                            )
                          }
                          style={{
                            fontSize: 11,
                            padding: "2px 6px",
                            borderRadius: 10,
                            border: `1.5px solid ${STATUS_COLORS[item.status] ?? "#ccc"}`,
                            background: `${STATUS_COLORS[item.status] ?? "#ccc"}22`,
                            color: STATUS_COLORS[item.status] ?? "#333",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          <option value="open">open</option>
                          <option value="in_progress">in progress</option>
                          <option value="closed">closed</option>
                        </select>
                      </td>
                      <td style={{ padding: "6px 12px", color: "#57606a" }}>
                        {formatDate(item.due_date)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
