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
    <div className="fixed inset-0 bg-[#F8F5F2] flex flex-col items-center justify-center z-50">
      <div className="text-center">
        <img 
          src="/logo.png" 
          alt="Tarot by Danil" 
          className="w-32 h-32 mx-auto mb-6 object-contain"
        />
        <h1 className="text-3xl font-bold text-[#385144] mb-2">Tarot by Danil</h1>
        <p className="text-[#385144]/70 text-sm">Мини-приложение</p>
        <div className="mt-8 flex justify-center">
          <div className="w-8 h-8 border-4 border-[#385144]/20 border-t-[#385144] rounded-full animate-spin"></div>
        </div>
      </div>
    </div>
  );
};