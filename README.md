# Case Writer Intelligence (CWI)

Writing a letter to a government agency on behalf of a resident is not difficult — but it is slow. A constituency volunteer sitting across from someone at a Meet-the-People session needs to understand the full picture of the case, identify which agencies are relevant, determine what the actual ask is, and then produce something structured and professional enough to be taken seriously on the other end. Done well, that takes 30–45 minutes per case. When a session is handling 50–100 cases in a single evening, that pace is not sustainable.

The deeper problem is that the surface issue a resident presents is rarely the full story. Someone coming in about rental arrears may have an underlying job loss, a deteriorating health condition, or a family breakdown that is the real driver. If the letter to HDB focuses only on the arrears and omits that context, it gets processed as a routine case and the resident is no better off. Getting the full picture onto paper — in a structured way, for the right agencies — is the actual skill the volunteer is doing.

CWI is built around that insight. It reads the raw case notes from the session, runs a three-stage causality analysis to surface the root issue and identify downstream risks, and then generates targeted draft letters for each relevant agency. The volunteer reviews, edits, and copies. The hard part — working out what is actually going on and what to say to whom — is handled. The human step — verification and approval — stays where it belongs.

---

## What it does

- **Writer profile** — volunteer sets their name, MP, and constituency once; it pre-fills into every letter automatically
- **Case input** — raw notes as captured during a case intake session; no formatting required
- **Causality Engine** — 3-stage sequential LLM pipeline (Foundation → Reasoning → Action) that produces a structured `CausalGraph`: root cause identification, downstream risk surfacing, hidden information gap analysis, and per-agency routing with confidence scoring at each causal node
- **Multi-agency letter generation** — draft letters generated deterministically from the `CausalGraph`; each letter is domain-weighted and agency-specific (HDB, ICA, MSF, MOM, CPF, MOH, and others); sequenced by the document queue; PDPA-compliant (resident PII held as `██` placeholders, completed by the writer before submission)
- **Human-in-the-loop gate** — no letter is transmitted automatically; copy-paste to gather.gov.sg is the explicit human step, held until review is complete
- **AI disclosure on all output** — every generated letter carries a visible watermark reminding the volunteer to review before submitting to any agency or MP
- **Admin auto-scan** — batch processes multiple cases when enabled by an administrator

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React + TypeScript + Vite |
| AI proxy | Node.js + Express (server-side, internal only) |
| AI inference | Ollama — `gemma4:e2b` (local network, via server-side proxy) |
| Containerisation | Docker Compose |

---

## Security

This platform is built to OWASP LLM Top 10 compliance standards. The authoritative requirements document is [`SECURITY_FRAMEWORK.md`](./SECURITY_FRAMEWORK.md). This section captures the full audit posture for this platform specifically.

### OWASP LLM Top 10 — Compliance Status

| # | Risk | Status | Control |
|---|------|--------|---------|
| LLM01 | Prompt Injection | ✅ Mitigated | Server-side proxy, 9-layer input sanitization (incl. encoded payload detection), scope-restricted single-purpose identity, canary tokens, output anomaly check |
| LLM02 | Insecure Output Handling | ✅ Mitigated | HTML/script stripping, output schema enforcement, enum whitelist validation |
| LLM03 | Training Data Poisoning | ⚪ N/A | Read-only inference; no fine-tuning pipeline |
| LLM04 | Model Denial of Service | ✅ Mitigated | Dual-layer rate limiting (nginx + proxy), request size caps, 45s letter timeout |
| LLM05 | Supply Chain Vulnerabilities | ✅ Mitigated | GitHub Actions weekly `npm audit --audit-level=high` |
| LLM06 | Sensitive Information Disclosure | ✅ Mitigated | Server-side PII masking on 6 SG-specific patterns before inference |
| LLM07 | Insecure Plugin Design | ⚪ N/A | No plugin/tool-calling architecture |
| LLM08 | Excessive Agency | ✅ Mitigated | All letter actions require explicit human review before sending |
| LLM09 | Overreliance | ✅ Mitigated | Mandatory AI disclosure watermark on all generated letters |
| LLM10 | Model Theft | ✅ Mitigated | System prompt isolated in proxy container; never sent to browser |

---

### Prompt Injection Defence (LLM01)

