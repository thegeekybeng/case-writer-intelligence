/**
 * Causality Engine — Domain-Configurable 3-Stage Causal Analysis Pipeline.
 *
 * Architecture: Foundation → Reasoning → Action
 * - Foundation (Stage 1+2): Extract entities and reconstruct timeline
 * - Reasoning (Stage 3+4): Build causal graph and identify information gaps
 * - Action (Stage 5+6+7): Score urgency, route to targets, build document queue
 *
 * The pipeline is domain-agnostic. All domain-specific content (persona,
 * taxonomy, routing targets, rules) comes from a CausalityDomainConfig.
 * Default: MPS_SINGAPORE (Singapore Meet-the-People Session analysis).
 *
 * To deploy for a different domain:
 *   import { MY_DOMAIN } from '../constants/causalityDomains';
 *   runCausalityEngine(notes, onProgress, MY_DOMAIN);
 */

import OpenAI from 'openai';
import {
  CausalEntity, TimelineEvent, CausalNode, CausalGap,
  UrgencyAssessment, AgencyRoute, DocumentQueueItem,
  CausalGraph, Urgency
} from '../types';
import { CausalityDomainConfig, DEFAULT_DOMAIN } from '../constants/causalityDomains';

const ENGINE_VERSION = '2.2.0';

const OLLAMA_API_KEY = 'ollama';

const rawApiBase = typeof process.env.OLLAMA_HOST !== 'undefined'
  ? process.env.OLLAMA_HOST
  : '/api/v1/';

const OLLAMA_API_BASE = rawApiBase.startsWith('/')
  ? `${window.location.origin}${rawApiBase}`
  : rawApiBase;

const OLLAMA_MODEL = typeof process.env.AI_MODEL !== 'undefined'
  ? process.env.AI_MODEL
  : 'gemma4:e2b';

let _client: OpenAI | null = null;
let _lastApiBase: string | null = null;

function getClient() {
  const currentApiBase = rawApiBase.startsWith('/')
    ? `${window.location.origin}${rawApiBase}`
    : rawApiBase;

  // Reset singleton if the dynamically evaluated URL changes
  if (_client && _lastApiBase !== currentApiBase) {
    _client = null;
  }
  _lastApiBase = currentApiBase;

  if (!_client) {
    if (!OLLAMA_API_KEY) throw new Error('OLLAMA_API_KEY not configured');
    _client = new OpenAI({
      apiKey: OLLAMA_API_KEY,
      baseURL: currentApiBase,
      dangerouslyAllowBrowser: true, // Vite project, running in client
    });
  }
  return _client;
}

