import React, { createContext, useContext, useState, useCallback } from "react";
import * as authApi from "../api/auth";

const TOKEN_KEY = "kg_token";

interface AuthUser {
  id: number;
  email: string;
  name: string;
}

interface AuthContextValue {
  token: string | null;
  currentUser: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function decodeToken(token: string): AuthUser | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return { id: Number(payload.sub), email: payload.email, name: payload.name };
  } catch {
    return null;
  }
}

function readStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(readStoredToken);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    const t = readStoredToken();
    return t ? decodeToken(t) : null;
  });

  const login = useCallback(async (email: string, password: string) => {
    const { access_token } = await authApi.login(email, password);
    localStorage.setItem(TOKEN_KEY, access_token);
    setToken(access_token);
    setCurrentUser(decodeToken(access_token));
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      await authApi.register(name, email, password);
      // Auto-login after successful registration
      await login(email, password);
    },
    [login]
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setCurrentUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, currentUser, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}
