/** Reads the browser's current GPS fix (for home visit booking / doctor en route). */
export function readCurrentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location is not supported in this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  });
}

export function watchPosition(
  onUpdate: (coords: { lat: number; lng: number }) => void,
  onError?: (message: string) => void,
): () => void {
  if (!navigator.geolocation) {
    onError?.('Location is not supported in this browser.');
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    (pos) =>
      onUpdate({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      }),
    () => onError?.('Could not read GPS. Check location permission.'),
    { enableHighAccuracy: true, maximumAge: 5_000, timeout: 25_000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}
