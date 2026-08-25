const STORAGE_KEY = "tripwire_chat_sessions_v1";
const ACTIVE_SESSION_KEY = "tripwire_active_session_id";

export function loadSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to load chat sessions:", e);
    return [];
  }
}

export function saveSessions(sessions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    window.dispatchEvent(new CustomEvent("tripwire:sessions-updated", { detail: sessions }));
  } catch (e) {
    console.error("Failed to save chat sessions:", e);
  }
}

export function getActiveSessionId() {
  return localStorage.getItem(ACTIVE_SESSION_KEY);
}

export function setActiveSessionId(id) {
  if (id) {
    localStorage.setItem(ACTIVE_SESSION_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
  }
  window.dispatchEvent(new CustomEvent("tripwire:switch-session", { detail: id }));
}

export function deleteSession(id) {
  const sessions = loadSessions().filter((s) => s.id !== id);
  saveSessions(sessions);
  if (getActiveSessionId() === id) {
    setActiveSessionId(null);
  }
}
