import { useEffect, useRef } from 'react';
import { homeVisitsApi } from './api';
import { readCurrentPosition, watchPosition } from './geolocation';

/** Sends doctor GPS to the API every ~12s while the visit is en route. */
export function useDoctorVisitGps(requestId: string | null, enabled: boolean) {
  const lastSent = useRef(0);

  useEffect(() => {
    if (!enabled || !requestId) return;

    const send = (coords: { lat: number; lng: number }) => {
      const now = Date.now();
      if (now - lastSent.current < 12_000) return;
      lastSent.current = now;
      void homeVisitsApi.postDoctorLocation(requestId, coords);
    };

    void readCurrentPosition()
      .then((coords) => {
        lastSent.current = Date.now();
        void homeVisitsApi.postDoctorLocation(requestId, coords);
      })
      .catch(() => {
        /* watchPosition will retry on next fix */
      });

    const stop = watchPosition((coords) => send(coords));

    return stop;
  }, [enabled, requestId]);
}
