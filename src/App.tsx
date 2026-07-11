import { lazy, Suspense, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { SplashScreen } from './components/SplashScreen';
import { RegistrationForm } from './components/RegistrationForm';
import { AdminWebGuard } from './components/admin/AdminWebGuard';
// import { ErrorBoundary } from './components/ErrorBoundary'; // Временно закомментировано

const Dashboard = lazy(() => import('./components/Dashboard').then(module => ({ default: module.Dashboard })));
const AdminDashboard = lazy(() => import('./components/AdminDashboard').then(module => ({ default: module.AdminDashboard })));
const ProductGateway = lazy(() => import('./components/ProductGateway').then(module => ({ default: module.ProductGateway })));
const TrainingDashboard = lazy(() => import('./components/TrainingDashboard').then(module => ({ default: module.TrainingDashboard })));
const AdminWebLogin = lazy(() => import('./pages/AdminWebLogin').then(module => ({ default: module.AdminWebLogin })));
const AdminWebDashboard = lazy(() => import('./pages/AdminWebDashboard').then(module => ({ default: module.AdminWebDashboard })));
const AdminWebConsultations = lazy(() => import('./pages/AdminWebConsultations').then(module => ({ default: module.AdminWebConsultations })));
const AdminWebSlots = lazy(() => import('./pages/AdminWebSlots').then(module => ({ default: module.AdminWebSlots })));
const AdminWebUsers = lazy(() => import('./pages/AdminWebUsers').then(module => ({ default: module.AdminWebUsers })));
const AdminWebMailings = lazy(() => import('./pages/AdminWebMailings').then(module => ({ default: module.AdminWebMailings })));
const AdminWebServices = lazy(() => import('./pages/AdminWebServices').then(module => ({ default: module.AdminWebServices })));
const AdminWebAnalytics = lazy(() => import('./pages/AdminWebAnalytics').then(module => ({ default: module.AdminWebAnalytics })));
const AdminWebClients = lazy(() => import('./pages/AdminWebClients').then(module => ({ default: module.AdminWebClients })));
const AdminWebTraining = lazy(() => import('./pages/AdminWebTraining').then(module => ({ default: module.AdminWebTraining })));
const StudioLanding = lazy(() => import('./pages/StudioLanding').then(module => ({ default: module.StudioLanding })));
type ClientMode = 'consultations' | 'training';

const getClientModuleStorageKey = (user: any) => `tarot-client-modules:${user?.id || user?.telegram_id || 'guest'}`;

const readVisitedModules = (user: any): ClientMode[] => {
  try {
    const raw = window.localStorage.getItem(getClientModuleStorageKey(user));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((mode): mode is ClientMode => ['consultations', 'training'].includes(mode)) : [];
  } catch {
    return [];
  }
};

const writeVisitedModule = (user: any, mode: ClientMode) => {
  try {
    const next = Array.from(new Set([...readVisitedModules(user), mode]));
    window.localStorage.setItem(getClientModuleStorageKey(user), JSON.stringify(next));
  } catch {
  }
};

const AppLoader = () => (
  <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#E7EFE7_0,#F8F3EC_46%,#EFE6DA_100%)] flex items-center justify-center p-6">
    <div className="premium-surface w-full max-w-xs rounded-[2rem] p-6 text-center">
      <div className="premium-content">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#385144] text-white shadow-[0_16px_38px_rgba(56,81,68,0.20)]">
          <span className="text-xl">✦</span>
        </div>
        <p className="luxury-kicker mb-2">Tarot by Danil</p>
        <div className="relative mx-auto mb-3 h-1 w-40 overflow-hidden rounded-full bg-[#385144]/10">
          <div className="absolute inset-y-0 w-16 rounded-full bg-[#385144]" style={{ animation: 'pulse-line 1.35s ease-in-out infinite' }} />
        </div>
        <p className="text-sm font-black text-[#385144]">Собираю пространство...</p>
      </div>
    </div>
  </div>
);

const adminRoute = (children: ReactNode) => (
  <AdminWebGuard>{children}</AdminWebGuard>
);

export const App = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAdminRoute, setIsAdminRoute] = useState(false);
  const [isPublicSiteRoute, setIsPublicSiteRoute] = useState(false);
  const [clientMode, setClientMode] = useState<ClientMode | null>(null);

  useEffect(() => {
    const path = window.location.pathname;
    const isAdmin = path.startsWith('/admin-web');
    const isPublicSite = path.startsWith('/site') || path.startsWith('/studio');
    setIsAdminRoute(isAdmin);
    setIsPublicSiteRoute(isPublicSite);

    if (!isAdmin && !isPublicSite) {
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
        await resolveInitialClientMode(existingUser);
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

  const resolveInitialClientMode = async (currentUser: any) => {
    if (!currentUser?.id || currentUser.role === 'admin') return;

    try {
      const visited = new Set(readVisitedModules(currentUser));

      const [consultationsRequest, trainingRequest] = await Promise.all([
        supabase
          .from('consultations')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', currentUser.id),
        supabase
          .from('training_enrollments')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', currentUser.id),
      ]);

      if ((consultationsRequest.count || 0) > 0) visited.add('consultations');
      if ((trainingRequest.count || 0) > 0) visited.add('training');

      if (visited.size === 1) {
        setClientMode(visited.has('training') ? 'training' : 'consultations');
      } else {
        setClientMode(null);
      }
    } catch (error) {
      console.warn('Не удалось определить стартовый модуль:', error);
      setClientMode(null);
    }
  };

  const openClientMode = (mode: ClientMode) => {
    writeVisitedModule(user, mode);
    setClientMode(mode);
  };

  if (showSplash && !isAdminRoute && !isPublicSiteRoute) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return (
    <BrowserRouter>
      <Suspense fallback={<AppLoader />}>
        <Routes>
          {/* Веб-портал для админа */}
          <Route path="/admin-web" element={<AdminWebLogin />} />
          <Route path="/admin-web/dashboard" element={adminRoute(<AdminWebDashboard />)} />
          <Route path="/admin-web/consultations" element={adminRoute(<AdminWebConsultations />)} />
          <Route path="/admin-web/slots" element={adminRoute(<AdminWebSlots />)} />
          <Route path="/admin-web/users" element={adminRoute(<AdminWebUsers />)} />
          <Route path="/admin-web/mailings" element={adminRoute(<AdminWebMailings />)} />
          <Route path="/admin-web/services" element={adminRoute(<AdminWebServices />)} />
          <Route path="/admin-web/training" element={adminRoute(<AdminWebTraining />)} />
          <Route path="/admin-web/analytics" element={adminRoute(<AdminWebAnalytics />)} />
          <Route path="/admin-web/clients" element={adminRoute(<AdminWebClients />)} />
          <Route path="/site/*" element={<StudioLanding />} />
          <Route path="/studio/*" element={<StudioLanding />} />

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
              <div className="min-h-screen bg-[#F8F5F2] flex items-center justify-center p-6">
                <div className="premium-surface rounded-[2rem] px-6 py-5 text-center">
                  <div className="premium-content text-sm font-black text-[#385144]">
                    Ошибка загрузки пользователя
                  </div>
                </div>
              </div>
            ) : user.role === 'admin' ? (
              <AdminDashboard currentUser={user} />
            ) : clientMode === 'consultations' ? (
              <Dashboard user={user} onOpenTraining={() => openClientMode('training')} />
            ) : clientMode === 'training' ? (
              <TrainingDashboard
                user={user}
                onBackToGateway={() => setClientMode(null)}
                onOpenConsultations={() => openClientMode('consultations')}
              />
            ) : (
              <ProductGateway
                onChooseConsultations={() => openClientMode('consultations')}
                onChooseTraining={() => openClientMode('training')}
              />
            )
          } />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default App;
