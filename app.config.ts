import type { ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext) => ({
  ...config,

  ios: {
    ...config.ios,
    config: {
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY_IOS || "",
    },
  },

  android: {
    ...config.android,
    config: {
      googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_API_KEY_ANDROID || "",
      },
    },
  },
});
