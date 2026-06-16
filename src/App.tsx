import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { SplashScreen } from './components/SplashScreen';
import { RegistrationForm } from './components/RegistrationForm';
import { Dashboard } from './components/Dashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminWebLogin } from './pages/AdminWebLogin';
import { AdminWebDashboard } from './pages/AdminWebDashboard';
import { AdminWebConsultations } from './pages/AdminWebConsultations';

export const App = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initUser();
  }, []);

  const initUser = async () => {
    try {
      const tg = window.Telegram?.WebApp;
      if (!tg) {
        console.error('Telegram WebApp не найден');
        setLoading(false);
        return;
      }

      const tgUser = tg.initDataUnsafe?.user;
      if (!tgUser) {
        console.error('Пользователь Telegram не найден');
        setLoading(false);
        return;
      }

      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', tgUser.id)
        .single();

      if (existingUser) {
        setUser(existingUser);
      } else {
        setUser({ needsRegistration: true, telegramUser: tgUser });
      }
    } catch (error) {
      console.error('Ошибка инициализации:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegistrationComplete = async (userData: any) => {
    setUser(userData);
  };

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Веб-портал для админа */}
        <Route path="/admin-web" element={<AdminWebLogin />} />
        <Route path="/admin-web/dashboard" element={<AdminWebDashboard />} />
        
        {/* Telegram Mini App */}
        <Route path="/*" element={
          loading ? (
            <div className="min-h-screen bg-[#F8F5F2] flex items-center justify-center">
              <div className="text-[#385144]">Загрузка...</div>
            </div>
          ) : user?.needsRegistration ? (
            <RegistrationForm 
              telegramUser={user.telegramUser}
              onComplete={handleRegistrationComplete}
            />
          ) : !user ? (
            <div className="min-h-screen bg-[#F8F5F2] flex items-center justify-center">
              <div className="text-[#385144]">Ошибка загрузки пользователя</div>
            </div>
          ) : user.role === 'admin' ? (
            <AdminDashboard currentUser={user} />
          ) : (
            <Dashboard user={user} />
          )
        } />
      </Routes>
      <Route path="/admin-web/consultations" element={<AdminWebConsultations />} />
    </BrowserRouter>
  );
};

export default App;