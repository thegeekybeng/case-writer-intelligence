// ============================================================
// AI Service — Server-Side Proxy Client
// All AI calls go to /api/ai/ (cwi-ai-proxy container).
// System prompt, PII masking, canary tokens, injection
// sanitization, and audit logging are all server-side.
// The browser never contacts Ollama directly.
// ============================================================

import { Message, Case, CategorizationResult, Urgency } from '../types';

const AI_BASE = '/api/ai';

// ── Chat (general assistant) ──────────────────────────────────
export const sendMessage = async (
  history: Message[],
  newMessage: string,
  mpName: string,
  constituency: string,
  division?: string
): Promise<string> => {
  try {
    const response = await fetch(`${AI_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: newMessage,
        history: history.map(h => ({ role: h.role === 'model' ? 'assistant' : h.role, content: h.content })),
        mpName,
        constituency,
        division,
      }),
    });

    if (!response.ok) throw new Error(`Proxy error: ${response.status}`);
    const data = await response.json();
    return data.response || '';
  } catch (err) {
    console.error('AI Chat Error:', err);
    return "I'm currently unavailable. Please try again shortly.";
  }
};

// ── Case notes analysis ───────────────────────────────────────
export const streamCaseAnalysis = async (notes: string, token?: string): Promise<any> => {
  try {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${AI_BASE}/analyze`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ notes }),
    });

    if (!response.ok) throw new Error(`Proxy error: ${response.status}`);
    return await response.json();
  } catch (err) {
    console.error('Analysis Error:', err);
    return { extractedFields: { name: '', nric: '', issue: '', agencies: [] }, missingInfo: [], suggestedAgencies: [] };
  }
};

// ── Case categorization ───────────────────────────────────────
export const analyzeAndCategorizeCase = async (conversation: Message[]): Promise<CategorizationResult> => {
  try {
    const response = await fetch(`${AI_BASE}/categorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation: conversation.map(m => ({ role: m.role, content: m.content })),
      }),
    });

    if (!response.ok) throw new Error(`Proxy error: ${response.status}`);
    const data = await response.json();

    // Urgency enum normalisation (server returns string, types expect enum)
    const urgencyMap: Record<string, Urgency> = {
      Low: Urgency.LOW, Medium: Urgency.MEDIUM, High: Urgency.HIGH, Critical: Urgency.CRITICAL,
    };
    return { ...data, urgency: urgencyMap[data.urgency] || Urgency.LOW } as CategorizationResult;
  } catch (e) {
    return {
      category: 'General Inquiry', subCategory: 'Assistance', urgency: Urgency.LOW,
      summary: 'Manual review needed', keyFacts: [], coreRequest: 'Under Review',
      suggestedAgencies: [], implications: [], proactiveSolutions: []
    };
  }
};

// ── Formal letter generation ──────────────────────────────────
export const generateFormalLetter = async (caseData: Case, agency: string): Promise<string> => {
  try {
    const response = await fetch(`${AI_BASE}/letter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseData, agency }),
    });

    if (!response.ok) throw new Error(`Proxy error: ${response.status}`);
    const data = await response.json();
    return data.letter || 'Error generating letter.';
  } catch (e) {
    return 'Error generating letter.';
  }
};

// ── Empathy context for agency letters ───────────────────────
export const generateEmpathyContext = async (
  riskLabels: string[],
  agency: string,
  token?: string
): Promise<string | null> => {
  try {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${AI_BASE}/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: `Write a brief empathy note (2–3 sentences) for a letter to ${agency} addressing these risk factors: ${riskLabels.join(', ')}. Focus on the human impact without overstating.`,
        history: [],
        mpName: '',
        constituency: '',
      }),
    });

    if (!response.ok) throw new Error(`Proxy error: ${response.status}`);
    const data = await response.json();
    return data.response || null;
  } catch (err) {
    console.error('Empathy Context Error:', err);
    return null;
  }
};
