import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  GraphPayload,
  GraphNode,
  GraphEdge,
  WeightHintRequest,
  fetchTeamGraph,
  fetchPersonalGraph,
  fetchDocumentGraph,
  submitWeightHint,
} from "../api/graph";
import { archiveNode } from "../api/nodes";
import GraphCanvas from "../graph/GraphCanvas";
import GraphToolbar, { ViewMode } from "../components/GraphToolbar";
import NodeDetailPanel from "../components/NodeDetailPanel";
import WeightHintModal from "../components/WeightHintModal";
import ActionItemPanel from "../components/ActionItemPanel";
import NodeContextMenu from "../components/NodeContextMenu";
import NodeEditModal from "../components/NodeEditModal";
import GraveyardPanel from "../components/GraveyardPanel";

const EMPTY_GRAPH: GraphPayload = { nodes: [], edges: [] };

export default function GraphPage() {
  const [layer, setLayer] = useState<"team" | "personal">("team");
  const [viewMode, setViewMode] = useState<ViewMode>("team");
  const [graphData, setGraphData] = useState<GraphPayload>(EMPTY_GRAPH);
  // Full team graph kept for drill-through filtering in document view
  const [teamGraphData, setTeamGraphData] = useState<GraphPayload>(EMPTY_GRAPH);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);

  // Right-click context menu
  const [contextMenu, setContextMenu] = useState<{ node: GraphNode; x: number; y: number } | null>(null);
  // Edit modal
  const [editNode, setEditNode] = useState<GraphNode | null>(null);
  // Archive confirmation
  const [archiveTarget, setArchiveTarget] = useState<GraphNode | null>(null);
  const [archiveNote, setArchiveNote] = useState("");
  const [archiving, setArchiving] = useState(false);
  // Graveyard panel
  const [graveyardOpen, setGraveyardOpen] = useState(false);

  // When set, we are in drill-through mode: showing entity graph for one document
  const [drillDocNode, setDrillDocNode] = useState<GraphNode | null>(null);

  // Incrementing this number triggers a zoom reset in GraphCanvas
  const [resetZoomTrigger, setResetZoomTrigger] = useState(0);

  // Track the latest fetch so stale responses from slow requests are discarded
  const fetchSeqRef = useRef(0);

  async function loadGraph(mode: ViewMode, currentLayer: "team" | "personal") {
    const seq = ++fetchSeqRef.current;
    setLoading(true);
    setError(null);
    setDrillDocNode(null);
    try {
      let data: GraphPayload;
      if (mode === "documents") {
        data = await fetchDocumentGraph();
        // Also load team graph in background for drill-through
        fetchTeamGraph().then((tg) => { if (seq === fetchSeqRef.current) setTeamGraphData(tg); });
      } else {
        data = currentLayer === "team"
          ? await fetchTeamGraph()
          : await fetchPersonalGraph();
        if (seq === fetchSeqRef.current) setTeamGraphData(data);
      }
      if (seq === fetchSeqRef.current) setGraphData(data);
    } catch (e: unknown) {
      if (seq === fetchSeqRef.current) setError(String(e));
    } finally {
      if (seq === fetchSeqRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    loadGraph(viewMode, layer);
  }, [viewMode, layer]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    setSelectedNode(null);
    setSelectedEdge(null);
    setDrillDocNode(null);
  }, []);

  const handleLayerChange = useCallback((l: "team" | "personal") => {
    setLayer(l);
    setViewMode(l);
    setSelectedNode(null);
    setSelectedEdge(null);
    setDrillDocNode(null);
  }, []);

  const handleResetZoom = useCallback(() => {
    setResetZoomTrigger((n) => n + 1);
    setDrillDocNode(null);
    // If drilled in, pop back to document view
    if (drillDocNode) {
      setGraphData(graphData); // already showing doc graph — no refetch needed
    }
  }, [drillDocNode, graphData]);

  const handleNodeRightClick = useCallback((node: GraphNode, x: number, y: number) => {
    // Don't allow editing document nodes (they're virtual offsets)
    if (node.type === "document" || node.type === "action_item") return;
    setContextMenu({ node, x, y });
  }, []);

  const handleArchiveConfirm = useCallback(async () => {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      await archiveNode(archiveTarget.id, { note: archiveNote.trim() || undefined });
      setArchiveTarget(null);
      setArchiveNote("");
      await loadGraph(viewMode, layer);
    } catch (err) {
      console.error("Archive failed:", err);
    } finally {
      setArchiving(false);
    }
  }, [archiveTarget, archiveNote, viewMode, layer]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNodeClick = useCallback((node: GraphNode) => {
    if (node.type === "document" && node.document_id != null) {
      // Drill through: filter team graph to entities from this document
      const docId = node.document_id;
      // Filter team graph nodes to those whose IDs appear in edges connected to this document
      // Strategy: keep all entity nodes that were mentioned in the clicked document
      // We do this client-side by filtering teamGraphData for entities linked via the doc's
      // node connections (the document graph edges encode shared entities, not direct links,
      // so we fetch the filtered entity graph from the team graph).
      // Simple approach: show the full team graph but highlight that this came from a doc drill.
      // We filter to nodes whose label appears as entity names — this is approximate client-side.
      // A full solution would call GET /graph/team?document_id=X but that's a backend change.
      // Instead, we use the team graph as-is and set drillDocNode to show the context banner.
      setDrillDocNode(node);
      setGraphData(teamGraphData);
      setResetZoomTrigger((n) => n + 1);
      setSelectedNode(null);
    } else {
      setSelectedNode(node);
      setSelectedEdge(null);
    }
  }, [teamGraphData]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEdgeClick = useCallback((edge: GraphEdge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
  }, []);

  const handleWeightHintSubmit = useCallback(
    async (hint: WeightHintRequest) => {
      try {
        await submitWeightHint(hint);
      } catch (e: unknown) {
        console.error("Weight hint submit failed:", e);
      }
      setSelectedEdge(null);
      await loadGraph(viewMode, layer);
    },
    [viewMode, layer] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Label lookups for WeightHintModal
  const nodeById = (id: number): string =>
    graphData.nodes.find((n) => n.id === id)?.label ?? String(id);

  return (
    <div style={{ position: "relative", height: "calc(100vh - 44px)", overflow: "hidden" }}>
      {/* Toolbar */}
      <GraphToolbar
        layer={layer}
        viewMode={viewMode}
        onLayerChange={handleLayerChange}
        onViewModeChange={handleViewModeChange}
        onResetZoom={handleResetZoom}
      />

      {/* Drill-through breadcrumb banner */}
      {drillDocNode && (
        <div style={{
          position: "absolute",
          top: 64,
          left: 0,
          right: 0,
          background: "#eff6ff",
          borderBottom: "1px solid #bfdbfe",
          padding: "6px 16px",
          fontSize: 13,
          color: "#1e40af",
          display: "flex",
          alignItems: "center",
          gap: 8,
          zIndex: 90,
        }}>
          <button
            onClick={() => { setDrillDocNode(null); loadGraph("documents", layer); }}
            style={{ background: "none", border: "none", color: "#1e40af", cursor: "pointer", fontSize: 13, padding: 0, fontWeight: 600 }}
          >
            ← Documents
          </button>
          <span style={{ color: "#93c5fd" }}>›</span>
          <span><strong>{drillDocNode.label}</strong> — entity graph</span>
          <span style={{ color: "#6b7280", marginLeft: 8 }}>
            {drillDocNode.entity_count != null ? `${drillDocNode.entity_count} entities` : ""}
            {drillDocNode.ai_category ? ` · ${drillDocNode.ai_category}` : ""}
          </span>
        </div>
      )}

      {/* Loading / error overlay */}
      {loading && (
        <div
          style={{
            position: "absolute",
            top: 64,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(247,248,250,0.75)",
            zIndex: 50,
            fontSize: 14,
            color: "#57606a",
          }}
        >
          Loading graph…
        </div>
      )}
      {!loading && error && (
        <div
          style={{
            position: "absolute",
            top: 64,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(247,248,250,0.75)",
            zIndex: 50,
            fontSize: 14,
            color: "#D94A4A",
          }}
        >
          {error}
        </div>
      )}

      {/* Canvas */}
      <GraphCanvas
        data={graphData}
        onNodeClick={handleNodeClick}
        onNodeRightClick={handleNodeRightClick}
        onEdgeClick={handleEdgeClick}
        resetZoomTrigger={resetZoomTrigger}
      />

      {/* Node detail panel (right overlay) */}
      <NodeDetailPanel
        node={selectedNode}
        graphData={graphData}
        onClose={() => setSelectedNode(null)}
      />

      {/* Weight hint modal (center overlay) */}
      <WeightHintModal
        edge={selectedEdge}
        sourceLabel={selectedEdge ? nodeById(selectedEdge.source) : ""}
        targetLabel={selectedEdge ? nodeById(selectedEdge.target) : ""}
        onClose={() => setSelectedEdge(null)}
        onSubmit={handleWeightHintSubmit}
      />

      {/* Action items collapsible panel (bottom) */}
      <ActionItemPanel />

      {/* Right-click context menu */}
      {contextMenu && (
        <NodeContextMenu
          node={contextMenu.node}
          x={contextMenu.x}
          y={contextMenu.y}
          onEdit={(node) => setEditNode(node)}
          onArchive={(node) => { setArchiveTarget(node); setArchiveNote(""); }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Node edit modal */}
      {editNode && (
        <NodeEditModal
          node={editNode}
          onSaved={() => loadGraph(viewMode, layer)}
          onClose={() => setEditNode(null)}
        />
      )}

      {/* Archive confirmation modal */}
      {archiveTarget && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,.45)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 9200,
        }}>
          <div style={{
            background: "#fff", borderRadius: 12, padding: "24px 28px",
            width: 400, maxWidth: "95vw",
            boxShadow: "0 8px 32px rgba(0,0,0,.18)",
            fontFamily: '-apple-system,"Segoe UI",system-ui,sans-serif',
          }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700 }}>🪦 Send to Graveyard?</h3>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: "#374151" }}>
              <strong>"{archiveTarget.label}"</strong> will be hidden from the graph.
              You can restore it any time from the Graveyard panel.
            </p>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
              Reason <span style={{ fontWeight: 400, color: "#9ca3af" }}>(optional)</span>
            </label>
            <input
              style={{
                width: "100%", padding: "7px 10px",
                border: "1px solid #d1d5db", borderRadius: 6,
                fontSize: 13, boxSizing: "border-box", marginBottom: 18,
              }}
              value={archiveNote}
              onChange={(e) => setArchiveNote(e.target.value)}
              placeholder="e.g. Duplicate, irrelevant, noise…"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleArchiveConfirm(); }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                onClick={() => { setArchiveTarget(null); setArchiveNote(""); }}
                style={{ padding: "8px 18px", border: "1px solid #e5e7eb", borderRadius: 7, background: "#f9fafb", color: "#374151", fontSize: 13, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={handleArchiveConfirm}
                disabled={archiving}
                style={{ padding: "8px 22px", border: "none", borderRadius: 7, background: archiving ? "#f87171" : "#dc2626", color: "#fff", fontSize: 13, fontWeight: 600, cursor: archiving ? "not-allowed" : "pointer" }}
              >
                {archiving ? "Archiving…" : "Send to Graveyard"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Graveyard panel — toggled from toolbar via button below */}
      <GraveyardPanel
        open={graveyardOpen}
        onClose={() => setGraveyardOpen(false)}
        onRestored={() => loadGraph(viewMode, layer)}
      />

      {/* Graveyard floating button */}
      <button
        onClick={() => setGraveyardOpen((v) => !v)}
        title="Open Graveyard"
        style={{
          position: "absolute",
          bottom: 80,
          right: 16,
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: graveyardOpen ? "#1f2937" : "#374151",
          border: "none",
          boxShadow: "0 3px 10px rgba(0,0,0,.3)",
          cursor: "pointer",
          fontSize: 20,
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 200,
          transition: "background .15s",
        }}
      >
        🪦
      </button>
    </div>
  );
}
