import { getAuthHeader } from "./auth";

// ---------------------------------------------------------------------------
// Types mirroring backend schemas
// ---------------------------------------------------------------------------

export type WatchSourceType = "filesystem" | "github";
export type WatchedFileStatus = "pending" | "approved" | "rejected" | "ingesting" | "failed";

export interface WatchSource {
  id: number;
  owner_user_id: number;
  name: string;
  source_type: WatchSourceType;
  fs_path?: string;
  file_glob?: string;
  github_repo?: string;
  github_branch?: string;
  github_path?: string;
  enabled: boolean;
  last_scanned_at?: string;
  created_at: string;
  updated_at: string;
}

export interface WatchSourceCreate {
  name: string;
  source_type: WatchSourceType;
  fs_path?: string;
  file_glob?: string;
  github_repo?: string;
  github_branch?: string;
  github_path?: string;
  github_token?: string;
  enabled?: boolean;
}

export interface WatchSourceUpdate {
  name?: string;
  fs_path?: string;
  file_glob?: string;
  github_repo?: string;
  github_branch?: string;
  github_path?: string;
  github_token?: string;
  enabled?: boolean;
}

export interface WatchedFile {
  id: number;
  source_id: number;
  file_key: string;
  filename: string;
  relative_path?: string;
  file_size_bytes?: number;
  status: WatchedFileStatus;
  document_id?: number;
  review_note?: string;
  discovered_at: string;
  reviewed_at?: string;
}

export interface WatchedFileReview {
  status: "approved" | "rejected";
  review_note?: string;
}

export interface ScanResult {
  source_id: number;
  new_files_found: number;
  already_known: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

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
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Watch Sources
// ---------------------------------------------------------------------------

export const listSources = () =>
  apiFetch<WatchSource[]>("/api/watch/sources");

export const createSource = (body: WatchSourceCreate) =>
  apiFetch<WatchSource>("/api/watch/sources", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const updateSource = (id: number, body: WatchSourceUpdate) =>
  apiFetch<WatchSource>(`/api/watch/sources/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

export const deleteSource = (id: number) =>
  apiFetch<void>(`/api/watch/sources/${id}`, { method: "DELETE" });

export const triggerScan = (id: number) =>
  apiFetch<ScanResult>(`/api/watch/sources/${id}/scan`, { method: "POST" });

// ---------------------------------------------------------------------------
// Watched Files
// ---------------------------------------------------------------------------

export const listWatchedFiles = (params?: {
  source_id?: number;
  status?: WatchedFileStatus;
}) => {
  const qs = new URLSearchParams();
  if (params?.source_id != null) qs.set("source_id", String(params.source_id));
  if (params?.status) qs.set("status", params.status);
  const query = qs.toString() ? `?${qs}` : "";
  return apiFetch<WatchedFile[]>(`/api/watch/files${query}`);
};

export const reviewFile = (id: number, body: WatchedFileReview) =>
  apiFetch<WatchedFile>(`/api/watch/files/${id}/review`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

export const reingestFile = (id: number) =>
  apiFetch<WatchedFile>(`/api/watch/files/${id}/reingest`, { method: "POST" });
