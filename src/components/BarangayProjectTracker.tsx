import { useEffect, useMemo, useState } from 'react';
import { BARANGAYS_DATA } from '../data/municipalInfo';
import { InfrastructureProject } from '../types/civic';

interface GaaProject {
  famKey: string;
  name: string;
  department: string;
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

function matchesBarangay(text: string, barangayName: string): boolean {
  const hay = text.toLowerCase();
  const needle = barangayName.toLowerCase();
  if (hay.includes(needle)) return true;
  // Handle common Pindangan / San Pedro variants in official records
  if (needle === 'pindangan centro' && hay.includes('pindangan')) return true;
  if (needle === 'san pedro ili' && hay.includes('san pedo ili')) return true;
  return false;
}

export default function BarangayProjectTracker({
  dpwhProjects,
}: {
  dpwhProjects: InfrastructureProject[];
}) {
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

    const gaaTotal = gaa.reduce(
      (sum, g) => sum + (g.fy2024Php || 0) + (g.fy2025Php || 0) + (g.fy2026Php || 0),
      0
    );
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
    <section id="barangay-tracker" className="section bg-alt">
      <div className="container">
        <div className="mb-6">
          <span className="inline-flex items-center gap-1.5 font-mono-data text-xs font-bold uppercase tracking-wider text-[#26489A] bg-[#26489A]/10 border border-[#26489A]/25 px-3 py-1 rounded-full">
            <i className="bi bi-geo-alt-fill" aria-hidden="true" />
            <span>Community-Wide Barangay Project Tracker</span>
          </span>
          <h2 className="mt-3 mb-1 text-2xl font-bold text-[#0f2342]">
            Track Projects Across All 21 Alcala Barangays (2024–2027)
          </h2>
          <p className="text-sm text-slate-600 m-0">
            Combined view of FY 2027 NEP/House Bill proposals, enacted FY 2024–2026 GAA records, and
            DPWH district projects—filterable by any barangay for the entire Alcala community.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="bg-white border border-black/10 rounded-2xl p-4 sm:p-5 mb-6 shadow-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div>
              <label
                htmlFor="tracker-barangay-select"
                className="block text-xs font-bold text-[#0f2342] mb-1.5"
              >
                Filter by Barangay
              </label>
              <select
                id="tracker-barangay-select"
                value={selectedBarangay}
                onChange={(e) => setSelectedBarangay(e.target.value)}
                className="w-full rounded-xl border border-black/15 bg-[#FAF7F2] px-3.5 py-2 text-sm font-semibold text-[#0f2342] focus:border-[#26489A] focus:outline-none"
              >
                <option value="all">All 21 Barangays in Alcala</option>
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
                className="block text-xs font-bold text-[#0f2342] mb-1.5"
              >
                Search Project Keyword
              </label>
              <input
                id="tracker-search-input"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g., Flood, FMR, Multi-Purpose, Road..."
                className="w-full rounded-xl border border-black/15 bg-white px-3.5 py-2 text-sm focus:border-[#26489A] focus:outline-none"
              />
            </div>
          </div>

          {/* Summary KPIs for active selection */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-black/5">
            <div className="rounded-xl bg-[#FAF7F2] p-3.5">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Matching Records
              </div>
              <div className="text-xl font-extrabold text-[#26489A] tabular-nums mt-0.5">
                {filteredData.totalRecords}
              </div>
            </div>
            <div className="rounded-xl bg-[#FAF7F2] p-3.5">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Enacted GAA (2024–2026)
              </div>
              <div className="text-xl font-extrabold text-[#2E8B57] tabular-nums mt-0.5">
                {formatPhp(filteredData.gaaTotal)}
              </div>
            </div>
            <div className="rounded-xl bg-[#FAF7F2] p-3.5">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                FY 2027 House Bill / NEP
              </div>
              <div className="text-xl font-extrabold text-[#D1432A] tabular-nums mt-0.5">
                {formatPhp(filteredData.hgabTotal)}
              </div>
            </div>
          </div>
        </div>

        {/* Combined Project List */}
        {filteredData.totalRecords === 0 ? (
          <div className="bg-white border border-black/10 rounded-2xl p-8 text-center text-sm text-slate-600">
            No project records matched your current filter. Try selecting{' '}
            <button
              type="button"
              onClick={() => {
                setSelectedBarangay('all');
                setSearchQuery('');
              }}
              className="font-semibold text-[#26489A] bg-transparent border-0 p-0 cursor-pointer underline"
            >
              All 21 Barangays
            </button>
            .
          </div>
        ) : (
          <div className="space-y-3">
            {filteredData.hgab.map((p) => (
              <article
                key={`hgab-${p.id}`}
                className="bg-white border border-black/10 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-mono-data text-[11px] font-bold uppercase px-2 py-0.5 rounded bg-[#D1432A]/10 text-[#D1432A]">
                      FY 2027 {p.dataset === 'fmr' ? 'FMR' : 'DPWH'}
                    </span>
                    <span className="font-mono-data text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {p.statusLabel}
                    </span>
                  </div>
                  <h3 className="m-0 text-sm sm:text-base font-bold text-[#0f2342]">{p.title}</h3>
                </div>
                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <span className="text-sm sm:text-base font-extrabold text-[#2E8B57] tabular-nums">
                    {formatPhp(p.housePhp ?? p.nepPhp)}
                  </span>
                  {p.housePdfUrl && (
                    <a
                      href={p.housePdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-black/15 px-2.5 py-1 text-xs font-semibold text-[#26489A] no-underline"
                    >
                      <i className="bi bi-file-earmark-pdf" aria-hidden="true" />
                      <span>PDF</span>
                    </a>
                  )}
                </div>
              </article>
            ))}

            {filteredData.gaa.map((g) => {
              const years = [
                g.fy2024Php > 0 ? `FY24: ${formatPhp(g.fy2024Php)}` : null,
                g.fy2025Php > 0 ? `FY25: ${formatPhp(g.fy2025Php)}` : null,
                g.fy2026Php > 0 ? `FY26: ${formatPhp(g.fy2026Php)}` : null,
              ]
                .filter(Boolean)
                .join(' · ');
              return (
                <article
                  key={`gaa-${g.famKey}`}
                  className="bg-white border border-black/10 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <span className="inline-block font-mono-data text-[11px] font-bold uppercase px-2 py-0.5 rounded bg-[#2E8B57]/12 text-[#2E8B57] mb-1">
                      Enacted GAA (2024–2026)
                    </span>
                    <h3 className="m-0 text-sm sm:text-base font-bold text-[#0f2342]">{g.name}</h3>
                    <p className="m-0 mt-0.5 text-xs text-slate-500">{g.department}</p>
                  </div>
                  <div className="font-mono-data text-xs sm:text-sm font-bold text-[#26489A] tabular-nums shrink-0">
                    {years}
                  </div>
                </article>
              );
            })}

            {filteredData.dpwh.map((d) => (
              <article
                key={`dpwh-${d.id}`}
                className="bg-white border border-black/10 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-mono-data text-[11px] font-bold uppercase px-2 py-0.5 rounded bg-[#1976A8]/12 text-[#1976A8]">
                      DPWH Registry · {d.category}
                    </span>
                    <span className="text-xs text-slate-500">{d.barangay}</span>
                  </div>
                  <h3 className="m-0 text-sm sm:text-base font-bold text-[#0f2342]">{d.name}</h3>
                  <p className="m-0 mt-0.5 text-xs text-slate-500">
                    {d.contractor} · {d.statusLabel}
                  </p>
                </div>
                <span className="font-mono-data text-xs font-semibold text-slate-600 shrink-0">
                  {d.projectDate}
                </span>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
