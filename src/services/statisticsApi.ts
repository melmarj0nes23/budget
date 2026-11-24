import { API_CONFIG, VERIFIED_STATS_DATASETS } from '../config/constants';
import type {
  FetchEnvelope,
  ProvincialPovertyRecord,
  PsgcListResponse,
  PsgcMunicipalityRecord,
  PsgcProvinceRecord,
  PsgcRegionsResponse,
  StatsCoverage,
  StatsDatasetDetail,
  StatsDatasetSummary,
  StatsQueryResponse,
} from '../types/budget';
import { cleanPsaGeoLabel, fixMojibake, normalizeGeoName, parseCommaInt } from '../utils/formatting';
import { cacheService } from './cacheService';

const TTL_STATS_MS = 12 * 60 * 60 * 1000; // 12 hours (saved PSA OpenSTAT snapshots)
const TTL_SEARCH_MS = 60 * 60 * 1000; // 1 hour

const inflight = new Map<string, Promise<FetchEnvelope<unknown>>>();

async function fetchStatsJson<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 16_000);
  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
    });
    window.clearTimeout(timeoutId);

    if (!response.ok) {
      let msg = `HTTP ${response.status}`;
      try {
        const body = (await response.json()) as { error?: { message?: string }; detail?: string };
        msg = body?.error?.message ?? body?.detail ?? msg;
      } catch {
        // Ignore parse failures
      }
      throw new Error(`Philippine Data Explorer API error (${msg})`);
    }
    return (await response.json()) as T;
  } catch (err) {
    window.clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request to Philippine Data Explorer API timed out.');
    }
    throw err instanceof Error ? err : new Error('Network error reaching Statistics API.');
  }
}

async function cachedStatsRequest<T>(
  cacheKey: string,
  url: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
  forceRefresh = false
): Promise<FetchEnvelope<T>> {
  const fullCacheKey = `stats:${cacheKey}`;
  if (!forceRefresh) {
    const fresh = cacheService.getFresh<T>(fullCacheKey);
    if (fresh) {
      return {
        data: fresh.data,
        fetchedAt: fresh.fetchedAt,
        origin: 'cache',
        sourceUrl: url,
      };
    }
  }

  const existing = inflight.get(fullCacheKey);
  if (existing) {
    return existing as Promise<FetchEnvelope<T>>;
  }

  const promise = (async (): Promise<FetchEnvelope<T>> => {
    try {
      const data = await fetcher();
      const entry = cacheService.set(fullCacheKey, data, ttlMs, url);
      return {
        data,
        fetchedAt: entry.fetchedAt,
        origin: 'live',
        sourceUrl: url,
      };
    } catch (err) {
      const stale = cacheService.getAny<T>(fullCacheKey);
      if (stale) {
        return {
          data: stale.data,
          fetchedAt: stale.fetchedAt,
          origin: 'stale-cache',
          sourceUrl: url,
          warning:
            err instanceof Error
              ? `Statistics API temporarily unavailable (${err.message}). Showing cached data.`
              : 'Statistics API temporarily unavailable. Showing cached data.',
        };
      }
      throw err;
    }
  })().finally(() => {
    inflight.delete(fullCacheKey);
  });

  inflight.set(fullCacheKey, promise as Promise<FetchEnvelope<unknown>>);
  return promise;
}

export interface NationalPopulationSeries {
  datasetId: string;
  title: string;
  sourceUrl: string;
  sourceUpdated: string | null;
  release: string;
  unitNote: string;
  byYear: Record<number, number>; // Exact persons (raw thousands * 1000)
}

export interface RegionalPopulationRecord {
  regCode: string; // 2-digit e.g. "01", "13", "18", "19"
  psgcCode: string;
  areaName: string;
  islandGroup: string;
  pop2015: number | null;
  pop2020: number | null;
  pop2024: number | null;
}

export interface RegionalPovertyRecord {
  regCode: string;
  label: string;
  povertyIncidence2018: number | null;
  povertyIncidence2021: number | null;
  povertyIncidence2023: number | null;
  povertyThreshold2023: number | null; // Annual per capita poverty threshold in PHP
}

export interface RegionalPovertyBundle {
  datasetId: string;
  title: string;
  sourceUrl: string;
  sourceUpdated: string | null;
  release: string;
  national: {
    povertyIncidence2018: number | null;
    povertyIncidence2021: number | null;
    povertyIncidence2023: number | null;
    povertyThreshold2023: number | null;
  };
  byRegion: Record<string, RegionalPovertyRecord>;
}

