const fs = require("fs");
const path = require("path");

const googleMapsApiKeyIos = process.env.GOOGLE_MAPS_API_KEY_IOS || "";
const googleMapsApiKeyAndroid = process.env.GOOGLE_MAPS_API_KEY_ANDROID || "";

// Dev-only heads-up: an empty key still builds fine but renders a blank map
// on a real device with no in-app error. Production behavior is unchanged.
if (process.env.NODE_ENV !== 'production') {
  if (!googleMapsApiKeyIos) {
    console.warn('[VeeGo] GOOGLE_MAPS_API_KEY_IOS is not set — the iOS Google Map will render blank.');
  }
  if (!googleMapsApiKeyAndroid) {
    console.warn('[VeeGo] GOOGLE_MAPS_API_KEY_ANDROID is not set — the Android Google Map will render blank.');
  }
}

// ── Android FCM wiring (mirrors the same fix in the driver app) ──────────────
// Android push notifications on Expo SDK 53+ REQUIRE Firebase Cloud Messaging.
// That means a `google-services.json` (downloaded from the Firebase console for
// the `com.veego.app` Android app — a SEPARATE Firebase Android app entry from
// the driver app's `com.veego.driver`, even if it lives in the same Firebase
// project) must be bundled into the native build and referenced here via
// `android.googleServicesFile`. Without it the native app has no Firebase
// config, so at runtime `getExpoPushTokenAsync()` throws ("Default FirebaseApp
// is not initialized"), the passenger never obtains a push token, and nothing
// can reach a backgrounded or killed app — driver-arrived / ride-accepted
// alerts included.
//
// Resolved from (in order):
//   1. process.env.GOOGLE_SERVICES_JSON — an EAS secret *file* env var, or
//   2. ./google-services.json           — a file committed at the repo root.
// If neither exists we DO NOT set the key (so prebuild/EAS build still
// succeeds) but we print a loud warning, because Android push will not work
// until this is provided.
function resolveGoogleServicesFile() {
  const candidates = [
    process.env.GOOGLE_SERVICES_JSON,
    path.resolve(__dirname, "google-services.json"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      /* ignore and try the next candidate */
    }
  }
  return null;
}

module.exports = ({ config }) => {
  const googleServicesFile = resolveGoogleServicesFile();

  if (!googleServicesFile) {
    // eslint-disable-next-line no-console
    console.warn(
      "\n⚠️  [veego-passenger] google-services.json NOT FOUND.\n" +
        "    Android push notifications (driver-arrived/ride-accepted alerts to a\n" +
        "    backgrounded/killed app) WILL NOT WORK in this build. Add the file\n" +
        "    from the Firebase console for com.veego.app, then rebuild.\n",
    );
  }

  return {
    ...config,

    ios: {
      ...config.ios,
      config: {
        googleMapsApiKey: googleMapsApiKeyIos,
      },
    },

    android: {
      ...config.android,
      ...(googleServicesFile ? { googleServicesFile } : {}),
      config: {
        googleMaps: {
          apiKey: googleMapsApiKeyAndroid,
        },
      },
    },
  };
};
