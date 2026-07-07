import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  GraphPayload,
  GraphNode,
  GraphEdge,
  WeightHintRequest,
  fetchTeamGraph,
  fetchPersonalGraph,
  submitWeightHint,
} from "../api/graph";
import GraphCanvas from "../graph/GraphCanvas";
import GraphToolbar from "../components/GraphToolbar";
import NodeDetailPanel from "../components/NodeDetailPanel";
import WeightHintModal from "../components/WeightHintModal";
import ActionItemPanel from "../components/ActionItemPanel";

const EMPTY_GRAPH: GraphPayload = { nodes: [], edges: [] };

export default function GraphPage() {
  const [layer, setLayer] = useState<"team" | "personal">("team");
  const [graphData, setGraphData] = useState<GraphPayload>(EMPTY_GRAPH);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);

  // Incrementing this number triggers a zoom reset in GraphCanvas
  const [resetZoomTrigger, setResetZoomTrigger] = useState(0);

  // Track the latest fetch so stale responses from slow requests are discarded
  const fetchSeqRef = useRef(0);

  async function loadGraph(currentLayer: "team" | "personal") {
    const seq = ++fetchSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      const data =
        currentLayer === "team"
          ? await fetchTeamGraph()
          : await fetchPersonalGraph();
      if (seq === fetchSeqRef.current) {
        setGraphData(data);
      }
    } catch (e: unknown) {
      if (seq === fetchSeqRef.current) {
        setError(String(e));
      }
    } finally {
      if (seq === fetchSeqRef.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    loadGraph(layer);
  }, [layer]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLayerChange = useCallback((l: "team" | "personal") => {
    setLayer(l);
    setSelectedNode(null);
    setSelectedEdge(null);
  }, []);

  const handleResetZoom = useCallback(() => {
    setResetZoomTrigger((n) => n + 1);
  }, []);

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node);
    setSelectedEdge(null);
  }, []);

  const handleEdgeClick = useCallback((edge: GraphEdge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
  }, []);

  const handleWeightHintSubmit = useCallback(
    async (hint: WeightHintRequest) => {
      try {
        await submitWeightHint(hint);
      } catch (e: unknown) {
        // Non-fatal — graph reload will still happen
        console.error("Weight hint submit failed:", e);
      }
      setSelectedEdge(null);
      await loadGraph(layer);
    },
    [layer] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Label lookups for WeightHintModal
  const nodeById = (id: number): string =>
    graphData.nodes.find((n) => n.id === id)?.label ?? String(id);

  return (
    <div style={{ position: "relative", height: "calc(100vh - 44px)", overflow: "hidden" }}>
      {/* Toolbar */}
      <GraphToolbar
        layer={layer}
        onLayerChange={handleLayerChange}
        onResetZoom={handleResetZoom}
      />

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
