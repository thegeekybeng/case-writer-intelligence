## Summary

<!-- One paragraph: what this PR does and why. Link to the issue it resolves. -->

Closes #

---

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor (no behaviour change)
- [ ] Documentation
- [ ] Security fix

---

## Security checklist

_Required for any PR touching `api/server.js`, AI prompts, or input handling. Check all that apply._

- [ ] All AI calls still route through `cwi-ai-proxy` — no direct browser-to-Ollama calls introduced
- [ ] System prompt remains defined only in `api/server.js`
- [ ] All user input still passes through `sanitize()` before reaching Ollama
- [ ] `maskPII()` still applied to all user-supplied text
- [ ] `sanitizeOutput()` still applied before returning AI text to client
- [ ] Canary token detection present in every endpoint returning AI text
- [ ] `auditLog()` called on success and error paths for any new endpoint
- [ ] `npm audit --audit-level=high` passes for frontend (`/`) and proxy (`/api`)
- [ ] N/A — this PR does not touch AI, input handling, or security controls

---

## Testing

<!-- How was this tested? Include commands, scenarios, or screenshots. -->

---

## Breaking changes

<!-- Does this change any public interface, environment variable, Docker port, or API contract? -->

- [ ] No breaking changes
- [ ] Yes — describe below:

---

## Documentation

- [ ] README updated if behaviour changed
- [ ] `SECURITY_FRAMEWORK.md` updated if a security control changed
- [ ] No documentation changes needed
