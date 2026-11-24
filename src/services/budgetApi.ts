import { API_CONFIG } from '../config/constants';
import type {
  BudgetCycleResponse,
  FetchEnvelope,
  GaaDepartmentDetailResponse,
  GaaDepartmentsResponse,
  GaaExpenseClassesResponse,
  GaaNationalResponse,
  GaaObjectsResponse,
  GaaProgramsResponse,
  GaaSearchResponse,
  HgabDatasetKey,
  HgabDistrictDetailResponse,
  HgabDistrictListResponse,
  HgabProjectsResponse,
  NepDepartmentDetailResponse,
  NepOverviewResponse,
  NepRollupResponse,
} from '../types/budget';
import { cacheService } from './cacheService';

const TTL_CORE_MS = 6 * 60 * 60 * 1000; // 6 hours
const TTL_DETAIL_MS = 2 * 60 * 60 * 1000; // 2 hours
const TTL_SEARCH_MS = 30 * 60 * 1000; // 30 minutes

const inflight = new Map<string, Promise<FetchEnvelope<unknown>>>();

// Lightweight request queue (max 2 concurrent, gentle spacing) to respect BetterGovPH D1 limits
let activeCount = 0;
const queue: Array<() => void> = [];
let lastDispatchTs = 0;

async function scheduleBudgetTask<T>(task: () => Promise<T>): Promise<T> {
  if (activeCount >= 2) {
    await new Promise<void>((resolve) => queue.push(resolve));
  }
  activeCount += 1;
  try {
    const now = Date.now();
    const waitMs = Math.max(0, 180 - (now - lastDispatchTs));
    if (waitMs > 0) {
      await new Promise((r) => setTimeout(r, waitMs));
    }
    lastDispatchTs = Date.now();
    return await task();
  } finally {
    activeCount -= 1;
    const next = queue.shift();
    if (next) next();
  }
}

async function fetchJsonWithRetry<T>(url: string, retries = 2): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 16_000);
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      window.clearTimeout(timeoutId);

      if (response.ok) {
        const json = (await response.json()) as T;
        if (json === null || typeof json !== 'object') {
          throw new Error('Received malformed JSON response from Budget API.');
        }
        return json;
      }

      // Retry transient overload/rate-limit errors (e.g. D1_ERROR 500 or 429/503)
      const isRetryable = response.status === 429 || response.status >= 500;
      let detail = `HTTP ${response.status}`;
      try {
        const errBody = (await response.json()) as { message?: string; error?: string };
        if (errBody?.message) detail = errBody.message;
      } catch {
        // Ignore parse error on non-JSON error body
      }
      lastError = new Error(`Philippine Budget API error (${detail})`);

      if (!isRetryable || attempt === retries) {
        throw lastError;
      }
      await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
    } catch (err) {
      window.clearTimeout(timeoutId);
      const errorObj =
        err instanceof Error
          ? err.name === 'AbortError'
            ? new Error('Request to Philippine Budget API timed out.')
            : err
          : new Error('Network error reaching Philippine Budget API.');
      lastError = errorObj;
      if (attempt === retries) {
        throw lastError;
      }
      await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
    }
  }

  throw lastError ?? new Error('Unable to reach Philippine Budget API.');
}

