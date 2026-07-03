import { useEffect } from 'react';

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen = ({ onFinish }: SplashScreenProps) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onFinish();
    }, 2000);

    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_20%_10%,#E7EFE7_0,transparent_34%),linear-gradient(145deg,#F8F3EC_0%,#EFE6DA_100%)] p-7">
      <div className="absolute -left-24 top-16 h-56 w-56 rounded-full bg-[#385144]/10 blur-3xl" />
      <div className="absolute -right-20 bottom-20 h-64 w-64 rounded-full bg-[#B8795C]/12 blur-3xl" />

      <div className="premium-surface w-full max-w-sm rounded-[2.4rem] p-7 text-center animate-fade-in">
        <div className="premium-content">
          <div className="mx-auto mb-6 flex h-28 w-28 items-center justify-center rounded-[2rem] bg-white/72 shadow-[0_18px_48px_rgba(56,81,68,0.13)] animate-float-soft">
            <img
              src="/logo.png"
              alt="Tarot by Danil"
              className="h-20 w-20 object-contain"
            />
          </div>

          <p className="luxury-kicker mb-2">Personal tarot space</p>
          <h1 className="mb-2 text-3xl font-black leading-tight text-[#385144]">Tarot by Danil</h1>
          <p className="mx-auto max-w-[14rem] text-sm font-semibold leading-relaxed text-[#5E675D]">
            Подготавливаю личный кабинет и ваши форматы.
          </p>

          <div className="soft-divider my-6" />

          <div className="relative mx-auto mb-3 h-1.5 w-48 overflow-hidden rounded-full bg-[#385144]/10">
            <div className="absolute inset-y-0 w-20 rounded-full bg-gradient-to-r from-[#385144] to-[#B8795C]" style={{ animation: 'pulse-line 1.45s ease-in-out infinite' }} />
          </div>

          <div className="flex justify-center gap-1.5">
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                className="h-1.5 w-1.5 rounded-full bg-[#385144]/50"
                style={{ animation: `float-soft 1.8s ease-in-out ${dot * 0.16}s infinite` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
