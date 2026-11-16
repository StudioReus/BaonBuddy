const maxMessageLength = 2000;
const maxHistoryMessages = 10;
const maxRequestBytes = 10 * 1024;
const defaultModel = "openai/gpt-4o-mini";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

async function handleChat(request, env) {
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > maxRequestBytes) {
    return jsonResponse({ error: "The chat request is too large." }, 413);
  }

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: "Please send a valid JSON request." }, 400);
  }

  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) {
    return jsonResponse({ error: "Please enter a message." }, 400);
  }
  if (message.length > maxMessageLength) {
    return jsonResponse(
      { error: `Messages must be ${maxMessageLength} characters or fewer.` },
      400
    );
  }

  const apiKey = env.OPENROUTER_API_KEY;
  const model = env.OPENROUTER_MODEL || defaultModel;
  if (!apiKey) {
    return jsonResponse(
      { error: "OpenRouter is not configured. Add OPENROUTER_API_KEY to the Worker secrets." },
      503
    );
  }

  const history = Array.isArray(body?.history) ? body.history : [];
  const safeHistory = history.slice(-maxHistoryMessages).flatMap((turn) => {
    if (!turn || !["user", "model"].includes(turn.role) || typeof turn.text !== "string") {
      return [];
    }
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
    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
    });

    const data = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      console.error(
        `OpenRouter API returned HTTP ${upstream.status}:`,
        data?.error?.message || "No error details"
      );
      return jsonResponse(
        { error: "OpenRouter could not answer right now. Please try again in a moment." },
        502
      );
    }

    const answer = data?.choices?.[0]?.message?.content?.trim();
    if (!answer) {
      return jsonResponse(
        { error: "OpenRouter did not return a text answer. Please try rephrasing." },
        502
      );
    }
    return jsonResponse({ response: answer });
  } catch (error) {
    if (error.name === "AbortError") {
      return jsonResponse(
        { error: "OpenRouter took too long to respond. Please try again." },
        504
      );
    }
    console.error("OpenRouter request failed:", error.message);
    return jsonResponse(
      { error: "Could not reach OpenRouter. Check your connection and try again." },
      502
    );
  } finally {
    clearTimeout(timeout);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/chat") {
      if (request.method !== "POST") {
        return jsonResponse({ error: "Method not allowed." }, 405);
      }
      return handleChat(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};
