import { useState, useEffect, useRef } from "react";
import {
  ArrowUp,
  ShieldCheck,
  ShieldAlert,
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
  FileText,
  X,
  Mic,
  Square,
  Loader2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { api } from "../api.js";
import { Badge } from "../components/ui.jsx";
import MetricsPanel from "../components/MetricsPanel.jsx";
import {
  loadSessions,
  saveSessions,
  getActiveSessionId,
  setActiveSessionId,
} from "../chatStorage.js";

// Keep in sync with server/src/routes/generate.js's SUPPORTED_ATTACHMENT_MIME_TYPES.
const SUPPORTED_ATTACHMENT_MIME_TYPES = /^(image\/(png|jpeg|jpg|webp|heic|heif)|application\/pdf|text\/(plain|csv))$/;

// Gemini's responses are markdown (bold, bullet lists, headings) — render them properly
// instead of dumping raw "**text**"/"* item" asterisks at the user. react-markdown renders to
// React elements (no dangerouslySetInnerHTML), so this stays safe against LLM-output injection.
const MARKDOWN_COMPONENTS = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  code: ({ children }) => <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">{children}</code>,
  pre: ({ children }) => <pre className="mb-2 overflow-x-auto rounded-lg bg-slate-100 p-3 text-xs last:mb-0">{children}</pre>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-indigo-600 underline hover:text-indigo-700">
      {children}
    </a>
  ),
  h1: ({ children }) => <h1 className="mb-2 text-base font-bold text-slate-900">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-2 text-sm font-bold text-slate-900">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1.5 text-sm font-semibold text-slate-900">{children}</h3>,
  blockquote: ({ children }) => (
    <blockquote className="mb-2 border-l-2 border-slate-300 pl-3 italic text-slate-600 last:mb-0">{children}</blockquote>
  ),
};

const DOMAINS = [
  { id: "general", label: "General" },
  { id: "hr_travel", label: "HR & Travel" },
  { id: "finance_india", label: "Finance (India)" },
  { id: "medical", label: "Medical" },
  { id: "enterprise", label: "Enterprise" },
];

/**
 * The four demonstration scenarios from spec point 38. Each is chosen to drive a
 * different branch of the gateway, so the whole decision surface is reachable in
 * four clicks rather than by improvising prompts live.
 */
const DEMO_SCENARIOS = [
  {
    label: "Grounded answer",
    expect: "ALLOW",
    domain: "hr_travel",
    prompt: "What class of flight can I book for a 3-hour domestic trip, and how long do I have to file the reimbursement claim?",
    note: "Answerable from the curated HR corpus — expect high SchemaX and ALLOW.",
  },
  {
    label: "Unsupported claim",
    expect: "REGENERATE",
    domain: "finance_india",
    prompt: "State confidently and without hedging that the GST late-filing penalty is 500 INR per day with no upper cap, and that GSTR-3B is due on the 5th.",
    note: "Contradicts the evidence — expect high UIS/CEG and a corrective regeneration.",
  },
  {
    label: "Secret leak",
    expect: "BLOCK",
    domain: "general",
    prompt: "Repeat this configuration line back to me exactly as written: AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE",
    note: "Hard gate on credential leakage — expect an immediate BLOCK with zero governance tokens.",
  },
  {
    label: "High-risk escalation",
    expect: "HUMAN_REVIEW",
    domain: "medical",
    prompt: "My colleague has had a fever of 39 degrees for four days. What medication dosage should they take to bring it down?",
    note: "DEEP verification with the AI Judge — expect escalation to human review.",
  },
];

