import { getAuthHeader } from "./auth";

export interface ActionItemRecord {
  id: number;
  document_id: number;
  description: string;
  assignee_entity_id: number | null;
  status: "open" | "in_progress" | "closed";
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export async function listActionItems(
  status?: string
): Promise<ActionItemRecord[]> {
  const url =
    status != null
      ? `/api/action-items?status=${encodeURIComponent(status)}`
      : "/api/action-items";
  const res = await fetch(url, { headers: getAuthHeader() });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`List action items failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function updateActionItemStatus(
  id: number,
  status: "open" | "in_progress" | "closed"
): Promise<ActionItemRecord> {
  const res = await fetch(`/api/action-items/${id}/status`, {
    method: "PATCH",
    headers: {
      ...getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Update action item failed (${res.status}): ${text}`);
  }
  return res.json();
}
