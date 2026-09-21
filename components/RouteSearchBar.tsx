import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  Crosshair,
  Loader2,
  MapPin,
  Navigation,
  Search,
  X,
} from 'lucide-react-native';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, shadow } from '@/lib/theme';
import { GeocodingService } from '@/services/geocoding-service';
import { ResolvedLocation } from '@/types/navigation';

interface RouteSearchBarProps {
  onPlanRoute: (
    start: ResolvedLocation,
    destination: ResolvedLocation
  ) => void;
  userCoords?: { latitude: number; longitude: number } | null;
  onRequestUserLocation?: () => void;
}

export function RouteSearchBar({
  onPlanRoute,
  userCoords,
  onRequestUserLocation,
}: RouteSearchBarProps) {
  // Start point state
  const [startQuery, setStartQuery] = useState('');
  const [selectedStart, setSelectedStart] = useState<ResolvedLocation | null>(null);
  const [startSuggestions, setStartSuggestions] = useState<ResolvedLocation[]>([]);
  const [isSearchingStart, setIsSearchingStart] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // Destination state
  const [destQuery, setDestQuery] = useState('');
  const [selectedDest, setSelectedDest] = useState<ResolvedLocation | null>(null);
  const [destSuggestions, setDestSuggestions] = useState<ResolvedLocation[]>([]);
  const [isSearchingDest, setIsSearchingDest] = useState(false);
  const [destError, setDestError] = useState<string | null>(null);

  // Set default "Current location" if user coordinates exist
  useEffect(() => {
    if (userCoords) {
      if (!selectedStart || selectedStart.isCurrentLocation) {
        const loc: ResolvedLocation = {
          id: 'user_current_gps',
          name: 'Current location',
          displayName: 'Your Current GPS Location',
          latitude: userCoords.latitude,
          longitude: userCoords.longitude,
          isCurrentLocation: true,
        };
        setSelectedStart(loc);
        setStartQuery('Current location');
        setStartError(null);
      }
    }
  }, [userCoords]);

  // Debounced search for Start
  useEffect(() => {
    const trimmed = startQuery.trim();
    if (!trimmed) {
      setStartSuggestions([]);
      setStartError(null);
      return;
    }

    // If currently selected start matches query (case-insensitive)
    if (selectedStart && selectedStart.name.toLowerCase() === trimmed.toLowerCase()) {
      setStartSuggestions([]);
      setStartError(null);
      return;
    }

    // Direct match for "current location" or "my location"
    if (trimmed.toLowerCase() === 'current location' || trimmed.toLowerCase() === 'my location') {
      const loc: ResolvedLocation = {
        id: 'user_current_gps',
        name: 'Current location',
        displayName: 'Your Current GPS Location',
        latitude: userCoords ? userCoords.latitude : 17.385044,
        longitude: userCoords ? userCoords.longitude : 78.486671,
        isCurrentLocation: true,
      };
      setSelectedStart(loc);
      setStartSuggestions([]);
      setStartError(null);
      return;
    }

    if (trimmed.length < 2) {
      setStartSuggestions([]);
      setStartError(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingStart(true);
      setStartError(null);
      try {
        const results = await GeocodingService.searchPlaces(trimmed);
        setStartSuggestions(results);
        if (results.length === 0) {
          setStartError('Location not found');
        }
      } catch {
        setStartError('Could not resolve location');
      } finally {
        setIsSearchingStart(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [startQuery, selectedStart, userCoords]);

  // Debounced search for Destination
  useEffect(() => {
    if (selectedDest && selectedDest.name === destQuery) {
      setDestSuggestions([]);
      return;
    }
    if (destQuery.trim().length < 2) {
      setDestSuggestions([]);
      setDestError(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingDest(true);
      setDestError(null);
      try {
        const results = await GeocodingService.searchPlaces(destQuery);
        setDestSuggestions(results);
        if (results.length === 0) {
          setDestError('Location not found');
        }
      } catch {
        setDestError('Could not resolve location');
      } finally {
        setIsSearchingDest(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [destQuery, selectedDest]);

  const handleUseCurrentLocation = () => {
    const loc: ResolvedLocation = {
      id: 'user_current_gps',
      name: 'Current location',
      displayName: 'Your Current GPS Location',
      latitude: userCoords ? userCoords.latitude : 17.385044,
      longitude: userCoords ? userCoords.longitude : 78.486671,
      isCurrentLocation: true,
    };
    setSelectedStart(loc);
    setStartQuery('Current location');
    setStartSuggestions([]);
    setStartError(null);
    if (!userCoords && onRequestUserLocation) {
      onRequestUserLocation();
    }
  };

  const handleSelectStart = (loc: ResolvedLocation) => {
    setSelectedStart(loc);
    setStartQuery(loc.name);
    setStartSuggestions([]);
    setStartError(null);
  };

  const handleSelectDest = (loc: ResolvedLocation) => {
    setSelectedDest(loc);
    setDestQuery(loc.name);
    setDestSuggestions([]);
    setDestError(null);
  };

  const handlePlanRoute = () => {
    if (!selectedStart) {
      setStartError('Please select a resolved start point');
      return;
    }
    if (!selectedDest) {
      setDestError('Please select a resolved destination');
      return;
    }

    onPlanRoute(selectedStart, selectedDest);
  };

  return (
    <View style={[styles.card, shadow]}>
      {/* START POINT INPUT */}
      <View style={styles.inputContainer}>
        <View style={styles.inputHeader}>
          <Text style={styles.label}>CURRENT LOCATION / START POINT</Text>
          <Pressable onPress={handleUseCurrentLocation} style={styles.gpsButton} hitSlop={6}>
            <Crosshair size={12} color={colors.teal} />
            <Text style={styles.gpsButtonText}>Use my location</Text>
          </Pressable>
        </View>

        <View style={styles.inputRow}>
          <View style={[styles.dot, styles.startDot]}>
            <MapPin size={16} color={colors.teal} strokeWidth={2.5} />
          </View>
          <TextInput
            value={startQuery}
            onChangeText={(text) => {
              setStartQuery(text);
              if (selectedStart && selectedStart.name.toLowerCase() !== text.trim().toLowerCase()) {
                setSelectedStart(null);
              }
            }}
            placeholder="Search starting location (e.g. Miyapur)..."
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          {isSearchingStart && <ActivityIndicator size="small" color={colors.teal} />}
          {selectedStart && !isSearchingStart && (
            <View style={styles.resolvedCheck}>
              <Check size={14} color={colors.green} strokeWidth={3} />
            </View>
          )}
        </View>

        {/* Start Suggestions Dropdown */}
        {startSuggestions.length > 0 && !selectedStart && (
          <View style={styles.dropdown}>
            <Text style={styles.dropdownKicker}>MATCHING LOCATIONS</Text>
            {startSuggestions.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => handleSelectStart(item)}
                style={({ pressed }) => [
                  styles.dropdownItem,
                  pressed && { backgroundColor: colors.canvas },
                ]}
              >
                <MapPin size={14} color={colors.teal} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{item.name}</Text>
                  <Text style={styles.itemSub}>{item.displayName}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {startError && !selectedStart && (
          <View style={styles.errorRow}>
            <AlertCircle size={13} color={colors.red} />
            <Text style={styles.errorText}>{startError}</Text>
          </View>
        )}
      </View>

      {/* CONNECTOR */}
      <View style={styles.connector} />

      {/* DESTINATION INPUT */}
      <View style={styles.inputContainer}>
        <View style={styles.inputHeader}>
          <Text style={styles.label}>DESTINATION</Text>
        </View>

        <View style={styles.inputRow}>
          <View style={[styles.dot, styles.destDot]}>
            <Navigation size={15} color={colors.red} strokeWidth={2.5} />
          </View>
          <TextInput
            value={destQuery}
            onChangeText={(text) => {
              setDestQuery(text);
              if (selectedDest && selectedDest.name.toLowerCase() !== text.trim().toLowerCase()) {
                setSelectedDest(null);
              }
            }}
            placeholder="Search destination (e.g. Medchal)..."
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          {isSearchingDest && <ActivityIndicator size="small" color={colors.red} />}
          {selectedDest && !isSearchingDest && (
            <View style={styles.resolvedCheck}>
              <Check size={14} color={colors.green} strokeWidth={3} />
            </View>
          )}
        </View>

        {/* Destination Suggestions Dropdown */}
        {destSuggestions.length > 0 && !selectedDest && (
          <View style={styles.dropdown}>
            <Text style={styles.dropdownKicker}>SELECT DESTINATION</Text>
            {destSuggestions.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => handleSelectDest(item)}
                style={({ pressed }) => [
                  styles.dropdownItem,
                  pressed && { backgroundColor: colors.canvas },
                ]}
              >
                <Navigation size={14} color={colors.red} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{item.name}</Text>
                  <Text style={styles.itemSub}>{item.displayName}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {destError && (
          <View style={styles.errorRow}>
            <AlertCircle size={13} color={colors.red} />
            <Text style={styles.errorText}>{destError}</Text>
          </View>
        )}
      </View>

      {/* ACTION BUTTON */}
      <Pressable
        onPress={handlePlanRoute}
        disabled={!selectedStart || !selectedDest}
        style={({ pressed }) => [
          styles.button,
          (!selectedStart || !selectedDest) && styles.buttonDisabled,
          pressed && { opacity: 0.85 },
        ]}
      >
        <Search size={18} color="#fff" strokeWidth={2.5} />
        <Text style={styles.buttonText}>Plan safer route</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
  },
  inputContainer: {
    position: 'relative',
  },
  inputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
    color: colors.muted,
  },
  gpsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
    backgroundColor: colors.tealSoft,
  },
  gpsButtonText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.teal,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.canvas,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.line,
  },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  startDot: {
    backgroundColor: colors.tealSoft,
  },
  destDot: {
    backgroundColor: colors.redSoft,
  },
  input: {
    flex: 1,
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
    paddingVertical: 6,
  },
  resolvedCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connector: {
    height: 16,
    borderLeftWidth: 2,
    borderLeftColor: colors.line,
    borderStyle: 'dashed',
    marginLeft: 27,
    marginVertical: 4,
  },
  dropdown: {
    backgroundColor: '#fff',
    borderRadius: 14,
    marginTop: 6,
    padding: 6,
    borderWidth: 1,
    borderColor: colors.line,
    zIndex: 100,
    elevation: 4,
  },
  dropdownKicker: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    color: colors.muted,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.ink,
  },
  itemSub: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 1,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  errorText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.red,
  },
  button: {
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.ink,
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
});
