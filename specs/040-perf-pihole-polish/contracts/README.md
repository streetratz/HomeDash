# Contracts — Performance Optimizations & Pi-hole Widget Polish

This feature introduces **no new external interfaces**. All changes are internal frontend optimisations:

- No new API endpoints
- No new public contracts
- No schema changes
- No new configuration file formats

Existing API contracts for Pi-hole (`/api/pihole/*`), UniFi (`/api/unifi/*`), and Spotify (`/api/spotify/*`) remain unchanged. The frontend simply adjusts how frequently it calls them.
