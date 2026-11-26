import { useEffect, useMemo, useState } from 'react';
import TransparencySplashScreen from './TransparencySplashScreen';
import Container from './v2/ui/Container';
import Eyebrow from './v2/ui/Eyebrow';
import Flag from './v2/ui/Flag';
import { useLanguage } from '../contexts/LanguageContext';
import {
  DatasetKey,
  fetchRegionalBudget,
  PSGC_MUNICIPALITIES,
  PSGC_PROVINCES,
  RegionalBudgetResult,
  RegionalProjectRow,
} from '../lib/regionalBudgetApi';

type SubView = '2027' | 'gaa';
type ChangeKind = 'inserted' | 'removed' | 'increased' | 'reduced' | 'unchanged';

function formatPhp(amount: number | null | undefined): string {
  if (typeof amount !== 'number' || Number.isNaN(amount) || amount === 0) return '—';
  return `₱${amount.toLocaleString('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function formatCompactPhp(amount: number): string {
  if (amount >= 1_000_000_000_000) return `₱${(amount / 1_000_000_000_000).toFixed(2)}T`;
  if (amount >= 1_000_000_000) return `₱${(amount / 1_000_000_000).toFixed(2)}B`;
  if (amount >= 1_000_000) return `₱${(amount / 1_000_000).toFixed(2)}M`;
  return `₱${amount.toLocaleString('en-PH')}`;
}

const DATASET_LABELS: Record<DatasetKey, string> = {
  dpwh: 'DPWH',
  fmr: 'FMR (DA)',
  hfep: 'HFEP (DOH)',
  nia: 'NIA',
};

function formatProvinceRegion(regionCode: string): string {
  if (regionCode === 'Bangsamoro Autonomous Region in Muslim Mindanao') return 'BARMM';
  if (regionCode === 'Cordillera Administrative Region') return 'CAR';
  return regionCode;
}

function classifyChange(p: RegionalProjectRow): { kind: ChangeKind; delta: number } {
  const nep = p.nepPhp ?? 0;
  const house = p.housePhp ?? 0;
  const delta = house - nep;
  if (nep === 0 && house > 0) return { kind: 'inserted', delta };
  if (nep > 0 && house === 0) return { kind: 'removed', delta };
  if (house > nep) return { kind: 'increased', delta };
  if (house < nep) return { kind: 'reduced', delta };
  return { kind: 'unchanged', delta: 0 };
}

function formatSignedPhp(delta: number): string {
  if (delta === 0) return '₱0';
  const sign = delta > 0 ? '+' : '−';
  return `${sign}₱${Math.abs(delta).toLocaleString('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function formatSignedCompactPhp(delta: number): string {
  if (delta === 0) return '₱0';
  const sign = delta > 0 ? '+' : '−';
  return `${sign}${formatCompactPhp(Math.abs(delta))}`;
}

const CHANGE_META: Record<
  ChangeKind,
  { label: string; badgeClass: string; textClass: string }
> = {
  inserted: {
    label: 'Inserted',
    badgeClass: 'bg-ed-red/10 text-ed-red border-ed-red/30',
    textClass: 'text-ed-red',
  },
  removed: {
    label: 'Removed',
    badgeClass: 'bg-ed-paper-2 text-ed-ink-2 border-ed-rule-strong',
    textClass: 'text-ed-ink-2',
  },
  increased: {
    label: 'Increased',
    badgeClass: 'bg-ed-navy/10 text-ed-navy border-ed-navy/30',
    textClass: 'text-ed-navy',
  },
  reduced: {
    label: 'Reduced',
    badgeClass: 'bg-ed-red/5 text-ed-red border-ed-red/25',
    textClass: 'text-ed-red',
  },
  unchanged: {
    label: 'Unchanged',
    badgeClass: 'bg-ed-paper-2 text-ed-ink-3 border-ed-rule',
    textClass: 'text-ed-ink-3',
  },
};

export default function RegionalBudgetSection() {
  const { t } = useLanguage();
  const [selectedProvinceCode, setSelectedProvinceCode] = useState<string>('015500000');
  const [selectedMuniPsgc, setSelectedMuniPsgc] = useState<string>('0105504000');
  const [data, setData] = useState<RegionalBudgetResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [fiscalYear, setFiscalYear] = useState<string>('2027');
  const subView: SubView = fiscalYear === '2027' ? '2027' : 'gaa';
  const gaaYear = fiscalYear === '2027' ? '2026' : fiscalYear;
  const [searchQuery, setSearchQuery] = useState('');
  const [datasetFilter, setDatasetFilter] = useState<'all' | DatasetKey>('all');
  const [changeFilter, setChangeFilter] = useState<'all' | ChangeKind>('all');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const provinceMunicipalities = useMemo(
    () =>
      selectedProvinceCode === 'all'
        ? []
        : PSGC_MUNICIPALITIES.filter((m) => m.provinceCode === selectedProvinceCode),
    [selectedProvinceCode]
  );

  const selectedProvince = useMemo(
    () =>
      selectedProvinceCode === 'all'
        ? undefined
        : PSGC_PROVINCES.find((p) => p.code === selectedProvinceCode),
    [selectedProvinceCode]
  );

  const selectedKey =
    selectedProvinceCode === 'all'
      ? 'all'
      : selectedMuniPsgc === 'all'
        ? `prov:${selectedProvinceCode}`
        : selectedMuniPsgc;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchRegionalBudget(selectedKey)
      .then((res) => {
        if (active) setData(res);
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to reach BetterGov Budget API.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedKey]);

  const kpis = useMemo(() => {
    if (!data) return { nep: 0, house: 0, delta: 0, count: 0 };
    if (data.summaryTotals) {
      return {
        nep: data.summaryTotals.nep,
        house: data.summaryTotals.house,
        delta: data.summaryTotals.delta,
        count: data.summaryTotals.totalLines,
      };
    }
    const nep = data.projects.reduce((sum, p) => sum + (p.nepPhp || 0), 0);
    const house = data.projects.reduce((sum, p) => sum + (p.housePhp || 0), 0);
    return { nep, house, delta: house - nep, count: data.projects.length };
  }, [data]);

  const changeSummary = useMemo(() => {
    const counts: Record<ChangeKind, number> = {
      inserted: 0,
      removed: 0,
      increased: 0,
      reduced: 0,
      unchanged: 0,
    };
    const totals: Record<ChangeKind, number> = {
      inserted: 0,
      removed: 0,
      increased: 0,
      reduced: 0,
      unchanged: 0,
    };
    if (data) {
      for (const p of data.projects) {
        const { kind, delta } = classifyChange(p);
        counts[kind] += 1;
        totals[kind] += delta;
      }
    }
    return { counts, totals };
  }, [data]);

  const filteredProjects = useMemo(() => {
    if (!data) return [];
    const q = searchQuery.trim().toLowerCase();
    return data.projects
      .filter((p) => datasetFilter === 'all' || p.dataset === datasetFilter)
      .filter((p) => changeFilter === 'all' || classifyChange(p).kind === changeFilter)
      .filter(
        (p) =>
          !q ||
          p.title.toLowerCase().includes(q) ||
          (p.office && p.office.toLowerCase().includes(q)) ||
          (p.program && p.program.toLowerCase().includes(q)) ||
          (p.pap && p.pap.toLowerCase().includes(q))
      )
      .sort((a, b) => (b.housePhp || b.nepPhp || 0) - (a.housePhp || a.nepPhp || 0));
  }, [data, datasetFilter, changeFilter, searchQuery]);

  const filteredGaa = useMemo(() => {
    if (!data) return [];
    const q = searchQuery.trim().toLowerCase();
    return data.gaaRecords
      .filter((g) => (g.years[gaaYear] || 0) > 0)
      .filter((g) => !q || g.name.toLowerCase().includes(q) || g.department.toLowerCase().includes(q))
      .sort((a, b) => (b.years[gaaYear] || 0) - (a.years[gaaYear] || 0));
  }, [data, gaaYear, searchQuery]);

  const gaaYearTotal = useMemo(
    () => filteredGaa.reduce((s, r) => s + (r.years[gaaYear] || 0), 0),
    [filteredGaa, gaaYear]
  );

  const gaaKpis = useMemo(() => {
    if (!data) {
      return {
        total: 0,
        yoyPct: null as number | null,
        yoyDelta: null as number | null,
        largestLineDept: null as { name: string; amount: number; pct: number } | null,
        lineItems: 0,
        deptCount: 0,
        topFundPct: 0,
      };
    }

    const prevYearNum = Number(gaaYear) - 1;
    const prevYear = prevYearNum >= 2020 ? String(prevYearNum) : null;

    if (selectedProvinceCode === 'all' && data.gaaDepartments?.length) {
      const activeDepts = data.gaaDepartments.filter(
        (d) => (d.years[gaaYear]?.amount || 0) > 0
      );
      const total = activeDepts.reduce(
        (sum, d) => sum + (d.years[gaaYear]?.amount || 0),
        0
      );
      const lineItems = activeDepts.reduce(
        (sum, d) => sum + (d.years[gaaYear]?.count || 0),
        0
      );
      const prevTotal = prevYear
        ? data.gaaDepartments.reduce(
            (sum, d) => sum + (d.years[prevYear]?.amount || 0),
            0
          )
        : 0;
      const yoyDelta = prevYear && prevTotal > 0 ? total - prevTotal : null;
      const yoyPct =
        prevYear && prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null;

      const sortedAll = [...activeDepts].sort(
        (a, b) => (b.years[gaaYear]?.amount || 0) - (a.years[gaaYear]?.amount || 0)
      );
      const topOverall = sortedAll[0];
      const topFundAmt = topOverall?.years[gaaYear]?.amount || 0;
      const topFundPct = total > 0 ? (topFundAmt / total) * 100 : 0;

      const lineAgencies = sortedAll.filter((d) =>
        d.slug.startsWith('department-of-')
      );
      const topLine = lineAgencies[0] || topOverall;
      const topLineAmt = topLine?.years[gaaYear]?.amount || 0;

      return {
        total,
        yoyPct,
        yoyDelta,
        largestLineDept: topLine
          ? {
              name: topLine.description,
              amount: topLineAmt,
              pct: total > 0 ? (topLineAmt / total) * 100 : 0,
            }
          : null,
        lineItems,
        deptCount: activeDepts.length,
        topFundPct,
      };
    }

    const yearRows = data.gaaRecords.filter((g) => (g.years[gaaYear] || 0) > 0);
    const total = yearRows.reduce((sum, g) => sum + (g.years[gaaYear] || 0), 0);
    const prevTotal = prevYear
      ? data.gaaRecords.reduce((sum, g) => sum + (g.years[prevYear] || 0), 0)
      : 0;
    const yoyDelta = prevYear && prevTotal > 0 ? total - prevTotal : null;
    const yoyPct =
      prevYear && prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null;

    const deptTotals = new Map<string, number>();
    for (const row of yearRows) {
      const dept = row.department || 'National Government';
      deptTotals.set(dept, (deptTotals.get(dept) || 0) + (row.years[gaaYear] || 0));
    }

    const sortedDepts = Array.from(deptTotals.entries()).sort((a, b) => b[1] - a[1]);
    const topOverall = sortedDepts[0];
    const topFundPct = topOverall && total > 0 ? (topOverall[1] / total) * 100 : 0;

    const lineAgencies = sortedDepts.filter(([name]) =>
      /^department of /i.test(name)
    );
    const topLine = lineAgencies[0] || topOverall;

    return {
      total,
      yoyPct,
      yoyDelta,
      largestLineDept: topLine
        ? {
            name: topLine[0],
            amount: topLine[1],
            pct: total > 0 ? (topLine[1] / total) * 100 : 0,
          }
        : null,
      lineItems: yearRows.length,
      deptCount: sortedDepts.length,
      topFundPct,
    };
  }, [data, gaaYear, selectedProvinceCode]);

  const exportCsv = () => {
    if (!data) return;
    const rows =
      subView === '2027'
        ? [
            ['Dataset', 'Change Type', 'Title', 'Program', 'PAP', 'Office', 'FY2027 NEP (PHP)', 'FY2027 House Bill (PHP)', 'Delta (PHP)', 'Detail URL'],
            ...filteredProjects.map((p) => {
              const { kind, delta } = classifyChange(p);
              return [
                DATASET_LABELS[p.dataset],
                CHANGE_META[kind].label,
                p.title,
                p.program || '',
                p.pap || '',
                p.office || '',
                String(p.nepPhp ?? ''),
                String(p.housePhp ?? ''),
                String(delta),
                p.detailUrl
                  ? p.detailUrl.startsWith('http')
                    ? p.detailUrl
                    : `https://budget.bettergov.ph${p.detailUrl}`
                  : '',
              ];
            }),
          ]
        : [
            ['Department', 'Program / Project', `FY ${gaaYear} Enacted (PHP)`],
            ...filteredGaa.map((g) => [g.department, g.name, String(g.years[gaaYear] || 0)]),
          ];

    const csv = rows
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `betteralcala-regional-${subView}-${selectedKey.replace(/[^a-z0-9]/gi, '-')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section id="regional-budget" className="py-12 max-md:py-8 bg-white">
      <Container>
        <div className="border border-ed-ink bg-white">
          {/* Broadsheet Editorial Header */}
          <div className="bg-ed-paper-2 border-b border-ed-ink p-5 sm:p-7">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 sm:gap-5">
              <div>
                <Eyebrow tone="navy">BetterGov Budget API Explorer</Eyebrow>
                <h2 className="m-0 mt-1.5 font-serif-ed text-2xl sm:text-3xl font-bold text-ed-ink tracking-[-0.02em]">
                  {data ? data.scopeLabel : t('budget-regional-title')}
                </h2>
                <p className="m-0 mt-1.5 text-sm text-ed-ink-2 max-w-2xl">
                  {t('budget-regional-desc')}
                </p>
              </div>

              {/* Scope Selector: Fiscal Year + Province + City/Municipality */}
              <div className="flex flex-col gap-2 shrink-0">
                <select
                  aria-label="Filter by Fiscal Year"
                  value={fiscalYear}
                  onChange={(e) => setFiscalYear(e.target.value)}
                  className="w-full border border-ed-ink bg-white px-3 py-2 font-mono-ed text-xs font-medium text-ed-ink focus:border-ed-navy focus:outline-none"
                >
                  <option value="2027">FY 2027 (NEP vs. House)</option>
                  {['2026', '2025', '2024', '2023', '2022', '2021', '2020'].map((yr) => (
                    <option key={yr} value={yr}>
                      FY {yr} (Enacted GAA)
                    </option>
                  ))}
                </select>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <select
                    aria-label="Filter by Province"
                    value={selectedProvinceCode}
                    onChange={(e) => {
                      setSelectedProvinceCode(e.target.value);
                      setSelectedMuniPsgc('all');
                    }}
                    className="border border-ed-ink bg-white px-3 py-2 text-xs sm:text-sm font-medium text-ed-ink focus:border-ed-navy focus:outline-none min-w-[200px]"
                  >
                    <option value="all">{t('budget-all-ph')}</option>
                    {PSGC_PROVINCES.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name === 'Metro Manila (NCR)'
                          ? p.name
                          : `${p.name} (${formatProvinceRegion(p.regionCode)})`}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Filter by Municipality or City"
                    value={selectedMuniPsgc}
                    disabled={selectedProvinceCode === 'all'}
                    onChange={(e) => setSelectedMuniPsgc(e.target.value)}
                    className="border border-ed-ink bg-white px-3 py-2 text-xs sm:text-sm font-medium text-ed-ink focus:border-ed-navy focus:outline-none min-w-[210px] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="all">
                      {selectedProvinceCode === 'all'
                        ? t('budget-all-of-ph')
                        : `${t('budget-all-of')} ${selectedProvince?.name || 'Province'}`}
                    </option>
                    {provinceMunicipalities.map((m) => (
                      <option key={m.psgc} value={m.psgc}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-7">
            {loading && <TransparencySplashScreen />}

            {!loading && error && (
              <div className="border-l-2 border-ed-red bg-ed-paper-2 p-4 text-sm text-ed-red">
                <strong>Unable to load regional budget data:</strong> {error}
              </div>
            )}

            {!loading && !error && data && (
              <>
                {/* KPI Strip (FY 2027 only) */}
                {subView === '2027' && (
                  <div className="grid grid-cols-2 lg:grid-cols-4 border border-ed-ink divide-y lg:divide-y-0 lg:divide-x divide-ed-rule bg-white mb-6">
                    <div className="p-4">
                      <Eyebrow tone="navy">FY 2027 NEP</Eyebrow>
                      <div className="font-serif-ed text-2xl sm:text-3xl font-bold text-ed-ink tabular-nums mt-1.5">
                        {formatCompactPhp(kpis.nep)}
                      </div>
                      <div className="text-xs text-ed-ink-3 mt-0.5">Executive Proposal</div>
                    </div>

                    <div className="p-4">
                      <Eyebrow tone="navy">FY 2027 House Bill</Eyebrow>
                      <div className="font-serif-ed text-2xl sm:text-3xl font-bold text-ed-navy tabular-nums mt-1.5">
                        {formatCompactPhp(kpis.house)}
                      </div>
                      <div className="text-xs text-ed-ink-3 mt-0.5">House Version</div>
                    </div>

                    <div className="p-4">
                      <Eyebrow tone="red">Net Delta (House − NEP)</Eyebrow>
                      <div className="font-serif-ed text-2xl sm:text-3xl font-bold text-ed-red tabular-nums mt-1.5">
                        {kpis.delta >= 0 ? '+' : '−'}
                        {formatCompactPhp(Math.abs(kpis.delta))}
                      </div>
                      <div className="text-xs text-ed-ink-3 mt-0.5">Total Discrepancy</div>
                    </div>

                    <div className="p-4">
                      <Eyebrow>Matched Lines</Eyebrow>
                      <div className="font-serif-ed text-2xl sm:text-3xl font-bold text-ed-ink tabular-nums mt-1.5">
                        {kpis.count.toLocaleString()}
                      </div>
                      <div className="text-xs text-ed-ink-3 mt-0.5">GAA Programs</div>
                    </div>
                  </div>
                )}

                {/* KPI Strip (FY 2020-2026 Enacted GAA) */}
                {subView === 'gaa' && (
                  <div className="grid grid-cols-2 lg:grid-cols-4 border border-ed-ink divide-y lg:divide-y-0 lg:divide-x divide-ed-rule bg-white mb-6">
                    <div className="p-4">
                      <Eyebrow tone="navy">FY{gaaYear} Enacted Budget (GAA)</Eyebrow>
                      <div
                        className="text-[11px] text-ed-ink-3 mt-0.5"
                        title="Appropriation is the legal authority to spend enacted in the GAA; disbursement is actual cash released and spent."
                      >
                        Appropriation vs. Disbursement
                      </div>
                      <div className="font-serif-ed text-2xl sm:text-3xl font-bold text-ed-ink tabular-nums mt-1">
                        {gaaKpis.total > 0 ? formatCompactPhp(gaaKpis.total) : '—'}
                      </div>
                      <div className="font-mono-ed text-[11px] text-ed-ink-3 tabular-nums mt-0.5 break-all">
                        {formatPhp(gaaKpis.total)}
                      </div>
                    </div>

                    <div className="p-4">
                      <Eyebrow>Year-over-Year Change</Eyebrow>
                      <div
                        className={`font-serif-ed text-2xl sm:text-3xl font-bold tabular-nums mt-1.5 ${
                          gaaKpis.yoyPct === null
                            ? 'text-ed-ink-3'
                            : gaaKpis.yoyPct >= 0
                              ? 'text-ed-navy'
                              : 'text-ed-red'
                        }`}
                      >
                        {gaaKpis.yoyPct === null
                          ? '—'
                          : `${gaaKpis.yoyPct >= 0 ? '+' : '−'}${Math.abs(gaaKpis.yoyPct).toFixed(2)}%`}
                      </div>
                      <div className="text-xs text-ed-ink-3 mt-0.5">
                        {gaaKpis.yoyDelta !== null
                          ? `${formatSignedCompactPhp(gaaKpis.yoyDelta)} · vs FY${Number(gaaYear) - 1} GAA`
                          : 'No prior GAA baseline'}
                      </div>
                    </div>

                    <div className="p-4">
                      <Eyebrow>Largest Line-Agency Dept.</Eyebrow>
                      <div className="font-serif-ed text-2xl sm:text-3xl font-bold text-ed-ink tabular-nums mt-1.5">
                        {gaaKpis.largestLineDept
                          ? formatCompactPhp(gaaKpis.largestLineDept.amount)
                          : '—'}
                      </div>
                      <div className="text-xs text-ed-ink-3 mt-0.5">
                        {gaaKpis.largestLineDept
                          ? `${gaaKpis.largestLineDept.name} (${gaaKpis.largestLineDept.pct.toFixed(1)}%)`
                          : 'No agency data for scope'}
                      </div>
                    </div>

                    <div className="p-4">
                      <Eyebrow>Dataset Coverage</Eyebrow>
                      <div
                        className="text-[11px] text-ed-ink-3 mt-0.5"
                        title="Automatic Appropriations are standing expenditures mandated by existing laws (e.g., debt interest, NTA/IRA) that do not require annual congressional action."
                      >
                        Automatic Appropriations
                      </div>
                      <div className="font-serif-ed text-2xl sm:text-3xl font-bold text-ed-navy tabular-nums mt-1">
                        {gaaKpis.lineItems.toLocaleString()}
                      </div>
                      <div className="text-xs text-ed-ink-3 mt-0.5">
                        Line items across {gaaKpis.deptCount} departments/funds · Top fund:{' '}
                        {gaaKpis.topFundPct.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                )}

                {/* Controls Row */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 mb-4">
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter projects or offices..."
                    aria-label="Filter regional budget projects"
                    className="w-full sm:flex-1 sm:max-w-md border border-ed-ink bg-white px-3.5 py-2 text-xs sm:text-sm text-ed-ink focus:border-ed-navy focus:outline-none"
                  />

                  <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto shrink-0">
                    {subView === '2027' && (
                      <select
                        aria-label="Filter by program"
                        value={datasetFilter}
                        onChange={(e) => setDatasetFilter(e.target.value as 'all' | DatasetKey)}
                        className="flex-1 sm:flex-none border border-ed-ink bg-white px-3 py-2 font-mono-ed text-xs font-medium text-ed-ink focus:border-ed-navy focus:outline-none"
                      >
                        <option value="all">All Programs</option>
                        <option value="dpwh">DPWH</option>
                        <option value="fmr">FMR (DA)</option>
                        <option value="hfep">HFEP (DOH)</option>
                        <option value="nia">NIA</option>
                      </select>
                    )}

                    <button
                      type="button"
                      onClick={exportCsv}
                      className="inline-flex items-center justify-center gap-1.5 border border-ed-ink bg-ed-paper-2 hover:bg-white px-3.5 py-2 font-mono-ed text-[11px] font-medium uppercase tracking-[0.08em] text-ed-ink cursor-pointer shrink-0"
                    >
                      <i className="bi bi-download" aria-hidden="true" />
                      <span>Export CSV</span>
                    </button>
                  </div>
                </div>

                {data.truncatedProjects && (
                  <p className="border-l-2 border-ed-navy bg-ed-paper-2 px-4 py-2.5 text-xs text-ed-ink-2 mb-4">
                    Showing the top 4,000 rows per dataset (exact nationwide totals are shown in the
                    summary cards above). Use the search box or select a province/municipality to
                    narrow results.
                  </p>
                )}

                {/* 2027 Projects: Change-Type Tabs + Mobile Accordion + Desktop Table */}
                {subView === '2027' && (
                  <>
                    <div
                      className="flex flex-nowrap overflow-x-auto items-center gap-1.5 pb-2 mb-3"
                      role="group"
                      aria-label="Filter by NEP vs House Bill change type"
                    >
                      <button
                        type="button"
                        onClick={() => setChangeFilter('all')}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 font-mono-ed text-[11px] uppercase tracking-[0.08em] whitespace-nowrap shrink-0 cursor-pointer border transition-colors ${
                          changeFilter === 'all'
                            ? 'bg-ed-navy text-white border-ed-navy'
                            : 'bg-ed-paper-2 text-ed-ink border-ed-rule-strong hover:border-ed-ink'
                        }`}
                      >
                        <span>All ({data.projects.length})</span>
                      </button>
                      {(['inserted', 'removed', 'increased', 'reduced', 'unchanged'] as ChangeKind[]).map(
                        (kind) => {
                          const count = changeSummary.counts[kind];
                          const meta = CHANGE_META[kind];
                          const active = changeFilter === kind;
                          return (
                            <button
                              key={kind}
                              type="button"
                              onClick={() => setChangeFilter(active ? 'all' : kind)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 font-mono-ed text-[11px] uppercase tracking-[0.08em] whitespace-nowrap shrink-0 cursor-pointer border transition-colors ${
                                active
                                  ? 'bg-ed-navy text-white border-ed-navy'
                                  : 'bg-white text-ed-ink border-ed-rule-strong hover:border-ed-ink'
                              }`}
                            >
                              <span>
                                {meta.label} ({count})
                              </span>
                            </button>
                          );
                        }
                      )}
                    </div>

                    <div className="border border-ed-ink overflow-hidden">
                      {/* Mobile Accordion */}
                      <div className="md:hidden divide-y divide-ed-rule">
                        {filteredProjects.slice(0, 100).map((p) => {
                          const rowKey = `${p.dataset}-${p.id}`;
                          const isOpen = expandedKey === rowKey;
                          const { kind, delta } = classifyChange(p);
                          const meta = CHANGE_META[kind];
                          return (
                            <div key={rowKey} className="bg-white">
                              <button
                                type="button"
                                aria-expanded={isOpen}
                                onClick={() => setExpandedKey(isOpen ? null : rowKey)}
                                className="w-full text-left p-3.5 flex items-start justify-between gap-2.5 cursor-pointer bg-transparent border-0"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                                    <Flag variant="outline">{DATASET_LABELS[p.dataset]}</Flag>
                                    <span
                                      className={`inline-block border px-2 py-[2px] font-mono-ed text-[10px] uppercase tracking-[0.1em] ${meta.badgeClass}`}
                                    >
                                      {meta.label}
                                    </span>
                                  </div>
                                  <div className="text-xs font-medium text-ed-ink leading-snug">
                                    {p.title}
                                  </div>
                                </div>
                                <div className="shrink-0 text-right">
                                  <div
                                    className={`font-mono-ed text-xs font-semibold tabular-nums ${
                                      delta !== 0 ? meta.textClass : 'text-ed-ink'
                                    }`}
                                  >
                                    {formatPhp(p.housePhp ?? p.nepPhp)}
                                  </div>
                                  {delta !== 0 && (
                                    <div
                                      className={`font-mono-ed text-[10px] font-semibold tabular-nums ${meta.textClass}`}
                                    >
                                      {formatSignedCompactPhp(delta)}
                                    </div>
                                  )}
                                  <i
                                    className={`bi ${isOpen ? 'bi-chevron-up' : 'bi-chevron-down'} text-xs text-ed-ink-3`}
                                    aria-hidden="true"
                                  />
                                </div>
                              </button>

                              {isOpen && (
                                <div className="px-3.5 pb-3.5 pt-2.5 bg-ed-paper-2 border-t border-ed-rule text-xs space-y-2">
                                  {p.program && (
                                    <div className="flex justify-between gap-2">
                                      <span className="text-ed-ink-3 shrink-0">Program</span>
                                      <span className="font-medium text-ed-ink text-right">
                                        {p.program}
                                      </span>
                                    </div>
                                  )}
                                  {p.pap && (
                                    <div className="flex justify-between gap-2">
                                      <span className="text-ed-ink-3 shrink-0">PAP Code</span>
                                      <span className="font-mono-ed text-ed-ink text-right">
                                        {p.pap}
                                      </span>
                                    </div>
                                  )}
                                  {p.office && (
                                    <div className="flex justify-between gap-2">
                                      <span className="text-ed-ink-3 shrink-0">Office</span>
                                      <span className="font-medium text-ed-ink text-right">
                                        {p.office}
                                      </span>
                                    </div>
                                  )}
                                  <div className="flex justify-between gap-2">
                                    <span className="text-ed-ink-3">FY 2027 NEP</span>
                                    <span className="font-mono-ed tabular-nums text-ed-ink">
                                      {formatPhp(p.nepPhp)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between gap-2">
                                    <span className="text-ed-ink-3">House Bill</span>
                                    <span
                                      className={`font-mono-ed tabular-nums font-semibold ${
                                        delta !== 0 ? meta.textClass : 'text-ed-ink'
                                      }`}
                                    >
                                      {formatPhp(p.housePhp)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between gap-2 border-t border-ed-rule pt-1.5">
                                    <span className="text-ed-ink-2 font-medium">Net Change</span>
                                    <span className={`font-mono-ed tabular-nums font-semibold ${meta.textClass}`}>
                                      {formatSignedPhp(delta)}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-3 pt-1 font-mono-ed text-[11px] uppercase tracking-[0.08em]">
                                    {p.nepPdfUrl && (
                                      <a
                                        href={p.nepPdfUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-ed-navy hover:underline"
                                      >
                                        NEP PDF{' '}
                                        <i className="bi bi-box-arrow-up-right" aria-hidden="true" />
                                      </a>
                                    )}
                                    {p.housePdfUrl && (
                                      <a
                                        href={p.housePdfUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-ed-red hover:underline"
                                      >
                                        House PDF{' '}
                                        <i className="bi bi-box-arrow-up-right" aria-hidden="true" />
                                      </a>
                                    )}
                                    {p.detailUrl && (
                                      <a
                                        href={
                                          p.detailUrl.startsWith('http')
                                            ? p.detailUrl
                                            : `https://budget.bettergov.ph${p.detailUrl}`
                                        }
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-ed-ink-2 hover:underline"
                                      >
                                        Details{' '}
                                        <i className="bi bi-box-arrow-up-right" aria-hidden="true" />
                                      </a>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {filteredProjects.length === 0 && (
                          <div className="py-8 text-center text-xs text-ed-ink-3">
                            No FY 2027 projects match the current filter.
                          </div>
                        )}
                      </div>

                      {/* Desktop Table */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs sm:text-sm">
                          <thead>
                            <tr className="bg-ed-paper-2 border-b border-ed-ink font-mono-ed text-[11px] uppercase tracking-[0.1em] text-ed-ink-2">
                              <th className="py-3 px-4 font-medium">Program &amp; Project</th>
                              <th className="py-3 px-4 font-medium whitespace-nowrap">Change</th>
                              <th className="py-3 px-4 font-medium text-right whitespace-nowrap">
                                FY 2027 NEP
                              </th>
                              <th className="py-3 px-4 font-medium text-right whitespace-nowrap">
                                House Bill
                              </th>
                              <th className="py-3 px-4 font-medium text-right whitespace-nowrap">
                                Net Change
                              </th>
                              <th className="py-3 px-4 font-medium whitespace-nowrap">Sources</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-ed-rule">
                            {filteredProjects.slice(0, 100).map((p) => {
                              const { kind, delta } = classifyChange(p);
                              const meta = CHANGE_META[kind];
                              return (
                                <tr key={`${p.dataset}-${p.id}`} className="hover:bg-ed-paper-2/60">
                                  <td className="py-3 px-4">
                                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                      <Flag variant="outline">{DATASET_LABELS[p.dataset]}</Flag>
                                      {p.office && (
                                        <span className="text-[11px] text-ed-ink-3">{p.office}</span>
                                      )}
                                      {p.pap && (
                                        <span className="font-mono-ed text-[10px] text-ed-ink-3">
                                          PAP {p.pap}
                                        </span>
                                      )}
                                    </div>
                                    <div className="font-medium text-ed-ink leading-snug">
                                      {p.title}
                                    </div>
                                    {p.program && (
                                      <div className="text-[11px] text-ed-ink-3 mt-0.5">
                                        {p.program}
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-3 px-4 whitespace-nowrap">
                                    <span
                                      className={`inline-block border px-2 py-[3px] font-mono-ed text-[10px] uppercase tracking-[0.1em] ${meta.badgeClass}`}
                                    >
                                      {meta.label}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-right font-mono-ed tabular-nums whitespace-nowrap text-ed-ink-2">
                                    {formatPhp(p.nepPhp)}
                                  </td>
                                  <td
                                    className={`py-3 px-4 text-right font-mono-ed tabular-nums font-semibold whitespace-nowrap ${
                                      delta !== 0 ? meta.textClass : 'text-ed-ink'
                                    }`}
                                  >
                                    {formatPhp(p.housePhp)}
                                  </td>
                                  <td
                                    className={`py-3 px-4 text-right font-mono-ed tabular-nums font-semibold whitespace-nowrap ${meta.textClass}`}
                                  >
                                    {delta === 0 ? '—' : formatSignedPhp(delta)}
                                  </td>
                                  <td className="py-3 px-4 whitespace-nowrap">
                                    <div className="flex items-center gap-2 font-mono-ed text-[11px] uppercase tracking-[0.08em]">
                                      {p.nepPdfUrl && (
                                        <a
                                          href={p.nepPdfUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-ed-navy hover:underline"
                                        >
                                          NEP
                                        </a>
                                      )}
                                      {p.housePdfUrl && (
                                        <a
                                          href={p.housePdfUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-ed-red hover:underline"
                                        >
                                          House
                                        </a>
                                      )}
                                      {p.detailUrl && (
                                        <a
                                          href={
                                            p.detailUrl.startsWith('http')
                                              ? p.detailUrl
                                              : `https://budget.bettergov.ph${p.detailUrl}`
                                          }
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-ed-ink-2 hover:underline"
                                        >
                                          Details
                                        </a>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                            {filteredProjects.length === 0 && (
                              <tr>
                                <td colSpan={6} className="py-8 text-center text-ed-ink-3">
                                  No FY 2027 projects match the current filter.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      {filteredProjects.length > 100 && (
                        <div className="bg-ed-paper-2 px-4 py-2.5 text-xs text-ed-ink-2 border-t border-ed-rule">
                          Showing top 100 of {filteredProjects.length} projects — filter by keyword or
                          export CSV to inspect all rows.
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* GAA 2020-2026: Mobile Stacked Cards + Desktop Table */}
                {subView === 'gaa' && (
                  <div className="border border-ed-ink overflow-hidden">
                    <div className="bg-ed-paper-2 px-4 py-2.5 border-b border-ed-ink flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-mono-ed uppercase tracking-[0.1em] text-ed-ink">
                        FY {gaaYear} Enacted GAA Programs ({filteredGaa.length})
                      </span>
                      <span className="font-mono-ed font-semibold text-ed-navy tabular-nums">
                        Total: {formatPhp(gaaYearTotal)}
                      </span>
                    </div>

                    {/* Mobile Stacked List */}
                    <div className="md:hidden divide-y divide-ed-rule">
                      {filteredGaa.slice(0, 100).map((g) => (
                        <div key={g.famKey} className="p-3.5 bg-white">
                          <div className="font-mono-ed text-[10px] uppercase tracking-[0.1em] text-ed-navy mb-1">
                            {g.department}
                          </div>
                          <div className="text-xs font-medium text-ed-ink leading-snug mb-1.5">
                            {g.name}
                          </div>
                          <div className="font-mono-ed tabular-nums text-xs font-semibold text-ed-ink">
                            {formatPhp(g.years[gaaYear])}
                          </div>
                        </div>
                      ))}
                      {filteredGaa.length === 0 && (
                        <div className="py-8 text-center text-xs text-ed-ink-3">
                          No enacted GAA records found for FY {gaaYear} with the current filter.
                        </div>
                      )}
                    </div>

                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs sm:text-sm">
                        <thead>
                          <tr className="bg-ed-paper-2 border-b border-ed-ink font-mono-ed text-[11px] uppercase tracking-[0.1em] text-ed-ink-2">
                            <th className="py-3 px-4 font-medium">Department &amp; Program</th>
                            <th className="py-3 px-4 font-medium text-right whitespace-nowrap">
                              FY {gaaYear} Amount
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-ed-rule">
                          {filteredGaa.slice(0, 100).map((g) => (
                            <tr key={g.famKey} className="hover:bg-ed-paper-2/60">
                              <td className="py-3 px-4">
                                <div className="font-mono-ed text-[10px] uppercase tracking-[0.1em] text-ed-navy mb-0.5">
                                  {g.department}
                                </div>
                                <div className="font-medium text-ed-ink leading-snug">{g.name}</div>
                              </td>
                              <td className="py-3 px-4 text-right font-mono-ed tabular-nums font-semibold text-ed-ink whitespace-nowrap">
                                {formatPhp(g.years[gaaYear])}
                              </td>
                            </tr>
                          ))}
                          {filteredGaa.length === 0 && (
                            <tr>
                              <td colSpan={2} className="py-8 text-center text-ed-ink-3">
                                No enacted GAA records found for FY {gaaYear} with the current filter.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Official API Notice */}
                <div className="mt-6 border border-ed-rule bg-ed-paper-2 px-4 py-3 text-xs text-ed-ink-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <span>{data.notice}</span>
                  <a
                    href="https://budget.bettergov.ph/docs"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono-ed text-[11px] uppercase tracking-[0.08em] font-medium text-ed-navy hover:underline whitespace-nowrap"
                  >
                    BetterGov Budget API Docs{' '}
                    <i className="bi bi-box-arrow-up-right" aria-hidden="true" />
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}
