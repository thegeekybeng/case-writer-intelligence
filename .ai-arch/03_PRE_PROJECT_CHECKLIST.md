# Pre-Project Checklist

## Business Case
Digitalising MPS workflows to reduce case backlogs.

## Stakeholder RACI
- Responsible: Tech Lead
- Accountable: MP

## Non-Functional Requirements (NFRs)
- Performance: Letter generation < 5 minutes.
- Security: Admin endpoints secured by JWT. Hardcoded secrets removed. PII masked server-side.
- Data Retention: AI proxy logs retained for 30 days. Cases deleted after 5 years.

## Data Classification
Sensitive and sovereign data handled. PII such as NRIC, Phone, Email are redacted before hitting the AI model.

## Risk Register
### AI Governance Framework
- Anti-hallucination rules: Server prompt enforces "NEVER fabricate facts or invent agency responses."
- Prompt injection defence: User inputs are sanitized and fenced. Encoded payload detection in `hasEncodedPayload`.
- Context window bounding: Max 4000 tokens on user input.
- Loop-breaking protocol: Timeout of 600s on AI API requests.
- Phantom commitment prevention: AI instructed to stick to letters and summarisation.
- Mandatory audit logging: All proxy operations logged to stdout via `auditLog()` function.

## Assumptions
- See 04_ASSUMPTIONS.md