All AI calls route through `cwi-ai-proxy` — a dedicated server-side Express container. The browser calls `/api/ai/*` only. The system prompt, canary tokens, and PII masking logic live exclusively in `api/server.js` and are invisible to browser DevTools.

The previous architecture proxied Ollama directly through nginx (`/api/v1/` and `/api/bonsai/`), making the system prompt visible in browser network tabs. Both proxy paths have been removed.

**7-layer sanitization applied to every user input before it reaches Ollama:**

| ID | Pattern blocked |
|----|----------------|
| PI-01 | System prompt isolated — never transmitted to browser |
| PI-02 | `ignore all previous instructions`, `disregard`, `override` |
| PI-03 | `you are now`, `act as`, `forget you are`, persona hijacking |
| PI-04 | `[INST]`, `[/INST]`, `<<SYS>>`, `<</SYS>>`, `<system>`, `</system>` |
| PI-05 | Code delimiter spoofing — prompt boundary markers |
| PI-06 | History poisoning — max 20 turns; all turns individually sanitized |
| PI-07 | Structural prompt terminators and role injection patterns |
| PI-08 | Encoded payload detection — morse code (5+ tokens), base64 (6+ groups), hex (8+ byte pairs) rejected at proxy before inference |
| PI-09 | Scope-restricted identity — model defined as single-purpose tool; explicit authorised/unauthorised task list; out-of-scope requests refused regardless of encoding or framing (RLHF helpfulness override mitigation) |

**Canary token detection:** A per-request UUID is embedded in the system prompt. If the model echoes the canary in its response (extraction attempt), the proxy redacts it and emits `SECURITY_CANARY_TRIGGERED` in the audit log.

---

### Output Handling (LLM02)

`sanitizeOutput()` runs on every AI response before it reaches the browser:

- All `<script>` tags stripped
- All HTML tags stripped
- `javascript:` → `javascript-blocked:`
- `vbscript:` → `vbscript-blocked:`

**Output anomaly check on `/api/ai/letter`:** After sanitization, generated letter content is scanned for structural anomalies (SQL patterns, code blocks, jailbreak phrases). Any match returns HTTP 422 and logs `OUTPUT_ANOMALY_LETTER` — the letter is never returned to the browser.

**Schema enforcement on categorization and agency responses:**

- Category fields validated against hardcoded enum allowlists
- Urgency validated against `['Low', 'Medium', 'High', 'Critical']`
- Agency list validated against known SG agencies (HDB, ICA, MSF, MOM, CPF, MOH, etc.)
- All free-text fields length-capped
- Array fields item-count-capped
- Unknown fields discarded — response rebuilt from validated fields only

---

### PII Masking (LLM06)

Applied in `maskPII()` before every Ollama call. The model never sees raw resident PII.

| Pattern | Replacement |
|---------|-------------|
| Singapore NRIC/FIN (`[STFGM]\d{7}[A-Z]`) | `[NRIC REDACTED]` |
| SG mobile — +65 format | `[PHONE REDACTED]` |
| SG mobile — local 8/9 prefix | `[PHONE REDACTED]` |
| Email address | `[EMAIL REDACTED]` |
| SG postal code | `[POSTAL REDACTED]` |
| Street address (number + street type) | `[ADDRESS REDACTED]` |

Nginx telemetry omits client IP (PDPA compliance). AI audit logs record character lengths, not message content.

---

### Human-in-the-Loop Gate (LLM08 / LLM09)

- All generated letters carry a visible AI disclosure watermark
- Volunteers are reminded to review content before sending anything to any agency
- No letter is transmitted automatically — copy-paste to gather.gov.sg is the explicit human step
- The copy action is held until the volunteer has reviewed the generated content

---

### Model DoS Protection (LLM04)

**Layer 1 — nginx:**

- AI endpoints: 20 req/min per IP, burst 5
- `/api/ai/` location restricted to Docker internal IP ranges only
- HTTP 429 returned immediately for excess requests

**Layer 2 — proxy:**

- `/api/ai/chat`: 30 req/min
- `/api/ai/categorize`: 10 req/min
- `/api/ai/analyze`: 10 req/min
- `/api/ai/letter`: 5 req/min
- Input length cap applied before reaching Ollama
- `AbortSignal.timeout(30_000)` on chat/categorize; 45s on letter generation

---

### Authentication

