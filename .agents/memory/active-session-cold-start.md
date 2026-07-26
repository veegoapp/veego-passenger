---
name: ActiveSession cold start
description: Ordering rule for Passenger ActiveSession initialization and startup recovery.
---

The Passenger App must validate authentication and obtain an access token before initializing ActiveSession. Cold-start navigation should wait for the REST session fetch to finish; a fetch failure preserves any existing session and falls back to normal startup. The socket listener may attach afterward so `session:snapshot` can refine or clear the REST result.

**Why:** The backend contract makes `GET /api/passenger/session` the deterministic cold-start source, while socket snapshots are delivered asynchronously on connection.

**How to apply:** Keep old recovery paths available during migration, but do not let them decide startup when the ActiveSession REST result has completed.