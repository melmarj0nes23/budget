import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import BarangayProjectTracker from '../components/BarangayProjectTracker';

const RegionalBudgetSection = lazy(() => import('../components/RegionalBudgetSection'));
import { SourceCitationBox, VerificationBadge } from '../components/VerificationBadge';
import { BARANGAYS_DATA } from '../data/municipalInfo';
import { BUDGET_RECORDS, INFRASTRUCTURE_PROJECTS } from '../data/transparencyData';
import { isValidCitation, useCivicDataset } from '../hooks/useCivicDataset';
import { BudgetYearRecord, InfrastructureProject } from '../types/civic';

function formatPeso(amount: number): string {
  return `₱${amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatCompactPhp(amount: number): string {
  if (amount >= 1_000_000_000) return `₱${(amount / 1_000_000_000).toFixed(2)}B`;
  if (amount >= 1_000_000) return `₱${(amount / 1_000_000).toFixed(2)}M`;
  return `₱${amount.toLocaleString('en-PH')}`;
}

interface NationalBudgetRow {
  name?: string;
  title?: string;
  statusLabel?: string;
  years?: Record<string, number>;
  fy2024Php?: number;
  fy2025Php?: number;
  fy2026Php?: number;
  nepPhp?: number | null;
  housePhp?: number | null;
  deltaPhp?: number | null;
}

interface NationalBudgetPayload {
  gaaYears: number[];
  proposedYear: number;
  gaaProjects: NationalBudgetRow[];
  hgab2027Projects: NationalBudgetRow[];
}

type DistributionYear = string;

function getGaaRowYearAmount(row: NationalBudgetRow, year: number): number {
  const key = String(year);
  if (row.years && typeof row.years[key] === 'number') {
    return row.years[key];
  }
  if (year === 2024) return Number(row.fy2024Php) || 0;
  if (year === 2025) return Number(row.fy2025Php) || 0;
  if (year === 2026) return Number(row.fy2026Php) || 0;
  return 0;
}

function matchBarangayName(text: string): string | null {
  const hay = text.toLowerCase();
  for (const b of BARANGAYS_DATA) {
    const needle = b.name.toLowerCase();
    if (hay.includes(needle)) return b.name;
    if (needle === 'san pedro ili' && hay.includes('san pedo ili')) return b.name;
  }
  if (hay.includes('pindangan') && !hay.includes('pindangan east') && !hay.includes('pindangan west')) {
    return 'Pindangan Centro';
  }
  return null;
}

function isValidBudgetYear(item: unknown): item is BudgetYearRecord {
  if (!item || typeof item !== 'object') return false;
  const r = item as Record<string, unknown>;
  return (
    typeof r.fiscalYear === 'number' &&
    typeof r.approvedBudget === 'number' &&
    r.approvedBudget > 0 &&
    typeof r.appropriationOrdinance === 'string' &&
    typeof r.spResolution === 'string' &&
    isValidCitation(r.citation)
  );
}

function isValidInfraProject(item: unknown): item is InfrastructureProject {
  if (!item || typeof item !== 'object') return false;
  const p = item as Record<string, unknown>;
  return (
    typeof p.id === 'string' &&
    typeof p.name === 'string' &&
    typeof p.barangay === 'string' &&
    typeof p.category === 'string' &&
    isValidCitation(p.citation)
  );
}

type BudgetTab = 'summary' | 'tracker' | 'municipal' | 'dpwh' | 'regional';

const TAB_ROUTES: Record<BudgetTab, string> = {
  summary: '/',
  tracker: '/tracker',
  municipal: '/budgetdocs',
  dpwh: '/contracts',
  regional: '/transparency',
};

const TAB_SEO: Record<BudgetTab, { label: string; title: string; description: string }> = {
  summary: {
    label: 'Transparency & Budget',
    title: 'Transparency & Budget Overview',
    description:
      'FY 2026 municipal budget snapshot, funding mix, and direct access to Alcala, Pangasinan project trackers and public records.',
  },
  tracker: {
    label: 'Barangay Project Tracker',
    title: 'Barangay Project Tracker',
    description:
      'Filter funded roads, farm-to-market roads, flood control, and multi-purpose buildings across all 21 barangays in Alcala, Pangasinan.',
  },
  municipal: {
    label: 'Municipal Budget & Docs',
    title: 'Municipal Budget & Docs',
    description:
      'Approved municipal appropriations (FY 2024–2026), BLGF SRE, COA audit reports, and procurement disclosures for Alcala, Pangasinan.',
  },
  dpwh: {
    label: 'DPWH Contracts',
    title: 'DPWH Contracts',
    description:
      'Searchable DPWH infrastructure contracts, project budgets, contractors, and completion status in Alcala, Pangasinan.',
  },
  regional: {
    label: 'Project Transparency',
    title: 'Project Transparency',
    description:
      'Compare FY 2027 NEP vs. House Bill and 2020–2026 Enacted GAA allocations for Alcala, Pangasinan, and nationwide LGUs.',
  },
};

export default function BudgetPage() {
  const [searchParams] = useSearchParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const activeTab: BudgetTab = useMemo(() => {
    const cleanPath = pathname.replace(/\/+$/, '');
    if (cleanPath === '/tracker') return 'tracker';
    if (cleanPath === '/budgetdocs') return 'municipal';
    if (cleanPath === '/contracts' || searchParams.get('project')) return 'dpwh';
    if (cleanPath === '/transparency') return 'regional';
    return 'summary';
  }, [pathname, searchParams]);

  const setActiveTab = (tab: BudgetTab) => {
    navigate(TAB_ROUTES[tab]);
  };
  const budgetRecords = useCivicDataset(
    'fiscal_transparency.json',
    'fiscal_years',
    BUDGET_RECORDS,
    isValidBudgetYear
  );
  const infrastructureProjects = useCivicDataset(
    'dpwh-projects.json',
    'projects',
    INFRASTRUCTURE_PROJECTS,
    isValidInfraProject
  );

  const [selectedYear, setSelectedYear] = useState<number>(() => BUDGET_RECORDS[0]?.fiscalYear || 2026);
  const [hasManuallySelectedYear, setHasManuallySelectedYear] = useState(false);
  const [projectSearch, setProjectSearch] = useState(() => searchParams.get('project') || '');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [nationalPayload, setNationalPayload] = useState<NationalBudgetPayload | null>(null);
  const [distYear, setDistYear] = useState<DistributionYear>('all');
  const activeTabRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/data/national-budget-alcala.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const gaaProjects = Array.isArray(data.gaaProjects) ? data.gaaProjects : [];
        const gaaYears =
          Array.isArray(data.gaaYears) && data.gaaYears.length > 0
            ? data.gaaYears.map(Number).filter(Number.isFinite)
            : [2024, 2025, 2026];
        const proposedYear =
          typeof data.proposedYear === 'number' && Number.isFinite(data.proposedYear)
            ? data.proposedYear
            : 2027;
        setNationalPayload({
          gaaYears,
          proposedYear,
          gaaProjects,
          hgab2027Projects: Array.isArray(data.hgab2027Projects) ? data.hgab2027Projects : [],
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const nationalSummary = useMemo(() => {
    if (!nationalPayload) return null;
    const { gaaYears, proposedYear, gaaProjects: gaa, hgab2027Projects: hgab } = nationalPayload;
    const sumKey = (rows: NationalBudgetRow[], key: keyof NationalBudgetRow) =>
      rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
    const houseOnlyCount = hgab.filter((r) => r.statusLabel === 'House bill only').length;
    const sameCount = hgab.filter((r) => r.statusLabel === 'Same amount in both').length;
    const unconfirmedCount = hgab.filter(
      (r) => r.statusLabel && r.statusLabel !== 'House bill only' && r.statusLabel !== 'Same amount in both'
    ).length;
    const gaaTotalsByYear = gaaYears.map((yr) => ({
      year: yr,
      amount: gaa.reduce((total, row) => total + getGaaRowYearAmount(row, yr), 0),
    }));
    const gaaGrandTotal = gaaTotalsByYear.reduce((s, r) => s + r.amount, 0);
    const fyProposedNep = sumKey(hgab, 'nepPhp');
    const fyProposedHouse = sumKey(hgab, 'housePhp');
    return {
      gaaYears,
      proposedYear,
      gaaCount: gaa.length,
      hgabCount: hgab.length,
      gaaTotalsByYear,
      gaaGrandTotal,
      fyProposedNep,
      fyProposedHouse,
      fyProposedDelta: fyProposedHouse - fyProposedNep,
      houseOnlyCount,
      sameCount,
      unconfirmedCount,
    };
  }, [nationalPayload]);

  const barangayDistribution = useMemo(() => {
    if (!nationalPayload) return null;
    const { gaaYears, proposedYear } = nationalPayload;
    const totals = new Map<string, { amount: number; count: number }>();
    let townWideAmount = 0;
    let townWideCount = 0;

    const addEntry = (text: string, amount: number) => {
      if (amount <= 0) return;
      const brgy = matchBarangayName(text);
      if (brgy) {
        const prev = totals.get(brgy) || { amount: 0, count: 0 };
        totals.set(brgy, { amount: prev.amount + amount, count: prev.count + 1 });
      } else {
        townWideAmount += amount;
        townWideCount += 1;
      }
    };

    const selectedNumYear = distYear === 'all' ? null : Number(distYear);
    if (distYear === 'all' || (selectedNumYear !== null && gaaYears.includes(selectedNumYear))) {
      for (const row of nationalPayload.gaaProjects) {
        const amt =
          selectedNumYear !== null
            ? getGaaRowYearAmount(row, selectedNumYear)
            : gaaYears.reduce((sum, yr) => sum + getGaaRowYearAmount(row, yr), 0);
        addEntry(row.name || '', amt);
      }
    }

    if (distYear === 'all' || selectedNumYear === proposedYear) {
      for (const row of nationalPayload.hgab2027Projects) {
        const amt = Number(row.housePhp ?? row.nepPhp) || 0;
        addEntry(row.title || '', amt);
      }
    }

    const ranked = Array.from(totals.entries())
      .map(([name, info]) => ({ name, ...info }))
      .sort((a, b) => b.amount - a.amount);

    const barangayTotal = ranked.reduce((s, r) => s + r.amount, 0);
    const grandTotal = barangayTotal + townWideAmount;

    return {
      ranked,
      fundedBarangayCount: ranked.length,
      townWideAmount,
      townWideCount,
      barangayTotal,
      grandTotal,
    };
  }, [nationalPayload, distYear]);

  useEffect(() => {
    activeTabRef.current?.scrollIntoView({
      inline: 'center',
      block: 'nearest',
      behavior: 'smooth',
    });
  }, [activeTab]);

  useEffect(() => {
    const paramProj = searchParams.get('project');
    if (paramProj !== null) {
      setProjectSearch(paramProj);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!hasManuallySelectedYear && budgetRecords.length > 0) {
      const latestYear = Math.max(...budgetRecords.map((b) => b.fiscalYear));
      setSelectedYear(latestYear);
    }
  }, [budgetRecords, hasManuallySelectedYear]);

  const sortedBudgets = useMemo(
    () => [...budgetRecords].sort((a, b) => b.fiscalYear - a.fiscalYear),
    [budgetRecords]
  );

  const activeBudget =
    sortedBudgets.find((b) => b.fiscalYear === selectedYear) || sortedBudgets[0];

  const budgetYearsSummary = useMemo(() => {
    const asc = [...budgetRecords].sort((a, b) => a.fiscalYear - b.fiscalYear);
    const label =
      asc.length > 1
        ? `FY ${asc[0].fiscalYear} – FY ${asc[asc.length - 1].fiscalYear} Totals`
        : `FY ${asc[0]?.fiscalYear ?? 2026} Total`;
    const totals = asc
      .map((b) => `₱${(b.approvedBudget / 1_000_000).toFixed(2)}M`)
      .join(' / ');
    return { label, totals };
  }, [budgetRecords]);

  const projectCategories = useMemo(() => {
    return ['all', ...Array.from(new Set(infrastructureProjects.map((p) => p.category)))];
  }, [infrastructureProjects]);

  const filteredProjects = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    return infrastructureProjects.filter((p) => {
      if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        p.id.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.barangay.toLowerCase().includes(q) ||
        p.contractor.toLowerCase().includes(q)
      );
    });
  }, [infrastructureProjects, projectSearch, selectedCategory]);

  const totalVerifiedContractValue = useMemo(() => {
    return infrastructureProjects.reduce(
      (sum, p) => sum + (p.contractCost ?? p.abcAmount ?? 0),
      0
    );
  }, [infrastructureProjects]);

  const ascendingBudgets = useMemo(
    () => [...budgetRecords].sort((a, b) => a.fiscalYear - b.fiscalYear),
    [budgetRecords]
  );

  const maxAnnualBudget = useMemo(
    () => Math.max(...budgetRecords.map((b) => b.approvedBudget), 1),
    [budgetRecords]
  );

  const categoryTotals = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const p of infrastructureProjects) {
      const prev = map.get(p.category) || { count: 0, total: 0 };
      map.set(p.category, {
        count: prev.count + 1,
        total: prev.total + (p.contractCost ?? p.abcAmount ?? 0),
      });
    }
    return Array.from(map.entries()).map(([category, stats]) => ({ category, ...stats }));
  }, [infrastructureProjects]);

  const seo = TAB_SEO[activeTab];

  return (
    <Layout
      breadcrumbs={
        activeTab === 'summary'
          ? [{ label: 'Transparency & Budget' }]
          : [{ label: 'Transparency & Budget', to: '/budget' }, { label: seo.label }]
      }
      pageTitle={seo.title}
      pageDescription={seo.description}
    >
      <section className="trans-hero-v2">
        <div className="container">
          <div className="trans-hero-content-v2">
            <span className="trans-hero-badge-v2">
              <i className="bi bi-shield-check" aria-hidden="true" />{' '}
              <span>Fiscal &amp; Project Transparency</span>
            </span>
            <h1>Budget &amp; Financial Transparency</h1>
            <p>
              Approved municipal appropriations, execution status, COA/BLGF reporting, and DPWH
              infrastructure projects in Alcala
            </p>
          </div>
        </div>
      </section>

      {/* Overview Summary View (Default for effortless mobile/desktop scanning) */}
      {activeTab === 'summary' && (
        <section className="section">
          <div className="container">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-[#0f2342] m-0">
                Transparency &amp; Budget Summary
              </h2>
              <p className="text-sm text-slate-600 m-0 mt-1">
                FY {activeBudget.fiscalYear} fiscal snapshot, funding mix, and direct access to
                project trackers.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <button
                type="button"
                onClick={() => setActiveTab('municipal')}
                className="text-left bg-white border border-black/10 rounded-2xl p-5 shadow-xs hover:shadow-md hover:border-[#26489A]/40 transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#26489A]/10 text-[#26489A]">
                      <i className="bi bi-graph-up-arrow" aria-hidden="true" />
                    </span>
                    <span className="font-mono-data text-xs font-bold text-[#26489A] bg-[#26489A]/10 px-2.5 py-1 rounded-full">
                      FY {ascendingBudgets[0]?.fiscalYear ?? 2024}–
                      {ascendingBudgets[ascendingBudgets.length - 1]?.fiscalYear ?? 2026}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-[#0f2342] mb-1">
                    Municipal Budget 3-Year Growth
                  </h3>
                  {(() => {
                    const first = ascendingBudgets[0];
                    const latest = ascendingBudgets[ascendingBudgets.length - 1];
                    const growthPct =
                      first && latest && first.approvedBudget > 0
                        ? ((latest.approvedBudget - first.approvedBudget) / first.approvedBudget) *
                          100
                        : null;
                    return (
                      <>
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-2.5">
                          <span className="text-2xl font-extrabold text-[#26489A] tabular-nums">
                            {growthPct !== null ? `+${growthPct.toFixed(1)}%` : '—'}
                          </span>
                          <span className="text-xs font-semibold text-slate-500">
                            approved municipal budget growth
                          </span>
                        </div>
                        <div className="space-y-1.5 mb-2.5">
                          {ascendingBudgets.map((row, idx) => {
                            const widthPct = Math.max(
                              8,
                              Math.round((row.approvedBudget / maxAnnualBudget) * 100)
                            );
                            const prev = idx > 0 ? ascendingBudgets[idx - 1] : null;
                            const yoy =
                              prev && prev.approvedBudget > 0
                                ? ((row.approvedBudget - prev.approvedBudget) /
                                    prev.approvedBudget) *
                                  100
                                : null;
                            return (
                              <div
                                key={row.fiscalYear}
                                className="grid grid-cols-[68px_1fr_118px] items-center gap-2 text-[11px]"
                              >
                                <span className="font-mono-data font-semibold text-slate-600">
                                  FY {row.fiscalYear}
                                </span>
                                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-[#26489A]"
                                    style={{ width: `${widthPct}%` }}
                                  />
                                </div>
                                <span className="font-mono-data font-bold text-[#0f2342] text-right tabular-nums">
                                  {formatCompactPhp(row.approvedBudget)}
                                  {yoy !== null && (
                                    <span className="text-[#2E8B57] ml-1">
                                      (+{yoy.toFixed(1)}%)
                                    </span>
                                  )}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        <p className="text-[11px] text-slate-500 m-0">
                          Approved Sangguniang Bayan appropriations; COA/BLGF SRE execution records
                          inside.
                        </p>
                      </>
                    );
                  })()}
                </div>
                <span className="mt-4 text-xs font-bold text-[#26489A]">
                  Explore Municipal Budget &amp; Docs →
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('regional')}
                className="text-left bg-white border border-black/10 rounded-2xl p-5 shadow-xs hover:shadow-md hover:border-[#26489A]/40 transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#26489A]/10 text-[#26489A]">
                      <i className="bi bi-arrow-left-right" aria-hidden="true" />
                    </span>
                    <span className="font-mono-data text-xs font-bold text-[#26489A] bg-[#26489A]/10 px-2.5 py-1 rounded-full">
                      FY {nationalSummary?.proposedYear ?? 2027} NEP → House Bill
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-[#0f2342] mb-1">
                    FY {nationalSummary?.proposedYear ?? 2027} Proposed Budget Changes
                  </h3>
                  {nationalSummary ? (
                    <>
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-2.5">
                        <span className="text-2xl font-extrabold text-[#26489A] tabular-nums">
                          {nationalSummary.fyProposedDelta >= 0 ? '+' : '−'}
                          {formatCompactPhp(Math.abs(nationalSummary.fyProposedDelta))}
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                          net change across {nationalSummary.hgabCount} projects
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-2.5">
                        <div className="rounded-xl bg-slate-50 border border-black/5 px-3 py-2">
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Proposed (NEP)
                          </span>
                          <span className="font-mono-data text-sm font-extrabold text-[#0f2342] tabular-nums">
                            {formatCompactPhp(nationalSummary.fyProposedNep)}
                          </span>
                        </div>
                        <div className="rounded-xl bg-[#26489A]/5 border border-[#26489A]/15 px-3 py-2">
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-[#26489A]">
                            House Bill (HGAB)
                          </span>
                          <span className="font-mono-data text-sm font-extrabold text-[#26489A] tabular-nums">
                            {formatCompactPhp(nationalSummary.fyProposedHouse)}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap justify-center gap-1.5 text-[11px]">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#D1432A]/10 text-[#D1432A] font-semibold px-2.5 py-0.5">
                          Inserted: {nationalSummary.houseOnlyCount}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#2E8B57]/10 text-[#2E8B57] font-semibold px-2.5 py-0.5">
                          Matched: {nationalSummary.sameCount}
                        </span>
                        {nationalSummary.unconfirmedCount > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-900 font-semibold px-2.5 py-0.5">
                            Needs Review: {nationalSummary.unconfirmedCount}
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-slate-600 m-0">
                      Loading FY 2027 NEP vs. House Bill comparison...
                    </p>
                  )}
                </div>
                <span className="mt-4 text-xs font-bold text-[#26489A]">
                  Inspect FY 2027 Diff →
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('regional')}
                className="text-left bg-white border border-black/10 rounded-2xl p-5 shadow-xs hover:shadow-md hover:border-[#2E8B57]/40 transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#2E8B57]/12 text-[#2E8B57]">
                      <i className="bi bi-compass-fill" aria-hidden="true" />
                    </span>
                    <span className="font-mono-data text-xs font-bold text-[#2E8B57] bg-[#2E8B57]/12 px-2.5 py-1 rounded-full">
                      Live BetterGov API
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-[#0f2342] mb-1">
                    Project Transparency (GAA &amp; FY {nationalSummary?.proposedYear ?? 2027})
                  </h3>
                  {nationalSummary ? (
                    <>
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-2">
                        <span className="text-2xl font-extrabold text-[#2E8B57] tabular-nums">
                          {formatCompactPhp(nationalSummary.gaaGrandTotal)}
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                          FY {nationalSummary.gaaYears[0]}–
                          {nationalSummary.gaaYears[nationalSummary.gaaYears.length - 1]} GAA (
                          {nationalSummary.gaaCount} projects)
                        </span>
                      </div>
                      <div className="space-y-1.5 mb-2.5">
                        {[
                          ...nationalSummary.gaaTotalsByYear.map((row) => ({
                            label: `FY ${row.year} GAA`,
                            amount: row.amount,
                            tone: 'bg-[#26489A]',
                          })),
                          {
                            label: `FY ${nationalSummary.proposedYear} NEP`,
                            amount: nationalSummary.fyProposedNep,
                            tone: 'bg-[#008080]',
                          },
                          {
                            label: `FY ${nationalSummary.proposedYear} House`,
                            amount: nationalSummary.fyProposedHouse,
                            tone: 'bg-[#2E8B57]',
                          },
                        ].map((row) => {
                          const peak = Math.max(
                            ...nationalSummary.gaaTotalsByYear.map((r) => r.amount),
                            nationalSummary.fyProposedNep,
                            nationalSummary.fyProposedHouse,
                            1
                          );
                          const widthPct = Math.max(6, Math.round((row.amount / peak) * 100));
                          return (
                            <div key={row.label} className="grid grid-cols-[96px_1fr_72px] items-center gap-2 text-[11px]">
                              <span className="font-mono-data font-semibold text-slate-600">
                                {row.label}
                              </span>
                              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${row.tone}`}
                                  style={{ width: `${widthPct}%` }}
                                />
                              </div>
                              <span className="font-mono-data font-bold text-[#0f2342] text-right tabular-nums">
                                {formatCompactPhp(row.amount)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-[11px] text-slate-500 m-0">
                        Published GAA/NEP/HGAB allocations for Alcala ({nationalSummary.hgabCount} FY 2027
                        projects), not actual spending.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="text-2xl font-extrabold text-[#2E8B57] tabular-nums mb-1">
                        FY 2020–2027 Explorer
                      </div>
                      <p className="text-xs text-slate-600 m-0">
                        Compare FY 2027 NEP vs. House Bill &amp; 2020–2026 GAA for Alcala,
                        Pangasinan, and nationwide LGUs.
                      </p>
                    </>
                  )}
                </div>
                <span className="mt-4 text-xs font-bold text-[#2E8B57]">
                  Open Project Transparency →
                </span>
              </button>

              <div className="bg-white border border-black/10 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#D1432A]/10 text-[#D1432A]">
                      <i className="bi bi-bar-chart-steps" aria-hidden="true" />
                    </span>
                    <div
                      className="flex flex-wrap items-center gap-1 rounded-2xl bg-slate-100 p-1 max-w-full"
                      role="group"
                      aria-label="Filter barangay distribution by fiscal year"
                    >
                      {[
                        { id: 'all', label: 'All' },
                        ...(nationalPayload
                          ? [
                              ...nationalPayload.gaaYears.map((yr) => ({
                                id: String(yr),
                                label: String(yr),
                              })),
                              ...(!nationalPayload.gaaYears.includes(nationalPayload.proposedYear)
                                ? [
                                    {
                                      id: String(nationalPayload.proposedYear),
                                      label: String(nationalPayload.proposedYear),
                                    },
                                  ]
                                : []),
                            ]
                          : [
                              { id: '2024', label: '2024' },
                              { id: '2025', label: '2025' },
                              { id: '2026', label: '2026' },
                              { id: '2027', label: '2027' },
                            ]),
                      ].map((yr) => (
                        <button
                          key={yr.id}
                          type="button"
                          onClick={() => setDistYear(yr.id)}
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold transition-colors cursor-pointer ${
                            distYear === yr.id
                              ? 'bg-[#0f2342] text-white'
                              : 'text-slate-600 hover:text-[#0f2342]'
                          }`}
                        >
                          {yr.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <h3 className="text-base font-bold text-[#0f2342] mb-1">
                    Barangay Budget Distribution
                  </h3>
                  {barangayDistribution ? (
                    <>
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-2.5">
                        <span className="text-2xl font-extrabold text-[#D1432A] tabular-nums">
                          {formatCompactPhp(barangayDistribution.grandTotal)}
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                          across {barangayDistribution.fundedBarangayCount} of 21 barangays
                          {distYear === 'all' ? ' (2024–2027)' : ` (FY ${distYear})`}
                        </span>
                      </div>
                      <div className="space-y-1.5 mb-2.5">
                        {barangayDistribution.ranked.slice(0, 5).map((item) => {
                          const peak = Math.max(
                            barangayDistribution.ranked[0]?.amount || 0,
                            barangayDistribution.townWideAmount,
                            1
                          );
                          const widthPct = Math.max(6, Math.round((item.amount / peak) * 100));
                          return (
                            <div
                              key={item.name}
                              className="grid grid-cols-[120px_1fr_72px] items-center gap-2 text-[11px]"
                            >
                              <span className="font-semibold text-[#0f2342] truncate" title={item.name}>
                                {item.name}
                              </span>
                              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-[#D1432A]"
                                  style={{ width: `${widthPct}%` }}
                                />
                              </div>
                              <span className="font-mono-data font-bold text-[#0f2342] text-right tabular-nums">
                                {formatCompactPhp(item.amount)}
                              </span>
                            </div>
                          );
                        })}
                        {barangayDistribution.townWideAmount > 0 && (
                          <div className="grid grid-cols-[120px_1fr_72px] items-center gap-2 text-[11px]">
                            <span
                              className="font-semibold text-slate-500 truncate"
                              title="Town-wide or multi-barangay projects without a single barangay label"
                            >
                              Town-Wide / Other
                            </span>
                            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-slate-400"
                                style={{
                                  width: `${Math.max(
                                    6,
                                    Math.round(
                                      (barangayDistribution.townWideAmount /
                                        Math.max(
                                          barangayDistribution.ranked[0]?.amount || 0,
                                          barangayDistribution.townWideAmount,
                                          1
                                        )) *
                                        100
                                    )
                                  )}%`,
                                }}
                              />
                            </div>
                            <span className="font-mono-data font-bold text-slate-700 text-right tabular-nums">
                              {formatCompactPhp(barangayDistribution.townWideAmount)}
                            </span>
                          </div>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 m-0">
                        {barangayDistribution.ranked.length > 5
                          ? `Top 5 of ${barangayDistribution.ranked.length} funded barangays shown. `
                          : ''}
                        2027 reflects House Bill (HGAB) amounts.
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-slate-600 m-0">
                      Loading barangay-level allocation distribution...
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('tracker')}
                  className="mt-4 text-left text-xs font-bold text-[#D1432A] hover:underline cursor-pointer w-fit"
                >
                  Explore All 21 Barangays →
                </button>
              </div>
            </div>

            {/* Executive Visual Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white border border-black/10 rounded-2xl p-5 sm:p-6 shadow-xs">
                <div className="flex items-center justify-between gap-2 mb-4">
                  <h3 className="text-base font-bold text-[#0f2342] m-0">
                    FY {activeBudget.fiscalYear} Municipal Funding Mix
                  </h3>
                  <span className="font-mono-data text-xs font-semibold text-slate-500">
                    {activeBudget.spResolution}
                  </span>
                </div>

                {(() => {
                  const ntaMatch = activeBudget.ntaShareNote?.match(/NTA\)\s+share\s+of\s+₱([\d,]+(?:\.\d+)?)/i);
                  const ntaShareAmount = ntaMatch ? Number(ntaMatch[1].replace(/,/g, '')) : null;
                  if (!ntaShareAmount || !Number.isFinite(ntaShareAmount)) {
                    return (
                      <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                        {activeBudget.ntaShareNote}
                      </p>
                    );
                  }
                  const ntaPct =
                    Math.round((ntaShareAmount / activeBudget.approvedBudget) * 1000) / 10;
                  const localAmt = activeBudget.approvedBudget - ntaShareAmount;
                  const localPct = Math.round((100 - ntaPct) * 10) / 10;
                  return (
                    <div className="mb-5">
                      <div className="h-3 w-full rounded-full overflow-hidden bg-slate-100 flex mb-3">
                        <div
                          className="bg-[#26489A] h-full"
                          style={{ width: `${ntaPct}%` }}
                          title={`NTA Share (${ntaPct}%)`}
                        />
                        <div
                          className="bg-[#2E8B57] h-full"
                          style={{ width: `${localPct}%` }}
                          title={`Local & Other Revenues (${localPct}%)`}
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="rounded-xl bg-[#FAF7F2] p-3 border border-black/5">
                          <div className="flex items-center gap-1.5 font-semibold text-[#0f2342] mb-0.5">
                            <span className="h-2.5 w-2.5 rounded-full bg-[#26489A]" />
                            National Tax Allotment ({ntaPct}%)
                          </div>
                          <div className="font-mono-data font-bold text-[#26489A] tabular-nums">
                            {formatPeso(ntaShareAmount)}
                          </div>
                        </div>
                        <div className="rounded-xl bg-[#FAF7F2] p-3 border border-black/5">
                          <div className="flex items-center gap-1.5 font-semibold text-[#0f2342] mb-0.5">
                            <span className="h-2.5 w-2.5 rounded-full bg-[#2E8B57]" />
                            Local &amp; Other Sources ({localPct}%)
                          </div>
                          <div className="font-mono-data font-bold text-[#2E8B57] tabular-nums">
                            {formatPeso(localAmt)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="border-t border-black/5 pt-4 space-y-2.5">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Multi-Year Approved Appropriations
                  </div>
                  {ascendingBudgets.map((rec) => {
                    const pct = Math.round((rec.approvedBudget / maxAnnualBudget) * 100);
                    return (
                      <div key={rec.fiscalYear} className="text-xs">
                        <div className="flex justify-between gap-2 mb-1">
                          <span className="font-semibold text-[#0f2342]">
                            FY {rec.fiscalYear} ({rec.appropriationOrdinance})
                          </span>
                          <span className="font-mono-data font-bold text-[#0f2342] tabular-nums">
                            {formatPeso(rec.approvedBudget)}
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#26489A]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white border border-black/10 rounded-2xl p-5 sm:p-6 shadow-xs">
                <div className="flex items-center justify-between gap-2 mb-4">
                  <h3 className="text-base font-bold text-[#0f2342] m-0">
                    Documented DPWH Contracts by Sector
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('dpwh')}
                    className="text-xs font-bold text-[#D1432A] hover:underline bg-transparent border-0 p-0 cursor-pointer"
                  >
                    View all {infrastructureProjects.length} →
                  </button>
                </div>

                <div className="space-y-3">
                  {categoryTotals
                    .slice()
                    .sort((a, b) => b.total - a.total)
                    .map((cat) => {
                      const pct =
                        totalVerifiedContractValue > 0
                          ? Math.round((cat.total / totalVerifiedContractValue) * 100)
                          : 0;
                      return (
                        <div key={cat.category} className="text-xs">
                          <div className="flex justify-between gap-2 mb-1">
                            <span className="font-semibold text-[#0f2342]">
                              {cat.category}{' '}
                              <span className="text-slate-500 font-normal">({cat.count})</span>
                            </span>
                            <span className="font-mono-data font-bold text-[#0f2342] tabular-nums">
                              {formatPeso(cat.total)}
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#D1432A]"
                              style={{ width: `${Math.max(pct, 4)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Annual Budget & SRE Distinction */}
      {activeTab === 'municipal' && (
        <>
      <section className="sre-section-v2">
        <div className="container">
          <div className="sre-header-v2">
            <div className="sre-title-group">
              <span className="sre-label">
                <i className="bi bi-graph-up-arrow" aria-hidden="true" />{' '}
                <span>Annual Municipal Budget &amp; SRE</span>
              </span>
              <h2>Approved Appropriations vs. Execution Records</h2>
              <p>
                Approved budgets are verified via Sangguniang Panlalawigan resolutions; unreleased
                execution breakdowns are awaiting official LGU release.
              </p>
            </div>

            <div className="sre-period-toggle" role="tablist" aria-label="Select fiscal year">
              {sortedBudgets.map((b) => (
                <button
                  key={b.fiscalYear}
                  type="button"
                  role="tab"
                  aria-selected={selectedYear === b.fiscalYear}
                  onClick={() => {
                    setHasManuallySelectedYear(true);
                    setSelectedYear(b.fiscalYear);
                  }}
                  className={`sre-period-btn ${selectedYear === b.fiscalYear ? 'active' : ''}`}
                >
                  <span className="sre-period-q">FY {b.fiscalYear}</span>
                  <span className="sre-period-range">Operative Budget</span>
                </button>
              ))}
            </div>
          </div>

          <div className="sre-metrics-row">
            <div className="sre-metric-card sre-metric-income">
              <div className="sre-metric-icon">
                <i className="bi bi-check2-circle" aria-hidden="true" />
              </div>
              <div className="sre-metric-data">
                <span className="sre-metric-value tabular-nums">
                  {formatPeso(activeBudget.approvedBudget)}
                </span>
                <span className="sre-metric-label">Approved Annual Budget (FY {activeBudget.fiscalYear})</span>
              </div>
            </div>

            <div className="sre-metric-card sre-metric-expense">
              <div className="sre-metric-icon">
                <i className="bi bi-clipboard-data" aria-hidden="true" />
              </div>
              <div className="sre-metric-data">
                <span className="sre-metric-value">Pending Release</span>
                <span className="sre-metric-label">Obligations (Allotments Committed)</span>
                <div className="mt-1">
                  <VerificationBadge status={activeBudget.sreStatus} />
                </div>
              </div>
            </div>

            <div className="sre-metric-card sre-metric-net">
              <div className="sre-metric-icon">
                <i className="bi bi-cash-stack" aria-hidden="true" />
              </div>
              <div className="sre-metric-data">
                <span className="sre-metric-value">Pending Release</span>
                <span className="sre-metric-label">Disbursements (Cash Paid)</span>
                <div className="mt-1">
                  <VerificationBadge status={activeBudget.sreStatus} />
                </div>
              </div>
            </div>

            <div className="sre-metric-card sre-metric-balance">
              <div className="sre-metric-icon">
                <i className="bi bi-receipt" aria-hidden="true" />
              </div>
              <div className="sre-metric-data">
                <span className="sre-metric-value">Pending Release</span>
                <span className="sre-metric-label">Actual Expenditures (BLGF eSRE)</span>
                <div className="mt-1">
                  <VerificationBadge status={activeBudget.sreStatus} />
                </div>
              </div>
            </div>
          </div>

          {ascendingBudgets.length > 1 && (
            <div className="bg-white border border-black/10 rounded-xl p-5 mt-6">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div>
                  <h3 className="text-base font-bold text-[#0032a0] m-0">
                    Multi-Year Approved Appropriations Comparison
                  </h3>
                  <p className="text-xs text-slate-600 m-0">
                    Click a fiscal year bar to inspect its Sangguniang Panlalawigan operative record
                  </p>
                </div>
                <span className="text-xs font-mono-data text-slate-500">
                  {budgetYearsSummary.label}
                </span>
              </div>
              <div className="space-y-3">
                {ascendingBudgets.map((b, idx) => {
                  const prev = idx > 0 ? ascendingBudgets[idx - 1] : null;
                  const pctDiff = prev
                    ? (((b.approvedBudget - prev.approvedBudget) / prev.approvedBudget) * 100).toFixed(
                        1
                      )
                    : null;
                  const barPct = Math.round((b.approvedBudget / maxAnnualBudget) * 100);
                  const isActive = b.fiscalYear === activeBudget.fiscalYear;
                  return (
                    <button
                      key={b.fiscalYear}
                      type="button"
                      onClick={() => {
                        setHasManuallySelectedYear(true);
                        setSelectedYear(b.fiscalYear);
                      }}
                      className={`w-full text-left rounded-lg border p-3 transition cursor-pointer ${
                        isActive
                          ? 'border-[#0032a0] bg-blue-50/40'
                          : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-1.5">
                        <span className="font-bold text-slate-900 font-mono-data">
                          FY {b.fiscalYear}
                        </span>
                        <span className="font-mono-data font-bold text-[#0032a0]">
                          {formatPeso(b.approvedBudget)}
                          {pctDiff && (
                            <span className="ml-2 text-emerald-700 font-semibold">
                              (+{pctDiff}% YoY)
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-slate-200/80 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isActive ? 'bg-[#0032a0]' : 'bg-slate-400'
                          }`}
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-6 items-stretch">
            <div className="lg:col-span-5 bg-white border border-black/10 rounded-xl p-5 flex flex-col">
              <h3 className="text-base font-bold text-[#0032a0] mb-3">
                FY {activeBudget.fiscalYear} Enactment &amp; Provincial Review
              </h3>
              <dl className="space-y-2.5 text-sm text-slate-700 m-0">
                <div>
                  <dt className="font-semibold text-slate-900">Municipal Enactment</dt>
                  <dd className="m-0">{activeBudget.appropriationOrdinance}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-900">Sangguniang Panlalawigan Action</dt>
                  <dd className="m-0">{activeBudget.spResolution}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-900">National Tax Allotment (NTA) &amp; 20% DF</dt>
                  <dd className="m-0">{activeBudget.ntaShareNote}</dd>
                </div>
              </dl>
            </div>

            <div className="lg:col-span-7 bg-white border border-black/10 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-[#0032a0] mb-3">
                  Understanding Budget Terms &amp; Public Records
                </h3>
                <ul className="space-y-2 text-sm text-slate-700 m-0">
                  <li>
                    <strong>Approved Budget:</strong> Maximum spending authority enacted by the
                    Sangguniang Bayan and declared operative by the Sangguniang Panlalawigan.
                  </li>
                  <li>
                    <strong>Obligations:</strong> Binding commitments (contracts/purchase orders)
                    charged against approved appropriations.
                  </li>
                  <li>
                    <strong>Disbursements &amp; Actual Expenditures:</strong> Cash settled and final
                    audited expenses reported in the BLGF Statement of Receipts and Expenditures (SRE)
                    and Commission on Audit (COA) Annual Audit Reports.
                  </li>
                </ul>
              </div>

              <div className="mt-4 pt-4 border-t border-black/10 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <a
                  href="https://blgf.gov.ph/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline btn-sm justify-center whitespace-nowrap !px-2.5 !text-xs"
                >
                  BLGF eSRE Portal <i className="bi bi-box-arrow-up-right" aria-hidden="true" />
                </a>
                <a
                  href="https://www.coa.gov.ph/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline btn-sm justify-center whitespace-nowrap !px-2.5 !text-xs"
                >
                  COA Region I Audit Reports <i className="bi bi-box-arrow-up-right" aria-hidden="true" />
                </a>
                <a
                  href="https://notices.philgeps.gov.ph/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline btn-sm justify-center whitespace-nowrap !px-2.5 !text-xs"
                >
                  PhilGEPS Procurement <i className="bi bi-box-arrow-up-right" aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>

          <SourceCitationBox citation={activeBudget.citation} />
        </div>
      </section>

      {/* AIP / Financial Statements / Procurement Status Table */}
      <section className="section bg-alt">
        <div className="container">
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            Municipal Financial &amp; Procurement Document Registry
          </h2>
          <p className="text-sm text-slate-600 mb-4">
            Status of core Full Disclosure Policy (FDP) documents for Alcala, Pangasinan
          </p>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Document Category</th>
                  <th scope="col">Issuing / Oversight Agency</th>
                  <th scope="col">Current Public Availability</th>
                  <th scope="col">Verification Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td data-label="Document Category">Annual Budgets ({budgetYearsSummary.label})</td>
                  <td data-label="Issuing / Oversight Agency">SB Alcala / SP Pangasinan</td>
                  <td data-label="Current Public Availability">
                    Operative totals verified ({budgetYearsSummary.totals})
                  </td>
                  <td data-label="Verification Status">
                    <span className="text-xs font-medium text-slate-600">Confirmed</span>
                  </td>
                </tr>
                <tr>
                  <td data-label="Document Category">Annual Investment Program (AIP)</td>
                  <td data-label="Issuing / Oversight Agency">MPDC / Municipal Budget Office</td>
                  <td data-label="Current Public Availability">
                    Full line-item schedule not yet published online
                  </td>
                  <td data-label="Verification Status">
                    <VerificationBadge status="Needs Review" />
                  </td>
                </tr>
                <tr>
                  <td data-label="Document Category">Statement of Receipts &amp; Expenditures (SRE)</td>
                  <td data-label="Issuing / Oversight Agency">
                    Bureau of Local Government Finance (BLGF)
                  </td>
                  <td data-label="Current Public Availability">
                    Routed via BLGF eSRE portal; municipal breakdown pending extraction
                  </td>
                  <td data-label="Verification Status">
                    <VerificationBadge status="Needs Review" />
                  </td>
                </tr>
                <tr>
                  <td data-label="Document Category">COA Annual Audit Reports (AAR)</td>
                  <td data-label="Issuing / Oversight Agency">
                    Commission on Audit (COA Region I)
                  </td>
                  <td data-label="Current Public Availability">
                    Archived on{' '}
                    <a href="https://www.coa.gov.ph/" target="_blank" rel="noopener noreferrer">
                      coa.gov.ph
                    </a>
                  </td>
                  <td data-label="Verification Status">
                    <span className="text-xs font-medium text-slate-600">Archived online</span>
                  </td>
                </tr>
                <tr>
                  <td data-label="Document Category">Municipal Procurement Notices &amp; Bids</td>
                  <td data-label="Issuing / Oversight Agency">BAC Alcala / PhilGEPS</td>
                  <td data-label="Current Public Availability">
                    Published via{' '}
                    <a
                      href="https://notices.philgeps.gov.ph/"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      PhilGEPS
                    </a>
                  </td>
                  <td data-label="Verification Status">
                    <VerificationBadge status="Needs Review" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
        </>
      )}

      {/* DPWH Infrastructure Projects in Alcala */}
      {activeTab === 'dpwh' && (
      <section id="dpwh-projects" className="infra-section-v5">
        <div className="container">
          <div className="mb-6">
            <span className="sre-label">
              <i className="bi bi-cone-striped" aria-hidden="true" />{' '}
              <span>DPWH Pangasinan 3rd District Engineering Office</span>
            </span>
            <h2 className="mt-2">Infrastructure Projects in Alcala, Pangasinan</h2>
            <p className="text-slate-600">
              {infrastructureProjects.length} documented DPWH public works projects across Alcala’s
              barangays (total documented ABC/awarded allocations shown:{' '}
              <strong className="tabular-nums">{formatPeso(totalVerifiedContractValue)}</strong>).
            </p>
          </div>

          {categoryTotals.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
              {categoryTotals.map((item) => {
                const isSelected = selectedCategory === item.category;
                return (
                  <button
                    key={item.category}
                    type="button"
                    onClick={() =>
                      setSelectedCategory((prev) =>
                        prev === item.category ? 'all' : item.category
                      )
                    }
                    className={`text-left rounded-xl border p-4 transition cursor-pointer ${
                      isSelected
                        ? 'border-[#0032a0] bg-blue-50/60'
                        : 'border-black/10 bg-white hover:border-[#0032a0]/40'
                    }`}
                  >
                    <div className="text-xs font-semibold text-slate-500 truncate">
                      {item.category}
                    </div>
                    <div className="text-base font-bold text-[#0032a0] font-mono-data mt-1">
                      {item.total > 0 ? formatPeso(item.total) : 'Pending / N/A'}
                    </div>
                    <div className="text-[11px] text-slate-600 mt-1 font-mono-data">
                      {item.count} {item.count === 1 ? 'project' : 'projects'} ·{' '}
                      {isSelected ? 'Showing (click to clear)' : 'Click to filter'}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="bg-slate-50 border border-black/10 rounded-xl p-4 mb-6">
            <div className="flex flex-col md:flex-row gap-3 justify-between mb-3">
              <input
                type="search"
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                placeholder="Search Contract ID, barangay, or contractor..."
                aria-label="Search infrastructure projects"
                className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm focus:border-[#0032a0] focus:outline-none"
              />
              <span className="text-sm text-slate-600 self-center tabular-nums">
                {filteredProjects.length}{' '}
                {filteredProjects.length === 1 ? 'project' : 'projects'}
              </span>
            </div>
            <div className="mobile-filter-select-wrap">
              <label htmlFor="budget-project-category-select" className="mobile-filter-select-label">
                Project Type
              </label>
              <select
                id="budget-project-category-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="mobile-filter-select"
                aria-label="Filter infrastructure projects by type"
              >
                {projectCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === 'all' ? 'All Project Types' : cat}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-tab-bar filter-tab-bar--collapsible mb-0">
              {projectCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`filter-tab-btn ${selectedCategory === cat ? 'active' : ''}`}
                >
                  {cat === 'all' ? 'All Project Types' : cat}
                </button>
              ))}
            </div>
          </div>

          {filteredProjects.length === 0 ? (
            <div className="bg-white border border-black/10 rounded-xl p-8 text-center">
              <p className="text-sm font-semibold text-slate-900 mb-1">
                No infrastructure projects match your filter.
              </p>
              <p className="text-xs text-slate-600 mb-4">
                Try clearing the search query or selecting All Project Types.
              </p>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setProjectSearch('');
                  setSelectedCategory('all');
                }}
              >
                Show All Projects
              </button>
            </div>
          ) : (
            <div className="grid grid-2" style={{ gap: 'var(--spacing-md)' }}>
              {filteredProjects.map((proj) => (
                <article
                  key={proj.id}
                  className="bg-white border border-black/10 rounded-xl p-5 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-bold text-[#0032a0] tabular-nums">
                        Contract ID: {proj.id} · {proj.projectDate}
                      </span>
                      <VerificationBadge status={proj.citation.verificationStatus} />
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mb-2">{proj.name}</h3>
                    <div className="text-xs text-slate-600 space-y-1 mb-3">
                      <div>
                        <strong>Location / Barangay:</strong> {proj.location}
                      </div>
                      <div>
                        <strong>Category:</strong> {proj.category}
                      </div>
                      <div>
                        <strong>Implementing Agency:</strong> {proj.implementingAgency}
                      </div>
                      <div>
                        <strong>Funding Source:</strong> {proj.fundingSource}
                      </div>
                      <div>
                        <strong>Contractor:</strong> {proj.contractor}
                      </div>
                      {proj.abcAmount && (
                        <div className="tabular-nums">
                          <strong>Approved Budget (ABC):</strong> {formatPeso(proj.abcAmount)}
                        </div>
                      )}
                      {proj.contractCost && (
                        <div className="tabular-nums">
                          <strong>Awarded Contract Cost:</strong> {formatPeso(proj.contractCost)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-black/5 pt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-emerald-700">{proj.statusLabel}</span>
                    <a
                      href={proj.citation.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-[#0032a0]"
                    >
                      DPWH Source <i className="bi bi-box-arrow-up-right" aria-hidden="true" />
                    </a>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
      )}

      {activeTab === 'tracker' && (
        <BarangayProjectTracker dpwhProjects={infrastructureProjects} />
      )}

      {activeTab === 'regional' && (
        <Suspense
          fallback={
            <section className="section bg-alt">
              <div className="container py-12 text-center text-sm text-slate-600">
                Loading Project Transparency...
              </div>
            </section>
          }
        >
          <RegionalBudgetSection />
        </Suspense>
      )}
    </Layout>
  );
}
