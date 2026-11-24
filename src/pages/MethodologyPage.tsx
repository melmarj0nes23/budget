import { ExternalLink } from 'lucide-react';
import { API_CONFIG, FUNCTIONAL_SECTORS } from '../config/constants';
import { useLanguage } from '../i18n/LanguageContext';

export function MethodologyPage() {
  const { t, translateSector } = useLanguage();

  return (
    <div className="space-y-8 max-w-4xl">
      <header className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          {t.methodology.title}
        </h1>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
          {t.methodology.subtitle}
        </p>
      </header>

      {/* 1. Data Sources & Retrieval */}
      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">{t.methodology.sec1Title}</h2>
        <p className="text-sm text-slate-700 leading-relaxed">{t.methodology.sec1Intro}</p>

        <div className="overflow-x-auto border border-slate-200 rounded-md">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th className="py-2.5 px-3 font-medium">{t.methodology.colSourceInfra}</th>
                <th className="py-2.5 px-3 font-medium">{t.methodology.colEndpoints}</th>
                <th className="py-2.5 px-3 font-medium">{t.methodology.colCoverage}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              <tr>
                <td className="py-2.5 px-3 font-medium text-slate-900 align-top">
                  {t.footer.budgetApiLink}
                  <a
                    href={API_CONFIG.budgetDocsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-[#26489A] hover:underline font-normal mt-0.5"
                  >
                    budget.bettergov.ph/docs
                  </a>
                </td>
                <td className="py-2.5 px-3 font-mono text-[11px] align-top">
                  /api/v1/gaa, /gaa/departments, /gaa/departments/&#123;id&#125;/(agencies,
                  expense-classes, programs, objects), /gaa/search, /nep/2027,
                  /nep/2027/rollups/(expense_class, region)
                </td>
                <td className="py-2.5 px-3 align-top">{t.methodology.budgetCoverageText}</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-medium text-slate-900 align-top">
                  {t.footer.statsApiLink}
                  <a
                    href={API_CONFIG.statsDocsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-[#26489A] hover:underline font-normal mt-0.5"
                  >
                    statistics.bettergov.ph/api
                  </a>
                </td>
                <td className="py-2.5 px-3 font-mono text-[11px] align-top">
                  /api/v1/coverage, /datasets/&#123;id&#125;/query,
                  /api/classification/psgc/Q2_2024/regions
                </td>
                <td className="py-2.5 px-3 align-top">{t.methodology.statsCoverageText}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">{t.methodology.cachingNote}</p>
      </section>

      {/* 2. Understanding Budget Stages & Allocation vs Expenditure */}
      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">{t.methodology.sec2Title}</h2>
        <p className="text-sm text-slate-700 leading-relaxed">{t.methodology.sec2Intro}</p>

        <ol className="space-y-3 text-sm text-slate-700 list-decimal pl-5">
          <li>
            <strong className="text-slate-900">{t.methodology.stage1Title}</strong>{' '}
            {t.methodology.stage1Body}
          </li>
          <li>
            <strong className="text-slate-900">{t.methodology.stage2Title}</strong>{' '}
            {t.methodology.stage2Body}
          </li>
          <li>
            <strong className="text-slate-900">{t.methodology.stage3Title}</strong>{' '}
            {t.methodology.stage3Body}
          </li>
          <li>
            <strong className="text-slate-900">{t.methodology.stage4Title}</strong>{' '}
            {t.methodology.stage4Body}
          </li>
        </ol>
      </section>

      {/* 3. Calculations & Formulas */}
      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">{t.methodology.sec3Title}</h2>

        <div className="space-y-4 text-sm text-slate-700">
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">{t.methodology.yoyHeading}</h3>
            <p className="mt-1 leading-relaxed">{t.methodology.yoyBody}</p>
          </div>

          <div>
            <h3 className="font-semibold text-slate-900 text-sm">
              {t.methodology.perCapitaHeading}
            </h3>
            <p className="mt-1 leading-relaxed">{t.methodology.perCapitaBody}</p>
          </div>

          <div>
            <h3 className="font-semibold text-slate-900 text-sm">{t.methodology.limitsHeading}</h3>
            <ul className="mt-1.5 space-y-1.5 list-disc pl-5 text-xs sm:text-sm text-slate-700 leading-relaxed">
              <li>{t.methodology.limitCentralOffice}</li>
              <li>{t.methodology.limitNcr}</li>
              <li>{t.methodology.limitGaaNep}</li>
              <li>{t.methodology.limitNir}</li>
              <li>{t.methodology.limitNoCausation}</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 4. Functional Sector Mapping */}
      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">{t.methodology.sec4Title}</h2>
        <p className="text-sm text-slate-700 leading-relaxed">{t.methodology.sec4Intro}</p>
        <div className="divide-y divide-slate-100 border border-slate-200 rounded-md">
          {FUNCTIONAL_SECTORS.map((sec) => {
            const translated = translateSector(sec.id, sec);
            return (
              <div key={sec.id} className="p-3.5 text-xs">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <span
                    className="w-2.5 h-2.5 rounded-xs shrink-0"
                    style={{ backgroundColor: sec.color }}
                    aria-hidden="true"
                  />
                  {translated.label}
                </div>
                <p className="text-slate-600 mt-1 leading-relaxed">{translated.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. Glossary */}
      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">{t.methodology.sec5Title}</h2>
        <dl className="divide-y divide-slate-100">
          {Object.entries(t.glossary).map(([key, item]) => (
            <div key={key} className="py-3 first:pt-0 last:pb-0">
              <dt className="text-sm font-semibold text-slate-900">{item.term}</dt>
              <dd className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                {item.definition}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 6. Philippine Languages & Source Fidelity */}
      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">{t.methodology.sec6Title}</h2>
        <p className="text-sm text-slate-700 leading-relaxed">{t.methodology.sec6Body}</p>
      </section>

      <div className="text-xs text-slate-500 flex flex-wrap gap-4">
        <a
          href={API_CONFIG.budgetOpenApiUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[#26489A] hover:underline"
        >
          {t.methodology.inspectOpenApi}
          <ExternalLink className="w-3 h-3" aria-hidden="true" />
        </a>
        <a
          href={API_CONFIG.statsDocsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[#26489A] hover:underline"
        >
          {t.methodology.inspectStatsDocs}
          <ExternalLink className="w-3 h-3" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}
