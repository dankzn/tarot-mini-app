import { useEffect, useState } from 'react';
import { CreditCard, Plus, Save, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface PaymentMethod {
  id?: string;
  title: string;
  payment_url: string;
  instructions: string;
  is_active: boolean;
  sort_order: number;
}

const emptyMethod: PaymentMethod = {
  title: '',
  payment_url: '',
  instructions: '',
  is_active: true,
  sort_order: 100,
};

export const PaymentMethodsManager = () => {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [draft, setDraft] = useState<PaymentMethod>(emptyMethod);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadMethods();
  }, []);

  const loadMethods = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Ошибка загрузки способов оплаты:', error);
    } else {
      setMethods(data || []);
    }

    setLoading(false);
  };

  const saveMethod = async (method: PaymentMethod) => {
    if (!method.title.trim() || !method.payment_url.trim()) {
      alert('Укажите название и ссылку оплаты');
      return;
    }

    setSaving(true);
    const payload = {
      title: method.title.trim(),
      payment_url: method.payment_url.trim(),
      instructions: method.instructions.trim(),
      is_active: method.is_active,
      sort_order: Number(method.sort_order) || 100,
    };

    const query = method.id
      ? supabase.from('payment_methods').update(payload).eq('id', method.id)
      : supabase.from('payment_methods').insert([payload]);

    const { error } = await query;
    setSaving(false);

    if (error) {
      alert('Ошибка сохранения: ' + error.message);
      return;
    }

    setDraft(emptyMethod);
    await loadMethods();
    alert('✅ Способ оплаты сохранён');
  };

  const deleteMethod = async (methodId?: string) => {
    if (!methodId || !confirm('Удалить способ оплаты?')) return;

    const { error } = await supabase
      .from('payment_methods')
      .delete()
      .eq('id', methodId);

    if (error) {
      alert('Ошибка удаления: ' + error.message);
      return;
    }

    await loadMethods();
  };

  const updateMethod = (index: number, patch: Partial<PaymentMethod>) => {
    setMethods(current => current.map((method, methodIndex) => (
      methodIndex === index ? { ...method, ...patch } : method
    )));
  };

  const renderMethodForm = (
    method: PaymentMethod,
    onChange: (patch: Partial<PaymentMethod>) => void,
    onSave: () => void,
    onDelete?: () => void
  ) => (
    <div className="rounded-[1.5rem] border border-white/80 bg-white/78 p-4 shadow-[0_12px_30px_rgba(56,81,68,0.08)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8A5A3F]/70">
            payment method
          </p>
          <h3 className="text-lg font-black text-[#385144]">
            {method.id ? method.title || 'Способ оплаты' : 'Новый способ оплаты'}
          </h3>
        </div>
        <label className="flex items-center gap-2 text-xs font-black text-[#385144]">
          <input
            type="checkbox"
            checked={method.is_active}
            onChange={(event) => onChange({ is_active: event.target.checked })}
          />
          Активен
        </label>
      </div>

      <div className="grid gap-3">
        <input
          value={method.title}
          onChange={(event) => onChange({ title: event.target.value })}
          placeholder="Например: Т-Банк — перевод"
          className="rounded-2xl border border-[#385144]/10 bg-[#F8F3EC] px-4 py-3 font-bold text-[#385144] outline-none focus:border-[#385144]"
        />
        <input
          value={method.payment_url}
          onChange={(event) => onChange({ payment_url: event.target.value })}
          placeholder="https://..."
          className="rounded-2xl border border-[#385144]/10 bg-[#F8F3EC] px-4 py-3 font-bold text-[#385144] outline-none focus:border-[#385144]"
        />
        <textarea
          rows={3}
          value={method.instructions}
          onChange={(event) => onChange({ instructions: event.target.value })}
          placeholder="Инструкция для клиента, если нужна"
          className="rounded-2xl border border-[#385144]/10 bg-[#F8F3EC] px-4 py-3 font-semibold text-[#385144] outline-none focus:border-[#385144]"
        />
        <input
          type="number"
          value={method.sort_order}
          onChange={(event) => onChange({ sort_order: Number(event.target.value) })}
          placeholder="Порядок"
          className="rounded-2xl border border-[#385144]/10 bg-[#F8F3EC] px-4 py-3 font-bold text-[#385144] outline-none focus:border-[#385144]"
        />
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="flex flex-1 items-center justify-center rounded-2xl bg-[#385144] px-4 py-3 font-black text-white disabled:opacity-50"
        >
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>
        {onDelete && (
          <button
            onClick={onDelete}
            className="rounded-2xl bg-red-50 px-4 py-3 font-black text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="premium-surface rounded-[1.75rem] p-5">
        <div className="premium-content">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#385144] text-white">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <p className="luxury-kicker mb-1">manual payments</p>
              <h2 className="text-2xl font-black text-[#385144]">Способы оплаты</h2>
              <p className="mt-1 text-sm font-semibold leading-relaxed text-[#5E675D]">
                Добавляйте ссылку Т-Банка или другие ручные способы. Клиент увидит активный способ в кнопке оплаты.
              </p>
            </div>
          </div>
        </div>
      </div>

      {renderMethodForm(
        draft,
        patch => setDraft(current => ({ ...current, ...patch })),
        () => saveMethod(draft)
      )}

      {loading ? (
        <div className="rounded-2xl bg-white/75 p-5 text-center font-bold text-[#6C756C]">
          Загрузка...
        </div>
      ) : methods.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#385144]/20 bg-white/70 p-5 text-center">
          <Plus className="mx-auto mb-2 h-6 w-6 text-[#B8795C]" />
          <p className="font-bold text-[#6C756C]">Способов оплаты пока нет</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {methods.map((method, index) => (
            <div key={method.id || index}>
              {renderMethodForm(
                method,
                patch => updateMethod(index, patch),
                () => saveMethod(method),
                () => deleteMethod(method.id)
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
