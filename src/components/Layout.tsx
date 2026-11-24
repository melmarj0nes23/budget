import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import type { LanguageCode } from '../i18n/types';
import type { PageRoute } from '../types/budget';

const MAIN_SITE_URL = 'https://betteralcala.org';

interface LayoutProps {
  currentRoute: PageRoute;
  onNavigate: (route: PageRoute) => void;
  children: React.ReactNode;
}

export function routeToPath(route: PageRoute): string {
  return `/${route}`;
}

function isMobileNav(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 1024px)').matches;
}

export function Layout({ currentRoute, onNavigate, children }: LayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { language, loadingLanguage, setLanguage, t } = useLanguage();
  const headerRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const primaryNav: Array<{ route: PageRoute; label: string }> = [
    { route: 'dashboard', label: t.nav.dashboard },
    { route: 'explorer', label: t.nav.explorer },
    { route: 'compare', label: t.nav.compare },
    { route: 'locality', label: t.nav.locality },
    { route: 'socioeconomic', label: t.nav.socioeconomic },
  ];

  const [aboutDropdownOpen, setAboutDropdownOpen] = useState(false);

  const closeMenu = useCallback(() => {
    setMobileMenuOpen(false);
    setAboutDropdownOpen(false);
  }, []);

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, route: PageRoute) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }
    e.preventDefault();
    onNavigate(route);
    closeMenu();
  };

  useEffect(() => {
    if (!mobileMenuOpen) return;

    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Node | null;
      if (headerRef.current && target && !headerRef.current.contains(target)) {
        closeMenu();
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        closeMenu();
        toggleRef.current?.focus();
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [mobileMenuOpen, closeMenu]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function handleResize() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!isMobileNav() && mobileMenuOpen) {
          closeMenu();
        }
      }, 150);
    }
    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [mobileMenuOpen, closeMenu]);

  const langOptions: Array<{ code: LanguageCode; label: string; aria: string }> = [
    { code: 'en', label: 'EN', aria: 'Switch to English' },
    { code: 'tl', label: 'FIL', aria: 'Switch to Filipino' },
    { code: 'ilo', label: 'ILO', aria: 'Switch to Ilocano' },
  ];

  const currentYear = new Date().getFullYear();

  return (
    <>
      <a href="#main-content" className="skip-link">
        {t.nav.skipToContent}
      </a>

      <header ref={headerRef} className="site-header">
        <div className="container header-inner">
          <div className="logo-container">
            <a
              href={`${MAIN_SITE_URL}/`}
              aria-label="BetterAlcala Home"
              className="brand-lockup"
              onClick={closeMenu}
            >
              <img
                src="/assets/images/logo/alcala-seal-v2.png"
                alt="Official Seal of the Municipality of Alcala — BetterAlcala Logo"
                className="logo-img"
                width={48}
                height={48}
              />
              <span className="brand-text-group">
                <span className="brand-wordmark">
                  <span className="brand-better">Better</span>
                  <span className="brand-alcala">Alcala</span>
                </span>
                <span className="brand-subtitle">Alcala, Pangasinan</span>
              </span>
            </a>
          </div>

          <nav
            id="main-navigation"
            className={`main-nav ${mobileMenuOpen ? 'active' : ''}`}
            aria-label="Main Navigation"
          >
            <ul>
              {primaryNav.map((item) => {
                const active = currentRoute === item.route;
                return (
                  <li key={item.route}>
                    <a
                      href={routeToPath(item.route)}
                      onClick={(e) => handleLinkClick(e, item.route)}
                      className={active ? 'active' : ''}
                      aria-current={active ? 'page' : undefined}
                    >
                      {item.label}
                    </a>
                  </li>
                );
              })}
              <li className={`has-dropdown ${aboutDropdownOpen ? 'dropdown-open' : ''}`}>
                <a
                  href={routeToPath('methodology')}
                  className={
                    currentRoute === 'methodology' || currentRoute === 'about' ? 'active' : ''
                  }
                  aria-haspopup="true"
                  aria-expanded={aboutDropdownOpen ? 'true' : 'false'}
                  onClick={(e) => {
                    if (isMobileNav()) {
                      e.preventDefault();
                      setAboutDropdownOpen((prev) => !prev);
                    } else {
                      handleLinkClick(e, 'methodology');
                    }
                  }}
                >
                  {t.nav.methodology}
                </a>
                <ul className="dropdown-menu">
                  <li>
                    <a
                      href={routeToPath('methodology')}
                      onClick={(e) => handleLinkClick(e, 'methodology')}
                    >
                      {t.nav.methodology}
                    </a>
                  </li>
                  <li>
                    <a
                      href={routeToPath('about')}
                      onClick={(e) => handleLinkClick(e, 'about')}
                    >
                      {t.nav.about}
                    </a>
                  </li>
                </ul>
              </li>
            </ul>
          </nav>

          <div className="header-actions flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                onNavigate('explorer');
                closeMenu();
              }}
              className="header-search-trigger"
              aria-label="Open Budget Explorer search"
              title="Search Budget Explorer"
            >
              <i className="bi bi-search" aria-hidden="true" />
              <span className="hidden xl:inline">Search</span>
            </button>

            <div className="lang-selector" role="group" aria-label={t.meta.languageLabel}>
              {langOptions.map((opt) => (
                <button
                  key={opt.code}
                  type="button"
                  disabled={loadingLanguage}
                  className={`btn btn-secondary btn-sm lang-btn ${language === opt.code ? 'active' : ''}`}
                  onClick={() => setLanguage(opt.code)}
                  aria-label={opt.aria}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button
            ref={toggleRef}
            type="button"
            className="mobile-menu-toggle"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? 'Close Navigation' : 'Open Navigation'}
            aria-expanded={mobileMenuOpen ? 'true' : 'false'}
            aria-controls="main-navigation"
          >
            <i className={`bi ${mobileMenuOpen ? 'bi-x-lg' : 'bi-list'}`} aria-hidden="true" />
          </button>
        </div>
        <div className="fs-progress" aria-hidden="true" />
      </header>

      <main id="main-content" className="max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>

      <footer className="site-footer">
        <div className="container">
          <div className="footer-main-new">
            <div className="footer-brand">
              <a
                href={`${MAIN_SITE_URL}/`}
                aria-label="BetterAlcala Home"
                className="brand-lockup brand-lockup--footer mb-4"
              >
                <img
                  src="/assets/images/logo/alcala-seal-v2.png"
                  alt="BetterAlcala logo"
                  className="footer-logo !mb-0"
                  width={52}
                  height={52}
                />
                <span className="brand-text-group">
                  <span className="brand-wordmark">
                    <span className="brand-better">Better</span>
                    <span className="brand-alcala">Alcala</span>
                  </span>
                  <span className="brand-subtitle">Alcala, Pangasinan · BetterLGU</span>
                </span>
              </a>
              <p className="footer-tagline">
                Independent civic information and government transparency platform for the
                Municipality of Alcala, Pangasinan, and the Philippines.
              </p>
              <div className="footer-social-new">
                <a
                  href="https://facebook.com/melmarj0nes23/"
                  className="footer-social-btn"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LGU Alcala Official Facebook Page"
                >
                  <i className="bi bi-facebook" aria-hidden="true" />
                </a>
                <a
                  href="https://bettergov.ph/"
                  className="footer-social-btn"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="BetterGov.ph Initiative"
                >
                  <i className="bi bi-globe2" aria-hidden="true" />
                </a>
                <a
                  href="https://github.com/melmarj0nes23/betteralcala"
                  className="footer-social-btn"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="BetterAlcala GitHub Repository"
                >
                  <i className="bi bi-github" aria-hidden="true" />
                </a>
              </div>
            </div>

            <div className="footer-column">
              <h4>Quick Links</h4>
              <ul className="footer-links-new">
                <li>
                  <a href={`${MAIN_SITE_URL}/services`}>Municipal Services Directory</a>
                </li>
                <li>
                  <a href={`${MAIN_SITE_URL}/news`}>News &amp; Announcements</a>
                </li>
                <li>
                  <a href={`${MAIN_SITE_URL}/sitemap`}>Sitemap</a>
                </li>
                <li>
                  <a href={`${MAIN_SITE_URL}/terms`}>Terms of Use</a>
                </li>
                <li>
                  <a href={`${MAIN_SITE_URL}/privacy`}>Privacy Policy</a>
                </li>
                <li>
                  <a href={`${MAIN_SITE_URL}/accessibility`}>Accessibility</a>
                </li>
                <li>
                  <a href={`${MAIN_SITE_URL}/faq`}>Frequently Asked Questions</a>
                </li>
              </ul>
            </div>

            <div className="footer-column">
              <h4>Official Resources</h4>
              <ul className="footer-links-new">
                <li>
                  <a href="https://data.gov.ph" target="_blank" rel="noopener noreferrer">
                    Open Data Philippines
                  </a>
                </li>
                <li>
                  <a href="https://www.foi.gov.ph/" target="_blank" rel="noopener noreferrer">
                    Freedom of Information (FOI)
                  </a>
                </li>
                <li>
                  <a href="https://www.pangasinan.gov.ph/" target="_blank" rel="noopener noreferrer">
                    Province of Pangasinan
                  </a>
                </li>
                <li>
                  <a href="https://psa.gov.ph/" target="_blank" rel="noopener noreferrer">
                    Philippine Statistics Authority (PSA)
                  </a>
                </li>
                <li>
                  <a href="https://blgf.gov.ph/" target="_blank" rel="noopener noreferrer">
                    Bureau of Local Gov’t Finance (BLGF)
                  </a>
                </li>
                <li>
                  <a href="https://www.coa.gov.ph/" target="_blank" rel="noopener noreferrer">
                    Commission on Audit (COA)
                  </a>
                </li>
                <li>
                  <a href="https://www.dpwh.gov.ph/" target="_blank" rel="noopener noreferrer">
                    DPWH Infrastructure Portal
                  </a>
                </li>
              </ul>
            </div>

            <div className="footer-column">
              <h4>Community &amp; Transparency</h4>
              <ul className="footer-links-new">
                <li
                  className="text-white/85 text-sm"
                  aria-label="Cost to the People of Alcala: Zero Pesos"
                >
                  Cost to the People of Alcala: <strong className="text-white">₱0</strong>
                </li>
                <li>
                  <a href={`${MAIN_SITE_URL}/contact#feedback`}>Volunteer / Give Feedback</a>
                </li>
                <li>
                  <a href="https://bettergov.ph/" target="_blank" rel="noopener noreferrer">
                    Contribute via BetterGov.ph
                  </a>
                </li>
              </ul>
              <div className="footer-partners mt-4">
                <a
                  href="https://bettergov.ph"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="BetterGov.ph"
                >
                  <img
                    src="/assets/images/logo/bettergov-footer.svg"
                    alt="BetterGov.ph"
                    className="footer-partner-logo"
                    width={120}
                    height={28}
                    loading="lazy"
                  />
                </a>
              </div>
            </div>
          </div>

          <div className="footer-bottom-new">
            <div className="footer-copyright">
              <span className="footer-copyright-text">
                &copy; {currentYear} BetterAlcala Civic Portal. Open-source civic initiative.
              </span>
              <span className="footer-copyright-license">MIT | CC BY 4.0</span>
              <span className="footer-copyright-disclaimer">
                Independent civic project — not an official LGU website.
              </span>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
