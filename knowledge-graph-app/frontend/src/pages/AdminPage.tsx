import React, { useEffect, useState, useCallback } from "react";
import * as adminApi from "../api/admin";
import { useAuth } from "../hooks/useAuth";

type WipeTarget = "data" | "users" | "all";

interface WipeOption {
  key: WipeTarget;
  label: string;
  description: string;
  danger: string;
}

const WIPE_OPTIONS: WipeOption[] = [
  {
    key: "data",
    label: "Wipe Graph Data",
    description:
      "Deletes all documents, entities, relationships, action items, and graph scores. User accounts are preserved.",
    danger: "All ingested content will be permanently lost.",
  },
  {
    key: "users",
    label: "Wipe Non-Admin Users",
    description:
      "Deletes all non-admin user accounts and all associated data. Admin accounts are preserved.",
    danger: "All non-admin users will be permanently removed.",
  },
  {
    key: "all",
    label: "Wipe Everything",
    description:
      "Full database reset. Deletes every row including admin accounts. You will be signed out immediately.",
    danger: "This action cannot be undone. You will be signed out.",
  },
];

const BTN: React.CSSProperties = {
  padding: "7px 16px",
  fontSize: 13,
  borderRadius: 5,
  border: "none",
  cursor: "pointer",
};

const DANGER_BTN: React.CSSProperties = {
  ...BTN,
  background: "#b91c1c",
  color: "#fff",
};

const CANCEL_BTN: React.CSSProperties = {
  ...BTN,
  background: "none",
  border: "1px solid #e5e7eb",
  color: "#57606a",
};

