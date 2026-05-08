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
| AI inference | Ollama — `qwen3.5:4b-nvfp4` (local, no cloud API) |
| Containerisation | Docker Compose |

---

## Engineering notes

**Why the Causality Engine?**
The surface issue a resident presents is rarely the full story. Someone coming in about rental arrears may have an underlying job loss, a health condition, or a family breakdown driving it. If the letter to HDB doesn't mention the context, it gets processed as a standard arrears case and nothing changes. The Causality Engine models the chain — presenting problem → root cause → downstream consequences if unaddressed — and feeds that into the letter so agencies understand what's actually at stake.

**Why Qwen (qwen3.5:4b-nvfp4) over other models?**
CWI makes heavy use of structured JSON output — case categorisation, agency identification, and risk mapping all return typed JSON objects. Qwen 3.5 is significantly more reliable at following `response_format: { type: "json_object" }` than comparably-sized general-purpose models. Letter prose quality is similar across the options available locally; JSON fidelity is not.

**Why local inference instead of a hosted API?**
Case notes contain real resident concerns — housing, immigration, financial hardship. Sending that data to an external API creates a data processing relationship that needs proper legal basis and a DPA. Running locally eliminates that entirely. It also makes the tool usable in network-restricted environments.

**Why localStorage for profiles?**
Volunteer profiles contain a name, MP, and constituency — nothing sensitive. Using localStorage keeps the tool stateless on the server side, meaning there's no database to maintain, no auth layer for profile access, and no migration headaches. If the requirement grows to shared profiles across devices, that's the point to add a backend — not before.

**Why separate letters per agency?**
Every agency has different framing requirements. HDB cares about tenure and payment history. MSF cares about family circumstances. ICA cares about documentation status. A single generic letter covers none of these well. Generating one letter per agency, each with the relevant framing, gets faster and more meaningful responses.

---

## Setup

### Prerequisites

- Docker and Docker Compose
- Ollama running with `qwen3.5:4b-nvfp4` pulled
- `ai-bridge` Docker network created by `infrastructure/docker-compose.ai.yml`

### Environment

Copy `.env.example` to `.env`. No API keys required — inference is fully local.

### Run

```bash
docker compose up -d
```

App is available at `http://localhost:3081`.

---

## Configuration

| Variable | Purpose |
| --- | --- |
| `OLLAMA_HOST` | Base URL of Ollama instance — must include `/v1` (e.g. `http://host:11434/v1`) |
| `AI_MODEL` | Model name (default: `qwen3.5:4b-nvfp4`) |
| `VITE_ADMIN_USER` | Admin username for auto-scan feature |
| `VITE_ADMIN_PASS` | Admin password for auto-scan feature |

> ⚠️ `VITE_` prefixed variables are embedded into the browser bundle at build time and are readable via DevTools. Keep admin credentials simple and rotate them. A proper server-side auth layer is the right long-term fix — tracked as a deferred item.

---

## Notes on the Causality Engine

Documented in detail in `CAUSALITY_ENGINE.md`. The short version: it models a resident's problem as a chain rather than a single issue. That framing gives agency letters more context and tends to get faster, more substantive responses.

---

## Data handling

- Writer profiles are stored in `localStorage` — nothing is persisted server-side
- Case notes are sent to the local Ollama instance only — no external network calls
- No case data leaves the local network

---

Built by [@thegeekybeng](https://github.com/thegeekybeng)
