import type { ConfigContext } from 'expo/config';

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

export default ({ config }: ConfigContext) => ({
  ...config,

  ios: {
    ...config.ios,
    config: {
      googleMapsApiKey: googleMapsApiKeyIos,
    },
  },

  android: {
    ...config.android,
    config: {
      googleMaps: {
        apiKey: googleMapsApiKeyAndroid,
      },
    },
  },
});
