# Causality Engine — Usage Guide

A domain-configurable, 3-stage causal analysis pipeline powered by local LLM inference.

## Architecture

```
Raw Text Input
      │
      ▼
┌─────────────────┐
│  Stage 1+2      │  Foundation
│  Entity +       │  Extract entities (people, conditions, events)
│  Timeline       │  Reconstruct chronological timeline
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Stage 3+4      │  Reasoning
│  Causal Graph + │  Build cause → effect node graph
│  Gap Detection  │  Identify missing information
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Stage 5+6+7    │  Action
│  Urgency +      │  Score urgency (Low → Critical)
│  Routing +      │  Route to agencies/teams/departments
│  Document Queue │  Order deliverables with dependencies
└────────┬────────┘
         │
         ▼
   CausalGraph (structured JSON output)
```

Each stage makes one LLM API call. Total: **3 API calls per analysis**.

## Quick Start

### Default (MPS Singapore — CWI)

```typescript
import { runCausalityEngine } from './services/causalityEngine';

const graph = await runCausalityEngine(caseNotes);
// graph.nodes       → causal graph
// graph.agencyRoutes → who to contact
// graph.urgency      → how urgent
// graph.documentQueue → what to produce, in what order
```

### With Progress Updates

```typescript
const graph = await runCausalityEngine(caseNotes, (update) => {
  switch (update.stage) {
    case 'foundation': console.log('Extracting entities…');   break;
    case 'reasoning':  console.log('Building causal graph…'); break;
    case 'action':     console.log('Routing to agencies…');   break;
    case 'complete':   console.log('Done:', update.graph);    break;
  }
});
```

### Custom Domain

```typescript
import { runCausalityEngine } from './services/causalityEngine';
import { MY_DOMAIN } from './constants/causalityDomains';

const graph = await runCausalityEngine(inputText, onProgress, MY_DOMAIN);
```

## Creating a Custom Domain

All domain-specific content lives in `constants/causalityDomains.ts`. To add a new domain, define a `CausalityDomainConfig` object.

### Config Interface

```typescript
interface CausalityDomainConfig {
  id: string;              // "it_incident", "insurance_claim"
  label: string;           // "IT Incident Analysis"
  analystPersona: string;  // "a site reliability engineer trained in RCA"
  inputLabel: string;      // "incident report and system logs"
  domains: string[];       // ["network", "storage", "compute", "app"]
  routingTargets: string;  // Known teams/agencies with descriptions
  foundationRules: string; // Rules for entity + timeline extraction
  reasoningRules: string;  // Rules for causal graph construction
  actionRules: string;     // Rules for routing and sequencing
}
```

### Example: IT Incident Domain

```typescript
export const IT_INCIDENT: CausalityDomainConfig = {
  id: 'it_incident',
  label: 'IT Incident Root Cause Analysis',

  analystPersona:
    'a site reliability engineer trained in systematic root cause analysis',

  inputLabel: 'incident report, system logs, and post-mortem notes',

  domains: [
    'network', 'storage', 'compute', 'application',
    'security', 'configuration', 'vendor',
  ],

  routingTargets: `Known teams: NOC (Network Operations Centre),
Platform Engineering, Security Operations, Database Administration,
Application Support, Vendor Management, Change Advisory Board.`,

  foundationRules: `- Include only what is stated or strongly implied by the logs and reports.
- Do not invent root causes — mark uncertain links with low confidence.
- Distinguish between symptoms and causes.
- Note all configuration changes in the 72 hours preceding the incident.`,

  reasoningRules: `- Every non-root node must have at least one cause.
- Hidden risks include single points of failure and missing redundancy.
- A consequence is the projected impact if the root cause recurs.
- Confidence < 0.5 means the link is inferred from correlation, not causation.`,

  actionRules: `- Primary routes address root causes requiring immediate remediation.
- Secondary routes address contributing factors and defense-in-depth gaps.
- Long-term routes address systemic improvements and architecture changes.
- Change Advisory Board must approve any infrastructure modifications.
- Vendor escalation requires internal troubleshooting to be completed first.`,
};
```

### Example: Insurance Claims Domain

