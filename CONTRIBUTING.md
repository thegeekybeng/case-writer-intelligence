# Contributing to Case Writer Intelligence

Thank you for your interest in contributing. CWI is a civic AI tool — contributions that improve the quality of AI-assisted constituency case work, strengthen security, or improve reliability are especially welcome.

## Before You Start

- Check the [open issues](../../issues) to avoid duplicating work
- For significant changes, open an issue first to discuss the approach before writing code
- Read [`SECURITY_FRAMEWORK.md`](./SECURITY_FRAMEWORK.md) before touching anything in `api/server.js` — every AI endpoint has specific security controls that must be preserved

## Development Setup

### Prerequisites

- Docker and Docker Compose
- Node.js 20 (see `.nvmrc`)
- Ollama running `gemma4:e2b` locally or on the network

### Local run

```bash
# Install frontend dependencies
npm install

# Copy environment config
cp .env.example .env
# Edit .env — set OLLAMA_ENDPOINT and admin credentials

# Start with Docker Compose
docker compose up -d

# Or run frontend dev server directly (hot reload)
npm run dev
```

App runs at `http://localhost:5173` (dev) or `http://localhost:3081` (Docker).

## Contribution Guidelines

### Code style

- TypeScript for all frontend code; no `any` without a comment explaining why
- `'use strict'` in all Node.js files
- Comments explain **why**, not what — remove commented-out code before submitting

### Security — mandatory checks before any PR

Every PR that touches AI-related code must confirm the following are still in place:

- [ ] All AI calls route through `cwi-ai-proxy` — no direct browser-to-Ollama calls
- [ ] System prompt defined only in `api/server.js`
- [ ] All user input passes through `sanitize()` before Ollama
- [ ] `maskPII()` applied to all user-supplied text
- [ ] `sanitizeOutput()` applied before returning AI text to client
- [ ] Canary token detection present in every endpoint returning AI text
- [ ] `auditLog()` called on success and error paths
- [ ] `npm audit --audit-level=high` passes for frontend and proxy

These are merge blockers. A PR that disables or weakens any of these controls will not be merged regardless of other improvements it contains.

### Commits

Follow conventional commits:

```
feat: add agency routing confidence threshold
fix: handle empty causality graph gracefully
docs: update SECURITY_FRAMEWORK rate limit table
refactor: extract PII patterns to constants file
```

First line: imperative mood, 50 characters max. No period at the end.

### Branch naming

```
feature/agency-routing-threshold
fix/empty-causal-graph-crash
docs/security-framework-update
```

## Pull Request Process

1. Fork the repository and create your branch from `main`
2. Run `npm audit --audit-level=high` and fix any high or critical CVEs before submitting
3. Fill in the pull request template completely
4. Link to the issue your PR resolves (use `Closes #123` in the description)
5. A PR is ready for review when all checklist items are checked — do not submit with open items

## What Will Not Be Merged

- Code that bypasses or weakens any security control listed in [`SECURITY_FRAMEWORK.md`](./SECURITY_FRAMEWORK.md)
- Changes that introduce direct browser-to-Ollama communication
- Features that enable automatic transmission of AI-generated correspondence without explicit human action
- Dependencies with known high or critical CVEs

## Questions

Open a [Discussion](../../discussions) for questions that are not bug reports or feature requests.
