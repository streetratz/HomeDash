# Feature Specification: Codebase Health Cleanup

**Feature Branch**: `036-codebase-cleanup`  
**Created**: 2025-07-14  
**Status**: Draft  
**Tracking**: Issues #128, #129, #130, #131

## User Scenarios & Testing

### User Story 1 - Patch SSRF Vulnerability in Sonos Art Proxy (Priority: P1)

A security-conscious maintainer needs the Sonos album-art proxy endpoint hardened so that attackers cannot exploit it to reach internal services, cloud metadata endpoints, or non-HTTP resources.

**Why this priority**: Security vulnerabilities pose immediate risk to production environments and must be resolved before other housekeeping items.

**Independent Test**: Can be tested by sending crafted requests to the art-proxy endpoint with internal IPs, non-HTTP schemes, oversized responses, and non-image content-types, verifying all are rejected.

**Acceptance Scenarios**:

1. **Given** a request with a URL hash that does not match the source URL, **When** the proxy receives the request, **Then** it rejects the request without fetching.
2. **Given** a request targeting a private IP (10.x, 172.16-31.x, 192.168.x, 169.254.x, 127.x) or cloud metadata IP (169.254.169.254), **When** the proxy resolves the hostname, **Then** it refuses to connect.
3. **Given** a request with a non-http/non-https scheme (file://, ftp://, gopher://), **When** the proxy parses the URL, **Then** it rejects the request immediately.
4. **Given** a remote response larger than the configured maximum size, **When** the proxy streams the response, **Then** it aborts the download and returns an error.
5. **Given** a remote response with a non-image content-type, **When** the proxy inspects headers, **Then** it discards the response and returns an error.

---

### User Story 2 - Fix Backend Type Errors (Priority: P2)

A developer running the build pipeline expects `tsc --noEmit` (or equivalent typecheck) to pass without errors so that CI remains green and type safety is enforced.

**Why this priority**: A failing typecheck blocks CI and erodes confidence in the type system, affecting all contributors.

**Independent Test**: Run the backend typecheck command; it should exit with code 0 and produce no errors related to `unifi-service.ts` or response types.

**Acceptance Scenarios**:

1. **Given** the backend source, **When** the typecheck runs, **Then** it completes with zero errors.
2. **Given** `unifi-service.ts` uses a fetch-like call, **When** the response type is referenced, **Then** it aligns with the runtime's actual response type (undici or global fetch).
3. **Given** the CI/CD pipeline, **When** a pull request is opened, **Then** the typecheck step executes automatically and blocks merge on failure.

---

### User Story 3 - Remove Unused Dependencies (Priority: P3)

A maintainer wants to reduce install size, audit surface, and confusion by removing packages that are imported nowhere in the codebase, and replacing icons from a removed library with equivalents from the project's existing icon library.

**Why this priority**: Unused dependencies increase install time, widen the attack surface for supply-chain vulnerabilities, and confuse contributors.

**Independent Test**: After removal, `pnpm install` succeeds, the application builds without errors, and no runtime import failures occur. The ClockStrip component renders the replacement icons correctly.

**Acceptance Scenarios**:

1. **Given** the frontend workspace, **When** `next-themes`, `@fortawesome/fontawesome-svg-core`, `@fortawesome/free-solid-svg-icons`, `@fortawesome/react-fontawesome`, `@vitest/coverage-v8`, and `@radix-ui/react-tooltip` are removed from `package.json`, **Then** `pnpm install` and the frontend build succeed.
2. **Given** the backend workspace, **When** `@fastify/csrf-protection` and `@types/sharp` are removed from `package.json`, **Then** `pnpm install` and the backend build succeed.
3. **Given** `ClockStrip.tsx` uses `faHouse`, `faSun`, `faMoon` from FontAwesome, **When** those imports are replaced with lucide-react equivalents (e.g., `Home`, `Sun`, `Moon`), **Then** the component renders correctly with no visual regression.

---

### User Story 4 - Remove Dead Code (Priority: P4)

A maintainer wants to delete unreachable or unused source files so the codebase is easier to navigate, reduces bundle analysis noise, and avoids misleading contributors.

**Why this priority**: Dead code creates cognitive overhead but carries no production risk; safe to address after higher-priority items.

**Independent Test**: After deletion, the application builds and all existing tests pass. No remaining imports reference the deleted modules.

**Acceptance Scenarios**:

1. **Given** `MiniCalendarView.tsx`, `DayDetailPanel.tsx`, and `EventCard.tsx` are unused, **When** they are deleted, **Then** the build succeeds with no broken imports.
2. **Given** `progress-bar.tsx`, `status-dot.tsx`, and `tooltip.tsx` are unused UI components, **When** they are deleted, **Then** the build succeeds with no broken imports.
3. **Given** `WidgetHeaderContext.tsx`, **When** no widget uses `setActions`, **Then** the file is deleted and the build succeeds. If any widget still uses it, the file is retained.

---

### Edge Cases

- What happens if a "removed" dependency is imported transitively by another package? Verify no runtime breakage.
- What happens if the SSRF blocklist misses an IPv6-mapped private address? Ensure IPv6 representations of private ranges are also blocked.
- What happens if the Sonos device returns a redirect to a private IP? Ensure redirect targets are also validated.
- What happens if `WidgetHeaderContext.tsx` is imported dynamically or conditionally? Perform a full-text search before deleting.

## Requirements

### Functional Requirements

- **FR-001**: The Sonos art proxy MUST verify that the request hash matches the source URL before initiating any outbound fetch.
- **FR-002**: The Sonos art proxy MUST reject URLs with schemes other than `http` or `https`.
- **FR-003**: The Sonos art proxy MUST resolve the target hostname and block connections to private (RFC 1918), loopback (127.0.0.0/8), link-local (169.254.0.0/16), and metadata (169.254.169.254) IP ranges.
- **FR-004**: The Sonos art proxy MUST enforce a maximum response body size and abort downloads that exceed it.
- **FR-005**: The Sonos art proxy MUST validate that the response `Content-Type` header indicates an image before forwarding.
- **FR-006**: The backend typecheck MUST pass with zero errors after fixing the undici/Response type mismatch in `unifi-service.ts`.
- **FR-007**: The CI pipeline MUST run the backend typecheck as a required step.
- **FR-008**: All listed unused dependencies MUST be removed from their respective `package.json` files.
- **FR-009**: FontAwesome icon references in `ClockStrip.tsx` MUST be replaced with lucide-react equivalents.
- **FR-010**: All listed dead-code files MUST be deleted, provided no live code references them.
- **FR-011**: `WidgetHeaderContext.tsx` MUST be deleted only if no component uses `setActions`.

### Key Entities

- **Art Proxy Request**: Represents an inbound request to the Sonos album-art proxy; key attributes include source URL, hash, resolved IP, response size, and content-type.
- **Dependency Entry**: A package listed in `package.json`; key attributes include name, workspace (frontend/backend), and usage status (used/unused).
- **Dead Code Module**: A source file with zero inbound imports from live code paths.

## Success Criteria

### Measurable Outcomes

- **SC-001**: The Sonos art proxy rejects 100% of requests targeting private/loopback/link-local/metadata IPs.
- **SC-002**: The Sonos art proxy rejects 100% of requests with non-http/https schemes.
- **SC-003**: Backend typecheck (`tsc --noEmit` or equivalent) exits with code 0 and zero errors.
- **SC-004**: Combined `node_modules` install size decreases (fewer packages resolved by lockfile).
- **SC-005**: Total source file count decreases by the number of dead-code files removed (5-6 files).
- **SC-006**: Full application build (frontend + backend) succeeds after all changes.
- **SC-007**: All existing automated tests continue to pass.

## Assumptions

- The project uses `pnpm` workspaces with separate frontend and backend `package.json` files.
- `lucide-react` is already installed in the frontend workspace and provides `Home`, `Sun`, and `Moon` icons.
- The backend is written in TypeScript and uses either Node 22's global `fetch` or the `undici` package for HTTP requests.
- The CI/CD pipeline supports adding a typecheck step (or one already exists but is not currently enforcing on the unifi-service).
- The Sonos art proxy is a backend route that fetches remote album-art images on behalf of the frontend.
- Issue #132 (bundle splitting) is explicitly out of scope for this effort.
- No other features depend on the components or packages being removed; verification via grep/search will confirm before deletion.
