# Architecture Decision Log

## ADR-001 — Secure Admin Authentication (2026-06-22)

**Context:**
Admin credentials (`VITE_ADMIN_USER`, `VITE_ADMIN_PASS`) were hardcoded in the Vite client bundle, exposing them to users.

**Decision:** We chose to use a server-side authentication endpoint that issues a JWT stored in sessionStorage for subsequent requests.

**Consequences (+):**
- Credentials are no longer exposed in the browser bundle.
- Secures the Auto-scan feature properly.

**Consequences (−):**
- Adds slight complexity to the login flow and proxy server.

**Rejected alternatives:**
- `HttpOnly` Cookies (Rejected: More complex to set up cross-origin if frontend and proxy are on different ports/domains without an ingress).
- Basic Auth (Rejected: Sends credentials with every request, easier to intercept without strict HTTPS).
