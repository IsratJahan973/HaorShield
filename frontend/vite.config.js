import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { onRequestPost } from "./functions/api/chat.js";

export default defineConfig(({ mode }) => {
  // Server-side only: Vite exposes VITE_* to the browser, never CHAT_*.
  const chatEnv = loadEnv(mode, process.cwd(), "CHAT_");
  return {
    plugins: [
      react(),
      {
        // Local stand-in for the Cloudflare Pages Function at functions/api/chat.js.
        name: "dev-chat-function",
        configureServer(server) {
          server.middlewares.use("/api/chat", async (req, res) => {
            if (req.method !== "POST") {
              res.statusCode = 405;
              return res.end();
            }
            let body = "";
            for await (const chunk of req) body += chunk;
            const response = await onRequestPost({
              request: new Request("http://localhost/api/chat", { method: "POST", body }),
              env: chatEnv
            });
            res.statusCode = response.status;
            res.setHeader("content-type", "application/json");
            res.end(await response.text());
          });
        }
      }
    ]
  };
});
