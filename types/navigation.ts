import type { RiskLevel, RiskZone } from './risk-zone';

export type ResolvedLocation = {
  id: string;
  name: string;
  displayName: string;
  latitude: number;
  longitude: number;
  state?: string;
  country?: string;
  isCurrentLocation?: boolean;
};

export type RouteStep = {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  maneuverType: string;
  maneuverModifier?: string;
  roadName?: string;
  coordinates: [number, number]; // [latitude, longitude]
};

export type DrivingRoute = {
  coordinates: Array<[number, number]>; // Array of [latitude, longitude] following real roads
  distanceMeters: number;
  distanceKm: number;
  durationSeconds: number;
  durationMinutes: number;
  steps: RouteStep[];
  startLocation: ResolvedLocation;
  destinationLocation: ResolvedLocation;
  summary: string;
};

export type AlertState = 'unseen' | 'approaching' | 'warned' | 'passed';

export type ActiveSafetyAlert = {
  id: string;
  title: string;
  subtitle: string;
  hazardType: string;
  riskLevel: RiskLevel;
  distanceMeters: number;
  alertState: AlertState;
  coordinates: [number, number];
  isHazardReport?: boolean;
  timestamp: number;
};

export type RoutePlanResult = {
  startLocation: ResolvedLocation;
  destinationLocation: ResolvedLocation;
  approxGeographicDistanceKm: number;
  approxGeographicDistanceMeters: number;
  drivingDistanceKm?: number;
  drivingDurationMinutes?: number;
  drivingRoute?: DrivingRoute | null;
  routeStatus: 'found' | 'calculating' | 'failed';
  errorMessage?: string;
  nearbyRiskZones: Array<{
    zone: RiskZone;
    distanceMeters: number;
    isInsideZone: boolean;
  }>;
  highestNearbyRisk: RiskLevel;
  cautionNotice: string;
};