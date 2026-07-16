import { getAuthHeader } from "./auth";

export interface DuplicateMatch {
  document_id: number;
  filename: string;
  similarity: number; // 0.0–1.0
}

export interface DuplicateCheckResponse {
  has_duplicates: boolean;
  matches: DuplicateMatch[];
}

export interface DocumentRecord {
  id: number;
  uploader_user_id: number;
  filename: string;              // AI-generated descriptive name (after pipeline)
  original_filename: string | null;  // user-supplied name at upload time
  file_type: string;
  created_at: string;
  processed_at: string | null;
  ai_category: string | null;
}

export interface DocumentDetailRecord extends DocumentRecord {
  raw_text: string;
}

export async function uploadDocument(
  file: File,
  overrideName?: string
): Promise<DocumentRecord> {
  const form = new FormData();
  // If a rename was provided, create a new File with the override name so
  // the multipart field carries the correct filename to the server.
  const uploadFile =
    overrideName && overrideName.trim() && overrideName !== file.name
      ? new File([file], overrideName.trim(), { type: file.type })
      : file;
  form.append("file", uploadFile);
  const res = await fetch("/api/documents/upload", {
    method: "POST",
    headers: getAuthHeader(),
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function listDocuments(): Promise<DocumentRecord[]> {
  const res = await fetch("/api/documents", {
    headers: getAuthHeader(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`List documents failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function getDocument(id: number): Promise<DocumentDetailRecord> {
  const res = await fetch(`/api/documents/${id}`, {
    headers: getAuthHeader(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Get document failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function checkDuplicate(
  file: File
): Promise<DuplicateCheckResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/documents/check-duplicate", {
    method: "POST",
    headers: getAuthHeader(),
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Duplicate check failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function deleteDocument(id: number): Promise<void> {
  const res = await fetch(`/api/documents/${id}`, {
    method: "DELETE",
    headers: getAuthHeader(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Delete failed (${res.status}): ${text}`);
  }
}
