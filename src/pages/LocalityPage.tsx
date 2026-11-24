import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, MapPin, RefreshCw, Search } from 'lucide-react';
import { SourcePanel } from '../components/SourcePanel';
import { ErrorBanner, KpiSkeletonGrid, NoticeStrip, PanelSkeleton } from '../components/States';
import {
  API_CONFIG,
  HUC_TO_PARENT_PROVINCE,
  NCR_CITY_TO_PSA_DISTRICT,
  REGION_SHORT_NAMES,
  REGION_TO_HGAB_KEY,
} from '../config/constants';
import { useBudgetData } from '../hooks/useBudgetData';
import { useLanguage } from '../i18n/LanguageContext';
import { budgetApi } from '../services/budgetApi';
import {
  type RegionalPopulationRecord,
  type RegionalUnemploymentBundle,
  statisticsApi,
} from '../services/statisticsApi';
import type {
  GaaProgramItem,
  HgabDatasetKey,
  HgabDistrictDetailResponse,
  HgabDistrictSummary,
  HgabProjectRow,
  ProvincialPovertyRecord,
  PsgcMunicipalityRecord,
  PsgcProvinceRecord,
} from '../types/budget';
import { calculateDelta } from '../utils/calculations';
import {
  formatNumber,
  formatPercent,
  formatPhpCompact,
  formatPhpPerCapita,
  formatSignedPercent,
  normalizeGeoName,
  toLocalitySearchTerm,
} from '../utils/formatting';

const LOCALITY_STORAGE_KEY = 'budgetlens_ph_locality_v1';

interface SavedLocality {
  regCode: string;
  provCode: string;
  munCode: string;
}

function readSavedLocality(): SavedLocality {
  try {
    const raw = window.localStorage.getItem(LOCALITY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SavedLocality>;
      if (parsed.regCode && parsed.provCode) {
        return {
          regCode: parsed.regCode,
          provCode: parsed.provCode,
          munCode: parsed.munCode ?? '',
        };
      }
    }
  } catch {
    // Ignore storage issues
  }
  return { regCode: '07', provCode: '0702200000', munCode: '' };
}

function saveLocality(loc: SavedLocality): void {
  try {
    window.localStorage.setItem(LOCALITY_STORAGE_KEY, JSON.stringify(loc));
  } catch {
    // Ignore storage issues
  }
}

