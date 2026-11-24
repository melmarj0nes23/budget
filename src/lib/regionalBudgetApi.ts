import psgcDirectory from '../data/psgcDirectory.json';

export type DatasetKey = 'dpwh' | 'fmr' | 'hfep' | 'nia';

export interface PsgcProvince {
  code: string;
  psgc10: string;
  name: string;
  regionCode: string;
  regionName: string;
}

export interface PsgcMunicipality {
  psgc: string;
  name: string;
  searchName: string;
  isCity: boolean;
  provinceCode: string;
  provinceName: string;
  regionCode: string;
  regionName: string;
}

export interface RegionalProjectRow {
  id: string;
  dataset: DatasetKey;
  title: string;
  program: string | null;
  pap: string | null;
  office: string | null;
  region: string | null;
  regionKey: string | null;
  status: string;
  statusLabel: string;
  nepPhp: number | null;
  housePhp: number | null;
  deltaPhp: number | null;
  nepPdfUrl: string | null;
  housePdfUrl: string | null;
  detailUrl: string | null;
}

export interface RegionalGaaRow {
  famKey: string;
  name: string;
  department: string;
  years: Record<string, number>;
}

export interface GaaDepartmentSummary {
  id: string;
  slug: string;
  description: string;
  years: Record<string, { count: number; amount: number }>;
}

export interface RegionalBudgetResult {
  scopeLabel: string;
  scopeKind: 'province' | 'city' | 'municipality';
  regionLabel: string;
  offices: string[];
  projects: RegionalProjectRow[];
  gaaRecords: RegionalGaaRow[];
  gaaDepartments?: GaaDepartmentSummary[];
  notice: string;
  truncatedProjects: boolean;
  summaryTotals?: {
    nep: number;
    house: number;
    delta: number;
    totalLines: number;
  };
}

const API_BASE = 'https://budget.bettergov.ph/api/v1';

const REGION_KEY_MAP: Record<string, string> = {
  'Region I': 'I',
  'Region II': 'II',
  'Region III': 'III',
  'Region IV-A': 'IV-A',
  'MIMAROPA Region': 'IV-B',
  'Region V': 'V',
  'Region VI': 'VI',
  'Region VII': 'VII',
  'Region VIII': 'VIII',
  'Region IX': 'IX',
  'Region X': 'X',
  'Region XI': 'XI',
  'Region XII': 'XII',
  'Region XIII': 'XIII',
  NCR: 'NCR',
  'Cordillera Administrative Region': 'CAR',
  'Bangsamoro Autonomous Region in Muslim Mindanao': 'BARMM',
};

export const PSGC_PROVINCES: PsgcProvince[] = [...psgcDirectory.provinces].sort((a, b) =>
  a.name.localeCompare(b.name, 'en')
);

export const PSGC_MUNICIPALITIES: PsgcMunicipality[] = [...psgcDirectory.municipalities].sort(
  (a, b) => a.name.localeCompare(b.name, 'en')
);

const responseCache = new Map<string, Promise<unknown>>();

