import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Polyline,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { RiskZoneService } from '@/services/risk-zone-service';
import { DrivingRoute, ResolvedLocation } from '@/types/navigation';
import { RiskLevel, RiskZone } from '@/types/risk-zone';
import type { HazardReport } from '@/types/safepath';

export interface SafetyMapViewProps {
  zones?: RiskZone[];
  hazardReports?: HazardReport[];
  userCoords?: { latitude: number; longitude: number } | null;
  startLocation?: ResolvedLocation | null;
  destinationLocation?: ResolvedLocation | null;
  drivingRoute?: DrivingRoute | null;
  routeStatus?: 'found' | 'calculating' | 'failed';
  onSelectZone?: (zone: RiskZone) => void;
  onSelectReport?: (report: HazardReport) => void;
  height?: number;
}

const MAP_WIDTH = 350;

export function SafetyMapView({
  zones: propZones,
  hazardReports: propReports,
  userCoords,
  startLocation,
  destinationLocation,
  drivingRoute,
  onSelectZone,
  onSelectReport,
  height = 340,
}: SafetyMapViewProps) {
  const [internalZones, setInternalZones] = useState<RiskZone[]>(propZones || []);
  const [internalReports, setInternalReports] = useState<HazardReport[]>(propReports || []);

  useEffect(() => {
    if (propZones) setInternalZones(propZones);
  }, [propZones]);

  useEffect(() => {
    if (propReports) setInternalReports(propReports);
  }, [propReports]);

  useEffect(() => {
    let active = true;
    async function loadFallbackZones() {
      if (!propZones || propZones.length === 0) {
        try {
          const z = await RiskZoneService.getZones();
          if (active) setInternalZones(z);
        } catch (err) {
          console.warn('SafetyMapView native zones err:', err);
        }
      }
    }
    loadFallbackZones();
    return () => {
      active = false;
    };
  }, [propZones]);

  useEffect(() => {
    let active = true;
    async function loadFallbackReports() {
      if (!propReports || propReports.length === 0) {
        try {
          const { data, error } = await supabase
            .from('hazard_reports')
            .select('id,hazard_type,severity,description,status,latitude,longitude,zone_type,created_at,trip_id,audio_path')
            .not('latitude', 'is', null)
            .not('longitude', 'is', null)
            .order('created_at', { ascending: false })
            .limit(20);
          if (active && data && !error) {
            setInternalReports(data as unknown as HazardReport[]);
          }
        } catch (err) {
          console.warn('SafetyMapView native reports err:', err);
        }
      }
    }
    loadFallbackReports();
    return () => {
      active = false;
    };
  }, [propReports]);

  const bounds = useMemo(() => {
    let minLat = 17.36;
    let maxLat = 17.68;
    let minLon = 78.26;
    let maxLon = 78.58;

    const allPts: Array<{ latitude: number; longitude: number }> = [];
    internalZones.forEach((z) => allPts.push({ latitude: z.latitude, longitude: z.longitude }));
    internalReports.forEach((h) => {
      if (typeof h.latitude === 'number' && typeof h.longitude === 'number') {
        allPts.push({ latitude: h.latitude, longitude: h.longitude });
      }
    });
    if (userCoords) allPts.push(userCoords);
    if (startLocation) allPts.push(startLocation);
    if (destinationLocation) allPts.push(destinationLocation);
    if (drivingRoute?.coordinates) {
      drivingRoute.coordinates.forEach(([lat, lon]) => allPts.push({ latitude: lat, longitude: lon }));
    }

    for (const pt of allPts) {
      if (pt.latitude < minLat) minLat = pt.latitude - 0.03;
      if (pt.latitude > maxLat) maxLat = pt.latitude + 0.03;
      if (pt.longitude < minLon) minLon = pt.longitude - 0.03;
      if (pt.longitude > maxLon) maxLon = pt.longitude + 0.03;
    }

    return { minLat, maxLat, minLon, maxLon };
  }, [internalZones, internalReports, userCoords, startLocation, destinationLocation, drivingRoute]);

  const projectCoords = (lat: number, lon: number): { x: number; y: number } => {
    const x = ((lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * MAP_WIDTH;
    const y = ((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat)) * height;
    return {
      x: Math.max(16, Math.min(MAP_WIDTH - 16, Math.round(x))),
      y: Math.max(16, Math.min(height - 16, Math.round(y))),
    };
  };

  const projectRadius = (meters: number): number => {
    const degSpan = bounds.maxLat - bounds.minLat;
    const totalMeters = degSpan * 110600;
    const pixelsPerMeter = height / (totalMeters || 1);
    return Math.max(16, Math.min(52, Math.round(meters * pixelsPerMeter)));
  };

  const getRiskColor = (level: RiskLevel): string => {
    switch (level) {
      case 'CRITICAL':
        return '#991B1B';
      case 'HIGH':
        return colors.red;
      case 'MODERATE':
        return colors.yellow;
      case 'LOW':
      default:
        return colors.green;
    }
  };

  // SVG Polyline points string
  const svgRoutePoints = useMemo(() => {
    if (!drivingRoute?.coordinates || drivingRoute.coordinates.length < 2) return '';
    return drivingRoute.coordinates
      .map(([lat, lon]) => {
        const pt = projectCoords(lat, lon);
        return `${pt.x},${pt.y}`;
      })
      .join(' ');
  }, [drivingRoute, bounds, height]);

  return (
    <View style={styles.container}>
      <Svg width={MAP_WIDTH} height={height}>
        <Defs>
          <LinearGradient id="nativeMapGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#0B1A16" />
            <Stop offset="100%" stopColor="#142823" />
          </LinearGradient>
        </Defs>

        <Rect width={MAP_WIDTH} height={height} fill="url(#nativeMapGrad)" rx={14} />

        {[0.25, 0.5, 0.75].map((ratio, i) => (
          <G key={`grid-${i}`}>
            <Line
              x1={MAP_WIDTH * ratio}
              y1={0}
              x2={MAP_WIDTH * ratio}
              y2={height}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={1}
            />
            <Line
              x1={0}
              y1={height * ratio}
              x2={MAP_WIDTH}
              y2={height * ratio}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={1}
            />
          </G>
        ))}

        {/* Real Road Route Polyline if present */}
        {svgRoutePoints ? (
          <Polyline
            points={svgRoutePoints}
            fill="none"
            stroke="#0284C7"
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {internalZones.map((zone) => {
          const pt = projectCoords(zone.latitude, zone.longitude);
          const r = projectRadius(zone.radius_meters);
          const color = getRiskColor(zone.risk_level);
          const isCritical = zone.risk_level === 'CRITICAL';

          return (
            <G key={`zone-${zone.id}`} onPress={() => onSelectZone && onSelectZone(zone)}>
              <Circle
                cx={pt.x}
                cy={pt.y}
                r={r}
                fill={color}
                fillOpacity={isCritical ? 0.32 : 0.2}
                stroke={color}
                strokeWidth={isCritical ? 2.5 : 1.5}
                strokeDasharray={isCritical ? 'none' : '4 3'}
              />
              <Circle cx={pt.x} cy={pt.y} r={7} fill="#FFFFFF" />
              <Circle cx={pt.x} cy={pt.y} r={4.5} fill={color} />
              <SvgText
                x={pt.x}
                y={pt.y - r - 4}
                fontSize={10}
                fontWeight="bold"
                fill="#FFFFFF"
                textAnchor="middle"
              >
                {zone.name}
              </SvgText>
            </G>
          );
        })}

        {internalReports.map((report) => {
          if (typeof report.latitude !== 'number' || typeof report.longitude !== 'number') {
            return null;
          }
          const pt = projectCoords(report.latitude, report.longitude);
          const color =
            report.severity === 'critical'
              ? '#991B1B'
              : report.severity === 'high'
              ? colors.red
              : colors.yellow;

          return (
            <G key={`hazard-pin-${report.id}`} onPress={() => onSelectReport && onSelectReport(report)}>
              <Circle cx={pt.x} cy={pt.y} r={6} fill={color} stroke="#FFFFFF" strokeWidth={1.5} />
              <Circle cx={pt.x} cy={pt.y} r={2} fill="#FFFFFF" />
            </G>
          );
        })}

        {userCoords && (
          <G>
            <Circle
              cx={projectCoords(userCoords.latitude, userCoords.longitude).x}
              cy={projectCoords(userCoords.latitude, userCoords.longitude).y}
              r={12}
              fill="rgba(30, 119, 112, 0.25)"
            />
            <Circle
              cx={projectCoords(userCoords.latitude, userCoords.longitude).x}
              cy={projectCoords(userCoords.latitude, userCoords.longitude).y}
              r={6}
              fill="#00F5D4"
              stroke="#FFFFFF"
              strokeWidth={2}
            />
          </G>
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    overflow: 'hidden',
  },
});
