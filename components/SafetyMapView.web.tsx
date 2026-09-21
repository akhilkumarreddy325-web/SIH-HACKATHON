import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import L from 'leaflet';
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

const LEAFLET_CSS_ID = 'leaflet-core-styles-v3';

function injectLeafletStyles() {
  if (typeof document === 'undefined') return;
  if (!document.getElementById(LEAFLET_CSS_ID)) {
    const link = document.createElement('link');
    link.id = LEAFLET_CSS_ID;
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const style = document.createElement('style');
    style.innerHTML = `
      .leaflet-container {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background: #0B1A16;
      }
      .zone-tooltip-badge {
        background: rgba(16, 32, 28, 0.92) !important;
        color: #ffffff !important;
        border: 1px solid rgba(255, 255, 255, 0.25) !important;
        border-radius: 6px !important;
        font-size: 11px !important;
        font-weight: 800 !important;
        padding: 4px 8px !important;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4) !important;
      }
      .zone-tooltip-badge::before {
        border-top-color: rgba(16, 32, 28, 0.92) !important;
      }
      .custom-hazard-pin {
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        border: 2px solid #ffffff;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        cursor: pointer;
        transition: transform 0.15s ease;
      }
      .custom-hazard-pin:hover {
        transform: scale(1.2);
      }
      .custom-dest-pin {
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background-color: #D84949;
        border: 3px solid #ffffff;
        box-shadow: 0 3px 10px rgba(216, 73, 73, 0.6);
        cursor: pointer;
      }
      .custom-start-pin {
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background-color: #0D9488;
        border: 3px solid #ffffff;
        box-shadow: 0 3px 10px rgba(13, 148, 136, 0.6);
        cursor: pointer;
      }
      .user-gps-pulse {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background-color: #00F5D4;
        border: 3px solid #10201C;
        box-shadow: 0 0 14px #00F5D4;
      }
    `;
    document.head.appendChild(style);
  }
}

