# Contributing to HomeDash

Thank you for helping improve HomeDash.

## Before Opening a Change

- Search existing issues and pull requests.
- Open an issue for user-visible features or behavior changes before investing in a
  large implementation.
- Never include credentials, runtime databases, backups, SSH material, uploads,
  private network details, or household/device identifiers.

## Development

HomeDash uses Node.js 24 and pnpm 11.

```bash
pnpm install
pnpm dev
```

Keep changes focused and follow the repository specifications, constitution, and
scoped `AGENTS.md` guidance. Add or update tests for behavior changes.

Before submitting:

```bash
pnpm --filter backend test
pnpm --filter frontend test:unit
pnpm typecheck
pnpm build
pnpm lint
```

## Pull Requests

- Explain the problem, solution, security implications, and validation performed.
- Update documentation for configuration, deployment, or behavior changes.
- Use fictional examples such as `docker-host.home.arpa`; do not publish real LAN
  topology or local paths.
- The repository owner retains merge and release authority. Contributions are
  reviewed and merged at the owner's discretion.

By contributing, you agree that your contribution is licensed under the MIT License.
