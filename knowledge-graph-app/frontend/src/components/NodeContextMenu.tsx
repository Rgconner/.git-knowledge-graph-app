import React, { useEffect, useRef } from "react";
import { GraphNode } from "../api/graph";

export interface ContextMenuAction {
  label: string;
  icon: string;
  danger?: boolean;
  onClick: () => void;
}

interface Props {
  node: GraphNode;
  x: number;  // screen px
  y: number;
  onEdit: (node: GraphNode) => void;
  onArchive: (node: GraphNode) => void;
  onClose: () => void;
}

export default function NodeContextMenu({ node, x, y, onEdit, onArchive, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape
  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("mousedown", down);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("mousedown", down);
      window.removeEventListener("keydown", key);
    };
  }, [onClose]);

  // Keep menu inside viewport
  const menuW = 200;
  const menuH = 140;
  const left = Math.min(x, window.innerWidth - menuW - 8);
  const top  = Math.min(y, window.innerHeight - menuH - 8);

  const actions: ContextMenuAction[] = [
    { label: "Edit label / type / sentiment", icon: "✏️", onClick: () => { onClose(); onEdit(node); } },
    { label: "Send to graveyard",             icon: "🪦", danger: true, onClick: () => { onClose(); onArchive(node); } },
  ];

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        left,
        top,
        zIndex: 9500,
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        boxShadow: "0 8px 24px rgba(0,0,0,.18)",
        minWidth: menuW,
        padding: "4px 0",
        fontFamily: '-apple-system,"Segoe UI",system-ui,sans-serif',
        fontSize: 13,
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Header */}
      <div style={{
        padding: "6px 14px 6px",
        borderBottom: "1px solid #f3f4f6",
        marginBottom: 3,
      }}>
        <div style={{ fontWeight: 700, color: "#111", fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 172 }}>
          {node.label}
        </div>
        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>
          {node.type}
        </div>
      </div>

      {/* Actions */}
      {actions.map((a) => (
        <button
          key={a.label}
          onClick={a.onClick}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            width: "100%",
            padding: "7px 14px",
            background: "none",
            border: "none",
            textAlign: "left",
            fontSize: 13,
            color: a.danger ? "#dc2626" : "#374151",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = a.danger ? "#fee2e2" : "#f3f4f6")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
        >
          <span style={{ fontSize: 15 }}>{a.icon}</span>
          {a.label}
        </button>
      ))}
    </div>
  );
}
