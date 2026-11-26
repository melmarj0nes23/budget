import { useCallback, useEffect, useState } from 'react';

export const ALCALA_WEATHER_COORDS = {
  latitude: 15.8472,
  longitude: 120.5214,
  label: 'Alcala, Pangasinan (15.8472° N, 120.5214° E)',
} as const;

export interface HeatIndexTier {
  label: 'Normal' | 'Caution' | 'Extreme Caution' | 'Danger' | 'Extreme Danger';
  rangeLabel: string;
  badgeClass: string;
  advisory: string;
}

export interface HourlyPoint {
  time: string;
  tempC: number;
  apparentC: number;
  humidityPct: number;
  dewPointC: number;
  precipMm: number;
  precipProbPct: number;
  weatherCode: number;
  cloudCoverPct: number;
  windKmh: number;
  gustKmh: number;
  uvIndex: number;
}

export interface DailyPoint {
  date: string;
  weatherCode: number;
  tempMaxC: number;
  tempMinC: number;
  apparentMaxC: number;
  apparentMinC: number;
  sunrise: string;
  sunset: string;
  uvMax: number;
  rainSumMm: number;
  precipHours: number;
  probMaxPct: number;
  windMaxKmh: number;
  gustMaxKmh: number;
  windDirDeg: number;
}

export interface RiverDischargePoint {
  date: string;
  discharge: number;
  mean: number;
  max: number;
}

export interface DetailedWeatherData {
  elevationM: number;
  current: {
    time: string;
    tempC: number;
    humidityPct: number;
    apparentC: number;
    isDay: boolean;
    precipMm: number;
    rainMm: number;
    weatherCode: number;
    cloudCoverPct: number;
    pressureMslHpa: number;
    windKmh: number;
    windDirDeg: number;
    gustKmh: number;
    heatIndexC: number;
    heatTier: HeatIndexTier;
  };
  airQuality: {
    usAqi: number | null;
    pm25: number | null;
    pm10: number | null;
    uvIndexNow: number | null;
  };
  next24hRainMm: number;
  next24hMaxProbPct: number;
  hourly: HourlyPoint[];
  daily: DailyPoint[];
  riverDischarge: RiverDischargePoint[];
}

export function computeHeatIndexC(tempC: number, rh: number): number {
  if (tempC < 26.7 || rh < 40) return tempC;
  const tF = (tempC * 9) / 5 + 32;
  const hiF =
    -42.379 +
    2.04901523 * tF +
    10.14333127 * rh -
    0.22475541 * tF * rh -
    0.00683783 * tF * tF -
    0.05481717 * rh * rh +
    0.00122874 * tF * tF * rh +
    0.00085282 * tF * rh * rh -
    0.00000199 * tF * tF * rh * rh;
  return ((hiF - 32) * 5) / 9;
}

export function classifyPagasaHeatIndex(heatIndexC: number): HeatIndexTier {
  if (heatIndexC >= 52) {
    return {
      label: 'Extreme Danger',
      rangeLabel: '≥ 52°C',
      badgeClass: 'bg-red-100 text-red-900 border-red-300',
      advisory: 'Heat stroke is imminent. Suspend outdoor exertion and seek cool shelter.',
    };
  }
  if (heatIndexC >= 42) {
    return {
      label: 'Danger',
      rangeLabel: '42–51°C',
      badgeClass: 'bg-orange-100 text-orange-900 border-orange-300',
      advisory: 'Heat cramps & heat exhaustion likely; heat stroke probable with continued activity.',
    };
  }
  if (heatIndexC >= 33) {
    return {
      label: 'Extreme Caution',
      rangeLabel: '33–41°C',
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
      advisory: 'Heat cramps & exhaustion possible. Hydrate frequently and limit midday sun.',
    };
  }
  if (heatIndexC >= 27) {
    return {
      label: 'Caution',
      rangeLabel: '27–32°C',
      badgeClass: 'bg-yellow-100 text-yellow-900 border-yellow-300',
      advisory: 'Fatigue possible with prolonged exposure and physical activity.',
    };
  }
  return {
    label: 'Normal',
    rangeLabel: '< 27°C',
    badgeClass: 'bg-[#eaf5ef] text-[#2e8b57] border-[#2e8b57]/30',
    advisory: 'Below PAGASA Caution threshold.',
  };
}

export function describeWmoCode(code: number): string {
  if (code === 0) return 'Clear sky';
  if (code === 1) return 'Mainly clear';
  if (code === 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code <= 48) return 'Fog / mist';
  if (code <= 55) return 'Drizzle';
  if (code <= 57) return 'Freezing drizzle';
  if (code <= 63) return 'Light to moderate rain';
  if (code <= 67) return 'Heavy rain';
  if (code <= 80) return 'Light rain showers';
  if (code <= 82) return 'Heavy rain showers';
  if (code <= 99) return 'Thunderstorm';
  return 'Variable';
}