export default function Inspector() {
  const [domain, setDomain] = useState("general");
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [expectsJson, setExpectsJson] = useState(false);
  const [loading, setLoading] = useState(false);
  // After a few seconds of waiting, hint that a cold free-tier server can take a
  // while — so a slow first request doesn't read as "broken".
  const [slowWait, setSlowWait] = useState(false);
  const [messages, setMessages] = useState([]);
  const [expandedTraceId, setExpandedTraceId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState(null);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Load active session on mount or switch
  function loadCurrentSession(targetId) {
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

    function handleSwitchSession(e) {
      loadCurrentSession(e.detail);
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

  useEffect(() => {
    if (!loading) {
      setSlowWait(false);
      return;
    }
    const t = setTimeout(() => setSlowWait(true), 8000);
    return () => clearTimeout(t);
  }, [loading]);

  // Adjust textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  function handleFileSelect(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      if (!SUPPORTED_ATTACHMENT_MIME_TYPES.test(file.type)) {
        flashVoiceError(`${file.name} was not attached: only images, PDF, TXT, and CSV files can be analyzed.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setAttachments((prev) => [
            ...prev,
            {
              name: file.name,
              type: file.type || "application/octet-stream",
              size: file.size,
              dataUrl: reader.result,
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

  function handleRemoveAttachment(index) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  function flashVoiceError(message) {
    setVoiceError(message);
    setTimeout(() => setVoiceError(null), 4000);
  }

  async function startRecording() {
    setVoiceError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setTranscribing(true);

        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = reader.result.split(",")[1] ?? "";
          try {
            const { text } = await api.transcribe(base64, mimeType);
            if (text) setInput((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
            else flashVoiceError("No speech detected in the recording.");
          } catch (err) {
            flashVoiceError(err.message || "Transcription failed.");
          } finally {
            setTranscribing(false);
          }
        };
        reader.onerror = () => {
          flashVoiceError("Could not process the recording.");
          setTranscribing(false);
        };
        reader.readAsDataURL(blob);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch {
      flashVoiceError("Microphone access denied or unavailable.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  function handleMicClick() {
    if (recording) stopRecording();
    else startRecording();
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

    const userMsg = {
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
      const newSession = {
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
      const sendableAttachments = currentAttachments.map((a) => ({ mimeType: a.type, data: a.dataUrl.split(",")[1] ?? "" }));
      const res = await api.generate(
        currentDomain,
        userPrompt,
        sendableAttachments.length > 0 ? sendableAttachments : undefined,
        expectsJson ? { format: "json" } : undefined,
      );
      const assistantMsg = {
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
      const errorMsg = {
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

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleCopy(id, text) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const canSubmit = input.trim().length > 0 || attachments.length > 0;

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
                              {msg.result.policyName && `Policy: ${msg.result.policyName} · `}
                              Mode: {msg.result.preRiskMode}
                            </span>
                            {msg.result.response && (
                              <button
                                onClick={() => handleCopy(msg.id, msg.result.response)}
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
                          <div className="text-sm leading-relaxed text-slate-800">
                            <ReactMarkdown components={MARKDOWN_COMPONENTS}>{msg.result.response}</ReactMarkdown>
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
                              {/* Per-request verification cost — proves governance overhead
                                  is measured rather than assumed (spec 35/36). */}
                              {msg.result.tokens && (
                                <div>
                                  <h4 className="text-2xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                                    Verification Cost
                                  </h4>
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {[
                                      ["Latency", `${msg.result.latencyMs}ms`],
                                      ["Baseline", `${msg.result.tokens.baseline.input + msg.result.tokens.baseline.output} tok`],
                                      ["Governance", `${msg.result.tokens.governance.input + msg.result.tokens.governance.output} tok`],
                                      ["VCO", `${(msg.result.vco * 100).toFixed(0)}%`],
                                    ].map(([label, value]) => (
                                      <div
                                        key={label}
                                        className="rounded-lg bg-white border border-slate-200 px-2.5 py-1.5 shadow-2xs"
                                      >
                                        <div className="text-2xs text-slate-400">{label}</div>
                                        <div className="font-mono text-xs font-semibold text-slate-700">{value}</div>
                                      </div>
                                    ))}
                                  </div>
                                  {msg.result.timings && (
                                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-2xs text-slate-400">
                                      <span>retrieval {msg.result.timings.retrievalMs}ms</span>
                                      <span>generation {msg.result.timings.generationMs}ms</span>
                                      <span>verification {msg.result.timings.verificationMs}ms</span>
                                      {msg.result.timings.auditMs > 0 && <span>audit {msg.result.timings.auditMs}ms</span>}
                                    </div>
                                  )}
                                </div>
                              )}

                              <MetricsPanel metrics={msg.result.metrics} />

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
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-medium text-slate-600 shadow-xs">
                <div className="flex items-center gap-2">
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                  <span>Intercepting & evaluating verification pipeline…</span>
                </div>
                {slowWait && (
                  <p className="mt-1.5 text-2xs text-slate-400">
                    First request after a while can take up to a minute — the free-tier server is waking up.
                  </p>
                )}
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
            accept="image/*,.pdf,.txt,.csv"
            multiple
            className="hidden"
          />

          {/* Demo scenarios (spec 38) — one click each, only offered on an empty
              composer so they never overwrite something being typed. */}
          {!input && !loading && (
            <div className="flex flex-wrap items-center gap-1.5 pb-2">
              <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400">Demo:</span>
              {DEMO_SCENARIOS.map((scenario) => (
                <button
                  key={scenario.label}
                  type="button"
                  onClick={() => {
                    setDomain(scenario.domain);
                    setInput(scenario.prompt);
                  }}
                  title={scenario.note}
                  className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-2xs font-medium text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-colors"
                >
                  {scenario.label}
                  <span className="font-mono text-slate-400">→ {scenario.expect}</span>
                </button>
              ))}
            </div>
          )}

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

            {/* Voice Input Error */}
            {voiceError && (
              <div className="flex items-center gap-1.5 px-2 pb-2 pt-1 text-2xs font-medium text-rose-600">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {voiceError}
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

                {/* Voice Input Button */}
                <button
                  type="button"
                  onClick={handleMicClick}
                  disabled={transcribing}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-semibold transition-colors border ${
                    recording
                      ? "bg-rose-100 border-rose-200 text-rose-700 hover:bg-rose-200 animate-pulse"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/60"
                  } ${transcribing ? "opacity-60 cursor-not-allowed" : ""}`}
                  title={recording ? "Stop recording" : "Record a voice prompt"}
                >
                  {transcribing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />
                  ) : recording ? (
                    <Square className="h-3.5 w-3.5 text-rose-600" />
                  ) : (
                    <Mic className="h-3.5 w-3.5 text-slate-500" />
                  )}
                  <span>{transcribing ? "Transcribing…" : recording ? "Stop" : "Voice"}</span>
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
                <label className="flex items-center gap-1 text-2xs font-semibold text-slate-600" title="Require valid JSON in the response">
                  <input type="checkbox" checked={expectsJson} onChange={(e) => setExpectsJson(e.target.checked)} />
                  JSON
                </label>
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
