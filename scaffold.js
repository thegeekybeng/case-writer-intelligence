const fs = require('fs');
const path = require('path');

const dir = '.ai-arch';
if (!fs.existsSync(dir)){
    fs.mkdirSync(dir);
}
if (!fs.existsSync(path.join(dir, 'charts'))){
    fs.mkdirSync(path.join(dir, 'charts'));
}
if (!fs.existsSync(path.join(dir, 'pc2e'))){
    fs.mkdirSync(path.join(dir, 'pc2e'));
}

const files = {
  "01_README.md": "# Architecture Repository\n\n## TOGAF ADM Deliverable Mapping\n\n| File | TOGAF Phase | Deliverable |\n|------|-------------|-------------|\n| 01_README.md | Preliminary | Architecture Repository orientation + TOGAF mapping |\n| 02_PROJECT_CONTEXT.md | Phase A | Statement of Architecture Work |\n| 03_PRE_PROJECT_CHECKLIST.md | Preliminary | Architecture Principles + Capability Assessment |\n| 04_ASSUMPTIONS.md | Phase A | Architecture Vision — assumptions & constraints |\n| 05_COMPLEXITY_ANALYSIS.md | Phase A | Architecture Vision — feasibility & effort |\n| 06_ARCHITECTURE_OVERVIEW.md | Phase A | Architecture Vision (HTML layer diagram) |\n| 07_ARCHITECTURE_DECISIONS.md | A–D | Architecture Decision Log (append-only) |\n| 08_AI_ASSISTANCE_MAP.md | B–D | Architecture Definition Document — provenance |\n| 09_API_REFERENCE.md | Phase C | Architecture Definition Document — interfaces |\n| 10_OBSERVABILITY_STRATEGY.md | F–G | Migration Planning / Implementation Governance |\n| charts/ | B–D | Domain views |\n\nSource: TOGAF® Standard, 10th Edition (Open Group, 2022). Confidence: HIGH.",
  "02_PROJECT_CONTEXT.md": "# Project Context\n\nCase Writer Intelligence is a digital MPS platform for Singapore, allowing writers to log cases and use an AI engine to draft letters and recommend agencies. It uses a local Ollama model (gemma4) via a server-side proxy.",
  "03_PRE_PROJECT_CHECKLIST.md": "# Pre-Project Checklist\n\n## Business Case\nDigitalising MPS workflows to reduce case backlogs.\n\n## Stakeholder RACI\n- Responsible: Tech Lead\n- Accountable: MP\n\n## Non-Functional Requirements (NFRs)\n- Performance: Letter generation < 5 minutes.\n- Security: Admin endpoints secured by JWT. Hardcoded secrets removed. PII masked server-side.\n- Data Retention: AI proxy logs retained for 30 days. Cases deleted after 5 years.\n\n## Data Classification\nSensitive and sovereign data handled. PII such as NRIC, Phone, Email are redacted before hitting the AI model.\n\n## Risk Register\n### AI Governance Framework\n- Anti-hallucination rules: Server prompt enforces \"NEVER fabricate facts or invent agency responses.\"\n- Prompt injection defence: User inputs are sanitized and fenced. Encoded payload detection in `hasEncodedPayload`.\n- Context window bounding: Max 4000 tokens on user input.\n- Loop-breaking protocol: Timeout of 600s on AI API requests.\n- Phantom commitment prevention: AI instructed to stick to letters and summarisation.\n- Mandatory audit logging: All proxy operations logged to stdout via `auditLog()` function.\n\n## Assumptions\n- See 04_ASSUMPTIONS.md",
  "04_ASSUMPTIONS.md": "# Assumptions\n\n- The Ollama engine is running locally and available at the configured IP.",
  "05_COMPLEXITY_ANALYSIS.md": "# Complexity Analysis\n\nModerate complexity due to the custom causality engine and proxy shielding against prompt injection.",
  "06_ARCHITECTURE_OVERVIEW.md": "# Architecture Overview\n\n👉 **[View the High-Res HTML Layered Architecture](charts/architecture-overview.html)**\n\nThe system consists of a Vite React frontend, an Express AI proxy, and a local Ollama inference server.",
  "07_ARCHITECTURE_DECISIONS.md": "# Architecture Decision Log\n\n## ADR-001 — Secure Admin Authentication (2026-06-22)\n\n**Context:**\nAdmin credentials (`VITE_ADMIN_USER`, `VITE_ADMIN_PASS`) were hardcoded in the Vite client bundle, exposing them to users.\n\n**Decision:** We chose to use a server-side authentication endpoint that issues a JWT stored in sessionStorage for subsequent requests.\n\n**Consequences (+):**\n- Credentials are no longer exposed in the browser bundle.\n- Secures the Auto-scan feature properly.\n\n**Consequences (−):**\n- Adds slight complexity to the login flow and proxy server.\n\n**Rejected alternatives:**\n- `HttpOnly` Cookies (Rejected: More complex to set up cross-origin if frontend and proxy are on different ports/domains without an ingress).\n- Basic Auth (Rejected: Sends credentials with every request, easier to intercept without strict HTTPS).",
  "08_AI_ASSISTANCE_MAP.md": "# AI Assistance Map\n\n- Created .ai-arch files via Agent.\n- Modified `WriterDashboard.tsx`, `server.js`, `docker-compose.yml` to implement secure JWT authentication.",
  "09_API_REFERENCE.md": "# API Reference\n\n- `POST /api/ai/login`: Authenticates admin using `ADMIN_USER` and `ADMIN_PASS`.\n- `POST /api/ai/chat`: Chat interaction with PII masking.\n- `POST /api/ai/analyze`: Case note analysis.\n- `POST /api/ai/categorize`: Categorizes conversation.\n- `POST /api/ai/letter`: Generates letters.\n- `POST /api/v1/chat/completions`: Streaming inference endpoint for Causality Engine.",
  "10_OBSERVABILITY_STRATEGY.md": "# Observability Strategy\n\nLogs: Basic console logging via `auditLog()`.\nMetrics: None yet. (Identified in Audit: Needs Prometheus metrics).\nTraces: None yet. (Identified in Audit: Needs OpenTelemetry).",
  "charts/architecture-overview.html": "<!DOCTYPE html><html><head><style>body{background:#111;color:#fff;font-family:sans-serif;} .box{border:1px solid #333;padding:20px;margin:10px;border-radius:8px;} </style></head><body><div class='box'>Frontend (React)</div><div class='box'>AI Proxy (Express)</div><div class='box'>Inference (Ollama)</div></body></html>"
};

for (const [filename, content] of Object.entries(files)) {
  fs.writeFileSync(path.join(dir, filename), content);
}
console.log("Scaffold complete.");
