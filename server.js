const express = require("express");
const path = require("node:path");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;
const maxMessageLength = 2000;
const maxHistoryMessages = 10;
const defaultModel = "openai/gpt-4o-mini";

// Keep request bodies small; never put the OpenRouter API key in browser code.
app.use(express.json({ limit: "10kb" }));
app.use(express.static(__dirname));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/chat", async (req, res) => {
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";

  if (!message) {
    return res.status(400).json({ error: "Please enter a message." });
  }
  if (message.length > maxMessageLength) {
    return res.status(400).json({ error: `Messages must be ${maxMessageLength} characters or fewer.` });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || defaultModel;
  if (!apiKey) {
    return res.status(503).json({ error: "OpenRouter is not configured yet. Add OPENROUTER_API_KEY to the server's .env file." });
  }

  const history = Array.isArray(req.body?.history) ? req.body.history : [];
  const safeHistory = history.slice(-maxHistoryMessages).flatMap((turn) => {
    if (!turn || !["user", "model"].includes(turn.role) || typeof turn.text !== "string") return [];
    const text = turn.text.trim().slice(0, maxMessageLength);
    const role = turn.role === "model" ? "assistant" : "user";
    return text ? [{ role, content: text }] : [];
  });
  const messages = [
    {
      role: "system",
      content: "You are BaonBuddy, a warm and practical budgeting helper for students managing Philippine pesos. Give clear, supportive, general budgeting suggestions. Do not claim to be a financial professional, and do not ask users to share passwords, account numbers, or other sensitive information. Keep answers concise.",
    },
    ...safeHistory,
    { role: "user", content: message },
  ];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const upstream = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: 512,
          temperature: 0.7,
        }),
        signal: controller.signal,
      }
    );

    const data = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      // Avoid returning provider details or credentials to the browser.
      console.error(`OpenRouter API returned HTTP ${upstream.status}:`, data?.error?.message || "No error details");
      return res.status(502).json({ error: "OpenRouter could not answer right now. Please try again in a moment." });
    }

    const answer = data?.choices?.[0]?.message?.content?.trim();

    if (!answer) {
      return res.status(502).json({ error: "OpenRouter did not return a text answer. Please try rephrasing." });
    }

    return res.json({ response: answer });
  } catch (error) {
    if (error.name === "AbortError") {
      return res.status(504).json({ error: "OpenRouter took too long to respond. Please try again." });
    }
    console.error("OpenRouter request failed:", error.message);
    return res.status(502).json({ error: "Could not reach OpenRouter. Check your connection and try again." });
  } finally {
    clearTimeout(timeout);
  }
});

app.listen(port, () => {
  console.log(`BaonBuddy is running at http://localhost:${port}`);
});