async function cachedBudgetGet<T>(
  path: string,
  ttlMs: number,
  options?: { forceRefresh?: boolean }
): Promise<FetchEnvelope<T>> {
  const cacheKey = `budget:${path}`;
  const url = `${API_CONFIG.budgetBaseUrl}${path}`;

  if (!options?.forceRefresh) {
    const fresh = cacheService.getFresh<T>(cacheKey);
    if (fresh) {
      return {
        data: fresh.data,
        fetchedAt: fresh.fetchedAt,
        origin: 'cache',
        sourceUrl: url,
      };
    }
  }

  const existing = inflight.get(cacheKey);
  if (existing) {
    return existing as Promise<FetchEnvelope<T>>;
  }

  const promise = scheduleBudgetTask(async (): Promise<FetchEnvelope<T>> => {
    try {
      const data = await fetchJsonWithRetry<T>(url);
      const entry = cacheService.set(cacheKey, data, ttlMs, url);
      return {
        data,
        fetchedAt: entry.fetchedAt,
        origin: 'live',
        sourceUrl: url,
      };
    } catch (err) {
      const stale = cacheService.getAny<T>(cacheKey);
      if (stale) {
        return {
          data: stale.data,
          fetchedAt: stale.fetchedAt,
          origin: 'stale-cache',
          sourceUrl: url,
          warning:
            err instanceof Error
              ? `Live API temporarily unavailable (${err.message}). Showing previously cached figures.`
              : 'Live API temporarily unavailable. Showing previously cached figures.',
        };
      }
      throw err;
    }
  }).finally(() => {
    inflight.delete(cacheKey);
  });

  inflight.set(cacheKey, promise as Promise<FetchEnvelope<unknown>>);
  return promise;
}

