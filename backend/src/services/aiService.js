/**
 * AI Service – wraps Google Gemini 1.5 Flash.
 * Features:
 *  - Improved prompt engineering with system-level instructions
 *  - 15s timeout for Gemini API calls
 *  - In-memory response caching (hash → result, TTL 5 min)
 *  - Chapter summary method
 *  - Falls back gracefully if GEMINI_API_KEY is not set
 */

const crypto = require('crypto');

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const TIMEOUT_MS = 15000;

function getApiKey() {
  return process.env.GEMINI_API_KEY;
}

function getModel() {
  return process.env.GEMINI_MODEL || 'gemini-1.5-flash';
}

function sanitizeError(msg, key) {
  if (!msg || typeof msg !== 'string') return 'Network error calling AI service.';
  if (key && typeof key === 'string') {
    return msg.replaceAll(key, '[REDACTED]');
  }
  return msg;
}

// ── Simple in-memory cache ────────────────────────────────────────
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_ENTRIES = 200;

function cacheKey(prompt) {
  return crypto.createHash('sha256').update(prompt).digest('hex').slice(0, 16);
}

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.result;
}

function setCache(key, result) {
  // Evict oldest entries if cache is too large
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
  cache.set(key, { result, ts: Date.now() });
}

// ── Gemini API call with timeout ──────────────────────────────────
async function callGemini(prompt) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return {
      ok: false,
      error: 'AI features require a GEMINI_API_KEY environment variable. Please configure it in your backend .env file.',
    };
  }

  // Check cache first
  const key = cacheKey(prompt);
  const cached = getCached(key);
  if (cached) return cached;

  const model = getModel();
  const url = `${BASE}/${model}:generateContent?key=${apiKey}`;
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1500,
      topP: 0.9,
    },
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const rawMsg = err?.error?.message || `Gemini API error ${res.status}`;
      return { ok: false, error: sanitizeError(rawMsg, apiKey) };
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const result = { ok: true, text };

    // Cache successful responses
    setCache(key, result);
    return result;
  } catch (e) {
    clearTimeout(timeout);
    if (e.name === 'AbortError') {
      return { ok: false, error: 'AI request timed out. Please try again.' };
    }
    return { ok: false, error: sanitizeError(e.message, apiKey) };
  }
}

// ── System prompt prefix for consistent behavior ──────────────────
const SYSTEM = `You are NexusRead AI, an expert reading assistant. Your responses should be:
- Clear, well-structured, and easy to scan
- Use bullet points and headers when appropriate
- Concise but comprehensive
- Maintain a helpful, encouraging tone for readers`;

module.exports = {
  async summarize(text, bookTitle = '') {
    const prompt = `${SYSTEM}

TASK: Summarize the following passage${bookTitle ? ` from "${bookTitle}"` : ''}.

INSTRUCTIONS:
- Provide 3-5 clear, concise sentences
- Focus on key ideas, arguments, and conclusions
- Preserve the author's intent
- Use your own words, don't just rephrase

PASSAGE:
"""
${text.slice(0, 4000)}
"""`;
    return callGemini(prompt);
  },

  async explain(text) {
    const prompt = `${SYSTEM}

TASK: Explain the following paragraph in simple, clear language.

INSTRUCTIONS:
- Break down complex ideas step by step
- Define any jargon or technical terms
- Use analogies where helpful
- Keep it accessible to a general reader

PARAGRAPH:
"""
${text.slice(0, 2000)}
"""`;
    return callGemini(prompt);
  },

  async define(word, context = '') {
    const prompt = `${SYSTEM}

TASK: Define the word "${word}"${context ? ` as used in this context: "${context.slice(0, 500)}"` : ''}.

FORMAT YOUR RESPONSE AS:
**Definition:** [clear definition]
**Part of speech:** [noun/verb/adj/etc.]
**Example:** [one sentence using the word]
${context ? '**In this context:** [what it means here specifically]' : ''}`;
    return callGemini(prompt);
  },

  async ask(question, context = '') {
    const prompt = `${SYSTEM}

TASK: Answer the reader's question based on the provided book context.

CONTEXT:
"""
${context.slice(0, 3000)}
"""

QUESTION: ${question}

INSTRUCTIONS:
- Answer directly and helpfully
- Reference specific parts of the context when relevant
- If the answer isn't in the context, say so honestly and provide your best general knowledge
- Keep it focused and practical`;
    return callGemini(prompt);
  },

  async smartNotes(highlights) {
    const highlightText = highlights
      .map((h, i) => `${i + 1}. "${h.text || h}"`)
      .join('\n');
    const prompt = `${SYSTEM}

TASK: Transform these reading highlights into organized, structured notes.

INSTRUCTIONS:
- Group related ideas under clear headers
- Add brief context or explanation where needed
- Format as clean bullet points
- Identify themes or connections between highlights

HIGHLIGHTS:
${highlightText.slice(0, 4000)}`;
    return callGemini(prompt);
  },

  async chapterSummary(text, chapterTitle = '', bookTitle = '') {
    const prompt = `${SYSTEM}

TASK: Provide a comprehensive chapter summary${chapterTitle ? ` for "${chapterTitle}"` : ''}${bookTitle ? ` from "${bookTitle}"` : ''}.

INSTRUCTIONS:
Format your response with these sections:
**📋 Summary** — 3-5 sentence overview of the chapter
**🎯 Key Themes** — Main themes or ideas (bullet points)
**👥 Key Characters/Concepts** — Important people, places, or concepts introduced
**💡 Key Takeaways** — 2-3 most important things to remember
**🔗 Connections** — How this connects to broader themes (if apparent)

CHAPTER TEXT:
"""
${text.slice(0, 5000)}
"""`;
    return callGemini(prompt);
  },
};
