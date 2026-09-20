import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { RiskZoneDetailModal } from '@/components/RiskZoneDetailModal';
import { SafetyMapView } from '@/components/SafetyMapView';
import { DrivingRoute, ResolvedLocation } from '@/types/navigation';
import { RiskZone } from '@/types/risk-zone';

interface RiskMapProps {
  startLocation?: ResolvedLocation | null;
  destinationLocation?: ResolvedLocation | null;
  drivingRoute?: DrivingRoute | null;
  routeStatus?: 'found' | 'calculating' | 'failed';
  destination?: string; // Legacy fallback
  onZoneSelected?: (zone: RiskZone) => void;
}

export function RiskMap({
  startLocation,
  destinationLocation,
  drivingRoute,
  routeStatus,
  onZoneSelected,
}: RiskMapProps) {
  const [selectedZone, setSelectedZone] = useState<RiskZone | null>(null);

  const handleSelectZone = (zone: RiskZone) => {
    setSelectedZone(zone);
    if (onZoneSelected) onZoneSelected(zone);
  };

  return (
    <View style={styles.container}>
      <SafetyMapView
        startLocation={startLocation}
        destinationLocation={destinationLocation}
        drivingRoute={drivingRoute}
        routeStatus={routeStatus}
        onSelectZone={handleSelectZone}
        height={320}
      />

      <RiskZoneDetailModal
        zone={selectedZone}
        visible={!!selectedZone}
        onClose={() => setSelectedZone(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
  },
});