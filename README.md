# Case Writer Intelligence (CWI)

Writing letters to government agencies on behalf of residents takes time — more than it should. A constituency volunteer needs to understand the case, identify the right agencies, structure the problem clearly, and draft something professional enough to get actioned. Done well, that whole process can take 30–45 minutes per case.

CWI cuts that down significantly. It reads the case notes, runs them through a causality engine to identify the root issue and downstream risks, and generates a draft letter for each relevant agency. The volunteer reviews, edits, and copies. That's it.

---

## What it does

- **Writer profile setup** — volunteer sets their name, MP, and constituency once; it pre-fills into every letter automatically
- **Case input** — raw notes, as messy as they come from an MPS session
- **Causality Engine** — identifies what's really going on beneath the surface issue and surfaces hidden risks
- **Letter generation** — produces structured, professional letters for each agency identified (HDB, ICA, MSF, MOM, etc.)
- **Admin auto-scan** — batch processes multiple cases when enabled by an admin

All generated letters carry an AI disclosure — the volunteer is reminded to review before sending anything.

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React + TypeScript + Vite |
| AI proxy | Node.js + Express (server-side, internal only) |
| AI inference | Ollama — `qwen3.5:4b-nvfp4` (local, via server-side proxy) |
| Containerisation | Docker Compose |

---

## Security

This platform is built to OWASP LLM Top 10 compliance standards. The authoritative requirements document is [`SECURITY_FRAMEWORK.md`](./SECURITY_FRAMEWORK.md). This section captures the full audit posture for this platform specifically.

### OWASP LLM Top 10 — Compliance Status

| # | Risk | Status | Control |
|---|------|--------|---------|
| LLM01 | Prompt Injection | ✅ Mitigated | Server-side proxy, 7-layer input sanitization, canary tokens |
| LLM02 | Insecure Output Handling | ✅ Mitigated | HTML/script stripping, output schema enforcement, enum whitelist validation |
| LLM03 | Training Data Poisoning | ⚪ N/A | Read-only inference; no fine-tuning pipeline |
| LLM04 | Model Denial of Service | ✅ Mitigated | Dual-layer rate limiting (nginx + proxy), request size caps, 45s letter timeout |
| LLM05 | Supply Chain Vulnerabilities | ✅ Mitigated | GitHub Actions weekly `npm audit --audit-level=high` |
| LLM06 | Sensitive Information Disclosure | ✅ Mitigated | Server-side PII masking on 5 SG-specific patterns before inference |
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

**Canary token detection:** A per-request UUID is embedded in the system prompt. If the model echoes the canary in its response (extraction attempt), the proxy redacts it and emits `SECURITY_CANARY_TRIGGERED` in the audit log.

---

### Output Handling (LLM02)

`sanitizeOutput()` runs on every AI response before it reaches the browser:

- All `<script>` tags stripped
- All HTML tags stripped
- `javascript:` → `javascript-blocked:`
- `vbscript:` → `vbscript-blocked:`

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
| Singapore NRIC/FIN | `[NRIC REDACTED]` |
| SG mobile — +65 format | `[PHONE REDACTED]` |
| SG mobile — local 8/9 prefix | `[PHONE REDACTED]` |
| Email address | `[EMAIL REDACTED]` |
| SG postal code | `[POSTAL REDACTED]` |
| Street address (number + street type) | `[ADDRESS REDACTED]` |

Nginx telemetry omits client IP (PDPA compliance). AI audit logs record character lengths, not message content.

---

### Overreliance Mitigation (LLM08 / LLM09)

- All generated letters carry a visible AI disclosure watermark
- Volunteers are reminded to review content before sending anything to any agency
- No letter is transmitted automatically — copy-paste is the explicit human step

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
- PII masked before inference — model never sees raw NRIC, phone, or address

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

**AI and LLM**

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

**Human-in-the-loop**

- [ ] AI disclosure visible on all generated output presented to users
- [ ] No AI output transmitted automatically without explicit human action

**Containers**

- [ ] `no-new-privileges: true`
- [ ] Non-root user defined
- [ ] Memory and CPU limits defined
- [ ] Port exposure is minimum required

**HTTP**

- [ ] Full security header block in nginx config
- [ ] `server_tokens off` present
- [ ] `/api/ai/` location restricted to internal Docker IP range
- [ ] CSP does not include `unsafe-inline` or `unsafe-eval`

**CI/CD**

- [ ] `[BLOCK]` `npm audit --audit-level=high` passes cleanly for frontend and proxy

---

## Engineering notes

**Why the Causality Engine?**
The surface issue a resident presents is rarely the full story. Someone coming in about rental arrears may have an underlying job loss, a health condition, or a family breakdown driving it. If the letter to HDB doesn't mention the context, it gets processed as a standard arrears case and nothing changes. The Causality Engine models the chain — presenting problem → root cause → downstream consequences if unaddressed — and feeds that into the letter so agencies understand what's actually at stake.

**Why a server-side AI proxy?**
Case notes contain real resident concerns — housing, immigration, financial hardship. The original architecture proxied Ollama directly through nginx, making the system prompt visible in browser DevTools. The proxy moves system instructions, PII masking, injection sanitization, canary tokens, and output validation into a server container. The browser calls `/api/ai/` and never touches Ollama.

**Why Qwen (qwen3.5:4b-nvfp4) over other models?**
CWI makes heavy use of structured JSON output — case categorisation, agency identification, and risk mapping all return typed JSON objects. Qwen 3.5 is significantly more reliable at following `response_format: { type: "json_object" }` than comparably-sized general-purpose models.

**Why local inference instead of a hosted API?**
Case notes contain real resident concerns. Sending that data to an external API creates a data processing relationship that needs proper legal basis and a DPA. Running locally eliminates that entirely. It also makes the tool usable in network-restricted environments.

---

## Setup

### Prerequisites

- Docker and Docker Compose
- Ollama running with `qwen3.5:4b-nvfp4` pulled
- `ai-bridge` Docker network created by `infrastructure/docker-compose.ai.yml`

### Environment

Copy `.env.example` to `.env`. No API keys required — inference is fully local.

```env
VITE_ADMIN_USER=your-admin-user
VITE_ADMIN_PASS=your-admin-pass
OLLAMA_ENDPOINT=http://100.95.235.61:11434/v1/chat/completions
AI_MODEL=qwen3.5:4b-nvfp4
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
| `AI_MODEL` | Model name (default: `qwen3.5:4b-nvfp4`) |

> ⚠️ `VITE_` prefixed variables are embedded into the browser bundle at build time and are readable via DevTools. Keep admin credentials simple and rotate them. Migrating admin auth to a server-side session is the right long-term fix — tracked as a deferred item.

---

## Notes on the Causality Engine

Documented in detail in `CAUSALITY_ENGINE.md`. The short version: it models a resident's problem as a chain rather than a single issue. That framing gives agency letters more context and tends to get faster, more substantive responses.

---

## Data handling

- Writer profiles are stored in `localStorage` — nothing is persisted server-side
- Case notes sent to local Ollama instance only via the server-side proxy — no external network calls
- PII is masked server-side before inference — the model never sees raw NRIC, phone, or address
- No case data leaves the local network

---

Built by [@thegeekybeng](https://github.com/thegeekybeng)
