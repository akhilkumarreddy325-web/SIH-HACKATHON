import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  LocateFixed,
  MapPin,
  Navigation,
  Shield,
  ShieldAlert,
} from 'lucide-react-native';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Line,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { RiskZoneDetailModal } from '@/components/RiskZoneDetailModal';
import { colors, shadow } from '@/lib/theme';
import {
  calculateHaversineDistance,
  RiskZoneService,
} from '@/services/risk-zone-service';
import { ResolvedLocation } from '@/types/navigation';
import { RiskZone } from '@/types/risk-zone';

const MAP_WIDTH = 360;
const MAP_HEIGHT = 290;

interface RiskMapProps {
  startLocation?: ResolvedLocation | null;
  destinationLocation?: ResolvedLocation | null;
  destination?: string; // Legacy fallback
  onZoneSelected?: (zone: RiskZone) => void;
}

export function RiskMap({
  startLocation,
  destinationLocation,
  destination,
  onZoneSelected,
}: RiskMapProps) {
  const [zones, setZones] = useState<RiskZone[]>([]);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [selectedZone, setSelectedZone] = useState<RiskZone | null>(null);

  // 1. Fetch risk zones from Supabase (single source of truth with demo fallback)
  useEffect(() => {
    let active = true;

    async function loadZones() {
      try {
        const loaded = await RiskZoneService.getZones();
        if (active) setZones(loaded);
      } catch (err) {
        console.warn('Error fetching risk zones:', err);
      }
    }

    loadZones();
    return () => {
      active = false;
    };
  }, []);

  // 2. Request user GPS coordinates
  useEffect(() => {
    if (
      Platform.OS === 'web' &&
      typeof navigator !== 'undefined' &&
      navigator.geolocation
    ) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        },
        () => {},
        { enableHighAccuracy: false, timeout: 8000 }
      );
    }
  }, []);

  // 3. Dynamic Bounding Box: Base Hyderabad, expanded if start or destination are further away
  const bounds = React.useMemo(() => {
    let minLat = 17.3600;
    let maxLat = 17.6800;
    let minLon = 78.2600;
    let maxLon = 78.5800;

    const points: Array<{ latitude: number; longitude: number }> = [];
    if (startLocation) points.push(startLocation);
    if (destinationLocation) points.push(destinationLocation);

    for (const pt of points) {
      if (pt.latitude < minLat) minLat = pt.latitude - 0.04;
      if (pt.latitude > maxLat) maxLat = pt.latitude + 0.04;
      if (pt.longitude < minLon) minLon = pt.longitude - 0.04;
      if (pt.longitude > maxLon) maxLon = pt.longitude + 0.04;
    }

    return { minLat, maxLat, minLon, maxLon };
  }, [startLocation, destinationLocation]);

  const projectCoords = (lat: number, lon: number): { x: number; y: number } => {
    const x =
      ((lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * MAP_WIDTH;
    const y =
      ((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat)) * MAP_HEIGHT;
    return { x: Math.round(x), y: Math.round(y) };
  };

  const projectRadius = (meters: number): number => {
    const degSpan = bounds.maxLat - bounds.minLat;
    const totalMeters = degSpan * 110600;
    const pixelsPerMeter = MAP_HEIGHT / (totalMeters || 1);
    return Math.max(14, Math.min(50, Math.round(meters * pixelsPerMeter)));
  };

  const getZoneDistance = (zone: RiskZone): number | null => {
    const refLat = startLocation?.latitude ?? userLocation?.latitude;
    const refLon = startLocation?.longitude ?? userLocation?.longitude;
    if (!refLat || !refLon) return null;

    return calculateHaversineDistance(refLat, refLon, zone.latitude, zone.longitude);
  };

  const handleSelectZone = (zone: RiskZone) => {
    setSelectedZone(zone);
    if (onZoneSelected) onZoneSelected(zone);
  };

  const startPt = startLocation
    ? projectCoords(startLocation.latitude, startLocation.longitude)
    : null;

  const destPt = destinationLocation
    ? projectCoords(destinationLocation.latitude, destinationLocation.longitude)
    : null;

  const userPoint = userLocation
    ? projectCoords(userLocation.latitude, userLocation.longitude)
    : null;

  // Approximate straight-line geographic distance between start and destination
  const straightLineDistanceKm =
    startLocation && destinationLocation
      ? (
          calculateHaversineDistance(
            startLocation.latitude,
            startLocation.longitude,
            destinationLocation.latitude,
            destinationLocation.longitude
          ) / 1000
        ).toFixed(1)
      : null;

  return (
    <View style={styles.wrap}>
      {/* Map Surface */}
      <View style={styles.map}>
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          style={StyleSheet.absoluteFill}
        >
          <Defs>
            <LinearGradient id="mapBg" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#E5ECE7" />
              <Stop offset="100%" stopColor="#DAE6E0" />
            </LinearGradient>
          </Defs>

          {/* Topographic Surface */}
          <Rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#mapBg)" />

          {/* Hyderabad Arterial Geographic Connectors */}
          <G stroke="#BFD6CC" strokeWidth="2.5" fill="none" opacity="0.8">
            {/* NH-44 North corridor toward Medchal */}
            <Path d="M220 280 L225 180 L238 90 L242 30" />
            {/* NH-65 NW corridor toward Kukatpally & Miyapur */}
            <Path d="M190 220 L155 195 L130 180 L90 140" />
            {/* Outer Ring Road & IT Corridor loop toward Gachibowli */}
            <Path d="M50 280 C65 240, 75 220, 110 210 S155 220, 190 220" />
            <Path d="M90 250 L145 200 L238 90" strokeDasharray="3,3" strokeWidth="1.5" />
          </G>

          {/* Risk Zone Heat Circles */}
          {zones.map((zone) => {
            const pt = projectCoords(zone.latitude, zone.longitude);
            const r = projectRadius(zone.radius_meters);
            const isCritical = zone.risk_level === 'CRITICAL';
            const isHigh = zone.risk_level === 'HIGH';
            const strokeColor = isCritical
              ? colors.red
              : isHigh
              ? '#E65100'
              : colors.yellow;
            const fillColor = isCritical
              ? colors.redSoft
              : isHigh
              ? '#FFF3E0'
              : colors.yellowSoft;

            return (
              <G key={zone.id}>
                <Circle
                  cx={pt.x}
                  cy={pt.y}
                  r={r}
                  fill={fillColor}
                  fillOpacity="0.45"
                  stroke={strokeColor}
                  strokeWidth="2"
                  strokeDasharray="4,3"
                />
                <Circle
                  cx={pt.x}
                  cy={pt.y}
                  r={7}
                  fill={strokeColor}
                  stroke="#fff"
                  strokeWidth="2"
                />
              </G>
            );
          })}

          {/* Straight-line Trajectory between Start and Destination */}
          {startPt && destPt && (
            <G>
              <Line
                x1={startPt.x}
                y1={startPt.y}
                x2={destPt.x}
                y2={destPt.y}
                stroke={colors.teal}
                strokeWidth="3"
                strokeDasharray="6,4"
              />
            </G>
          )}

          {/* Start Point Marker */}
          {startPt && (
            <G>
              <Circle
                cx={startPt.x}
                cy={startPt.y}
                r="16"
                fill={colors.teal}
                fillOpacity="0.22"
              />
              <Circle
                cx={startPt.x}
                cy={startPt.y}
                r="8"
                fill={colors.teal}
                stroke="#fff"
                strokeWidth="2"
              />
            </G>
          )}

          {/* Destination Point Marker */}
          {destPt && (
            <G>
              <Circle
                cx={destPt.x}
                cy={destPt.y}
                r="18"
                fill={colors.red}
                fillOpacity="0.22"
              />
              <Circle
                cx={destPt.x}
                cy={destPt.y}
                r="9"
                fill={colors.red}
                stroke="#fff"
                strokeWidth="2.5"
              />
            </G>
          )}

          {/* User Location Pulse (when not overriding start) */}
          {!startLocation && userPoint && (
            <G>
              <Circle
                cx={userPoint.x}
                cy={userPoint.y}
                r="14"
                fill={colors.teal}
                fillOpacity="0.25"
              />
              <Circle
                cx={userPoint.x}
                cy={userPoint.y}
                r="5"
                fill={colors.teal}
                stroke="#fff"
                strokeWidth="2"
              />
            </G>
          )}
        </Svg>

        {/* Start Label Badge */}
        {startLocation && startPt && (
          <View
            style={[
              styles.locationBadge,
              styles.startBadge,
              { left: Math.max(8, startPt.x - 30), top: Math.max(8, startPt.y - 32) },
            ]}
          >
            <MapPin size={11} color="#fff" strokeWidth={3} />
            <Text style={styles.startBadgeText}>{startLocation.name}</Text>
          </View>
        )}

        {/* Destination Label Badge */}
        {destinationLocation && destPt && (
          <View
            style={[
              styles.locationBadge,
              styles.destBadge,
              { left: Math.max(8, destPt.x - 35), top: Math.max(8, destPt.y - 34) },
            ]}
          >
            <Navigation size={11} color="#fff" strokeWidth={3} />
            <Text style={styles.destBadgeText}>{destinationLocation.name}</Text>
          </View>
        )}

        {/* Floating Tappable Risk Zone Marker Pins */}
        {zones.map((zone) => {
          const pt = projectCoords(zone.latitude, zone.longitude);
          const isCritical = zone.risk_level === 'CRITICAL';
          const isHigh = zone.risk_level === 'HIGH';
          const badgeColor = isCritical
            ? colors.red
            : isHigh
            ? '#E65100'
            : colors.yellow;

          const shortName = zone.name.split(' ')[0];

          return (
            <Pressable
              key={`pin-${zone.id}`}
              onPress={() => handleSelectZone(zone)}
              style={[
                styles.zonePin,
                {
                  left: Math.max(8, Math.min(MAP_WIDTH - 115, pt.x - 50)),
                  top: Math.max(8, Math.min(MAP_HEIGHT - 45, pt.y - 38)),
                },
              ]}
              hitSlop={8}
            >
              <View style={[styles.zoneDot, { backgroundColor: badgeColor }]} />
              <Text style={styles.zonePinName}>{shortName}</Text>
              <View style={[styles.zoneScorePill, { backgroundColor: badgeColor }]}>
                <Text style={styles.zoneScoreText}>{zone.numeric_score}</Text>
              </View>
            </Pressable>
          );
        })}

        {/* Straight-line Distance Pill */}
        {straightLineDistanceKm && (
          <View style={styles.distanceBadge}>
            <Text style={styles.distanceBadgeLabel}>Approx. geographic distance:</Text>
            <Text style={styles.distanceBadgeValue}>{straightLineDistanceKm} km</Text>
          </View>
        )}

        {/* Header Region Tag */}
        <View style={styles.regionTag}>
          <Text style={styles.regionTagText}>HYDERABAD RISK MAP</Text>
        </View>
      </View>

      {/* Explorer Strip Header */}
      <View style={styles.zoneStripHeader}>
        <Text style={styles.stripTitle}>EXPLORE RISK ZONES</Text>
        <Text style={styles.stripSubtitle}>Tap any zone for intelligence & contributing factors</Text>
      </View>

      {/* Zone Cards Carousel */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cardsScroll}
      >
        {zones.map((zone) => {
          const dist = getZoneDistance(zone);
          const isCritical = zone.risk_level === 'CRITICAL';
          const isHigh = zone.risk_level === 'HIGH';
          const badgeColor = isCritical
            ? colors.red
            : isHigh
            ? '#E65100'
            : colors.yellow;
          const bgSoft = isCritical
            ? colors.redSoft
            : isHigh
            ? '#FFF3E0'
            : colors.yellowSoft;

          return (
            <Pressable
              key={`card-${zone.id}`}
              onPress={() => handleSelectZone(zone)}
              style={({ pressed }) => [
                styles.miniCard,
                shadow,
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
            >
              <View style={styles.miniCardTop}>
                <View style={[styles.miniBadge, { backgroundColor: bgSoft }]}>
                  <View style={[styles.zoneDot, { backgroundColor: badgeColor }]} />
                  <Text style={[styles.miniBadgeText, { color: badgeColor }]}>
                    {zone.risk_level} · {zone.numeric_score}
                  </Text>
                </View>
                {dist !== null && (
                  <Text style={styles.distText}>
                    {dist < 1000 ? `${dist}m` : `${(dist / 1000).toFixed(1)}km`}
                  </Text>
                )}
              </View>

              <Text style={styles.miniCardTitle} numberOfLines={1}>
                {zone.name}
              </Text>
              <Text style={styles.miniCardHazard} numberOfLines={1}>
                {zone.common_hazard}
              </Text>

              <View style={styles.miniCardFooter}>
                <Text style={styles.tapToInspect}>Tap for intelligence →</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Detail Modal */}
      <RiskZoneDetailModal
        zone={selectedZone}
        visible={!!selectedZone}
        onClose={() => setSelectedZone(null)}
        userDistanceMeters={selectedZone ? getZoneDistance(selectedZone) : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 18,
  },
  map: {
    height: MAP_HEIGHT,
    backgroundColor: '#E5ECE7',
    overflow: 'hidden',
    position: 'relative',
  },
  locationBadge: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    elevation: 4,
  },
  startBadge: {
    backgroundColor: colors.teal,
  },
  startBadgeText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 10,
  },
  destBadge: {
    backgroundColor: colors.red,
  },
  destBadgeText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 10,
  },
  distanceBadge: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    backgroundColor: 'rgba(16,32,28,0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  distanceBadgeLabel: {
    color: '#B7C9C4',
    fontSize: 9,
    fontWeight: '700',
  },
  distanceBadgeValue: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  zonePin: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  zoneDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  zonePinName: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.ink,
  },
  zoneScorePill: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  zoneScoreText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
  },
  regionTag: {
    position: 'absolute',
    right: 12,
    top: 12,
    backgroundColor: 'rgba(16,32,28,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
  },
  regionTagText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  zoneStripHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  stripTitle: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  stripSubtitle: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  cardsScroll: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  miniCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    width: 190,
    borderWidth: 1,
    borderColor: colors.line,
  },
  miniCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  miniBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  miniBadgeText: {
    fontSize: 9,
    fontWeight: '900',
  },
  distText: {
    color: colors.teal,
    fontWeight: '800',
    fontSize: 11,
  },
  miniCardTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  miniCardHazard: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  miniCardFooter: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  tapToInspect: {
    color: colors.teal,
    fontSize: 10,
    fontWeight: '800',
  },
});
