import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const emptyForm = {
  code: '',
  title: '',
  discount_type: 'fixed',
  discount_value: 0,
  starts_at: '',
  expires_at: '',
  max_uses: 1,
};

const fromDateTimeLocal = (value: string) => (
  value ? new Date(value).toISOString() : null
);

export const PromoCodesManager = () => {
  const [promoCodes, setPromoCodes] = useState<any[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPromoCodes();
  }, []);

  const loadPromoCodes = async () => {
    const { data, error } = await supabase
      .from('promo_codes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Не удалось загрузить промокоды:', error);
      return;
    }

    const { data: redemptionsData } = await supabase
      .from('promo_code_redemptions')
      .select('promo_code_id');

    const usedCountByPromo = (redemptionsData || []).reduce((acc: Record<string, number>, redemption: any) => {
      acc[redemption.promo_code_id] = (acc[redemption.promo_code_id] || 0) + 1;
      return acc;
    }, {});

    setPromoCodes((data || []).map((promoCode: any) => ({
      ...promoCode,
      used_count: usedCountByPromo[promoCode.id] || 0,
    })));
  };

  const createPromoCode = async () => {
    if (!form.code.trim() || !form.discount_value) {
      alert('Введите код и размер скидки');
      return;
    }

    setLoading(true);

    const { error } = await supabase
      .from('promo_codes')
      .insert([
        {
          code: form.code.trim().toUpperCase(),
          title: form.title.trim() || null,
          discount_type: form.discount_type,
          discount_value: Number(form.discount_value),
          starts_at: fromDateTimeLocal(form.starts_at),
          expires_at: fromDateTimeLocal(form.expires_at),
          max_uses: form.max_uses ? Number(form.max_uses) : null,
          is_active: true,
        },
      ]);

    setLoading(false);

    if (error) {
      alert('Ошибка: ' + error.message);
      return;
    }

    setForm(emptyForm);
    await loadPromoCodes();
  };

  const togglePromoCode = async (promoCode: any) => {
    const { error } = await supabase
      .from('promo_codes')
      .update({ is_active: !promoCode.is_active })
      .eq('id', promoCode.id);

    if (error) {
      alert('Ошибка: ' + error.message);
      return;
    }

    await loadPromoCodes();
  };

  const deletePromoCode = async (promoCodeId: string) => {
    if (!confirm('Удалить промокод?')) return;

    const { error } = await supabase
      .from('promo_codes')
      .delete()
      .eq('id', promoCodeId);

    if (error) {
      alert('Ошибка: ' + error.message);
      return;
    }

    await loadPromoCodes();
  };

  return (
    <div className="mt-8 rounded-[1.75rem] border border-white/80 bg-white/80 p-6 shadow-[0_16px_40px_rgba(56,81,68,0.08)]">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8A5A3F]/70">promo codes</p>
          <h2 className="text-2xl font-black text-[#385144]">Промокоды</h2>
          <p className="mt-1 text-sm text-[#6C756C]">Каждый клиент может использовать один промокод только один раз.</p>
        </div>
      </div>

      <div className="mb-5 grid gap-3 rounded-[1.25rem] bg-[#F8F5F2] p-4 md:grid-cols-6">
        <input
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 font-bold uppercase text-[#385144]"
          placeholder="Код"
          value={form.code}
          onChange={(event) => setForm({ ...form, code: event.target.value })}
        />
        <input
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-[#385144] md:col-span-2"
          placeholder="Название"
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
        />
        <select
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 font-bold text-[#385144]"
          value={form.discount_type}
          onChange={(event) => setForm({ ...form, discount_type: event.target.value })}
        >
          <option value="fixed">₽</option>
          <option value="percent">%</option>
        </select>
        <input
          type="number"
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 font-bold text-[#385144]"
          placeholder="Скидка"
          value={form.discount_value}
          onChange={(event) => setForm({ ...form, discount_value: Number(event.target.value) })}
        />
        <input
          type="number"
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 font-bold text-[#385144]"
          placeholder="Лимит"
          value={form.max_uses}
          onChange={(event) => setForm({ ...form, max_uses: Number(event.target.value) })}
        />
        <label className="md:col-span-2">
          <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.16em] text-[#8A5A3F]/70">
            Старт действия
          </span>
          <input
            type="datetime-local"
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-[#385144]"
            value={form.starts_at}
            onChange={(event) => setForm({ ...form, starts_at: event.target.value })}
          />
        </label>
        <label className="md:col-span-2">
          <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.16em] text-[#8A5A3F]/70">
            Конец действия
          </span>
          <input
            type="datetime-local"
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-[#385144]"
            value={form.expires_at}
            onChange={(event) => setForm({ ...form, expires_at: event.target.value })}
          />
        </label>
        <button
          onClick={createPromoCode}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-xl bg-[#385144] px-4 py-2 font-black text-white disabled:opacity-50 md:col-span-2"
        >
          <Plus className="mr-2 h-4 w-4" />
          Создать
        </button>
      </div>

      <div className="space-y-3">
        {promoCodes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#D8CFC4] p-5 text-sm font-bold text-[#6C756C]">
            Промокодов пока нет.
          </div>
        ) : promoCodes.map((promoCode) => (
          <div key={promoCode.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm">
            <div>
              <p className="font-black text-[#385144]">{promoCode.code}</p>
              <p className="text-sm text-[#6C756C]">
                {promoCode.title || 'Без названия'} • {promoCode.discount_value}{promoCode.discount_type === 'percent' ? '%' : ' ₽'}
                {promoCode.max_uses ? ` • использовано ${promoCode.used_count}/${promoCode.max_uses}` : ` • использовано ${promoCode.used_count}`}
              </p>
              <p className="mt-1 text-xs font-semibold text-[#8FA092]">
                {promoCode.starts_at ? `с ${new Date(promoCode.starts_at).toLocaleString('ru-RU')}` : 'без даты старта'}
                {' · '}
                {promoCode.expires_at ? `до ${new Date(promoCode.expires_at).toLocaleString('ru-RU')}` : 'без срока окончания'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => togglePromoCode(promoCode)}
                className={`rounded-full px-3 py-1 text-xs font-black ${
                  promoCode.is_active ? 'bg-[#EAF1EA] text-[#385144]' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {promoCode.is_active ? 'Активен' : 'Выключен'}
              </button>
              <button
                onClick={() => deletePromoCode(promoCode.id)}
                className="rounded-full bg-red-50 p-2 text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
