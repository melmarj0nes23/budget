import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { Layout, routeToPath } from './components/Layout';
import { PanelSkeleton } from './components/States';
import { BudgetDataProvider } from './hooks/useBudgetData';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';
import { DashboardPage } from './pages/DashboardPage';
import type { BudgetStage, PageRoute } from './types/budget';

const BudgetExplorerPage = lazy(() =>
  import('./pages/BudgetExplorerPage').then((m) => ({ default: m.BudgetExplorerPage }))
);
const BudgetComparisonPage = lazy(() =>
  import('./pages/BudgetComparisonPage').then((m) => ({ default: m.BudgetComparisonPage }))
);
const LocalityPage = lazy(() =>
  import('./pages/LocalityPage').then((m) => ({ default: m.LocalityPage }))
);
const SocioeconomicPage = lazy(() =>
  import('./pages/SocioeconomicPage').then((m) => ({ default: m.SocioeconomicPage }))
);
const MethodologyPage = lazy(() =>
  import('./pages/MethodologyPage').then((m) => ({ default: m.MethodologyPage }))
);
const AboutPage = lazy(() =>
  import('./pages/AboutPage').then((m) => ({ default: m.AboutPage }))
);

const VALID_ROUTES: PageRoute[] = [
  'dashboard',
  'explorer',
  'compare',
  'locality',
  'socioeconomic',
  'methodology',
  'about',
];

function parsePathRoute(): PageRoute {
  const segment = window.location.pathname
    .replace(/^\/+|\/+$/g, '')
    .split('/')[0]
    ?.toLowerCase();

  if (segment && VALID_ROUTES.includes(segment as PageRoute)) {
    return segment as PageRoute;
  }

  // Gracefully upgrade any legacy bookmarked #route URLs to clean SEO paths without #
  const legacyHash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
  if (legacyHash && VALID_ROUTES.includes(legacyHash as PageRoute)) {
    window.history.replaceState(null, '', routeToPath(legacyHash as PageRoute));
    return legacyHash as PageRoute;
  }

  return 'dashboard';
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string): void {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function RouteSeoSync({ route }: { route: PageRoute }) {
  const { t } = useLanguage();

  useEffect(() => {
    const seoByRoute: Record<PageRoute, { title: string; description: string }> = {
      dashboard: {
        title: t.meta.siteTitle,
        description: t.dashboard.heroSubtitle,
      },
      explorer: {
        title: `${t.explorer.title} – BudgetLens PH`,
        description: t.explorer.subtitle,
      },
      compare: {
        title: `${t.compare.title} – BudgetLens PH`,
        description: t.compare.subtitle,
      },
      locality: {
        title: `${t.locality.title} – BudgetLens PH`,
        description: t.locality.subtitle,
      },
      socioeconomic: {
        title: `${t.socioeconomic.title} – BudgetLens PH`,
        description: t.socioeconomic.subtitle,
      },
      methodology: {
        title: `${t.methodology.title} – BudgetLens PH`,
        description: t.methodology.subtitle,
      },
      about: {
        title: `${t.about.title} – BudgetLens PH`,
        description: t.about.subtitle,
      },
    };

    const meta = seoByRoute[route];
    const canonicalUrl = `${window.location.origin}${routeToPath(route)}`;

    document.title = meta.title;
    upsertMeta('name', 'description', meta.description);
    upsertMeta('property', 'og:title', meta.title);
    upsertMeta('property', 'og:description', meta.description);
    upsertMeta('property', 'og:url', canonicalUrl);
    upsertMeta('name', 'twitter:title', meta.title);
    upsertMeta('name', 'twitter:description', meta.description);

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', canonicalUrl);
  }, [route, t]);

  return null;
}

export default function App() {
  const [route, setRoute] = useState<PageRoute>(() => parsePathRoute());
  const [explorerIntent, setExplorerIntent] = useState<{
    deptId: string;
    year: number;
    stage: BudgetStage;
  } | null>(null);

  useEffect(() => {
    // Ensure root "/" displays clean "/dashboard" URL or keeps valid clean path without "#"
    if (window.location.pathname === '/' && !window.location.hash) {
      window.history.replaceState(null, '', routeToPath('dashboard'));
    }

    const onPopState = () => setRoute(parsePathRoute());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((next: PageRoute) => {
    setRoute(next);
    const nextPath = routeToPath(next);
    if (window.location.pathname !== nextPath || window.location.hash) {
      window.history.pushState(null, '', nextPath);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleInspectDepartment = useCallback(
    (deptId: string, year: number, stage: BudgetStage) => {
      setExplorerIntent({ deptId, year, stage });
      navigate('explorer');
    },
    [navigate]
  );

  const clearExplorerIntent = useCallback(() => {
    setExplorerIntent(null);
  }, []);

  return (
    <LanguageProvider>
      <RouteSeoSync route={route} />
      <BudgetDataProvider>
        <Layout currentRoute={route} onNavigate={navigate}>
          {route === 'dashboard' && (
            <DashboardPage
              onNavigate={navigate}
              onInspectDepartment={handleInspectDepartment}
            />
          )}

          {route !== 'dashboard' && (
            <Suspense
              fallback={
                <div className="space-y-6">
                  <PanelSkeleton heightClass="h-64" />
                  <PanelSkeleton heightClass="h-80" />
                </div>
              }
            >
              {route === 'explorer' && (
                <BudgetExplorerPage
                  initialSelection={explorerIntent}
                  onClearInitialSelection={clearExplorerIntent}
                />
              )}
              {route === 'compare' && <BudgetComparisonPage />}
              {route === 'locality' && <LocalityPage />}
              {route === 'socioeconomic' && <SocioeconomicPage />}
              {route === 'methodology' && <MethodologyPage />}
              {route === 'about' && <AboutPage onNavigate={navigate} />}
            </Suspense>
          )}
        </Layout>
      </BudgetDataProvider>
    </LanguageProvider>
  );
}