export function LocalityPage() {
  const { nepRegions, loadNepRegions } = useBudgetData();
  const { language, t, translateRegion, translateDepartment, translateRecordHint } = useLanguage();

  const initial = useMemo(() => readSavedLocality(), []);
  const [selectedRegCode, setSelectedRegCode] = useState<string>(initial.regCode);
  const [selectedProvCode, setSelectedProvCode] = useState<string>(initial.provCode);
  const [selectedMunCode, setSelectedMunCode] = useState<string>(initial.munCode);

  const [quickJump, setQuickJump] = useState('');

  // Core PSGC + Poverty + Regional Unemployment state
  const [coreLoading, setCoreLoading] = useState(true);
  const [coreError, setCoreError] = useState<string | null>(null);
  const [coreFetchedAt, setCoreFetchedAt] = useState<string | null>(null);
  const [psgcRegions, setPsgcRegions] = useState<RegionalPopulationRecord[]>([]);
  const [psgcProvinces, setPsgcProvinces] = useState<PsgcProvinceRecord[]>([]);
  const [povertyRecords, setPovertyRecords] = useState<ProvincialPovertyRecord[]>([]);
  const [povertySourceUrl, setPovertySourceUrl] = useState<string>(API_CONFIG.statsDocsUrl);
  const [povertyUpdated, setPovertyUpdated] = useState<string | null>(null);
  const [unemployment, setUnemployment] = useState<RegionalUnemploymentBundle | null>(null);

  // Municipalities for selected province
  const [municipalities, setMunicipalities] = useState<PsgcMunicipalityRecord[]>([]);
  const [munLoading, setMunLoading] = useState(false);

  // Congressional districts (HGAB 2027)
  const [districts, setDistricts] = useState<HgabDistrictSummary[]>([]);
  const [districtsLoading, setDistrictsLoading] = useState(false);
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(null);
  const [districtDetail, setDistrictDetail] = useState<HgabDistrictDetailResponse['data'] | null>(
    null
  );
  const [districtDetailLoading, setDistrictDetailLoading] = useState(false);

  // Local FY2027 projects (DPWH / FMR / HFEP / NIA)
  const [projectTab, setProjectTab] = useState<HgabDatasetKey>('dpwh');
  const [projectFilter, setProjectFilter] = useState('');
  const [debouncedProjectFilter, setDebouncedProjectFilter] = useState('');
  const [projects, setProjects] = useState<HgabProjectRow[]>([]);
  const [projectsTotal, setProjectsTotal] = useState(0);
  const [projectsSums, setProjectsSums] = useState<{
    nep_php: number | null;
    hgab3_php: number | null;
  } | null>(null);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsLoadingMore, setProjectsLoadingMore] = useState(false);
  const [projectsFetchedAt, setProjectsFetchedAt] = useState<string | null>(null);

  // Named FY2026 GAA mentions
  const [gaaMentions, setGaaMentions] = useState<GaaProgramItem[]>([]);
  const [gaaMentionsLoading, setGaaMentionsLoading] = useState(false);

  // Load baseline PSGC regions + provinces + provincial poverty + regional unemployment
  const loadCoreData = useCallback(
    async (force = false) => {
      setCoreLoading(true);
      setCoreError(null);
      try {
        void loadNepRegions(force);
        const [regRes, provRes, povRes, unempRes] = await Promise.all([
          statisticsApi.getPsgcRegionalPopulations(force),
          statisticsApi.getPsgcProvinces(force),
          statisticsApi.getAllProvincialPoverty(force),
          statisticsApi.getRegionalUnemployment(force),
        ]);
        setPsgcRegions(regRes.data.regions);
        setPsgcProvinces(provRes.data);
        setPovertyRecords(povRes.data.records);
        setPovertySourceUrl(povRes.data.sourceUrl);
        setPovertyUpdated(povRes.data.sourceUpdated);
        setUnemployment(unempRes.data);
        setCoreFetchedAt(provRes.fetchedAt);
      } catch (err) {
        setCoreError(
          err instanceof Error
            ? err.message
            : 'Unable to load Philippine geographic and poverty datasets.'
        );
      } finally {
        setCoreLoading(false);
      }
    },
    [loadNepRegions]
  );

  useEffect(() => {
    void loadCoreData(false);
  }, [loadCoreData]);

  // Debounce project refinement filter
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedProjectFilter(projectFilter.trim()), 400);
    return () => window.clearTimeout(timer);
  }, [projectFilter]);

  // Filtered provinces for selected region
  const provincesInRegion = useMemo(
    () => psgcProvinces.filter((p) => p.regCode === selectedRegCode),
    [psgcProvinces, selectedRegCode]
  );

  const selectedProvince = useMemo(() => {
    return (
      provincesInRegion.find((p) => p.code === selectedProvCode) ??
      provincesInRegion[0] ??
      null
    );
  }, [provincesInRegion, selectedProvCode]);

  // Keep selectedProvCode synced if region changes
  useEffect(() => {
    if (selectedProvince && selectedProvince.code !== selectedProvCode) {
      setSelectedProvCode(selectedProvince.code);
      setSelectedMunCode('');
    }
  }, [selectedProvince, selectedProvCode]);

  // Persist user's chosen locality
  useEffect(() => {
    if (selectedRegCode && selectedProvince) {
      saveLocality({
        regCode: selectedRegCode,
        provCode: selectedProvince.code,
        munCode: selectedMunCode,
      });
    }
  }, [selectedRegCode, selectedProvince, selectedMunCode]);

  // Fetch municipalities when a Province (non-HUC) is selected
  const isProvinceWithMunicipalities =
    selectedProvince !== null &&
    (selectedProvince.geoLevel === 'Prov' || selectedProvince.code === '1999900000');

  useEffect(() => {
    if (!selectedProvince || !isProvinceWithMunicipalities) {
      setMunicipalities([]);
      setSelectedMunCode('');
      return;
    }
    let cancelled = false;
    setMunLoading(true);
    statisticsApi
      .getPsgcMunicipalities(selectedProvince.reg, selectedProvince.prv)
      .then((res) => {
        if (cancelled) return;
        setMunicipalities(res.data);
        if (selectedMunCode && !res.data.some((m) => m.code === selectedMunCode)) {
          setSelectedMunCode('');
        }
      })
      .catch(() => {
        if (!cancelled) setMunicipalities([]);
      })
      .finally(() => {
        if (!cancelled) setMunLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedProvince, isProvinceWithMunicipalities]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedMunicipality = useMemo(
    () => municipalities.find((m) => m.code === selectedMunCode) ?? null,
    [municipalities, selectedMunCode]
  );

  // Quick-jump matches across all 117 provinces & HUCs
  const quickJumpMatches = useMemo(() => {
    const q = quickJump.trim().toLowerCase();
    if (q.length < 2) return [];
    return psgcProvinces
      .filter((p) => p.areaName.toLowerCase().includes(q))
      .slice(0, 7);
  }, [quickJump, psgcProvinces]);

  const handleQuickJumpSelect = (prov: PsgcProvinceRecord) => {
    setSelectedRegCode(prov.regCode);
    setSelectedProvCode(prov.code);
    setSelectedMunCode('');
    setQuickJump('');
  };

  // Resolve active locality display & metrics
  const activeLocality = selectedMunicipality ?? selectedProvince;
  const activeSearchTerm = useMemo(() => {
    if (!activeLocality) return '';
    return toLocalitySearchTerm(activeLocality.areaName);
  }, [activeLocality]);

  const provinceSearchTerm = useMemo(() => {
    if (!selectedProvince) return '';
    return toLocalitySearchTerm(selectedProvince.areaName);
  }, [selectedProvince]);

  const hgabRegionKey = REGION_TO_HGAB_KEY[selectedRegCode] ?? undefined;

  // Match Provincial / HUC / NCR District 2023 Poverty Indicator
  const matchedPoverty = useMemo<{
    record: ProvincialPovertyRecord;
    scopeNote: string | null;
    scopeLabel: string;
  } | null>(() => {
    if (!selectedProvince || povertyRecords.length === 0) return null;
    const normProv = normalizeGeoName(selectedProvince.areaName);

    // 1. Direct exact match (covers all 82 provinces + Cotabato City)
    const exact = povertyRecords.find((r) => r.normalizedKey === normProv);
    if (exact) {
      return { record: exact, scopeNote: null, scopeLabel: exact.cleanName };
    }

    // 2. NCR Cities -> Official PSA NCR 1st–4th District
    if (selectedProvince.regCode === '13') {
      const ncrDist = NCR_CITY_TO_PSA_DISTRICT[normProv];
      if (ncrDist) {
        const distRec = povertyRecords.find((r) => r.normalizedKey === ncrDist);
        if (distRec) {
          return {
            record: distRec,
            scopeNote: t.locality.povertyNcrDistrictNote,
            scopeLabel: `NCR · ${distRec.cleanName}`,
          };
        }
      }
    }

    // 3. HUCs -> Parent geographic province when PSA Table 2 reports them together
    const parentKey = HUC_TO_PARENT_PROVINCE[normProv];
    if (parentKey) {
      const parentRec = povertyRecords.find((r) => r.normalizedKey === parentKey);
      if (parentRec) {
        return {
          record: parentRec,
          scopeNote: t.locality.povertyProvinceFallbackNote,
          scopeLabel: parentRec.cleanName,
        };
      }
    }

    return null;
  }, [
    selectedProvince,
    povertyRecords,
    t.locality.povertyNcrDistrictNote,
    t.locality.povertyProvinceFallbackNote,
  ]);

  // Regional context metrics
  const selectedNepRegion = useMemo(
    () => nepRegions.find((r) => r.code === selectedRegCode) ?? null,
    [nepRegions, selectedRegCode]
  );
  const selectedRegUnemp = unemployment?.byRegion[selectedRegCode] ?? null;

  // Load matching Congressional Districts (HGAB 2027) for the selected Province / HUC
  useEffect(() => {
    if (!provinceSearchTerm) {
      setDistricts([]);
      setSelectedDistrictId(null);
      setDistrictDetail(null);
      return;
    }
    let cancelled = false;
    setDistrictsLoading(true);
    setSelectedDistrictId(null);
    setDistrictDetail(null);

    budgetApi
      .searchHgabDistricts({ q: provinceSearchTerm, region: hgabRegionKey, limit: 25 })
      .then((res) => {
        if (cancelled) return;
        const list = res.data.data?.districts ?? [];
        setDistricts(list);
        if (list.length > 0) {
          setSelectedDistrictId(list[0].id);
        }
      })
      .catch(() => {
        if (!cancelled) setDistricts([]);
      })
      .finally(() => {
        if (!cancelled) setDistrictsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [provinceSearchTerm, hgabRegionKey]);

  // Load selected Congressional District detail
  useEffect(() => {
    if (!selectedDistrictId) {
      setDistrictDetail(null);
      return;
    }
    let cancelled = false;
    setDistrictDetailLoading(true);
    budgetApi
      .getHgabDistrictDetail(selectedDistrictId)
      .then((res) => {
        if (!cancelled) setDistrictDetail(res.data.data);
      })
      .catch(() => {
        if (!cancelled) setDistrictDetail(null);
      })
      .finally(() => {
        if (!cancelled) setDistrictDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDistrictId]);

  // Build project search query (selected locality + optional user refinement)
  const effectiveProjectQuery = useMemo(() => {
    const parts = [activeSearchTerm, debouncedProjectFilter].filter(Boolean);
    return parts.join(' ').trim();
  }, [activeSearchTerm, debouncedProjectFilter]);

  // Fetch local FY2027 projects for active dataset tab
  useEffect(() => {
    if (!effectiveProjectQuery) {
      setProjects([]);
      setProjectsTotal(0);
      setProjectsSums(null);
      return;
    }
    let cancelled = false;
    setProjectsLoading(true);
    budgetApi
      .getHgabProjects(projectTab, {
        q: effectiveProjectQuery,
        region: projectTab === 'nia' ? undefined : hgabRegionKey,
        limit: 15,
        offset: 0,
      })
      .then((res) => {
        if (cancelled) return;
        setProjects(res.data.data?.rows ?? []);
        setProjectsTotal(res.data.data?.total ?? 0);
        setProjectsSums(
          res.data.data?.sums
            ? {
                nep_php: res.data.data.sums.nep_php,
                hgab3_php: res.data.data.sums.hgab3_php,
              }
            : null
        );
        setProjectsFetchedAt(res.fetchedAt);
      })
      .catch(() => {
        if (!cancelled) {
          setProjects([]);
          setProjectsTotal(0);
          setProjectsSums(null);
        }
      })
      .finally(() => {
        if (!cancelled) setProjectsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectTab, effectiveProjectQuery, hgabRegionKey]);

  const handleLoadMoreProjects = async () => {
    if (projectsLoadingMore || projects.length >= projectsTotal) return;
    setProjectsLoadingMore(true);
    try {
      const res = await budgetApi.getHgabProjects(projectTab, {
        q: effectiveProjectQuery,
        region: projectTab === 'nia' ? undefined : hgabRegionKey,
        limit: 15,
        offset: projects.length,
      });
      setProjects((prev) => [...prev, ...(res.data.data?.rows ?? [])]);
    } finally {
      setProjectsLoadingMore(false);
    }
  };

  // Fetch FY2026 GAA named programs mentioning this locality
  useEffect(() => {
    if (!activeSearchTerm || activeSearchTerm.length < 3) {
      setGaaMentions([]);
      return;
    }
    let cancelled = false;
    setGaaMentionsLoading(true);
    budgetApi
      .searchGaaPrograms({ q: activeSearchTerm, year: 2026, limit: 15 })
      .then((res) => {
        if (!cancelled) setGaaMentions(res.data.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setGaaMentions([]);
      })
      .finally(() => {
        if (!cancelled) setGaaMentionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeSearchTerm]);

  const popGrowth2020to2024 = calculateDelta(
    activeLocality?.pop2020 ?? null,
    activeLocality?.pop2024 ?? null
  ).percentChange;

  const regionDisplayName = translateRegion(
    selectedRegCode,
    REGION_SHORT_NAMES[selectedRegCode] ?? selectedRegCode
  );

  const projectTabs: Array<{ key: HgabDatasetKey; label: string }> = [
    { key: 'dpwh', label: t.locality.tabDpwh },
    { key: 'fmr', label: t.locality.tabFmr },
    { key: 'hfep', label: t.locality.tabHfep },
    { key: 'nia', label: t.locality.tabNia },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            {t.locality.title}
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 max-w-3xl">{t.locality.subtitle}</p>
        </div>

        <button
          type="button"
          onClick={() => void loadCoreData(true)}
          disabled={coreLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap self-start md:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${coreLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
          {t.common.refreshData}
        </button>
      </div>

      <NoticeStrip tone="caution" message={t.locality.boundaryNotice} />

      {coreError ? (
        <ErrorBanner
          title={t.common.errorTitle}
          message={coreError}
          onRetry={() => void loadCoreData(true)}
        />
      ) : coreLoading ? (
        <div className="space-y-6">
          <PanelSkeleton heightClass="h-36" />
          <KpiSkeletonGrid count={4} />
          <PanelSkeleton heightClass="h-72" />
        </div>
      ) : (
        <>
          {/* Cascading Locality Selector Bar */}
          <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            {/* Quick-Jump Search */}
            <div className="relative max-w-xl">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {t.locality.quickJumpLabel}
              </label>
              <div className="relative">
                <Search
                  className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={quickJump}
                  onChange={(e) => setQuickJump(e.target.value)}
                  placeholder={t.locality.quickJumpPlaceholder}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:border-[#26489A] focus:outline-none"
                />
              </div>

              {quickJumpMatches.length > 0 && (
                <ul className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg divide-y divide-slate-100 max-h-64 overflow-y-auto">
                  {quickJumpMatches.map((prov) => (
                    <li key={prov.code}>
                      <button
                        type="button"
                        onClick={() => handleQuickJumpSelect(prov)}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <span className="font-medium text-slate-900">{prov.areaName}</span>
                        <span className="text-slate-500">
                          {translateRegion(
                            prov.regCode,
                            REGION_SHORT_NAMES[prov.regCode] ?? prov.regCode
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* 3-Step Cascading Dropdowns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
              <div>
                <label
                  htmlFor="locality-region-select"
                  className="block text-xs font-medium text-slate-600 mb-1"
                >
                  {t.locality.regionLabel}
                </label>
                <select
                  id="locality-region-select"
                  value={selectedRegCode}
                  onChange={(e) => {
                    const nextReg = e.target.value;
                    setSelectedRegCode(nextReg);
                    const firstProv = psgcProvinces.find((p) => p.regCode === nextReg);
                    setSelectedProvCode(firstProv?.code ?? '');
                    setSelectedMunCode('');
                    setProjectFilter('');
                  }}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:border-[#26489A] focus:outline-none cursor-pointer"
                >
                  {psgcRegions
                    .slice()
                    .sort((a, b) => Number(a.regCode) - Number(b.regCode))
                    .map((reg) => (
                      <option key={reg.regCode} value={reg.regCode}>
                        {translateRegion(
                          reg.regCode,
                          REGION_SHORT_NAMES[reg.regCode] ?? reg.areaName
                        )}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="locality-province-select"
                  className="block text-xs font-medium text-slate-600 mb-1"
                >
                  {t.locality.provinceLabel}
                </label>
                <select
                  id="locality-province-select"
                  value={selectedProvince?.code ?? ''}
                  onChange={(e) => {
                    setSelectedProvCode(e.target.value);
                    setSelectedMunCode('');
                    setProjectFilter('');
                  }}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:border-[#26489A] focus:outline-none cursor-pointer"
                >
                  {provincesInRegion.map((prov) => (
                    <option key={prov.code} value={prov.code}>
                      {prov.areaName} (
                      {prov.geoLevel === 'City' ? t.locality.hucSuffix : t.locality.provinceSuffix})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="locality-municipality-select"
                  className="block text-xs font-medium text-slate-600 mb-1"
                >
                  {t.locality.municipalityLabel}
                </label>
                {isProvinceWithMunicipalities ? (
                  <select
                    id="locality-municipality-select"
                    value={selectedMunCode}
                    disabled={munLoading}
                    onChange={(e) => {
                      setSelectedMunCode(e.target.value);
                      setProjectFilter('');
                    }}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:border-[#26489A] focus:outline-none disabled:opacity-60 cursor-pointer"
                  >
                    <option value="">
                      {munLoading ? t.common.loading : t.locality.allOfProvince}
                    </option>
                    {municipalities.map((mun) => (
                      <option key={mun.code} value={mun.code}>
                        {mun.areaName}
                        {mun.pop2024 ? ` (${formatNumber(mun.pop2024)})` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="px-3 py-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-md leading-relaxed">
                    {t.locality.hucStandaloneHint}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Active Locality Banner + Multi-Tier KPI Summary */}
          {activeLocality && selectedProvince && (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-slate-900">
                  <MapPin className="w-5 h-5 text-[#26489A] shrink-0" aria-hidden="true" />
                  <h2 className="text-xl font-bold tracking-tight">
                    {activeLocality.areaName}
                    {selectedMunicipality && (
                      <span className="font-normal text-slate-500">
                        {' '}
                        · {selectedProvince.areaName}
                      </span>
                    )}
                  </h2>
                </div>
                <p className="text-xs font-mono text-slate-500 tabular-nums">
                  {t.locality.psgcCodeLabel}: {activeLocality.code} · {regionDisplayName}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* KPI 1: Exact Locality 2024 Census Population */}
                <div className="bg-white border border-slate-200 rounded-lg p-5">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-[#26489A]">
                    {selectedMunicipality || selectedProvince.geoLevel === 'City'
                      ? t.locality.tierExactLocality
                      : t.locality.tierProvince}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{t.locality.pop2024Label}</p>
                  <p className="mt-1.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                    {formatNumber(activeLocality.pop2024)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 tabular-nums">
                    {t.locality.popGrowthLabel}:{' '}
                    <span className="font-mono font-medium text-slate-700">
                      {formatSignedPercent(popGrowth2020to2024, 1)}
                    </span>
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400 font-mono tabular-nums">
                    2015: {formatNumber(activeLocality.pop2015)} → 2020:{' '}
                    {formatNumber(activeLocality.pop2020)}
                  </p>
                </div>

                {/* KPI 2: Exact Locality LGU Income Class */}
                <div className="bg-white border border-slate-200 rounded-lg p-5">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-[#26489A]">
                    {selectedMunicipality || selectedProvince.geoLevel === 'City'
                      ? t.locality.tierExactLocality
                      : t.locality.tierProvince}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{t.locality.incomeClassLabel}</p>
                  <p className="mt-1.5 font-mono text-2xl font-semibold text-slate-900">
                    {activeLocality.incomeClass || t.common.na}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {selectedMunicipality
                      ? selectedMunicipality.cityClass || selectedMunicipality.geoLevel
                      : selectedProvince.geoLevel === 'City'
                        ? t.locality.hucSuffix
                        : `${municipalities.length} ${t.locality.tierExactLocality}`}
                  </p>
                </div>

                {/* KPI 3: Province / HUC 2023 Poverty Incidence */}
                <div className="bg-white border border-slate-200 rounded-lg p-5">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-[#0F766E]">
                    {t.locality.tierProvince}
                    {matchedPoverty ? ` · ${matchedPoverty.scopeLabel}` : ''}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{t.locality.provPoverty2023Label}</p>
                  <p className="mt-1.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                    {formatPercent(matchedPoverty?.record.povertyIncidence2023, 1)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 tabular-nums">
                    {t.locality.provThresholdLabel}:{' '}
                    {formatPhpPerCapita(matchedPoverty?.record.povertyThreshold2023)}
                  </p>
                  {matchedPoverty && (
                    <p className="mt-1 text-[11px] text-slate-400 font-mono tabular-nums">
                      2018: {formatPercent(matchedPoverty.record.povertyIncidence2018, 1)} → 2021:{' '}
                      {formatPercent(matchedPoverty.record.povertyIncidence2021, 1)}
                    </p>
                  )}
                  {matchedPoverty?.scopeNote && (
                    <p className="mt-1 text-[11px] text-amber-800 leading-snug">
                      {matchedPoverty.scopeNote}
                    </p>
                  )}
                </div>

                {/* KPI 4: Region Context (FY2027 Regionalized NEP & 2025 Unemployment) */}
                <div className="bg-white border border-slate-200 rounded-lg p-5">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                    {t.locality.tierRegion} · {regionDisplayName}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{t.locality.regionalNepContextLabel}</p>
                  <p className="mt-1.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                    {formatPhpCompact(selectedNepRegion?.amount)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 tabular-nums">
                    {t.locality.regionalUnempContextLabel}:{' '}
                    <span className="font-mono font-medium text-slate-700">
                      {selectedRegUnemp?.rate !== null && selectedRegUnemp?.rate !== undefined
                        ? formatPercent(selectedRegUnemp.rate, 1)
                        : t.common.na}
                    </span>
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Section 1: Congressional Districts & Implementing Offices (FY2027) */}
          <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-[#0F766E]">
                {t.locality.tierDistrict}
              </p>
              <h2 className="text-lg font-semibold text-slate-900 mt-0.5">
                {t.locality.districtsTitle}
              </h2>
              <p className="text-xs text-slate-500 mt-1 max-w-3xl">{t.locality.districtsSubtitle}</p>
            </div>

            {districtsLoading ? (
              <p className="text-xs text-slate-500">{t.locality.loadingDistricts}</p>
            ) : districts.length === 0 ? (
              <p className="text-xs text-slate-600">{t.locality.noDistrictsFound}</p>
            ) : (
              <div className="space-y-4">
                {/* District selector tabs */}
                <div className="flex flex-wrap gap-2">
                  {districts.map((d) => {
                    const active = d.id === selectedDistrictId;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setSelectedDistrictId(d.id)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#26489A] text-white border-[#26489A]'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>

                {/* Selected District Detail */}
                {districtDetailLoading ? (
                  <PanelSkeleton heightClass="h-40" />
                ) : districtDetail ? (
                  <div className="border border-slate-200 rounded-md p-4 bg-slate-50/60 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">
                          {districtDetail.label}
                        </h3>
                        {districtDetail.representative?.name && (
                          <p className="text-xs text-slate-600 mt-0.5">
                            {t.locality.representativeLabel}:{' '}
                            <span className="font-medium text-slate-800">
                              {districtDetail.representative.name}
                            </span>
                          </p>
                        )}
                      </div>
                      {districtDetail.url && (
                        <a
                          href={`https://budget.bettergov.ph${districtDetail.url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#26489A] hover:underline whitespace-nowrap"
                        >
                          {t.common.verifySource}
                          <ExternalLink className="w-3 h-3" aria-hidden="true" />
                        </a>
                      )}
                    </div>

                    {/* Attribution Clarity Callout */}
                    <div
                      className={`text-xs rounded-md border px-3.5 py-2.5 leading-relaxed ${
                        districtDetail.headline?.shared_office_total
                          ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      {districtDetail.headline?.shared_office_total
                        ? t.locality.sharedOfficeWarning
                        : t.locality.loneOfficeNote}
                      {districtDetail.co_served_districts &&
                        districtDetail.co_served_districts.length > 0 && (
                          <span className="block mt-1 text-[11px] text-amber-900">
                            Co-served:{' '}
                            {districtDetail.co_served_districts.map((c) => c.label).join(', ')}
                          </span>
                        )}
                    </div>

                    {/* District Headline Figures */}
                    {districtDetail.headline && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bg-white border border-slate-200 rounded-md p-3.5">
                          <p className="text-[11px] text-slate-500">
                            {t.locality.districtGaa26Label}
                          </p>
                          <p className="mt-1 font-mono text-lg font-semibold text-slate-900 tabular-nums">
                            {formatPhpCompact(districtDetail.headline.fy2026_gaa_php)}
                          </p>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-md p-3.5">
                          <p className="text-[11px] text-slate-500">
                            {t.locality.districtNep27Label}
                          </p>
                          <p className="mt-1 font-mono text-lg font-semibold text-[#26489A] tabular-nums">
                            {formatPhpCompact(districtDetail.headline.fy2027_nep_php)}
                          </p>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-md p-3.5">
                          <p className="text-[11px] text-slate-500">
                            {t.locality.districtHgab27Label}
                          </p>
                          <p className="mt-1 font-mono text-lg font-semibold text-[#0F766E] tabular-nums">
                            {formatPhpCompact(districtDetail.headline.fy2027_hgab3_php)}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Implementing Offices */}
                    {districtDetail.offices && districtDetail.offices.length > 0 && (
                      <div className="text-xs">
                        <p className="font-medium text-slate-700 mb-1.5">{t.locality.officeLabel}:</p>
                        <ul className="space-y-1 text-slate-600">
                          {districtDetail.offices.map((off) => (
                            <li
                              key={off.id}
                              className="flex flex-wrap items-baseline justify-between gap-2 bg-white border border-slate-200 rounded px-3 py-1.5"
                            >
                              <span className="font-medium text-slate-900">{off.name}</span>
                              <span className="text-[11px] text-slate-500">{off.tier_text}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )}

            <p className="text-[11px] text-slate-500 leading-relaxed border-t border-slate-100 pt-3">
              {t.locality.hgabDisclaimer}
            </p>
          </section>

          {/* Section 2: Local FY2027 Projects (DPWH, FMR, HFEP, NIA) */}
          <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-[#26489A]">
                  {selectedMunicipality
                    ? `${t.locality.tierExactLocality}: ${selectedMunicipality.areaName}`
                    : `${t.locality.tierProvince}: ${selectedProvince?.areaName ?? ''}`}
                </p>
                <h2 className="text-lg font-semibold text-slate-900 mt-0.5">
                  {t.locality.projectsTitle}
                </h2>
                <p className="text-xs text-slate-500 mt-1 max-w-3xl">
                  {t.locality.projectsSubtitle}
                </p>
              </div>
            </div>

            {/* 4 Dataset Tabs */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
              {projectTabs.map((tab) => {
                const active = projectTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setProjectTab(tab.key)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      active
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Refinement Search + Summary Strip */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search
                  className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                  placeholder={t.locality.searchProjectsPlaceholder}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:border-[#26489A] focus:outline-none"
                />
              </div>

              {!projectsLoading && projectsTotal > 0 && (
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {formatNumber(projectsTotal)} {t.locality.matchedProjectsCount}
                  </span>
                  {projectsSums && (
                    <>
                      <span className="text-slate-600 tabular-nums">
                        {t.locality.nepSumLabel}:{' '}
                        <strong className="font-mono text-slate-900">
                          {formatPhpCompact(projectsSums.nep_php)}
                        </strong>
                      </span>
                      <span className="text-slate-600 tabular-nums">
                        {t.locality.houseBillSumLabel}:{' '}
                        <strong className="font-mono text-[#0F766E]">
                          {formatPhpCompact(projectsSums.hgab3_php)}
                        </strong>
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>

            {projectsLoading ? (
              <p className="text-xs text-slate-500 py-4">{t.locality.searchingProjects}</p>
            ) : projects.length === 0 ? (
              <p className="text-xs text-slate-600 py-4">{t.locality.noProjectsFound}</p>
            ) : (
              <>
                <p className="text-[11px] text-slate-500">{t.locality.notAdditiveNote}</p>
                <div className="overflow-x-auto border border-slate-200 rounded-md">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                        <th className="py-2.5 pl-3 pr-2 font-medium">{t.locality.colProjectTitle}</th>
                        <th className="py-2.5 px-2 font-medium">{t.locality.colOfficeProgram}</th>
                        <th className="py-2.5 px-2 font-medium text-right whitespace-nowrap">
                          {t.locality.colNepAmount}
                        </th>
                        <th className="py-2.5 px-2 font-medium text-right whitespace-nowrap">
                          {t.locality.colHouseAmount}
                        </th>
                        <th className="py-2.5 pl-2 pr-3 font-medium text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {projects.map((proj) => {
                        const hint = language !== 'en' ? translateRecordHint(proj.title) : null;
                        const houseVal = proj.hgab3_php ?? proj.house_php ?? proj.hgab2_php;
                        return (
                          <tr key={proj.id} className="hover:bg-slate-50/70 align-top">
                            <td className="py-2.5 pl-3 pr-2 max-w-md">
                              <p className="font-medium text-slate-900 leading-snug">{proj.title}</p>
                              {hint && (
                                <p className="text-[11px] text-[#0F766E] mt-0.5">{hint}</p>
                              )}
                              {proj.status_label && (
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  {proj.status_label}
                                </p>
                              )}
                            </td>
                            <td className="py-2.5 px-2 text-slate-600 max-w-xs">
                              <p className="text-slate-800">{proj.office || proj.region || t.common.na}</p>
                              {proj.program && (
                                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                                  {proj.program}
                                </p>
                              )}
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                              {formatPhpCompact(proj.nep_php)}
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono tabular-nums font-medium text-[#0F766E] whitespace-nowrap">
                              {formatPhpCompact(houseVal)}
                            </td>
                            <td className="py-2.5 pl-2 pr-3 text-right whitespace-nowrap">
                              {proj.url && (
                                <a
                                  href={`https://budget.bettergov.ph${proj.url}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[#26489A] hover:underline font-medium"
                                >
                                  {t.locality.verifyProject}
                                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                                </a>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {projects.length < projectsTotal && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => void handleLoadMoreProjects()}
                      disabled={projectsLoadingMore}
                      className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                    >
                      {projectsLoadingMore ? t.explorer.loadingMore : t.locality.loadMoreProjects}
                    </button>
                  </div>
                )}
              </>
            )}

            <SourcePanel
              source={{
                sourceName: 'BetterGovPH Budget API (HGAB 2027 & NEP 2027) & Philippine Data Explorer (PSGC Q2 2024 / PSA OpenSTAT)',
                datasetName: `GET /api/v1/hgab/2027/datasets/${projectTab}/projects · /hgab/2027/districts · PSGC Q2_2024 · PSA Table 2 (b4a71a27b4e4189c79a8)`,
                period: 'FY2027 Proposed NEP / House Bill · 2024 Census · 2023 Poverty',
                fetchedAt: projectsFetchedAt ?? coreFetchedAt ?? undefined,
                sourceUpdated: povertyUpdated,
                units: 'Nominal PHP, Persons, Percent (%)',
                method: t.locality.hgabDisclaimer,
                sourceUrl: `${API_CONFIG.budgetBaseUrl}/hgab/2027/datasets`,
                secondaryUrl: povertySourceUrl,
                secondaryLabel: t.socioeconomic.psaSource,
              }}
            />
          </section>

          {/* Section 3: Named FY2026 GAA Programs Mentioning This Place */}
          <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                FY2026 {t.common.enactedGaa}
              </p>
              <h2 className="text-lg font-semibold text-slate-900 mt-0.5">
                {t.locality.gaaMentionsTitle}
              </h2>
              <p className="text-xs text-slate-500 mt-1 max-w-3xl">
                {t.locality.gaaMentionsSubtitle}
              </p>
            </div>

            {gaaMentionsLoading ? (
              <p className="text-xs text-slate-500">{t.locality.searchingGaa}</p>
            ) : gaaMentions.length === 0 ? (
              <p className="text-xs text-slate-600">{t.locality.noGaaMentions}</p>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-md">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <th className="py-2.5 pl-3 pr-2 font-medium">{t.locality.colGaaProgram}</th>
                      <th className="py-2.5 px-2 font-medium">{t.locality.colGaaDept}</th>
                      <th className="py-2.5 pl-2 pr-3 font-medium text-right whitespace-nowrap">
                        {t.locality.colGaa2026}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {gaaMentions.map((item) => {
                      const amt2026 = item.years?.['2026']?.amount ?? null;
                      const hint = language !== 'en' ? translateRecordHint(item.name) : null;
                      return (
                        <tr
                          key={`${item.department_id}-${item.agency_id}-${item.fam_key}`}
                          className="hover:bg-slate-50/70 align-top"
                        >
                          <td className="py-2.5 pl-3 pr-2">
                            <p className="font-medium text-slate-900">{item.name}</p>
                            {hint && <p className="text-[11px] text-[#0F766E] mt-0.5">{hint}</p>}
                          </td>
                          <td className="py-2.5 px-2 text-slate-600">
                            {translateDepartment(
                              item.department_id,
                              item.department ?? item.department_id,
                              'gaa'
                            )}
                          </td>
                          <td className="py-2.5 pl-2 pr-3 text-right font-mono tabular-nums font-medium text-slate-900 whitespace-nowrap">
                            {formatPhpCompact(amt2026)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <SourcePanel
              source={{
                sourceName: 'Philippine Budget API (BetterGovPH)',
                datasetName: `GET /api/v1/gaa/search?q=${encodeURIComponent(activeSearchTerm)}&year=2026`,
                period: 'FY2026 Enacted GAA',
                fetchedAt: coreFetchedAt ?? undefined,
                units: 'Nominal PHP',
                sourceUrl: `${API_CONFIG.budgetBaseUrl}/gaa/search?q=${encodeURIComponent(activeSearchTerm)}&year=2026`,
              }}
            />
          </section>
        </>
      )}
    </div>
  );
}
