import React, { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { useLanguage } from "./LanguageContext.jsx";

const MAX_CHARS = 500;

export default function ChatWidget() {
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const buttonRef = useRef(null);
  const inputRef = useRef(null);
  const endRef = useRef(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else if (wasOpen.current) buttonRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, loading, error, open]);

  async function send(text) {
    const content = text.trim();
    if (!content || loading) return;
    const history = [...messages, { role: "user", content }];
    setMessages(history);
    setInput("");
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ language, messages: history.slice(-6) })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.reply) throw new Error(data.error || "failed");
      setMessages([...history, { role: "assistant", content: data.reply }]);
    } catch (err) {
      // Store the kind, not the text, so the message follows later language switches.
      setError(err.message === "too_long" ? "too_long" : "failed");
    } finally {
      setLoading(false);
    }
  }

  const suggestions = [
    t("chat.suggest1", "What is today's flood risk?"),
    t("chat.suggest2", "How do I prepare for a flash flood?"),
    t("chat.suggest3", "How can I protect my boro rice crop?")
  ];

  return (
    <>
      {open && (
        <div
          id="haorshield-chat"
          role="dialog"
          aria-label={t("chat.title", "HaorShield Assistant")}
          onKeyDown={e => e.key === "Escape" && setOpen(false)}
          className="fixed inset-0 z-[1100] flex flex-col bg-white sm:inset-auto sm:bottom-24 sm:right-6 sm:h-[500px] sm:max-h-[calc(100vh-8rem)] sm:w-[360px] sm:rounded-2xl sm:border sm:border-slate-200 sm:shadow-xl overflow-hidden"
        >
          <div className="flex items-center justify-between gap-2 bg-sky-950 px-4 py-3 text-white">
            <h2 className="font-bold">{t("chat.title", "HaorShield Assistant")}</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("chat.close", "Close chat")}
              className="rounded-lg p-2 hover:bg-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-400"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4" aria-live="polite">
            <p className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white border border-slate-200 px-3 py-2 text-sm text-slate-900">
              {t("chat.welcome", "Hello! Ask me about floods, rain, weather or farming risk in the haor region.")}
            </p>
            {messages.length === 0 && (
              <div className="flex flex-wrap gap-2">
                {suggestions.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-xl border border-sky-200 bg-white px-3 py-1.5 text-left text-xs font-semibold text-sky-900 hover:bg-sky-50 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <p
                key={i}
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "ml-auto rounded-tr-sm bg-sky-900 text-white"
                    : "rounded-tl-sm border border-slate-200 bg-white text-slate-900"
                }`}
              >
                {m.content}
              </p>
            ))}
            {loading && (
              <div className="flex w-16 gap-1 rounded-2xl border border-slate-200 bg-white px-3 py-3" role="status">
                {[0, 150, 300].map(d => (
                  <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${d}ms` }} aria-hidden="true" />
                ))}
                <span className="sr-only">{t("chat.typing", "Assistant is typing…")}</span>
              </div>
            )}
            {error && (
              <p className="text-sm text-red-700" role="alert">
                {error === "too_long"
                  ? t("chat.tooLong", "Please keep your message under 500 characters.")
                  : t("chat.error", "Sorry, I couldn't respond right now. Please try again.")}
              </p>
            )}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={e => { e.preventDefault(); send(input); }}
            className="border-t border-slate-200 bg-white p-3"
          >
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
                }}
                maxLength={MAX_CHARS}
                rows={2}
                aria-label={t("chat.placeholder", "Type your question…")}
                placeholder={t("chat.placeholder", "Type your question…")}
                className="flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                aria-label={t("chat.send", "Send message")}
                className="rounded-xl bg-sky-900 p-3 text-white hover:bg-sky-800 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-sky-400"
              >
                <Send size={18} aria-hidden="true" />
              </button>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              {t("chat.note", "AI answers may be inaccurate. Check official sources for warnings.")}
            </p>
          </form>
        </div>
      )}

      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={open ? t("chat.close", "Close chat") : t("chat.open", "Open HaorShield Assistant")}
        aria-expanded={open}
        aria-controls="haorshield-chat"
        className={`fixed bottom-6 right-6 z-[1100] h-14 w-14 items-center justify-center rounded-full bg-sky-900 text-white shadow-lg hover:bg-sky-800 focus:outline-none focus:ring-4 focus:ring-sky-400 ${open ? "hidden sm:flex" : "flex"}`}
      >
        {open ? <X size={24} aria-hidden="true" /> : <MessageCircle size={26} aria-hidden="true" />}
      </button>
    </>
  );
}
