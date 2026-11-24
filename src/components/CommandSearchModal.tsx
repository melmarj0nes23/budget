import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BARANGAYS_DATA } from '../data/municipalInfo';
import { BUDGET_RECORDS, INFRASTRUCTURE_PROJECTS } from '../data/transparencyData';

interface SearchEntry {
  id: string;
  label: string;
  sublabel?: string;
  type: 'Section' | 'Budget Year' | 'Contract' | 'Barangay';
  route: string;
  keywords: string;
}

const QUICK_JUMPS: { label: string; category: string; route: string; icon: string }[] = [
  {
    label: 'Overview Summary (FY 2026 Budget Snapshot)',
    category: 'Section',
    route: '/',
    icon: 'bi-grid-1x2-fill',
  },
  {
    label: 'Barangay Project Tracker (21 Barangays)',
    category: 'Section',
    route: '/tracker',
    icon: 'bi-geo-alt-fill',
  },
  {
    label: 'Municipal Budget & Docs (FY 2024–2026)',
    category: 'Section',
    route: '/budgetdocs',
    icon: 'bi-graph-up-arrow',
  },
  {
    label: 'DPWH Contracts (12 Infrastructure Projects)',
    category: 'Section',
    route: '/contracts',
    icon: 'bi-cone-striped',
  },
  {
    label: 'Transparency Portal (GAA & FY 2027 NEP)',
    category: 'Section',
    route: '/transparency',
    icon: 'bi-compass-fill',
  },
];

interface CommandSearchModalProps {
  open: boolean;
  onClose: () => void;
}

export default function CommandSearchModal({ open, onClose }: CommandSearchModalProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const index = useMemo<SearchEntry[]>(() => {
    const entries: SearchEntry[] = QUICK_JUMPS.map((q) => ({
      id: `sec-${q.route}`,
      label: q.label,
      sublabel: q.route,
      type: 'Section',
      route: q.route,
      keywords: `${q.label} ${q.category}`.toLowerCase(),
    }));

    BUDGET_RECORDS.forEach((b) => {
      entries.push({
        id: `budget-${b.fiscalYear}`,
        label: `FY ${b.fiscalYear} Municipal Budget`,
        sublabel: `${b.appropriationOrdinance} · ₱${b.approvedBudget.toLocaleString('en-PH')}`,
        type: 'Budget Year',
        route: '/budgetdocs',
        keywords: `fy ${b.fiscalYear} budget ${b.appropriationOrdinance} ${b.spResolution} ${b.ntaShareNote}`.toLowerCase(),
      });
    });

    INFRASTRUCTURE_PROJECTS.forEach((p) => {
      entries.push({
        id: `proj-${p.id}`,
        label: p.name,
        sublabel: `${p.barangay} · ${p.category} · ${p.statusLabel}`,
        type: 'Contract',
        route: `/contracts?project=${encodeURIComponent(p.id)}`,
        keywords: `${p.name} ${p.barangay} ${p.category} ${p.contractor} ${p.id} ${p.statusLabel}`.toLowerCase(),
      });
    });

    BARANGAYS_DATA.forEach((b) => {
      entries.push({
        id: `brgy-${b.name}`,
        label: `Barangay ${b.name}`,
        sublabel: `Pop. ${b.population2020.toLocaleString()} · ${b.classification}`,
        type: 'Barangay',
        route: '/tracker',
        keywords: `barangay ${b.name} ${b.classification}`.toLowerCase(),
      });
    });

    return entries;
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const tokens = q.split(/\s+/).filter(Boolean);
    return index
      .filter((item) => tokens.every((tok) => item.keywords.includes(tok)))
      .slice(0, 10);
  }, [index, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!open) return null;

  const list = query.trim() ? results : QUICK_JUMPS;

  function go(route: string) {
    onClose();
    navigate(route);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (list.length === 0 ? 0 : (prev + 1) % list.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) =>
        list.length === 0 ? 0 : (prev - 1 + list.length) % list.length
      );
    } else if (e.key === 'Enter' && list[activeIndex]) {
      e.preventDefault();
      go(list[activeIndex].route);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-start justify-center bg-[#081529]/60 backdrop-blur-xs pt-14 sm:pt-20 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Quick Budget Search"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-black/10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-black/10">
          <i className="bi bi-search text-lg text-[#26489A]" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search DPWH contracts, barangays, FY budgets, or sections..."
            className="w-full bg-transparent text-sm sm:text-base text-[#0f2342] placeholder:text-slate-400 focus:outline-none"
            aria-label="Search BetterAlcala Budget"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-black/10 px-2 py-0.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            ESC
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {!query.trim() ? (
            <div>
              <p className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Budget Sections
              </p>
              {QUICK_JUMPS.map((item, idx) => (
                <button
                  key={item.route}
                  type="button"
                  onClick={() => go(item.route)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors cursor-pointer ${
                    activeIndex === idx ? 'bg-[#26489A]/10 text-[#0f2342]' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <i className={`bi ${item.icon} text-[#26489A]`} aria-hidden="true" />
                    <span className="font-medium truncate">{item.label}</span>
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400 shrink-0">{item.category}</span>
                </button>
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              No matching budget records or contracts for &ldquo;{query}&rdquo;.
            </div>
          ) : (
            <div>
              <p className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Results ({results.length})
              </p>
              {results.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => go(item.route)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors cursor-pointer ${
                    activeIndex === idx ? 'bg-[#26489A]/10 text-[#0f2342]' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block font-semibold text-[#0f2342] truncate">{item.label}</span>
                    {item.sublabel && (
                      <span className="block text-xs text-slate-500 truncate">{item.sublabel}</span>
                    )}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-[#26489A] shrink-0">
                    {item.type}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
