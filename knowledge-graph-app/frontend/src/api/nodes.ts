import { getAuthHeader } from "./auth";

export interface NodeResponse {
  id: number;
  canonical_name: string;
  label_override: string | null;
  display_label: string;
  entity_type: string;
  archived: boolean;
  archived_at: string | null;
  archive_note: string | null;
  sentiment_override: number | null;
  sentiment_color: string;
}

export interface NodeEditRequest {
  label_override?: string;
  entity_type?: string;
  sentiment_override?: number;
  clear_label?: boolean;
  clear_sentiment?: boolean;
}

export interface ArchiveRequest {
  note?: string;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { detail?: string }).detail ?? `Request failed (${res.status})`
    );
  }
  return res.json() as Promise<T>;
}

export const editNode = (id: number, body: NodeEditRequest) =>
  apiFetch<NodeResponse>(`/api/nodes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

export const archiveNode = (id: number, body: ArchiveRequest = {}) =>
  apiFetch<NodeResponse>(`/api/nodes/${id}`, {
    method: "DELETE",
    body: JSON.stringify(body),
  });

export const getGraveyard = () =>
  apiFetch<NodeResponse[]>("/api/nodes/graveyard");

export const restoreNode = (id: number) =>
  apiFetch<NodeResponse>(`/api/nodes/${id}/restore`, { method: "POST" });
