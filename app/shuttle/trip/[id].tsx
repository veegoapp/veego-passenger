import { useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';

// Receiving screen for the `veego://shuttle/trip/{tripId}` invite/share link
// (see trip-detail.tsx's handleShare) when tapped directly — e.g. from
// WhatsApp/SMS — rather than via a push notification (that path is handled
// separately in app/_layout.tsx's handleNotificationDeepLink, which already
// knew to redirect to /trip-detail). Without a route file at this path,
// expo-router had nowhere to send a direct tap on the link at all (H17).
export default function ShuttleTripLinkRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();

  useEffect(() => {
    if (id) {
      router.replace(`/trip-detail?id=${id}`);
    } else {
      router.replace('/(tabs)');
    }
  }, [id]);

  return null;
}
