/**
 * NearMiss / SafePath AI: Weather Service
 * Fetches real-time weather metrics using the Open-Meteo Weather API.
 * Maps weather parameters into road-risk inputs (rain risk, visibility level).
 * Fails safely to 'Weather unavailable' without inventing data or credentials.
 */

import { RiskZoneWeatherCondition, WeatherRiskPattern } from '@/types/risk-zone';

export type WeatherConditionKey =
  | 'clear'
  | 'partly_cloudy'
  | 'overcast'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'heavy_rain'
  | 'thunderstorm';

export type RainRisk = 'LOW' | 'MODERATE' | 'HIGH';
export type VisibilityLevel = 'GOOD' | 'MODERATE' | 'POOR';

export interface CurrentWeatherData {
  temperatureC: number;
  apparentTemperatureC: number;
  condition: string;
  conditionKey: WeatherConditionKey;
  precipitationMm: number;
  relativeHumidity: number;
  windSpeedKmH: number;
  visibilityMeters: number;
  rainRisk: RainRisk;
  visibilityLevel: VisibilityLevel;
  fetchedAt: string;
}

export interface WeatherResult {
  status: 'success' | 'unavailable';
  data?: CurrentWeatherData;
  error?: string;
}

/**
 * WMO Weather interpretation code translation
 * Reference: Open-Meteo / WMO standard codes
 */
export function mapWmoCode(code: number): {
  condition: string;
  key: WeatherConditionKey;
} {
  switch (code) {
    case 0:
      return { condition: 'Clear Sky', key: 'clear' };
    case 1:
      return { condition: 'Mainly Clear', key: 'clear' };
    case 2:
      return { condition: 'Partly Cloudy', key: 'partly_cloudy' };
    case 3:
      return { condition: 'Overcast', key: 'overcast' };
    case 45:
    case 48:
      return { condition: 'Fog & Mist', key: 'fog' };
    case 51:
    case 53:
    case 55:
      return { condition: 'Drizzle', key: 'drizzle' };
    case 61:
    case 63:
      return { condition: 'Rain', key: 'rain' };
    case 65:
      return { condition: 'Heavy Rain', key: 'heavy_rain' };
    case 80:
    case 81:
      return { condition: 'Rain Showers', key: 'rain' };
    case 82:
      return { condition: 'Violent Rain Showers', key: 'heavy_rain' };
    case 95:
    case 96:
    case 99:
      return { condition: 'Thunderstorm', key: 'thunderstorm' };
    default:
      if (code > 0 && code < 50) return { condition: 'Cloudy', key: 'partly_cloudy' };
      if (code >= 50 && code < 70) return { condition: 'Rain', key: 'rain' };
      if (code >= 70 && code < 90) return { condition: 'Showers', key: 'rain' };
      return { condition: 'Overcast', key: 'overcast' };
  }
}

export function calculateRainRisk(
  precipitationMm: number,
  conditionKey: WeatherConditionKey
): RainRisk {
  if (precipitationMm > 7.5 || conditionKey === 'heavy_rain' || conditionKey === 'thunderstorm') {
    return 'HIGH';
  }
  if (precipitationMm > 1.0 || conditionKey === 'rain' || conditionKey === 'drizzle') {
    return 'MODERATE';
  }
  return 'LOW';
}

export function calculateVisibilityLevel(visibilityMeters: number): VisibilityLevel {
  if (visibilityMeters < 1500) return 'POOR';
  if (visibilityMeters < 5000) return 'MODERATE';
  return 'GOOD';
}

/**
 * ============================================================================
 * DETERMINISTIC WEATHER-TO-RISK-ZONE MAPPING LAYER
 * ============================================================================
 * Explicitly bridges WeatherService observations with RiskZone weather vocabulary:
 *   heavy_rain | waterlogging | poor_visibility | night_glare | normal
 *
 * Requirements & Invariants:
 * 1. fog / POOR visibility -> 'poor_visibility'
 * 2. heavy_rain / thunderstorm / precipitation > 7.5 mm/h -> 'heavy_rain'
 * 3. rain / drizzle (ordinary rain) -> 'normal' unless a zone explicitly defines
 *    a rain-triggered vulnerability (e.g. waterlogging).
 * 4. Never falsely classify ordinary rain as heavy_rain.
 */