async function callLLM<T>(prompt: string, systemPrompt?: string): Promise<T> {
  const completion = await getClient().chat.completions.create({
    model: OLLAMA_MODEL,
    messages: [
      { 
        role: 'system', 
        content: systemPrompt || 'You are an advanced causal analysis engine. Extract structure and logic from unstructured text. Return only valid JSON.' 
      },
      { role: 'user', content: prompt }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  });
  
  const content = completion.choices[0].message.content;
  if (!content) throw new Error('Empty response from LLM');
  
  return JSON.parse(content) as T;
}

// ─── Stage 1 + 2: Foundation ──────────────────────────────────────────────
// Extract all entities and reconstruct the timeline in a single call.

async function runFoundationStage(
  notes: string,
  config: CausalityDomainConfig
): Promise<{
  entities: CausalEntity[];
  timeline: TimelineEvent[];
}> {
  const prompt = `
You are ${config.analystPersona}.
Analyse these raw ${config.inputLabel}.

NOTES:
${notes}

Return a single JSON object with two keys:

"entities": array of every distinct entity in the case.
Each entity: { "type", "name", "details", "firstMentioned" }
type must be one of: person | condition | event | agency | resource | obligation
firstMentioned: approximate date string or "unknown"

"timeline": chronological sequence of events reconstructed from the notes.
Each event: { "date", "event", "entityRefs", "isRootCause", "currentStatus" }
date: ISO string if known, or descriptive string like "~3 months ago"
entityRefs: array of entity names involved in this event
isRootCause: boolean — true only for the earliest causal event(s)
currentStatus: "past" | "ongoing" | "imminent"

Rules:
${config.foundationRules}
`.trim();

  return callLLM<{ entities: CausalEntity[]; timeline: TimelineEvent[] }>(
    prompt,
    `You are ${config.analystPersona}. Your goal is to extract foundational entities and reconstruct the factual timeline.`
  );
}

// ─── Stage 3 + 4: Reasoning ───────────────────────────────────────────────
// Build the causal graph and identify information gaps.

async function runReasoningStage(
  notes: string,
  entities: CausalEntity[],
  timeline: TimelineEvent[],
  config: CausalityDomainConfig
): Promise<{ nodes: CausalNode[]; gaps: CausalGap[] }> {
  const domainEnum = config.domains.map(d => `"${d}"`).join(' | ');

  const prompt = `
You are ${config.analystPersona}.

ORIGINAL NOTES:
${notes}

EXTRACTED ENTITIES:
${JSON.stringify(entities, null, 2)}

TIMELINE:
${JSON.stringify(timeline, null, 2)}

Build a causal graph and identify information gaps.
Return a single JSON object with two keys:

"nodes": the causal graph nodes.
Each node: { "id", "label", "type", "causes", "effects", "confidence", "domain" }
id: short snake_case identifier e.g. "debt_accumulation"
label: human-readable phrase
type: "root_cause" | "intermediate" | "presenting_problem" | "hidden_risk" | "consequence"
causes: array of node ids that directly cause this node (empty for root causes)
effects: array of node ids this node directly causes
confidence: 0.0–1.0 based on how clearly the notes support this link
domain: ${domainEnum}

"gaps": missing information that breaks or weakens the causal chain.
Each gap: { "description", "affectedNodeIds", "severity", "questionToAsk" }
severity: "blocking" | "important" | "nice_to_have"
questionToAsk: the exact question to ask to fill this gap

Rules:
${config.reasoningRules}
`.trim();

  return callLLM<{ nodes: CausalNode[]; gaps: CausalGap[] }>(
    prompt,
    `You are ${config.analystPersona}. Your goal is to build a high-fidelity causal graph and detect hidden information gaps.`
  );
}

// ─── Stage 5 + 6 + 7: Action ──────────────────────────────────────────────
// Score urgency, route to targets, and build the document queue.

async function runActionStage(
  nodes: CausalNode[],
  gaps: CausalGap[],
  timeline: TimelineEvent[],
  config: CausalityDomainConfig
): Promise<{
  urgency: UrgencyAssessment;
  agencyRoutes: AgencyRoute[];
  documentQueue: DocumentQueueItem[];
}> {
  const prompt = `
You are ${config.analystPersona}.

CAUSAL GRAPH NODES:
${JSON.stringify(nodes, null, 2)}

INFORMATION GAPS:
${JSON.stringify(gaps, null, 2)}

TIMELINE:
${JSON.stringify(timeline, null, 2)}

${config.routingTargets}

Return a single JSON object with three keys:

"urgency": overall urgency assessment.
{ "overall", "rationale", "timeSensitiveFactors", "criticalPathNodeIds" }
overall: "Low" | "Medium" | "High" | "Critical"
criticalPathNodeIds: the chain of node ids that drives the urgency score

"agencyRoutes": ordered list of referrals/escalations.
Each route: { "agency", "priority", "addressesNodeIds", "specificAsk", "estimatedProcessingDays", "prerequisiteAgencies" }
priority: "primary" | "secondary" | "long_term"
specificAsk: exact action needed from this target for this case
estimatedProcessingDays: realistic processing estimate
prerequisiteAgencies: targets that must be contacted before this one

"documentQueue": ordered list of documents to generate.
Each item: { "order", "type", "agency", "subject", "urgency", "dependsOn" }
type: "letter" | "referral" | "internal_note" | "follow_up"
order: integer starting at 1
dependsOn: target names whose documents must be sent first

Rules:
${config.actionRules}
`.trim();

  return callLLM<{
    urgency: UrgencyAssessment;
    agencyRoutes: AgencyRoute[];
    documentQueue: DocumentQueueItem[];
  }>(
    prompt,
    `You are ${config.analystPersona}. Your goal is to assess urgency and provide concrete action steps for triage.`
  );
}

// ─── Public API ───────────────────────────────────────────────────────────

export type CausalityEngineProgress =
  | { stage: 'foundation'; message: string }
  | { stage: 'reasoning'; message: string }
  | { stage: 'action'; message: string }
  | { stage: 'complete'; graph: CausalGraph };

/**
 * Run the full Causality Engine pipeline.
 *
 * @param notes - Raw unstructured text to analyse
 * @param onProgress - Optional progress callback for UI updates
 * @param domain - Domain config. Defaults to MPS_SINGAPORE.
 */
export async function runCausalityEngine(
  notes: string,
  onProgress?: (update: CausalityEngineProgress) => void,
  domain: CausalityDomainConfig = DEFAULT_DOMAIN
): Promise<CausalGraph> {
  onProgress?.({ stage: 'foundation', message: 'Extracting entities and building timeline…' });
  const { entities, timeline } = await runFoundationStage(notes, domain);

  onProgress?.({ stage: 'reasoning', message: 'Constructing causal graph and detecting gaps…' });
  const { nodes, gaps } = await runReasoningStage(notes, entities, timeline, domain);

  onProgress?.({ stage: 'action', message: 'Scoring urgency and routing to agencies…' });
  const { urgency, agencyRoutes, documentQueue } = await runActionStage(nodes, gaps, timeline, domain);

  // Normalise urgency enum value from API string output
  const normalisedUrgency: UrgencyAssessment = {
    ...urgency,
    overall: urgency.overall as Urgency,
  };

  const graph: CausalGraph = {
    entities,
    timeline,
    nodes,
    gaps,
    urgency: normalisedUrgency,
    agencyRoutes,
    documentQueue,
    engineVersion: ENGINE_VERSION,
    processedAt: new Date().toISOString(),
  };

  onProgress?.({ stage: 'complete', graph });
  return graph;
}

export function isCausalityEngineAvailable(): boolean {
  return Boolean(OLLAMA_API_KEY);
}
