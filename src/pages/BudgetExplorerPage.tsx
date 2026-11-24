import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronRight, Search, X } from 'lucide-react';
import { GlossaryTooltip } from '../components/GlossaryTooltip';
import { SourcePanel } from '../components/SourcePanel';
import { EmptyState, ErrorBanner, NoticeStrip, TableSkeleton } from '../components/States';
import { API_CONFIG } from '../config/constants';
import { useBudgetData } from '../hooks/useBudgetData';
import { useLanguage } from '../i18n/LanguageContext';
import { budgetApi } from '../services/budgetApi';
import type {
  BudgetStage,
  GaaDepartmentDetailResponse,
  GaaExpenseClassItem,
  GaaObjectItem,
  GaaProgramItem,
  NepDepartmentDetailResponse,
} from '../types/budget';
import { getGaaDepartmentsForYear, normalizeNepDepartments } from '../utils/calculations';
import {
  formatNumber,
  formatPercent,
  formatPhpCompact,
  formatPhpExact,
  formatSignedPercent,
  formatSignedPhpCompact,
} from '../utils/formatting';

interface BudgetExplorerPageProps {
  initialSelection?: { deptId: string; year: number; stage: BudgetStage } | null;
  onClearInitialSelection?: () => void;
}

type SortField = 'amount' | 'name' | 'lineItems';
type SortDir = 'asc' | 'desc';

