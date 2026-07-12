import { getAuthHeader } from "./auth";

export interface WipeResult {
  operation: string;
  deleted: Record<string, number>;
}

export interface UserRecord {
  id: number;
  name: string;
  email: string;
  is_admin: boolean;
  created_at: string;
}

async function del(path: string): Promise<WipeResult> {
  const res = await fetch(path, {
    method: "DELETE",
    headers: { ...getAuthHeader() },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export function wipeData(): Promise<WipeResult> {
  return del("/api/admin/wipe/data");
}

export function wipeUsers(): Promise<WipeResult> {
  return del("/api/admin/wipe/users");
}

export function wipeAll(): Promise<WipeResult> {
  return del("/api/admin/wipe/all");
}

export async function listUsers(): Promise<UserRecord[]> {
  const res = await fetch("/api/admin/users", { headers: { ...getAuthHeader() } });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export async function setAdmin(userId: number, isAdmin: boolean): Promise<UserRecord> {
  const res = await fetch(`/api/admin/users/${userId}/admin?is_admin=${isAdmin}`, {
    method: "PATCH",
    headers: { ...getAuthHeader() },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail ?? `Request failed (${res.status})`);
  }
  return res.json();
}