export function degreesToCompass(deg: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(((deg % 360) / 22.5)) % 16] ?? 'N';
}

export function describeUvRisk(uv: number): { label: string; colorClass: string } {
  if (uv >= 11) return { label: 'Extreme', colorClass: 'text-purple-700' };
  if (uv >= 8) return { label: 'Very High', colorClass: 'text-[#d1432a]' };
  if (uv >= 6) return { label: 'High', colorClass: 'text-orange-700' };
  if (uv >= 3) return { label: 'Moderate', colorClass: 'text-amber-700' };
  return { label: 'Low', colorClass: 'text-[#2e8b57]' };
}

export function describeAqi(aqi: number | null): string {
  if (aqi === null) return 'Unavailable';
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Sensitive Groups';
  if (aqi <= 200) return 'Unhealthy';
  return 'Very Unhealthy';
}

const WEATHER_CACHE_KEY = 'betteralcala_weather_cache_v1';
const WEATHER_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

function readCachedWeather(): { data: DetailedWeatherData; fetchedAtLabel: string } | null {
  try {
    const raw = localStorage.getItem(WEATHER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      timestamp: number;
      fetchedAtLabel: string;
      data: DetailedWeatherData;
    };
    if (!parsed?.data || typeof parsed.timestamp !== 'number') return null;
    if (Date.now() - parsed.timestamp > WEATHER_CACHE_TTL_MS) return null;
    return { data: parsed.data, fetchedAtLabel: parsed.fetchedAtLabel };
  } catch {
    return null;
  }
}

function writeCachedWeather(data: DetailedWeatherData, fetchedAtLabel: string): void {
  try {
    localStorage.setItem(
      WEATHER_CACHE_KEY,
      JSON.stringify({ timestamp: Date.now(), fetchedAtLabel, data }),
    );
  } catch {
    // Ignore storage quota or private-mode errors
  }
}

