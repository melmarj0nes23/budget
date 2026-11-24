import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { GlossaryTooltip } from '../components/GlossaryTooltip';
import { SourcePanel } from '../components/SourcePanel';
import { ErrorBanner, KpiSkeletonGrid, NoticeStrip, PanelSkeleton } from '../components/States';
import { API_CONFIG } from '../config/constants';
import { useBudgetData } from '../hooks/useBudgetData';
import { useLanguage } from '../i18n/LanguageContext';
import type { BudgetStage, PageRoute } from '../types/budget';
import {
  aggregateByFunctionalSector,
  calculateDelta,
  getGaaDepartmentsForYear,
  normalizeNepDepartments,
} from '../utils/calculations';
import {
  formatDateTime,
  formatNumber,
  formatPercent,
  formatPhpCompact,
  formatPhpExact,
  formatSignedPercent,
  formatSignedPhpCompact,
} from '../utils/formatting';

interface DashboardPageProps {
  onNavigate: (route: PageRoute) => void;
  onInspectDepartment: (deptId: string, year: number, stage: BudgetStage) => void;
}

type SelectedPeriod = { stage: 'gaa'; year: number } | { stage: 'nep'; year: 2027 };

export function DashboardPage({ onNavigate, onInspectDepartment }: DashboardPageProps) {
  const { t, translateDepartment, translateExpenseClass, translateSector } = useLanguage();
  const {
    loading,
    refreshing,
    error,
    warning,
    origin,
    fetchedAt,
    gaaYears,
    gaaNational,
    gaaDepartments,
    nepOverview,
    nepExpenseClasses,
    refreshAll,
  } = useBudgetData();

  const [selected, setSelected] = useState<SelectedPeriod>({ stage: 'gaa', year: 2026 });
  const [breakdownTab, setBreakdownTab] = useState<'sectors' | 'expense'>('sectors');

  const sortedGaaYears = useMemo(() => [...gaaYears].sort((a, b) => a - b), [gaaYears]);

  const periodSummary = useMemo(() => {
    if (selected.stage === 'nep' && nepOverview) {
      const normalized = normalizeNepDepartments(nepOverview.departments);
      return {
        stage: 'nep' as const,
        year: nepOverview.fiscalYear,
        stageLabel: t.common.proposedNep,
        totalAmount: nepOverview.national.amount,
        lineItems: nepOverview.national.line_items,
        departmentCount: nepOverview.departments.length,
        delta: calculateDelta(nepOverview.national.base_amount, nepOverview.national.amount),
        baselineLabel: `FY${nepOverview.baselineYear} GAA`,
        departments: normalized,
      };
    }

    const activeYear = sortedGaaYears.includes(selected.year)
      ? selected.year
      : sortedGaaYears[sortedGaaYears.length - 1] ?? 2026;
    const yearRow = gaaNational.find((y) => y.year === activeYear);
    const prevRow = gaaNational.find((y) => y.year === activeYear - 1);
    const depts = getGaaDepartmentsForYear(gaaDepartments, activeYear);
    const activeDeptCount = depts.filter((d) => d.amount > 0).length;

    return {
      stage: 'gaa' as const,
      year: activeYear,
      stageLabel: t.common.enactedGaa,
      totalAmount: yearRow?.amount ?? 0,
      lineItems: yearRow?.line_items ?? 0,
      departmentCount: activeDeptCount,
      delta: prevRow
        ? calculateDelta(prevRow.amount, yearRow?.amount)
        : calculateDelta(null, yearRow?.amount, t.dashboard.baselineEarliest),
      baselineLabel: prevRow ? `FY${activeYear - 1} GAA` : t.dashboard.baselineEarliest,
      departments: depts,
    };
  }, [selected, nepOverview, sortedGaaYears, gaaNational, gaaDepartments, t]);

  const trendData = useMemo(() => {
    const rows: Array<{
      key: string;
      label: string;
      shortStage: string;
      stage: BudgetStage;
      year: number;
      amount: number;
      amountTrillions: number;
      lineItems: number;
    }> = gaaNational
      .slice()
      .sort((a, b) => a.year - b.year)
      .map((item) => ({
        key: `gaa-${item.year}`,
        label: `FY${item.year}`,
        shortStage: t.dashboard.legendEnacted,
        stage: 'gaa',
        year: item.year,
        amount: item.amount,
        amountTrillions: item.amount / 1_000_000_000_000,
        lineItems: item.line_items,
      }));

    if (nepOverview) {
      rows.push({
        key: `nep-${nepOverview.fiscalYear}`,
        label: `FY${nepOverview.fiscalYear} NEP`,
        shortStage: t.dashboard.legendProposed,
        stage: 'nep',
        year: nepOverview.fiscalYear,
        amount: nepOverview.national.amount,
        amountTrillions: nepOverview.national.amount / 1_000_000_000_000,
        lineItems: nepOverview.national.line_items,
      });
    }
    return rows;
  }, [gaaNational, nepOverview, t]);

  const topDepartments = useMemo(() => {
    const total = periodSummary.totalAmount || 1;
    return periodSummary.departments.slice(0, 12).map((d) => ({
      id: d.id,
      name: translateDepartment(d.id, d.description, periodSummary.stage),
      officialName: d.description,
      amount: d.amount,
      amountBillions: d.amount / 1_000_000_000,
      sharePct: (d.amount / total) * 100,
    }));
  }, [periodSummary, translateDepartment]);

  const sectorAggregation = useMemo(
    () => aggregateByFunctionalSector(periodSummary.departments, periodSummary.stage),
    [periodSummary.departments, periodSummary.stage]
  );

  const expenseChartData = useMemo(() => {
    const isNep = periodSummary.stage === 'nep';
    const total = nepExpenseClasses.reduce(
      (sum, item) => sum + (isNep ? item.amount : item.base_amount),
      0
    );
    return nepExpenseClasses
      .map((item) => {
        const value = isNep ? item.amount : item.base_amount;
        return {
          code: item.code,
          label: translateExpenseClass(item.code, item.description),
          amount: value,
          sharePct: total > 0 ? (value / total) * 100 : 0,
          delta: item.delta,
          pct: item.pct,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [nepExpenseClasses, periodSummary.stage, translateExpenseClass]);

  const topAllocation = periodSummary.departments[0];
  const topAgencyExcludingAuto = periodSummary.departments.find(
    (d) => d.id !== '04' && d.id !== 'AUTO' && d.id !== 'SPF'
  );

  const originText =
    origin === 'cache'
      ? t.common.cached
      : origin === 'stale-cache'
        ? t.common.offlineCache
        : t.common.live;

  return (
    <div className="space-y-8">
      {/* Hero Header & Context */}
      <section className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="max-w-2xl">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
              {t.dashboard.heroTitle}
            </h1>
            <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed">
              {t.dashboard.heroSubtitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            {fetchedAt && (
              <span className="tabular-nums">
                {originText} · {t.common.retrieved} {formatDateTime(fetchedAt)}
              </span>
            )}
            <button
              type="button"
              onClick={() => void refreshAll()}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              {refreshing ? t.common.refreshing : t.common.refreshData}
            </button>
          </div>
        </div>

        {/* Fiscal Year & Budget Stage Control Bar */}
        <div className="bg-white border border-slate-200 rounded-lg p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-700 mr-1 whitespace-nowrap">
              {t.dashboard.enactedLabel} <GlossaryTooltip termKey="GAA" label="GAA" />:
            </span>
            <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-md">
              {(sortedGaaYears.length > 0 ? sortedGaaYears : [2020, 2021, 2022, 2023, 2024, 2025, 2026]).map(
                (yr) => {
                  const isActive = selected.stage === 'gaa' && selected.year === yr;
                  return (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => setSelected({ stage: 'gaa', year: yr })}
                      className={`px-2.5 py-1 text-xs font-medium font-mono tabular-nums rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        isActive
                          ? 'bg-[#26489A] text-white'
                          : 'text-slate-700 hover:bg-white hover:text-slate-900'
                      }`}
                    >
                      {yr}
                    </button>
                  );
                }
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:border-l md:border-slate-200 md:pl-4">
            <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
              {t.dashboard.proposedLabel} <GlossaryTooltip termKey="NEP" label="NEP" />:
            </span>
            <button
              type="button"
              disabled={!nepOverview}
              onClick={() => setSelected({ stage: 'nep', year: 2027 })}
              className={`px-3 py-1.5 text-xs font-medium font-mono tabular-nums rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 ${
                selected.stage === 'nep'
                  ? 'bg-[#0F766E] text-white border-[#0F766E]'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              FY2027 NEP
            </button>
          </div>
        </div>

        {warning && (
          <NoticeStrip
            tone="caution"
            message={warning}
            actionLabel={t.common.retryLive}
            onAction={() => void refreshAll()}
          />
        )}

        {selected.stage === 'nep' && (
          <NoticeStrip tone="info" message={t.dashboard.nepProposalNotice} />
        )}
      </section>

      {error && !gaaNational.length ? (
        <ErrorBanner message={error} onRetry={() => void refreshAll()} />
      ) : loading ? (
        <div className="space-y-6">
          <KpiSkeletonGrid count={4} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PanelSkeleton heightClass="h-72" />
            <PanelSkeleton heightClass="h-72" />
          </div>
        </div>
      ) : (
        <>
          {/* 4-Column KPI Strip */}
          <section
            aria-label={t.dashboard.kpiBudgetLabel}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <div className="text-xs text-slate-500 flex items-center gap-1">
                <span>
                  FY{periodSummary.year} · {periodSummary.stageLabel}
                </span>
                <GlossaryTooltip termKey="Appropriation vs Disbursement" />
              </div>
              <p className="mt-2 font-mono text-2xl sm:text-3xl font-semibold text-slate-900 tabular-nums">
                {formatPhpCompact(periodSummary.totalAmount)}
              </p>
              <p
                className="mt-1.5 text-xs text-slate-500 font-mono tabular-nums truncate"
                title={formatPhpExact(periodSummary.totalAmount)}
              >
                {formatPhpExact(periodSummary.totalAmount)}
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <div className="text-xs text-slate-500">{t.dashboard.kpiYoyLabel}</div>
              <p
                className={`mt-2 font-mono text-2xl sm:text-3xl font-semibold tabular-nums ${
                  periodSummary.delta.percentChange === null
                    ? 'text-slate-400'
                    : periodSummary.delta.percentChange >= 0
                      ? 'text-[#15803D]'
                      : 'text-[#B91C1C]'
                }`}
              >
                {periodSummary.delta.percentChange !== null
                  ? formatSignedPercent(periodSummary.delta.percentChange, 2)
                  : t.common.na}
              </p>
              <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
                {periodSummary.delta.absoluteChange !== null
                  ? `${formatSignedPhpCompact(periodSummary.delta.absoluteChange)} · ${periodSummary.baselineLabel}`
                  : periodSummary.baselineLabel}
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <div className="text-xs text-slate-500">{t.dashboard.kpiLargestDeptLabel}</div>
              <p className="mt-2 font-mono text-2xl sm:text-3xl font-semibold text-slate-900 tabular-nums">
                {topAgencyExcludingAuto ? formatPhpCompact(topAgencyExcludingAuto.amount) : t.common.na}
              </p>
              <p
                className="mt-1.5 text-xs text-slate-600 truncate"
                title={
                  topAgencyExcludingAuto
                    ? translateDepartment(
                        topAgencyExcludingAuto.id,
                        topAgencyExcludingAuto.description,
                        periodSummary.stage
                      )
                    : undefined
                }
              >
                {topAgencyExcludingAuto
                  ? `${translateDepartment(
                      topAgencyExcludingAuto.id,
                      topAgencyExcludingAuto.description,
                      periodSummary.stage
                    )} (${formatPercent(
                      (topAgencyExcludingAuto.amount / (periodSummary.totalAmount || 1)) * 100,
                      1
                    )})`
                  : t.common.na}
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <div className="text-xs text-slate-500 flex items-center gap-1">
                <span>{t.dashboard.kpiCoverageLabel}</span>
                <GlossaryTooltip termKey="Automatic Appropriations" />
              </div>
              <p className="mt-2 font-mono text-2xl sm:text-3xl font-semibold text-slate-900 tabular-nums">
                {formatNumber(periodSummary.lineItems)}
              </p>
              <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
                {t.dashboard.lineItemsAcross} {periodSummary.departmentCount}{' '}
                {t.common.departmentsAndFunds}
                {topAllocation
                  ? ` · ${t.dashboard.topFund}: ${formatPercent((topAllocation.amount / (periodSummary.totalAmount || 1)) * 100, 1)}`
                  : ''}
              </p>
            </div>
          </section>

          {/* Row 2: Multi-Year Trend & Top Departments */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6 flex flex-col">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{t.dashboard.trendTitle}</h2>
                <p className="text-xs text-slate-500 mt-1">{t.dashboard.trendSubtitle}</p>
              </div>

              <div className="mt-4 flex items-center gap-4 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-[#26489A] inline-block" aria-hidden="true" />
                  {t.dashboard.legendEnacted}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-[#0F766E] inline-block" aria-hidden="true" />
                  {t.dashboard.legendProposed}
                </span>
              </div>

              <div className="mt-4 h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData} margin={{ top: 10, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: '#475569' }}
                      axisLine={{ stroke: '#CBD5E1' }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 'auto']}
                      tickFormatter={(v: number) => `₱${v.toFixed(0)}T`}
                      tick={{ fontSize: 11, fill: '#475569' }}
                      axisLine={false}
                      tickLine={false}
                      width={48}
                    />
                    <Tooltip
                      cursor={{ fill: '#F1F5F9' }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const row = payload[0].payload as (typeof trendData)[number];
                        return (
                          <div className="bg-white border border-slate-200 rounded-md shadow-md p-3 text-xs">
                            <p className="font-semibold text-slate-900">
                              FY{row.year} · {row.shortStage}
                            </p>
                            <p className="font-mono text-slate-900 mt-1 tabular-nums">
                              {formatPhpExact(row.amount)}
                            </p>
                            <p className="text-slate-500 mt-0.5 tabular-nums">
                              {formatNumber(row.lineItems)} {t.common.lineItems.toLowerCase()}
                            </p>
                          </div>
                        );
                      }}
                    />
                    <Bar
                      dataKey="amountTrillions"
                      radius={[3, 3, 0, 0]}
                      onClick={(entry) => {
                        const row = entry as unknown as (typeof trendData)[number];
                        if (row.stage === 'nep') {
                          setSelected({ stage: 'nep', year: 2027 });
                        } else {
                          setSelected({ stage: 'gaa', year: row.year });
                        }
                      }}
                      className="cursor-pointer"
                    >
                      {trendData.map((entry) => {
                        const isSelected =
                          entry.stage === selected.stage && entry.year === selected.year;
                        const baseFill = entry.stage === 'nep' ? '#0F766E' : '#26489A';
                        return (
                          <Cell
                            key={entry.key}
                            fill={baseFill}
                            fillOpacity={isSelected ? 1 : 0.45}
                            stroke={isSelected ? '#0f2342' : 'none'}
                            strokeWidth={isSelected ? 1.5 : 0}
                          />
                        );
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-auto">
                <SourcePanel
                  source={{
                    sourceName: 'BetterGovPH Philippine Budget API',
                    datasetName: 'GET /api/v1/gaa & GET /api/v1/nep/2027',
                    period: 'FY2020–FY2026 GAA; FY2027 NEP',
                    fetchedAt: fetchedAt ?? undefined,
                    sourceUpdated: nepOverview?.generatedAt ?? null,
                    units: 'Philippine Pesos (PHP)',
                    method: t.methodology.sec2Intro,
                    sourceUrl: `${API_CONFIG.budgetBaseUrl}/gaa`,
                    secondaryUrl: API_CONFIG.budgetDocsUrl,
                    secondaryLabel: t.footer.budgetApiLink,
                  }}
                />
              </div>
            </div>

            {/* Top 12 Departments / Agencies */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6 flex flex-col">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {t.dashboard.topAllocTitle} — FY{periodSummary.year} (
                    {periodSummary.stage === 'nep' ? 'NEP' : 'GAA'})
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">{t.dashboard.topAllocSubtitle}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('explorer')}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#26489A] hover:text-[#1E40AF] whitespace-nowrap cursor-pointer"
                >
                  {t.dashboard.openFullExplorer}
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>

              <div className="mt-4 space-y-2.5 flex-1">
                {topDepartments.map((dept) => {
                  const maxAmount = topDepartments[0]?.amount || 1;
                  const widthPct = Math.max(1.5, (dept.amount / maxAmount) * 100);
                  const isStatutory = dept.id === '04' || dept.id === 'AUTO' || dept.id === 'SPF';
                  return (
                    <button
                      key={dept.id}
                      type="button"
                      onClick={() =>
                        onInspectDepartment(dept.id, periodSummary.year, periodSummary.stage)
                      }
                      className="w-full text-left group py-1 rounded hover:bg-slate-50 transition-colors cursor-pointer"
                      title={dept.officialName}
                    >
                      <div className="flex items-baseline justify-between gap-3 text-xs">
                        <span className="font-medium text-slate-800 group-hover:text-[#26489A] truncate">
                          {dept.name}
                        </span>
                        <span className="font-mono tabular-nums text-slate-900 whitespace-nowrap shrink-0">
                          {formatPhpCompact(dept.amount)}{' '}
                          <span className="text-slate-500">
                            ({formatPercent(dept.sharePct, 1)})
                          </span>
                        </span>
                      </div>
                      <div className="mt-1 h-2 w-full bg-slate-100 rounded-xs overflow-hidden">
                        <div
                          className="h-full rounded-xs transition-opacity"
                          style={{
                            width: `${widthPct}%`,
                            backgroundColor: isStatutory
                              ? '#B45309'
                              : periodSummary.stage === 'nep'
                                ? '#0F766E'
                                : '#26489A',
                          }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>

              <SourcePanel
                source={{
                  sourceName: 'BetterGovPH Philippine Budget API',
                  datasetName:
                    periodSummary.stage === 'nep'
                      ? 'GET /api/v1/nep/2027'
                      : 'GET /api/v1/gaa/departments',
                  period: `FY${periodSummary.year} ${periodSummary.stageLabel}`,
                  fetchedAt: fetchedAt ?? undefined,
                  sourceUpdated:
                    periodSummary.stage === 'nep' ? nepOverview?.generatedAt ?? null : null,
                  units: 'PHP & %',
                  sourceUrl:
                    periodSummary.stage === 'nep'
                      ? `${API_CONFIG.budgetBaseUrl}/nep/2027`
                      : `${API_CONFIG.budgetBaseUrl}/gaa/departments`,
                }}
              />
            </div>
          </section>

          {/* Row 3: Functional Sector Distribution & Expense Class Breakdown */}
          <section className="bg-white border border-slate-200 rounded-lg p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {breakdownTab === 'sectors'
                    ? `${t.dashboard.sectorTitle} — FY${periodSummary.year}`
                    : `${t.dashboard.expenseTitle} (${periodSummary.stage === 'nep' ? 'FY2027 NEP' : 'FY2026 GAA'})`}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  {breakdownTab === 'sectors'
                    ? t.dashboard.sectorSubtitle
                    : t.dashboard.expenseSubtitle}
                </p>
              </div>

              <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-md self-start sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setBreakdownTab('sectors')}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                    breakdownTab === 'sectors'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.dashboard.tabSectors}
                </button>
                <button
                  type="button"
                  onClick={() => setBreakdownTab('expense')}
                  disabled={nepExpenseClasses.length === 0}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer disabled:opacity-40 ${
                    breakdownTab === 'expense'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.dashboard.tabExpense}
                </button>
              </div>
            </div>

            {breakdownTab === 'sectors' ? (
              <div className="mt-5 space-y-5">
                <div>
                  <div
                    className="h-5 w-full rounded-xs overflow-hidden flex bg-slate-100"
                    role="img"
                    aria-label={t.dashboard.sectorTitle}
                  >
                    {sectorAggregation.sectors.map((sec) => {
                      const loc = translateSector(sec.id, sec);
                      return (
                        <div
                          key={sec.id}
                          style={{
                            width: `${sec.sharePct}%`,
                            backgroundColor: sec.color,
                          }}
                          title={`${loc.label}: ${formatPhpCompact(sec.amount)} (${formatPercent(sec.sharePct, 1)})`}
                        />
                      );
                    })}
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-600">
                    {sectorAggregation.sectors.map((sec) => {
                      const loc = translateSector(sec.id, sec);
                      return (
                        <span key={sec.id} className="inline-flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-xs inline-block shrink-0"
                            style={{ backgroundColor: sec.color }}
                            aria-hidden="true"
                          />
                          <span>{loc.shortLabel}</span>
                          <span className="font-mono tabular-nums text-slate-900 font-medium">
                            {formatPercent(sec.sharePct, 1)}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs text-slate-500">
                        <th className="py-2.5 pr-4 font-medium">{t.dashboard.colSector}</th>
                        <th className="py-2.5 px-4 font-medium">{t.dashboard.colIncludedDepts}</th>
                        <th className="py-2.5 px-4 font-medium text-right">
                          {t.dashboard.colAllocation}
                        </th>
                        <th className="py-2.5 pl-4 font-medium text-right">
                          {t.dashboard.colShare}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sectorAggregation.sectors.map((sec) => {
                        const loc = translateSector(sec.id, sec);
                        return (
                          <tr key={sec.id} className="hover:bg-slate-50/70">
                            <td className="py-3 pr-4 align-top">
                              <div className="flex items-center gap-2 font-medium text-slate-900">
                                <span
                                  className="w-2.5 h-2.5 rounded-xs shrink-0"
                                  style={{ backgroundColor: sec.color }}
                                  aria-hidden="true"
                                />
                                {loc.label}
                              </div>
                              <p className="text-xs text-slate-500 mt-1 max-w-md leading-relaxed">
                                {loc.description}
                              </p>
                            </td>
                            <td className="py-3 px-4 align-top text-xs text-slate-600 tabular-nums">
                              {sec.departmentCount} {t.common.departmentsAndFunds}
                              <div className="mt-1 text-slate-500">
                                {t.dashboard.topLabel}:{' '}
                                {sec.departments
                                  .slice(0, 3)
                                  .map((d) =>
                                    translateDepartment(
                                      d.id,
                                      d.description,
                                      periodSummary.stage
                                    ).replace(/\s*\([^)]*\)$/, '')
                                  )
                                  .join(', ')}
                              </div>
                            </td>
                            <td className="py-3 px-4 align-top text-right font-mono tabular-nums font-medium text-slate-900 whitespace-nowrap">
                              <div>{formatPhpCompact(sec.amount)}</div>
                              <div className="text-xs text-slate-500 font-normal">
                                {formatPhpExact(sec.amount)}
                              </div>
                            </td>
                            <td className="py-3 pl-4 align-top text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                              {formatPercent(sec.sharePct, 2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-slate-300 bg-slate-50/80 font-semibold text-slate-900">
                        <td className="py-2.5 pr-4 text-xs">{t.dashboard.reconciledSum}</td>
                        <td className="py-2.5 px-4 text-xs text-slate-600 font-normal">
                          {t.dashboard.zeroOverlapNote}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-xs">
                          {formatPhpExact(sectorAggregation.sumTotal)}
                        </td>
                        <td className="py-2.5 pl-4 text-right font-mono tabular-nums text-xs">
                          100.00%
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <SourcePanel
                  source={{
                    sourceName: 'BetterGovPH Philippine Budget API',
                    datasetName:
                      periodSummary.stage === 'nep'
                        ? 'GET /api/v1/nep/2027'
                        : 'GET /api/v1/gaa/departments',
                    period: `FY${periodSummary.year} ${periodSummary.stageLabel}`,
                    fetchedAt: fetchedAt ?? undefined,
                    units: 'Philippine Pesos (PHP)',
                    method: t.methodology.sec4Intro,
                    sourceUrl: `${API_CONFIG.budgetBaseUrl}/gaa/departments`,
                  }}
                />
              </div>
            ) : (
              <div className="mt-5 space-y-5">
                {periodSummary.stage === 'gaa' && periodSummary.year !== 2026 && (
                  <NoticeStrip tone="info" message={t.dashboard.expenseYearNotice} />
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs text-slate-500">
                        <th className="py-2.5 pr-4 font-medium">{t.dashboard.colExpenseClass}</th>
                        <th className="py-2.5 px-4 font-medium text-right">
                          {periodSummary.stage === 'nep'
                            ? `FY2027 ${t.common.proposedNep}`
                            : `FY2026 ${t.common.enactedGaa}`}
                        </th>
                        <th className="py-2.5 px-4 font-medium text-right">
                          {t.dashboard.colShare}
                        </th>
                        <th className="py-2.5 pl-4 font-medium text-right">
                          {t.dashboard.colChange27vs26}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {expenseChartData.map((row) => {
                        const glossaryKey =
                          row.code === '1'
                            ? 'PS'
                            : row.code === '2'
                              ? 'MOOE'
                              : row.code === '3'
                                ? 'FinEx'
                                : 'CO';
                        return (
                          <tr key={row.code} className="hover:bg-slate-50/70">
                            <td className="py-3 pr-4 font-medium text-slate-900">
                              <span className="inline-flex items-center gap-1.5">
                                {row.label}
                                <GlossaryTooltip termKey={glossaryKey} />
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900">
                              <div>{formatPhpCompact(row.amount)}</div>
                              <div className="text-xs text-slate-500">
                                {formatPhpExact(row.amount)}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                              {formatPercent(row.sharePct, 2)}
                            </td>
                            <td
                              className={`py-3 pl-4 text-right font-mono tabular-nums ${
                                row.delta >= 0 ? 'text-[#15803D]' : 'text-[#B91C1C]'
                              }`}
                            >
                              {formatSignedPercent(row.pct, 1)} ({formatSignedPhpCompact(row.delta)})
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <SourcePanel
                  source={{
                    sourceName: 'BetterGovPH Philippine Budget API',
                    datasetName: 'GET /api/v1/nep/2027/rollups/expense_class',
                    period: 'FY2026 GAA & FY2027 NEP',
                    fetchedAt: fetchedAt ?? undefined,
                    sourceUpdated: nepOverview?.generatedAt ?? null,
                    units: 'Philippine Pesos (PHP)',
                    sourceUrl: `${API_CONFIG.budgetBaseUrl}/nep/2027/rollups/expense_class`,
                  }}
                />
              </div>
            )}
          </section>

          {/* Row 4: Quick Analytical Entry Points */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => onNavigate('locality')}
              className="text-left bg-white border border-slate-200 hover:border-[#26489A] rounded-lg p-5 transition-colors group cursor-pointer"
            >
              <h3 className="text-base font-semibold text-slate-900 group-hover:text-[#26489A]">
                {t.dashboard.cardLocalityTitle}
              </h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                {t.dashboard.cardLocalityDesc}
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#26489A]">
                {t.dashboard.cardLocalityCta}{' '}
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('explorer')}
              className="text-left bg-white border border-slate-200 hover:border-[#26489A] rounded-lg p-5 transition-colors group cursor-pointer"
            >
              <h3 className="text-base font-semibold text-slate-900 group-hover:text-[#26489A]">
                {t.dashboard.cardExplorerTitle}
              </h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                {t.dashboard.cardExplorerDesc}
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#26489A]">
                {t.dashboard.cardExplorerCta}{' '}
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('compare')}
              className="text-left bg-white border border-slate-200 hover:border-[#26489A] rounded-lg p-5 transition-colors group cursor-pointer"
            >
              <h3 className="text-base font-semibold text-slate-900 group-hover:text-[#26489A]">
                {t.dashboard.cardCompareTitle}
              </h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                {t.dashboard.cardCompareDesc}
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#26489A]">
                {t.dashboard.cardCompareCta}{' '}
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('socioeconomic')}
              className="text-left bg-white border border-slate-200 hover:border-[#26489A] rounded-lg p-5 transition-colors group cursor-pointer"
            >
              <h3 className="text-base font-semibold text-slate-900 group-hover:text-[#26489A]">
                {t.dashboard.cardSocioTitle}
              </h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                {t.dashboard.cardSocioDesc}
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#26489A]">
                {t.dashboard.cardSocioCta}{' '}
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </span>
            </button>
          </section>
        </>
      )}
    </div>
  );
}
