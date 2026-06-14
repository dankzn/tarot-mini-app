export const SplashScreen = () => {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-[#1a0b2e] to-[#2d1b4e] z-50">
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-white rounded-full blur-3xl opacity-20 animate-pulse"></div>
        <img 
          src="/logo.png" 
          alt="Tarot Studio" 
          className="relative w-64 h-auto object-contain"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>
      
      <div className="flex space-x-2 mt-8">
        <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
      
      <p className="text-white/60 text-sm mt-4 animate-pulse">
        Открываем магическое пространство...
      </p>
    </div>
  );
};