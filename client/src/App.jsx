import { useState, useEffect } from "react";
import { NavLink, Route, Routes, useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  MessageSquarePlus,
  MessageSquare,
  UserCheck,
  BarChart3,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  FolderClock,
  Trash2,
} from "lucide-react";
import Inspector from "./pages/Inspector.jsx";
import Policies from "./pages/Policies.jsx";
import Review from "./pages/Review.jsx";
import Feedback from "./pages/Feedback.jsx";
import {
  loadSessions,
  getActiveSessionId,
  setActiveSessionId,
  deleteSession,
} from "./chatStorage.js";
import { Badge } from "./components/ui.jsx";

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionIdState] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    setSessions(loadSessions());
    setActiveSessionIdState(getActiveSessionId());

    function handleSessionsUpdated(e) {
      setSessions(e.detail ?? loadSessions());
    }

    function handleSessionSwitched(e) {
      setActiveSessionIdState(e.detail ?? getActiveSessionId());
    }

    window.addEventListener("tripwire:sessions-updated", handleSessionsUpdated);
    window.addEventListener("tripwire:switch-session", handleSessionSwitched);

    return () => {
      window.removeEventListener("tripwire:sessions-updated", handleSessionsUpdated);
      window.removeEventListener("tripwire:switch-session", handleSessionSwitched);
    };
  }, []);

  function handleStartNewChat() {
    setActiveSessionId(null);
    navigate("/");
    window.dispatchEvent(new CustomEvent("tripwire:new-chat"));
  }

  function handleSelectSession(id) {
    setActiveSessionId(id);
    navigate("/");
  }

  function handleDeleteSession(e, id) {
    e.stopPropagation();
    deleteSession(id);
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-900 font-sans">
      {/* Left Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-16"
        } flex flex-col justify-between border-r border-slate-200/80 bg-white transition-all duration-200 shrink-0 z-20 h-full`}
      >
        {/* Top Section */}
        <div className="p-3 space-y-3 flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Logo & Collapse Toggle */}
          <div className="flex items-center justify-between px-2 py-1 shrink-0">
            <div className={`flex items-center gap-2.5 overflow-hidden ${!sidebarOpen && "hidden"}`}>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs shrink-0">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight text-slate-900 leading-none">TripWire AI</h1>
                <span className="text-2xs text-slate-400 font-medium">Trust Gateway</span>
              </div>
            </div>

            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </button>
          </div>

          {/* New Chat Button */}
          <button
            onClick={handleStartNewChat}
            className={`flex w-full items-center shrink-0 ${
              sidebarOpen ? "gap-2.5 px-3.5 py-2.5 justify-start" : "justify-center p-2.5"
            } rounded-xl bg-slate-900 text-white text-xs font-semibold shadow-xs hover:bg-slate-800 transition-all active:scale-[0.98]`}
            title="Start new chat"
          >
            <MessageSquarePlus className="h-4 w-4 shrink-0" />
            {sidebarOpen && <span>New Chat</span>}
          </button>

          {/* Main Navigation Links */}
          <nav className="space-y-1 pt-1 shrink-0">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `flex items-center ${
                  sidebarOpen ? "gap-3 px-3 py-2" : "justify-center p-2.5"
                } rounded-lg text-xs font-medium transition-colors ${
                  isActive && !activeSessionId
                    ? "bg-slate-100 text-slate-900 font-semibold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`
              }
              title="Chat & Inspector"
            >
              <MessageSquare className="h-4 w-4 shrink-0 text-slate-500" />
              {sidebarOpen && <span>Chat & Inspector</span>}
            </NavLink>

            <NavLink
              to="/review"
              className={({ isActive }) =>
                `flex items-center ${
                  sidebarOpen ? "gap-3 px-3 py-2" : "justify-center p-2.5"
                } rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-slate-100 text-slate-900 font-semibold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`
              }
              title="Human Review Queue"
            >
              <UserCheck className="h-4 w-4 shrink-0 text-slate-500" />
              {sidebarOpen && <span>Human Review</span>}
            </NavLink>

            <NavLink
              to="/feedback"
              className={({ isActive }) =>
                `flex items-center ${
                  sidebarOpen ? "gap-3 px-3 py-2" : "justify-center p-2.5"
                } rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-slate-100 text-slate-900 font-semibold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`
              }
              title="Feedback & Telemetry"
            >
              <BarChart3 className="h-4 w-4 shrink-0 text-slate-500" />
              {sidebarOpen && <span>Feedback & Metrics</span>}
            </NavLink>
          </nav>

          {/* Library / Previous Chats Section */}
          {sidebarOpen && (
            <div className="flex-1 flex flex-col min-h-0 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-1.5 px-2 pb-2 text-2xs font-semibold uppercase tracking-wider text-slate-400">
                <FolderClock className="h-3.5 w-3.5 text-slate-400" />
                <span>Library</span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                {sessions.length === 0 ? (
                  <p className="px-2 py-4 text-2xs text-slate-400 italic text-center">
                    No previous chats yet.
                  </p>
                ) : (
                  sessions.map((s) => {
                    const isSelected = activeSessionId === s.id;
                    return (
                      <div
                        key={s.id}
                        onClick={() => handleSelectSession(s.id)}
                        className={`group relative flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-slate-100 text-slate-900 font-semibold"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-xs leading-snug">{s.title}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-2xs text-slate-400 capitalize">
                              {s.domain.replace("_", " ")}
                            </span>
                            {s.lastVerdict && (
                              <span className="scale-90 origin-left">
                                <Badge tone={s.lastVerdict}>{s.lastVerdict}</Badge>
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={(e) => handleDeleteSession(e, s.id)}
                          className="opacity-0 group-hover:opacity-100 rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-rose-600 transition-all"
                          title="Delete chat"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Sidebar Settings & Status */}
        <div className="p-3 border-t border-slate-100 space-y-1 shrink-0">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center ${
                sidebarOpen ? "gap-3 px-3 py-2" : "justify-center p-2.5"
              } rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? "bg-slate-100 text-slate-900 font-semibold"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`
            }
            title="Settings & Policies"
          >
            <Settings className="h-4 w-4 shrink-0 text-slate-500" />
            {sidebarOpen && <span>Settings & Policies</span>}
          </NavLink>

          {sidebarOpen && (
            <div className="pt-2 px-2 flex items-center justify-between text-2xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-medium text-slate-500">Gateway Active</span>
              </div>
              <span className="font-mono text-slate-300">v1.0</span>
            </div>
          )}
        </div>
      </aside>

      {/* Main Center Content View */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 relative">
        <Routes>
          <Route path="/" element={<Inspector />} />
          <Route path="/settings" element={<Policies />} />
          <Route path="/policies" element={<Policies />} />
          <Route path="/review" element={<Review />} />
          <Route path="/feedback" element={<Feedback />} />
        </Routes>
      </main>
    </div>
  );
}
