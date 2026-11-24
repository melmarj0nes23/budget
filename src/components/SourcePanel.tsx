import { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import type { SourceAttribution } from '../types/budget';
import { formatDateOnly, formatDateTime } from '../utils/formatting';

interface SourcePanelProps {
  source: SourceAttribution;
  defaultOpen?: boolean;
}

export function SourcePanel({ source, defaultOpen = false }: SourcePanelProps) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(defaultOpen);

  return (
    <div className="mt-4 pt-3 border-t border-slate-200 text-xs text-slate-600">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium text-slate-700">
            {t.common.sourceLabel}: {source.sourceName}
          </span>
          <span aria-hidden="true" className="text-slate-300">
            ·
          </span>
          <span>{source.period}</span>
          <span aria-hidden="true" className="text-slate-300">
            ·
          </span>
          <span>
            {t.common.unitsLabel}: {source.units}
          </span>
          {source.fetchedAt && (
            <>
              <span aria-hidden="true" className="text-slate-300">
                ·
              </span>
              <span className="tabular-nums">
                {t.common.retrieved} {formatDateTime(source.fetchedAt)}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <a
            href={source.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[#26489A] hover:text-[#1E40AF] font-medium whitespace-nowrap"
          >
            {t.common.verifySource}
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
          </a>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-medium whitespace-nowrap cursor-pointer"
          >
            {expanded ? t.common.hideDetails : t.common.dataDetails}
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {expanded && (
        <dl className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2.5 text-xs">
          <div>
            <dt className="text-slate-500">{t.common.datasetEndpoint}</dt>
            <dd className="text-slate-900 font-medium mt-0.5">{source.datasetName}</dd>
          </div>
          <div>
            <dt className="text-slate-500">{t.common.observationPeriod}</dt>
            <dd className="text-slate-900 mt-0.5">{source.period}</dd>
          </div>
          <div>
            <dt className="text-slate-500">{t.common.unitsCurrency}</dt>
            <dd className="text-slate-900 mt-0.5">{source.units}</dd>
          </div>
          <div>
            <dt className="text-slate-500">{t.common.retrievedByBrowser}</dt>
            <dd className="text-slate-900 font-mono tabular-nums mt-0.5">
              {source.fetchedAt ? formatDateTime(source.fetchedAt) : t.common.liveSession}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">{t.common.sourcePublicationDate}</dt>
            <dd className="text-slate-900 font-mono tabular-nums mt-0.5">
              {source.sourceUpdated
                ? formatDateOnly(source.sourceUpdated)
                : t.common.notSpecifiedBySource}
            </dd>
          </div>
          {source.secondaryUrl && (
            <div>
              <dt className="text-slate-500">{t.common.primaryReference}</dt>
              <dd className="mt-0.5">
                <a
                  href={source.secondaryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[#26489A] hover:underline"
                >
                  {source.secondaryLabel ?? t.common.verifySource}
                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                </a>
              </dd>
            </div>
          )}
          {source.method && (
            <div className="sm:col-span-2 lg:col-span-3">
              <dt className="text-slate-500">{t.common.calculationScopeNotes}</dt>
              <dd className="text-slate-700 leading-relaxed mt-0.5">{source.method}</dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}
