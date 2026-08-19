# Security Policy

## Supported Version

Security fixes are evaluated for the current `main` branch. Because this is a browser-only game with no hosted backend, no user accounts, and no repository-managed secrets, reports should focus on the code, dependency chain, build process, deployment configuration, or project artifacts.

| Version | Supported |
| --- | --- |
| `main` | Yes |
| Historical commits and unmaintained copies | Best effort |

## Reporting a Vulnerability

Please **do not open a public issue** for a suspected vulnerability. Use GitHub’s private vulnerability-reporting feature for this repository when available. If that route is unavailable, follow the private support contact in [SUPPORT.md](SUPPORT.md) and include `Security report` in the subject.

A useful report states the affected file or feature, reproduction steps, expected and observed behavior, impact, affected versions or commit SHA, and any proof-of-concept that can be shared safely. Do not include secrets, personal information, or an exploit that could harm systems or users.

## Response Process

The maintainers will acknowledge a good-faith report within **seven calendar days** and assess it privately. Confirmed issues are prioritized by impact and exploitability. Coordinated disclosure will occur after a fix or mitigation is available, with credit offered to reporters who want it.

## Scope Notes

This project intentionally avoids a backend, user authentication, telemetry, and server-side storage. `QA_URL` is only a local or preview address used by the Playwright validation script; it must not be treated as a secret or populated with credentials. Third-party dependencies and GitHub Actions configuration remain in scope when they affect the project’s supply chain or deployment posture.

## Safe Harbor

Good-faith security research conducted within these guidelines is welcome. Do not access data that is not yours, disrupt services, social-engineer contributors, or attempt actions beyond what is necessary to demonstrate the issue safely.
