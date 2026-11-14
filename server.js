const express = require("express");
const path = require("node:path");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;
const maxMessageLength = 2000;
const maxHistoryMessages = 10;
const defaultModel = "gemini-2.5-flash";

// Keep request bodies small; never put the Gemini API key in browser code.
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

  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || defaultModel;
  if (!apiKey) {
    return res.status(503).json({ error: "Gemini is not configured yet. Add GEMINI_API_KEY to the server's .env file." });
  }

  const history = Array.isArray(req.body?.history) ? req.body.history : [];
  const safeHistory = history.slice(-maxHistoryMessages).flatMap((turn) => {
    if (!turn || !["user", "model"].includes(turn.role) || typeof turn.text !== "string") return [];
    const text = turn.text.trim().slice(0, maxMessageLength);
    return text ? [{ role: turn.role, parts: [{ text }] }] : [];
  });
  const contents = [...safeHistory, { role: "user", parts: [{ text: message }] }];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: "You are BaonBuddy, a warm and practical budgeting helper for students managing Philippine pesos. Give clear, supportive, general budgeting suggestions. Do not claim to be a financial professional, and do not ask users to share passwords, account numbers, or other sensitive information. Keep answers concise.",
            }],
          },
          contents,
          generationConfig: { maxOutputTokens: 512, temperature: 0.7 },
        }),
        signal: controller.signal,
      }
    );

    const data = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      // Avoid returning provider details or credentials to the browser.
      console.error(`Gemini API returned HTTP ${upstream.status}:`, data?.error?.message || "No error details");
      return res.status(502).json({ error: "Gemini could not answer right now. Please try again in a moment." });
    }

    const answer = data?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim();

    if (!answer) {
      return res.status(502).json({ error: "Gemini did not return a text answer. Please try rephrasing." });
    }

    return res.json({ response: answer });
  } catch (error) {
    if (error.name === "AbortError") {
      return res.status(504).json({ error: "Gemini took too long to respond. Please try again." });
    }
    console.error("Gemini request failed:", error.message);
    return res.status(502).json({ error: "Could not reach Gemini. Check your connection and try again." });
  } finally {
    clearTimeout(timeout);
  }
});

app.listen(port, () => {
  console.log(`BaonBuddy is running at http://localhost:${port}`);
});
