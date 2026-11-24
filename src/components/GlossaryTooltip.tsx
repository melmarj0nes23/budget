import { useEffect, useId, useRef, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { BUDGET_GLOSSARY } from '../config/constants';
import { useLanguage } from '../i18n/LanguageContext';

interface GlossaryTooltipProps {
  termKey: keyof typeof BUDGET_GLOSSARY;
  label?: string;
  customDefinition?: string;
}

export function GlossaryTooltip({ termKey, label, customDefinition }: GlossaryTooltipProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();
  const entry = t.glossary[String(termKey)] ?? BUDGET_GLOSSARY[termKey];
  const title = entry?.term ?? String(termKey);
  const definition = customDefinition ?? entry?.definition ?? '';

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  return (
    <span ref={containerRef} className="relative inline-flex items-center align-baseline">
      <button
        type="button"
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-left text-inherit hover:text-[#26489A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#26489A] rounded-sm transition-colors cursor-pointer"
        title={`${t.common.explainTerm} ${title}`}
      >
        {label ? <span className="border-b border-dotted border-slate-400">{label}</span> : null}
        <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-[#26489A] shrink-0" aria-hidden="true" />
        <span className="sr-only">
          {t.common.definitionOf} {title}
        </span>
      </button>

      {open && (
        <span
          id={tooltipId}
          role="tooltip"
          className="absolute left-0 top-full mt-2 z-40 w-72 sm:w-80 bg-white border border-slate-200 rounded-lg shadow-lg p-3.5 text-left normal-case font-normal"
        >
          <span className="block text-xs font-semibold text-slate-900 mb-1">{title}</span>
          <span className="block text-xs leading-relaxed text-slate-600">{definition}</span>
        </span>
      )}
    </span>
  );
}
