import { useCallback, useEffect, useState } from 'react';
import { CreditCard, Landmark, Plus, Save, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const DEFAULT_TBANK_API_URL = 'https://securepay.tinkoff.ru/v2/Init';

interface PaymentMethod {
  id?: string;
  title: string;
  payment_url: string;
  instructions: string;
  is_active: boolean;
  sort_order: number;
}

interface TbankSettings {
  is_active: boolean;
  terminal_key: string;
  has_password: boolean;
  api_url: string;
  success_url: string;
  fail_url: string;
  notification_url: string;
  updated_at?: string | null;
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
  const [tbankSettings, setTbankSettings] = useState<TbankSettings>({
    is_active: false,
    terminal_key: '',
    has_password: false,
    api_url: DEFAULT_TBANK_API_URL,
    success_url: '',
    fail_url: '',
    notification_url: '',
    updated_at: null,
  });
  const [tbankPassword, setTbankPassword] = useState('');
  const [tbankLoading, setTbankLoading] = useState(true);
  const [tbankSaving, setTbankSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const getAdminToken = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      throw new Error('Админ-сессия не найдена. Перезайдите в админку');
    }

    return token;
  }, []);

  const loadTbankSettings = useCallback(async () => {
    setTbankLoading(true);

    try {
      const token = await getAdminToken();
      const response = await fetch('/api/site/tbank-settings', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Не удалось загрузить настройки Т-Банка');
      }

      setTbankSettings({
        is_active: Boolean(payload.settings?.is_active),
        terminal_key: payload.settings?.terminal_key || '',
        has_password: Boolean(payload.settings?.has_password),
        api_url: payload.settings?.api_url || DEFAULT_TBANK_API_URL,
        success_url: payload.settings?.success_url || '',
        fail_url: payload.settings?.fail_url || '',
        notification_url: payload.settings?.notification_url || '',
        updated_at: payload.settings?.updated_at || null,
      });
    } catch (error) {
      console.error('Ошибка загрузки настроек Т-Банка:', error);
    } finally {
      setTbankLoading(false);
    }
  }, [getAdminToken]);

  const loadMethods = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadMethods();
      loadTbankSettings();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadMethods, loadTbankSettings]);

  const saveTbankSettings = async () => {
    if (tbankSettings.is_active && (!tbankSettings.terminal_key.trim() || (!tbankSettings.has_password && !tbankPassword.trim()))) {
      alert('Укажите Terminal Key и пароль терминала');
      return;
    }

    setTbankSaving(true);

    try {
      const token = await getAdminToken();
      const response = await fetch('/api/site/tbank-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          is_active: tbankSettings.is_active,
          terminal_key: tbankSettings.terminal_key,
          terminal_password: tbankPassword,
          api_url: tbankSettings.api_url,
          success_url: tbankSettings.success_url,
          fail_url: tbankSettings.fail_url,
          notification_url: tbankSettings.notification_url,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Не удалось сохранить настройки Т-Банка');
      }

      setTbankPassword('');
      setTbankSettings({
        is_active: Boolean(payload.settings?.is_active),
        terminal_key: payload.settings?.terminal_key || '',
        has_password: Boolean(payload.settings?.has_password),
        api_url: payload.settings?.api_url || DEFAULT_TBANK_API_URL,
        success_url: payload.settings?.success_url || '',
        fail_url: payload.settings?.fail_url || '',
        notification_url: payload.settings?.notification_url || '',
        updated_at: payload.settings?.updated_at || null,
      });
      alert('✅ Т-Банк сохранён');
    } catch (error) {
      alert('Ошибка сохранения Т-Банка: ' + (error instanceof Error ? error.message : 'неизвестная ошибка'));
    } finally {
      setTbankSaving(false);
    }
  };

  const updateTbankSettings = (patch: Partial<TbankSettings>) => {
    setTbankSettings((current) => ({ ...current, ...patch }));
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

      <div className="rounded-[1.75rem] border border-[#385144]/10 bg-[#385144] p-5 text-white shadow-[0_18px_40px_rgba(56,81,68,0.18)]">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/12 text-[#F8F3EC]">
              <Landmark className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#D6B49D]">
                t-bank acquiring
              </p>
              <h3 className="mt-1 text-2xl font-black">Т-Банк эквайринг</h3>
              <p className="mt-1 text-sm font-semibold leading-relaxed text-white/72">
                Работает без Vercel env: ключи хранятся в защищённой таблице Supabase
              </p>
            </div>
          </div>
          <label className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-black">
            <input
              type="checkbox"
              checked={tbankSettings.is_active}
              onChange={(event) => updateTbankSettings({ is_active: event.target.checked })}
            />
            Активен
          </label>
        </div>

        {tbankLoading ? (
          <div className="rounded-2xl bg-white/10 p-4 text-sm font-bold text-white/70">
            Загружаю настройки...
          </div>
        ) : (
          <div className="grid gap-3">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-black text-white/78">
                Terminal Key
                <input
                  value={tbankSettings.terminal_key}
                  onChange={(event) => updateTbankSettings({ terminal_key: event.target.value })}
                  placeholder="Введите Terminal Key"
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 font-bold text-white outline-none placeholder:text-white/35 focus:border-white/45"
                />
              </label>
              <label className="grid gap-2 text-sm font-black text-white/78">
                Пароль терминала
                <input
                  type="password"
                  value={tbankPassword}
                  onChange={(event) => setTbankPassword(event.target.value)}
                  placeholder={tbankSettings.has_password ? 'Пароль сохранён, можно оставить пустым' : 'Введите пароль терминала'}
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 font-bold text-white outline-none placeholder:text-white/35 focus:border-white/45"
                />
              </label>
            </div>
            <label className="grid gap-2 text-sm font-black text-white/78">
              API URL
              <input
                value={tbankSettings.api_url}
                onChange={(event) => updateTbankSettings({ api_url: event.target.value })}
                placeholder={DEFAULT_TBANK_API_URL}
                className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 font-bold text-white outline-none placeholder:text-white/35 focus:border-white/45"
              />
            </label>
            <div className="grid gap-3 md:grid-cols-3">
              <input
                value={tbankSettings.success_url}
                onChange={(event) => updateTbankSettings({ success_url: event.target.value })}
                placeholder="Success URL, можно пустым"
                className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 font-bold text-white outline-none placeholder:text-white/35 focus:border-white/45"
              />
              <input
                value={tbankSettings.fail_url}
                onChange={(event) => updateTbankSettings({ fail_url: event.target.value })}
                placeholder="Fail URL, можно пустым"
                className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 font-bold text-white outline-none placeholder:text-white/35 focus:border-white/45"
              />
              <input
                value={tbankSettings.notification_url}
                onChange={(event) => updateTbankSettings({ notification_url: event.target.value })}
                placeholder="Notification URL, можно пустым"
                className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 font-bold text-white outline-none placeholder:text-white/35 focus:border-white/45"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/10 p-3">
              <p className="text-sm font-bold text-white/70">
                {tbankSettings.is_active ? 'Эквайринг включён' : 'Эквайринг выключен'} · пароль {tbankSettings.has_password ? 'сохранён' : 'не сохранён'}
              </p>
              <button
                onClick={saveTbankSettings}
                disabled={tbankSaving}
                className="inline-flex items-center rounded-2xl bg-[#F8F3EC] px-5 py-3 font-black text-[#385144] disabled:opacity-60"
              >
                <Save className="mr-2 h-4 w-4" />
                {tbankSaving ? 'Сохраняю...' : 'Сохранить Т-Банк'}
              </button>
            </div>
          </div>
        )}
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
