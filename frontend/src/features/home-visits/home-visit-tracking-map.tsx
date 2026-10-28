import L from 'leaflet';
import { useEffect, useRef } from 'react';
import { decodePolyline } from './decode-polyline';
import type { HomeVisitTracking } from './api';
import 'leaflet/dist/leaflet.css';

function formatDistance(meters: number | null): string | null {
  if (meters == null) return null;
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatLocationAge(iso: string | undefined): string | null {
  if (!iso) return null;
  const sec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 15) return 'Updated just now';
  if (sec < 60) return `Updated ${sec}s ago`;
  const min = Math.round(sec / 60);
  return `Updated ${min} min ago`;
}

const homeIcon = L.divIcon({
  className: '',
  html: '<div style="width:16px;height:16px;border-radius:9999px;background:#1C8A5A;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const doctorIcon = L.divIcon({
  className: '',
  html: '<div style="width:16px;height:16px;border-radius:9999px;background:#4C4FE0;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export function HomeVisitTrackingMap({
  tracking,
  doctorName,
}: {
  tracking: HomeVisitTracking;
  doctorName?: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const routeRef = useRef<L.Polyline | null>(null);
  const doctorMarkerRef = useRef<L.Marker | null>(null);
  const homeMarkerRef = useRef<L.Marker | null>(null);
  const didFitRef = useRef(false);

  const destination = tracking.destination;
  const doctor = tracking.doctor;
  const arrived = tracking.etaMinutes === 0;
  const canShowMap = Boolean(destination || doctor);
  const locationAge = formatLocationAge(doctor?.updatedAt);

  useEffect(() => {
    didFitRef.current = false;
  }, [destination?.lat, destination?.lng]);

  useEffect(() => {
    if (!containerRef.current || !canShowMap) return;

    if (!mapRef.current) {
      mapRef.current = L.map(containerRef.current, { scrollWheelZoom: false });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(mapRef.current);
    }

    const map = mapRef.current;

    if (destination) {
      if (!homeMarkerRef.current) {
        homeMarkerRef.current = L.marker([destination.lat, destination.lng], {
          icon: homeIcon,
          title: 'Your address',
        }).addTo(map);
      } else {
        homeMarkerRef.current.setLatLng([destination.lat, destination.lng]);
      }
    } else if (homeMarkerRef.current) {
      homeMarkerRef.current.remove();
      homeMarkerRef.current = null;
    }

    if (doctor) {
      const title = doctorName ? `Dr. ${doctorName}` : 'Doctor';
      if (!doctorMarkerRef.current) {
        doctorMarkerRef.current = L.marker([doctor.lat, doctor.lng], {
          icon: doctorIcon,
          title,
        }).addTo(map);
      } else {
        doctorMarkerRef.current.setLatLng([doctor.lat, doctor.lng]);
      }
    } else if (doctorMarkerRef.current) {
      doctorMarkerRef.current.remove();
      doctorMarkerRef.current = null;
    }

    let routeBounds: L.LatLngBounds | null = null;

    if (tracking.routePolyline) {
      const path = decodePolyline(tracking.routePolyline).map(
        (p) => [p.lat, p.lng] as L.LatLngExpression,
      );
      if (path.length > 0) {
        if (routeRef.current) {
          routeRef.current.setLatLngs(path);
          routeRef.current.setStyle({ dashArray: undefined, opacity: 0.85, weight: 5 });
        } else {
          routeRef.current = L.polyline(path, {
            color: '#4C4FE0',
            weight: 5,
            opacity: 0.85,
          }).addTo(map);
        }
        routeBounds = L.latLngBounds(path);
      }
    } else if (doctor && destination) {
      const path: L.LatLngExpression[] = [
        [doctor.lat, doctor.lng],
        [destination.lat, destination.lng],
      ];
      if (routeRef.current) {
        routeRef.current.setLatLngs(path);
        routeRef.current.setStyle({ dashArray: '8 8', opacity: 0.55, weight: 4 });
      } else {
        routeRef.current = L.polyline(path, {
          color: '#4C4FE0',
          weight: 4,
          opacity: 0.55,
          dashArray: '8 8',
        }).addTo(map);
      }
      routeBounds = L.latLngBounds(path);
    } else if (routeRef.current) {
      routeRef.current.remove();
      routeRef.current = null;
    }

    if (!didFitRef.current) {
      if (routeBounds) {
        map.fitBounds(routeBounds, { padding: [40, 40], maxZoom: 16 });
        didFitRef.current = true;
      } else {
        const boundPoints: L.LatLngExpression[] = [];
        if (destination) boundPoints.push([destination.lat, destination.lng]);
        if (doctor) boundPoints.push([doctor.lat, doctor.lng]);
        if (boundPoints.length === 1) {
          map.setView(boundPoints[0], 15);
          didFitRef.current = true;
        } else if (boundPoints.length > 1) {
          map.fitBounds(L.latLngBounds(boundPoints), { padding: [40, 40], maxZoom: 16 });
          didFitRef.current = true;
        }
      }
    } else if (doctor) {
      map.panTo([doctor.lat, doctor.lng], { animate: true, duration: 0.35 });
    }

    return () => {
      /* map instance reused across prop updates; torn down on unmount below */
    };
  }, [
    canShowMap,
    destination?.lat,
    destination?.lng,
    doctor?.lat,
    doctor?.lng,
    tracking.routePolyline,
    doctorName,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    return () => {
      map?.remove();
      mapRef.current = null;
      routeRef.current = null;
      doctorMarkerRef.current = null;
      homeMarkerRef.current = null;
    };
  }, []);

  const etaLabel =
    arrived || tracking.etaMinutes === 0
      ? 'Doctor at your location'
      : tracking.etaMinutes != null
        ? `About ${tracking.etaMinutes} min away`
        : doctor
          ? 'Doctor is on the way'
          : 'Waiting for doctor GPS';

  const distanceLabel = formatDistance(tracking.distanceMeters);

  if (!canShowMap) {
    return (
      <div className="rounded-[var(--radius-card)] border border-line bg-surface px-4 py-6 text-sm text-ink-muted">
        We could not place your address on the map yet. Tracking will appear once the address is
        geocoded. Refresh this page in a moment, or add a clearer locality when you book next time.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
      <div className="border-b border-line px-4 py-3 text-sm">
        <p className="font-semibold text-ink">{etaLabel}</p>
        {distanceLabel && !arrived && (
          <p className="mt-0.5 text-ink-muted">{distanceLabel} remaining (driving)</p>
        )}
        {!doctor && (
          <p className="mt-0.5 text-ink-muted">
            Waiting for your doctor&apos;s live GPS — they must tap <strong>Mark en route</strong>{' '}
            and keep their dashboard open on a phone with location enabled.
          </p>
        )}
        {doctor && locationAge && (
          <p className="mt-0.5 text-ink-muted">Doctor location · {locationAge}</p>
        )}
        {!destination && doctor && (
          <p className="mt-0.5 text-ink-muted">
            Home pin is approximate — route may refine once your address is geocoded.
          </p>
        )}
        {!tracking.routePolyline && doctor && destination && (
          <p className="mt-0.5 text-ink-muted">Dashed line — driving route loading or unavailable.</p>
        )}
        <p className="mt-2 flex flex-wrap gap-3 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-full bg-[#1C8A5A]" aria-hidden />
            Your home
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-full bg-[#4C4FE0]" aria-hidden />
            Doctor
          </span>
        </p>
        {doctorName && (
          <p className="mt-1 text-ink-muted">
            {doctorName.startsWith('Dr') ? doctorName : `Dr. ${doctorName}`}
          </p>
        )}
      </div>
      <div ref={containerRef} className="aspect-[16/10] w-full bg-sand/30" aria-label="Live map" />
    </div>
  );
}
