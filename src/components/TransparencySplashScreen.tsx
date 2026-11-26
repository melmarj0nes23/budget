import { RefreshCw } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface TransparencySplashScreenProps {
  message?: string;
}

export default function TransparencySplashScreen({
  message,
}: TransparencySplashScreenProps) {
  const { t } = useLanguage();
  const displayMessage = message || t('budget-splash-msg');

  return (
    <div
      className="flex min-h-[360px] flex-col items-center justify-center border border-ed-ink bg-white px-6 py-12 text-center"
      aria-busy="true"
      aria-label={displayMessage}
    >
      <div className="relative flex items-center justify-center">
        <span
          className="absolute h-24 w-24 border border-ed-navy/20 animate-ping"
          aria-hidden="true"
        />
        <span
          className="absolute h-20 w-20 border border-ed-navy/30"
          aria-hidden="true"
        />
        <img
          src="/assets/images/logo/alcala-seal-v2.png"
          alt="Official Seal of Alcala, Pangasinan"
          width={72}
          height={72}
          className="relative h-18 w-18 object-contain"
        />
      </div>

      <div className="mt-6 font-serif-ed text-2xl font-bold tracking-[-0.02em] text-ed-ink">
        BetterAlcala
      </div>
      <div className="mt-1 font-mono-ed text-[11px] font-medium uppercase tracking-[0.14em] text-ed-ink-3">
        {t('budget-splash-sub')}
      </div>

      <div className="mt-5 inline-flex items-center gap-2 border border-ed-navy/30 bg-ed-paper-2 px-4 py-1.5 font-mono-ed text-xs font-medium text-ed-navy">
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        <span>{displayMessage}</span>
      </div>
    </div>
  );
}
