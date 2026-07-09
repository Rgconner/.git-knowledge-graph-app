import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  KeyboardEvent,
} from "react";
import { sendChatMessage, ChatMessage } from "../api/chat";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MessageBubble extends ChatMessage {
  id: number;
  error?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _idCounter = 0;
function nextId() {
  return ++_idCounter;
}

function TypingIndicator() {
  return (
    <div style={{ display: "flex", gap: 4, padding: "8px 12px" }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#94a3b8",
            display: "inline-block",
            animation: `kg-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ChatWindow() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<MessageBubble[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Draggable state
  const [pos, setPos] = useState({ x: 0, y: 0 }); // offset from bottom-right
  const dragging = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Focus textarea when window opens
  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 80);
    }
  }, [open]);

  // ---------------------------------------------------------------------------
  // Dragging
  // ---------------------------------------------------------------------------

  const onMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Only drag on the header bar, not on buttons
      if ((e.target as HTMLElement).closest("button")) return;
      dragging.current = true;
      dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
      e.preventDefault();
    },
    [pos]
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - dragStart.current.mx;
      const dy = e.clientY - dragStart.current.my;
      setPos({ x: dragStart.current.px - dx, y: dragStart.current.py - dy });
    };
    const onUp = () => {
      dragging.current = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Send message
  // ---------------------------------------------------------------------------

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userBubble: MessageBubble = {
      id: nextId(),
      role: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userBubble]);
    setInput("");
    setError(null);
    setLoading(true);

    // Resize textarea back to default
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      // Build history for the API (all previous messages + the new one)
      const history: ChatMessage[] = [...messages, userBubble].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const resp = await sendChatMessage(history);

      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "assistant", content: resp.reply },
      ]);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Unexpected error — try again.";
      setError(msg);
      // Also show the error inline as a failed assistant message
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "assistant",
          content: `⚠️ ${msg}`,
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [input, loading, messages]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
    setInput("");
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // Position: fixed from bottom-right corner, offset by drag delta
  const right = 24 + pos.x;
  const bottom = 24 + pos.y;

  return (
    <>
      {/* CSS keyframes for typing indicator */}
      <style>{`
        @keyframes kg-bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40%            { transform: scale(1.0); opacity: 1;   }
        }
      `}</style>

      {/* Collapsed FAB */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="Open AI Chat"
          style={{
            position: "fixed",
            right: 24,
            bottom: 24,
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
            border: "none",
            boxShadow: "0 4px 14px rgba(59,130,246,.45)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9000,
            transition: "transform .15s",
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1.1)")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")
          }
        >
          {/* Chat bubble icon */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
          </svg>
        </button>
      )}

      {/* Expanded chat window */}
      {open && (
        <div
          style={{
            position: "fixed",
            right,
            bottom,
            width: 380,
            height: 520,
            background: "#fff",
            borderRadius: 14,
            boxShadow:
              "0 8px 30px rgba(0,0,0,.18), 0 2px 8px rgba(0,0,0,.1)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            zIndex: 9000,
            fontFamily: '-apple-system, "Segoe UI", system-ui, sans-serif',
          }}
        >
          {/* Header */}
          <div
            onMouseDown={onMouseDown}
            style={{
              background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "grab",
              userSelect: "none",
              flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white" style={{ flexShrink: 0 }}>
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
            </svg>
            <span style={{ color: "white", fontWeight: 600, fontSize: 14, flex: 1 }}>
              Knowledge Graph AI
            </span>
            <button
              onClick={clearChat}
              title="Clear conversation"
              style={{
                background: "rgba(255,255,255,.2)",
                border: "none",
                borderRadius: 6,
                color: "white",
                fontSize: 11,
                padding: "3px 7px",
                cursor: "pointer",
              }}
            >
              Clear
            </button>
            <button
              onClick={() => setOpen(false)}
              title="Minimise"
              style={{
                background: "rgba(255,255,255,.2)",
                border: "none",
                borderRadius: 6,
                color: "white",
                fontSize: 16,
                padding: "2px 7px",
                cursor: "pointer",
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              background: "#f8fafc",
            }}
          >
            {messages.length === 0 && !loading && (
              <div
                style={{
                  color: "#94a3b8",
                  fontSize: 13,
                  textAlign: "center",
                  marginTop: 40,
                  lineHeight: 1.6,
                }}
              >
                Ask anything about your knowledge graph.
                <br />
                <span style={{ fontSize: 11 }}>
                  e.g. "Who are the key people?" or "What action items are open?"
                </span>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: "flex",
                  justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: "82%",
                    padding: "8px 12px",
                    borderRadius:
                      msg.role === "user"
                        ? "14px 14px 3px 14px"
                        : "14px 14px 14px 3px",
                    background: msg.error
                      ? "#fee2e2"
                      : msg.role === "user"
                      ? "linear-gradient(135deg,#3b82f6,#6366f1)"
                      : "#fff",
                    color: msg.error
                      ? "#b91c1c"
                      : msg.role === "user"
                      ? "white"
                      : "#1e293b",
                    fontSize: 13.5,
                    lineHeight: 1.55,
                    boxShadow: "0 1px 4px rgba(0,0,0,.08)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div
                  style={{
                    background: "#fff",
                    borderRadius: "14px 14px 14px 3px",
                    boxShadow: "0 1px 4px rgba(0,0,0,.08)",
                  }}
                >
                  <TypingIndicator />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div
            style={{
              borderTop: "1px solid #e2e8f0",
              padding: "10px 12px",
              display: "flex",
              gap: 8,
              alignItems: "flex-end",
              background: "#fff",
              flexShrink: 0,
            }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                // Auto-grow
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyDown={onKeyDown}
              placeholder="Message… (Enter to send, Shift+Enter for newline)"
              rows={1}
              style={{
                flex: 1,
                resize: "none",
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                padding: "8px 10px",
                fontSize: 13.5,
                lineHeight: 1.5,
                outline: "none",
                fontFamily: "inherit",
                background: "#f8fafc",
                color: "#1e293b",
                overflowY: "hidden",
                minHeight: 36,
              }}
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              title="Send"
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background:
                  loading || !input.trim()
                    ? "#e2e8f0"
                    : "linear-gradient(135deg,#3b82f6,#6366f1)",
                border: "none",
                cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "background .15s",
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill={loading || !input.trim() ? "#94a3b8" : "white"}
              >
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