export default function AdminPage() {
  const { logout } = useAuth();
  const [users, setUsers] = useState<adminApi.UserRecord[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);

  // Wipe state
  const [pendingWipe, setPendingWipe] = useState<WipeTarget | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [wiping, setWiping] = useState(false);
  const [wipeResult, setWipeResult] = useState<adminApi.WipeResult | null>(null);
  const [wipeError, setWipeError] = useState<string | null>(null);

  // Admin toggle state
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    setUsersError(null);
    try {
      setUsers(await adminApi.listUsers());
    } catch (e: unknown) {
      setUsersError(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleWipe() {
    if (!pendingWipe || confirmText !== "CONFIRM") return;
    setWiping(true);
    setWipeError(null);
    setWipeResult(null);
    try {
      let result: adminApi.WipeResult;
      if (pendingWipe === "data") result = await adminApi.wipeData();
      else if (pendingWipe === "users") result = await adminApi.wipeUsers();
      else result = await adminApi.wipeAll();

      setWipeResult(result);
      setPendingWipe(null);
      setConfirmText("");

      if (pendingWipe === "all") {
        // The current user's account is gone — force logout.
        setTimeout(logout, 1500);
      } else {
        fetchUsers();
      }
    } catch (e: unknown) {
      setWipeError(e instanceof Error ? e.message : "Wipe failed");
    } finally {
      setWiping(false);
    }
  }

  async function handleToggleAdmin(user: adminApi.UserRecord) {
    setTogglingId(user.id);
    try {
      await adminApi.setAdmin(user.id, !user.is_admin);
      await fetchUsers();
    } catch {
      // ignore — refetch will show current state
    } finally {
      setTogglingId(null);
    }
  }

  const option = WIPE_OPTIONS.find((o) => o.key === pendingWipe);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 20px" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Admin</h1>
      <p style={{ color: "#57606a", fontSize: 13, marginBottom: 32 }}>
        Administrative tools. Actions here are irreversible.
      </p>

      {/* ── Wipe operations ──────────────────────────────────────── */}
      <section style={{ marginBottom: 40 }}>
        <h2
          style={{
            fontSize: 14,
            fontWeight: 700,
            marginBottom: 12,
            paddingBottom: 6,
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          Database Wipe
        </h2>

        {wipeResult && (
          <div
            style={{
              background: "#f0fdf4",
              border: "1px solid #86efac",
              borderRadius: 5,
              padding: "10px 14px",
              marginBottom: 16,
              fontSize: 13,
            }}
          >
            <strong>Done —</strong> {wipeResult.operation}:{" "}
            {Object.entries(wipeResult.deleted)
              .map(([k, v]) => `${v} ${k}`)
              .join(", ")}
          </div>
        )}

        {wipeError && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fca5a5",
              borderRadius: 5,
              padding: "10px 14px",
              marginBottom: 16,
              fontSize: 13,
              color: "#b91c1c",
            }}
          >
            {wipeError}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {WIPE_OPTIONS.map((opt) => (
            <div
              key={opt.key}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 6,
                padding: "14px 16px",
                background: "#f7f8fa",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>
                  {opt.label}
                </div>
                <div style={{ fontSize: 12, color: "#57606a" }}>{opt.description}</div>
              </div>
              <button
                style={{ ...DANGER_BTN, flexShrink: 0 }}
                onClick={() => {
                  setPendingWipe(opt.key);
                  setConfirmText("");
                  setWipeError(null);
                  setWipeResult(null);
                }}
              >
                {opt.label}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── Users ────────────────────────────────────────────────── */}
      <section>
        <h2
          style={{
            fontSize: 14,
            fontWeight: 700,
            marginBottom: 12,
            paddingBottom: 6,
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          Users
        </h2>

        {loadingUsers && (
          <p style={{ fontSize: 13, color: "#57606a" }}>Loading…</p>
        )}
        {usersError && (
          <p style={{ fontSize: 13, color: "#b91c1c" }}>{usersError}</p>
        )}
        {!loadingUsers && !usersError && (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
            }}
          >
            <thead>
              <tr>
                {["ID", "Name", "Email", "Admin", "Joined", ""].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: "6px 10px",
                      background: "#f7f8fa",
                      border: "1px solid #e5e7eb",
                      fontWeight: 600,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{ padding: "6px 10px", border: "1px solid #e5e7eb" }}>{u.id}</td>
                  <td style={{ padding: "6px 10px", border: "1px solid #e5e7eb" }}>{u.name}</td>
                  <td style={{ padding: "6px 10px", border: "1px solid #e5e7eb" }}>{u.email}</td>
                  <td style={{ padding: "6px 10px", border: "1px solid #e5e7eb" }}>
                    {u.is_admin ? (
                      <span style={{ color: "#3b82d4", fontWeight: 600 }}>Admin</span>
                    ) : (
                      <span style={{ color: "#57606a" }}>User</span>
                    )}
                  </td>
                  <td style={{ padding: "6px 10px", border: "1px solid #e5e7eb" }}>
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "6px 10px", border: "1px solid #e5e7eb" }}>
                    <button
                      style={{
                        ...BTN,
                        background: "none",
                        border: "1px solid #e5e7eb",
                        color: "#57606a",
                        opacity: togglingId === u.id ? 0.5 : 1,
                      }}
                      disabled={togglingId === u.id}
                      onClick={() => handleToggleAdmin(u)}
                    >
                      {u.is_admin ? "Revoke Admin" : "Make Admin"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ── Confirmation modal ───────────────────────────────────── */}
      {pendingWipe && option && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
          }}
        >
          <div
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: 28,
              width: 420,
              maxWidth: "90vw",
            }}
          >
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
              Confirm: {option.label}
            </h3>
            <p style={{ fontSize: 13, color: "#57606a", marginBottom: 6 }}>
              {option.description}
            </p>
            <p
              style={{
                fontSize: 13,
                color: "#b91c1c",
                fontWeight: 600,
                marginBottom: 16,
              }}
            >
              ⚠ {option.danger}
            </p>
            <p style={{ fontSize: 13, marginBottom: 6 }}>
              Type <strong>CONFIRM</strong> to proceed:
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="CONFIRM"
              autoFocus
              style={{
                width: "100%",
                padding: "7px 10px",
                fontSize: 13,
                border: "1px solid #e5e7eb",
                borderRadius: 5,
                marginBottom: 16,
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                style={CANCEL_BTN}
                onClick={() => {
                  setPendingWipe(null);
                  setConfirmText("");
                }}
              >
                Cancel
              </button>
              <button
                style={{
                  ...DANGER_BTN,
                  opacity: confirmText !== "CONFIRM" || wiping ? 0.5 : 1,
                }}
                disabled={confirmText !== "CONFIRM" || wiping}
                onClick={handleWipe}
              >
                {wiping ? "Wiping…" : option.label}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