Admin auto-scan access is gated by `VITE_ADMIN_USER` and `VITE_ADMIN_PASS` (build-time environment variables, embedded in the bundle). Keep these credentials rotated. Migrating admin auth to a server-side session is the right long-term fix — tracked as a deferred item.

---

### Container Security

| Standard | Implementation |
|----------|---------------|
| No privilege escalation | `security_opt: - no-new-privileges:true` on all containers |
| Non-root user | `aiproxy` user in `cwi-ai-proxy` container |
| Resource limits | Memory and CPU caps on all services |
| Network isolation | Proxy reachable only from nginx on `ai-bridge` — not from browser or host |

---

### HTTP Security Headers

Enforced on every nginx response:

| Header | Value |
|--------|-------|
| `Content-Security-Policy` | `default-src 'self'` |
| `X-Frame-Options` | `SAMEORIGIN` |
| `X-Content-Type-Options` | `nosniff` |
| `X-XSS-Protection` | `1; mode=block` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | camera, geolocation, payment, USB denied |
| `server_tokens` | `off` — nginx version suppressed |

---

### Supply Chain (LLM05)

`.github/workflows/security-audit.yml` runs on every push, pull request, and weekly (Sunday 02:00 SGT). Audits both frontend (`package.json`) and AI proxy (`api/package.json`). Pipeline fails on any high or critical CVE.

---

### Privacy

- All inference runs locally via Ollama — no resident data transmitted externally
- No external API keys
- Nginx logs omit client IP
- Writer profiles stored in `localStorage` — nothing persisted server-side
- PII masked before inference — the model never sees raw NRIC, phone, or address

---

### AI Audit Log

Every inference call emits a structured JSON log:

```json
{
  "ts": "2026-05-09T01:23:00.000Z",
  "type": "CHAT | CATEGORIZE | LETTER | ANALYZE | SECURITY_CANARY_TRIGGERED | ERROR_*",
  "inputLen": 42,
  "outputLen": 387,
  "canaryDetected": false
}
```

```bash
docker logs cwi-ai-proxy | grep '"type"'      # all AI calls
docker logs cwi-ai-proxy | grep CANARY        # extraction attempts only
```

---

### Development Checklist

Items marked `[BLOCK]` are merge blockers.

#### AI and LLM

- [ ] `[BLOCK]` All AI calls route through `cwi-ai-proxy` — no direct browser-to-Ollama calls
- [ ] `[BLOCK]` System prompt defined only in `api/server.js`
- [ ] `[BLOCK]` All user input passes through `sanitize()` before Ollama
- [ ] `[BLOCK]` PII masking (`maskPII()`) applied to all user-supplied text
- [ ] `[BLOCK]` AI output passes through `sanitizeOutput()` before returning to client
- [ ] `[BLOCK]` Structured output validated against hardcoded schema (enum whitelist, length caps)
- [ ] `[BLOCK]` Canary detection present in every endpoint returning AI text
- [ ] `[BLOCK]` `auditLog()` called on success and error paths
- [ ] Rate limit defined for the new endpoint
- [ ] `AbortSignal.timeout` defined on every inference call

#### Human-in-the-loop

- [ ] AI disclosure visible on all generated output presented to users
- [ ] No AI output transmitted automatically without explicit human action

#### Containers

- [ ] `no-new-privileges: true`
- [ ] Non-root user defined
- [ ] Memory and CPU limits defined
- [ ] Port exposure is minimum required

#### HTTP

- [ ] Full security header block in nginx config
- [ ] `server_tokens off` present
- [ ] `/api/ai/` location restricted to internal Docker IP range
- [ ] CSP does not include `unsafe-inline` or `unsafe-eval`

#### CI/CD

- [ ] `[BLOCK]` `npm audit --audit-level=high` passes cleanly for frontend and proxy

---

## Engineering notes

**Why the Causality Engine?**
The surface issue a resident presents is rarely the full story. Someone coming in about rental arrears may have an underlying job loss, a health condition, or a family breakdown driving it. If the letter to HDB doesn't mention the context, it gets processed as a standard arrears case and nothing changes. The Causality Engine models the chain — presenting problem → root cause → downstream consequences if unaddressed — and feeds that into the letter so agencies understand what's actually at stake.

