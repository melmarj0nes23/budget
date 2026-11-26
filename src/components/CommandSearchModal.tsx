import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchIcon } from 'lucide-react';
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

const QUICK_JUMPS: { label: string; category: string; route: string }[] = [
  {
    label: 'Overview Summary (FY 2026 Budget Snapshot)',
    category: 'Section',
    route: '/',
  },
  {
    label: 'Barangay Project Tracker (21 Barangays)',
    category: 'Section',
    route: '/tracker',
  },
  {
    label: 'Municipal Budget & Docs (FY 2024–2026)',
    category: 'Section',
    route: '/budgetdocs',
  },
  {
    label: 'DPWH Contracts (12 Infrastructure Projects)',
    category: 'Section',
    route: '/contracts',
  },
  {
    label: 'Project Transparency (GAA & FY 2027 NEP)',
    category: 'Section',
    route: '/transparency',
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
      className="fixed inset-0 z-[2000] flex items-start justify-center bg-black/50 pt-14 sm:pt-20 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Quick Budget Search"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl border border-ed-ink bg-white shadow-[0_12px_32px_rgba(8,40,110,0.14)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-ed-rule px-4 py-3.5">
          <SearchIcon size={16} className="shrink-0 text-ed-navy" aria-hidden />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Try: flood control, Pindangan, FY 2026..."
            className="w-full border-0 bg-transparent font-sans-ed text-sm sm:text-base text-ed-ink placeholder:italic placeholder:text-ed-ink-4 focus:outline-none"
            aria-label="Search BetterAlcala Budget"
          />
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer border border-ed-rule-strong bg-ed-paper-2 px-2 py-0.5 font-mono-ed text-[11px] font-medium text-ed-ink-3 hover:border-ed-ink hover:text-ed-ink"
          >
            ESC
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto divide-y divide-ed-rule">
          {!query.trim() ? (
            <div>
              <div className="border-b border-ed-rule bg-ed-paper-2 px-4 py-2 font-mono-ed text-[10px] font-medium uppercase tracking-[0.14em] text-ed-ink-3">
                Budget Sections
              </div>
              {QUICK_JUMPS.map((item, idx) => (
                <button
                  key={item.route}
                  type="button"
                  onClick={() => go(item.route)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`flex w-full cursor-pointer items-center justify-between gap-3 border-0 border-b border-ed-rule px-4 py-3 text-left text-sm transition-colors last:border-b-0 ${
                    activeIndex === idx ? 'bg-ed-navy-tint text-ed-navy' : 'bg-white text-ed-ink hover:bg-ed-paper-2'
                  }`}
                >
                  <span className="font-serif-ed font-semibold truncate">{item.label}</span>
                  <span className="font-mono-ed text-[10px] uppercase tracking-[0.12em] text-ed-ink-3 shrink-0">
                    {item.category}
                  </span>
                </button>
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="py-10 text-center font-sans-ed text-sm text-ed-ink-3">
              No matching budget records or contracts for &ldquo;{query}&rdquo;.
            </div>
          ) : (
            <div>
              <div className="border-b border-ed-rule bg-ed-paper-2 px-4 py-2 font-mono-ed text-[10px] font-medium uppercase tracking-[0.14em] text-ed-ink-3">
                Results ({results.length})
              </div>
              {results.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => go(item.route)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`flex w-full cursor-pointer items-center justify-between gap-3 border-0 border-b border-ed-rule px-4 py-3 text-left text-sm transition-colors last:border-b-0 ${
                    activeIndex === idx ? 'bg-ed-navy-tint text-ed-navy' : 'bg-white text-ed-ink hover:bg-ed-paper-2'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block font-serif-ed font-semibold text-ed-ink truncate">{item.label}</span>
                    {item.sublabel && (
                      <span className="block font-sans-ed text-xs text-ed-ink-3 truncate">{item.sublabel}</span>
                    )}
                  </span>
                  <span className="border border-ed-rule-strong bg-ed-paper-2 px-2 py-0.5 font-mono-ed text-[10px] uppercase tracking-[0.12em] text-ed-navy shrink-0">
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
