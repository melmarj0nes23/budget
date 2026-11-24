import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowDown, ArrowUp, Search } from 'lucide-react';
import { GlossaryTooltip } from '../components/GlossaryTooltip';
import { SourcePanel } from '../components/SourcePanel';
import { ErrorBanner, NoticeStrip, TableSkeleton } from '../components/States';
import { API_CONFIG } from '../config/constants';
import { useBudgetData } from '../hooks/useBudgetData';
import { useLanguage } from '../i18n/LanguageContext';
import { calculateDelta } from '../utils/calculations';
import {
  formatPhpCompact,
  formatPhpExact,
  formatSignedPercent,
  formatSignedPhpCompact,
} from '../utils/formatting';

type CompareMode = 'gaa-vs-gaa' | 'nep-vs-gaa';
type SortCol = 'toAmount' | 'absChange' | 'pctChange' | 'name';

const TREND_COLORS = ['#26489A', '#0F766E', '#B45309', '#6D28D9'];
const DEFAULT_TREND_IDS = ['07', '18', '13', '20'];

export function BudgetComparisonPage() {
  const { language, t, translateDepartment } = useLanguage();
  const { loading, error, fetchedAt, gaaYears, gaaNational, gaaDepartments, nepOverview, refreshAll } =
    useBudgetData();

  const sortedYears = useMemo(() => [...gaaYears].sort((a, b) => a - b), [gaaYears]);
  const [mode, setMode] = useState<CompareMode>('gaa-vs-gaa');
  const [fromYear, setFromYear] = useState<number>(2025);
  const [toYear, setToYear] = useState<number>(2026);
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState<SortCol>('absChange');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedTrendIds, setSelectedTrendIds] = useState<string[]>(DEFAULT_TREND_IDS);

  const nationalComparison = useMemo(() => {
    if (mode === 'nep-vs-gaa' && nepOverview) {
      return {
        fromLabel: `FY${nepOverview.baselineYear} ${t.common.enactedGaa}`,
        toLabel: `FY${nepOverview.fiscalYear} ${t.common.proposedNep}`,
        delta: calculateDelta(nepOverview.national.base_amount, nepOverview.national.amount),
      };
    }
    const fromRow = gaaNational.find((y) => y.year === fromYear);
    const toRow = gaaNational.find((y) => y.year === toYear);
    return {
      fromLabel: `FY${fromYear} ${t.common.enactedGaa}`,
      toLabel: `FY${toYear} ${t.common.enactedGaa}`,
      delta: calculateDelta(fromRow?.amount, toRow?.amount),
    };
  }, [mode, nepOverview, gaaNational, fromYear, toYear, t]);

  const trendChartData = useMemo(() => {
    const activeDepts = selectedTrendIds
      .map((id) => gaaDepartments.find((d) => d.id === id))
      .filter((d): d is NonNullable<typeof d> => Boolean(d));

    const years = sortedYears.length ? sortedYears : [2020, 2021, 2022, 2023, 2024, 2025, 2026];
    const rows = years.map((yr) => {
      const point: Record<string, string | number> = { year: `FY${yr}` };
      for (const d of activeDepts) {
        const amt = d.years?.[String(yr)]?.amount ?? 0;
        point[d.id] = amt / 1_000_000_000;
      }
      return point;
    });
    return { rows, activeDepts };
  }, [selectedTrendIds, gaaDepartments, sortedYears]);

  const comparisonRows = useMemo(() => {
    if (mode === 'nep-vs-gaa' && nepOverview) {
      return nepOverview.departments.map((d) => {
        let limitationNote: string | undefined;
        if (d.id === 'AUTO' || d.id === 'SPF' || d.id === '01' || d.id === '04') {
          limitationNote = t.compare.noteSeparatedBaseline;
        } else if (d.id === '24') {
          limitationNote = t.compare.noteDepdevRenamed;
        }
        const delta = calculateDelta(d.base_amount, d.amount, limitationNote);
        return {
          id: d.id,
          name: translateDepartment(d.id, d.description, 'nep'),
          officialName: d.description,
          fromAmount: d.base_amount,
          toAmount: d.amount,
          absChange: d.delta,
          pctChange: d.pct,
          limitationNote: delta.limitationNote,
        };
      });
    }

    return gaaDepartments.map((d) => {
      const fAmt = d.years?.[String(fromYear)]?.amount ?? 0;
      const tAmt = d.years?.[String(toYear)]?.amount ?? 0;
      let note: string | undefined;
      if (fAmt === 0 && tAmt > 0) {
        note = t.compare.noteNoBaseAlloc;
      } else if (fAmt > 0 && tAmt === 0) {
        note = t.compare.noteZeroTargetAlloc;
      } else if (d.id === '01') {
        note = t.compare.noteGaaCode01;
      } else if (d.id === '04') {
        note = t.compare.noteGaaCode04;
      }
      const delta = calculateDelta(fAmt, tAmt, note);
      return {
        id: d.id,
        name: translateDepartment(d.id, d.description, 'gaa'),
        officialName: d.description,
        fromAmount: fAmt,
        toAmount: tAmt,
        absChange: delta.absoluteChange ?? 0,
        pctChange: delta.percentChange,
        limitationNote: delta.limitationNote,
      };
    });
  }, [mode, nepOverview, gaaDepartments, fromYear, toYear, t, translateDepartment]);

  const filteredAndSortedRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? comparisonRows.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            r.officialName.toLowerCase().includes(q) ||
            r.id.toLowerCase().includes(q)
        )
      : comparisonRows;

    const mult = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortCol === 'name') return mult * a.name.localeCompare(b.name);
      if (sortCol === 'toAmount') return mult * (a.toAmount - b.toAmount);
      if (sortCol === 'pctChange') {
        const av = a.pctChange ?? -Infinity;
        const bv = b.pctChange ?? -Infinity;
        return mult * (av - bv);
      }
      return mult * (a.absChange - b.absChange);
    });
  }, [comparisonRows, search, sortCol, sortDir]);

  const handleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortCol(col);
      setSortDir(col === 'name' ? 'asc' : 'desc');
    }
  };

  const toggleTrendDept = (deptId: string) => {
    setSelectedTrendIds((prev) => {
      if (prev.includes(deptId)) {
        return prev.length > 1 ? prev.filter((id) => id !== deptId) : prev;
      }
      if (prev.length >= 4) {
        return [...prev.slice(1), deptId];
      }
      return [...prev, deptId];
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            {t.compare.title}
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 max-w-2xl">{t.compare.subtitle}</p>
        </div>

        <div className="inline-flex items-center p-1 bg-slate-100 rounded-md self-start md:self-auto">
          <button
            type="button"
            onClick={() => setMode('gaa-vs-gaa')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
              mode === 'gaa-vs-gaa' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            {t.compare.modeGaaVsGaa}
          </button>
          <button
            type="button"
            disabled={!nepOverview}
            onClick={() => setMode('nep-vs-gaa')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer disabled:opacity-40 ${
              mode === 'nep-vs-gaa' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            {t.compare.modeNepVsGaa}
          </button>
        </div>
      </div>

      {mode === 'gaa-vs-gaa' ? (
        <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
            <span>{t.compare.baseYear}:</span>
            <select
              value={fromYear}
              onChange={(e) => setFromYear(Number(e.target.value))}
              className="bg-slate-50 border border-slate-300 rounded-md px-3 py-1.5 font-mono text-xs text-slate-900"
            >
              {(sortedYears.length ? sortedYears : [2020, 2021, 2022, 2023, 2024, 2025, 2026]).map(
                (yr) => (
                  <option key={yr} value={yr}>
                    FY{yr} GAA
                  </option>
                )
              )}
            </select>
          </label>
          <span className="text-xs text-slate-400">{t.compare.comparedAgainst}</span>
          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
            <span>{t.compare.targetYear}:</span>
            <select
              value={toYear}
              onChange={(e) => setToYear(Number(e.target.value))}
              className="bg-slate-50 border border-slate-300 rounded-md px-3 py-1.5 font-mono text-xs text-slate-900"
            >
              {(sortedYears.length ? sortedYears : [2020, 2021, 2022, 2023, 2024, 2025, 2026]).map(
                (yr) => (
                  <option key={yr} value={yr}>
                    FY{yr} GAA
                  </option>
                )
              )}
            </select>
          </label>
          {fromYear === toYear && (
            <span className="text-xs text-amber-800">{t.compare.selectDistinctYears}</span>
          )}
        </div>
      ) : (
        <NoticeStrip tone="info" message={t.compare.nepReconciledNotice} />
      )}

      {error && !gaaDepartments.length ? (
        <ErrorBanner message={error} onRetry={() => void refreshAll()} />
      ) : loading ? (
        <TableSkeleton rows={10} />
      ) : (
        <>
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <p className="text-xs text-slate-500">{nationalComparison.fromLabel}</p>
              <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                {formatPhpCompact(nationalComparison.delta.fromAmount)}
              </p>
              <p className="mt-1 font-mono text-xs text-slate-500 tabular-nums">
                {formatPhpExact(nationalComparison.delta.fromAmount)}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <p className="text-xs text-slate-500">{nationalComparison.toLabel}</p>
              <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                {formatPhpCompact(nationalComparison.delta.toAmount)}
              </p>
              <p className="mt-1 font-mono text-xs text-slate-500 tabular-nums">
                {formatPhpExact(nationalComparison.delta.toAmount)}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <p className="text-xs text-slate-500">{t.compare.absChangeLabel}</p>
              <p
                className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${
                  (nationalComparison.delta.absoluteChange ?? 0) >= 0
                    ? 'text-[#15803D]'
                    : 'text-[#B91C1C]'
                }`}
              >
                {formatSignedPhpCompact(nationalComparison.delta.absoluteChange)}
              </p>
              <p className="mt-1 text-xs text-slate-500">{t.compare.nominalPhpNote}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <p className="text-xs text-slate-500">{t.compare.pctChangeLabel}</p>
              <p
                className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${
                  (nationalComparison.delta.percentChange ?? 0) >= 0
                    ? 'text-[#15803D]'
                    : 'text-[#B91C1C]'
                }`}
              >
                {formatSignedPercent(nationalComparison.delta.percentChange, 2)}
              </p>
              <p className="mt-1 text-xs text-slate-500">{t.compare.formulaNote}</p>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-lg p-6">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {t.compare.trajectoryTitle}
                </h2>
                <p className="text-xs text-slate-500 mt-1">{t.compare.trajectorySubtitle}</p>
              </div>
              <div className="flex flex-wrap gap-1.5 max-w-xl">
                {gaaDepartments
                  .filter((d) => d.id !== '04' && d.id !== '01')
                  .slice(0, 12)
                  .map((d) => {
                    const idx = selectedTrendIds.indexOf(d.id);
                    const active = idx !== -1;
                    const short =
                      d.description.match(/\(([^)]+)\)/)?.[1] ?? d.description.slice(0, 14);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => toggleTrendDept(d.id)}
                        className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors whitespace-nowrap cursor-pointer ${
                          active
                            ? 'text-white border-transparent'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                        style={active ? { backgroundColor: TREND_COLORS[idx] } : undefined}
                      >
                        {short}
                      </button>
                    );
                  })}
              </div>
            </div>

            <div className="mt-5 h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={trendChartData.rows}
                  margin={{ top: 10, right: 16, left: 4, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis
                    dataKey="year"
                    tick={{ fontSize: 11, fill: '#475569' }}
                    axisLine={{ stroke: '#CBD5E1' }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 'auto']}
                    tickFormatter={(v: number) => `₱${v.toFixed(0)}B`}
                    tick={{ fontSize: 11, fill: '#475569' }}
                    axisLine={false}
                    tickLine={false}
                    width={62}
                  />
                  <Tooltip
                    formatter={(val, name) => [
                      `₱${Number(val ?? 0).toFixed(2)}B`,
                      String(name ?? ''),
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  {trendChartData.activeDepts.map((d, i) => (
                    <Line
                      key={d.id}
                      type="monotone"
                      dataKey={d.id}
                      name={translateDepartment(d.id, d.description, 'gaa')}
                      stroke={TREND_COLORS[i % TREND_COLORS.length]}
                      strokeWidth={2.25}
                      dot={{ r: 3.5 }}
                      activeDot={{ r: 5 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            <SourcePanel
              source={{
                sourceName: 'BetterGovPH Philippine Budget API',
                datasetName: 'GET /api/v1/gaa/departments',
                period: `FY2020–FY2026 ${t.common.enactedGaa}`,
                fetchedAt: fetchedAt ?? undefined,
                units: 'Billions PHP',
                sourceUrl: `${API_CONFIG.budgetBaseUrl}/gaa/departments`,
              }}
            />
          </section>

          <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">{t.compare.tableTitle}</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {nationalComparison.fromLabel} → {nationalComparison.toLabel} ·{' '}
                  {t.compare.tableSubtitle}
                </p>
              </div>
              <div className="relative w-full sm:w-72">
                <Search
                  className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t.compare.filterPlaceholder}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:border-[#26489A] focus:outline-none"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                    <th className="py-2.5 pl-4 pr-3 font-medium">
                      <button
                        type="button"
                        onClick={() => handleSort('name')}
                        className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                      >
                        {t.explorer.colDeptFund}
                        {sortCol === 'name' &&
                          (sortDir === 'asc' ? (
                            <ArrowUp className="w-3 h-3" />
                          ) : (
                            <ArrowDown className="w-3 h-3" />
                          ))}
                      </button>
                    </th>
                    <th className="py-2.5 px-3 font-medium text-right whitespace-nowrap">
                      {mode === 'nep-vs-gaa' ? 'FY2026 GAA' : `FY${fromYear} GAA`}
                    </th>
                    <th className="py-2.5 px-3 font-medium text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleSort('toAmount')}
                        className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                      >
                        {mode === 'nep-vs-gaa' ? 'FY2027 NEP' : `FY${toYear} GAA`}
                        {sortCol === 'toAmount' &&
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
                        onClick={() => handleSort('absChange')}
                        className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                      >
                        {t.compare.colAbsChange}
                        {sortCol === 'absChange' &&
                          (sortDir === 'asc' ? (
                            <ArrowUp className="w-3 h-3" />
                          ) : (
                            <ArrowDown className="w-3 h-3" />
                          ))}
                      </button>
                    </th>
                    <th className="py-2.5 pl-3 pr-4 font-medium text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleSort('pctChange')}
                        className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                      >
                        {t.compare.colPctChange}
                        {sortCol === 'pctChange' &&
                          (sortDir === 'asc' ? (
                            <ArrowUp className="w-3 h-3" />
                          ) : (
                            <ArrowDown className="w-3 h-3" />
                          ))}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAndSortedRows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/70">
                      <td className="py-3 pl-4 pr-3 align-top">
                        <div className="font-medium text-slate-900">{row.name}</div>
                        <div className="text-xs text-slate-500">
                          <span className="font-mono">
                            {t.common.codePrefix} {row.id}
                          </span>
                          {language !== 'en' && row.name !== row.officialName && (
                            <span> · {row.officialName}</span>
                          )}
                        </div>
                        {row.limitationNote && (
                          <p className="text-xs text-amber-800 mt-1 max-w-md leading-snug">
                            {t.compare.notePrefix}: {row.limitationNote}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-3 align-top text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        {formatPhpCompact(row.fromAmount)}
                      </td>
                      <td className="py-3 px-3 align-top text-right font-mono tabular-nums font-medium text-slate-900 whitespace-nowrap">
                        {formatPhpCompact(row.toAmount)}
                      </td>
                      <td
                        className={`py-3 px-3 align-top text-right font-mono tabular-nums whitespace-nowrap ${
                          row.absChange > 0
                            ? 'text-[#15803D]'
                            : row.absChange < 0
                              ? 'text-[#B91C1C]'
                              : 'text-slate-500'
                        }`}
                      >
                        {formatSignedPhpCompact(row.absChange)}
                      </td>
                      <td
                        className={`py-3 pl-3 pr-4 align-top text-right font-mono tabular-nums whitespace-nowrap ${
                          row.pctChange === null
                            ? 'text-slate-400'
                            : row.pctChange > 0
                              ? 'text-[#15803D]'
                              : row.pctChange < 0
                                ? 'text-[#B91C1C]'
                                : 'text-slate-500'
                        }`}
                      >
                        {row.pctChange !== null
                          ? formatSignedPercent(row.pctChange, 1)
                          : t.common.na}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-4 pb-4">
              <SourcePanel
                source={{
                  sourceName: 'BetterGovPH Philippine Budget API',
                  datasetName:
                    mode === 'nep-vs-gaa' ? 'GET /api/v1/nep/2027' : 'GET /api/v1/gaa/departments',
                  period: `${nationalComparison.fromLabel} vs ${nationalComparison.toLabel}`,
                  fetchedAt: fetchedAt ?? undefined,
                  sourceUpdated: mode === 'nep-vs-gaa' ? nepOverview?.generatedAt ?? null : null,
                  units: 'PHP & %',
                  method: t.methodology.yoyBody,
                  sourceUrl:
                    mode === 'nep-vs-gaa'
                      ? `${API_CONFIG.budgetBaseUrl}/nep/2027`
                      : `${API_CONFIG.budgetBaseUrl}/gaa/departments`,
                }}
              />
            </div>
          </section>

          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <span>
              {t.compare.allocationFooterQuestion}{' '}
              <GlossaryTooltip
                termKey="Appropriation vs Disbursement"
                label={t.glossary['Appropriation vs Disbursement']?.term}
              />
              .
            </span>
          </div>
        </>
      )}
    </div>
  );
}