```typescript
export const INSURANCE_CLAIMS: CausalityDomainConfig = {
  id: 'insurance_claims',
  label: 'Insurance Claims Analysis',

  analystPersona:
    'an insurance claims analyst trained in policy assessment and fraud detection',

  inputLabel: 'claim submission, adjuster notes, and supporting documents',

  domains: [
    'property', 'liability', 'medical', 'financial',
    'legal', 'fraud_indicators', 'compliance',
  ],

  routingTargets: `Known units: Claims Assessment, Special Investigations Unit (SIU),
Legal Department, Medical Review Board, Reinsurance, Customer Relations,
Compliance & Regulatory, External Loss Adjusters.`,

  foundationRules: `- Extract all monetary amounts, dates, and policy references.
- Flag any inconsistencies between the claimant's narrative and documentation.
- Note prior claims history if referenced.
- Identify all parties involved (claimant, witnesses, third parties).`,

  reasoningRules: `- Every non-root node must have at least one cause.
- Hidden risks include potential subrogation opportunities and coverage disputes.
- Fraud indicators are nodes with type "hidden_risk" and low confidence.
- Confidence < 0.5 means the link requires further investigation.`,

  actionRules: `- Primary routes address immediate claim processing needs.
- Secondary routes address investigation requirements.
- Long-term routes address policy review and risk mitigation.
- SIU referral required if 2+ fraud indicators are present.
- Legal review required for claims exceeding policy sublimits.`,
};
```

## Output Structure

The engine returns a `CausalGraph` with the following structure:

```typescript
interface CausalGraph {
  entities: CausalEntity[];          // People, conditions, events
  timeline: TimelineEvent[];         // Chronological reconstruction
  nodes: CausalNode[];               // The causal graph
  gaps: CausalGap[];                 // Missing information
  urgency: UrgencyAssessment;        // Urgency scoring
  agencyRoutes: AgencyRoute[];       // Routing recommendations
  documentQueue: DocumentQueueItem[];// Ordered deliverables
  engineVersion: string;             // "2.0.0"
  processedAt: string;               // ISO timestamp
}
```

### Node Types

| Type | Purpose |
|------|---------|
| `root_cause` | The earliest causal event(s) in the chain |
| `intermediate` | Connecting nodes between cause and effect |
| `presenting_problem` | What the subject reported / what's visible |
| `hidden_risk` | Implied but not yet manifesting |
| `consequence` | Projected outcome if no action is taken |

### Urgency Levels

| Level | Meaning |
|-------|---------|
| `Low` | No time pressure, standard processing |
| `Medium` | Moderate time sensitivity |
| `High` | Time-sensitive, prioritise |
| `Critical` | Immediate action required |

## File Locations

| File | Purpose |
|------|---------|
| `services/causalityEngine.ts` | The engine pipeline (domain-agnostic) |
| `constants/causalityDomains.ts` | Domain configs (MPS_SINGAPORE + custom) |
| `types.ts` | CausalGraph, CausalNode, AgencyRoute types |
| `constants/agencyTemplates.ts` | Letter template registry (CWI-specific) |
| `services/letterGenerator.ts` | Letter assembly from CausalGraph (CWI-specific) |

## Prerequisites

- **AI Inference**: Ollama running locally (or any OpenAI-compatible endpoint)
- **Model**: gemma4 (or any model pulled into Ollama; JSON mode, temperature 0.1)
- **No additional dependencies**: Uses `openai` SDK (already in CWI) — compatible with Ollama's OpenAI API

## Tips for Writing Domain Configs

1. **Be specific in `analystPersona`** — the more precise the role, the better the model performs. "A site reliability engineer trained in systematic root cause analysis" beats "an IT analyst."

2. **Keep `domains` to 5–8 items** — too many dilutes classification. Group related concepts.

3. **`routingTargets` should include abbreviations** — the model maps better when it sees "NOC (Network Operations Centre)" than just "NOC."

4. **`foundationRules` control hallucination** — always include "do not invent facts" and "include only what is stated or strongly implied."

5. **`actionRules` encode domain expertise** — this is where sequencing logic lives. "ComCare before FSC" or "CAB approval before infra changes."

6. **Test with real data** — synthetic inputs produce generic graphs. Use actual incident reports, case notes, or claims to validate domain fit.
