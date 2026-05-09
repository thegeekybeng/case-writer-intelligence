
import { Message, Case, CategorizationResult, Urgency } from '../types';

/**
 * 100% LOCAL AI SERVICE (ZERO COST)
 * Performance tuned with caching, reduced timeouts, and optimized prompts.
 */

// Use Vite-exposed environment variables
// OLLAMA_HOST is already the versioned base path (e.g. /api/v1)
// so we only append /chat/completions — not /v1/chat/completions
const OLLAMA_ENDPOINT = typeof process.env.OLLAMA_HOST !== 'undefined'
  ? `${process.env.OLLAMA_HOST}/chat/completions`
  : '/api/v1/chat/completions';
const OLLAMA_MODEL = typeof process.env.AI_MODEL !== 'undefined'
  ? process.env.AI_MODEL
  : 'gemma4:e2b';



// --- PERFORMANCE TUNING ---
const TIMEOUT_MS = 30000; // Reduced from 60s to 30s
const CACHE = new Map<string, { response: string; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minute cache

// Response cleaner
function cleanResponse(text: string): string {
  const sectionsToRemove = [
    /Semantic Resolution Update:.*?(?=\n\n|$)/gi,
    /Identity Report:.*?(?=\n\n|$)/gi,
    /Internal State:.*?(?=\n\n|$)/gi,
    /Action Taken:.*?(?=\n\n|$)/gi,
    /Semantic Vectors Compiled:.*/gi,
    /\[SYSTEM:.*?\]/gi,
  ];

  let cleaned = text;
  for (const pattern of sectionsToRemove) {
    cleaned = cleaned.replace(pattern, '');
  }
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
  return cleaned;
}

function getCachedResponse(key: string): string | null {
  const cached = CACHE.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.response;
  }
  return null;
}

function setCacheResponse(key: string, response: string) {
  CACHE.set(key, { response, timestamp: Date.now() });
  if (CACHE.size > 100) {
    const firstKey = CACHE.keys().next().value;
    if (firstKey) CACHE.delete(firstKey);
  }
}

// Max input length to prevent runaway token usage
const MAX_INPUT_CHARS = 5000;

// NRIC pattern (Singapore) — mask before any AI dispatch
const NRIC_PATTERN = /[STFGM]\d{7}[A-Z]/gi;
function maskPII(text: string): string {
  return text.replace(NRIC_PATTERN, '[NRIC REDACTED]');
}

// Prompt injection defence — PI-04, PI-05, PI-06
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous\s+)?instructions?/gi,
  /disregard\s+(all\s+)?(previous\s+)?instructions?/gi,
  /forget\s+(all\s+)?(previous\s+)?instructions?/gi,
  /override\s+(system\s+)?instructions?/gi,
  /you\s+are\s+now\s+/gi,
  /new\s+system\s+prompt\s*:/gi,
  /<<\/?SYS>>/g,
  /\[INST\]|\[\/INST\]/g,
  /<\/?system>/gi,
  /act\s+as\s+(if\s+you\s+are|an?\s+)/gi,
];
function sanitizePromptInput(text: string): string {
  if (!text || typeof text !== 'string') return '';
  let s = maskPII(text);
  for (const p of INJECTION_PATTERNS) s = s.replace(p, '[FILTERED]');
  return s;
}

function generateCacheKey(history: Message[], newMessage: string): string {
  const recent = history.slice(-3).map(h => h.content.substring(0, 50)).join('|');
  return `${recent}|${newMessage.substring(0, 50)}`;
}

export const getSystemInstruction = (mpName: string, constituency: string, division?: string) => `
You are the friendly constituency assistant for ${mpName}, MP for ${constituency}${division ? ` (${division})` : ''}.

**YOUR VOICE:**
- Warm, empathetic, professional
- Simple, clear language
- Never use jargon
- Address concerns directly

Be conversational and helpful.
`;

export const sendMessageToGemini = async (
  history: Message[],
  newMessage: string,
  mpName: string,
  constituency: string,
  division?: string,
  images?: string[],
  audioBase64?: string
): Promise<string> => {
  try {
    const systemInstruction = getSystemInstruction(mpName, constituency, division);

    // Check cache
    const cacheKey = generateCacheKey(history, newMessage);
    const cached = getCachedResponse(cacheKey);
    if (cached) return cached;

    let prompt = sanitizePromptInput(newMessage.slice(0, MAX_INPUT_CHARS));
    if (audioBase64) prompt += "\n\n[Audio message - respond with empathy]";
    if (images?.length) prompt += `\n\n[${images.length} image(s) attached]`;

    const response = await fetch(OLLAMA_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          { role: "system", content: systemInstruction },
          // PI-05: sanitize history entries to prevent conversation poisoning
          ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: sanitizePromptInput(h.content.slice(0, MAX_INPUT_CHARS)) })),
          { role: "user", content: prompt }
        ],
        max_tokens: 512,  // Limit response length
        temperature: 0.7,
      })
    });

    if (!response.ok) throw new Error("AI offline");
    const data = await response.json();
    const cleaned = cleanResponse(data.choices[0].message.content);
    setCacheResponse(cacheKey, cleaned);
    return cleaned;
  } catch (error) {
    return "I'm currently offline. Please try again shortly.";
  }
};

