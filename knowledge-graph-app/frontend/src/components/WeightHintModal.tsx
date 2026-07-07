import React, { useState } from "react";
import { GraphEdge, WeightHintRequest } from "../api/graph";

interface Props {
  edge: GraphEdge | null;
  sourceLabel: string;
  targetLabel: string;
  onClose: () => void;
  onSubmit: (hint: WeightHintRequest) => void;
}

export default function WeightHintModal({
  edge,
  sourceLabel,
  targetLabel,
  onClose,
  onSubmit,
}: Props) {
  const [multiplier, setMultiplier] = useState<number | null>(null);
  const [comment, setComment] = useState("");

  if (!edge) return null;

  const canSubmit = multiplier !== null || comment.trim().length > 0;

  function handleSubmit() {
    if (!edge || !canSubmit) return;
    onSubmit({
      relationship_id: edge.id,
      hint_weight: multiplier,
      qualitative_hint: comment.trim() || null,
      note: null,
    });
    onClose();
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        zIndex: 400,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 8,
          border: "1px solid #e5e7eb",
          width: 440,
          maxWidth: "90vw",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* Title */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: "#1f2328" }}>
            Weight Hint
          </span>
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
            }}
          >
            Cancel
          </button>
        </div>

        {/* Edge label */}
        <div
          style={{
            fontSize: 13,
            color: "#57606a",
            background: "#f7f8fa",
            borderRadius: 6,
            padding: "8px 12px",
            border: "1px solid #e5e7eb",
          }}
        >
          <strong style={{ color: "#1f2328" }}>{sourceLabel}</strong>
          {" ↔ "}
          <strong style={{ color: "#1f2328" }}>{targetLabel}</strong>
          <span style={{ marginLeft: 12, fontSize: 11, color: "#aaa" }}>
            current weight: {edge.weight.toFixed(2)}
          </span>
        </div>

        {/* Multiplier slider */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#1f2328" }}>
            Weight multiplier (applies directly)
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="range"
              min={0.1}
              max={3.0}
              step={0.1}
              value={multiplier ?? 1}
              onChange={(e) => setMultiplier(parseFloat(e.target.value))}
              style={{ flex: 1 }}
            />
            <span
              style={{
                minWidth: 36,
                textAlign: "right",
                fontSize: 14,
                fontWeight: 600,
                color: "#3b82d4",
              }}
            >
              {multiplier !== null ? multiplier.toFixed(1) : "—"}
            </span>
            {multiplier !== null && (
              <button
                onClick={() => setMultiplier(null)}
                style={{
                  fontSize: 11,
                  color: "#57606a",
                  background: "none",
                  border: "1px solid #e5e7eb",
                  borderRadius: 4,
                  padding: "1px 6px",
                  cursor: "pointer",
                }}
              >
                Clear
              </button>
            )}
          </div>
          <span style={{ fontSize: 11, color: "#aaa" }}>
            Drag to set a numeric multiplier (0.1 = much less important, 3.0 = much more important)
          </span>
        </div>

        {/* Qualitative comment */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#1f2328" }}>
            Qualitative comment
          </label>
          <textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="e.g. This relationship is more important than the data suggests"
            style={{
              resize: "vertical",
              padding: "8px 10px",
              fontSize: 13,
              border: "1px solid #e5e7eb",
              borderRadius: 6,
              color: "#1f2328",
              fontFamily: "inherit",
              outline: "none",
            }}
          />
          <span style={{ fontSize: 11, color: "#aaa" }}>
            Passed as natural language context to the AI re-score.
          </span>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={{
            padding: "9px 0",
            fontSize: 14,
            fontWeight: 600,
            background: canSubmit ? "#3b82d4" : "#ccc",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: canSubmit ? "pointer" : "not-allowed",
          }}
        >
          Submit Hint
        </button>
      </div>
    </div>
  );
}
