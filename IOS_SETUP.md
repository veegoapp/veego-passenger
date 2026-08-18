# iOS — what's built, and exactly what's left (Apple account only)

## What's done now (code/config — nothing left to "forget" here)

- `app.json` → `ios.bundleIdentifier`: `com.veego.app`.
- `ios.infoPlist.ITSAppUsesNonExemptEncryption: false` — skips the export-
  compliance question App Store Connect otherwise asks on first submit.
- Location and photo-library permission strings already set (via the
  `expo-location` / `expo-image-picker` plugins in `app.json`).
- `expo-notifications` plugin already configured with the app icon and tint
  color — bundled into the iOS build automatically, same as Android.
- Push token registration (`src/hooks/shared/usePushToken.ts`) is already
  platform-agnostic: iOS gets its token via
  `Notifications.getExpoPushTokenAsync()`, same call as Android — no
  separate iOS code path was missing.
- `eas.json` has `development` / `preview` / `production` build profiles,
  with `preview` already set to build for the **simulator** (no signing
  needed) and `production` set to auto-increment the build number.
- **New:** `.github/workflows/ios-simulator-build.yml` — builds an unsigned
  `.app` for the iOS Simulator on every manual run. Needs **zero** Apple
  credentials, since simulator builds are never code-signed. Use this to
  build and smoke-test the iOS version right now, download the `.app`
  artifact, and drag it onto a running Simulator (or `xcrun simctl install`).

None of the above needs touching again — it's done.

## What's genuinely left — Apple Developer account only (I cannot do these)

These need your Apple ID / Apple Developer Program access (not code):

1. **Apple Developer Program membership** (paid, $99/yr) under the team that
   will own `com.veego.app`.
2. **APNs key for push notifications** — upload via
   [expo.dev](https://expo.dev) → this project → **Credentials → iOS →
   Push Notifications**, same page style as the Android FCM V1 key already
   uploaded for both apps. EAS can also generate this automatically the
   first time you run `eas build --platform ios` and log in interactively.
3. **Distribution certificate + provisioning profile** — for a real-device
   or App Store build (not needed for the Simulator workflow above). EAS
   generates and manages these automatically once you're logged into your
   Apple Developer account via `eas credentials` or during
   `eas build --platform ios`.
4. **App Store Connect app record** — create the app at
   [appstoreconnect.apple.com](https://appstoreconnect.apple.com) with
   bundle ID `com.veego.app` (only needed once you're ready to submit).
5. **Fill in `eas.json` → `submit.production.ios`** with the real values
   (currently placeholders):
   - `appleId`: your Apple ID email.
   - `ascAppId`: the App Store Connect app's numeric ID (from step 4).
   - `appleTeamId`: your Apple Developer Team ID (Apple Developer portal →
     Membership).

## How to build once the above is done

```bash
# Real device / ad-hoc, internal distribution:
pnpm exec eas build --platform ios --profile preview

# App Store:
pnpm exec eas build --platform ios --profile production
pnpm exec eas submit --platform ios --profile production
```

The first `eas build --platform ios` run will interactively ask for your
Apple ID and offer to generate the distribution certificate, provisioning
profile, and APNs key automatically — you don't need to create these by hand
in the Apple Developer portal.

## Verifying push notifications actually work on iOS

Same procedure as the Android verification for the driver app: install a
real build (Simulator can't receive real push — test on a physical device
once signed), log in, background/kill the app, and trigger a driver-arrived
or ride-accepted event from the backend. A notification should arrive even
though the app is closed.