export const streamCaseAnalysis = async (notes: string): Promise<any> => {
  const sanitized = maskPII(notes.slice(0, MAX_INPUT_CHARS));
  const prompt = `
Extract into JSON:
- name, nric (masked), issue, agencies
- missingInfo (questions to complete case)
- suggestedAgencies

NOTES:
${sanitized}
`;

  try {
    const response = await fetch(OLLAMA_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 512,
        response_format: { type: "json_object" }
      })
    });
    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  } catch (e) {
    return { extractedFields: { name: "", nric: "", issue: "", agencies: [] }, missingInfo: [], suggestedAgencies: [] };
  }
};

export const analyzeAndCategorizeCase = async (conversation: Message[]): Promise<CategorizationResult> => {
  const conversationText = conversation
    .map(msg => `[${msg.role.toUpperCase()}]: ${maskPII(msg.content.slice(0, MAX_INPUT_CHARS))}`)
    .join('\n');

  const analysisPrompt = `
Categorize this case:

${conversationText}

Return JSON:
{
  "category": "Housing|Immigration|Finance|Legal|Other",
  "subCategory": "specific",
  "urgency": "Low|Medium|High|Critical",
  "summary": "brief",
  "keyFacts": ["fact"],
  "coreRequest": "what they need",
  "suggestedAgencies": ["HDB|ICA|MSF|MOM"],
  "implications": ["impact"],
  "proactiveSolutions": ["solution"]
}
`;

  try {
    const response = await fetch(OLLAMA_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [{ role: "user", content: analysisPrompt }],
        max_tokens: 768,
        response_format: { type: "json_object" }
      })
    });
    const data = await response.json();
    return JSON.parse(cleanResponse(data.choices[0].message.content)) as CategorizationResult;
  } catch (e) {
    return {
      category: "General Inquiry", subCategory: "Assistance", urgency: Urgency.LOW,
      summary: "Manual review needed", keyFacts: [], coreRequest: "Under Review",
      suggestedAgencies: [], implications: [], proactiveSolutions: []
    };
  }
};

export const generateFormalLetter = async (caseData: Case, agency: string): Promise<string> => {
  // PI-04: AI-generated intermediary data may carry injected content — sanitize before reuse
  const safeName = sanitizePromptInput(caseData.residentName || '').slice(0, 100);
  const safeRequest = sanitizePromptInput(caseData.coreRequest || '').slice(0, 500);
  const safeFacts = (caseData.keyFacts || []).map(f => sanitizePromptInput(f).slice(0, 200)).join(', ');
  const safeImplications = (caseData.implications || []).map(i => sanitizePromptInput(i).slice(0, 200)).join('; ');

  const prompt = `Write a brief letter (max 150 words) from MP ${caseData.mpName} to ${sanitizePromptInput(agency)}:

Resident: ${safeName}
Issue: ${safeRequest}
Facts: ${safeFacts}
Context: ${safeImplications}

Format: Opening -> Facts -> Request -> Closing. Clear and concise.`;

  try {
    const response = await fetch(OLLAMA_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          { role: "system", content: "You are a helpful Constituency Case-writer." },
          { role: "user", content: prompt }
        ],
        max_tokens: 256
      })
    });
    const data = await response.json();
    return cleanResponse(data.choices[0].message.content) || "Error generating draft.";
  } catch (e) {
    return "Error generating draft.";
  }
};

export const generateTTS = async (text: string): Promise<string | null> => {
  return null; // Disabled
};

export const explainAIReasoning = async (context: string, urgency: string): Promise<string> => {
  try {
    const response = await fetch(OLLAMA_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [{ role: "user", content: `Why is this ${urgency}: ${context}` }],
        max_tokens: 128
      })
    });
    const data = await response.json();
    return cleanResponse(data.choices[0].message.content) || "Unavailable.";
  } catch (e) { return "Unavailable."; }
};

/**
 * Generate 2-3 empathetic sentences for the CONTEXT section of an agency letter.
 *
 * Why this exists:
 * Facts get the civil servant to process. The human story gets them to care.
 * Sometimes that's the difference between "approved" and "pending further review".
 *
 * Input: hidden_risk and consequence labels from the Causality Engine.
 * Output: short human paragraph — what's at stake if nobody acts.
 * Temperature 0.4 for consistency across regenerations.
 */
export const generateEmpathyContext = async (
  riskLabels: string[],
  agency: string
): Promise<string> => {
  if (riskLabels.length === 0) return '';

  const prompt = `You are writing the CONTEXT section of an MP's appeal letter to ${agency} in Singapore.

Below are the hidden risks and potential consequences if this resident's situation is not addressed:
${riskLabels.map((r, i) => `${i + 1}. ${r}`).join('\n')}

Write 2-3 sentences that convey the human impact of these risks. Be empathetic but factual. No dramatic language. No adjectives like "desperate" or "heartbreaking". Just — what is at stake for this person and their family if nothing is done.

Do not add any facts not listed above. Do not use placeholder names. Keep under 60 words.`;

  try {
    const response = await fetch(OLLAMA_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          { role: "system", content: "You are a constituency case writer. Write with empathy, not drama." },
          { role: "user", content: prompt }
        ],
        max_tokens: 128,
        temperature: 0.4,
      })
    });
    const data = await response.json();
    return cleanResponse(data.choices[0].message.content) || '';
  } catch (e) {
    return '';
  }
};

