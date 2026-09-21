/**
 * NearMiss / SafePath AI: Real Road Routing Service
 * Fetches actual turn-by-turn driving routes and road geometry using the OpenStreetMap OSRM routing engine.
 * Computes road-accurate distance, driving duration, and route-corridor risk zone proximity.
 */

import { calculateHaversineDistance } from '@/services/risk-zone-service';
import {
  DrivingRoute,
  ResolvedLocation,
  RouteStep,
} from '@/types/navigation';
import { RiskZone } from '@/types/risk-zone';

export interface RoutingResult {
  success: boolean;
  route?: DrivingRoute;
  error?: string;
}

export class RoutingService {
  /**
   * Fetches real road driving directions between start and destination using OSRM.
   * Coordinate order for OSRM API is {longitude},{latitude}.
   */
  public static async getDrivingRoute(
    start: ResolvedLocation,
    destination: ResolvedLocation
  ): Promise<RoutingResult> {
    const startLon = start.longitude;
    const startLat = start.latitude;
    const destLon = destination.longitude;
    const destLat = destination.latitude;

    const endpoint = `https://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${destLon},${destLat}?overview=full&geometries=geojson&steps=true`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 9000);

      const res = await fetch(endpoint, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        return {
          success: false,
          error: `Routing service responded with HTTP ${res.status}`,
        };
      }

      const data = await res.json();

      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        return {
          success: false,
          error: data.message || 'Unable to calculate road route between selected locations.',
        };
      }

      const primaryRoute = data.routes[0];

      // Convert GeoJSON [longitude, latitude] coordinates to Leaflet/Map [latitude, longitude]
      const rawGeoJsonCoords: [number, number][] = primaryRoute.geometry?.coordinates || [];
      if (rawGeoJsonCoords.length === 0) {
        return {
          success: false,
          error: 'No road geometry returned for this corridor.',
        };
      }

      const coordinates: Array<[number, number]> = rawGeoJsonCoords.map(
        ([lon, lat]) => [lat, lon]
      );

      // Extract Turn-by-Turn Navigation Steps
      const steps: RouteStep[] = [];
      const primaryLeg = primaryRoute.legs?.[0];

      if (primaryLeg?.steps && Array.isArray(primaryLeg.steps)) {
        for (const s of primaryLeg.steps) {
          const maneuverType = s.maneuver?.type || 'turn';
          const modifier = s.maneuver?.modifier || '';
          const roadName = s.name || '';
          const loc = s.maneuver?.location;
          const stepCoords: [number, number] = loc ? [loc[1], loc[0]] : [0, 0];

          let instruction = '';
          if (maneuverType === 'depart') {
            instruction = roadName ? `Head out on ${roadName}` : 'Head towards destination';
          } else if (maneuverType === 'arrive') {
            instruction = 'Arrive at destination';
          } else {
            const direction = modifier ? ` ${modifier}` : '';
            instruction = roadName
              ? `${maneuverType.toUpperCase()}${direction.toUpperCase()} onto ${roadName}`
              : `${maneuverType.toUpperCase()}${direction.toUpperCase()}`;
          }

          steps.push({
            instruction,
            distanceMeters: Math.round(s.distance || 0),
            durationSeconds: Math.round(s.duration || 0),
            maneuverType,
            maneuverModifier: modifier,
            roadName,
            coordinates: stepCoords,
          });
        }
      }

      const distanceMeters = Math.round(primaryRoute.distance || 0);
      const durationSeconds = Math.round(primaryRoute.duration || 0);

      return {
        success: true,
        route: {
          coordinates,
          distanceMeters,
          distanceKm: Number((distanceMeters / 1000).toFixed(1)),
          durationSeconds,
          durationMinutes: Math.max(1, Math.round(durationSeconds / 60)),
          steps,
          startLocation: start,
          destinationLocation: destination,
          summary: primaryLeg?.summary || '',
        },
      };
    } catch (err: any) {
      console.warn('RoutingService error:', err?.message || err);
      return {
        success: false,
        error: 'Unable to calculate road route. Please try again.',
      };
    }
  }

  /**
   * ROUTE-CORRIDOR RISK ZONE DETECTION
   * Computes the minimum distance from any point along the actual road route geometry
   * to each risk zone center.
   *
   * If the shortest distance to a zone is within `zone.radius_meters + bufferMeters`,
   * that zone is identified as directly impacting the corridor.
   */
  public static findRiskZonesAlongRoute(
    routeCoordinates: Array<[number, number]>,
    zones: RiskZone[],
    bufferMeters: number = 1500
  ): Array<{ zone: RiskZone; distanceMeters: number; isInsideZone: boolean }> {
    if (!routeCoordinates || routeCoordinates.length === 0 || !zones || zones.length === 0) {
      return [];
    }

    const detected: Array<{ zone: RiskZone; distanceMeters: number; isInsideZone: boolean }> = [];

    for (const zone of zones) {
      let minDistanceMeters = Infinity;

      // Check distance from road route vertices to zone center
      // Step increment ensures fast computation even on routes with 1000+ points
      const step = routeCoordinates.length > 400 ? 2 : 1;
      for (let i = 0; i < routeCoordinates.length; i += step) {
        const [lat, lon] = routeCoordinates[i];
        const d = calculateHaversineDistance(lat, lon, zone.latitude, zone.longitude);
        if (d < minDistanceMeters) {
          minDistanceMeters = d;
        }
        if (minDistanceMeters <= zone.radius_meters) {
          break; // Already inside the zone radius
        }
      }

      // Check final coordinate if stepped
      if (step > 1) {
        const last = routeCoordinates[routeCoordinates.length - 1];
        const dLast = calculateHaversineDistance(last[0], last[1], zone.latitude, zone.longitude);
        if (dLast < minDistanceMeters) minDistanceMeters = dLast;
      }

      const threshold = zone.radius_meters + bufferMeters;
      if (minDistanceMeters <= threshold) {
        detected.push({
          zone,
          distanceMeters: minDistanceMeters,
          isInsideZone: minDistanceMeters <= zone.radius_meters,
        });
      }
    }

    return detected.sort((a, b) => a.distanceMeters - b.distanceMeters);
  }
}
