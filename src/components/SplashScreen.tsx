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
        {/* Логотип */}
        <div className="w-32 h-32 mx-auto mb-6 bg-gradient-to-br from-[#385144] to-[#2d4238] rounded-full flex items-center justify-center shadow-lg">
          <span className="text-[#F8F5F2] text-5xl font-bold">T</span>
        </div>
        
        {/* Название */}
        <h1 className="text-3xl font-bold text-[#385144] mb-2">Tarot by Danil</h1>
        <p className="text-[#385144]/70 text-sm">Мини-приложение</p>
        
        {/* Загрузка */}
        <div className="mt-8 flex justify-center">
          <div className="w-8 h-8 border-4 border-[#385144]/20 border-t-[#385144] rounded-full animate-spin"></div>
        </div>
      </div>
    </div>
  );
};