**Why a server-side AI proxy?**
Case notes contain real resident concerns — housing, immigration, financial hardship. The original architecture proxied Ollama directly through nginx, making the system prompt visible in browser DevTools. The proxy moves system instructions, PII masking, injection sanitization, canary tokens, and output validation into a server container. The browser calls `/api/ai/` and never touches Ollama.

**Why `gemma4:e2b`?**
Gemma 4 is a strong general reasoner that produces contextually appropriate, formally-toned letter language well-suited to constituency correspondence. The `extractJSON()` fence-stripper in `server.js` handles cases where the model wraps structured output in markdown code blocks rather than returning raw JSON — a known Gemma behaviour that is now explicitly guarded against.

**Why local inference instead of a hosted API?**
Case notes contain real resident concerns. Sending that data to an external API creates a data processing relationship that requires proper legal basis and a DPA. Running locally eliminates that entirely. It also makes the tool usable in network-restricted environments.

**Why are VITE_ admin credentials a deferred item?**
`VITE_` prefixed variables are embedded into the browser bundle at build time and visible via DevTools. For a demo context with no real resident data, this is an acceptable tradeoff. Migrating to a server-side session cookie with a POST-only login route is the clean fix — it is in the roadmap and not a current blocker.

---

## Architecture for scale

CWI is scoped for single-branch deployment supporting one MP's constituency casework operation. A physical MPS session sees 50–100 cases per week. At 10× digital adoption that is roughly 1,000 case analyses per week — a workload the current architecture handles without modification.

The Causality Engine is the only non-trivial bottleneck. It is a 3-stage sequential LLM pipeline taking up to 120 seconds synchronously. At scale it converts to an async job — the client posts a job, receives a job ID, and polls. That is the single architectural change that unlocks multi-branch deployment. Everything else is standard horizontal replication.

| Trigger | Architectural change |
|---|---|
| > 3 concurrent causality analyses | Sync HTTP → async job queue (BullMQ + Redis); client polls `/api/ai/causality/:jobId` |
| > 1 branch on one deployment | Writer profile and case history in SQLite with branch-scoped row isolation |
| High-availability requirement | Multiple stateless proxy instances behind nginx upstream; already stateless, horizontally trivial |
| National deployment | Ollama inference cluster or inference queue behind BullMQ; multi-tenant branch isolation |

---

## Setup

### Prerequisites

- Docker and Docker Compose
- Ollama running with `gemma4:e2b` pulled (or any OpenAI-compatible endpoint)
- `ai-bridge` Docker network created by `infrastructure/docker-compose.ai.yml`

### Environment

Copy `.env.example` to `.env`. No external API keys required — inference is fully local.

```env
VITE_ADMIN_USER=your-admin-user
VITE_ADMIN_PASS=your-admin-pass
OLLAMA_ENDPOINT=http://<ollama-host>:11434/v1/chat/completions
AI_MODEL=gemma4:e2b
```

### Run

```bash
docker compose up -d
```

App available at `http://localhost:3081`. The `cwi-ai-proxy` container starts first (healthcheck dependency).

---

## Configuration

| Variable | Purpose |
| --- | --- |
| `VITE_ADMIN_USER` | Admin username for auto-scan feature (build-time) |
| `VITE_ADMIN_PASS` | Admin password for auto-scan feature (build-time) |
| `OLLAMA_ENDPOINT` | Ollama API URL (server-side proxy only — not exposed to browser) |
| `AI_MODEL` | Model name (default: `gemma4:e2b`) |

> ⚠️ `VITE_` prefixed variables are embedded into the browser bundle at build time and are readable via DevTools. Keep admin credentials rotated. Migrating admin auth to a server-side session is the right long-term fix — tracked as a deferred item.

---

## Important notes

This is a **research and demonstration tool**. It is not an official government service, not affiliated with any government agency, and must not be presented as one. The DEMO banner displayed in the application makes this explicit.

Case notes entered into CWI are processed by a local AI model running on-premises. No data leaves the network. Do not use this tool with real resident NRIC numbers or other highly sensitive personal data in a demonstration context without appropriate safeguards in place.

---

## Roadmap

CWI is a standalone beta tool. The current build covers the core letter generation pipeline: case intake, causality analysis, agency routing, letter drafting, and HITL governance.

Planned next: demand-driven document collection where the causality engine output drives a per-case document checklist; server-side admin authentication to replace the current build-time credential approach; and a feedback loop to improve letter quality over time based on volunteer corrections.
