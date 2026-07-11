import { supabase } from './supabase';

interface ClientDeletionTarget {
  id: string;
  telegram_id?: string | number | null;
}

const isMissingRelationError = (error: any) => (
  error?.code === '42P01'
  || error?.code === 'PGRST205'
  || String(error?.message || '').toLowerCase().includes('does not exist')
  || String(error?.message || '').toLowerCase().includes('could not find the table')
);

const ignoreMissingTable = async <T>(request: PromiseLike<{ data: T | null; error: any }>) => {
  const { data, error } = await request;
  if (error && !isMissingRelationError(error)) throw error;
  return data;
};

export const deleteClientCompletely = async (client: ClientDeletionTarget) => {
  const rpcResult = await supabase
    .rpc('delete_client_completely', { target_user_id: client.id })
    .single();

  if (!rpcResult.error) return;

  if (!isMissingRelationError(rpcResult.error) && rpcResult.error.code !== '42883') {
    throw rpcResult.error;
  }

  await ignoreMissingTable(
    supabase
      .from('time_slots')
      .update({ is_booked: false, booked_by: null })
      .eq('booked_by', client.id)
  );

  const enrollmentIds = await ignoreMissingTable(
    supabase
      .from('training_enrollments')
      .select('id')
      .eq('user_id', client.id)
  );

  const ids = (enrollmentIds || []).map((enrollment: any) => enrollment.id).filter(Boolean);
  if (ids.length > 0) {
    await ignoreMissingTable(
      supabase
        .from('training_lesson_progress')
        .delete()
        .in('enrollment_id', ids)
    );
  }

  await ignoreMissingTable(
    supabase
      .from('training_enrollments')
      .delete()
      .eq('user_id', client.id)
  );

  await ignoreMissingTable(
    supabase
      .from('promo_code_redemptions')
      .delete()
      .eq('user_id', client.id)
  );

  await ignoreMissingTable(
    supabase
      .from('consultations')
      .delete()
      .eq('user_id', client.id)
  );

  if (client.telegram_id) {
    await ignoreMissingTable(
      supabase
        .from('pending_referrals')
        .delete()
        .eq('telegram_id', client.telegram_id)
    );

    await ignoreMissingTable(
      supabase
        .from('users')
        .update({ referred_by: null })
        .eq('referred_by', Number(client.telegram_id))
    );
  }

  await ignoreMissingTable(
    supabase
      .from('users')
      .delete()
      .eq('id', client.id)
  );
};
