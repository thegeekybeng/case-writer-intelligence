/**
 * Causality Engine — Domain Configuration System.
 *
 * The engine's 3-stage pipeline (Foundation → Reasoning → Action) is generic.
 * What makes it domain-specific is the prompt content: analyst persona, input
 * framing, domain taxonomy, routing targets, and sequencing rules.
 *
 * This file defines the config interface and houses domain configurations.
 * To deploy the engine for a new use case, add a config here — no engine
 * code changes needed.
 *
 * Option A architecture: single engine, swappable configs.
 * When 3+ domains exist, extract to Option B (standalone package).
 */

// ─── Domain Config Interface ─────────────────────────────────────────────────

export interface CausalityDomainConfig {
  /** Short identifier, e.g. "mps_singapore", "it_incident" */
  id: string;

  /** Human-readable name shown in UI */
  label: string;

  /** The analyst role injected into every prompt */
  analystPersona: string;

  /** What the input text is called, e.g. "interview notes", "incident report" */
  inputLabel: string;

  /**
   * Domain taxonomy for causal node classification.
   * Must be pipe-delimited for prompt injection, e.g. ["housing", "financial", "health"]
   */
  domains: string[];

  /**
   * Known routing targets (agencies, teams, departments) with descriptions.
   * Injected into Stage 3 (Action) prompt.
   */
  routingTargets: string;

  /**
   * Additional rules for entity/timeline extraction (Stage 1).
   * Domain-specific guidance beyond the generic extraction prompt.
   */
  foundationRules: string;

  /**
   * Additional rules for causal graph construction (Stage 3–4).
   * Domain-specific guidance for node typing and gap detection.
   */
  reasoningRules: string;

  /**
   * Agency/team routing and sequencing rules (Stage 5–7).
   * Defines priority logic and dependency ordering.
   */
  actionRules: string;
}

// ─── MPS Singapore Domain ────────────────────────────────────────────────────
// The original CWI domain. Meet-the-People Session case analysis
// for Singapore constituency case writers.

export const MPS_SINGAPORE: CausalityDomainConfig = {
  id: 'mps_singapore',
  label: 'MPS Case Analysis (Singapore)',

  analystPersona:
    'a Singapore constituency case analyst trained in civil administration',

  inputLabel: 'MPS (Meet the People Session) interview notes',

  domains: [
    'housing', 'financial', 'health', 'legal',
    'family', 'employment', 'social',
  ],

  routingTargets: `Known Singapore agencies: HDB (strictly restricted to tenancy, flats, rental subsidies, and eviction matters), Town Council / TC (strictly restricted to S&CC maintenance fees or estate maintenance; do not generate housing/rental asks for TC), CPF, MSF, ComCare, FSC (Family Service Centre),
LAB (Legal Aid Bureau), CNB (Central Narcotics Bureau), MOH/CHAS, MOE, CDC,
Yellow Ribbon, MOM, ICA, SPF, SAF/MINDEF, NTUC/e2i, WSG (Workforce Singapore), SG Enable, IMH.`,

  foundationRules: `- Include only what is stated or strongly implied by the notes.
- Do not invent facts.
- Mark the true root cause(s), not the presenting complaint.
- Note all hidden conditions (health, debt, family dynamics) even if the resident framed them differently.`,

  reasoningRules: `- Every non-root node must have at least one cause.
- Hidden risks are conditions not yet presenting but implied by the chain.
- A consequence is the likely outcome if nothing is done.
- Confidence < 0.5 means the link is inferred; mark these.`,

  actionRules: `- Primary routes address root causes and high-confidence nodes.
- Secondary routes address intermediate nodes.
- Long-term routes address hidden risks and prevention.
- Respect Singapore agency sequencing — e.g. ComCare before FSC for financial hardship.
- Never route to an agency unless a specific node clearly maps to their mandate.`,
};

// ─── Default Export ──────────────────────────────────────────────────────────
// CWI uses MPS_SINGAPORE by default. Other consumers can import and pass
// their own domain config.

export const DEFAULT_DOMAIN = MPS_SINGAPORE;
