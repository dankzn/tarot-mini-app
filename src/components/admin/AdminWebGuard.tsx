import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { ensureAdminSession } from '../../lib/adminAuth';

interface AdminWebGuardProps {
  children: ReactNode;
}

export const AdminWebGuard = ({ children }: AdminWebGuardProps) => {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    ensureAdminSession().then(({ ok }) => {
      if (mounted) setAllowed(ok);
    });

    return () => {
      mounted = false;
    };
  }, []);

  if (allowed === null) {
    return (
      <div className="min-h-screen bg-[#F8F5F2] flex items-center justify-center">
        <div className="rounded-2xl bg-white/80 px-5 py-3 text-sm font-bold text-[#385144] shadow-sm">
          Проверка доступа...
        </div>
      </div>
    );
  }

  if (!allowed) {
    return <Navigate to="/admin-web" replace />;
  }

  return children;
};
