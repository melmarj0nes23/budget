import { AlertTriangle, RefreshCw, SearchX } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

export function KpiSkeletonGrid({ count = 4 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      aria-busy="true"
      aria-label="Loading summary metrics"
    >
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="bg-white border border-slate-200 rounded-lg p-5 animate-pulse"
        >
          <div className="h-3.5 w-28 bg-slate-200 rounded mb-3" />
          <div className="h-7 w-36 bg-slate-200 rounded mb-2" />
          <div className="h-3 w-44 bg-slate-100 rounded" />
        </div>
      ))}
    </div>
  );
}

export function PanelSkeleton({ heightClass = 'h-72' }: { heightClass?: string }) {
  return (
    <div
      className="bg-white border border-slate-200 rounded-lg p-6 animate-pulse"
      aria-busy="true"
      aria-label="Loading chart panel"
    >
      <div className="h-5 w-52 bg-slate-200 rounded mb-2" />
      <div className="h-3.5 w-80 max-w-full bg-slate-100 rounded mb-6" />
      <div className={`${heightClass} w-full bg-slate-100 rounded`} />
    </div>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div
      className="bg-white border border-slate-200 rounded-lg overflow-hidden animate-pulse"
      aria-busy="true"
      aria-label="Loading table rows"
    >
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex justify-between">
        <div className="h-3.5 w-40 bg-slate-200 rounded" />
        <div className="h-3.5 w-24 bg-slate-200 rounded" />
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-4 py-3 flex items-center justify-between gap-4">
            <div className="h-4 w-2/5 bg-slate-200 rounded" />
            <div className="h-4 w-28 bg-slate-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ErrorBanner({
  title,
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  const { t } = useLanguage();
  return (
    <div role="alert" className="bg-white border border-red-200 rounded-lg p-6 text-slate-900">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-slate-900">
            {title ?? t.common.errorTitle}
          </h3>
          <p className="text-sm text-slate-600 mt-1 leading-relaxed">{message}</p>
          <p className="text-xs text-slate-500 mt-2">{t.common.noFabricationNotice}</p>
          {onRetry && (
            <div className="mt-4">
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#26489A] hover:bg-[#1E40AF] rounded-md transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
                {t.common.retryRequest}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-10 text-center">
      <SearchX className="w-7 h-7 text-slate-400 mx-auto mb-3" aria-hidden="true" />
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 px-4 py-2 text-sm font-medium text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function NoticeStrip({
  tone = 'caution',
  message,
  actionLabel,
  onAction,
}: {
  tone?: 'caution' | 'info';
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const styles =
    tone === 'caution'
      ? 'bg-amber-50/70 border-amber-200 text-amber-950'
      : 'bg-slate-50 border-slate-200 text-slate-700';
  return (
    <div
      className={`border rounded-lg px-4 py-3 text-xs leading-relaxed flex flex-wrap items-center justify-between gap-3 ${styles}`}
    >
      <p className="min-w-0 flex-1">{message}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="font-medium underline underline-offset-2 hover:opacity-80 whitespace-nowrap shrink-0 cursor-pointer"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
