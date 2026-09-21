import { ResolvedLocation } from '@/types/navigation';

/**
 * PRE-INDEXED HYDERABAD METRO PLACES
 * Used for instant, accurate local resolution of Hyderabad landmarks/suburbs.
 * NOTE: These are regular destination points and do NOT contain artificial accident statistics.
 */
export const HYDERABAD_LOCAL_PLACES: Array<Omit<ResolvedLocation, 'displayName'> & { displayName?: string }> = [
  {
    id: 'hyd_miyapur',
    name: 'Miyapur',
    displayName: 'Miyapur, Hyderabad, Telangana',
    latitude: 17.4968,
    longitude: 78.3614,
    state: 'Telangana',
    country: 'India',
  },
  {
    id: 'hyd_medchal',
    name: 'Medchal',
    displayName: 'Medchal, Telangana, India',
    latitude: 17.6297,
    longitude: 78.4814,
    state: 'Telangana',
    country: 'India',
  },
  {
    id: 'hyd_kukatpally',
    name: 'Kukatpally',
    displayName: 'Kukatpally, Hyderabad, Telangana',
    latitude: 17.4938,
    longitude: 78.3995,
    state: 'Telangana',
    country: 'India',
  },
  {
    id: 'hyd_gachibowli',
    name: 'Gachibowli',
    displayName: 'Gachibowli, Hyderabad, Telangana',
    latitude: 17.4401,
    longitude: 78.3489,
    state: 'Telangana',
    country: 'India',
  },
  {
    id: 'hyd_madhapur',
    name: 'Madhapur',
    displayName: 'Madhapur, Hyderabad, Telangana',
    latitude: 17.4483,
    longitude: 78.3915,
    state: 'Telangana',
    country: 'India',
  },
  {
    id: 'hyd_hitec_city',
    name: 'HITEC City',
    displayName: 'HITEC City, Hyderabad, Telangana',
    latitude: 17.4435,
    longitude: 78.3772,
    state: 'Telangana',
    country: 'India',
  },
  {
    id: 'hyd_kondapur',
    name: 'Kondapur',
    displayName: 'Kondapur, Hyderabad, Telangana',
    latitude: 17.4646,
    longitude: 78.3564,
    state: 'Telangana',
    country: 'India',
  },
  {
    id: 'hyd_banjara_hills',
    name: 'Banjara Hills',
    displayName: 'Banjara Hills, Hyderabad, Telangana',
    latitude: 17.4156,
    longitude: 78.4350,
    state: 'Telangana',
    country: 'India',
  },
  {
    id: 'hyd_jubilee_hills',
    name: 'Jubilee Hills',
    displayName: 'Jubilee Hills, Hyderabad, Telangana',
    latitude: 17.4319,
    longitude: 78.4073,
    state: 'Telangana',
    country: 'India',
  },
  {
    id: 'hyd_ameerpet',
    name: 'Ameerpet',
    displayName: 'Ameerpet, Hyderabad, Telangana',
    latitude: 17.4375,
    longitude: 78.4483,
    state: 'Telangana',
    country: 'India',
  },
  {
    id: 'hyd_secunderabad',
    name: 'Secunderabad',
    displayName: 'Secunderabad, Telangana, India',
    latitude: 17.4399,
    longitude: 78.4983,
    state: 'Telangana',
    country: 'India',
  },
  {
    id: 'hyd_uppal',
    name: 'Uppal',
    displayName: 'Uppal, Hyderabad, Telangana',
    latitude: 17.4022,
    longitude: 78.5602,
    state: 'Telangana',
    country: 'India',
  },
  {
    id: 'hyd_lb_nagar',
    name: 'LB Nagar',
    displayName: 'LB Nagar, Hyderabad, Telangana',
    latitude: 17.3457,
    longitude: 78.5522,
    state: 'Telangana',
    country: 'India',
  },
  {
    id: 'hyd_kompally',
    name: 'Kompally',
    displayName: 'Kompally, Medchal-Malkajgiri, Telangana',
    latitude: 17.5387,
    longitude: 78.4872,
    state: 'Telangana',
    country: 'India',
  },
  {
    id: 'hyd_shamshabad',
    name: 'Shamshabad',
    displayName: 'Shamshabad, Ranga Reddy, Telangana',
    latitude: 17.2490,
    longitude: 78.4299,
    state: 'Telangana',
    country: 'India',
  },
];

export class GeocodingService {
  /**
   * Searches for matching places using local Hyderabad landmarks + Open-Meteo Geocoding API.
   * Prioritizes results in India.
   */
  public static async searchPlaces(query: string): Promise<ResolvedLocation[]> {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) return [];

    const lower = trimmed.toLowerCase();
    const results: ResolvedLocation[] = [];
    const seenCoordinates = new Set<string>();

    // 1. Check local Hyderabad landmark catalog first
    const localMatches = HYDERABAD_LOCAL_PLACES.filter((place) =>
      place.name.toLowerCase().includes(lower) ||
      place.displayName?.toLowerCase().includes(lower)
    );

    for (const match of localMatches) {
      const coordKey = `${match.latitude.toFixed(3)},${match.longitude.toFixed(3)}`;
      seenCoordinates.add(coordKey);
      results.push({
        ...match,
        displayName: match.displayName || `${match.name}, Hyderabad, Telangana`,
      });
    }

    // 2. Query Open-Meteo Geocoding API for broader regional / national resolution
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        trimmed
      )}&count=8&language=en&format=json`;

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.results && Array.isArray(data.results)) {
          // Prioritize India entries
          const sorted = data.results.sort((a: any, b: any) => {
            if (a.country_code === 'IN' && b.country_code !== 'IN') return -1;
            if (a.country_code !== 'IN' && b.country_code === 'IN') return 1;
            return 0;
          });

          for (const item of sorted) {
            const coordKey = `${Number(item.latitude).toFixed(3)},${Number(item.longitude).toFixed(3)}`;
            if (seenCoordinates.has(coordKey)) continue;
            seenCoordinates.add(coordKey);

            const parts = [item.name];
            if (item.admin2 && item.admin2 !== item.name) parts.push(item.admin2);
            if (item.admin1 && item.admin1 !== item.name) parts.push(item.admin1);
            if (item.country) parts.push(item.country);

            results.push({
              id: `om_${item.id}`,
              name: item.name,
              displayName: parts.join(', '),
              latitude: Number(item.latitude),
              longitude: Number(item.longitude),
              state: item.admin1,
              country: item.country || 'India',
            });
          }
        }
      }
    } catch (err) {
      console.warn('Open-Meteo Geocoding API request warning:', err);
    }

    return results;
  }
}
