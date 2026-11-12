const express = require("express");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

// Keep request bodies small; add any CORS configuration needed by your frontend host.
app.use(express.json({ limit: "10kb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/chat", async (req, res) => {
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";

  if (!message) {
    return res.status(400).json({ error: "A message is required." });
  }

  // TODO: Add your AI provider API call here.
  // Read credentials from process.env (for example, process.env.AI_API_KEY).
  // Never send API keys to the browser or commit a real .env file.
  return res.status(501).json({ error: "Chat API is not configured yet." });
});

app.listen(port, () => {
  console.log(`BaonBuddy backend listening on port ${port}`);
});
