import { useState } from 'react';
import { ExternalLink, Trash2 } from 'lucide-react';
import { API_CONFIG } from '../config/constants';
import { useLanguage } from '../i18n/LanguageContext';
import { cacheService } from '../services/cacheService';
import type { PageRoute } from '../types/budget';

interface AboutPageProps {
  onNavigate: (route: PageRoute) => void;
}

export function AboutPage({ onNavigate }: AboutPageProps) {
  const { t } = useLanguage();
  const [cacheCleared, setCacheCleared] = useState(false);

  const handleClearCache = () => {
    cacheService.clearAll();
    setCacheCleared(true);
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <header className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          {t.about.title}
        </h1>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">{t.about.subtitle}</p>
      </header>

      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-3 text-sm text-slate-700 leading-relaxed">
        <h2 className="text-lg font-semibold text-slate-900">{t.about.purposeTitle}</h2>
        <p>{t.about.purposeP1}</p>
        <p>{t.about.purposeP2}</p>
      </section>

      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">{t.about.infraTitle}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="border border-slate-200 rounded-md p-4">
            <h3 className="font-semibold text-slate-900 text-sm">{t.footer.budgetApiLink}</h3>
            <p className="text-slate-600 mt-1 leading-relaxed">{t.about.budgetCardDesc}</p>
            <a
              href={API_CONFIG.budgetDocsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-[#26489A] hover:underline font-medium"
            >
              budget.bettergov.ph
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </a>
          </div>

          <div className="border border-slate-200 rounded-md p-4">
            <h3 className="font-semibold text-slate-900 text-sm">{t.footer.statsApiLink}</h3>
            <p className="text-slate-600 mt-1 leading-relaxed">{t.about.statsCardDesc}</p>
            <a
              href={API_CONFIG.statsDocsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-[#26489A] hover:underline font-medium"
            >
              statistics.bettergov.ph
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </a>
          </div>

          <div className="border border-slate-200 rounded-md p-4">
            <h3 className="font-semibold text-slate-900 text-sm">{t.footer.openDataLink}</h3>
            <p className="text-slate-600 mt-1 leading-relaxed">{t.about.openDataCardDesc}</p>
            <a
              href={API_CONFIG.openDataPortalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-[#26489A] hover:underline font-medium"
            >
              data.bettergov.ph
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">{t.about.archTitle}</h2>
        <ul className="space-y-2 text-sm text-slate-700 list-disc pl-5 leading-relaxed">
          <li>{t.about.archBullet1}</li>
          <li>{t.about.archBullet2}</li>
          <li>{t.about.archBullet3}</li>
        </ul>

        <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-600">
            {cacheCleared ? t.about.cacheCleared : t.about.cachePrompt}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('methodology')}
              className="text-xs font-medium text-[#26489A] hover:underline cursor-pointer"
            >
              {t.footer.readMethodology}
            </button>
            <button
              type="button"
              onClick={handleClearCache}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              {t.about.clearCacheBtn}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
