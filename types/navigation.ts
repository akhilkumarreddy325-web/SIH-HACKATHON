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

export type RoutePlanResult = {
  startLocation: ResolvedLocation;
  destinationLocation: ResolvedLocation;
  approxGeographicDistanceKm: number;
  approxGeographicDistanceMeters: number;
  nearbyRiskZones: Array<{
    zone: import('./risk-zone').RiskZone;
    distanceMeters: number;
    isInsideZone: boolean;
  }>;
  highestNearbyRisk: import('./risk-zone').RiskLevel;
  cautionNotice: string;
};
