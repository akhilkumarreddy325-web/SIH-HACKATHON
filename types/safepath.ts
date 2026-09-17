export type ZoneType = 'green' | 'yellow' | 'red';

export type HazardReport = {
  id: string;
  hazard_type: string;
  severity: ZoneType | string;
  description: string | null;
  status: string;
  created_at: string;
  latitude?: number | null;
  longitude?: number | null;
  zone_type?: string | null;
  trip_id?: string | null;
  audio_path?: string | null;
  trips?: {
    destination: string;
    start_point: string;
  } | null;
};

export type Trip = {
  id: string;
  start_point: string;
  destination: string;
  distance_km: number;
  duration_min: number;
  risk_score: ZoneType;
  green_pct: number;
  yellow_pct: number;
  red_pct: number;
  status: string;
  created_at: string;
};

export * from './risk-zone';