export interface RegionalUnemploymentBundle {
  datasetId: string;
  title: string;
  sourceUrl: string;
  sourceUpdated: string | null;
  release: string;
  referenceYear: number;
  nationalRate: number | null;
  byRegion: Record<string, { regCode: string; label: string; rate: number | null }>;
}

export const statisticsApi = {
  getCoverage(forceRefresh = false): Promise<FetchEnvelope<StatsCoverage>> {
    const url = `${API_CONFIG.statsBaseUrl}/coverage`;
    return cachedStatsRequest(
      'coverage',
      url,
      TTL_STATS_MS,
      async () => {
        const res = await fetchStatsJson<{ data: StatsCoverage }>(url);
        return res.data;
      },
      forceRefresh
    );
  },

  /**
   * Fetches official PSA single-year projected national population (2020–2027, based on 2020 CPH).
   * Explicitly converts values reported in thousands to exact persons.
   */
  getNationalPopulationSeries(
    forceRefresh = false
  ): Promise<FetchEnvelope<NationalPopulationSeries>> {
    const cfg = VERIFIED_STATS_DATASETS.nationalProjectedPopulation;
    const metaUrl = `${API_CONFIG.statsBaseUrl}/datasets/${cfg.id}`;
    const queryUrl = `${metaUrl}/query`;

    return cachedStatsRequest(
      `national-pop-${cfg.id}`,
      metaUrl,
      TTL_STATS_MS,
      async () => {
        const metaRes = await fetchStatsJson<{ data: StatsDatasetDetail }>(metaUrl);
        const dataset = metaRes.data;
        const yearCodes = Object.values(cfg.yearCodeMap);

        const qRes = await fetchStatsJson<StatsQueryResponse>(queryUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            release: dataset.release,
            selection: {
              Sex: [cfg.sexTotalCode],
              'Age Group': [cfg.ageTotalCode],
              Year: yearCodes,
            },
          }),
        });

        const byYear: Record<number, number> = {};
        for (const row of qRes.data.rows) {
          const yearNum = Number(row.labels[2]);
          if (Number.isFinite(yearNum) && typeof row.value === 'number' && Number.isFinite(row.value)) {
            byYear[yearNum] = Math.round(row.value * cfg.unitMultiplier);
          }
        }

        return {
          datasetId: dataset.id,
          title: dataset.title,
          sourceUrl: qRes.data.source || dataset.source,
          sourceUpdated: qRes.data.sourceUpdated ?? dataset.sourceUpdated,
          release: qRes.data.release,
          unitNote: cfg.unitLabel,
          byYear,
        };
      },
      forceRefresh
    );
  },

  /**
   * Fetches official PSGC Q2 2024 regions (all 18 Philippine regions including NIR)
   * with embedded 2015, 2020, and 2024 PSA Census population figures.
   */
  getPsgcRegionalPopulations(
    forceRefresh = false
  ): Promise<FetchEnvelope<{ regions: RegionalPopulationRecord[]; totalPop2024: number }>> {
    const url = `${API_CONFIG.statsClassificationUrl}/psgc/Q2_2024/regions`;
    return cachedStatsRequest(
      'psgc-q2-2024-regions',
      url,
      TTL_STATS_MS * 2,
      async () => {
        const res = await fetchStatsJson<PsgcRegionsResponse>(url);
        const regions: RegionalPopulationRecord[] = (res.results || []).map((item) => {
          const regCode = String(item.reg).padStart(2, '0');
          const findPop = (yr: number) =>
            parseCommaInt(item.populations?.find((p) => p.year === yr)?.population);
          return {
            regCode,
            psgcCode: item.code,
            areaName: item.area_name,
            islandGroup: item.island_region || 'Philippines',
            pop2015: findPop(2015),
            pop2020: findPop(2020),
            pop2024: findPop(2024),
          };
        });
        const totalPop2024 = regions.reduce((sum, r) => sum + (r.pop2024 ?? 0), 0);
        return { regions, totalPop2024 };
      },
      forceRefresh
    );
  },

  /**
   * Fetches PSA Full-Year Poverty Incidence Among Population (%) and Annual Per Capita Poverty Threshold (PHP)
   * for 2018, 2021, and 2023 across Philippines and all 18 regions including NIR.
   */
  getRegionalPoverty(forceRefresh = false): Promise<FetchEnvelope<RegionalPovertyBundle>> {
    const cfg = VERIFIED_STATS_DATASETS.povertyPopulationByRegion;
    const metaUrl = `${API_CONFIG.statsBaseUrl}/datasets/${cfg.id}`;
    const queryUrl = `${metaUrl}/query`;

    return cachedStatsRequest(
      `regional-poverty-${cfg.id}`,
      metaUrl,
      TTL_STATS_MS,
      async () => {
        const metaRes = await fetchStatsJson<{ data: StatsDatasetDetail }>(metaUrl);
        const dataset = metaRes.data;
        const geoCodes = [cfg.nationalGeoCode, ...Object.values(cfg.regionToGeoCode)];
        const geoToReg = new Map<string, string>();
        for (const [reg, geo] of Object.entries(cfg.regionToGeoCode)) {
          geoToReg.set(geo, reg);
        }

        const qRes = await fetchStatsJson<StatsQueryResponse>(queryUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            release: dataset.release,
            selection: {
              Geolocation: geoCodes,
              Parameters: [cfg.parameterThresholdCode, cfg.parameterIncidenceCode],
              Year: [cfg.yearCodes[2018], cfg.yearCodes[2021], cfg.yearCodes[2023]],
            },
          }),
        });

        const national = {
          povertyIncidence2018: null as number | null,
          povertyIncidence2021: null as number | null,
          povertyIncidence2023: null as number | null,
          povertyThreshold2023: null as number | null,
        };
        const byRegion: Record<string, RegionalPovertyRecord> = {};

        for (const row of qRes.data.rows) {
          const [geoCode, paramCode, yearCode] = row.codes;
          const val = typeof row.value === 'number' && Number.isFinite(row.value) ? row.value : null;

          if (geoCode === cfg.nationalGeoCode) {
            if (paramCode === cfg.parameterIncidenceCode) {
              if (yearCode === cfg.yearCodes[2018]) national.povertyIncidence2018 = val;
              if (yearCode === cfg.yearCodes[2021]) national.povertyIncidence2021 = val;
              if (yearCode === cfg.yearCodes[2023]) national.povertyIncidence2023 = val;
            } else if (paramCode === cfg.parameterThresholdCode && yearCode === cfg.yearCodes[2023]) {
              national.povertyThreshold2023 = val;
            }
            continue;
          }

          const regCode = geoToReg.get(geoCode);
          if (!regCode) continue;
          if (!byRegion[regCode]) {
            byRegion[regCode] = {
              regCode,
              label: row.labels[0]?.replace(/^\.+/, '').trim() || regCode,
              povertyIncidence2018: null,
              povertyIncidence2021: null,
              povertyIncidence2023: null,
              povertyThreshold2023: null,
            };
          }
          if (paramCode === cfg.parameterIncidenceCode) {
            if (yearCode === cfg.yearCodes[2018]) byRegion[regCode].povertyIncidence2018 = val;
            if (yearCode === cfg.yearCodes[2021]) byRegion[regCode].povertyIncidence2021 = val;
            if (yearCode === cfg.yearCodes[2023]) byRegion[regCode].povertyIncidence2023 = val;
          } else if (paramCode === cfg.parameterThresholdCode && yearCode === cfg.yearCodes[2023]) {
            byRegion[regCode].povertyThreshold2023 = val;
          }
        }

        return {
          datasetId: dataset.id,
          title: dataset.title,
          sourceUrl: qRes.data.source || dataset.source,
          sourceUpdated: qRes.data.sourceUpdated ?? dataset.sourceUpdated,
          release: qRes.data.release,
          national,
          byRegion,
        };
      },
      forceRefresh
    );
  },

  /**
   * Fetches PSA SDG 8.5.2 Unemployment Rate (%) for 2025 (15 years old and over, both sexes).
   * Explicitly preserves null/unavailable for NIR (17-region series).
   */
  getRegionalUnemployment(
    forceRefresh = false
  ): Promise<FetchEnvelope<RegionalUnemploymentBundle>> {
    const cfg = VERIFIED_STATS_DATASETS.unemploymentByRegion;
    const metaUrl = `${API_CONFIG.statsBaseUrl}/datasets/${cfg.id}`;
    const queryUrl = `${metaUrl}/query`;

    return cachedStatsRequest(
      `regional-unemployment-${cfg.id}`,
      metaUrl,
      TTL_STATS_MS,
      async () => {
        const metaRes = await fetchStatsJson<{ data: StatsDatasetDetail }>(metaUrl);
        const dataset = metaRes.data;
        const geoCodes = [cfg.nationalGeoCode, ...Object.values(cfg.regionToGeoCode)];
        const geoToReg = new Map<string, string>();
        for (const [reg, geo] of Object.entries(cfg.regionToGeoCode)) {
          geoToReg.set(geo, reg);
        }

        const qRes = await fetchStatsJson<StatsQueryResponse>(queryUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            release: dataset.release,
            selection: {
              'Age Group': [cfg.ageAllCode],
              Sex: [cfg.sexBothCode],
              Geolocation: geoCodes,
              Year: [cfg.yearCode2025],
            },
          }),
        });

        let nationalRate: number | null = null;
        const byRegion: Record<string, { regCode: string; label: string; rate: number | null }> = {};

        for (const row of qRes.data.rows) {
          const geoCode = row.codes[2];
          const val = typeof row.value === 'number' && Number.isFinite(row.value) ? row.value : null;
          if (geoCode === cfg.nationalGeoCode) {
            nationalRate = val;
            continue;
          }
          const regCode = geoToReg.get(geoCode);
          if (!regCode) continue;
          byRegion[regCode] = {
            regCode,
            label: row.labels[2]?.replace(/^\.+/, '').trim() || regCode,
            rate: val,
          };
        }

        return {
          datasetId: dataset.id,
          title: dataset.title,
          sourceUrl: qRes.data.source || dataset.source,
          sourceUpdated: qRes.data.sourceUpdated ?? dataset.sourceUpdated,
          release: qRes.data.release,
          referenceYear: 2025,
          nationalRate,
          byRegion,
        };
      },
      forceRefresh
    );
  },

  searchDatasets(query: string, limit = 10): Promise<FetchEnvelope<StatsDatasetSummary[]>> {
    const clean = query.trim();
    const qs = new URLSearchParams({
      q: clean,
      ready: 'true',
      sort: 'year-desc',
      limit: String(limit),
    });
    const url = `${API_CONFIG.statsBaseUrl}/datasets?${qs.toString()}`;
    return cachedStatsRequest(
      `search:${clean.toLowerCase()}:${limit}`,
      url,
      TTL_SEARCH_MS,
      async () => {
        const res = await fetchStatsJson<{ data: StatsDatasetSummary[] }>(url);
        return res.data || [];
      }
    );
  },

  /**
   * Fetches all 117 Philippine provinces, HUCs, and special areas from PSGC Q2 2024
   * with embedded 2015, 2020, and 2024 PSA Census populations and income classes.
   */
  getPsgcProvinces(forceRefresh = false): Promise<FetchEnvelope<PsgcProvinceRecord[]>> {
    const url = `${API_CONFIG.statsClassificationUrl}/psgc/Q2_2024/provinces`;
    return cachedStatsRequest(
      'psgc-q2-2024-provinces',
      url,
      TTL_STATS_MS * 2,
      async () => {
        const res = await fetchStatsJson<PsgcListResponse>(url);
        return (res.results || [])
          .map((item): PsgcProvinceRecord => {
            const findPop = (yr: number) =>
              parseCommaInt(item.populations?.find((p) => p.year === yr)?.population);
            const geoLevel: 'Prov' | 'City' | 'Other' =
              item.geographic_level === 'Prov'
                ? 'Prov'
                : item.geographic_level === 'City'
                  ? 'City'
                  : 'Other';
            return {
              code: item.code,
              areaName: fixMojibake(item.area_name),
              regCode: String(item.reg).padStart(2, '0'),
              reg: item.reg,
              prv: item.prv,
              geoLevel,
              incomeClass: item.income_classification?.trim() || '',
              islandGroup: item.island_region || 'Philippines',
              pop2015: findPop(2015),
              pop2020: findPop(2020),
              pop2024: findPop(2024),
            };
          })
          .sort((a, b) => a.areaName.localeCompare(b.areaName));
      },
      forceRefresh
    );
  },

  /**
   * Fetches cities & municipalities for a single province using server-side ?reg=&prv= filtering.
   */
  getPsgcMunicipalities(
    reg: number,
    prv: number,
    forceRefresh = false
  ): Promise<FetchEnvelope<PsgcMunicipalityRecord[]>> {
    const url = `${API_CONFIG.statsClassificationUrl}/psgc/Q2_2024/municipalities?reg=${reg}&prv=${prv}`;
    return cachedStatsRequest(
      `psgc-q2-2024-muns-${reg}-${prv}`,
      url,
      TTL_STATS_MS * 2,
      async () => {
        const res = await fetchStatsJson<PsgcListResponse>(url);
        return (res.results || [])
          .map((item): PsgcMunicipalityRecord => {
            const findPop = (yr: number) =>
              parseCommaInt(item.populations?.find((p) => p.year === yr)?.population);
            return {
              code: item.code,
              areaName: fixMojibake(item.area_name),
              regCode: String(item.reg).padStart(2, '0'),
              reg: item.reg,
              prv: item.prv,
              mun: item.mun,
              geoLevel: item.geographic_level || 'Mun',
              cityClass: item.city_class?.trim() || '',
              incomeClass: item.income_classification?.trim() || '',
              pop2015: findPop(2015),
              pop2020: findPop(2020),
              pop2024: findPop(2024),
            };
          })
          .sort((a, b) => a.areaName.localeCompare(b.areaName));
      },
      forceRefresh
    );
  },

  /**
   * Fetches all 108 geolocation rows (Philippines, 18 regions, provinces, NCR districts, and HUCs)
   * from PSA Table 2 (2018, 2021, 2023 Full-Year Poverty Incidence & Threshold).
   */
  getAllProvincialPoverty(forceRefresh = false): Promise<
    FetchEnvelope<{
      datasetId: string;
      sourceUrl: string;
      sourceUpdated: string | null;
      records: ProvincialPovertyRecord[];
    }>
  > {
    const cfg = VERIFIED_STATS_DATASETS.povertyPopulationByRegion;
    const metaUrl = `${API_CONFIG.statsBaseUrl}/datasets/${cfg.id}`;
    const queryUrl = `${metaUrl}/query`;

    return cachedStatsRequest(
      `provincial-poverty-all-${cfg.id}`,
      metaUrl,
      TTL_STATS_MS,
      async () => {
        const metaRes = await fetchStatsJson<{ data: StatsDatasetDetail }>(metaUrl);
        const dataset = metaRes.data;
        const geoDim = dataset.dimensions.find((d) => d.code === 'Geolocation');
        const geoCount = geoDim?.count ?? 108;
        const allGeoCodes = Array.from({ length: geoCount }, (_, i) => String(i));

        const qRes = await fetchStatsJson<StatsQueryResponse>(queryUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            release: dataset.release,
            selection: {
              Geolocation: allGeoCodes,
              Parameters: [cfg.parameterThresholdCode, cfg.parameterIncidenceCode],
              Year: [cfg.yearCodes[2018], cfg.yearCodes[2021], cfg.yearCodes[2023]],
            },
          }),
        });

        const byGeo = new Map<string, ProvincialPovertyRecord>();
        for (const row of qRes.data.rows) {
          const [geoCode, paramCode, yearCode] = row.codes;
          const val = typeof row.value === 'number' && Number.isFinite(row.value) ? row.value : null;
          let rec = byGeo.get(geoCode);
          if (!rec) {
            const rawLabel = row.labels[0] || geoCode;
            const cleanName = cleanPsaGeoLabel(rawLabel);
            rec = {
              geoCode,
              rawLabel,
              cleanName,
              normalizedKey: normalizeGeoName(rawLabel),
              povertyIncidence2018: null,
              povertyIncidence2021: null,
              povertyIncidence2023: null,
              povertyThreshold2023: null,
            };
            byGeo.set(geoCode, rec);
          }

          if (paramCode === cfg.parameterIncidenceCode) {
            if (yearCode === cfg.yearCodes[2018]) rec.povertyIncidence2018 = val;
            if (yearCode === cfg.yearCodes[2021]) rec.povertyIncidence2021 = val;
            if (yearCode === cfg.yearCodes[2023]) rec.povertyIncidence2023 = val;
          } else if (paramCode === cfg.parameterThresholdCode && yearCode === cfg.yearCodes[2023]) {
            rec.povertyThreshold2023 = val;
          }
        }

        return {
          datasetId: dataset.id,
          sourceUrl: qRes.data.source || dataset.source,
          sourceUpdated: qRes.data.sourceUpdated ?? dataset.sourceUpdated,
          records: Array.from(byGeo.values()),
        };
      },
      forceRefresh
    );
  },

  clearCache(): void {
    cacheService.invalidatePrefix('stats:');
  },
};
