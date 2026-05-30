# Glide — React Native Expo App

A premium shuttle booking mobile app built with Expo Router.

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- For iOS: Xcode (macOS only)
- For Android: Android Studio + emulator

### Install & Run

```bash
# Install dependencies
npm install

# Start development server
npm start

# Run on specific platform
npm run ios       # iOS simulator
npm run android   # Android emulator
npm run web       # Web browser
```

Scan the QR code with **Expo Go** app on your phone to run on a real device.

## App Structure

```
app/
  _layout.tsx          # Root layout (fonts, providers, global sheets)
  index.tsx            # Splash screen → auto-redirects to onboarding
  onboarding.tsx       # 3-step onboarding carousel
  auth.tsx             # Sign in / Sign up / Forgot password
  (tabs)/
    _layout.tsx        # Custom floating tab bar
    index.tsx          # Home screen
    routes.tsx         # Browse all routes
    trips.tsx          # My trips (upcoming & past)
    profile.tsx        # Profile & settings
  stations.tsx         # Nearby stations map
  notifications.tsx    # Push notifications list
  ticket.tsx           # Booking confirmation + QR code

components/
  RouteCard.tsx        # Route card + Featured offers
  TripSheet.tsx        # Bottom sheet — book a trip
  ConfirmSheet.tsx     # Bottom sheet — confirm booking
  Illustrations.tsx    # SVG onboarding illustrations
  Shared.tsx           # TopBar, SectionHeader, MapMockView, etc.

constants/
  colors.ts            # Design tokens (colors, shadows, glass style)
  data.ts              # Mock data: stations, routes, trips, notifications

context/
  BookingContext.tsx   # Global booking state
```

## Tech Stack

- **Expo SDK 52** + **Expo Router 4** (file-based routing)
- **React Native Reanimated 3** — smooth spring animations
- **React Native Gesture Handler** — touch interactions
- **expo-linear-gradient** — premium gradient backgrounds
- **expo-haptics** — tactile feedback
- **@tanstack/react-query** — data fetching (ready to wire to backend)
- **Inter font** — via @expo-google-fonts/inter
