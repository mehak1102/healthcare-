import { Injectable, Logger } from '@nestjs/common';
import { InjectConfig } from '../../config/app-config.module';
import type { Env } from '../../config/env.schema';

export type LatLng = { lat: number; lng: number };

export type DrivingRoute = {
  polyline: string;
  durationSeconds: number;
  distanceMeters: number;
};

/** Geocoding + driving routes via OpenStreetMap ecosystem (no Google API key). */
@Injectable()
export class OsmMapService {
  private readonly logger = new Logger(OsmMapService.name);

  constructor(@InjectConfig() private readonly env: Env) {}

  /** Always available — uses public OSRM/Nominatim (respect rate limits in production). */
  get enabled(): boolean {
    return true;
  }

  private userAgent(): string {
    const base = this.env.APP_BASE_URL.replace(/^https?:\/\//, '');
    return `SukoonHealthHomeVisits/1.0 (${base})`;
  }

  private cityForPin(pin: string): string {
    if (pin.startsWith('122')) return 'Gurugram';
    if (pin.startsWith('110')) return 'Delhi';
    return 'India';
  }

  async geocodeHomeVisitAddress(input: {
    pinCode: string;
    addressLine1: string;
    locality: string | null;
  }): Promise<LatLng | null> {
    const pin = input.pinCode.replace(/\s/g, '');
    const locality = input.locality?.trim() || null;
    const line = input.addressLine1.trim();
    const city = this.cityForPin(pin);

    const attempts: Record<string, string>[] = [
      {
        q: [line, locality, pin, city, 'India'].filter(Boolean).join(', '),
        countrycodes: 'in',
      },
      {
        street: line,
        ...(locality ? { city: locality } : {}),
        postalcode: pin,
        country: 'India',
      },
      {
        q: [locality, pin, city, 'India'].filter(Boolean).join(', '),
        countrycodes: 'in',
      },
      { postalcode: pin, country: 'India', countrycodes: 'in' },
    ];

    for (const params of attempts) {
      const hit = await this.nominatimSearch(params);
      if (hit) return hit;
    }

    this.logger.warn(`Nominatim geocode returned no results for PIN ${pin}`);
    return null;
  }

  private async nominatimSearch(
    params: Record<string, string>,
  ): Promise<LatLng | null> {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '1');
    for (const [key, value] of Object.entries(params)) {
      if (value) url.searchParams.set(key, value);
    }
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': this.userAgent(), Accept: 'application/json' },
      });
      if (!res.ok) {
        this.logger.warn(`Nominatim geocode HTTP ${res.status}`);
        return null;
      }
      const rows = (await res.json()) as { lat: string; lon: string }[];
      const hit = rows[0];
      if (!hit) return null;
      const lat = Number(hit.lat);
      const lng = Number(hit.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { lat, lng };
    } catch (error) {
      this.logger.warn(
        `Geocode request failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      return null;
    }
  }

  async drivingRoute(origin: LatLng, destination: LatLng): Promise<DrivingRoute | null> {
    const path = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
    const url = `https://router.project-osrm.org/route/v1/driving/${path}?overview=full&geometries=polyline`;
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) {
        this.logger.warn(`OSRM route HTTP ${res.status}`);
        return null;
      }
      const body = (await res.json()) as {
        code: string;
        routes?: { geometry: string; duration: number; distance: number }[];
      };
      const route = body.routes?.[0];
      if (body.code !== 'Ok' || !route) {
        this.logger.warn(`OSRM route failed (${body.code})`);
        return null;
      }
      return {
        polyline: route.geometry,
        durationSeconds: route.duration,
        distanceMeters: route.distance,
      };
    } catch (error) {
      this.logger.warn(
        `OSRM route request failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      return null;
    }
  }

  async drivingEta(
    origin: LatLng,
    destination: LatLng,
  ): Promise<{ durationSeconds: number; distanceMeters: number } | null> {
    const route = await this.drivingRoute(origin, destination);
    if (!route) return null;
    return {
      durationSeconds: route.durationSeconds,
      distanceMeters: route.distanceMeters,
    };
  }
}
