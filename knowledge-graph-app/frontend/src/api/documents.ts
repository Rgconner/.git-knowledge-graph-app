import { getAuthHeader } from "./auth";

export interface DocumentRecord {
  id: number;
  uploader_user_id: number;
  filename: string;
  file_type: string;
  created_at: string;
  processed_at: string | null;
  ai_category: string | null;
}

export interface DocumentDetailRecord extends DocumentRecord {
  raw_text: string;
}

export async function uploadDocument(file: File): Promise<DocumentRecord> {
  const form = new FormData();
  form.append("file", file);
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
