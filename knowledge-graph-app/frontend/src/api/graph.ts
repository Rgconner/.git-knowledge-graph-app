import { getAuthHeader } from "./auth";

export interface GraphNode {
  id: number;
  label: string;
  type:
    | "person"
    | "idea"
    | "project"
    | "keyword"
    | "organization"
    | "location"
    | "date"
    | "action_item"
    | "document";
  sentiment_color: string;
  size: number;
  layer: "team" | "personal";
  status?: string | null;
  // Document-view only
  document_id?: number | null;
  entity_count?: number | null;
  ai_category?: string | null;
}

export interface GraphEdge {
  id: number;
  source: number;
  target: number;
  weight: number;
  heat_score: number;
  heat_color: string;
}

export interface GraphPayload {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface WeightHintRequest {
  relationship_id: number;
  hint_weight: number | null;
  qualitative_hint: string | null;
  note: string | null;
}

export async function fetchTeamGraph(): Promise<GraphPayload> {
  const res = await fetch("/api/graph/team", { headers: getAuthHeader() });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Fetch team graph failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function fetchPersonalGraph(): Promise<GraphPayload> {
  const res = await fetch("/api/graph/personal", { headers: getAuthHeader() });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Fetch personal graph failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function fetchDocumentGraph(): Promise<GraphPayload> {
  const res = await fetch("/api/graph/documents", { headers: getAuthHeader() });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Fetch document graph failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function submitWeightHint(
  hint: WeightHintRequest
): Promise<{ status: string; hint_id: number }> {
  const res = await fetch("/api/graph/hints", {
    method: "POST",
    headers: { ...getAuthHeader(), "Content-Type": "application/json" },
    body: JSON.stringify(hint),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Submit weight hint failed (${res.status}): ${text}`);
  }
  return res.json();
}
