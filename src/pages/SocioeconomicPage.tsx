import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { ExternalLink, RefreshCw, Search } from 'lucide-react';
import { SourcePanel } from '../components/SourcePanel';
import { ErrorBanner, KpiSkeletonGrid, NoticeStrip, PanelSkeleton } from '../components/States';
import { API_CONFIG, REGION_SHORT_NAMES } from '../config/constants';
import { useBudgetData } from '../hooks/useBudgetData';
import { useLanguage } from '../i18n/LanguageContext';
import {
  type NationalPopulationSeries,
  type RegionalPopulationRecord,
  type RegionalPovertyBundle,
  type RegionalUnemploymentBundle,
  statisticsApi,
} from '../services/statisticsApi';
import type { StatsCoverage, StatsDatasetSummary } from '../types/budget';
import { calculatePerCapita } from '../utils/calculations';
import {
  formatDateOnly,
  formatNumber,
  formatPercent,
  formatPhpCompact,
  formatPhpPerCapita,
  formatPopulationCompact,
} from '../utils/formatting';

export function SocioeconomicPage() {
  const {
    gaaNational,
    nepOverview,
    nepRegions,
    nepRegionsLoading,
    nepRegionsError,
    nepRegionsFetchedAt,
    loadNepRegions,
  } = useBudgetData();
  const { language, t, translateRegion, translateRecordHint } = useLanguage();

  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [statsFetchedAt, setStatsFetchedAt] = useState<string | null>(null);

  const [coverage, setCoverage] = useState<StatsCoverage | null>(null);
  const [natPop, setNatPop] = useState<NationalPopulationSeries | null>(null);
  const [psgcRegions, setPsgcRegions] = useState<RegionalPopulationRecord[]>([]);
  const [poverty, setPoverty] = useState<RegionalPovertyBundle | null>(null);
  const [unemployment, setUnemployment] = useState<RegionalUnemploymentBundle | null>(null);

  // Exclude NCR from regional scatter/bar charts by default due to headquarters booking effect
  const [excludeNcrInChart, setExcludeNcrInChart] = useState(true);

  // OpenSTAT catalog discovery search
  const [catalogQuery, setCatalogQuery] = useState('');
  const [debouncedCatalogQuery, setDebouncedCatalogQuery] = useState('');
  const [catalogResults, setCatalogResults] = useState<StatsDatasetSummary[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  const loadSocioeconomicData = useCallback(
    async (force = false) => {
      setStatsLoading(true);
      setStatsError(null);
      try {
        void loadNepRegions(force);
        const [covRes, natPopRes, psgcRes, povRes, unempRes] = await Promise.all([
          statisticsApi.getCoverage(force),
          statisticsApi.getNationalPopulationSeries(force),
          statisticsApi.getPsgcRegionalPopulations(force),
          statisticsApi.getRegionalPoverty(force),
          statisticsApi.getRegionalUnemployment(force),
        ]);
        setCoverage(covRes.data);
        setNatPop(natPopRes.data);
        setPsgcRegions(psgcRes.data.regions);
        setPoverty(povRes.data);
        setUnemployment(unempRes.data);
        setStatsFetchedAt(natPopRes.fetchedAt);
      } catch (err) {
        setStatsError(
          err instanceof Error
            ? err.message
            : 'Unable to load socioeconomic indicators from Philippine Data Explorer.'
        );
      } finally {
        setStatsLoading(false);
      }
    },
    [loadNepRegions]
  );

  useEffect(() => {
    void loadSocioeconomicData(false);
  }, [loadSocioeconomicData]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedCatalogQuery(catalogQuery.trim()), 400);
    return () => window.clearTimeout(timer);
  }, [catalogQuery]);

  useEffect(() => {
    if (debouncedCatalogQuery.length < 3) {
      setCatalogResults([]);
      return;
    }
    let cancelled = false;
    setCatalogLoading(true);
    statisticsApi
      .searchDatasets(debouncedCatalogQuery, 8)
      .then((res) => {
        if (!cancelled) setCatalogResults(res.data || []);
      })
      .catch(() => {
        if (!cancelled) setCatalogResults([]);
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedCatalogQuery]);

  // 1. Validated National Budget Per Capita series (FY2020–FY2026 GAA + FY2027 NEP)
  const nationalPerCapitaSeries = useMemo(() => {
    if (!natPop) return [];
    const rows: Array<{
      key: string;
      label: string;
      stage: 'gaa' | 'nep';
      stageLabel: string;
      year: number;
      budgetPhp: number;
      population: number | null;
      perCapitaPhp: number | null;
    }> = gaaNational
      .slice()
      .sort((a, b) => a.year - b.year)
      .map((item) => {
        const pop = natPop.byYear[item.year] ?? null;
        const perCapita = calculatePerCapita(item.amount, pop);
        return {
          key: `gaa-${item.year}`,
          label: `FY${item.year}`,
          stage: 'gaa',
          stageLabel: t.common.enactedGaa,
          year: item.year,
          budgetPhp: item.amount,
          population: pop,
          perCapitaPhp: perCapita,
        };
      });

    if (nepOverview) {
      const pop2027 = natPop.byYear[nepOverview.fiscalYear] ?? null;
      rows.push({
        key: `nep-${nepOverview.fiscalYear}`,
        label: `FY${nepOverview.fiscalYear} NEP`,
        stage: 'nep',
        stageLabel: t.common.proposedNep,
        year: nepOverview.fiscalYear,
        budgetPhp: nepOverview.national.amount,
        population: pop2027,
        perCapitaPhp: calculatePerCapita(nepOverview.national.amount, pop2027),
      });
    }
    return rows;
  }, [gaaNational, nepOverview, natPop, t.common.enactedGaa, t.common.proposedNep]);

  // 2. Regional comparison table joining NEP FY2027 regionalized allocations + 2024 Census + 2023 Poverty + 2025 Unemployment
  const { centralOfficeRow, regionalRows } = useMemo(() => {
    const central = nepRegions.find((r) => r.code === '00') ?? null;
    const popByReg = new Map(psgcRegions.map((p) => [p.regCode, p]));

    const rows = nepRegions
      .filter((r) => r.code !== '00')
      .map((r) => {
        const psgc = popByReg.get(r.code);
        const pov = poverty?.byRegion[r.code];
        const unemp = unemployment?.byRegion[r.code];
        const pop2024 = psgc?.pop2024 ?? null;
        // Regionalized allocation per 2024 census resident (explicitly excluding Central Office)
        const perResident = calculatePerCapita(r.amount, pop2024);
        const fallbackName = REGION_SHORT_NAMES[r.code] ?? r.description;

        return {
          code: r.code,
          name: translateRegion(r.code, fallbackName),
          officialName: fallbackName,
          fullName: r.description,
          islandGroup: psgc?.islandGroup ?? '',
          nep2027Amount: r.amount,
          gaa2026Base: r.base_amount,
          pop2024,
          perResidentPhp: perResident,
          povertyIncidence2023: pov?.povertyIncidence2023 ?? null,
          povertyThreshold2023: pov?.povertyThreshold2023 ?? null,
          unemploymentRate2025: unemp?.rate ?? null,
          isNcr: r.code === '13',
          isNir: r.code === '18',
        };
      })
      .sort((a, b) => (b.pop2024 ?? 0) - (a.pop2024 ?? 0));

    return { centralOfficeRow: central, regionalRows: rows };
  }, [nepRegions, psgcRegions, poverty, unemployment, translateRegion]);

  const scatterData = useMemo(() => {
    return regionalRows
      .filter((r) => {
        if (excludeNcrInChart && r.isNcr) return false;
        return r.perResidentPhp !== null && r.povertyIncidence2023 !== null;
      })
      .map((r) => ({
        code: r.code,
        name: r.name,
        povertyPct: r.povertyIncidence2023 as number,
        perResidentPhp: Math.round(r.perResidentPhp as number),
        popMillions: Number(((r.pop2024 ?? 0) / 1_000_000).toFixed(2)),
        nep2027Amount: r.nep2027Amount,
      }));
  }, [regionalRows, excludeNcrInChart]);

  const latestGaaPerCapita = nationalPerCapitaSeries.find((r) => r.stage === 'gaa' && r.year === 2026);
  const nep2027PerCapita = nationalPerCapitaSeries.find((r) => r.stage === 'nep');

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            {t.socioeconomic.title}
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 max-w-2xl">
            {t.socioeconomic.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500">
          {coverage?.dataUpdated && (
            <span>
              {t.socioeconomic.snapshotUpdated} {formatDateOnly(coverage.dataUpdated)}
            </span>
          )}
          <button
            type="button"
            onClick={() => void loadSocioeconomicData(true)}
            disabled={statsLoading || nepRegionsLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${statsLoading || nepRegionsLoading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            {t.common.refreshStats}
          </button>
        </div>
      </div>

      <NoticeStrip tone="caution" message={t.socioeconomic.boundaryNotice} />

      {statsError ? (
        <ErrorBanner
          title={t.common.errorTitle}
          message={statsError}
          onRetry={() => void loadSocioeconomicData(true)}
        />
      ) : statsLoading ? (
        <div className="space-y-6">
          <KpiSkeletonGrid count={4} />
          <PanelSkeleton heightClass="h-72" />
        </div>
      ) : (
        <>
          {/* National Socioeconomic Snapshot Cards */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <p className="text-xs text-slate-500">{t.socioeconomic.kpiGaaPerCapita}</p>
              <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                {formatPhpPerCapita(latestGaaPerCapita?.perCapitaPhp)}
              </p>
              <p className="mt-1 text-xs text-slate-500 tabular-nums">
                {t.socioeconomic.basedOnPop}: {formatPopulationCompact(latestGaaPerCapita?.population)}
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <p className="text-xs text-slate-500">{t.socioeconomic.kpiNepPerCapita}</p>
              <p className="mt-2 font-mono text-2xl font-semibold text-[#0F766E] tabular-nums">
                {formatPhpPerCapita(nep2027PerCapita?.perCapitaPhp)}
              </p>
              <p className="mt-1 text-xs text-slate-500 tabular-nums">
                {t.socioeconomic.basedOnPop}: {formatPopulationCompact(nep2027PerCapita?.population)}
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <p className="text-xs text-slate-500">{t.socioeconomic.kpiPoverty2023}</p>
              <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                {formatPercent(poverty?.national.povertyIncidence2023, 1)}
              </p>
              <p className="mt-1 text-xs text-slate-500 tabular-nums">
                {t.socioeconomic.thresholdLabel}: {formatPhpPerCapita(poverty?.national.povertyThreshold2023)}{' '}
                {t.socioeconomic.perPerson}
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <p className="text-xs text-slate-500">{t.socioeconomic.kpiUnemployment2025}</p>
              <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                {formatPercent(unemployment?.nationalRate, 1)}
              </p>
              <p className="mt-1 text-xs text-slate-500">{t.socioeconomic.unempSourceNote}</p>
            </div>
          </section>

          {/* Section 1: National Budget Per Capita */}
          <section className="bg-white border border-slate-200 rounded-lg p-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {t.socioeconomic.perCapitaTitle}
              </h2>
              <p className="text-xs text-slate-500 mt-1 max-w-3xl">
                {t.socioeconomic.perCapitaSubtitle}
              </p>
            </div>

            <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-7 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={nationalPerCapitaSeries}
                    margin={{ top: 10, right: 12, left: 4, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: '#475569' }}
                      axisLine={{ stroke: '#CBD5E1' }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 'auto']}
                      tickFormatter={(v: number) => `₱${(v / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 11, fill: '#475569' }}
                      axisLine={false}
                      tickLine={false}
                      width={52}
                    />
                    <Tooltip
                      cursor={{ fill: '#F1F5F9' }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const r = payload[0].payload as (typeof nationalPerCapitaSeries)[number];
                        return (
                          <div className="bg-white border border-slate-200 rounded-md shadow-md p-3 text-xs">
                            <p className="font-semibold text-slate-900">
                              FY{r.year} · {r.stageLabel}
                            </p>
                            <p className="font-mono text-slate-900 mt-1 tabular-nums">
                              {formatPhpPerCapita(r.perCapitaPhp)} {t.socioeconomic.perPerson}
                            </p>
                            <p className="text-slate-500 mt-0.5 tabular-nums">
                              {t.socioeconomic.colBudget}: {formatPhpCompact(r.budgetPhp)} ·{' '}
                              {t.socioeconomic.colProjectedPop}: {formatPopulationCompact(r.population)}
                            </p>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="perCapitaPhp" radius={[3, 3, 0, 0]}>
                      {nationalPerCapitaSeries.map((entry) => (
                        <Cell
                          key={entry.key}
                          fill={entry.stage === 'nep' ? '#0F766E' : '#26489A'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="lg:col-span-5 overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 pr-2 font-medium">{t.socioeconomic.colFiscalYear}</th>
                      <th className="py-2 px-2 font-medium text-right">{t.socioeconomic.colBudget}</th>
                      <th className="py-2 px-2 font-medium text-right">{t.socioeconomic.colProjectedPop}</th>
                      <th className="py-2 pl-2 font-medium text-right">{t.socioeconomic.colPerCapita}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {nationalPerCapitaSeries.map((r) => (
                      <tr key={r.key} className="hover:bg-slate-50">
                        <td className="py-2 pr-2 font-medium text-slate-900 whitespace-nowrap">
                          {r.label}
                        </td>
                        <td className="py-2 px-2 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                          {formatPhpCompact(r.budgetPhp)}
                        </td>
                        <td className="py-2 px-2 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                          {formatNumber(r.population)}
                        </td>
                        <td className="py-2 pl-2 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                          {formatPhpPerCapita(r.perCapitaPhp)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <SourcePanel
              source={{
                sourceName: 'BetterGovPH Budget API & Philippine Data Explorer (PSA OpenSTAT)',
                datasetName:
                  'GET /api/v1/gaa, /api/v1/nep/2027 & PSA Dataset 7721a9fbb98bc87084b2 (2020 CPH-Based Single-Year Population Projections)',
                period: 'FY2020–FY2027',
                fetchedAt: statsFetchedAt ?? undefined,
                sourceUpdated: natPop?.sourceUpdated ?? null,
                units: `PHP ${t.socioeconomic.perPerson}`,
                method: t.methodology.perCapitaBody,
                sourceUrl: natPop?.sourceUrl ?? API_CONFIG.statsDocsUrl,
                secondaryUrl: `${API_CONFIG.budgetBaseUrl}/gaa`,
                secondaryLabel: t.footer.budgetApiLink,
              }}
            />
          </section>

          {/* Section 2: Regionalized Allocations alongside Census, Poverty & Unemployment */}
          <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {t.socioeconomic.regionalTitle}
                </h2>
                <p className="text-xs text-slate-500 mt-1 max-w-3xl">
                  {t.socioeconomic.regionalSubtitle}
                </p>
              </div>

              <label className="inline-flex items-center gap-2 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-md px-3 py-2 shrink-0 cursor-pointer">
                <input
                  type="checkbox"
                  checked={excludeNcrInChart}
                  onChange={(e) => setExcludeNcrInChart(e.target.checked)}
                  className="rounded border-slate-300 text-[#26489A]"
                />
                <span>{t.socioeconomic.excludeNcrLabel}</span>
              </label>
            </div>

            {nepRegionsError ? (
              <ErrorBanner
                title={t.common.errorTitle}
                message={nepRegionsError}
                onRetry={() => void loadNepRegions(true)}
              />
            ) : nepRegionsLoading && regionalRows.length === 0 ? (
              <PanelSkeleton heightClass="h-64" />
            ) : (
              <>
                {/* Central Office separation notice */}
                {centralOfficeRow && (
                  <div className="bg-slate-50 border border-slate-200 rounded-md p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {t.socioeconomic.centralOfficeTitle}
                      </p>
                      <p className="text-slate-600 mt-0.5 leading-relaxed max-w-3xl">
                        <strong>{formatPhpCompact(centralOfficeRow.amount)}</strong> (
                        {formatPercent(
                          (centralOfficeRow.amount / (nepOverview?.national.amount || 1)) * 100,
                          1
                        )}{' '}
                        FY2027 NEP) {t.socioeconomic.centralOfficeBody}
                      </p>
                    </div>
                  </div>
                )}

                {/* Descriptive Scatter Plot */}
                {scatterData.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">
                      {t.socioeconomic.scatterTitle}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {t.socioeconomic.scatterSubtitle}
                    </p>
                    <div className="mt-4 h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 12, right: 20, bottom: 20, left: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                          <XAxis
                            type="number"
                            dataKey="povertyPct"
                            name={t.socioeconomic.colPoverty2023}
                            unit="%"
                            domain={[0, 'auto']}
                            tick={{ fontSize: 11, fill: '#475569' }}
                            label={{
                              value: t.socioeconomic.scatterXLabel,
                              position: 'insideBottom',
                              offset: -10,
                              style: { fontSize: 11, fill: '#475569' },
                            }}
                          />
                          <YAxis
                            type="number"
                            dataKey="perResidentPhp"
                            name={t.socioeconomic.colRatio2024}
                            domain={[0, 'auto']}
                            tickFormatter={(v: number) => `₱${(v / 1000).toFixed(0)}k`}
                            tick={{ fontSize: 11, fill: '#475569' }}
                            width={58}
                          />
                          <ZAxis type="number" dataKey="popMillions" range={[55, 260]} />
                          <Tooltip
                            cursor={{ strokeDasharray: '3 3' }}
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null;
                              const d = payload[0].payload as (typeof scatterData)[number];
                              return (
                                <div className="bg-white border border-slate-200 rounded-md shadow-md p-3 text-xs">
                                  <p className="font-semibold text-slate-900">{d.name}</p>
                                  <p className="font-mono text-slate-800 mt-1 tabular-nums">
                                    {t.socioeconomic.colRatio2024}: {formatPhpPerCapita(d.perResidentPhp)}
                                  </p>
                                  <p className="font-mono text-slate-700 tabular-nums">
                                    {t.socioeconomic.colPoverty2023}: {formatPercent(d.povertyPct, 1)}
                                  </p>
                                  <p className="text-slate-500 mt-0.5 tabular-nums">
                                    {t.socioeconomic.colPop2024}: {d.popMillions}M ·{' '}
                                    {t.socioeconomic.colNep2027Reg}: {formatPhpCompact(d.nep2027Amount)}
                                  </p>
                                </div>
                              );
                            }}
                          />
                          <Scatter name={t.socioeconomic.colRegion18} data={scatterData} fill="#26489A" fillOpacity={0.78} />
                        </ScatterChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Full 18-Region Comparative Table */}
                <div className="overflow-x-auto border border-slate-200 rounded-md">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                        <th className="py-2.5 pl-3 pr-2 font-medium">{t.socioeconomic.colRegion18}</th>
                        <th className="py-2.5 px-2 font-medium text-right whitespace-nowrap">
                          {t.socioeconomic.colPop2024}
                        </th>
                        <th className="py-2.5 px-2 font-medium text-right whitespace-nowrap">
                          {t.socioeconomic.colNep2027Reg}
                        </th>
                        <th className="py-2.5 px-2 font-medium text-right whitespace-nowrap">
                          {t.socioeconomic.colRatio2024}
                        </th>
                        <th className="py-2.5 px-2 font-medium text-right whitespace-nowrap">
                          {t.socioeconomic.colPoverty2023}
                        </th>
                        <th className="py-2.5 px-2 font-medium text-right whitespace-nowrap">
                          {t.socioeconomic.colThreshold2023}
                        </th>
                        <th className="py-2.5 pl-2 pr-3 font-medium text-right whitespace-nowrap">
                          {t.socioeconomic.colUnemp2025}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {regionalRows.map((r) => (
                        <tr key={r.code} className="hover:bg-slate-50/70">
                          <td className="py-2.5 pl-3 pr-2">
                            <span className="font-medium text-slate-900">{r.name}</span>
                            {language !== 'en' && r.name !== r.officialName && (
                              <span className="block text-[11px] text-slate-400">
                                {r.officialName}
                              </span>
                            )}
                            {r.isNcr && (
                              <span className="block text-[11px] text-amber-800">
                                {t.socioeconomic.ncrNote}
                              </span>
                            )}
                            {r.isNir && (
                              <span className="block text-[11px] text-slate-500">
                                {t.socioeconomic.nirNote}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                            {formatNumber(r.pop2024)}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono tabular-nums font-medium text-slate-900 whitespace-nowrap">
                            {formatPhpCompact(r.nep2027Amount)}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                            {r.isNcr
                              ? `${formatPhpPerCapita(r.perResidentPhp)}*`
                              : formatPhpPerCapita(r.perResidentPhp)}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                            {formatPercent(r.povertyIncidence2023, 1)}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                            {formatPhpPerCapita(r.povertyThreshold2023)}
                          </td>
                          <td className="py-2.5 pl-2 pr-3 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                            {r.unemploymentRate2025 !== null
                              ? formatPercent(r.unemploymentRate2025, 1)
                              : t.common.na}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <SourcePanel
                  source={{
                    sourceName: 'BetterGovPH Budget API & Philippine Data Explorer (PSA)',
                    datasetName:
                      'NEP /rollups/region · PSGC Q2_2024/regions · PSA Table 2 Poverty (b4a71a27b4e4189c79a8) · SDG 8.5.2 Unemployment (b30cbf499f6e55a9d9ea)',
                    period: 'FY2027 NEP · 2024 Census · 2023 Poverty · 2025 Labor Force',
                    fetchedAt: nepRegionsFetchedAt ?? statsFetchedAt ?? undefined,
                    sourceUpdated: poverty?.sourceUpdated ?? coverage?.dataUpdated ?? null,
                    units: 'PHP, Persons, %',
                    method: `${t.methodology.limitCentralOffice} ${t.methodology.limitNcr}`,
                    sourceUrl: `${API_CONFIG.budgetBaseUrl}/nep/2027/rollups/region`,
                    secondaryUrl: poverty?.sourceUrl ?? API_CONFIG.statsDocsUrl,
                    secondaryLabel: t.socioeconomic.psaSource,
                  }}
                />
              </>
            )}
          </section>

          {/* Section 3: Discover Additional Official PSA OpenSTAT Datasets */}
          <section className="bg-white border border-slate-200 rounded-lg p-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {t.socioeconomic.discoverTitle}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  {coverage ? `${formatNumber(coverage.mirrored)} — ` : ''}
                  {t.socioeconomic.discoverSubtitle}
                </p>
              </div>
              <a
                href={API_CONFIG.openDataPortalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-[#26489A] hover:underline whitespace-nowrap"
              >
                {t.footer.openDataLink} (data.bettergov.ph)
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
            </div>

            <div className="mt-4 relative max-w-xl">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="text"
                value={catalogQuery}
                onChange={(e) => setCatalogQuery(e.target.value)}
                placeholder={t.socioeconomic.discoverPlaceholder}
                className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:border-[#26489A] focus:outline-none"
              />
            </div>

            {debouncedCatalogQuery.length >= 3 && (
              <div className="mt-4">
                {catalogLoading ? (
                  <p className="text-xs text-slate-500">{t.socioeconomic.searchingCatalog}</p>
                ) : catalogResults.length === 0 ? (
                  <p className="text-xs text-slate-600">{t.socioeconomic.noCatalogMatch}</p>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-md">
                    {catalogResults.map((ds) => {
                      const hint = translateRecordHint(ds.title);
                      return (
                        <div
                          key={ds.id}
                          className="p-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900">{ds.title}</p>
                            {hint && (
                              <p className="text-[#0F766E] text-[11px] mt-0.5">{hint}</p>
                            )}
                            <p className="text-slate-500 mt-0.5">
                              {ds.domain} · {t.socioeconomic.latestYear}:{' '}
                              {ds.latestYear ?? t.socioeconomic.unspecified} ·{' '}
                              {ds.dimensions.map((d) => d.label).join(', ')}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <a
                              href={`https://statistics.bettergov.ph${ds.links.page}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[#26489A] hover:underline font-medium whitespace-nowrap"
                            >
                              {t.socioeconomic.openExplorer}
                              <ExternalLink className="w-3 h-3" aria-hidden="true" />
                            </a>
                            <a
                              href={ds.source}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 whitespace-nowrap"
                            >
                              {t.socioeconomic.psaSource}
                              <ExternalLink className="w-3 h-3" aria-hidden="true" />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <SourcePanel
              source={{
                sourceName: 'Philippine Data Explorer (BetterGovPH)',
                datasetName: 'GET /api/v1/datasets?ready=true',
                period: coverage
                  ? `${t.socioeconomic.snapshotUpdated} ${formatDateOnly(coverage.dataUpdated)}`
                  : 'PSA OpenSTAT',
                fetchedAt: statsFetchedAt ?? undefined,
                sourceUpdated: coverage?.dataUpdated ?? null,
                units: 'PSA OpenSTAT',
                sourceUrl: API_CONFIG.statsDocsUrl,
                secondaryUrl: API_CONFIG.psaOpenStatUrl,
                secondaryLabel: 'PSA OpenSTAT',
              }}
            />
          </section>
        </>
      )}
    </div>
  );
}
