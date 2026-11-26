import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowUpRightIcon, MailIcon, MenuIcon, SearchIcon, XIcon } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useDetailedWeather } from '../../hooks/useDetailedWeather';
import CommandSearchModal from '../CommandSearchModal';
import Container from '../v2/ui/Container';
import Button from '../v2/ui/Button';
import { cn } from '../../lib/utils';

type NavItem = {
  label: string;
  to: string;
  matchPrefixes: string[];
};

const navItemBase =
  'inline-flex items-center gap-1.5 whitespace-nowrap px-5 py-3 font-serif-ed text-base font-semibold text-ed-ink-2 no-underline transition-colors hover:bg-ed-navy-tint hover:text-ed-navy';
const activeClasses = 'bg-ed-navy-tint text-ed-navy';

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [showPrimaryNav, setShowPrimaryNav] = useState(true);
  const lastScrollYRef = useRef(0);
  const { pathname } = useLocation();
  const { language, setLanguage } = useLanguage();
  const weather = useDetailedWeather();

  const today = useMemo(
    () =>
      new Date().toLocaleDateString('en-PH', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
    []
  );

  const navItems: NavItem[] = useMemo(
    () => [
      {
        label: 'Overview Summary',
        to: '/',
        matchPrefixes: ['/', '/budget'],
      },
      {
        label: 'Barangay Tracker',
        to: '/tracker',
        matchPrefixes: ['/tracker'],
      },
      {
        label: 'Municipal Budget & Docs',
        to: '/budgetdocs',
        matchPrefixes: ['/budgetdocs'],
      },
      {
        label: 'DPWH Contracts (12)',
        to: '/contracts',
        matchPrefixes: ['/contracts'],
      },
      {
        label: 'Project Transparency',
        to: '/transparency',
        matchPrefixes: ['/transparency'],
      },
    ],
    []
  );

  useEffect(() => {
    function handleGlobalShortcut(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', handleGlobalShortcut);
    return () => window.removeEventListener('keydown', handleGlobalShortcut);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    lastScrollYRef.current = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastScrollYRef.current;
      if (y <= 40) {
        setShowPrimaryNav(true);
      } else if (delta > 8) {
        setShowPrimaryNav(false);
      } else if (delta < -8) {
        setShowPrimaryNav(true);
      }
      lastScrollYRef.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isActivePath = (prefixes: string[]) =>
    prefixes.some((p) => (p === '/' ? pathname === '/' : pathname === p || pathname.startsWith(`${p}/`)));

  return (
    <>
      {/* Tier 2: MastheadTop — scrolls away on desktop, hidden on mobile */}
      <div className="bg-white font-sans-ed text-ed-ink antialiased max-md:hidden">
        <Container>
          <div className="flex items-center gap-6 border-b border-ed-rule py-2.5 font-serif-ed text-[12px] tracking-normal text-ed-ink-3">
            <div className="flex min-w-0 items-center gap-4">
              <span className="whitespace-nowrap">{today}</span>
              {weather.data?.current?.tempC != null && (
                <span className="inline-flex items-center gap-3 max-xl:hidden">
                  <span className="text-ed-rule-strong">|</span>
                  <span className="inline-flex items-center gap-1.5 tabular-nums">
                    <span>Alcala, Pangasinan</span>
                    <span className="text-ed-ink font-semibold">{Math.round(weather.data.current.tempC)}°C</span>
                  </span>
                </span>
              )}
            </div>
            <nav aria-label="Utility" className="ml-auto flex shrink-0 items-center gap-4">
              <a href="https://betteralcala.org/contact" className="text-ed-ink-3 no-underline hover:text-ed-navy">
                Contact
              </a>
              <span className="text-ed-rule-strong">|</span>
              <a href="https://betteralcala.org/accessibility" className="text-ed-ink-3 no-underline hover:text-ed-navy">
                Accessibility
              </a>
              <span className="text-ed-rule-strong">|</span>
              <a href="https://betteralcala.org/faq" className="text-ed-ink-3 no-underline hover:text-ed-navy">
                FAQ
              </a>
              <span className="text-ed-rule-strong">|</span>
              <div className="relative inline-flex">
                <select
                  aria-label="Language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as 'en' | 'fil' | 'ilo')}
                  className="cursor-pointer border border-ed-rule-strong bg-white py-1 px-2.5 font-serif-ed text-[12px] text-ed-ink-3 transition-colors hover:border-ed-navy hover:text-ed-navy focus:border-ed-navy focus:outline-none"
                >
                  <option value="en">English</option>
                  <option value="fil">Filipino</option>
                  <option value="ilo">Ilocano</option>
                </select>
              </div>
            </nav>
          </div>
        </Container>
      </div>

      {/* Persistent Sticky Header (LogoRow + PrimaryNav + MobileMenu) */}
      <header className="sticky top-0 z-40 bg-white font-sans-ed text-ed-ink antialiased border-b-2 border-b-ed-ink shadow-md">
        <Container>
          {/* Tier 3: LogoRow */}
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-8 py-6 max-md:grid-cols-[auto_auto] max-md:justify-between max-md:gap-3 max-md:py-3">
            <a
              href="https://betteralcala.org/"
              aria-label="BetterAlcala main portal"
              className="inline-flex items-center gap-3 no-underline"
            >
              <img
                src="/assets/images/logo/alcala-seal-v2.png"
                alt="Official Seal of the Municipality of Alcala — BetterAlcala Logo"
                width={48}
                height={48}
                className="block h-12 w-12 object-contain max-md:h-9 max-md:w-9"
              />
              <span className="flex flex-col leading-none">
                <span className="font-serif-ed text-[24px] font-bold tracking-[-0.025em] text-ed-ink max-md:text-[20px]">
                  Better<span className="text-ed-navy">Alcala</span>
                </span>
                <span className="mt-1 font-mono-ed text-[10px] uppercase tracking-[0.14em] text-ed-ink-3">
                  Alcala, Pangasinan
                </span>
              </span>
            </a>

            <div className="max-w-[320px] border-l border-ed-rule pl-6 font-mono-ed text-[10px] uppercase leading-tight tracking-[0.16em] text-ed-ink-3 max-xl:hidden">
              Fiscal &amp; budget transparency portal for Alcala, Pangasinan
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCommandOpen(true)}
                aria-label="Search budget records (Ctrl+K)"
                className="inline-flex h-11 w-[220px] cursor-pointer items-center gap-2.5 border border-ed-rule-strong bg-white px-3.5 text-left font-sans-ed text-sm text-ed-ink-4 transition-colors hover:border-ed-navy focus:border-ed-navy focus:outline-none max-md:hidden lg:w-[280px] xl:w-[320px]"
              >
                <SearchIcon size={15} className="shrink-0 text-ed-ink-3" />
                <span className="flex-1 truncate">Search budgets, DPWH, barangays…</span>
                <kbd className="border border-ed-rule bg-ed-paper-2 px-1.5 py-0.5 font-mono-ed text-[10px] text-ed-ink-3">
                  ⌘K
                </kbd>
              </button>

              <Button
                as="a"
                href="https://betteralcala.org/contact"
                className="max-lg:hidden"
              >
                <MailIcon size={14} />
                <span>Contact us</span>
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setMobileMenuOpen((v) => !v)}
                aria-label={mobileMenuOpen ? 'Close menu' : 'Toggle menu'}
                aria-expanded={mobileMenuOpen}
                className="lg:hidden"
              >
                {mobileMenuOpen ? <XIcon size={16} /> : <MenuIcon size={16} />}
                <span>Menu</span>
              </Button>
            </div>
          </div>
        </Container>

        {/* Tier 4: PrimaryNav */}
        <nav
          aria-hidden={!showPrimaryNav}
          className={cn(
            'border-t border-ed-rule bg-white transition-all duration-150 max-lg:hidden lg:absolute lg:left-0 lg:right-0 lg:top-full lg:border-b-2 lg:border-b-ed-ink lg:shadow-md',
            showPrimaryNav
              ? 'lg:translate-y-0 lg:opacity-100'
              : 'lg:-translate-y-2 lg:opacity-0 lg:pointer-events-none'
          )}
          aria-label="Primary"
        >
          <Container className="flex flex-wrap items-stretch justify-start">
            {navItems.map((item) => {
              const active = isActivePath(item.matchPrefixes);
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  className={cn(navItemBase, active && activeClasses)}
                >
                  {item.label}
                </Link>
              );
            })}

            <a
              href="https://betteralcala.org/"
              className={cn(navItemBase, 'ml-auto max-xl:hidden')}
            >
              <span>Main Portal</span>
              <ArrowUpRightIcon size={14} className="opacity-75" />
            </a>
          </Container>
        </nav>

        {/* Mobile Menu Drawer */}
        {mobileMenuOpen && (
          <div className="max-h-[calc(100svh-64px)] overflow-y-auto border-t border-ed-rule bg-white py-2 pb-4 lg:hidden">
            <Container>
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex w-full items-center justify-between border-b border-ed-rule py-3.5 font-sans-ed text-[15px] font-medium text-ed-ink no-underline',
                    isActivePath(item.matchPrefixes) && 'text-ed-navy font-semibold'
                  )}
                >
                  <span>{item.label}</span>
                </Link>
              ))}

              <a
                href="https://betteralcala.org/"
                onClick={() => setMobileMenuOpen(false)}
                className="flex w-full items-center justify-between border-b border-ed-rule py-3.5 font-sans-ed text-[15px] font-medium text-ed-navy no-underline"
              >
                <span>Main Portal (betteralcala.org)</span>
                <ArrowUpRightIcon size={14} />
              </a>

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setCommandOpen(true);
                }}
                className="flex w-full cursor-pointer items-center justify-between border-0 border-b border-ed-rule bg-transparent px-0 py-3.5 text-left font-sans-ed text-[15px] font-medium text-ed-ink"
              >
                <span>Search</span>
                <SearchIcon size={14} />
              </button>

              <nav
                aria-label="Utility"
                className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 pt-3 font-sans-ed text-sm text-ed-ink-2"
              >
                <a href="https://betteralcala.org/contact" className="text-ed-ink-2 no-underline hover:text-ed-navy">
                  Contact
                </a>
                <a href="https://betteralcala.org/accessibility" className="text-ed-ink-2 no-underline hover:text-ed-navy">
                  Accessibility
                </a>
                <a href="https://betteralcala.org/faq" className="text-ed-ink-2 no-underline hover:text-ed-navy">
                  FAQ
                </a>
              </nav>

              <div className="mt-3">
                <div className="relative inline-flex">
                  <select
                    aria-label="Language"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as 'en' | 'fil' | 'ilo')}
                    className="cursor-pointer border border-ed-rule-strong bg-white py-1.5 px-3 font-serif-ed text-[13px] text-ed-ink-3"
                  >
                    <option value="en">English</option>
                    <option value="fil">Filipino</option>
                    <option value="ilo">Ilocano</option>
                  </select>
                </div>
              </div>
            </Container>
          </div>
        )}

        <CommandSearchModal open={commandOpen} onClose={() => setCommandOpen(false)} />
      </header>
      {/* Static spacer matching desktop PrimaryNav height */}
      <div className="h-[49px] bg-white max-lg:hidden" aria-hidden="true" />
    </>
  );
}