async function fetchCachedJson<T>(url: string): Promise<T> {
  let pending = responseCache.get(url) as Promise<T> | undefined;
  if (!pending) {
    pending = (async () => {
      const res = await fetch(url, { headers: { accept: 'application/json' } });
      if (!res.ok) {
        throw new Error(`BetterGov API returned HTTP ${res.status}`);
      }
      return (await res.json()) as T;
    })();
    pending.catch(() => responseCache.delete(url));
    responseCache.set(url, pending);
  }
  return pending;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesWholeWords(text: string, query: string): boolean {
  const tokens = query
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return true;
  return tokens.every((tok) => new RegExp(`\\b${escapeRegExp(tok)}\\b`, 'i').test(text));
}

function cleanProvinceName(name: string): string {
  return name.replace(' (NCR)', '');
}

function mapRawProject(raw: Record<string, unknown>, fallbackDataset: DatasetKey): RegionalProjectRow {
  const pdfUrl = (raw.pdf_url || {}) as Record<string, string | null | undefined>;
  const nepPhp = typeof raw.nep_php === 'number' ? raw.nep_php : null;
  const housePhp =
    typeof raw.house_php === 'number'
      ? raw.house_php
      : typeof raw.hgab3_php === 'number'
        ? raw.hgab3_php
        : null;
  const deltaPhp = typeof raw.delta_php === 'number' ? raw.delta_php : null;

  return {
    id: String(raw.id || ''),
    dataset: ((raw.dataset as DatasetKey) || fallbackDataset),
    title: String(raw.title || ''),
    program: raw.program ? String(raw.program) : null,
    pap: raw.pap ? String(raw.pap) : null,
    office: raw.office ? String(raw.office) : null,
    region: raw.region ? String(raw.region) : null,
    regionKey: raw.region_key ? String(raw.region_key) : null,
    status: String(raw.status || raw.bridge_group || 'listed'),
    statusLabel: String(raw.status_label || 'Listed'),
    nepPhp,
    housePhp,
    deltaPhp,
    nepPdfUrl: pdfUrl.nep || null,
    housePdfUrl: pdfUrl.hgab3 || pdfUrl.hgab2 || null,
    detailUrl: raw.url ? String(raw.url) : null,
  };
}

function extractProjectRows(res: Record<string, unknown>): Record<string, unknown>[] {
  const data = res.data as Record<string, unknown> | undefined;
  if (!data) return [];
  if (Array.isArray(data.rows)) return data.rows as Record<string, unknown>[];
  const arr = Object.values(data).find(Array.isArray);
  return (arr as Record<string, unknown>[] | undefined) || [];
}

const PAGE_SIZE = 200;
const MAX_ROWS_PER_QUERY = 4000;

async function fetchAllProjectPages(
  ds: DatasetKey,
  extraQuery: string
): Promise<{
  ds: DatasetKey;
  rows: Record<string, unknown>[];
  total: number;
  notice?: string;
  truncated: boolean;
}> {
  const queryPrefix = extraQuery ? `${extraQuery}&` : '';
  const first = await fetchCachedJson<Record<string, unknown>>(
    `${API_BASE}/hgab/2027/datasets/${ds}/projects?${queryPrefix}limit=${PAGE_SIZE}&offset=0`
  );
  const meta = first.meta as { notice?: string; total?: number } | undefined;
  const dataObj = first.data as { total?: number } | undefined;
  const firstRows = extractProjectRows(first);
  const total =
    typeof dataObj?.total === 'number'
      ? dataObj.total
      : typeof meta?.total === 'number'
        ? meta.total
        : firstRows.length;
  const cappedTotal = Math.min(total, MAX_ROWS_PER_QUERY);

  const offsets: number[] = [];
  for (let o = PAGE_SIZE; o < cappedTotal; o += PAGE_SIZE) {
    offsets.push(o);
  }

  const extraPages: Record<string, unknown>[] = [];
  for (let i = 0; i < offsets.length; i += 4) {
    const batch = offsets.slice(i, i + 4).map((offset) =>
      fetchCachedJson<Record<string, unknown>>(
        `${API_BASE}/hgab/2027/datasets/${ds}/projects?${queryPrefix}limit=${PAGE_SIZE}&offset=${offset}`
      )
    );
    extraPages.push(...(await Promise.all(batch)));
  }

  const allRows = [firstRows, ...extraPages.map(extractProjectRows)].flat();
  return {
    ds,
    rows: allRows,
    total,
    notice: meta?.notice,
    truncated: total > MAX_ROWS_PER_QUERY,
  };
}

export async function fetchRegionalBudget(selectionKey: string): Promise<RegionalBudgetResult> {
  const isNationwide = selectionKey === 'all';
  const isProvince = selectionKey.startsWith('prov:');
  let scopeLabel = 'Province of Pangasinan';
  let scopeKind: 'province' | 'city' | 'municipality' = 'province';
  let regionLabel = 'Region I (Ilocos Region)';
  let apiRegion: string | undefined = 'I';
  let searchQ = 'Pangasinan';
  let gaaApiQ = 'Pangasinan';
  const discoveredOffices: string[] = [];

  if (isNationwide) {
    scopeLabel = 'Philippines (Nationwide)';
    scopeKind = 'province';
    regionLabel = 'All Regions (Philippines)';
    apiRegion = undefined;
    searchQ = '';
    gaaApiQ = '';
  } else if (isProvince) {
    const code = selectionKey.slice(5);
    const prov =
      PSGC_PROVINCES.find((p) => p.code === code || p.psgc10 === code) ||
      PSGC_PROVINCES.find((p) => p.name === 'Pangasinan');
    if (prov) {
      const cleanProv = cleanProvinceName(prov.name);
      scopeLabel = prov.name === 'Metro Manila (NCR)' ? 'Metro Manila (NCR)' : `Province of ${prov.name}`;
      scopeKind = 'province';
      regionLabel = `${prov.regionCode} (${prov.regionName})`;
      apiRegion = REGION_KEY_MAP[prov.regionCode];
      searchQ = cleanProv;
      gaaApiQ = cleanProv;

      try {
        const distRes = await fetchCachedJson<{
          data?: {
            districts?: Array<{
              jurisdiction?: string;
              offices?: Array<{ name: string; full_name?: string }>;
            }>;
          };
        }>(`${API_BASE}/hgab/2027/districts?q=${encodeURIComponent(cleanProv)}&limit=25`);
        for (const d of distRes.data?.districts || []) {
          if (
            (d.jurisdiction || '').toLowerCase().includes(cleanProv.toLowerCase()) ||
            cleanProv === 'Metro Manila'
          ) {
            for (const o of d.offices || []) {
              const officeName = o.full_name || o.name;
              if (!discoveredOffices.includes(officeName)) {
                discoveredOffices.push(officeName);
              }
            }
          }
        }
      } catch {
        // Fallback to place-name query if district lookup fails
      }
    }
  } else {
    const muni =
      PSGC_MUNICIPALITIES.find((m) => m.psgc === selectionKey) ||
      PSGC_MUNICIPALITIES.find((m) => m.psgc === '0105504000');
    if (muni) {
      const cleanProv = cleanProvinceName(muni.provinceName);
      scopeLabel = `${muni.name}, ${cleanProv}`;
      scopeKind = muni.isCity ? 'city' : 'municipality';
      regionLabel = `${muni.regionCode} (${muni.regionName})`;
      apiRegion = REGION_KEY_MAP[muni.regionCode];
      searchQ = muni.provinceName === 'Metro Manila (NCR)' ? muni.searchName : `${muni.searchName} ${cleanProv}`;
      gaaApiQ = muni.searchName;
    }
  }

  const datasets: DatasetKey[] = ['dpwh', 'fmr', 'hfep', 'nia'];

  // Do NOT pass &region= to the API: irrigation (NIA) rows omit region and would be dropped.
  // Region filtering happens client-side below, matching transparency-portal's resolveScope().
  const placeQuery = searchQ ? `q=${encodeURIComponent(searchQ)}` : '';
  const placePromises = datasets.map((ds) => fetchAllProjectPages(ds, placeQuery));

  const officePromises = discoveredOffices.map((office) =>
    fetchAllProjectPages('dpwh', `office=${encodeURIComponent(office)}`)
  );

  const gaaYears = [2026, 2025, 2024, 2023, 2022, 2021, 2020];
  const gaaQuery = gaaApiQ ? `q=${encodeURIComponent(gaaApiQ)}&` : '';
  const gaaPromises = gaaYears.map((yr) =>
    fetchCachedJson<{ data?: Array<Record<string, unknown>> }>(
      `${API_BASE}/gaa/search?${gaaQuery}year=${yr}&limit=500`
    ).catch(() => ({ data: [] }))
  );

  const nationwideSummaryPromise = isNationwide
    ? fetchCachedJson<{
        data?: Array<{
          totals?: { nep_php?: number; hgab3_php?: number; hgab2_php?: number };
        }>;
      }>(`${API_BASE}/hgab/2027/datasets`).catch(() => null)
    : Promise.resolve(null);

  const nationwideGaaDeptsPromise = isNationwide
    ? fetchCachedJson<{
        data?: GaaDepartmentSummary[];
      }>(`${API_BASE}/gaa/departments`).catch(() => null)
    : Promise.resolve(null);

  const [projectResponses, gaaResponses, nationwideSummaryRes, nationwideGaaDeptsRes] =
    await Promise.all([
      Promise.all([...placePromises, ...officePromises]),
      Promise.all(gaaPromises),
      nationwideSummaryPromise,
      nationwideGaaDeptsPromise,
    ]);

  let notice =
    'Independent and unofficial reading of published GAA/NEP/House bill documents. Figures are published allocations, not actual spending.';
  let truncatedProjects = false;

  const projectByKey = new Map<string, RegionalProjectRow>();
  for (let i = 0; i < projectResponses.length; i += 1) {
    const { ds, rows, notice: respNotice, truncated } = projectResponses[i];
    if (respNotice) notice = respNotice;
    if (truncated) truncatedProjects = true;

    const isFromOffice = i >= datasets.length;
    for (const raw of rows) {
      const mapped = mapRawProject(raw, ds);
      if (!isFromOffice && searchQ) {
        const haystack = [mapped.title, mapped.program, mapped.pap, mapped.region, mapped.office]
          .filter(Boolean)
          .join(' ');
        if (!matchesWholeWords(haystack, searchQ)) continue;
        if (apiRegion && mapped.regionKey && mapped.regionKey !== apiRegion) continue;
      }
      projectByKey.set(`${mapped.dataset}:${mapped.id}`, mapped);
    }
  }

  const gaaByKey = new Map<string, RegionalGaaRow>();
  for (const res of gaaResponses) {
    for (const item of res.data || []) {
      const name = String(item.name || '');
      if (searchQ && !matchesWholeWords(name, searchQ)) continue;
      const famKey = String(item.fam_key || name);
      const existing = gaaByKey.get(famKey) || {
        famKey,
        name,
        department: String(item.department || 'National Government'),
        years: {},
      };
      const yrs = (item.years || {}) as Record<string, { amount?: number }>;
      for (const [yr, info] of Object.entries(yrs)) {
        if (typeof info?.amount === 'number' && info.amount > 0) {
          existing.years[yr] = info.amount;
        }
      }
      gaaByKey.set(famKey, existing);
    }
  }

  const gaaRecords = Array.from(gaaByKey.values()).filter(
    (g) => Object.keys(g.years).length > 0
  );

  let summaryTotals: RegionalBudgetResult['summaryTotals'];
  if (isNationwide && nationwideSummaryRes?.data?.length) {
    const nep = nationwideSummaryRes.data.reduce(
      (sum, d) => sum + (d.totals?.nep_php || 0),
      0
    );
    const house = nationwideSummaryRes.data.reduce(
      (sum, d) => sum + (d.totals?.hgab3_php ?? d.totals?.hgab2_php ?? 0),
      0
    );
    const totalLines = projectResponses
      .slice(0, datasets.length)
      .reduce((sum, r) => sum + r.total, 0);
    summaryTotals = {
      nep,
      house,
      delta: house - nep,
      totalLines,
    };
  }

  return {
    scopeLabel,
    scopeKind,
    regionLabel,
    offices: discoveredOffices,
    projects: Array.from(projectByKey.values()),
    gaaRecords,
    gaaDepartments: isNationwide ? nationwideGaaDeptsRes?.data : undefined,
    notice,
    truncatedProjects,
    summaryTotals,
  };
}
