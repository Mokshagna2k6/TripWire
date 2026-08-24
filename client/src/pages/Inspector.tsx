import { useState, useEffect, useRef } from "react";
import {
  ArrowUp,
  ShieldCheck,
  ShieldAlert,
  XCircle,
  Scale,
  BrainCircuit,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  User,
  CornerDownRight,
  Globe,
  Paperclip,
  Image as ImageIcon,
  FileText,
  X,
} from "lucide-react";
import { api, type GenerateResult } from "../api.js";
import { Badge } from "../components/ui.js";
import {
  loadSessions,
  saveSessions,
  getActiveSessionId,
  setActiveSessionId,
  type ChatMessage,
  type ChatSession,
  type MediaAttachment,
} from "../chatStorage.js";

const DOMAINS = [
  { id: "general", label: "General" },
  { id: "finance_india", label: "Finance (India)" },
  { id: "medical", label: "Medical" },
  { id: "enterprise", label: "Enterprise" },
];

export default function Inspector() {
  const [domain, setDomain] = useState("general");
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<MediaAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [expandedTraceId, setExpandedTraceId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load active session on mount or switch
  function loadCurrentSession(targetId?: string | null) {
    const activeId = targetId !== undefined ? targetId : getActiveSessionId();
    if (!activeId) {
      setMessages([]);
      return;
    }
    const sessions = loadSessions();
    const current = sessions.find((s) => s.id === activeId);
    if (current) {
      setMessages(current.messages);
      setDomain(current.domain);
    } else {
      setMessages([]);
    }
  }

  useEffect(() => {
    loadCurrentSession();

    function handleNewChat() {
      setMessages([]);
      setInput("");
      setAttachments([]);
      setExpandedTraceId(null);
    }

    function handleSwitchSession(e: Event) {
      const customEvent = e as CustomEvent<string | null>;
      loadCurrentSession(customEvent.detail);
      setAttachments([]);
      setExpandedTraceId(null);
    }

    window.addEventListener("tripwire:new-chat", handleNewChat);
    window.addEventListener("tripwire:switch-session", handleSwitchSession);

    return () => {
      window.removeEventListener("tripwire:new-chat", handleNewChat);
      window.removeEventListener("tripwire:switch-session", handleSwitchSession);
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Adjust textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setAttachments((prev) => [
            ...prev,
            {
              name: file.name,
              type: file.type || "application/octet-stream",
              size: file.size,
              dataUrl: reader.result as string,
            },
          ]);
        }
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleRemoveAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSend() {
    if ((!input.trim() && attachments.length === 0) || loading) return;

    const userPrompt = input.trim() || (attachments.length > 0 ? `[Attached ${attachments.length} file(s)]` : "");
    const currentDomain = domain;
    const currentAttachments = [...attachments];

    setInput("");
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: userPrompt,
      domain: currentDomain,
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setLoading(true);

    // Ensure session exists
    let activeId = getActiveSessionId();
    let sessions = loadSessions();

    if (!activeId) {
      activeId = Date.now().toString();
      const sessionTitle = userPrompt.length > 35 ? `${userPrompt.substring(0, 35)}…` : userPrompt;
      const newSession: ChatSession = {
        id: activeId,
        title: sessionTitle,
        domain: currentDomain,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: updatedMessages,
      };
      sessions = [newSession, ...sessions];
      saveSessions(sessions);
      setActiveSessionId(activeId);
    } else {
      sessions = sessions.map((s) =>
        s.id === activeId ? { ...s, messages: updatedMessages, updatedAt: new Date().toISOString() } : s
      );
      saveSessions(sessions);
    }

    try {
      // Send prompt text along with any document/media hints
      const combinedPrompt = currentAttachments.length > 0
        ? `${userPrompt}\n[User attached: ${currentAttachments.map((a) => a.name).join(", ")}]`
        : userPrompt;

      const res = await api.generate(currentDomain, combinedPrompt);
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: res.response ?? "",
        domain: currentDomain,
        result: res,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      const finalMessages = [...updatedMessages, assistantMsg];
      setMessages(finalMessages);

      // Update session with assistant response and last verdict
      sessions = loadSessions().map((s) =>
        s.id === activeId
          ? {
              ...s,
              messages: finalMessages,
              lastVerdict: res.action,
              updatedAt: new Date().toISOString(),
            }
          : s
      );
      saveSessions(sessions);
    } catch (e) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "",
        domain: currentDomain,
        error: e instanceof Error ? e.message : "Request failed. Check gateway connection.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      const finalMessages = [...updatedMessages, errorMsg];
      setMessages(finalMessages);

      sessions = loadSessions().map((s) =>
        s.id === activeId
          ? {
              ...s,
              messages: finalMessages,
              updatedAt: new Date().toISOString(),
            }
          : s
      );
      saveSessions(sessions);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleCopy(id: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const canSubmit = input.trim().length > 0 || attachments.length > 0;

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleCopy(id: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const hasText = input.trim().length > 0;

  return (
    <div className="flex flex-col h-full w-full justify-between overflow-hidden relative">
      {/* Scrollable Conversation Stream */}
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Empty State: Gemini-Style Greeting */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 shadow-2xs">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-800">TripWire Trust Gateway</h2>
              <p className="text-sm text-slate-500 max-w-md">
                Type any prompt below. TripWire will intercept, execute adaptive verification against policy rules, and gate the response.
              </p>
            </div>
          )}

          {/* Message List */}
          {messages.map((msg) => (
            <div key={msg.id} className="space-y-3 animate-fade-in">
              {/* User Message */}
              {msg.role === "user" ? (
                <div className="flex justify-end gap-3">
                  <div className="max-w-[85%] rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-xs space-y-2">
                    {/* Render Attachments if any */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1 pb-1">
                        {msg.attachments.map((att, i) => (
                          <div key={i} className="rounded-xl overflow-hidden bg-slate-800 border border-slate-700/80">
                            {att.type.startsWith("image/") ? (
                              <img
                                src={att.dataUrl}
                                alt={att.name}
                                className="max-h-40 max-w-xs object-cover rounded-lg"
                              />
                            ) : (
                              <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-200">
                                <FileText className="h-4 w-4 text-indigo-400 shrink-0" />
                                <span className="truncate max-w-[150px] font-medium">{att.name}</span>
                                <span className="text-2xs text-slate-400">({(att.size / 1024).toFixed(0)} KB)</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    <div className="mt-1 flex items-center justify-end gap-2 text-2xs text-slate-400">
                      <span className="capitalize">{msg.domain.replace("_", " ")}</span>
                      <span>•</span>
                      <span>{msg.timestamp}</span>
                    </div>
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-slate-700 shrink-0">
                    <User className="h-4 w-4" />
                  </div>
                </div>
              ) : (
                /* Assistant / Gateway Response */
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white shrink-0 shadow-xs">
                    <ShieldCheck className="h-4 w-4" />
                  </div>

                  <div className="flex-1 max-w-[90%] space-y-3">
                    {/* Error State */}
                    {msg.error ? (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 text-sm text-rose-800">
                        <div className="flex items-center gap-2 font-semibold">
                          <AlertTriangle className="h-4 w-4 text-rose-600" />
                          Gateway Error
                        </div>
                        <p className="mt-1 text-xs text-rose-700">{msg.error}</p>
                      </div>
                    ) : msg.result ? (
                      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4">
                        {/* Gateway Status Header */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                              Verdict:
                            </span>
                            <Badge tone={msg.result.action} showDot>
                              {msg.result.action}
                            </Badge>
                            <Badge tone={msg.result.riskLevel}>
                              {msg.result.riskLevel} risk
                            </Badge>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-2xs text-slate-400 font-mono">
                              Mode: {msg.result.preRiskMode}
                            </span>
                            {msg.result.response && (
                              <button
                                onClick={() => handleCopy(msg.id, msg.result!.response!)}
                                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                                title="Copy response"
                              >
                                {copiedId === msg.id ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Model Output Text / Withheld Warning */}
                        {msg.result.response ? (
                          <div className="text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">
                            {msg.result.response}
                          </div>
                        ) : (
                          <div className="rounded-xl bg-rose-50/70 border border-rose-200/80 p-3.5 text-xs text-rose-800">
                            <div className="flex items-center gap-1.5 font-semibold text-rose-900">
                              <ShieldAlert className="h-4 w-4 text-rose-600" />
                              Response Withheld by Trust Gateway
                            </div>
                            <p className="mt-1 text-rose-700">
                              Action was <strong>{msg.result.action}</strong> due to critical risk / safety policy violation.
                            </p>
                          </div>
                        )}

                        {/* Trigger Reasons */}
                        {msg.result.reasons && msg.result.reasons.length > 0 && (
                          <div className="rounded-lg bg-slate-50/70 border border-slate-100 p-3">
                            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                              Violation Triggers:
                            </span>
                            <ul className="space-y-1">
                              {msg.result.reasons.map((r, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-xs text-slate-700">
                                  <CornerDownRight className="h-3 w-3 text-slate-400 mt-0.5 shrink-0" />
                                  <span>{r}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Collapsible Inspection Trace */}
                        <div className="border-t border-slate-100 pt-2">
                          <button
                            onClick={() =>
                              setExpandedTraceId(expandedTraceId === msg.id ? null : msg.id)
                            }
                            className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50/50 transition-colors"
                          >
                            <span className="flex items-center gap-1.5">
                              <Scale className="h-3.5 w-3.5" />
                              {expandedTraceId === msg.id
                                ? "Hide Gateway Inspection Trace"
                                : "Inspect Gateway Metrics & Evidence"}
                            </span>
                            {expandedTraceId === msg.id ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>

                          {expandedTraceId === msg.id && (
                            <div className="mt-3 space-y-4 rounded-xl bg-slate-50 border border-slate-200/80 p-4">
                              {/* 10 Metrics Grid */}
                              <div>
                                <h4 className="text-2xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                                  10 Core Governance Metrics
                                </h4>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                  {Object.entries(msg.result.metrics || {}).map(([k, v]) => {
                                    const num = typeof v === "number" ? v : null;
                                    return (
                                      <div
                                        key={k}
                                        className="rounded-lg bg-white border border-slate-200 px-2.5 py-1.5 shadow-2xs"
                                      >
                                        <div className="flex items-center justify-between">
                                          <span className="font-mono text-2xs font-bold text-slate-700">
                                            {k}
                                          </span>
                                          <span className="font-mono text-xs font-semibold text-indigo-600">
                                            {num !== null ? num.toFixed(2) : String(v)}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Evidence Chunks */}
                              {msg.result.evidence && msg.result.evidence.length > 0 && (
                                <div>
                                  <h4 className="text-2xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                                    Retrieved Evidence
                                  </h4>
                                  <div className="space-y-1.5">
                                    {msg.result.evidence.map((ev, i) => (
                                      <div
                                        key={i}
                                        className="rounded-lg bg-white border border-slate-200 p-2 text-2xs text-slate-600"
                                      >
                                        <div className="flex items-center justify-between font-mono text-slate-400 mb-1">
                                          <span>[{ev.source}]</span>
                                          <span className="text-indigo-600 font-semibold">
                                            sim={ev.similarity.toFixed(2)}
                                          </span>
                                        </div>
                                        <p>{ev.text}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* AI Judge (DEEP mode) */}
                              {msg.result.judgeOutput && (
                                <div className="rounded-lg bg-white border border-slate-200 p-2.5 text-xs text-slate-700">
                                  <div className="flex items-center gap-1.5 font-semibold text-indigo-700 mb-1">
                                    <BrainCircuit className="h-3.5 w-3.5" />
                                    AI Judge Rationale (DEEP Mode)
                                  </div>
                                  <p className="text-2xs italic text-slate-600">
                                    "{msg.result.judgeOutput.rationale}"
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Loading Indicator */}
          {loading && (
            <div className="flex gap-3 animate-fade-in">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white shrink-0 shadow-xs">
                <ShieldCheck className="h-4 w-4 animate-pulse" />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-medium text-slate-600 shadow-xs flex items-center gap-2">
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                <span>Intercepting & evaluating verification pipeline…</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Gemini-Style Bottom Chat Input Box */}
      <div className="w-full px-4 pb-5 pt-2 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent">
        <div className="mx-auto max-w-3xl">
          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*,.pdf,.txt,.csv,.doc,.docx"
            multiple
            className="hidden"
          />

          <div className="relative rounded-2xl border border-slate-200/90 bg-white shadow-md focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-900/5 transition-all p-2 sm:p-3">
            {/* Attachment Preview Chips */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 px-2 pb-2.5 pt-1 border-b border-slate-100 mb-2">
                {attachments.map((att, idx) => (
                  <div
                    key={idx}
                    className="relative flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200/80 p-1.5 pr-2 shadow-2xs group"
                  >
                    {att.type.startsWith("image/") ? (
                      <img src={att.dataUrl} alt={att.name} className="h-10 w-10 rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                        <FileText className="h-5 w-5" />
                      </div>
                    )}
                    <div className="min-w-0 max-w-[140px]">
                      <p className="truncate text-xs font-medium text-slate-700">{att.name}</p>
                      <p className="text-2xs text-slate-400">{(att.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(idx)}
                      className="ml-1 rounded-full p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                      title="Remove attachment"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Input Textarea */}
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything or attach media to inspect through the trust gateway…"
              className="w-full resize-none bg-transparent px-3 pt-1.5 pb-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden leading-relaxed"
            />

            {/* Bottom Toolbar inside the box */}
            <div className="flex items-center justify-between px-2 pt-1">
              <div className="flex items-center gap-2">
                {/* Add Media Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-full bg-slate-100 hover:bg-slate-200 px-2.5 py-1 text-2xs font-semibold text-slate-700 transition-colors border border-slate-200/60"
                  title="Attach image or document"
                >
                  <Paperclip className="h-3.5 w-3.5 text-slate-500" />
                  <span>Add Media</span>
                </button>

                {/* Domain Selector Pill */}
                <div className="relative flex items-center gap-1">
                  <Globe className="h-3.5 w-3.5 text-slate-400" />
                  <select
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    className="rounded-full bg-slate-100/90 hover:bg-slate-200/80 px-2.5 py-1 text-2xs font-semibold text-slate-700 focus:outline-hidden cursor-pointer transition-colors border border-slate-200/60"
                    title="Select domain context"
                  >
                    {DOMAINS.map((d) => (
                      <option key={d.id} value={d.id}>
                        Domain: {d.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dynamic Send Arrow Button */}
              <button
                onClick={handleSend}
                disabled={!canSubmit || loading}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${
                  canSubmit && !loading
                    ? "bg-slate-900 text-white shadow-xs hover:bg-slate-800 active:scale-95"
                    : "bg-slate-100 text-slate-300 cursor-not-allowed"
                }`}
                title="Send Prompt"
              >
                {loading ? (
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <ArrowUp className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div className="mt-1.5 text-center text-2xs text-slate-400">
            TripWire AI intercepts LLM output and enforces compliance before delivery.
          </div>
        </div>
      </div>
    </div>
  );
}
