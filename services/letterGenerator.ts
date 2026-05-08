/**
 * Deterministic Letter Assembly Engine for CWI.
 *
 * Assembles formal MP appeal letters from Causality Engine output.
 * - Template-driven: facts and requests come from CausalGraph, not LLM creativity
 * - PDPA-compliant: all PII is ██ placeholder markers, never stored in CWI
 * - Agency-specific: each letter front-loads facts relevant to the receiving agency
 * - Optional empathy layer: short Ollama-generated CONTEXT section from
 *   hidden_risk/consequence nodes (the one LLM call that earns its keep)
 *
 * Why template assembly over LLM generation:
 * Shawn's ex-colleagues in civil service need to extract the action item in
 * 10 seconds. Consistency at scale beats creativity. Deterministic structure
 * ensures every letter looks like it was written by the same senior case writer.
 */

import { CausalGraph, AgencyRoute, WriterProfile } from '../types';
import { getAgencyTemplate, RESIDENT_PLACEHOLDERS, resolveWriterPlaceholders } from '../constants/agencyTemplates';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GeneratedLetter {
  agency: string;
  agencyLabel: string;
  content: string;
  order: number;
  priority: 'primary' | 'secondary' | 'long_term';
  hasContext: boolean;
}

export interface LetterGenerationResult {
  letters: GeneratedLetter[];
  generatedAt: string;
  caseFactCount: number;
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

function formatDate(): string {
  return new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Select and order facts from the causal graph based on agency domain relevance.
 * Front-loads nodes whose domain matches the agency's priority domains.
 *
 * Why scoring instead of simple filtering:
 * A case about employment loss leading to housing risk should show employment
 * facts first for MOM, but housing facts first for HDB — same data, different
 * ordering. The domain match score + node type weight achieves this.
 */
function selectFacts(
  graph: CausalGraph,
  agencyDomains: string[],
  maxFacts: number = 5
): string[] {
  const factNodeTypes = ['root_cause', 'presenting_problem', 'intermediate'];
  const factNodes = graph.nodes.filter(n => factNodeTypes.includes(n.type));

  const scored = factNodes.map(node => {
    const domainIndex = agencyDomains.indexOf(node.domain);
    // Higher score = shown first. Domain match is weighted heavily.
    const domainScore = domainIndex >= 0
      ? (agencyDomains.length - domainIndex) * 10
      : 0;
    const typeScore = node.type === 'root_cause' ? 5
      : node.type === 'presenting_problem' ? 3
      : 1;
    return { node, score: domainScore + typeScore + node.confidence };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxFacts).map(s => s.node.label);
}

/**
 * Extract human context material from hidden_risk and consequence nodes.
 * These are the raw inputs for the optional Ollama empathy pass.
 */
export function extractContextMaterial(graph: CausalGraph): string[] {
  return graph.nodes
    .filter(n => n.type === 'hidden_risk' || n.type === 'consequence')
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3)
    .map(n => n.label);
}

/**
 * Build the cross-referral line from agency routes.
 * Tells the receiving agency who else is involved — prevents duplication.
 */
function buildCrossReferral(
  allRoutes: AgencyRoute[],
  currentAgency: string
): string | null {
  const others = allRoutes
    .filter(r =>
      r.agency !== currentAgency &&
      (r.priority === 'primary' || r.priority === 'secondary')
    )
    .map(r => r.agency);

  if (others.length === 0) return null;
  return `Concurrent letters have been sent to: ${others.join(', ')}.`;
}

// ─── Core Assembly ───────────────────────────────────────────────────────────

/**
 * Assemble a single letter for one agency from the Causality Engine output.
 *
 * Structure rationale (top to bottom):
 * - Header: PDPA warning banner — unmissable
 * - RE line: who this is about (placeholders)
 * - SUBJECT: one-line triage for the civil servant
 * - FACTS: numbered, scannable, domain-weighted for this agency
 * - REQUEST: explicit action item from agencyRoute.specificAsk
 * - CONTEXT: optional empathy layer — what's at stake (LLM-generated)
 * - CROSS-REFERRAL: who else is involved
 * - Urgency line: conditional, only for Critical/High
 * - Closing: formal MP sign-off (placeholders)
 */
function assembleLetter(
  graph: CausalGraph,
  route: AgencyRoute,
  order: number,
  contextSentences?: string,
  profile?: WriterProfile | null
): GeneratedLetter {
  const writer = resolveWriterPlaceholders(profile);
  const template = getAgencyTemplate(route.agency);
  const facts = selectFacts(graph, template.domains);
  const crossRef = buildCrossReferral(graph.agencyRoutes, route.agency);
  const isUrgent =
    graph.urgency.overall === 'Critical' ||
    graph.urgency.overall === 'High';

  const lines: string[] = [];

  // ── Header Block ──
  lines.push('══════════════════════════════════════════════');
  lines.push('⚠️  COMPLETE BEFORE SENDING VIA GATHER  ⚠️');
  lines.push('══════════════════════════════════════════════');
  lines.push('');
  lines.push(
    `RE: Appeal — ${RESIDENT_PLACEHOLDERS.residentName} (${RESIDENT_PLACEHOLDERS.nric})`
  );
  lines.push(
    `MP: ${writer.mpName}, Member of Parliament for ${writer.constituency}`
  );
  lines.push(`Date: ${formatDate()}`);

  // Agency-specific placeholders reminder
  if (template.placeholders.length > 0) {
    lines.push('');
    lines.push(
      `Agency-specific fields to complete: ${template.placeholders.join(', ')}`
    );
  }

  lines.push('');
  lines.push(`To: ${template.label}`);
  lines.push('');
  lines.push('Dear Sir/Madam,');
  lines.push('');

  // ── Subject ──
  lines.push(`SUBJECT: ${route.specificAsk}`);
  lines.push('');

  // ── Facts ──
  lines.push('FACTS:');
  facts.forEach((fact, i) => {
    lines.push(`${i + 1}. ${fact}`);
  });
  lines.push('');

  // ── Request ──
  lines.push('REQUEST:');
  lines.push(route.specificAsk);
  lines.push('');

  // ── Context (Empathy Layer — optional) ──
  if (contextSentences) {
    lines.push('CONTEXT:');
    lines.push(contextSentences);
    lines.push('');
  }

  // ── Cross-Referral ──
  if (crossRef) {
    lines.push('CROSS-REFERRAL:');
    lines.push(crossRef);
    lines.push('');
  }

  // ── Urgency ──
  if (isUrgent) {
    lines.push(
      'Given the time-sensitive nature of this matter, I would appreciate your urgent attention.'
    );
    lines.push('');
  }

  // ── Closing ──
  lines.push('Yours faithfully,');
  lines.push(writer.mpName);
  lines.push(
    `Member of Parliament for ${writer.constituency}`
  );
  if (profile?.writerName) {
    lines.push('');
    lines.push(`Prepared by: ${profile.writerName}`);
  }

  return {
    agency: route.agency,
    agencyLabel: template.label,
    content: lines.join('\n'),
    order,
    priority: route.priority,
    hasContext: Boolean(contextSentences),
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate all letters for a case from the Causality Engine output.
 * Returns letters ordered by the document queue priority.
 *
 * contextMap: optional pre-generated empathy context per agency (from Ollama).
 * If not provided, letters are generated without the CONTEXT section.
 */
export function generateAllLetters(
  graph: CausalGraph,
  contextMap?: Record<string, string>,
  profile?: WriterProfile | null
): LetterGenerationResult {
  // Use document queue ordering if available, otherwise agency route order
  const orderedRoutes = [...graph.agencyRoutes].sort((a, b) => {
    const aQueue = graph.documentQueue.find(d => d.agency === a.agency);
    const bQueue = graph.documentQueue.find(d => d.agency === b.agency);
    return (aQueue?.order ?? 999) - (bQueue?.order ?? 999);
  });

  const letters = orderedRoutes.map((route, idx) => {
    const context = contextMap?.[route.agency];
    return assembleLetter(graph, route, idx + 1, context, profile);
  });

  return {
    letters,
    generatedAt: new Date().toISOString(),
    caseFactCount: graph.nodes.filter(n =>
      n.type === 'root_cause' ||
      n.type === 'presenting_problem' ||
      n.type === 'intermediate'
    ).length,
  };
}

/**
 * Generate a single letter for one agency.
 * Used when the writer selects a specific agency for regeneration.
 */
export function generateSingleLetter(
  graph: CausalGraph,
  agency: string,
  context?: string,
  profile?: WriterProfile | null
): GeneratedLetter | null {
  const route = graph.agencyRoutes.find(r => r.agency === agency);
  if (!route) return null;

  const queueItem = graph.documentQueue.find(d => d.agency === agency);
  return assembleLetter(graph, route, queueItem?.order ?? 1, context, profile);
}
