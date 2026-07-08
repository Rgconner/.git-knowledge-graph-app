import React from "react";

export type ViewMode = "team" | "personal" | "documents";

interface Props {
  layer: "team" | "personal";
  viewMode: ViewMode;
  onLayerChange: (layer: "team" | "personal") => void;
  onViewModeChange: (mode: ViewMode) => void;
  onResetZoom: () => void;
}

const LEGEND_ITEMS = [
  { label: "Thickness = strength", swatch: null, description: "Edge width maps connection weight (1–8px)" },
  { label: "Color = heat", swatch: "linear-gradient(to right, #4A90D9, #D94A4A)", description: "Blue (cold) → Red (hot)" },
  { label: "Node color = sentiment", swatch: "linear-gradient(to right, #D94A4A, #999999, #4AD94A)", description: "Red (negative) → Grey → Green (positive)" },
];

const SHAPE_LEGEND_ENTITY = [
  { shape: "circle", stroke: "2px solid #000", dash: false, label: "Person" },
  { shape: "circle", stroke: "1.5px dashed #555", dash: true, label: "Idea" },
  { shape: "circle-double", stroke: "2px solid", dash: false, label: "Project" },
  { shape: "diamond", stroke: "1px solid #333", dash: false, label: "Action Item" },
  { shape: "circle", stroke: "4px solid #000", dash: false, label: "Organization" },
  { shape: "circle", stroke: "none", dash: false, label: "Keyword / Location / Date" },
];

const SHAPE_LEGEND_DOCUMENT = [
  { shape: "hexagon", label: "Document" },
];

export default function GraphToolbar({ layer, viewMode, onLayerChange, onViewModeChange, onResetZoom }: Props) {
  return (
    <div
      style={{
        height: 64,
        background: "#fff",
        borderBottom: "1px solid #e5e7eb",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "0 16px",
        position: "relative",
        zIndex: 100,
        flexWrap: "nowrap",
        overflow: "visible",
      }}
    >
      {/* View mode toggle */}
      <div
        style={{
          display: "flex",
          border: "1px solid #e5e7eb",
          borderRadius: 6,
          overflow: "hidden",
        }}
      >
        {(["team", "personal", "documents"] as const).map((m) => (
          <button
            key={m}
            onClick={() => m === "documents" ? onViewModeChange("documents") : (onViewModeChange(m), onLayerChange(m))}
            style={{
              padding: "5px 14px",
              fontSize: 13,
              fontWeight: viewMode === m ? 600 : 400,
              background: viewMode === m ? "#3b82d4" : "#fff",
              color: viewMode === m ? "#fff" : "#57606a",
              border: "none",
              cursor: "pointer",
              outline: "none",
            }}
          >
            {m === "team" ? "Team Graph" : m === "personal" ? "Personal Graph" : "📄 Documents"}
          </button>
        ))}
      </div>

      {/* Reset zoom */}
      <button
        onClick={onResetZoom}
        style={{
          padding: "5px 12px",
          fontSize: 13,
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 6,
          cursor: "pointer",
          color: "#57606a",
        }}
      >
        Reset Zoom
      </button>

      {/* Divider */}
      <div style={{ width: 1, height: 32, background: "#e5e7eb" }} />

      {/* Gradient legends */}
      {LEGEND_ITEMS.map((item) => (
        <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {item.swatch ? (
            <div
              style={{
                width: 36,
                height: 8,
                borderRadius: 4,
                background: item.swatch,
                border: "1px solid #e5e7eb",
              }}
            />
          ) : (
            <div style={{ width: 36, height: 4, background: "#888", borderRadius: 2 }} />
          )}
          <span style={{ fontSize: 11, color: "#57606a", whiteSpace: "nowrap" }}>
            {item.label}
          </span>
        </div>
      ))}

      {/* Divider */}
      <div style={{ width: 1, height: 32, background: "#e5e7eb" }} />

      {/* Shape legend — changes based on view mode */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {viewMode === "documents" ? (
          // Document view legend
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <svg width={14} height={14} viewBox="0 0 14 14">
              <polygon points="7,1 13,4.5 13,9.5 7,13 1,9.5 1,4.5" fill="#ccc" stroke="#555" strokeWidth={1} />
            </svg>
            <span style={{ fontSize: 10, color: "#57606a", whiteSpace: "nowrap" }}>Document</span>
          </div>
        ) : (
          SHAPE_LEGEND_ENTITY.map((s) => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {s.shape === "diamond" ? (
                <svg width={14} height={14} viewBox="0 0 14 14">
                  <rect
                    x={2}
                    y={2}
                    width={10}
                    height={10}
                    transform="rotate(45 7 7)"
                    fill="#ccc"
                    stroke="#333"
                    strokeWidth={1}
                  />
                </svg>
              ) : s.shape === "circle-double" ? (
                <svg width={14} height={14} viewBox="0 0 14 14">
                  <circle cx={7} cy={7} r={6} fill="none" stroke="#888" strokeWidth={1} />
                  <circle cx={7} cy={7} r={4} fill="#ccc" stroke="#888" strokeWidth={1} />
                </svg>
              ) : (
                <svg width={14} height={14} viewBox="0 0 14 14">
                  <circle
                    cx={7}
                    cy={7}
                    r={5}
                    fill="#ccc"
                    stroke={s.stroke === "none" ? "none" : "#555"}
                    strokeWidth={s.stroke.includes("4px") ? 3 : s.stroke === "none" ? 0 : 1.5}
                    strokeDasharray={s.dash ? "3,2" : undefined}
                  />
                </svg>
              )}
              <span style={{ fontSize: 10, color: "#57606a", whiteSpace: "nowrap" }}>
                {s.label}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
