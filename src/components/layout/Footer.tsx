import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { doc, increment, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useLanguage } from '../../contexts/LanguageContext';

const VISIT_SESSION_KEY = 'betteralcala_visit_counted';
let visitRecordedInMemory = false;

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const { t } = useLanguage();
  const [version, setVersion] = useState('1.0.0');
  const [visitorCount, setVisitorCount] = useState<number | null>(null);

  useEffect(() => {
    fetch('/version.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.version) setVersion(data.version);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const metricsRef = doc(db, 'siteMetrics', 'visitors');

    const unsubscribe = onSnapshot(
      metricsRef,
      (snap) => {
        const count = snap.data()?.count;
        if (typeof count === 'number' && Number.isFinite(count)) {
          setVisitorCount(count);
        }
      },
      () => {
        // Silently ignore if Firestore rules for siteMetrics are not yet published
      }
    );

    const alreadyCounted =
      visitRecordedInMemory ||
      (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(VISIT_SESSION_KEY) === '1');

    if (!alreadyCounted) {
      visitRecordedInMemory = true;
      try {
        sessionStorage.setItem(VISIT_SESSION_KEY, '1');
      } catch {
        // Ignore storage errors in restricted browsing modes
      }
      setDoc(
        metricsRef,
        {
          count: increment(1),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ).catch(() => {
        // Silently ignore if Firestore rules for siteMetrics are not yet published
      });
    }

    return () => unsubscribe();
  }, []);

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-main-new">
          <div className="footer-brand">
            <a
              href="https://betteralcala.org/"
              aria-label="BetterAlcala Main Portal"
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
            <p className="footer-tagline">{t('footer-tagline')}</p>
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
                href="https://github.com/melmarj0nes23/budget"
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
            <h4>{t('footer-quick-links')}</h4>
            <ul className="footer-links-new">
              <li>
                <a href="https://betteralcala.org/services">Municipal Services Directory</a>
              </li>
              <li>
                <a href="https://betteralcala.org/news">News &amp; Announcements</a>
              </li>
              <li>
                <a href="https://betteralcala.org/sitemap">Sitemap</a>
              </li>
              <li>
                <a href="https://betteralcala.org/terms">Terms of Use</a>
              </li>
              <li>
                <a href="https://betteralcala.org/privacy">Privacy Policy</a>
              </li>
              <li>
                <a href="https://betteralcala.org/accessibility">Accessibility</a>
              </li>
              <li>
                <a href="https://betteralcala.org/faq">Frequently Asked Questions</a>
              </li>
              <li>
                <a href="https://betteralcala.org/admin">Admin Data Sync</a>
              </li>
            </ul>
          </div>

          <div className="footer-column">
            <h4>{t('footer-resources')}</h4>
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
                {t('footer-cost')} <strong className="text-white">₱0</strong>
              </li>
              <li>
                <a href="https://betteralcala.org/contact#feedback">{t('footer-volunteer')}</a>
              </li>
              <li>
                <a href="https://bettergov.ph/" target="_blank" rel="noopener noreferrer">
                  {t('footer-contribute')}
                </a>
              </li>
            </ul>
            {visitorCount !== null && (
              <div
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white/90"
                aria-label={`${visitorCount.toLocaleString()} total portal visits`}
              >
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
                <span className="text-white/75">Total Visits</span>
                <strong className="font-mono-data text-white tabular-nums">
                  {visitorCount.toLocaleString()}
                </strong>
              </div>
            )}
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
              &copy; {currentYear} {t('footer-copyright-text')}
            </span>
            <span className="footer-copyright-license">MIT | CC BY 4.0</span>
            <span className="footer-copyright-disclaimer">{t('footer-copyright-disclaimer')}</span>
            <span className="footer-version">
              <i className="bi bi-boxes" aria-hidden="true" /> {version ? `Ver. ${version}` : ''}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
