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
import { AdminWebSlots } from './pages/AdminWebSlots';
import { AdminWebUsers } from './pages/AdminWebUsers';
import { AdminWebMailings } from './pages/AdminWebMailings';
import { AdminWebServices } from './pages/AdminWebServices';
import { AdminWebAnalytics } from './pages/AdminWebAnalytics';
import { AdminWebClients } from './pages/AdminWebClients';
import { ErrorBoundary } from './components/ErrorBoundary';

export const App = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAdminRoute, setIsAdminRoute] = useState(false);

  useEffect(() => {
    // Проверяем, является ли текущий путь админским
    const path = window.location.pathname;
    const isAdmin = path.startsWith('/admin-web');
    setIsAdminRoute(isAdmin);

    if (!isAdmin) {
      // Инициализируем Telegram только для Mini App
      initUser();
    } else {
      // Для админских страниц не нужен Telegram
      setLoading(false);
    }
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

  if (showSplash && !isAdminRoute) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Веб-портал для админа - все роуты обёрнуты в ErrorBoundary */}
        <Route path="/admin-web" element={
          <ErrorBoundary>
            <AdminWebLogin />
          </ErrorBoundary>
        } />
        <Route path="/admin-web/dashboard" element={
          <ErrorBoundary>
            <AdminWebDashboard />
          </ErrorBoundary>
        } />
        <Route path="/admin-web/consultations" element={
          <ErrorBoundary>
            <AdminWebConsultations />
          </ErrorBoundary>
        } />
        <Route path="/admin-web/slots" element={
          <ErrorBoundary>
            <AdminWebSlots />
          </ErrorBoundary>
        } />
        <Route path="/admin-web/users" element={
          <ErrorBoundary>
            <AdminWebUsers />
          </ErrorBoundary>
        } />
        <Route path="/admin-web/mailings" element={
          <ErrorBoundary>
            <AdminWebMailings />
          </ErrorBoundary>
        } />
        <Route path="/admin-web/services" element={
          <ErrorBoundary>
            <AdminWebServices />
          </ErrorBoundary>
        } />
        <Route path="/admin-web/analytics" element={
          <ErrorBoundary>
            <AdminWebAnalytics />
          </ErrorBoundary>
        } />
        <Route path="/admin-web/clients" element={
          <ErrorBoundary>
            <AdminWebClients />
          </ErrorBoundary>
        } />
        
        {/* Telegram Mini App - все остальные маршруты */}
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
    </BrowserRouter>
  );
};

export default App;