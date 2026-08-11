import type { Place, WeatherAlert, WeatherSnapshot } from "@/lib/api";

interface OpenMeteoResponse {
  current?: {
    temperature_2m?: number;
    apparent_temperature?: number;
    weather_code?: number;
    precipitation?: number;
    wind_speed_10m?: number;
    wind_gusts_10m?: number;
    wind_direction_10m?: number;
  };
  daily?: {
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: number[];
    sunrise?: string[];
    sunset?: string[];
  };
}

interface NwsFeature {
  id?: string;
  properties?: {
    event?: string;
    severity?: string;
    urgency?: string;
    headline?: string;
    description?: string;
    instruction?: string;
    effective?: string;
    expires?: string;
    web?: string;
  };
}

export function parseOpenMeteoWeather(placeId: string, payload: OpenMeteoResponse, fetchedAt: string, error?: string): WeatherSnapshot {
  return {
    id: crypto.randomUUID(),
    placeId,
    currentTemperature: payload.current?.temperature_2m ?? null,
    apparentTemperature: payload.current?.apparent_temperature ?? null,
    weatherCode: payload.current?.weather_code ?? null,
    precipitationProbability: payload.daily?.precipitation_probability_max?.[0] ?? null,
    precipitation: payload.current?.precipitation ?? null,
    windSpeed: payload.current?.wind_speed_10m ?? null,
    windGust: payload.current?.wind_gusts_10m ?? null,
    windDirection: payload.current?.wind_direction_10m ?? null,
    dailyHigh: payload.daily?.temperature_2m_max?.[0] ?? null,
    dailyLow: payload.daily?.temperature_2m_min?.[0] ?? null,
    sunrise: payload.daily?.sunrise?.[0] ?? null,
    sunset: payload.daily?.sunset?.[0] ?? null,
    fetchedAt,
    source: "open-meteo",
    stale: Boolean(error),
    fetchError: error ?? null,
  };
}

export function parseNwsAlerts(placeId: string, payload: { features?: NwsFeature[] }, fetchedAt: string): WeatherAlert[] {
  return (payload.features ?? []).map((feature) => ({
    id: feature.id ?? crypto.randomUUID(),
    placeId,
    event: feature.properties?.event ?? "Unknown event",
    severity: feature.properties?.severity ?? "Unknown",
    urgency: feature.properties?.urgency ?? "Unknown",
    headline: feature.properties?.headline ?? feature.properties?.event ?? "Weather alert",
    description: feature.properties?.description ?? "",
    instruction: feature.properties?.instruction ?? "",
    officialUrl: feature.properties?.web ?? "",
    effectiveAt: feature.properties?.effective ?? null,
    expiresAt: feature.properties?.expires ?? null,
    fetchedAt,
  }));
}

export function shouldRefreshWeather(lastFetchedAt: string | null, minutes: number, now = new Date()) {
  if (!lastFetchedAt) {
    return true;
  }
  return now.getTime() - new Date(lastFetchedAt).getTime() >= minutes * 60 * 1000;
}

export async function fetchWeatherForPlaces(
  places: Place[],
  fetcher: typeof fetch,
  userAgent: string,
  existingSnapshots: WeatherSnapshot[],
) {
  const fetchedAt = new Date().toISOString();
  const snapshots: WeatherSnapshot[] = [];
  const alerts: WeatherAlert[] = [];

  for (const place of places) {
    const existing = existingSnapshots.find((snapshot) => snapshot.placeId === place.id);
    try {
      const openMeteoUrl =
        `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
        "&current=temperature_2m,apparent_temperature,weather_code,precipitation,wind_speed_10m,wind_gusts_10m,wind_direction_10m" +
        "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset&timezone=UTC&forecast_days=1";
      const weatherResponse = await fetcher(openMeteoUrl, {
        headers: {
          "User-Agent": userAgent,
        },
      });
      const weatherPayload = (await weatherResponse.json()) as OpenMeteoResponse;
      snapshots.push(parseOpenMeteoWeather(place.id, weatherPayload, fetchedAt));
    } catch (error) {
      snapshots.push(
        existing
          ? { ...existing, stale: true, fetchError: error instanceof Error ? error.message : "Weather fetch failed" }
          : parseOpenMeteoWeather(place.id, {}, fetchedAt, error instanceof Error ? error.message : "Weather fetch failed"),
      );
    }

    try {
      const nwsUrl = `https://api.weather.gov/alerts/active?point=${place.latitude},${place.longitude}`;
      const nwsResponse = await fetcher(nwsUrl, {
        headers: {
          "User-Agent": userAgent,
          Accept: "application/geo+json",
        },
      });
      const nwsPayload = (await nwsResponse.json()) as { features?: NwsFeature[] };
      alerts.push(...parseNwsAlerts(place.id, nwsPayload, fetchedAt));
    } catch {
      continue;
    }
  }

  return { snapshots, alerts, fetchedAt };
}
