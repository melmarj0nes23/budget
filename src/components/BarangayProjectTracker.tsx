import { useEffect, useMemo, useState } from 'react';
import { BARANGAYS_DATA } from '../data/municipalInfo';
import Container from './v2/ui/Container';
import Eyebrow from './v2/ui/Eyebrow';
import Flag from './v2/ui/Flag';
import SectionHeader from './v2/ui/SectionHeader';
import { useLanguage } from '../contexts/LanguageContext';
import { InfrastructureProject } from '../types/civic';

interface GaaProject {
  famKey: string;
  name: string;
  department: string;
  years?: Record<string, number>;
  fy2024Php: number;
  fy2025Php: number;
  fy2026Php: number;
}

interface HgabProject {
  id: string;
  dataset: string;
  title: string;
  program: string | null;
  statusLabel: string;
  nepPhp: number | null;
  housePhp: number | null;
  housePdfUrl: string | null;
  detailUrl: string | null;
}

interface NationalBudgetPayload {
  gaaProjects: GaaProject[];
  hgab2027Projects: HgabProject[];
}

function formatPhp(amount: number | null | undefined): string {
  if (typeof amount !== 'number' || Number.isNaN(amount) || amount <= 0) return '—';
  return `₱${amount.toLocaleString('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function normalizeProjectText(text: string): string {
  return text
    .toLowerCase()
    .replace(/san pedo ili|san pedro 2i/g, 'san pedro ili')
    .replace(/pinadangan east/g, 'pindangan east')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findMatchingDpwh(
  g: GaaProject,
  dpwhProjects: InfrastructureProject[]
): InfrastructureProject | undefined {
  const gNorm = normalizeProjectText(g.name);
  const gYears = Object.entries(g.years || {})
    .filter(([, v]) => Number(v) > 0)
    .map(([yr, amt]) => ({ yr, amt: Number(amt) }));

  return dpwhProjects.find((d) => {
    const dNorm = normalizeProjectText(`${d.name} ${d.barangay}`);
    const dYearMatch = d.projectDate.match(/\b(20\d{2})\b/);
    const dYear = dYearMatch ? dYearMatch[1] : null;

    if (d.gaaAllocation && dYear) {
      const yrMatch = gYears.find((y) => y.yr === dYear && y.amt === d.gaaAllocation);
      if (!yrMatch) return false;
    } else if (dYear) {
      const hasYear = gYears.some((y) => y.yr === dYear);
      if (!hasYear) return false;
    }

    const brgy = normalizeProjectText(d.barangay);
    if (brgy && brgy !== 'municipal wide' && !brgy.includes('agno river')) {
      const brgyParts = brgy.split(' ').filter((w) => w.length > 2);
      const hasBrgy = brgyParts.every((part) => gNorm.includes(part));
      if (!hasBrgy) return false;
    }

    // Disambiguate projects in the same barangay and year (e.g. school covered court vs barangay MPB)
    const keywords = [
      'covered court',
      'elementary school',
      'integrated school',
      'central school',
      'fmr',
      'road',
      'flood control',
      'drainage',
      'evacuation',
      'senior citizens',
      'day care',
    ];
    for (const kw of keywords) {
      if (dNorm.includes(kw) && !gNorm.includes(kw)) {
        if (kw === 'road' && gNorm.includes('fmr')) continue;
        return false;
      }
    }
    return true;
  });
}

function matchesBarangay(text: string, barangayName: string): boolean {
  const hay = text.toLowerCase();
  const needle = barangayName.toLowerCase();
  if (hay.includes(needle)) return true;
  // Handle common Pindangan / San Pedro variants in official records
  if (
    needle === 'pindangan centro' &&
    hay.includes('pindangan') &&
    !hay.includes('pindangan east') &&
    !hay.includes('pindangan west') &&
    !hay.includes('pinadangan east')
  ) {
    return true;
  }
  if (needle === 'pindangan east' && hay.includes('pinadangan east')) return true;
  if (needle === 'san pedro ili' && (hay.includes('san pedo ili') || hay.includes('san pedro 2i'))) return true;
  return false;
}

export default function BarangayProjectTracker({
  dpwhProjects,
}: {
  dpwhProjects: InfrastructureProject[];
}) {
  const { t } = useLanguage();
  const [national, setNational] = useState<NationalBudgetPayload | null>(null);
  const [selectedBarangay, setSelectedBarangay] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/data/national-budget-alcala.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: NationalBudgetPayload | null) => {
        if (active && data) setNational(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const barangayCounts = useMemo(() => {
    const sorted = [...BARANGAYS_DATA].sort((a, b) => a.name.localeCompare(b.name));
    return sorted.map((b) => {
      const hgabCount = (national?.hgab2027Projects || []).filter((p) =>
        matchesBarangay(p.title, b.name)
      ).length;
      const gaaCount = (national?.gaaProjects || []).filter((g) =>
        matchesBarangay(g.name, b.name)
      ).length;
      const dpwhCount = dpwhProjects.filter(
        (d) => matchesBarangay(d.barangay, b.name) || matchesBarangay(d.name, b.name)
      ).length;
      return {
        name: b.name,
        psgcCode: b.psgcCode,
        total: hgabCount + gaaCount + dpwhCount,
      };
    });
  }, [national, dpwhProjects]);

  const filteredData = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filterByBrgy = (text: string) =>
      selectedBarangay === 'all' || matchesBarangay(text, selectedBarangay);
    const filterBySearch = (text: string) => !q || text.toLowerCase().includes(q);

    const hgab = (national?.hgab2027Projects || []).filter(
      (p) => filterByBrgy(p.title) && filterBySearch(`${p.title} ${p.program || ''}`)
    );
    const gaa = (national?.gaaProjects || []).filter(
      (g) => filterByBrgy(g.name) && filterBySearch(`${g.name} ${g.department}`)
    );
    const dpwh = dpwhProjects.filter(
      (d) =>
        filterByBrgy(`${d.barangay} ${d.name}`) &&
        filterBySearch(`${d.name} ${d.barangay} ${d.category}`)
    );

    const gaaTotal = gaa.reduce((sum, g) => {
      if (g.years && Object.keys(g.years).length > 0) {
        return sum + Object.values(g.years).reduce((s, v) => s + (Number(v) || 0), 0);
      }
      return sum + (g.fy2024Php || 0) + (g.fy2025Php || 0) + (g.fy2026Php || 0);
    }, 0);
    const hgabTotal = hgab.reduce((sum, p) => sum + (p.housePhp || p.nepPhp || 0), 0);

    return {
      hgab,
      gaa,
      dpwh,
      totalRecords: hgab.length + gaa.length + dpwh.length,
      gaaTotal,
      hgabTotal,
    };
  }, [national, dpwhProjects, selectedBarangay, searchQuery]);

  return (
    <section id="barangay-tracker" className="py-12 max-md:py-8 bg-white">
      <Container>
        <div className="mb-6">
          <Flag variant="navy" className="mb-3">
            <i className="bi bi-geo-alt-fill" aria-hidden="true" />
            <span>{t('tracker-badge')}</span>
          </Flag>
          <SectionHeader label={t('tracker-title')} meta={t('tracker-desc')} className="mb-0" />
        </div>

        {/* Filter Controls */}
        <div className="border border-ed-ink bg-ed-paper-2 p-5 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <div>
              <label
                htmlFor="tracker-barangay-select"
                className="block font-mono-ed text-[11px] font-medium uppercase tracking-[0.12em] text-ed-ink-2 mb-1.5"
              >
                {t('tracker-filter-brgy')}
              </label>
              <select
                id="tracker-barangay-select"
                value={selectedBarangay}
                onChange={(e) => setSelectedBarangay(e.target.value)}
                className="w-full border border-ed-ink bg-white px-3.5 py-2 text-sm font-medium text-ed-ink focus:border-ed-navy focus:outline-none"
              >
                <option value="all">{t('tracker-all-brgy')}</option>
                {barangayCounts.map((b) => (
                  <option key={b.psgcCode} value={b.name}>
                    Brgy. {b.name} ({b.total} {b.total === 1 ? 'record' : 'records'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="tracker-search-input"
                className="block font-mono-ed text-[11px] font-medium uppercase tracking-[0.12em] text-ed-ink-2 mb-1.5"
              >
                {t('tracker-search-label')}
              </label>
              <input
                id="tracker-search-input"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('tracker-search-placeholder')}
                className="w-full border border-ed-ink bg-white px-3.5 py-2 text-sm text-ed-ink focus:border-ed-navy focus:outline-none"
              />
            </div>
          </div>

          {/* Summary KPIs for active selection */}
          <div className="grid grid-cols-1 sm:grid-cols-3 border border-ed-rule divide-y sm:divide-y-0 sm:divide-x divide-ed-rule bg-white">
            <div className="p-4">
              <Eyebrow tone="navy">{t('tracker-kpi-records')}</Eyebrow>
              <div className="font-serif-ed text-2xl font-bold text-ed-navy tabular-nums mt-1">
                {filteredData.totalRecords}
              </div>
            </div>
            <div className="p-4">
              <Eyebrow>{t('tracker-kpi-gaa')}</Eyebrow>
              <div className="font-serif-ed text-2xl font-bold text-ed-ink tabular-nums mt-1">
                {formatPhp(filteredData.gaaTotal)}
              </div>
            </div>
            <div className="p-4">
              <Eyebrow tone="red">{t('tracker-kpi-hgab')}</Eyebrow>
              <div className="font-serif-ed text-2xl font-bold text-ed-red tabular-nums mt-1">
                {formatPhp(filteredData.hgabTotal)}
              </div>
            </div>
          </div>
        </div>

        {/* Combined Project List */}
        {filteredData.totalRecords === 0 ? (
          <div className="border border-ed-rule bg-white p-8 text-center text-sm text-ed-ink-2">
            {t('tracker-empty')}{' '}
            <button
              type="button"
              onClick={() => {
                setSelectedBarangay('all');
                setSearchQuery('');
              }}
              className="font-medium text-ed-navy bg-transparent border-0 p-0 cursor-pointer underline"
            >
              {t('tracker-empty-btn')}
            </button>
            .
          </div>
        ) : (
          <div className="border border-ed-ink divide-y divide-ed-rule bg-white">
            {filteredData.hgab.map((p) => (
              <article
                key={`hgab-${p.id}`}
                className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 hover:bg-ed-paper-2/60 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <Flag variant="red">
                      FY 2027 {p.dataset === 'fmr' ? 'FMR' : 'DPWH'}
                    </Flag>
                    <Flag variant="outline">{p.statusLabel}</Flag>
                  </div>
                  <h3 className="m-0 font-serif-ed text-base font-semibold text-ed-ink leading-snug">
                    {p.title}
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <span className="font-mono-ed text-sm sm:text-base font-semibold text-ed-ink tabular-nums">
                    {formatPhp(p.housePhp ?? p.nepPhp)}
                  </span>
                  {p.housePdfUrl && (
                    <a
                      href={p.housePdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 border border-ed-ink px-2.5 py-1 font-mono-ed text-[11px] font-medium uppercase tracking-[0.08em] text-ed-navy hover:bg-ed-paper-2 no-underline"
                    >
                      <i className="bi bi-file-earmark-pdf" aria-hidden="true" />
                      <span>PDF</span>
                    </a>
                  )}
                </div>
              </article>
            ))}

            {filteredData.gaa.map((g) => {
              const yearEntries =
                g.years && Object.keys(g.years).length > 0
                  ? Object.entries(g.years)
                      .filter(([, amt]) => Number(amt) > 0)
                      .sort(([a], [b]) => Number(a) - Number(b))
                      .map(([yr, amt]) => `FY${yr.slice(-2)}: ${formatPhp(Number(amt))}`)
                  : [
                      g.fy2024Php > 0 ? `FY24: ${formatPhp(g.fy2024Php)}` : null,
                      g.fy2025Php > 0 ? `FY25: ${formatPhp(g.fy2025Php)}` : null,
                      g.fy2026Php > 0 ? `FY26: ${formatPhp(g.fy2026Php)}` : null,
                    ].filter(Boolean);
              const years = yearEntries.join(' · ');
              const latestYr =
                Object.entries(g.years || {})
                  .filter(([, amt]) => Number(amt) > 0)
                  .sort(([a], [b]) => Number(b) - Number(a))[0]?.[0] ||
                (g.fy2026Php > 0 ? '2026' : g.fy2025Php > 0 ? '2025' : '2024');
              const gaaApiUrl = `https://budget.bettergov.ph/api/v1/gaa/search?q=Alcala%2C%20Pangasinan&year=${latestYr}&limit=100`;
              const matchedDpwh = findMatchingDpwh(g, dpwhProjects);
              const dpwhUrl = matchedDpwh?.documentUrl || matchedDpwh?.citation.sourceUrl;
              const isPdf = Boolean(dpwhUrl && dpwhUrl.toLowerCase().endsWith('.pdf'));
              return (
                <article
                  key={`gaa-${g.famKey}`}
                  className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 hover:bg-ed-paper-2/60 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <Flag variant="navy">{t('tracker-gaa-badge')}</Flag>
                      {matchedDpwh && (
                        <Flag variant="outline">
                          {t('tracker-matched-dpwh')} {matchedDpwh.id}
                        </Flag>
                      )}
                    </div>
                    <h3 className="m-0 font-serif-ed text-base font-semibold text-ed-ink leading-snug">
                      {g.name}
                    </h3>
                    <p className="m-0 mt-1 text-xs text-ed-ink-3">{g.department}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <div className="font-mono-ed text-xs sm:text-sm font-semibold text-ed-navy tabular-nums">
                      {years}
                    </div>
                    {dpwhUrl && isPdf && matchedDpwh ? (
                      <a
                        href={dpwhUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 border border-ed-ink px-2.5 py-1 font-mono-ed text-[11px] font-medium uppercase tracking-[0.08em] text-ed-navy hover:bg-ed-paper-2 no-underline"
                      >
                        <i className="bi bi-file-earmark-pdf" aria-hidden="true" />
                        <span>DPWH PDF ({matchedDpwh.id})</span>
                      </a>
                    ) : (
                      <a
                        href={gaaApiUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 border border-ed-rule-strong px-2.5 py-1 font-mono-ed text-[11px] text-ed-ink-2 no-underline hover:border-ed-ink hover:text-ed-navy"
                        title="Direct BetterGov GAA API JSON record used to populate this entry"
                      >
                        <i className="bi bi-filetype-json" aria-hidden="true" />
                        <span>GAA API Record</span>
                      </a>
                    )}
                  </div>
                </article>
              );
            })}

            {filteredData.dpwh.map((d) => (
              <article
                key={`dpwh-${d.id}`}
                className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 hover:bg-ed-paper-2/60 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <Flag variant="outline">
                      DPWH {d.id} · {d.category}
                    </Flag>
                    <span className="font-mono-ed text-[11px] text-ed-ink-3">{d.barangay}</span>
                    {d.evidenceStatus && (
                      <Flag
                        variant={
                          d.evidenceStatus === 'Documentary discrepancy'
                            ? 'red'
                            : d.evidenceStatus === 'Corroborated implementation'
                              ? 'navy'
                              : 'outline'
                        }
                      >
                        {d.evidenceStatus}
                      </Flag>
                    )}
                  </div>
                  <h3 className="m-0 font-serif-ed text-base font-semibold text-ed-ink leading-snug">
                    {d.name}
                  </h3>
                  <p className="m-0 mt-1 text-xs text-ed-ink-3">
                    {d.contractor} · {d.statusLabel}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <span className="font-mono-ed text-xs font-medium text-ed-ink-2">
                    {d.projectDate}
                  </span>
                  {(d.documentUrl || d.citation.sourceUrl) && (
                    <a
                      href={d.documentUrl || d.citation.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 border border-ed-ink px-2.5 py-1 font-mono-ed text-[11px] font-medium uppercase tracking-[0.08em] text-ed-navy hover:bg-ed-paper-2 no-underline"
                    >
                      <i
                        className={`bi ${(d.documentUrl || '').toLowerCase().endsWith('.pdf') ? 'bi-file-earmark-pdf' : 'bi-box-arrow-up-right'}`}
                        aria-hidden="true"
                      />
                      <span>
                        {(d.documentUrl || '').toLowerCase().endsWith('.pdf')
                          ? 'PDF'
                          : 'DPWH Record'}
                      </span>
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </Container>
    </section>
  );
}
