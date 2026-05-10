# Security Policy

## Scope

Case Writer Intelligence (CWI) is a **research and demonstration tool**. It is not an official government service and is not intended for production use with real resident personal data.

Security reports are welcomed for:

- Vulnerabilities in `api/server.js` (the AI proxy)
- Prompt injection bypasses in the 7-layer sanitization chain
- PII masking gaps in `maskPII()`
- Container escape or privilege escalation in the Docker configuration
- Authentication weaknesses in the admin access controls
- HTTP security header misconfigurations in `nginx.conf`

## Reporting a Vulnerability

**Use GitHub's Private Vulnerability Reporting.** Do not open a public issue for security vulnerabilities.

1. Go to the [Security tab](../../security) of this repository
2. Click **Report a vulnerability**
3. Describe the issue, reproduction steps, and potential impact

This keeps the report confidential until a fix is in place.

## Response Timeline

| Stage | Target |
|---|---|
| Acknowledgement | Within 48 hours |
| Initial assessment | Within 7 days |
| Fix or workaround | Within 30 days for confirmed vulnerabilities |

## Out of Scope

- Vulnerabilities in the underlying Ollama inference engine (report those upstream)
- Issues that require physical access to the deployment host
- Theoretical attacks with no demonstrated impact
- Vulnerabilities in the demo deployment that do not apply to a production configuration

## Disclosure Policy

Once a fix is released, the vulnerability will be disclosed publicly via a GitHub Security Advisory. Credit will be given to the reporter unless anonymity is requested.

## Security Documentation

The full technical security posture — OWASP LLM Top 10 controls, PII masking patterns, prompt injection defences, rate limiting, and container hardening — is documented in [`SECURITY_FRAMEWORK.md`](./SECURITY_FRAMEWORK.md).
