# GitHub Actions APK Build (Secondary, Optional Path)

This is an **additional, optional** way to produce an installable Android APK,
alongside the existing EAS build. It does not replace, modify, or depend on
EAS Cloud Queue.

The existing flow is unchanged and still the primary/production path:

```
pnpm exec eas build --platform android --profile preview
```

## How to run it

The workflow only runs when triggered manually (`workflow_dispatch`) — it never
runs automatically on push or PR.

**From a phone (or any browser):**
1. Open the repository on github.com (mobile browser or the GitHub mobile app).
2. Go to **Actions** → **Android APK Build (GitHub Actions)**.
3. Tap **Run workflow**.
4. Choose the branch and a `build_variant`:
   - `debug` (default) — no secrets required, always works, debug-signed.
   - `release` — optimized build; uses release signing only if the optional
     keystore secrets below are configured, otherwise falls back to whatever
     default signing the generated Gradle project provides.
5. Tap **Run workflow** to start.

## Where to download the APK

1. Wait for the run to finish (Actions tab → the running/finished workflow).
2. Open the completed run.
3. Scroll to **Artifacts** at the bottom of the run summary page.
4. Download `veego-android-apk-debug` (or `-release`) — it contains the `.apk` file.
5. On a phone, GitHub's artifact download is a `.zip`; unzip it to get the `.apk`,
   then install it directly (allow "install unknown apps" for your browser/files app).

## Required GitHub Secrets

None are required for the default (`debug`) build. All of the following are
**optional** and only change behavior if set — no secret values are included
in this repository.

| Secret name | Purpose | Required? |
|---|---|---|
| `GOOGLE_MAPS_API_KEY_ANDROID` | Bakes a working Google Maps key into the built APK | Optional — without it, maps render blank (same as local dev without the key) |
| `GOOGLE_MAPS_API_KEY_IOS` | Same, for iOS if this workflow is ever extended | Optional |
| `ANDROID_KEYSTORE_BASE64` | Base64-encoded release keystore file, for a real signed `release` build | Optional — only used when `build_variant: release` |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password | Optional, pairs with above |
| `ANDROID_KEY_ALIAS` | Key alias inside the keystore | Optional, pairs with above |
| `ANDROID_KEY_PASSWORD` | Key password | Optional, pairs with above |

Configure secrets under **Settings → Secrets and variables → Actions** in the
GitHub repository. Never commit these values to the repository itself.

**Note on `release` signing:** this workflow writes the keystore secrets into
`android/app/gradle.properties` using the conventional
`MYAPP_UPLOAD_STORE_FILE` / `MYAPP_UPLOAD_KEY_ALIAS` / `MYAPP_UPLOAD_STORE_PASSWORD`
/ `MYAPP_UPLOAD_KEY_PASSWORD` property names. Because `android/` is generated
fresh by `expo prebuild` inside the CI run (it is not committed to this repo),
the exact signing block in the generated `android/app/build.gradle` should be
checked after the first prebuild to confirm it reads these property names —
if it doesn't, the `build.gradle` signing config or this workflow's property
names need to be aligned before `release` will produce a properly signed APK.
`debug` builds are unaffected by this and always work.

## EAS build vs. GitHub APK build

| | EAS Build (`eas build`) | GitHub APK Build (this workflow) |
|---|---|---|
| Where it runs | Expo's hosted cloud queue | GitHub-hosted `ubuntu-latest` runner |
| Native project | Generated ephemerally by EAS, never touches this repo | Generated ephemerally by `expo prebuild` inside the CI job, never committed |
| Credentials/signing | Managed by Expo (stored on Expo's servers) or supplied via `eas credentials` | Supplied as GitHub Actions secrets (optional; documented above) |
| Output | AAB (production) or APK (`preview` profile) via Expo dashboard/CLI | APK only, downloaded as a GitHub Actions artifact |
| Trigger | Manual CLI command (`eas build ...`) | Manual `workflow_dispatch` in the GitHub Actions UI |
| Queue dependency | Uses Expo's cloud build queue/minutes | Uses GitHub Actions minutes instead — no dependency on Expo's queue |
| Project workflow impact | None — Managed workflow stays as-is | None — Managed workflow stays as-is; `android/` is never committed by this workflow |

Use EAS for the standard/production path. Use this GitHub Actions workflow
when EAS Cloud Queue is unavailable, slow, or you want an APK without using
Expo's build minutes.

## Remaining manual setup

- Nothing is required to use the default `debug` build — it works with zero
  configuration beyond having the workflow file in the repository.
- To bake a working Google Maps key into CI-built APKs, add
  `GOOGLE_MAPS_API_KEY_ANDROID` as a repository secret.
- To produce a properly release-signed APK, generate/obtain a release
  keystore (not part of this repository), add the four `ANDROID_*` secrets
  above, and verify the generated `build.gradle` signing config matches the
  property names as noted above.
