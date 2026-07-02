import { supabase } from './supabase';

export const ensureAdminSession = async () => {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return { ok: false, session: null };
  }

  const { data: adminData, error } = await supabase
    .from('admin_users')
    .select('id')
    .eq('id', session.user.id)
    .maybeSingle();

  if (error || !adminData) {
    await supabase.auth.signOut();
    localStorage.removeItem('admin_session');
    return { ok: false, session: null };
  }

  return { ok: true, session };
};
