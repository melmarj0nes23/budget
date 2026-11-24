import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import Layout from './components/layout/Layout';

const BudgetPage = lazy(() => import('./pages/BudgetPage'));

function ScrollManager() {
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    const scrollTop = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    if (hash) {
      const id = hash.slice(1);
      const tryScrollToAnchor = (attemptsLeft: number) => {
        const target = document.getElementById(id);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
          return;
        }
        if (attemptsLeft > 0) {
          timer = setTimeout(() => tryScrollToAnchor(attemptsLeft - 1), 60);
        } else {
          scrollTop();
        }
      };
      let timer: ReturnType<typeof setTimeout> | undefined;
      tryScrollToAnchor(6);
      return () => {
        if (timer) clearTimeout(timer);
      };
    }

    scrollTop();
    const raf = requestAnimationFrame(scrollTop);
    const timer = setTimeout(scrollTop, 80);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [pathname, search, hash]);

  return null;
}

function NotFoundPage() {
  return (
    <Layout breadcrumbs={[{ label: 'Page Not Found' }]}>
      <section className="section">
        <div className="container text-center py-12">
          <h1 className="mb-3">404 — Page Not Found</h1>
          <p className="text-slate-600 mb-6">
            The page you requested could not be found on BetterAlcala Budget.
          </p>
          <div className="flex justify-center gap-3">
            <Link to="/" className="btn btn-primary">
              Return to Overview
            </Link>
            <a href="https://betteralcala.org/" className="btn btn-outline">
              Visit Main Portal
            </a>
          </div>
        </div>
      </section>
    </Layout>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <LanguageProvider>
          <BrowserRouter>
            <ScrollManager />
            <Suspense
              fallback={
                <div className="min-h-screen flex items-center justify-center text-sm text-slate-600">
                  Loading BetterAlcala Budget...
                </div>
              }
            >
              <Routes>
                <Route path="/" element={<BudgetPage />} />
                <Route path="/budget" element={<Navigate to="/" replace />} />
                <Route path="/tracker" element={<BudgetPage />} />
                <Route path="/budgetdocs" element={<BudgetPage />} />
                <Route path="/contracts" element={<BudgetPage />} />
                <Route path="/transparency" element={<BudgetPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </LanguageProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
