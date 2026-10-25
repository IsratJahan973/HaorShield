// Cloudflare Pages Function: POST /api/chat. The API key stays here, never in the browser bundle.
// Also served in local dev by the plugin in vite.config.js.
const MAX_CHARS = 500;
// Earlier assistant replies can exceed the user limit; cap them so the history stays bounded.
const MAX_REPLY_CHARS = 2000;
const MAX_HISTORY = 6;
const DEFAULT_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "qwen/qwen3.8-27b";

const LANGUAGE_RULE = {
  en: "Reply ONLY in English, even if the user or earlier messages use Bangla. Do not mention this rule.",
  bn: "Reply ONLY in Bangla (বাংলা), using Bengali script, even if the user or earlier messages use English. Do not mention this rule."
};
const isBangla = text => (text.match(/[ঀ-৿]/g) || []).length > (text.match(/[A-Za-z]/g) || []).length;

function systemPrompt(language) {
  return `You are the HaorShield Assistant on HaorShield, an experimental flood, weather and rainfall screening website for the haor wetlands of northeastern Bangladesh (Sunamganj, Sylhet, Habiganj, Moulvibazar, Netrakona, Kishoreganj, Brahmanbaria).
Website sections: Flood Check (experimental 24, 48 and 72-hour flood-concern screening for a chosen district or upazila, with a land and cropland map), Weather (current conditions), Rain Map (forecast rainfall by area), Crop Advice (preparedness tips by crop and stage), and Historical explorer (past flood events and affected cropland).
Only help with: how to use this website, flash floods, rainfall, weather, flood safety and preparedness, and farming risk in the haor region. Politely decline any other topic in one sentence and steer back to floods and weather.
Keep answers short, clear and friendly: 3 to 5 sentences unless more is truly needed.
You have no live data. Never invent forecasts, water levels, warnings or official alerts; tell users to check the Flood Check section for the site's experimental screening. HaorShield is not an official warning service.
For emergencies or official alerts, direct users to the Bangladesh Meteorological Department (BMD, bmd.gov.bd), the Flood Forecasting and Warning Centre (FFWC, ffwc.gov.bd), or the national emergency number 999.
LANGUAGE (most important rule; the website language decides, not the language of the question or earlier messages): ${LANGUAGE_RULE[language]}`;
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export async function onRequestPost({ request, env }) {
  if (!env.CHAT_API_KEY) return json({ error: "not_configured" }, 500);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  const language = body?.language === "bn" ? "bn" : "en";
  if (!Array.isArray(body?.messages)) return json({ error: "bad_request" }, 400);
  const messages = body.messages.slice(-MAX_HISTORY).map(m => {
    const role = m?.role === "assistant" ? "assistant" : "user";
    const content = typeof m?.content === "string" ? m.content.trim() : "";
    return { role, content: role === "assistant" ? content.slice(0, MAX_REPLY_CHARS) : content };
  });
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user" || messages.some(m => !m.content)) return json({ error: "bad_request" }, 400);
  if (messages.some(m => m.role === "user" && m.content.length > MAX_CHARS)) return json({ error: "too_long" }, 400);

  // The model returns an empty reply when two user turns arrive in a row, so keep turns alternating.
  const history = [];
  for (const m of messages) {
    // After a mid-chat language switch the model copies earlier replies' language, so drop
    // replies in the other language together with the question they answered.
    if (m.role === "assistant" && isBangla(m.content) !== (language === "bn")) { history.pop(); continue; }
    // Keep only the newest of back-to-back questions (e.g. one left unanswered by an error).
    if (m.role === "user" && history.at(-1)?.role === "user") history.pop();
    history.push(m);
  }

  try {
    const upstream = await fetch(env.CHAT_API_URL || DEFAULT_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${env.CHAT_API_KEY}` },
      body: JSON.stringify({
        model: env.CHAT_MODEL || DEFAULT_MODEL,
        messages: [{ role: "system", content: systemPrompt(language) }, ...history],
        max_tokens: 400,
        temperature: 0.3
      }),
      signal: AbortSignal.timeout(20000)
    });
    if (!upstream.ok) {
      console.error("chat upstream status", upstream.status);
      return json({ error: "upstream" }, 502);
    }
    const reply = (await upstream.json())?.choices?.[0]?.message?.content?.trim();
    return reply ? json({ reply }) : json({ error: "upstream" }, 502);
  } catch (err) {
    console.error("chat upstream failed", err?.name);
    return json({ error: "upstream" }, 502);
  }
}
