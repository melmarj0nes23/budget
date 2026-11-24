import { useEffect, useRef, useState, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export default function PWAManager() {
  const [showInstall, setShowInstall] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const isOnline = useOnlineStatus();

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt.current) return;
    await deferredPrompt.current.prompt();
    await deferredPrompt.current.userChoice;
    deferredPrompt.current = null;
    setShowInstall(false);
  }, []);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      if (!standalone && !sessionStorage.getItem('pwa-install-dismissed')) {
        setShowInstall(true);
      }
    };

    const onAppInstalled = () => {
      setIsStandalone(true);
      setShowInstall(false);
      deferredPrompt.current = null;
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  return (
    <>
      {!isOnline && (
        <div
          className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-xs font-medium text-white shadow-lg"
          role="status"
          aria-live="polite"
        >
          <i className="bi bi-wifi-off" aria-hidden="true" />
          <span>Offline Mode — Showing cached BetterAlcala data &amp; hotlines.</span>
        </div>
      )}

      {showInstall && !isStandalone && (
        <div className="pwa-install-banner" role="region" aria-label="Install BetterAlcala app">
          <div className="pwa-install-content">
            <i className="bi bi-download" aria-hidden="true" />
            <span>Install BetterAlcala for quick offline access to services &amp; hotlines.</span>
          </div>
          <div className="pwa-install-actions">
            <button
              type="button"
              className="pwa-install-btn"
              onClick={handleInstall}
              aria-label="Install BetterAlcala app"
            >
              Install
            </button>
            <button
              type="button"
              className="pwa-install-dismiss"
              onClick={() => {
                sessionStorage.setItem('pwa-install-dismissed', '1');
                setShowInstall(false);
              }}
              aria-label="Dismiss install prompt"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {isIOS && !isStandalone && !showInstall && !sessionStorage.getItem('pwa-ios-dismissed') && (
        <div className="pwa-install-banner" role="region" aria-label="Install on iOS">
          <div className="pwa-install-content">
            <i className="bi bi-phone" aria-hidden="true" />
            <span>Add BetterAlcala to your iPhone Home Screen for offline access.</span>
          </div>
          <div className="pwa-install-actions">
            <button
              type="button"
              className="pwa-install-btn"
              onClick={() => setShowIOSGuide(true)}
            >
              How to Install
            </button>
            <button
              type="button"
              className="pwa-install-dismiss"
              onClick={() => {
                sessionStorage.setItem('pwa-ios-dismissed', '1');
                setShowIOSGuide(false);
                setIsIOS(false);
              }}
              aria-label="Dismiss iOS install prompt"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Install BetterAlcala on iOS</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              1. Tap the <strong>Share</strong> icon in the Safari toolbar.
              <br />
              2. Scroll down and tap <strong>Add to Home Screen</strong>.
            </p>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="mt-4 w-full rounded-lg bg-[#0032a0] py-2 text-sm font-medium text-white hover:bg-[#002170]"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
