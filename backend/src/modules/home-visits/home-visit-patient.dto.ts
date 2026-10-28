import type { HomeVisitRequestDocument } from './home-visit-request.schema';
import {
  HOME_VISIT_ESTIMATED_TRIP_MINUTES,
  HOME_VISIT_PAYMENT_HOLD_MINUTES,
} from './home-visit-statuses';
import type { PaymentGateway } from '../payments/payment-gateway';
import type { OsmMapService } from './osm-map.service';
import type { HomeVisitTrackingDto } from './dto/home-visit-requests.dto';

export type HomeVisitTrackingDtoShape = HomeVisitTrackingDto;

export function homeVisitCheckout(
  doc: HomeVisitRequestDocument,
  gateway: PaymentGateway,
  now: Date,
): { keyId: string; orderId: string; amountPaise: number; currency: 'INR' } | null {
  if (doc.status !== 'pending_payment') return null;
  if (!gateway.available || !gateway.publicKey || !doc.payment.orderId) return null;
  const hold = doc.paymentHoldExpiresAt?.getTime() ?? 0;
  if (hold <= now.getTime()) return null;
  return {
    keyId: gateway.publicKey,
    orderId: doc.payment.orderId,
    amountPaise: doc.payment.amountPaise,
    currency: 'INR',
  };
}

export function homeVisitPaymentDue(doc: HomeVisitRequestDocument, now: Date): boolean {
  return (
    doc.status === 'pending_payment' &&
    doc.payment.status === 'pending' &&
    (doc.paymentHoldExpiresAt?.getTime() ?? 0) > now.getTime()
  );
}

export function homeVisitDispatchReady(doc: HomeVisitRequestDocument): boolean {
  /** Legacy name: patient may book before paying; dispatch offers go out while payment is still pending. */
  if (doc.status === 'cancelled') return false;
  return doc.payment.status === 'paid' || doc.payment.status === 'not_required' || doc.payment.status === 'pending';
}

export function homeVisitPaymentHoldExpires(now: Date): Date {
  return new Date(now.getTime() + HOME_VISIT_PAYMENT_HOLD_MINUTES * 60 * 1000);
}

export async function buildHomeVisitLiveTracking(
  doc: HomeVisitRequestDocument,
  maps: OsmMapService,
): Promise<HomeVisitTrackingDtoShape | null> {
  if (doc.status !== 'en_route' && doc.status !== 'arrived') return null;

  const destination =
    doc.destinationLat != null && doc.destinationLng != null
      ? { lat: doc.destinationLat, lng: doc.destinationLng }
      : null;

  const doctor =
    doc.doctorLat != null && doc.doctorLng != null && doc.doctorLocationAt
      ? {
          lat: doc.doctorLat,
          lng: doc.doctorLng,
          updatedAt: doc.doctorLocationAt.toISOString(),
        }
      : null;

  let etaMinutes: number | null = null;
  let distanceMeters: number | null = null;
  let routePolyline: string | null = doc.routePolyline;

  if (doc.status === 'arrived') {
    etaMinutes = 0;
    distanceMeters = 0;
  } else if (doc.status === 'en_route' && destination && doctor) {
    const route = await maps.drivingRoute(
      { lat: doctor.lat, lng: doctor.lng },
      destination,
    );
    if (route) {
      routePolyline = route.polyline;
      etaMinutes = Math.max(1, Math.ceil(route.durationSeconds / 60));
      distanceMeters = route.distanceMeters;
    } else {
      etaMinutes = HOME_VISIT_ESTIMATED_TRIP_MINUTES;
    }
  }

  return {
    mode: 'live_gps',
    destination,
    doctor,
    routePolyline,
    etaMinutes,
    distanceMeters,
    mapsConfigured: true,
    disclaimer:
      'Live GPS from your doctor’s phone. Route and ETA from OpenStreetMap / OSRM.',
  };
}