export const budgetApi = {
  getGaaNational(forceRefresh = false): Promise<FetchEnvelope<GaaNationalResponse>> {
    return cachedBudgetGet<GaaNationalResponse>('/gaa', TTL_CORE_MS, { forceRefresh });
  },

  getGaaDepartments(forceRefresh = false): Promise<FetchEnvelope<GaaDepartmentsResponse>> {
    return cachedBudgetGet<GaaDepartmentsResponse>('/gaa/departments', TTL_CORE_MS, {
      forceRefresh,
    });
  },

  getGaaDepartmentDetail(
    id: string,
    forceRefresh = false
  ): Promise<FetchEnvelope<GaaDepartmentDetailResponse>> {
    return cachedBudgetGet<GaaDepartmentDetailResponse>(
      `/gaa/departments/${encodeURIComponent(id)}`,
      TTL_DETAIL_MS,
      { forceRefresh }
    );
  },

  getGaaDepartmentExpenseClasses(
    id: string,
    forceRefresh = false
  ): Promise<FetchEnvelope<GaaExpenseClassesResponse>> {
    return cachedBudgetGet<GaaExpenseClassesResponse>(
      `/gaa/departments/${encodeURIComponent(id)}/expense-classes`,
      TTL_DETAIL_MS,
      { forceRefresh }
    );
  },

  getGaaDepartmentPrograms(
    id: string,
    params: { year: number; q?: string; agencyId?: string; limit?: number; cursor?: string }
  ): Promise<FetchEnvelope<GaaProgramsResponse>> {
    const qs = new URLSearchParams();
    qs.set('year', String(params.year));
    qs.set('limit', String(params.limit ?? 20));
    if (params.q && params.q.trim()) qs.set('q', params.q.trim());
    if (params.agencyId) qs.set('agency_id', params.agencyId);
    if (params.cursor) qs.set('cursor', params.cursor);

    return cachedBudgetGet<GaaProgramsResponse>(
      `/gaa/departments/${encodeURIComponent(id)}/programs?${qs.toString()}`,
      TTL_DETAIL_MS
    );
  },

  getGaaDepartmentObjects(
    id: string,
    params: {
      year: number;
      q?: string;
      agencyId?: string;
      expenseClass?: string;
      sort?: 'amount' | 'description';
      dir?: 'asc' | 'desc';
      limit?: number;
      cursor?: string;
    }
  ): Promise<FetchEnvelope<GaaObjectsResponse>> {
    const qs = new URLSearchParams();
    qs.set('year', String(params.year));
    qs.set('limit', String(params.limit ?? 20));
    qs.set('sort', params.sort ?? 'amount');
    qs.set('dir', params.dir ?? 'desc');
    if (params.q && params.q.trim()) qs.set('q', params.q.trim());
    if (params.agencyId) qs.set('agency_id', params.agencyId);
    if (params.expenseClass) qs.set('expense_class', params.expenseClass);
    if (params.cursor) qs.set('cursor', params.cursor);

    return cachedBudgetGet<GaaObjectsResponse>(
      `/gaa/departments/${encodeURIComponent(id)}/objects?${qs.toString()}`,
      TTL_DETAIL_MS
    );
  },

  searchGaaPrograms(params: {
    q: string;
    year?: number;
    departmentId?: string;
    limit?: number;
  }): Promise<FetchEnvelope<GaaSearchResponse>> {
    const qs = new URLSearchParams();
    qs.set('q', params.q.trim());
    if (params.year) qs.set('year', String(params.year));
    if (params.departmentId) qs.set('department_id', params.departmentId);
    qs.set('limit', String(params.limit ?? 25));

    return cachedBudgetGet<GaaSearchResponse>(`/gaa/search?${qs.toString()}`, TTL_SEARCH_MS);
  },

  getNep2027Overview(forceRefresh = false): Promise<FetchEnvelope<NepOverviewResponse>> {
    return cachedBudgetGet<NepOverviewResponse>('/nep/2027', TTL_CORE_MS, { forceRefresh });
  },

  getNep2027DepartmentDetail(
    id: string,
    forceRefresh = false
  ): Promise<FetchEnvelope<NepDepartmentDetailResponse>> {
    return cachedBudgetGet<NepDepartmentDetailResponse>(
      `/nep/2027/departments/${encodeURIComponent(id)}`,
      TTL_DETAIL_MS,
      { forceRefresh }
    );
  },

  getNep2027Rollup(
    dimension: 'region' | 'expense_class' | 'fund' | 'agency' | 'program',
    forceRefresh = false
  ): Promise<FetchEnvelope<NepRollupResponse>> {
    return cachedBudgetGet<NepRollupResponse>(
      `/nep/2027/rollups/${dimension}?limit=200`,
      TTL_CORE_MS,
      { forceRefresh }
    );
  },

  getBudgetCycleOverview(forceRefresh = false): Promise<FetchEnvelope<BudgetCycleResponse>> {
    return cachedBudgetGet<BudgetCycleResponse>('/budget-cycle', TTL_CORE_MS, { forceRefresh });
  },

  searchHgabDistricts(
    params: { q?: string; region?: string; limit?: number },
    forceRefresh = false
  ): Promise<FetchEnvelope<HgabDistrictListResponse>> {
    const qs = new URLSearchParams();
    if (params.q && params.q.trim()) qs.set('q', params.q.trim());
    if (params.region) qs.set('region', params.region);
    qs.set('limit', String(params.limit ?? 30));
    return cachedBudgetGet<HgabDistrictListResponse>(
      `/hgab/2027/districts?${qs.toString()}`,
      TTL_DETAIL_MS,
      { forceRefresh }
    );
  },

  getHgabDistrictDetail(
    districtId: string,
    forceRefresh = false
  ): Promise<FetchEnvelope<HgabDistrictDetailResponse>> {
    return cachedBudgetGet<HgabDistrictDetailResponse>(
      `/hgab/2027/districts/${encodeURIComponent(districtId)}`,
      TTL_DETAIL_MS,
      { forceRefresh }
    );
  },

  getHgabProjects(
    dataset: HgabDatasetKey,
    params: { q?: string; region?: string; limit?: number; offset?: number },
    forceRefresh = false
  ): Promise<FetchEnvelope<HgabProjectsResponse>> {
    const qs = new URLSearchParams();
    if (params.q && params.q.trim()) qs.set('q', params.q.trim());
    if (params.region) qs.set('region', params.region);
    qs.set('limit', String(params.limit ?? 15));
    if (params.offset && params.offset > 0) qs.set('offset', String(params.offset));
    return cachedBudgetGet<HgabProjectsResponse>(
      `/hgab/2027/datasets/${dataset}/projects?${qs.toString()}`,
      TTL_SEARCH_MS,
      { forceRefresh }
    );
  },

  clearCache(): void {
    cacheService.invalidatePrefix('budget:');
  },
};
