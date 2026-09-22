# 015 Integrations Hub — Requirements Checklist

## Connection Management (Settings Page)
- [ ] IntegrationsTab redesigned with grouped categories
- [ ] Pi-hole: Create, edit, test, delete connections from Settings
- [ ] Docker: Create, edit, test, delete connections from Settings
- [ ] Spotify: Connect/disconnect OAuth from Settings
- [ ] Calendar: OAuth + iCal sources remain accessible (existing)
- [ ] Todo: Microsoft To Do connections remain accessible (existing)
- [ ] Each connection shows status indicator (connected/disconnected/error)
- [ ] "Test Connection" action works for Pi-hole and Docker
- [ ] Multiple connections per integration type supported

## Widget Config Forms
- [ ] Pi-hole widget uses connection picker instead of URL/token fields
- [ ] Docker widget uses connection picker instead of URL field
- [ ] Spotify widget shows "Manage in Settings" link
- [ ] "Add new connection" links navigate to Settings > Integrations

## Data Model
- [ ] docker_connections table created
- [ ] pihole_instances decoupled from widget instances
- [ ] widget_connections join table created
- [ ] Migration preserves all existing configs
- [ ] Credentials remain encrypted at rest

## Security
- [ ] All connection CRUD routes require admin role
- [ ] CSRF protection on all mutations
- [ ] API tokens encrypted before storage
- [ ] OAuth tokens encrypted before storage

## UX
- [ ] Empty states with helpful onboarding text
- [ ] Delete protection for connections in use by widgets
- [ ] Connection test feedback (success/error with details)