export function mapWeatherToRiskZoneCondition(
  weather?: CurrentWeatherData | null,
  zonePatterns?: WeatherRiskPattern[]
): RiskZoneWeatherCondition {
  if (!weather) return 'normal';

  // 1. Reduced visibility (fog or sight line < 1500m)
  if (weather.conditionKey === 'fog' || weather.visibilityLevel === 'POOR') {
    return 'poor_visibility';
  }

  // 2. Heavy rain or severe storm (strictly >7.5 mm/h or violent WMO code)
  if (
    weather.conditionKey === 'heavy_rain' ||
    weather.conditionKey === 'thunderstorm' ||
    weather.precipitationMm > 7.5
  ) {
    return 'heavy_rain';
  }

  // 3. Ordinary rain / drizzle
  // Do NOT falsely classify ordinary rain as heavy_rain.
  // Defaults to 'normal' unless a zone explicitly declares a vulnerability to waterlogging.
  if (
    weather.conditionKey === 'rain' ||
    weather.conditionKey === 'drizzle' ||
    weather.precipitationMm > 0
  ) {
    if (zonePatterns?.some((p) => p.condition === 'waterlogging')) {
      return 'waterlogging';
    }
    return 'normal';
  }

  return 'normal';
}

/**
 * Maps a standalone weather condition key string to the RiskZone vocabulary.
 */
export function mapWeatherKeyToRiskZoneCondition(
  key?: WeatherConditionKey | string,
  zonePatterns?: WeatherRiskPattern[]
): RiskZoneWeatherCondition {
  if (!key) return 'normal';
  if (key === 'fog') return 'poor_visibility';
  if (key === 'heavy_rain' || key === 'thunderstorm') return 'heavy_rain';
  if (key === 'rain' || key === 'drizzle') {
    if (zonePatterns?.some((p) => p.condition === 'waterlogging')) {
      return 'waterlogging';
    }
    return 'normal';
  }
  if (
    key === 'waterlogging' ||
    key === 'poor_visibility' ||
    key === 'night_glare'
  ) {
    return key as RiskZoneWeatherCondition;
  }
  return 'normal';
}

export class WeatherService {
  /**
   * Fetches live weather for coordinates.
   * Defaults to Hyderabad center (17.3850, 78.4867) if coordinates are omitted.
   */
  public static async getCurrentWeather(
    latitude: number = 17.3850,
    longitude: number = 78.4867
  ): Promise<WeatherResult> {
    const endpoint = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,visibility`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6500);

      const res = await fetch(endpoint, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        return {
          status: 'unavailable',
          error: `Weather API responded with HTTP ${res.status}`,
        };
      }

      const json = await res.json();
      const current = json?.current;

      if (!current || typeof current.temperature_2m !== 'number') {
        return {
          status: 'unavailable',
          error: 'Malformed weather payload',
        };
      }

      const wmo = mapWmoCode(current.weather_code ?? 0);
      const precipitationMm = Number(current.precipitation ?? 0);
      const visibilityMeters = Number(current.visibility ?? 10000);

      const rainRisk = calculateRainRisk(precipitationMm, wmo.key);
      const visibilityLevel = calculateVisibilityLevel(visibilityMeters);

      return {
        status: 'success',
        data: {
          temperatureC: Math.round(current.temperature_2m * 10) / 10,
          apparentTemperatureC: Math.round((current.apparent_temperature ?? current.temperature_2m) * 10) / 10,
          condition: wmo.condition,
          conditionKey: wmo.key,
          precipitationMm: Math.round(precipitationMm * 10) / 10,
          relativeHumidity: Math.round(current.relative_humidity_2m ?? 0),
          windSpeedKmH: Math.round(current.wind_speed_10m ?? 0),
          visibilityMeters: Math.round(visibilityMeters),
          rainRisk,
          visibilityLevel,
          fetchedAt: new Date().toISOString(),
        },
      };
    } catch (err: any) {
      console.warn('WeatherService error:', err?.message || err);
      return {
        status: 'unavailable',
        error: 'Weather unavailable',
      };
    }
  }
}