export function BudgetExplorerPage({
  initialSelection,
  onClearInitialSelection,
}: BudgetExplorerPageProps) {
  const {
    language,
    t,
    translateDepartment,
    translateExpenseClass,
    translateRecordHint,
  } = useLanguage();
  const { loading, error, fetchedAt, gaaYears, gaaDepartments, nepOverview, refreshAll } =
    useBudgetData();

  const [stage, setStage] = useState<BudgetStage>(initialSelection?.stage ?? 'gaa');
  const [year, setYear] = useState<number>(initialSelection?.year ?? 2026);
  const [deptSearch, setDeptSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('amount');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const [programQuery, setProgramQuery] = useState('');
  const [debouncedProgramQuery, setDebouncedProgramQuery] = useState('');
  const [programSearchResults, setProgramSearchResults] = useState<GaaProgramItem[]>([]);
  const [programSearchLoading, setProgramSearchLoading] = useState(false);
  const [programSearchError, setProgramSearchError] = useState<string | null>(null);
  const [programSearchFetchedAt, setProgramSearchFetchedAt] = useState<string | null>(null);

  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(
    initialSelection?.deptId ?? null
  );
  const [detailTab, setDetailTab] = useState<'agencies' | 'programs' | 'objects'>('agencies');

  const [gaaDetail, setGaaDetail] = useState<GaaDepartmentDetailResponse['data'] | null>(null);
  const [gaaExpenseClasses, setGaaExpenseClasses] = useState<GaaExpenseClassItem[]>([]);
  const [nepDetail, setNepDetail] = useState<NepDepartmentDetailResponse['data'] | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailFetchedAt, setDetailFetchedAt] = useState<string | null>(null);

  const [agencyFilter, setAgencyFilter] = useState<string>('');
  const [itemFilterInput, setItemFilterInput] = useState('');
  const [debouncedItemFilter, setDebouncedItemFilter] = useState('');
  const [programs, setPrograms] = useState<GaaProgramItem[]>([]);
  const [programsMatched, setProgramsMatched] = useState<number>(0);
  const [programsNextCursor, setProgramsNextCursor] = useState<string | null>(null);
  const [programsLoading, setProgramsLoading] = useState(false);

  const [objects, setObjects] = useState<GaaObjectItem[]>([]);
  const [objectsMatched, setObjectsMatched] = useState<number>(0);
  const [objectsNextCursor, setObjectsNextCursor] = useState<string | null>(null);
  const [objectsLoading, setObjectsLoading] = useState(false);

  useEffect(() => {
    if (initialSelection) {
      setStage(initialSelection.stage);
      setYear(initialSelection.year);
      setSelectedDeptId(initialSelection.deptId);
      onClearInitialSelection?.();
    }
  }, [initialSelection, onClearInitialSelection]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedProgramQuery(programQuery.trim()), 400);
    return () => window.clearTimeout(timer);
  }, [programQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedItemFilter(itemFilterInput.trim()), 380);
    return () => window.clearTimeout(timer);
  }, [itemFilterInput]);

  useEffect(() => {
    if (stage !== 'gaa' || debouncedProgramQuery.length < 3) {
      setProgramSearchResults([]);
      setProgramSearchError(null);
      return;
    }
    let cancelled = false;
    setProgramSearchLoading(true);
    setProgramSearchError(null);
    budgetApi
      .searchGaaPrograms({ q: debouncedProgramQuery, year, limit: 20 })
      .then((res) => {
        if (cancelled) return;
        setProgramSearchResults(res.data.data || []);
        setProgramSearchFetchedAt(res.fetchedAt);
      })
      .catch((err) => {
        if (cancelled) return;
        setProgramSearchError(
          err instanceof Error ? err.message : t.common.errorTitle
        );
      })
      .finally(() => {
        if (!cancelled) setProgramSearchLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedProgramQuery, stage, year, t.common.errorTitle]);

  useEffect(() => {
    if (!selectedDeptId) {
      setGaaDetail(null);
      setGaaExpenseClasses([]);
      setNepDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    setAgencyFilter('');
    setItemFilterInput('');
    setDebouncedItemFilter('');
    setPrograms([]);
    setObjects([]);

    if (stage === 'nep') {
      budgetApi
        .getNep2027DepartmentDetail(selectedDeptId)
        .then((res) => {
          if (cancelled) return;
          setNepDetail(res.data.data);
          setDetailFetchedAt(res.fetchedAt);
        })
        .catch((err) => {
          if (cancelled) return;
          setDetailError(err instanceof Error ? err.message : t.common.errorTitle);
        })
        .finally(() => {
          if (!cancelled) setDetailLoading(false);
        });
    } else {
      Promise.all([
        budgetApi.getGaaDepartmentDetail(selectedDeptId),
        budgetApi.getGaaDepartmentExpenseClasses(selectedDeptId),
      ])
        .then(([detailRes, expRes]) => {
          if (cancelled) return;
          setGaaDetail(detailRes.data.data);
          setGaaExpenseClasses(expRes.data.data || []);
          setDetailFetchedAt(detailRes.fetchedAt);
        })
        .catch((err) => {
          if (cancelled) return;
          setDetailError(err instanceof Error ? err.message : t.common.errorTitle);
        })
        .finally(() => {
          if (!cancelled) setDetailLoading(false);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [selectedDeptId, stage, t.common.errorTitle]);

  useEffect(() => {
    if (stage !== 'gaa' || !selectedDeptId || detailTab !== 'programs') return;
    let cancelled = false;
    setProgramsLoading(true);
    budgetApi
      .getGaaDepartmentPrograms(selectedDeptId, {
        year,
        agencyId: agencyFilter || undefined,
        q: debouncedItemFilter || undefined,
        limit: 20,
      })
      .then((res) => {
        if (cancelled) return;
        setPrograms(res.data.data || []);
        setProgramsMatched(res.data.meta.matched ?? 0);
        setProgramsNextCursor(res.data.next_cursor ?? null);
      })
      .catch(() => {
        if (!cancelled) setPrograms([]);
      })
      .finally(() => {
        if (!cancelled) setProgramsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [stage, selectedDeptId, detailTab, year, agencyFilter, debouncedItemFilter]);

  useEffect(() => {
    if (stage !== 'gaa' || !selectedDeptId || detailTab !== 'objects') return;
    let cancelled = false;
    setObjectsLoading(true);
    budgetApi
      .getGaaDepartmentObjects(selectedDeptId, {
        year,
        agencyId: agencyFilter || undefined,
        q: debouncedItemFilter || undefined,
        limit: 20,
      })
      .then((res) => {
        if (cancelled) return;
        setObjects(res.data.data || []);
        setObjectsMatched(res.data.meta.matched ?? 0);
        setObjectsNextCursor(res.data.next_cursor ?? null);
      })
      .catch(() => {
        if (!cancelled) setObjects([]);
      })
      .finally(() => {
        if (!cancelled) setObjectsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [stage, selectedDeptId, detailTab, year, agencyFilter, debouncedItemFilter]);

  const loadMorePrograms = async () => {
    if (!selectedDeptId || !programsNextCursor || programsLoading) return;
    setProgramsLoading(true);
    try {
      const res = await budgetApi.getGaaDepartmentPrograms(selectedDeptId, {
        year,
        agencyId: agencyFilter || undefined,
        q: debouncedItemFilter || undefined,
        limit: 20,
        cursor: programsNextCursor,
      });
      setPrograms((prev) => [...prev, ...(res.data.data || [])]);
      setProgramsNextCursor(res.data.next_cursor ?? null);
    } finally {
      setProgramsLoading(false);
    }
  };

  const loadMoreObjects = async () => {
    if (!selectedDeptId || !objectsNextCursor || objectsLoading) return;
    setObjectsLoading(true);
    try {
      const res = await budgetApi.getGaaDepartmentObjects(selectedDeptId, {
        year,
        agencyId: agencyFilter || undefined,
        q: debouncedItemFilter || undefined,
        limit: 20,
        cursor: objectsNextCursor,
      });
      setObjects((prev) => [...prev, ...(res.data.data || [])]);
      setObjectsNextCursor(res.data.next_cursor ?? null);
    } finally {
      setObjectsLoading(false);
    }
  };

  const departmentRows = useMemo(() => {
    const base =
      stage === 'nep' && nepOverview
        ? normalizeNepDepartments(nepOverview.departments).map((d) => ({
            id: d.id,
            officialName: d.description,
            displayName: translateDepartment(d.id, d.description, 'nep'),
            amount: d.amount,
            lineItems: d.lineItems,
            baseAmount: d.baseAmount,
            pct: d.pct,
          }))
        : getGaaDepartmentsForYear(gaaDepartments, year).map((d) => ({
            id: d.id,
            officialName: d.description,
            displayName: translateDepartment(d.id, d.description, 'gaa'),
            amount: d.amount,
            lineItems: d.lineItems,
            baseAmount: null as number | null,
            pct: null as number | null,
          }));

    const total = base.reduce((sum, r) => sum + r.amount, 0) || 1;
    const q = deptSearch.trim().toLowerCase();
    const filtered = q
      ? base.filter(
          (r) =>
            r.displayName.toLowerCase().includes(q) ||
            r.officialName.toLowerCase().includes(q) ||
            r.id.toLowerCase().includes(q)
        )
      : base;

    return filtered
      .map((r) => ({ ...r, sharePct: (r.amount / total) * 100 }))
      .sort((a, b) => {
        const mult = sortDir === 'asc' ? 1 : -1;
        if (sortField === 'name') return mult * a.displayName.localeCompare(b.displayName);
        if (sortField === 'lineItems') return mult * (a.lineItems - b.lineItems);
        return mult * (a.amount - b.amount);
      });
  }, [stage, nepOverview, gaaDepartments, year, deptSearch, sortField, sortDir, translateDepartment]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortDir(field === 'name' ? 'asc' : 'desc');
    }
  };

  const sortedGaaYears = useMemo(() => [...gaaYears].sort((a, b) => b - a), [gaaYears]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            {t.explorer.title}
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 max-w-2xl">{t.explorer.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center p-1 bg-slate-100 rounded-md">
            <button
              type="button"
              onClick={() => {
                setStage('gaa');
                setSelectedDeptId(null);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                stage === 'gaa' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              {t.dashboard.legendEnacted}
            </button>
            <button
              type="button"
              disabled={!nepOverview}
              onClick={() => {
                setStage('nep');
                setYear(2027);
                setSelectedDeptId(null);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer disabled:opacity-40 ${
                stage === 'nep' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              FY2027 {t.dashboard.legendProposed}
            </button>
          </div>

          {stage === 'gaa' && (
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
              <span>{t.explorer.yearLabel}:</span>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-xs font-mono font-medium text-slate-900"
              >
                {(sortedGaaYears.length ? sortedGaaYears : [2026, 2025, 2024, 2023, 2022, 2021, 2020]).map(
                  (yr) => (
                    <option key={yr} value={yr}>
                      FY{yr} GAA
                    </option>
                  )
                )}
              </select>
            </label>
          )}
        </div>
      </div>

      {/* Search Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <label htmlFor="dept-filter" className="block text-xs font-semibold text-slate-700 mb-1.5">
            {t.explorer.filterDeptsLabel}
          </label>
          <div className="relative">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              id="dept-filter"
              type="text"
              value={deptSearch}
              onChange={(e) => setDeptSearch(e.target.value)}
              placeholder={t.explorer.filterDeptsPlaceholder}
              className="w-full pl-9 pr-8 py-2 text-sm bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:border-[#26489A] focus:outline-none"
            />
            {deptSearch && (
              <button
                type="button"
                onClick={() => setDeptSearch('')}
                aria-label={t.common.clearFilter}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <label
            htmlFor="program-search"
            className="block text-xs font-semibold text-slate-700 mb-1.5"
          >
            {t.explorer.searchProgramsLabel}
          </label>
          <div className="relative">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              id="program-search"
              type="text"
              disabled={stage !== 'gaa'}
              value={programQuery}
              onChange={(e) => setProgramQuery(e.target.value)}
              placeholder={
                stage === 'gaa'
                  ? t.explorer.searchProgramsPlaceholder
                  : t.explorer.searchProgramsDisabled
              }
              className="w-full pl-9 pr-8 py-2 text-sm bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:border-[#26489A] focus:outline-none disabled:opacity-50"
            />
            {programQuery && (
              <button
                type="button"
                onClick={() => setProgramQuery('')}
                aria-label={t.common.clearFilter}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Cross-department Program Search Results */}
      {stage === 'gaa' && debouncedProgramQuery.length >= 3 && (
        <section className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {t.explorer.programResultsTitle}: &ldquo;{debouncedProgramQuery}&rdquo; (FY{year}{' '}
                GAA)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">{t.explorer.programResultsSubtitle}</p>
            </div>
            <button
              type="button"
              onClick={() => setProgramQuery('')}
              className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
            >
              {t.explorer.closeResults}
            </button>
          </div>

          {programSearchLoading ? (
            <div className="py-6 text-xs text-slate-500">{t.explorer.searchingPrograms}</div>
          ) : programSearchError ? (
            <div className="mt-3">
              <ErrorBanner message={programSearchError} />
            </div>
          ) : programSearchResults.length === 0 ? (
            <div className="py-6 text-sm text-slate-600">{t.explorer.noProgramsMatched}</div>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500">
                    <th className="py-2 pr-4 font-medium">{t.explorer.colProgramName}</th>
                    <th className="py-2 px-4 font-medium">{t.explorer.colDepartment}</th>
                    <th className="py-2 pl-4 font-medium text-right">
                      FY{year} {t.common.allocationPhp}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {programSearchResults.map((prog) => {
                    const yrVal = prog.years?.[String(year)];
                    const hint = translateRecordHint(prog.name);
                    return (
                      <tr key={`${prog.department_id}-${prog.fam_key}`} className="hover:bg-slate-50">
                        <td className="py-2.5 pr-4">
                          {hint && (
                            <div className="text-xs font-medium text-[#26489A] mb-0.5">{hint}</div>
                          )}
                          <div className="font-medium text-slate-900">{prog.name}</div>
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDeptId(prog.department_id);
                              setDetailTab('programs');
                            }}
                            className="text-[#26489A] hover:underline text-left cursor-pointer"
                          >
                            {translateDepartment(
                              prog.department_id,
                              prog.department ?? `Dept ${prog.department_id}`,
                              'gaa'
                            )}
                          </button>
                        </td>
                        <td className="py-2.5 pl-4 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                          {yrVal ? formatPhpCompact(yrVal.amount) : t.common.na}
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
              sourceName: 'BetterGovPH Philippine Budget API',
              datasetName: `GET /api/v1/gaa/search?q=${encodeURIComponent(debouncedProgramQuery)}&year=${year}`,
              period: `FY${year} ${t.common.enactedGaa}`,
              fetchedAt: programSearchFetchedAt ?? undefined,
              units: 'Philippine Pesos (PHP)',
              sourceUrl: `${API_CONFIG.budgetBaseUrl}/gaa/search?q=${encodeURIComponent(debouncedProgramQuery)}&year=${year}`,
            }}
          />
        </section>
      )}

      {error && !gaaDepartments.length ? (
        <ErrorBanner message={error} onRetry={() => void refreshAll()} />
      ) : loading ? (
        <TableSkeleton rows={10} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Department Table */}
          <div
            className={`${
              selectedDeptId ? 'lg:col-span-6' : 'lg:col-span-12'
            } bg-white border border-slate-200 rounded-lg overflow-hidden`}
          >
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700">
                {stage === 'nep' ? 'FY2027 NEP' : `FY${year} GAA`} {t.explorer.tableHeaderDepts}{' '}
                <span className="font-normal text-slate-500">
                  ({departmentRows.length} {t.explorer.shownSuffix})
                </span>
              </span>
              <span className="text-xs text-slate-500">{t.explorer.clickRowHint}</span>
            </div>

            {departmentRows.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title={t.explorer.noMatchingDeptsTitle}
                  description={t.explorer.noMatchingDeptsDesc}
                  actionLabel={t.common.clearFilter}
                  onAction={() => setDeptSearch('')}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs text-slate-500 bg-white">
                      <th className="py-2.5 pl-4 pr-2 font-medium">
                        <button
                          type="button"
                          onClick={() => toggleSort('name')}
                          className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                        >
                          {t.explorer.colDeptFund}
                          {sortField === 'name' &&
                            (sortDir === 'asc' ? (
                              <ArrowUp className="w-3 h-3" />
                            ) : (
                              <ArrowDown className="w-3 h-3" />
                            ))}
                        </button>
                      </th>
                      <th className="py-2.5 px-3 font-medium text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => toggleSort('amount')}
                          className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                        >
                          {t.common.allocationPhp}
                          {sortField === 'amount' &&
                            (sortDir === 'asc' ? (
                              <ArrowUp className="w-3 h-3" />
                            ) : (
                              <ArrowDown className="w-3 h-3" />
                            ))}
                        </button>
                      </th>
                      {!selectedDeptId && (
                        <>
                          <th className="py-2.5 px-3 font-medium text-right whitespace-nowrap">
                            {t.common.share}
                          </th>
                          <th className="py-2.5 px-3 font-medium text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => toggleSort('lineItems')}
                              className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                            >
                              {t.common.lineItems}
                              {sortField === 'lineItems' &&
                                (sortDir === 'asc' ? (
                                  <ArrowUp className="w-3 h-3" />
                                ) : (
                                  <ArrowDown className="w-3 h-3" />
                                ))}
                            </button>
                          </th>
                        </>
                      )}
                      <th className="py-2.5 pr-4 pl-2 w-8" aria-label="Inspect" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {departmentRows.map((dept) => {
                      const isSelected = selectedDeptId === dept.id;
                      return (
                        <tr
                          key={dept.id}
                          onClick={() => {
                            setSelectedDeptId(dept.id);
                            setDetailTab('agencies');
                          }}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-blue-50/80' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="py-2.5 pl-4 pr-2">
                            <div className="font-medium text-slate-900 leading-snug">
                              {dept.displayName}
                            </div>
                            <div className="text-xs text-slate-500">
                              <span className="font-mono">
                                {t.common.codePrefix} {dept.id}
                              </span>
                              {language !== 'en' && dept.displayName !== dept.officialName && (
                                <span> · {dept.officialName}</span>
                              )}
                              {stage === 'nep' && dept.pct !== null && (
                                <span className="font-mono">
                                  {' '}
                                  · {formatSignedPercent(dept.pct, 1)} vs FY26
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                            <div className="font-medium">{formatPhpCompact(dept.amount)}</div>
                            {!selectedDeptId && (
                              <div className="text-xs text-slate-500">
                                {formatPhpExact(dept.amount)}
                              </div>
                            )}
                          </td>
                          {!selectedDeptId && (
                            <>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                                {formatPercent(dept.sharePct, 2)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                                {formatNumber(dept.lineItems)}
                              </td>
                            </>
                          )}
                          <td className="py-2.5 pr-4 pl-2 text-right text-slate-400">
                            <ChevronRight className="w-4 h-4 inline-block" aria-hidden="true" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="px-4 pb-4">
              <SourcePanel
                source={{
                  sourceName: 'BetterGovPH Philippine Budget API',
                  datasetName:
                    stage === 'nep' ? 'GET /api/v1/nep/2027' : 'GET /api/v1/gaa/departments',
                  period:
                    stage === 'nep'
                      ? `FY2027 ${t.common.proposedNep}`
                      : `FY${year} ${t.common.enactedGaa}`,
                  fetchedAt: fetchedAt ?? undefined,
                  units: 'Philippine Pesos (PHP)',
                  sourceUrl:
                    stage === 'nep'
                      ? `${API_CONFIG.budgetBaseUrl}/nep/2027`
                      : `${API_CONFIG.budgetBaseUrl}/gaa/departments`,
                }}
              />
            </div>
          </div>

          {/* Drill-Down Detail Panel */}
          {selectedDeptId && (
            <section className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-5">
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-200">
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">
                    {t.common.codePrefix} {selectedDeptId} ·{' '}
                    {stage === 'nep'
                      ? `FY2027 ${t.common.proposedNep}`
                      : `FY${year} ${t.common.enactedGaa}`}
                  </p>
                  <h2 className="text-lg font-semibold text-slate-900 mt-0.5">
                    {stage === 'nep'
                      ? nepDetail
                        ? translateDepartment(
                            nepDetail.department.id,
                            nepDetail.department.description,
                            'nep'
                          )
                        : t.explorer.loadingDept
                      : gaaDetail
                        ? translateDepartment(
                            gaaDetail.department.id,
                            gaaDetail.department.description,
                            'gaa'
                          )
                        : t.explorer.loadingDept}
                  </h2>
                  {language !== 'en' && (gaaDetail || nepDetail) && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {t.common.officialSourceName}:{' '}
                      {stage === 'nep'
                        ? nepDetail?.department.description
                        : gaaDetail?.department.description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDeptId(null)}
                  aria-label={t.common.close}
                  className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {detailLoading ? (
                <div className="py-10 text-sm text-slate-500">
                  {t.explorer.loadingDeptBreakdown}
                </div>
              ) : detailError ? (
                <div className="mt-4">
                  <ErrorBanner message={detailError} />
                </div>
              ) : stage === 'nep' && nepDetail ? (
                <div className="mt-4 space-y-5">
                  <div className="grid grid-cols-2 gap-3 pb-4 border-b border-slate-100">
                    <div>
                      <span className="text-xs text-slate-500">
                        FY2027 {t.common.proposedNep}
                      </span>
                      <p className="font-mono text-lg font-semibold text-slate-900 tabular-nums mt-0.5">
                        {formatPhpCompact(nepDetail.department.amount)}
                      </p>
                      <p className="font-mono text-xs text-slate-500 tabular-nums">
                        {formatPhpExact(nepDetail.department.amount)}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500">{t.explorer.changeVsFy26}</span>
                      <p
                        className={`font-mono text-lg font-semibold tabular-nums mt-0.5 ${
                          nepDetail.department.delta >= 0 ? 'text-[#15803D]' : 'text-[#B91C1C]'
                        }`}
                      >
                        {formatSignedPercent(nepDetail.department.pct, 1)}
                      </p>
                      <p className="font-mono text-xs text-slate-500 tabular-nums">
                        {formatSignedPhpCompact(nepDetail.department.delta)}
                      </p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold text-slate-700 mb-2">
                      {t.explorer.attachedAgencies} ({nepDetail.agencies.length})
                    </h3>
                    <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-md">
                      {nepDetail.agencies.map((ag) => {
                        const hint = translateRecordHint(ag.description);
                        return (
                          <div
                            key={ag.code}
                            className="px-3 py-2.5 flex items-start justify-between gap-3 text-xs"
                          >
                            <div className="min-w-0">
                              {hint && (
                                <p className="text-[#26489A] font-medium mb-0.5">{hint}</p>
                              )}
                              <p className="font-medium text-slate-900">{ag.description}</p>
                              <p className="text-slate-500 font-mono mt-0.5">
                                {t.explorer.agencyPrefix} {ag.code} · {formatNumber(ag.count)}{' '}
                                {t.explorer.itemsSuffix}
                              </p>
                            </div>
                            <div className="text-right font-mono tabular-nums shrink-0">
                              <div className="font-medium text-slate-900">
                                {formatPhpCompact(ag.amount)}
                              </div>
                              <div
                                className={
                                  ag.delta >= 0 ? 'text-[#15803D]' : 'text-[#B91C1C]'
                                }
                              >
                                {formatSignedPercent(ag.pct, 1)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <SourcePanel
                    source={{
                      sourceName: 'BetterGovPH Philippine Budget API',
                      datasetName: `GET /api/v1/nep/2027/departments/${selectedDeptId}`,
                      period: 'FY2027 NEP vs FY2026 GAA',
                      fetchedAt: detailFetchedAt ?? undefined,
                      units: 'Philippine Pesos (PHP)',
                      sourceUrl: `${API_CONFIG.budgetBaseUrl}/nep/2027/departments/${selectedDeptId}`,
                    }}
                  />
                </div>
              ) : gaaDetail ? (
                <div className="mt-4 space-y-5">
                  <div className="grid grid-cols-2 gap-3 pb-4 border-b border-slate-100">
                    <div>
                      <span className="text-xs text-slate-500">
                        FY{year} {t.common.enactedGaa}
                      </span>
                      <p className="font-mono text-lg font-semibold text-slate-900 tabular-nums mt-0.5">
                        {formatPhpCompact(gaaDetail.department.years?.[String(year)]?.amount)}
                      </p>
                      <p className="font-mono text-xs text-slate-500 tabular-nums">
                        {formatPhpExact(gaaDetail.department.years?.[String(year)]?.amount)}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500">{t.explorer.structureLabel}</span>
                      <p className="font-mono text-lg font-semibold text-slate-900 tabular-nums mt-0.5">
                        {gaaDetail.agencies.length} {t.explorer.agenciesCount}
                      </p>
                      <p className="font-mono text-xs text-slate-500 tabular-nums">
                        {formatNumber(gaaDetail.department.years?.[String(year)]?.count)}{' '}
                        {t.explorer.itemsSuffix}
                      </p>
                    </div>
                  </div>

                  {gaaExpenseClasses.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1">
                        <span>
                          FY{year} {t.explorer.expenseClassesTitle}
                        </span>
                        <GlossaryTooltip termKey="MOOE" />
                      </h3>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {gaaExpenseClasses.map((ec) => {
                          const amt = ec.years?.[String(year)]?.amount ?? 0;
                          const deptTotal = gaaDetail.department.years?.[String(year)]?.amount || 1;
                          const label = translateExpenseClass(ec.expense_code, ec.label);
                          return (
                            <div
                              key={ec.expense_code}
                              className="border border-slate-200 rounded-md px-3 py-2 bg-slate-50/50"
                            >
                              <div className="text-slate-600 truncate" title={label}>
                                {label}
                              </div>
                              <div className="font-mono font-semibold text-slate-900 tabular-nums mt-0.5">
                                {formatPhpCompact(amt)}{' '}
                                <span className="text-slate-500 font-normal">
                                  ({formatPercent((amt / deptTotal) * 100, 1)})
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
                    {(
                      [
                        {
                          id: 'agencies',
                          label: `${t.explorer.tabAgencies} (${gaaDetail.agencies.length})`,
                        },
                        { id: 'programs', label: t.explorer.tabPrograms },
                        { id: 'objects', label: t.explorer.tabObjects },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setDetailTab(tab.id)}
                        className={`flex-1 px-2.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                          detailTab === tab.id
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {detailTab !== 'agencies' && (
                    <div className="flex flex-col sm:flex-row gap-2">
                      {gaaDetail.agencies.length > 1 && (
                        <select
                          aria-label={t.explorer.allAttachedAgencies}
                          value={agencyFilter}
                          onChange={(e) => setAgencyFilter(e.target.value)}
                          className="sm:w-1/2 bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-800"
                        >
                          <option value="">{t.explorer.allAttachedAgencies}</option>
                          {gaaDetail.agencies.map((ag) => (
                            <option key={ag.id} value={ag.id}>
                              {ag.description}
                            </option>
                          ))}
                        </select>
                      )}
                      <input
                        type="text"
                        value={itemFilterInput}
                        onChange={(e) => setItemFilterInput(e.target.value)}
                        placeholder={
                          detailTab === 'programs'
                            ? t.explorer.filterProgramsPlaceholder
                            : t.explorer.filterObjectsPlaceholder
                        }
                        className="flex-1 bg-slate-50 border border-slate-300 rounded-md px-3 py-1.5 text-xs focus:bg-white focus:border-[#26489A] focus:outline-none"
                      />
                    </div>
                  )}

                  {detailTab === 'agencies' && (
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-md">
                      {gaaDetail.agencies
                        .slice()
                        .sort(
                          (a, b) =>
                            (b.years?.[String(year)]?.amount ?? 0) -
                            (a.years?.[String(year)]?.amount ?? 0)
                        )
                        .map((ag) => {
                          const amt = ag.years?.[String(year)]?.amount ?? 0;
                          const cnt = ag.years?.[String(year)]?.count ?? 0;
                          const hint = translateRecordHint(ag.description);
                          return (
                            <button
                              key={ag.id}
                              type="button"
                              onClick={() => {
                                setAgencyFilter(ag.id);
                                setDetailTab('programs');
                              }}
                              className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-start justify-between gap-3 text-xs cursor-pointer"
                            >
                              <div className="min-w-0">
                                {hint && (
                                  <p className="text-[#26489A] font-medium mb-0.5">{hint}</p>
                                )}
                                <p className="font-medium text-slate-900">{ag.description}</p>
                                <p className="text-slate-500 font-mono mt-0.5">
                                  {ag.id} · {formatNumber(cnt)} {t.explorer.itemsSuffix}
                                </p>
                              </div>
                              <div className="text-right font-mono tabular-nums font-medium text-slate-900 shrink-0">
                                {formatPhpCompact(amt)}
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  )}

                  {detailTab === 'programs' && (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-500 tabular-nums">
                        {programs.length} / {formatNumber(programsMatched)}{' '}
                        {t.explorer.showingMatchedPrograms} (FY{year})
                      </p>
                      <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-md">
                        {programsLoading && programs.length === 0 ? (
                          <div className="p-4 text-xs text-slate-500">{t.common.loading}</div>
                        ) : programs.length === 0 ? (
                          <div className="p-4 text-xs text-slate-500">
                            {t.explorer.noProgramsYear}
                          </div>
                        ) : (
                          programs.map((p) => {
                            const amt = p.years?.[String(year)]?.amount ?? 0;
                            const hint = translateRecordHint(p.name);
                            return (
                              <div
                                key={`${p.agency_id}-${p.fam_key}`}
                                className="px-3 py-2.5 flex items-start justify-between gap-3 text-xs"
                              >
                                <div className="min-w-0">
                                  {hint && (
                                    <p className="text-[#26489A] font-medium mb-0.5">{hint}</p>
                                  )}
                                  <p className="font-medium text-slate-900 leading-snug">
                                    {p.name}
                                  </p>
                                  <p className="text-slate-500 font-mono mt-0.5">
                                    {t.explorer.agencyPrefix} {p.agency_id} ·{' '}
                                    {formatNumber(p.years?.[String(year)]?.count)}{' '}
                                    {t.explorer.itemsSuffix}
                                  </p>
                                </div>
                                <div className="text-right font-mono tabular-nums font-medium text-slate-900 shrink-0">
                                  {formatPhpCompact(amt)}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                      {programsNextCursor && (
                        <button
                          type="button"
                          onClick={() => void loadMorePrograms()}
                          disabled={programsLoading}
                          className="w-full py-2 text-xs font-medium text-[#26489A] bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {programsLoading ? t.explorer.loadingMore : t.explorer.loadMorePrograms}
                        </button>
                      )}
                    </div>
                  )}

                  {detailTab === 'objects' && (
                    <div className="space-y-2">
                      <NoticeStrip tone="info" message={t.explorer.paginationNotice} />
                      <p className="text-xs text-slate-500 tabular-nums">
                        {objects.length} / {formatNumber(objectsMatched)}{' '}
                        {t.explorer.showingMatchedObjects} (FY{year})
                      </p>
                      <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-md">
                        {objectsLoading && objects.length === 0 ? (
                          <div className="p-4 text-xs text-slate-500">{t.common.loading}</div>
                        ) : objects.length === 0 ? (
                          <div className="p-4 text-xs text-slate-500">
                            {t.explorer.noObjectsYear}
                          </div>
                        ) : (
                          objects.map((obj) => {
                            const amt = obj.years?.[String(year)]?.amount ?? 0;
                            const hint = translateRecordHint(obj.description);
                            return (
                              <div
                                key={obj.id}
                                className="px-3 py-2.5 flex items-start justify-between gap-3 text-xs"
                              >
                                <div className="min-w-0">
                                  {hint && (
                                    <p className="text-[#26489A] font-medium mb-0.5">{hint}</p>
                                  )}
                                  <p className="font-medium text-slate-900 leading-snug">
                                    {obj.description}
                                  </p>
                                  <p className="text-slate-500 font-mono mt-0.5 truncate">
                                    {t.explorer.objectPrefix} {obj.object_code} ·{' '}
                                    {t.explorer.agencyPrefix} {obj.agency_id}
                                  </p>
                                </div>
                                <div className="text-right font-mono tabular-nums font-medium text-slate-900 shrink-0">
                                  <div>{formatPhpCompact(amt)}</div>
                                  <div className="text-[11px] text-slate-500 font-normal">
                                    {formatPhpExact(amt)}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                      {objectsNextCursor && (
                        <button
                          type="button"
                          onClick={() => void loadMoreObjects()}
                          disabled={objectsLoading}
                          className="w-full py-2 text-xs font-medium text-[#26489A] bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {objectsLoading ? t.explorer.loadingMore : t.explorer.loadMoreObjects}
                        </button>
                      )}
                    </div>
                  )}

                  <SourcePanel
                    source={{
                      sourceName: 'BetterGovPH Philippine Budget API',
                      datasetName: `GET /api/v1/gaa/departments/${selectedDeptId}`,
                      period: `FY${year} ${t.common.enactedGaa}`,
                      fetchedAt: detailFetchedAt ?? undefined,
                      units: 'Philippine Pesos (PHP)',
                      sourceUrl: `${API_CONFIG.budgetBaseUrl}/gaa/departments/${selectedDeptId}`,
                    }}
                  />
                </div>
              ) : null}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
