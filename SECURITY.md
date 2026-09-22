# Security Policy

## Reporting a Vulnerability

Please do not open a public issue for a suspected vulnerability.

Use GitHub's **Report a vulnerability** option in the repository Security tab. Include
the affected version, deployment configuration, reproduction steps, potential impact,
and any suggested mitigation. Avoid including real credentials, database contents,
private network details, or other users' data.

If private vulnerability reporting is temporarily unavailable during repository
cutover, wait until it is enabled rather than publishing sensitive details.

## Supported Versions

Security fixes target the latest published HomeDash release. Upgrade to the latest
release before reporting behavior that may already have been corrected.

## Deployment Boundary

HomeDash is designed for a private LAN, but the LAN is treated as hostile. Do not
expose HomeDash directly to the internet. Use authentication, a persistent session
secret, TLS through a trusted reverse proxy where practical, and least-privilege
integration credentials.
