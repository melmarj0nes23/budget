import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import PWAManager from '../PWAManager';

const SITE_ORIGIN = 'https://budget.betteralcala.org';
const DEFAULT_TITLE = 'BetterAlcala Budget | Financial Transparency & Budget Portal';
const DEFAULT_DESCRIPTION =
  'BetterAlcala Budget — Approved municipal appropriations, barangay project tracker, DPWH contracts, and national GAA/NEP transparency portal for Alcala, Pangasinan.';

interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface LayoutProps {
  children: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  pageTitle?: string;
  pageDescription?: string;
}

export default function Layout({
  children,
  breadcrumbs,
  pageTitle,
  pageDescription,
}: LayoutProps) {
  const { pathname } = useLocation();

  useEffect(() => {
    const resolvedTitle = pageTitle
      ? `${pageTitle} | BetterAlcala Budget`
      : breadcrumbs && breadcrumbs.length > 0
        ? `${breadcrumbs[breadcrumbs.length - 1].label} | BetterAlcala Budget`
        : DEFAULT_TITLE;
    document.title = resolvedTitle;

    const cleanPath = pathname === '/' ? '/' : pathname.replace(/\/+$/, '');
    const canonicalUrl = `${SITE_ORIGIN}${cleanPath}`;

    const canonicalEl = document.querySelector('link[rel="canonical"]');
    if (canonicalEl) {
      canonicalEl.setAttribute('href', canonicalUrl);
    }

    const ogUrlEl = document.querySelector('meta[property="og:url"]');
    if (ogUrlEl) {
      ogUrlEl.setAttribute('content', canonicalUrl);
    }

    const ogTitleEl = document.querySelector('meta[property="og:title"]');
    if (ogTitleEl) {
      ogTitleEl.setAttribute('content', resolvedTitle);
    }

    const descEl = document.querySelector('meta[name="description"]');
    if (descEl) {
      descEl.setAttribute('content', pageDescription || DEFAULT_DESCRIPTION);
    }
  }, [pathname, breadcrumbs, pageTitle, pageDescription]);

  return (
    <div className="min-h-svh flex flex-col bg-white font-sans-ed text-ed-ink antialiased">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:bg-ed-navy focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to main content
      </a>
      <Header />
      <main id="main-content" className="grow">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <div className="border-b border-ed-rule bg-ed-paper-2 py-3">
            <div className="mx-auto w-full max-w-page px-4 md:px-6 xl:px-8">
              <nav
                className="flex flex-wrap items-center gap-1.5 font-mono-ed text-[11px] uppercase tracking-[0.12em] text-ed-ink-3 max-md:text-[10px]"
                aria-label="Breadcrumb"
              >
                <Link to="/" className="text-ed-ink-3 no-underline hover:text-ed-navy">
                  Overview Summary
                </Link>
                {breadcrumbs.map((crumb, idx) => (
                  <React.Fragment key={crumb.label + idx}>
                    <span aria-hidden="true">/</span>
                    {crumb.to ? (
                      <Link to={crumb.to} className="text-ed-ink-3 no-underline hover:text-ed-navy">
                        {crumb.label}
                      </Link>
                    ) : (
                      <span aria-current="page" className="text-ed-ink">
                        {crumb.label}
                      </span>
                    )}
                  </React.Fragment>
                ))}
              </nav>
            </div>
          </div>
        )}
        {children}
      </main>
      <Footer />
      <PWAManager />
    </div>
  );
}
