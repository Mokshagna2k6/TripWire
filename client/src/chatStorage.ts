import type { GenerateResult } from "./api.js";

export interface MediaAttachment {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  domain: string;
  attachments?: MediaAttachment[];
  result?: GenerateResult;
  error?: string;
  timestamp: string;
}

export interface ChatSession {
  id: string;
  title: string;
  domain: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  lastVerdict?: string;
}

const STORAGE_KEY = "tripwire_chat_sessions_v1";
const ACTIVE_SESSION_KEY = "tripwire_active_session_id";

export function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to load chat sessions:", e);
    return [];
  }
}

export function saveSessions(sessions: ChatSession[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    window.dispatchEvent(new CustomEvent("tripwire:sessions-updated", { detail: sessions }));
  } catch (e) {
    console.error("Failed to save chat sessions:", e);
  }
}

export function getActiveSessionId(): string | null {
  return localStorage.getItem(ACTIVE_SESSION_KEY);
}

export function setActiveSessionId(id: string | null): void {
  if (id) {
    localStorage.setItem(ACTIVE_SESSION_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
  }
  window.dispatchEvent(new CustomEvent("tripwire:switch-session", { detail: id }));
}

export function deleteSession(id: string): void {
  const sessions = loadSessions().filter((s) => s.id !== id);
  saveSessions(sessions);
  if (getActiveSessionId() === id) {
    setActiveSessionId(null);
  }
}
