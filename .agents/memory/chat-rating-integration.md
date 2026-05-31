---
name: Chat + Rating integration
description: How in-trip chat and rate-driver hook into the ride lifecycle in car.tsx
---

## Rate Driver (Feature 1)
- `RatingSheet` (components/shared/RatingSheet.tsx) is UI-only; the API call lives in car.tsx's `handleRatingSubmit`.
- Auto-shows when phase → 'completed' via `useEffect([phase, rideState.rideId])`.
- Dedup: `ratedRideIds = useRef<Set<string>>(new Set())` — prevents re-rating same rideId in one session.
- API: `POST /api/rides/:rideId/rate-driver` with `{ rating: stars, comment }`.

**Why:** RatingSheet has no knowledge of the API; car.tsx owns the rideId and session.

## In-trip Chat (Feature 2)
- Hook: `src/hooks/useRideChat.ts` — loads `GET /api/trips/:tripId/chat`, sends `POST /api/trips/:tripId/chat`, listens to `trip:chat-message` socket event.
- `ChatModal` accepts `tripId: string | null`; pass `rideState.rideId` as the tripId.
- Socket event `trip:chat-message` added to `src/constants/socketEvents.ts`.
- Chat button (MessageCircle icon) added to active/arrived/in_trip phases in car.tsx.
- `DriverAssignedCard` gained `rideId?: string | null` prop (forwarded to ChatModal).

**Why:** tripId = rideId in this system; hook is fail-open (empty chat on 404/error).

## Live Driver Map (Feature 3)
- When `rideState.driverLocation` is non-null AND phase is active/arrived/in_trip, `PassengerTrackingMap` (real map) replaces `RideMap` (fake animated canvas).
- `PassengerTrackingMap` uses `.web.tsx` / `.native.tsx` platform split — auto-resolved by Metro.
- Wrap in `<View style={{ height: MAP_H, overflow: 'hidden' }}>` since PassengerTrackingMap uses absoluteFill.
- `useRide` hook already polls + listens to `ride:driver_location` socket and populates `rideState.driverLocation`.