export function useDetailedWeather() {
  const initialCache = readCachedWeather();
  const [data, setData] = useState<DetailedWeatherData | null>(() => initialCache?.data ?? null);
  const [loading, setLoading] = useState(() => !initialCache);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<string | null>(
    () => initialCache?.fetchedAtLabel ?? null,
  );

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { latitude, longitude } = ALCALA_WEATHER_COORDS;

      const weatherUrl =
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
        `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m` +
        `&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_gusts_10m,uv_index` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,uv_index_max,precipitation_sum,precipitation_hours,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant` +
        `&timezone=Asia%2FManila&forecast_days=7`;

      const floodUrl =
        `https://flood-api.open-meteo.com/v1/flood?latitude=${latitude}&longitude=${longitude}` +
        `&daily=river_discharge,river_discharge_mean,river_discharge_max&past_days=3&forecast_days=7`;

      const aqiUrl =
        `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}` +
        `&current=us_aqi,pm2_5,pm10,uv_index&timezone=Asia%2FManila`;

      const [weatherRes, floodRes, aqiRes] = await Promise.all([
        fetch(weatherUrl),
        fetch(floodUrl),
        fetch(aqiUrl).catch(() => null),
      ]);

      if (!weatherRes.ok) throw new Error(`Weather API HTTP ${weatherRes.status}`);
      if (!floodRes.ok) throw new Error(`Flood API HTTP ${floodRes.status}`);

      const weatherJson = await weatherRes.json();
      const floodJson = await floodRes.json();
      const aqiJson = aqiRes && aqiRes.ok ? await aqiRes.json() : null;

      const hourlyTimes: string[] = weatherJson.hourly?.time ?? [];
      const currentHourPrefix = (weatherJson.current?.time ?? '').slice(0, 13);
      const startIdx = Math.max(
        0,
        hourlyTimes.findIndex((t) => t.startsWith(currentHourPrefix)),
      );

      const hourly: HourlyPoint[] = hourlyTimes.slice(startIdx, startIdx + 48).map((time, offset) => {
        const i = startIdx + offset;
        return {
          time,
          tempC: weatherJson.hourly?.temperature_2m?.[i] ?? 0,
          apparentC: weatherJson.hourly?.apparent_temperature?.[i] ?? 0,
          humidityPct: weatherJson.hourly?.relative_humidity_2m?.[i] ?? 0,
          dewPointC: weatherJson.hourly?.dew_point_2m?.[i] ?? 0,
          precipMm: weatherJson.hourly?.precipitation?.[i] ?? 0,
          precipProbPct: weatherJson.hourly?.precipitation_probability?.[i] ?? 0,
          weatherCode: weatherJson.hourly?.weather_code?.[i] ?? 0,
          cloudCoverPct: weatherJson.hourly?.cloud_cover?.[i] ?? 0,
          windKmh: weatherJson.hourly?.wind_speed_10m?.[i] ?? 0,
          gustKmh: weatherJson.hourly?.wind_gusts_10m?.[i] ?? 0,
          uvIndex: weatherJson.hourly?.uv_index?.[i] ?? 0,
        };
      });

      const next24h = hourly.slice(0, 24);
      const next24hRainMm = next24h.reduce((sum, p) => sum + p.precipMm, 0);
      const next24hMaxProbPct = next24h.length ? Math.max(...next24h.map((p) => p.precipProbPct)) : 0;

      const dailyDates: string[] = weatherJson.daily?.time ?? [];
      const daily: DailyPoint[] = dailyDates.map((date, i) => ({
        date,
        weatherCode: weatherJson.daily?.weather_code?.[i] ?? 0,
        tempMaxC: weatherJson.daily?.temperature_2m_max?.[i] ?? 0,
        tempMinC: weatherJson.daily?.temperature_2m_min?.[i] ?? 0,
        apparentMaxC: weatherJson.daily?.apparent_temperature_max?.[i] ?? 0,
        apparentMinC: weatherJson.daily?.apparent_temperature_min?.[i] ?? 0,
        sunrise: weatherJson.daily?.sunrise?.[i] ?? '',
        sunset: weatherJson.daily?.sunset?.[i] ?? '',
        uvMax: weatherJson.daily?.uv_index_max?.[i] ?? 0,
        rainSumMm: weatherJson.daily?.precipitation_sum?.[i] ?? 0,
        precipHours: weatherJson.daily?.precipitation_hours?.[i] ?? 0,
        probMaxPct: weatherJson.daily?.precipitation_probability_max?.[i] ?? 0,
        windMaxKmh: weatherJson.daily?.wind_speed_10m_max?.[i] ?? 0,
        gustMaxKmh: weatherJson.daily?.wind_gusts_10m_max?.[i] ?? 0,
        windDirDeg: weatherJson.daily?.wind_direction_10m_dominant?.[i] ?? 0,
      }));

      const floodDates: string[] = floodJson.daily?.time ?? [];
      const riverDischarge: RiverDischargePoint[] = floodDates.map((date, i) => ({
        date,
        discharge: floodJson.daily?.river_discharge?.[i] ?? 0,
        mean: floodJson.daily?.river_discharge_mean?.[i] ?? 0,
        max: floodJson.daily?.river_discharge_max?.[i] ?? 0,
      }));

      const tempC = weatherJson.current?.temperature_2m ?? 0;
      const humidityPct = weatherJson.current?.relative_humidity_2m ?? 0;
      const heatIndexC = computeHeatIndexC(tempC, humidityPct);

      const nextData: DetailedWeatherData = {
        elevationM: weatherJson.elevation ?? 25,
        current: {
          time: weatherJson.current?.time ?? '',
          tempC,
          humidityPct,
          apparentC: weatherJson.current?.apparent_temperature ?? tempC,
          isDay: Boolean(weatherJson.current?.is_day ?? 1),
          precipMm: weatherJson.current?.precipitation ?? 0,
          rainMm: weatherJson.current?.rain ?? 0,
          weatherCode: weatherJson.current?.weather_code ?? 0,
          cloudCoverPct: weatherJson.current?.cloud_cover ?? 0,
          pressureMslHpa: weatherJson.current?.pressure_msl ?? 0,
          windKmh: weatherJson.current?.wind_speed_10m ?? 0,
          windDirDeg: weatherJson.current?.wind_direction_10m ?? 0,
          gustKmh: weatherJson.current?.wind_gusts_10m ?? 0,
          heatIndexC,
          heatTier: classifyPagasaHeatIndex(heatIndexC),
        },
        airQuality: {
          usAqi: aqiJson?.current?.us_aqi ?? null,
          pm25: aqiJson?.current?.pm2_5 ?? null,
          pm10: aqiJson?.current?.pm10 ?? null,
          uvIndexNow: aqiJson?.current?.uv_index ?? hourly[0]?.uvIndex ?? null,
        },
        next24hRainMm,
        next24hMaxProbPct,
        hourly,
        daily,
        riverDischarge,
      };
      const fetchedLabel = new Date().toLocaleTimeString('en-PH', {
        hour: '2-digit',
        minute: '2-digit',
      });
      setData(nextData);
      setLastFetched(fetchedLabel);
      writeCachedWeather(nextData, fetchedLabel);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to fetch weather data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  return { data, loading, error, lastFetched, refresh: fetchAll };
}