export function SafetyMapView({
  zones: propZones,
  hazardReports: propReports,
  userCoords,
  startLocation,
  destinationLocation,
  drivingRoute,
  routeStatus,
  onSelectZone,
  onSelectReport,
  height = 340,
}: SafetyMapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const overlayGroupRef = useRef<L.LayerGroup | null>(null);
  const [internalZones, setInternalZones] = useState<RiskZone[]>(propZones || []);
  const [internalReports, setInternalReports] = useState<HazardReport[]>(propReports || []);
  const [mapError, setMapError] = useState<string | null>(null);
  const hasFittedInitialBounds = useRef(false);

  // Sync prop updates
  useEffect(() => {
    if (propZones) setInternalZones(propZones);
  }, [propZones]);

  useEffect(() => {
    if (propReports) setInternalReports(propReports);
  }, [propReports]);

  // If zones weren't provided as props, fetch them from RiskZoneService
  useEffect(() => {
    let active = true;
    async function loadFallbackZones() {
      if (!propZones || propZones.length === 0) {
        try {
          const z = await RiskZoneService.getZones();
          if (active) setInternalZones(z);
        } catch (err) {
          console.warn('SafetyMapView zones fetch err:', err);
        }
      }
    }
    loadFallbackZones();
    return () => {
      active = false;
    };
  }, [propZones]);

  // If hazard reports weren't provided as props, fetch them from Supabase
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
          console.warn('SafetyMapView reports fetch err:', err);
        }
      }
    }
    loadFallbackReports();
    return () => {
      active = false;
    };
  }, [propReports]);

  // 1. Initialize Leaflet Map
  useEffect(() => {
    injectLeafletStyles();

    if (!containerRef.current) return;
    if (mapInstanceRef.current) return;

    try {
      const map = L.map(containerRef.current, {
        center: [17.4485, 78.3758], // Initial fallback center
        zoom: 11,
        minZoom: 8,
        maxZoom: 18,
        zoomControl: true,
        attributionControl: true,
      });

      // Real OpenStreetMap Tile Layer
      const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
      });

      tileLayer.on('tileerror', () => {
        // Tile load error handled gracefully without crashing
      });

      tileLayer.addTo(map);

      const overlayGroup = L.layerGroup().addTo(map);
      overlayGroupRef.current = overlayGroup;
      mapInstanceRef.current = map;

      const timer = setTimeout(() => {
        map.invalidateSize();
      }, 200);

      const handleResize = () => {
        map.invalidateSize();
      };
      window.addEventListener('resize', handleResize);

      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', handleResize);
        map.remove();
        mapInstanceRef.current = null;
        overlayGroupRef.current = null;
      };
    } catch (err: any) {
      console.warn('Leaflet initialization error:', err);
      setMapError('Interactive map initializing...');
    }
  }, []);

  // 2. Render Overlays (Road-following route, Risk Zones, Hazard Reports, Geolocation)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const overlayGroup = overlayGroupRef.current;
    if (!map || !overlayGroup) return;

    overlayGroup.clearLayers();

    const getZoneColor = (level: RiskLevel) => {
      switch (level) {
        case 'CRITICAL':
          return colors.red;
        case 'HIGH':
          return '#E65100';
        case 'MODERATE':
          return colors.yellow;
        case 'LOW':
        default:
          return colors.green;
      }
    };

    const allCoords: [number, number][] = [];

    // A. Render Real Road Route Geometry from OSRM (Following actual roads, curves, and turns!)
    let routePolyline: L.Polyline | null = null;
    if (drivingRoute && drivingRoute.coordinates && drivingRoute.coordinates.length > 1) {
      // Background outline casing for visibility against any map terrain
      const roadCasing = L.polyline(drivingRoute.coordinates, {
        color: '#075985',
        weight: 8,
        opacity: 0.7,
        lineCap: 'round',
        lineJoin: 'round',
      });

      // Vivid foreground driving route line
      const roadLine = L.polyline(drivingRoute.coordinates, {
        color: '#0284C7',
        weight: 5.5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      });

      roadCasing.addTo(overlayGroup);
      roadLine.addTo(overlayGroup);
      routePolyline = roadLine;

      roadLine.bindTooltip(
        `<strong>Real Driving Route</strong><br/>${drivingRoute.distanceKm} km • ~${drivingRoute.durationMinutes} min`,
        { className: 'zone-tooltip-badge' }
      );

      // Add route bounds
      drivingRoute.coordinates.forEach(([lat, lon]) => allCoords.push([lat, lon]));
    }

    // B. Render All Risk Zones as Real Geographic Circles
    internalZones.forEach((zone) => {
      if (typeof zone.latitude !== 'number' || typeof zone.longitude !== 'number') return;
      allCoords.push([zone.latitude, zone.longitude]);

      const color = getZoneColor(zone.risk_level);
      const isCritical = zone.risk_level === 'CRITICAL';

      const circle = L.circle([zone.latitude, zone.longitude], {
        radius: zone.radius_meters,
        color: color,
        fillColor: color,
        fillOpacity: isCritical ? 0.35 : 0.22,
        weight: isCritical ? 3 : 2,
        dashArray: isCritical ? undefined : '5, 5',
      });

      const demoLabel = zone.is_demo_zone ? '<br/><span style="color:#A1A1AA; font-size:9px;">DEMO DATA</span>' : '';
      circle.bindTooltip(
        `<strong>${zone.name}</strong><br/>${zone.risk_level} RISK (${zone.numeric_score}/100)${demoLabel}`,
        {
          permanent: false,
          direction: 'top',
          className: 'zone-tooltip-badge',
        }
      );

      circle.on('click', () => {
        if (onSelectZone) onSelectZone(zone);
      });

      circle.addTo(overlayGroup);

      // Center locator dot
      const centerDot = L.circleMarker([zone.latitude, zone.longitude], {
        radius: 5,
        color: '#FFFFFF',
        fillColor: color,
        fillOpacity: 1,
        weight: 2,
      });
      centerDot.on('click', () => {
        if (onSelectZone) onSelectZone(zone);
      });
      centerDot.addTo(overlayGroup);
    });

    // C. Render Real Hazard Reports from Supabase
    internalReports.forEach((report) => {
      if (typeof report.latitude !== 'number' || typeof report.longitude !== 'number') return;
      allCoords.push([report.latitude, report.longitude]);

      const color =
        report.severity === 'critical'
          ? '#991B1B'
          : report.severity === 'high'
          ? colors.red
          : colors.yellow;

      const pinIcon = L.divIcon({
        className: 'hazard-marker-div',
        html: `<div class="custom-hazard-pin" style="background-color: ${color}; width: 22px; height: 22px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3"><polygon points="12 2 2 22 22 22"/><line x1="12" y1="9" x2="12" y2="13"/><circle cx="12" cy="17" r="1" fill="#FFFFFF"/></svg></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      const marker = L.marker([report.latitude, report.longitude], { icon: pinIcon });

      marker.bindTooltip(
        `<strong>${report.hazard_type.toUpperCase().replace('_', ' ')}</strong><br/>${report.description || 'Reported hazard'}`,
        {
          direction: 'top',
          className: 'zone-tooltip-badge',
        }
      );

      marker.on('click', () => {
        if (onSelectReport) onSelectReport(report);
      });

      marker.addTo(overlayGroup);
    });

    // D. Render User Location (Only when permission exists)
    if (userCoords) {
      allCoords.push([userCoords.latitude, userCoords.longitude]);

      const userPin = L.divIcon({
        className: 'user-marker-div',
        html: '<div class="user-gps-pulse"></div>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      const userMarker = L.marker([userCoords.latitude, userCoords.longitude], {
        icon: userPin,
        zIndexOffset: 1000,
      });

      userMarker.bindTooltip('<strong>Your Current Location</strong>', {
        direction: 'top',
        className: 'zone-tooltip-badge',
      });

      userMarker.addTo(overlayGroup);
    }

    // E. Render Start Location Marker
    if (startLocation) {
      allCoords.push([startLocation.latitude, startLocation.longitude]);

      const startPin = L.divIcon({
        className: 'start-marker-div',
        html: '<div class="custom-start-pin" style="width:24px; height:24px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="#FFFFFF"><circle cx="12" cy="12" r="6"/></svg></div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const startMarker = L.marker([startLocation.latitude, startLocation.longitude], {
        icon: startPin,
        zIndexOffset: 950,
      });

      startMarker.bindTooltip(`<strong>Start:</strong> ${startLocation.name}`, {
        direction: 'top',
        className: 'zone-tooltip-badge',
      });

      startMarker.addTo(overlayGroup);
    }

    // F. Render Destination Location Marker
    if (destinationLocation) {
      allCoords.push([destinationLocation.latitude, destinationLocation.longitude]);

      const destPin = L.divIcon({
        className: 'dest-marker-div',
        html: '<div class="custom-dest-pin" style="width:26px; height:26px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3" fill="#FFFFFF"/></svg></div>',
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });

      const destMarker = L.marker([destinationLocation.latitude, destinationLocation.longitude], {
        icon: destPin,
        zIndexOffset: 990,
      });

      destMarker.bindTooltip(`<strong>Destination:</strong> ${destinationLocation.name}`, {
        direction: 'top',
        className: 'zone-tooltip-badge',
      });

      destMarker.addTo(overlayGroup);
    }

    // 3. Viewport Fitting:
    // If a real road route was calculated, fit the complete road corridor!
    if (routePolyline) {
      try {
        map.fitBounds(routePolyline.getBounds().pad(0.18));
      } catch {}
    } else if (allCoords.length > 0 && !hasFittedInitialBounds.current) {
      try {
        const bounds = L.latLngBounds(allCoords);
        map.fitBounds(bounds.pad(0.18), { maxZoom: 14 });
        hasFittedInitialBounds.current = true;
      } catch {
        map.setView([17.4485, 78.3758], 11);
      }
    } else if (destinationLocation) {
      try {
        const bounds = L.latLngBounds(allCoords);
        map.fitBounds(bounds.pad(0.18), { maxZoom: 14 });
      } catch {}
    }
  }, [internalZones, internalReports, userCoords, startLocation, destinationLocation, drivingRoute, routeStatus, onSelectZone, onSelectReport]);

  if (mapError) {
    return (
      <View style={[styles.errorBox, { height }]}>
        <Text style={styles.errorText}>{mapError}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.mapWrapper, { height }]}>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 14,
          overflow: 'hidden',
          zIndex: 1,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  mapWrapper: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#0B1A16',
  },
  errorBox: {
    width: '100%',
    borderRadius: 14,
    backgroundColor: '#142823',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
});