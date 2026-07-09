import { getAuthHeader } from "./auth";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  reply: string;
}

export async function sendChatMessage(
  messages: ChatMessage[]
): Promise<ChatResponse> {
  const res = await fetch("/api/chat/message", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { detail?: string }).detail ?? `Chat request failed (${res.status})`
    );
  }

  return res.json() as Promise<ChatResponse>;
}
