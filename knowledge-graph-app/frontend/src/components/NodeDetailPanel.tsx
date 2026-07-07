import React from "react";
import { GraphNode, GraphEdge, GraphPayload } from "../api/graph";

interface Props {
  node: GraphNode | null;
  graphData: GraphPayload;
  onClose: () => void;
}

function statusLabel(status?: string | null): string {
  if (!status) return "";
  return status.replace("_", " ");
}

function statusColor(status?: string | null): string {
  if (status === "open") return "#F5A623";
  if (status === "in_progress") return "#4A90D9";
  if (status === "closed") return "#999";
  return "#ccc";
}

export default function NodeDetailPanel({ node, graphData, onClose }: Props) {
  const visible = node !== null;

  const connectedEdges: Array<{ edge: GraphEdge; otherNode: GraphNode }> =
    React.useMemo(() => {
      if (!node) return [];
      return graphData.edges
        .filter((e) => e.source === node.id || e.target === node.id)
        .map((e) => {
          const otherId = e.source === node.id ? e.target : e.source;
          const other = graphData.nodes.find((n) => n.id === otherId);
          return other ? { edge: e, otherNode: other } : null;
        })
        .filter((x): x is { edge: GraphEdge; otherNode: GraphNode } => x !== null)
        .sort((a, b) => b.edge.weight - a.edge.weight)
        .slice(0, 5);
    }, [node, graphData]);

  return (
    <div
      style={{
        position: "fixed",
        top: "calc(44px + 64px)",
        right: 0,
        width: 320,
        height: "calc(100vh - 44px - 64px)",
        background: "#fff",
        borderLeft: "1px solid #e5e7eb",
        boxShadow: "-2px 0 8px rgba(0,0,0,0.08)",
        transform: visible ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.25s ease",
        display: "flex",
        flexDirection: "column",
        zIndex: 200,
        overflowY: "auto",
      }}
    >
      {node && (
        <>
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 16px 8px",
              borderBottom: "1px solid #e5e7eb",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              {/* Sentiment color swatch */}
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 3,
                  background: node.sentiment_color,
                  flexShrink: 0,
                  border: "1px solid #e5e7eb",
                }}
              />
              <span
                style={{
                  fontWeight: 700,
                  fontSize: 16,
                  color: "#1f2328",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {node.label}
              </span>
            </div>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "1px solid #e5e7eb",
                borderRadius: 4,
                padding: "2px 10px",
                cursor: "pointer",
                fontSize: 13,
                color: "#57606a",
                flexShrink: 0,
              }}
            >
              Close
            </button>
          </div>

          {/* Badges */}
          <div style={{ padding: "12px 16px 8px", display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span
              style={{
                background: "#f7f8fa",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: "2px 10px",
                fontSize: 12,
                color: "#57606a",
              }}
            >
              {node.type.replace("_", " ")}
            </span>
            <span
              style={{
                background: "#f7f8fa",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: "2px 10px",
                fontSize: 12,
                color: "#57606a",
              }}
            >
              {node.layer}
            </span>
            {node.type === "action_item" && node.status && (
              <span
                style={{
                  background: statusColor(node.status),
                  borderRadius: 12,
                  padding: "2px 10px",
                  fontSize: 12,
                  color: "#fff",
                  fontWeight: 600,
                }}
              >
                {statusLabel(node.status)}
              </span>
            )}
          </div>

          {/* Top connections */}
          <div style={{ padding: "8px 16px 0" }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#57606a",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: 8,
              }}
            >
              Top Connections
            </div>
            {connectedEdges.length === 0 && (
              <div style={{ fontSize: 13, color: "#aaa" }}>No connections.</div>
            )}
            {connectedEdges.map(({ edge, otherNode }) => (
              <div
                key={edge.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 0",
                  borderBottom: "1px solid #f0f0f0",
                }}
              >
                {/* Heat color swatch */}
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    background: edge.heat_color,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    flex: 1,
                    fontSize: 13,
                    color: "#1f2328",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {otherNode.label}
                </span>
                <span style={{ fontSize: 11, color: "#57606a", flexShrink: 0 }}>
                  w: {edge.weight.toFixed(2)}
                </span>
                <span style={{ fontSize: 11, color: "#57606a", flexShrink: 0 }}>
                  h: {edge.heat_score.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
