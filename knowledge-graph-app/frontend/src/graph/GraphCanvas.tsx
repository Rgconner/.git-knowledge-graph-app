import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { GraphPayload, GraphNode, GraphEdge } from "../api/graph";

interface Props {
  data: GraphPayload;
  onNodeClick: (node: GraphNode) => void;
  onEdgeClick: (edge: GraphEdge) => void;
  resetZoomTrigger: number;
}

// D3 simulation nodes carry x/y/vx/vy added by the simulation
type SimNode = GraphNode & d3.SimulationNodeDatum;

// D3 simulation links reference nodes by object after simulation init
type SimLink = Omit<GraphEdge, "source" | "target"> & {
  source: SimNode | number;
  target: SimNode | number;
};

const WIDTH = window.innerWidth;
const HEIGHT = window.innerHeight - 44 - 64; // 44px app tab bar + 64px graph toolbar

export default function GraphCanvas({
  data,
  onNodeClick,
  onEdgeClick,
  resetZoomTrigger,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [zoomScale, setZoomScale] = useState(1);

  // Build lookup maps for current data
  const nodeMapRef = useRef<Map<number, GraphNode>>(new Map());

  useEffect(() => {
    nodeMapRef.current = new Map(data.nodes.map((n) => [n.id, n]));
  }, [data]);

  // Main D3 effect — re-runs when data changes
  useEffect(() => {
    const svg = d3.select(svgRef.current!);
    svg.selectAll("*").remove();

    const simNodes: SimNode[] = data.nodes.map((n) => ({ ...n }));
    const idToSim = new Map(simNodes.map((n) => [n.id, n]));

    const simLinks: SimLink[] = data.edges.map((e) => ({
      ...e,
      source: idToSim.get(e.source) ?? e.source,
      target: idToSim.get(e.target) ?? e.target,
    }));

    const simulation = d3
      .forceSimulation<SimNode>(simNodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(80)
      )
      .force("charge", d3.forceManyBody<SimNode>().strength(-200))
      .force("center", d3.forceCenter(WIDTH / 2, HEIGHT / 2));

    // Root zoom group
    const g = svg.append("g").attr("class", "zoom-group");

    // Zoom behaviour
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 8])
      .on("zoom", (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        g.attr("transform", event.transform.toString());
        setZoomScale(event.transform.k);
      });

    zoomRef.current = zoom;
    svg.call(zoom);

    // ── Edges ──────────────────────────────────────────────────────────────
    const edgeGroup = g.append("g").attr("class", "edges");

    const edgeLine = edgeGroup
      .selectAll<SVGLineElement, SimLink>("line.edge-visible")
      .data(simLinks)
      .enter()
      .append("line")
      .attr("class", "edge-visible")
      .attr("stroke", (d) => (d as GraphEdge).heat_color)
      .attr("stroke-width", (d) => Math.max(1, Math.min(8, (d as GraphEdge).weight)))
      .attr("stroke-opacity", 0.7);

    // Fat invisible hit targets for edge clicks
    edgeGroup
      .selectAll<SVGLineElement, SimLink>("line.edge-hit")
      .data(simLinks)
      .enter()
      .append("line")
      .attr("class", "edge-hit")
      .attr("stroke", "transparent")
      .attr("stroke-width", (d) => Math.max(1, Math.min(8, (d as GraphEdge).weight)) + 4)
      .attr("stroke-opacity", 0)
      .style("cursor", "pointer")
      .on("click", (_event, d) => {
        // Resolve to original GraphEdge id
        const edgeId = (d as SimLink).id;
        const originalEdge = data.edges.find((e) => e.id === edgeId);
        if (originalEdge) onEdgeClick(originalEdge);
      });

    // ── Nodes ──────────────────────────────────────────────────────────────
    const nodeGroup = g.append("g").attr("class", "nodes");

    // Helper: draw a double-border project node (larger circle behind)
    function appendNodeShape(
      parent: d3.Selection<SVGGElement, SimNode, SVGGElement, unknown>,
      node: SimNode
    ) {
      if (node.type === "document") {
        // Hexagon shape for document nodes
        const r = node.size;
        const hexPoints = Array.from({ length: 6 }, (_, i) => {
          const angle = (Math.PI / 3) * i - Math.PI / 6;
          return `${r * Math.cos(angle)},${r * Math.sin(angle)}`;
        }).join(" ");
        parent
          .append("polygon")
          .attr("points", hexPoints)
          .attr("fill", node.sentiment_color)
          .attr("stroke", "#555")
          .attr("stroke-width", 2);
      } else if (node.type === "action_item") {
        // Diamond = rotated rect
        const s = node.size * 1.4;
        parent
          .append("rect")
          .attr("width", s)
          .attr("height", s)
          .attr("x", -s / 2)
          .attr("y", -s / 2)
          .attr("fill", node.sentiment_color)
          .attr("stroke", "#333")
          .attr("stroke-width", 1.5)
          .attr("transform", "rotate(45)");
      } else {
        if (node.type === "project") {
          // Outer ring for double-border effect
          parent
            .append("circle")
            .attr("r", node.size + 4)
            .attr("fill", "none")
            .attr("stroke", node.sentiment_color)
            .attr("stroke-width", 2);
        }

        const circle = parent
          .append("circle")
          .attr("r", node.size)
          .attr("fill", node.sentiment_color);

        // Border by type
        if (node.type === "person") {
          circle.attr("stroke", "#000").attr("stroke-width", 2);
        } else if (node.type === "idea") {
          circle
            .attr("stroke", "#555")
            .attr("stroke-width", 1.5)
            .attr("stroke-dasharray", "4,2");
        } else if (node.type === "organization") {
          circle.attr("stroke", "#000").attr("stroke-width", 4);
        } else {
          // keyword, location, date — no border
          circle.attr("stroke-width", 0);
        }
      }
    }

    const nodeContainers = nodeGroup
      .selectAll<SVGGElement, SimNode>("g.node")
      .data(simNodes)
      .enter()
      .append("g")
      .attr("class", "node")
      .style("cursor", "pointer")
      .on("click", (_event, d) => {
        const original = nodeMapRef.current.get(d.id);
        if (original) onNodeClick(original);
      });

    nodeContainers.each(function (d) {
      appendNodeShape(d3.select(this) as d3.Selection<SVGGElement, SimNode, SVGGElement, unknown>, d);
    });

    // ── Labels ──────────────────────────────────────────────────────────────
    const labelGroup = g.append("g").attr("class", "labels");

    const labels = labelGroup
      .selectAll<SVGTextElement, SimNode>("text")
      .data(simNodes)
      .enter()
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", (d) => d.size + 12)
      .attr("font-size", 11)
      .attr("fill", "#333")
      .attr("pointer-events", "none")
      .text((d) => d.label);

    // ── Drag ──────────────────────────────────────────────────────────────
    const drag = d3
      .drag<SVGGElement, SimNode>()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    nodeContainers.call(drag);

    // ── Tick ──────────────────────────────────────────────────────────────
    simulation.on("tick", () => {
      edgeLine
        .attr("x1", (d) => (d.source as SimNode).x ?? 0)
        .attr("y1", (d) => (d.source as SimNode).y ?? 0)
        .attr("x2", (d) => (d.target as SimNode).x ?? 0)
        .attr("y2", (d) => (d.target as SimNode).y ?? 0);

      // Also update hit lines
      edgeGroup
        .selectAll<SVGLineElement, SimLink>("line.edge-hit")
        .attr("x1", (d) => (d.source as SimNode).x ?? 0)
        .attr("y1", (d) => (d.source as SimNode).y ?? 0)
        .attr("x2", (d) => (d.target as SimNode).x ?? 0)
        .attr("y2", (d) => (d.target as SimNode).y ?? 0);

      nodeContainers.attr(
        "transform",
        (d) => `translate(${d.x ?? 0},${d.y ?? 0})`
      );

      labels
        .attr("x", (d) => d.x ?? 0)
        .attr("y", (d) => d.y ?? 0);
    });

    return () => {
      simulation.stop();
    };
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hide/show labels based on zoom scale
  useEffect(() => {
    if (!svgRef.current) return;
    d3.select(svgRef.current)
      .select("g.labels")
      .attr("display", zoomScale > 0.5 ? null : "none");
  }, [zoomScale]);

  // Reset zoom when trigger increments
  useEffect(() => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current)
      .transition()
      .duration(400)
      .call(zoomRef.current.transform, d3.zoomIdentity);
  }, [resetZoomTrigger]);

  return (
    <svg
      ref={svgRef}
      style={{ width: "100%", height: "calc(100vh - 44px - 64px)", display: "block", background: "#f7f8fa" }}
    />
  );
}
