import React, { useState } from "react";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import UploadPage from "./pages/UploadPage";
import GraphPage from "./pages/GraphPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ChatWindow from "./components/ChatWindow";

type Tab = "documents" | "graph";
type AuthView = "login" | "register";

function MainApp() {
  const { token, currentUser, logout } = useAuth();
  const [tab, setTab] = useState<Tab>("documents");
  const [authView, setAuthView] = useState<AuthView>("login");

  if (!token) {
    return authView === "login" ? (
      <LoginPage onNavigateToRegister={() => setAuthView("register")} />
    ) : (
      <RegisterPage onNavigateToLogin={() => setAuthView("login")} />
    );
  }

  return (
    <div style={{ fontFamily: '-apple-system, "Segoe UI", system-ui, sans-serif' }}>
      {/* Tab bar */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 44,
          background: "#fff",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          gap: 0,
          padding: "0 16px",
          zIndex: 1000,
        }}
      >
        {(["documents", "graph"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "0 18px",
              height: 44,
              fontSize: 14,
              fontWeight: tab === t ? 600 : 400,
              color: tab === t ? "#3b82d4" : "#57606a",
              background: "none",
              border: "none",
              borderBottom: tab === t ? "2px solid #3b82d4" : "2px solid transparent",
              cursor: "pointer",
              outline: "none",
            }}
          >
            {t === "documents" ? "Documents" : "Knowledge Graph"}
          </button>
        ))}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* User info + sign out */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {currentUser && (
            <span style={{ fontSize: 13, color: "#57606a" }}>
              {currentUser.name}
            </span>
          )}
          <button
            onClick={logout}
            style={{
              padding: "5px 12px",
              fontSize: 13,
              color: "#57606a",
              background: "none",
              border: "1px solid #e5e7eb",
              borderRadius: 5,
              cursor: "pointer",
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Page content — offset by tab bar height */}
      <div style={{ paddingTop: 44 }}>
        {tab === "documents" ? <UploadPage /> : <GraphPage />}
      </div>

      {/* Floating AI chat — persists across tab switches */}
      <ChatWindow />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
