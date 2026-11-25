import { RefreshCw } from 'lucide-react';

interface TransparencySplashScreenProps {
  message?: string;
}

export default function TransparencySplashScreen({
  message = 'Loading Project Transparency & BetterGov Budget data…',
}: TransparencySplashScreenProps) {
  return (
    <div
      className="flex min-h-[380px] flex-col items-center justify-center rounded-2xl border border-[#0f2342]/10 bg-white px-6 py-12 text-center shadow-sm"
      aria-busy="true"
      aria-label={message}
    >
      <div className="relative flex items-center justify-center">
        <span
          className="absolute h-24 w-24 rounded-full bg-[#26489a]/10 animate-ping"
          aria-hidden="true"
        />
        <span
          className="absolute h-20 w-20 rounded-full border-2 border-[#26489a]/25"
          aria-hidden="true"
        />
        <img
          src="/assets/images/logo/alcala-seal-v2.png"
          alt="Official Seal of Alcala, Pangasinan"
          width={72}
          height={72}
          className="relative h-18 w-18 rounded-full object-contain shadow-sm"
        />
      </div>

      <div className="mt-6 font-serif text-2xl font-bold tracking-tight">
        <span className="text-[#0032a0]">Better</span>
        <span className="text-[#f77f00]">Alcala</span>
      </div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-widest text-slate-500">
        Project Transparency
      </div>

      <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#edf2fa] px-4 py-1.5 text-xs font-semibold text-[#26489a]">
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        <span>{message}</span>
      </div>
    </div>
  );
}
