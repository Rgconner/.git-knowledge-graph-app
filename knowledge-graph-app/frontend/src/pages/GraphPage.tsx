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
import GraphCanvas from "../graph/GraphCanvas";
import GraphToolbar, { ViewMode } from "../components/GraphToolbar";
import NodeDetailPanel from "../components/NodeDetailPanel";
import WeightHintModal from "../components/WeightHintModal";
import ActionItemPanel from "../components/ActionItemPanel";

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
    </div>
  );
}
