import assert from "node:assert/strict";
import { onRequestPost } from "../frontend/functions/api/chat.js";

const env = { CHAT_API_KEY: "secret-key-123" };
const post = (body, e = env) => onRequestPost({
  request: new Request("http://x/api/chat", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }),
  env: e
});
let sent;
const mockFetch = (status, data) => { globalThis.fetch = async (url, init) => { sent = JSON.parse(init.body); return new Response(JSON.stringify(data), { status }); }; };

// Missing key and malformed input never reach the provider.
assert.equal((await post({ language: "en", messages: [{ role: "user", content: "hi" }] }, {})).status, 500);
assert.equal((await post("not json")).status, 400);
assert.equal((await post({ language: "en", messages: [{ role: "user", content: "   " }] })).status, 400);
assert.equal((await post({ language: "en", messages: [{ role: "user", content: "x".repeat(501) }] })).status, 400);

// History is trimmed to the last 6 messages, plus one system prompt carrying the language rule.
mockFetch(200, { choices: [{ message: { content: " উত্তর " } }] });
const history = Array.from({ length: 9 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `m${i}` }));
const ok = await post({ language: "en", messages: history });
assert.equal(ok.status, 200);
assert.deepEqual(await ok.json(), { reply: "উত্তর" });
assert.equal(sent.messages.length, 7);
assert.equal(sent.messages[0].role, "system");
assert.match(sent.messages[0].content, /ONLY in English/);
assert.equal(sent.messages.at(-1).content, "m8");

// A long earlier assistant reply must not block the next question (regression), but is capped.
const longReply = await post({ language: "en", messages: [
  { role: "user", content: "q1" }, { role: "assistant", content: "a".repeat(2500) }, { role: "user", content: "q2" }
] });
assert.equal(longReply.status, 200);
assert.equal(sent.messages[2].content.length, 2000);

// After switching to Bangla, earlier English replies are dropped with their question, keeping turns alternating.
await post({ language: "bn", messages: [
  { role: "user", content: "q1" }, { role: "assistant", content: "An English answer." },
  { role: "user", content: "q2" }, { role: "assistant", content: "বাংলা উত্তর।" }, { role: "user", content: "q3" }
] });
assert.match(sent.messages[0].content, /ONLY in Bangla/);
assert.deepEqual(sent.messages.slice(1).map(m => m.content), ["q2", "বাংলা উত্তর।", "q3"]);

// A question left unanswered by an earlier error is replaced by the newest one (no two user turns in a row).
await post({ language: "en", messages: [
  { role: "user", content: "q1" }, { role: "assistant", content: "a1" }, { role: "user", content: "failed" }, { role: "user", content: "retry" }
] });
assert.deepEqual(sent.messages.slice(1).map(m => m.content), ["q1", "a1", "retry"]);

// A rejected key upstream becomes a generic 502 that does not leak the key.
mockFetch(401, { error: { message: "Invalid API Key secret-key-123" } });
const bad = await post({ language: "en", messages: [{ role: "user", content: "hi" }] });
assert.equal(bad.status, 502);
assert.doesNotMatch(await bad.text(), /secret/);

console.log("chat function checks passed");
