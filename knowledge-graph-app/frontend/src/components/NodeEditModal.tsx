import React, { useState, useEffect } from "react";
import { GraphNode } from "../api/graph";
import { editNode, archiveNode, NodeEditRequest } from "../api/nodes";

const ENTITY_TYPES = [
  "person", "idea", "project", "keyword",
  "organization", "location", "date",
];

interface Props {
  node: GraphNode;
  onSaved: () => void;   // triggers graph reload
  onClose: () => void;
}

const INPUT: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  fontSize: 13.5,
  background: "#f9fafb",
  color: "#111",
  boxSizing: "border-box",
};

const LABEL_STYLE: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "#374151",
  marginBottom: 4,
  marginTop: 14,
};

export default function NodeEditModal({ node, onSaved, onClose }: Props) {
  const [label, setLabel]         = useState(node.label);
  const [entityType, setType]     = useState(node.type);
  const [sentimentRaw, setSent]   = useState<string>(
    node.sentiment_color === "#4AD94A" ? "0.8"
    : node.sentiment_color === "#D94A4A" ? "-0.8"
    : "0"
  );
  const [clearSent, setClearSent] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const sentVal = parseFloat(sentimentRaw);
      const body: NodeEditRequest = {};

      if (label.trim() !== node.label) {
        body.label_override = label.trim();
      }
      if (entityType !== node.type) {
        body.entity_type = entityType;
      }
      if (clearSent) {
        body.clear_sentiment = true;
      } else if (!isNaN(sentVal)) {
        const clamped = Math.max(-1, Math.min(1, sentVal));
        body.sentiment_override = clamped;
      }

      // Only call if there's something to change
      if (Object.keys(body).length > 0) {
        await editNode(node.id, body);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  // Sentiment slider display value
  const sentNum = parseFloat(sentimentRaw);
  const sentLabel = isNaN(sentNum) ? "—"
    : sentNum > 0.2 ? `Positive (${sentNum.toFixed(2)})`
    : sentNum < -0.2 ? `Negative (${sentNum.toFixed(2)})`
    : `Neutral (${sentNum.toFixed(2)})`;

  const sentColor = isNaN(sentNum) ? "#999"
    : sentNum > 0.2 ? "#16a34a"
    : sentNum < -0.2 ? "#dc2626"
    : "#6b7280";

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 9200,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: "24px 28px",
          width: 420,
          maxWidth: "95vw",
          boxShadow: "0 8px 32px rgba(0,0,0,.18)",
          fontFamily: '-apple-system,"Segoe UI",system-ui,sans-serif',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "#111" }}>
          ✏️ Edit Node
        </h2>
        <p style={{ margin: "0 0 2px", fontSize: 12, color: "#6b7280" }}>
          Canonical: <em>{node.canonical_name ?? node.label}</em>
        </p>

        {/* Display label */}
        <label style={LABEL_STYLE}>
          Display Label
          <span style={{ fontWeight: 400, color: "#9ca3af", marginLeft: 6 }}>
            (shown on graph — doesn't change internal ID)
          </span>
        </label>
        <input
          style={INPUT}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          autoFocus
        />

        {/* Entity type */}
        <label style={LABEL_STYLE}>Entity Type</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {ENTITY_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              style={{
                padding: "5px 12px",
                borderRadius: 20,
                border: `2px solid ${entityType === t ? "#3b82f6" : "#e5e7eb"}`,
                background: entityType === t ? "#eff6ff" : "#f9fafb",
                color: entityType === t ? "#1d4ed8" : "#374151",
                fontWeight: entityType === t ? 600 : 400,
                fontSize: 12,
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Sentiment */}
        <label style={LABEL_STYLE}>Sentiment Override</label>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input
            type="range"
            min="-1" max="1" step="0.05"
            value={isNaN(sentNum) ? 0 : sentNum}
            onChange={(e) => { setSent(e.target.value); setClearSent(false); }}
            style={{ flex: 1 }}
            disabled={clearSent}
          />
          <span style={{ fontSize: 12, color: sentColor, fontWeight: 600, minWidth: 130, textAlign: "right" }}>
            {clearSent ? "Use AI value" : sentLabel}
          </span>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 6, fontSize: 12, color: "#6b7280", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={clearSent}
            onChange={(e) => setClearSent(e.target.checked)}
          />
          Revert to AI-computed sentiment
        </label>

        {error && (
          <p style={{ color: "#dc2626", fontSize: 12, marginTop: 10 }}>{error}</p>
        )}

        {/* Buttons */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <button
            onClick={onClose}
            style={{ padding: "8px 18px", border: "1px solid #e5e7eb", borderRadius: 7, background: "#f9fafb", color: "#374151", fontSize: 13, cursor: "pointer" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "8px 22px",
              border: "none",
              borderRadius: 7,
              background: saving ? "#93c5fd" : "#3b82f6",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
