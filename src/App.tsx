import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { SplashScreen } from './components/SplashScreen';
import { RegistrationForm } from './components/RegistrationForm';
// import { ErrorBoundary } from './components/ErrorBoundary'; // Временно закомментировано

const Dashboard = lazy(() => import('./components/Dashboard').then(module => ({ default: module.Dashboard })));
const AdminDashboard = lazy(() => import('./components/AdminDashboard').then(module => ({ default: module.AdminDashboard })));
const AdminWebLogin = lazy(() => import('./pages/AdminWebLogin').then(module => ({ default: module.AdminWebLogin })));
const AdminWebDashboard = lazy(() => import('./pages/AdminWebDashboard').then(module => ({ default: module.AdminWebDashboard })));
const AdminWebConsultations = lazy(() => import('./pages/AdminWebConsultations').then(module => ({ default: module.AdminWebConsultations })));
const AdminWebSlots = lazy(() => import('./pages/AdminWebSlots').then(module => ({ default: module.AdminWebSlots })));
const AdminWebUsers = lazy(() => import('./pages/AdminWebUsers').then(module => ({ default: module.AdminWebUsers })));
const AdminWebMailings = lazy(() => import('./pages/AdminWebMailings').then(module => ({ default: module.AdminWebMailings })));
const AdminWebServices = lazy(() => import('./pages/AdminWebServices').then(module => ({ default: module.AdminWebServices })));
const AdminWebAnalytics = lazy(() => import('./pages/AdminWebAnalytics').then(module => ({ default: module.AdminWebAnalytics })));
const AdminWebClients = lazy(() => import('./pages/AdminWebClients').then(module => ({ default: module.AdminWebClients })));

const AppLoader = () => (
  <div className="min-h-screen bg-[#F8F5F2] flex items-center justify-center">
    <div className="rounded-2xl bg-white/80 px-5 py-3 text-sm font-bold text-[#385144] shadow-sm">
      Загрузка...
    </div>
  </div>
);

export const App = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAdminRoute, setIsAdminRoute] = useState(false);

  useEffect(() => {
    const path = window.location.pathname;
    const isAdmin = path.startsWith('/admin-web');
    setIsAdminRoute(isAdmin);

    if (!isAdmin) {
      initUser();
    } else {
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

      const { data: existingUser, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', tgUser.id)
        .maybeSingle();

      if (userError) {
        console.error('Ошибка поиска пользователя:', userError);
        setUser(null);
        return;
      }

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
      <Suspense fallback={<AppLoader />}>
        <Routes>
          {/* Веб-портал для админа */}
          <Route path="/admin-web" element={<AdminWebLogin />} />
          <Route path="/admin-web/dashboard" element={<AdminWebDashboard />} />
          <Route path="/admin-web/consultations" element={<AdminWebConsultations />} />
          <Route path="/admin-web/slots" element={<AdminWebSlots />} />
          <Route path="/admin-web/users" element={<AdminWebUsers />} />
          <Route path="/admin-web/mailings" element={<AdminWebMailings />} />
          <Route path="/admin-web/services" element={<AdminWebServices />} />
          <Route path="/admin-web/analytics" element={<AdminWebAnalytics />} />
          <Route path="/admin-web/clients" element={<AdminWebClients />} />

          {/* Telegram Mini App */}
          <Route path="/*" element={
            loading ? (
              <AppLoader />
            ) : user?.needsRegistration ? (
              <RegistrationForm
                telegramUser={user.telegramUser}
                onComplete={handleRegistrationComplete}
              />
            ) : !user ? (
              <div className="min-h-screen bg-[#F8F5F2] flex items-center justify-center">
                <div className="rounded-2xl bg-white/80 px-5 py-3 text-sm font-bold text-[#385144] shadow-sm">
                  Ошибка загрузки пользователя
                </div>
              </div>
            ) : user.role === 'admin' ? (
              <AdminDashboard currentUser={user} />
            ) : (
              <Dashboard user={user} />
            )
          } />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default App;
