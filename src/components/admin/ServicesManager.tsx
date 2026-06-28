import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Edit, Trash2, Save, X } from 'lucide-react';
import { formatCountdown, getServicePriceState } from '../../lib/serviceCampaigns';

interface Service {
  id: string;
  title: string;
  description: string;
  price: number;
  duration_minutes?: number;
  next_price?: number | null;
  price_increase_at?: string | null;
  promo_title?: string | null;
  promo_price?: number | null;
  promo_starts_at?: string | null;
  promo_ends_at?: string | null;
  category_id?: string | null;
  display_badge?: string | null;
  request_tags?: string[] | null;
  short_description?: string | null;
  sort_order?: number | null;
}

interface ServiceFormData {
  title: string;
  description: string;
  price: number;
  duration_minutes: number;
  next_price: number;
  price_increase_at: string;
  promo_title: string;
  promo_price: number;
  promo_starts_at: string;
  promo_ends_at: string;
  category_id: string;
  display_badge: string;
  request_tags: string;
  short_description: string;
  sort_order: number;
}

const emptyFormData: ServiceFormData = {
  title: '',
  description: '',
  price: 0,
  duration_minutes: 60,
  next_price: 0,
  price_increase_at: '',
  promo_title: '',
  promo_price: 0,
  promo_starts_at: '',
  promo_ends_at: '',
  category_id: '',
  display_badge: '',
  request_tags: '',
  short_description: '',
  sort_order: 0,
};

const SERVICE_CATEGORIES = [
  { id: '', label: 'Автоопределение' },
  { id: 'quick', label: 'Быстрый ориентир' },
  { id: 'relationships', label: 'Отношения и чувства' },
  { id: 'deep', label: 'Расклады и разборы' },
  { id: 'support', label: 'Сопровождение' },
  { id: 'other', label: 'Индивидуальные форматы' },
];

const SERVICE_BADGES = [
  '',
  'Новый формат',
  'Мягкий вход',
  'Для сложного запроса',
  'Глубокий разбор',
  'Индивидуально',
  'Популярно',
  'Для отношений',
];

const parseTags = (value: string) => (
  value
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean)
);

const toDateTimeLocal = (value?: string | null) => {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const fromDateTimeLocal = (value: string) => {
  return value ? new Date(value).toISOString() : null;
};

const getDateTimeLocalDaysFromNow = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setMinutes(0, 0, 0);

  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const buildServicePayload = (formData: ServiceFormData, includeDisplayControls = true) => {
  const basePayload = {
    title: formData.title,
    description: formData.description,
    price: formData.price,
    duration_minutes: formData.duration_minutes,
    next_price: formData.next_price || null,
    price_increase_at: fromDateTimeLocal(formData.price_increase_at),
    promo_title: formData.promo_title || null,
    promo_price: formData.promo_price || null,
    promo_starts_at: fromDateTimeLocal(formData.promo_starts_at),
    promo_ends_at: fromDateTimeLocal(formData.promo_ends_at),
  };

  if (!includeDisplayControls) {
    return basePayload;
  }

  return {
    ...basePayload,
    category_id: formData.category_id || null,
    display_badge: formData.display_badge || null,
    request_tags: parseTags(formData.request_tags),
    short_description: formData.short_description || null,
    sort_order: formData.sort_order || 0,
  };
};

const saveServiceThroughApi = async ({
  action,
  id,
  payload,
}: {
  action: 'insert' | 'update';
  id?: string;
  payload: Record<string, any>;
}) => {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  if (!token) {
    throw new Error('Админ-сессия не найдена. Перезайдите в админку.');
  }

  const response = await fetch('/api/admin/services', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action, id, payload }),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok || !body?.ok) {
    throw new Error(body?.error || 'Не удалось сохранить услугу через сервер');
  }

  return body;
};

export const ServicesManager = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<ServiceFormData>(emptyFormData);
  const [loadWarning, setLoadWarning] = useState('');

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    setLoadWarning('');

    const { error: priceApplyError } = await supabase.rpc('apply_due_service_price_changes');
    if (priceApplyError) {
      console.warn('Не удалось применить плановые изменения цен:', priceApplyError);
    }

    const orderedRequest = await supabase
      .from('services')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('price', { ascending: true });

    let data = orderedRequest.data;
    let error = orderedRequest.error;

    if (error) {
      console.warn('Не удалось загрузить услуги с сортировкой витрины, пробуем базовую загрузку:', error);

      const fallbackRequest = await supabase
        .from('services')
        .select('*')
        .order('price', { ascending: true });

      data = fallbackRequest.data;
      error = fallbackRequest.error;

      if (!error) {
        setLoadWarning('Услуги загружены в базовом режиме. Чтобы сохранять категории, бейджи и порядок, примените миграцию 20260628_service_control_and_client_notes.sql.');
      }
    }

    if (error) {
      console.error('Ошибка загрузки услуг:', error);
      setLoadWarning(`Не удалось загрузить услуги: ${error.message}`);
      return;
    }

    if (data) {
      setServices(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log('📝 Сохранение услуги:', editingId ? 'UPDATE' : 'INSERT');
    console.log('Данные формы:', formData);

    try {
    if (editingId) {
      const updateData = buildServicePayload(formData);

      console.log('Обновляем услугу ID:', editingId);
      console.log('Данные для обновления:', updateData);

      let data = null;
      let error = null;

      try {
        const result = await supabase
          .from('services')
          .update(updateData)
          .eq('id', editingId)
          .select();

        data = result.data;
        error = result.error;
      } catch (directError) {
        console.warn('Браузерное сохранение услуги недоступно, пробуем серверный API:', directError);
        const apiResult = await saveServiceThroughApi({ action: 'update', id: editingId, payload: updateData });
        data = apiResult.data;
        error = null;

        if (apiResult.mode === 'base') {
          setLoadWarning('Базовые поля услуги сохранены. Для категорий, бейджей и сортировки примените миграцию 20260628_service_control_and_client_notes.sql.');
        }
      }

      if (error) {
        console.warn('Не удалось сохранить расширенные поля услуги, пробуем базовое сохранение:', error);

        try {
          const fallbackResult = await supabase
            .from('services')
            .update(buildServicePayload(formData, false))
            .eq('id', editingId)
            .select();

          data = fallbackResult.data;
          error = fallbackResult.error;
        } catch (fallbackError) {
          console.warn('Базовое браузерное сохранение недоступно, пробуем серверный API:', fallbackError);
          const apiResult = await saveServiceThroughApi({
            action: 'update',
            id: editingId,
            payload: buildServicePayload(formData, false),
          });

          data = apiResult.data;
          error = null;
        }

        if (error) {
          console.error('❌ Ошибка обновления услуги:', error);
          alert('Ошибка при обновлении: ' + error.message);
          return;
        }

        setLoadWarning('Базовые поля услуги сохранены. Для категорий, бейджей и сортировки примените миграцию 20260628_service_control_and_client_notes.sql.');
      }

      console.log('✅ Услуга обновлена:', data);
    } else {
      const insertData = buildServicePayload(formData);

      console.log('Создаем новую услугу:', insertData);

      let data = null;
      let error = null;

      try {
        const result = await supabase
          .from('services')
          .insert([insertData])
          .select();

        data = result.data;
        error = result.error;
      } catch (directError) {
        console.warn('Браузерное создание услуги недоступно, пробуем серверный API:', directError);
        const apiResult = await saveServiceThroughApi({ action: 'insert', payload: insertData });
        data = apiResult.data;
        error = null;

        if (apiResult.mode === 'base') {
          setLoadWarning('Услуга создана в базовом режиме. Для категорий, бейджей и сортировки примените миграцию 20260628_service_control_and_client_notes.sql.');
        }
      }

      if (error) {
        console.warn('Не удалось создать услугу с расширенными полями, пробуем базовое создание:', error);

        try {
          const fallbackResult = await supabase
            .from('services')
            .insert([buildServicePayload(formData, false)])
            .select();

          data = fallbackResult.data;
          error = fallbackResult.error;
        } catch (fallbackError) {
          console.warn('Базовое браузерное создание недоступно, пробуем серверный API:', fallbackError);
          const apiResult = await saveServiceThroughApi({
            action: 'insert',
            payload: buildServicePayload(formData, false),
          });

          data = apiResult.data;
          error = null;
        }

        if (error) {
          console.error('❌ Ошибка создания услуги:', error);
          alert('Ошибка при создании: ' + error.message);
          return;
        }

        setLoadWarning('Услуга создана в базовом режиме. Для категорий, бейджей и сортировки примените миграцию 20260628_service_control_and_client_notes.sql.');
      }

      console.log('✅ Услуга создана:', data);
    }
    } catch (error) {
      console.error('❌ Ошибка сохранения услуги:', error);
      alert(`Ошибка при ${editingId ? 'обновлении' : 'создании'}: ${error instanceof Error ? error.message : 'не удалось сохранить услугу'}`);
      return;
    }

    setShowForm(false);
    setEditingId(null);
    setFormData(emptyFormData);
    await loadServices();
    console.log('🔄 Список услуг обновлен');
  };

  const handleEdit = (service: Service) => {
    console.log('✏️ Редактирование услуги:', service);

    setEditingId(service.id);
    setFormData({
      title: service.title || '',
      description: service.description || '',
      price: service.price || 0,
      duration_minutes: service.duration_minutes || 60,
      next_price: service.next_price || 0,
      price_increase_at: toDateTimeLocal(service.price_increase_at),
      promo_title: service.promo_title || '',
      promo_price: service.promo_price || 0,
      promo_starts_at: toDateTimeLocal(service.promo_starts_at),
      promo_ends_at: toDateTimeLocal(service.promo_ends_at),
      category_id: service.category_id || '',
      display_badge: service.display_badge || '',
      request_tags: (service.request_tags || []).join(', '),
      short_description: service.short_description || '',
      sort_order: service.sort_order || 0,
    });
    setShowForm(true);

    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Удалить услугу?')) {
      const { error } = await supabase.from('services').delete().eq('id', id);
      if (error) {
        console.error('Ошибка удаления:', error);
        alert('Ошибка при удалении: ' + error.message);
        return;
      }
      loadServices();
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData(emptyFormData);
  };

  const applyPromoPreset = (days = 3) => {
    const promoPrice = formData.price > 0 ? Math.max(Math.round(formData.price * 0.85), 1) : 0;

    setFormData({
      ...formData,
      promo_title: formData.promo_title || 'Специальное окно',
      promo_price: formData.promo_price || promoPrice,
      promo_starts_at: formData.promo_starts_at || getDateTimeLocalDaysFromNow(0),
      promo_ends_at: getDateTimeLocalDaysFromNow(days),
    });
  };

  const applyPriceIncreasePreset = (days = 7) => {
    const nextPrice = formData.price > 0 ? Math.ceil((formData.price * 1.15) / 50) * 50 : 0;

    setFormData({
      ...formData,
      next_price: formData.next_price || nextPrice,
      price_increase_at: getDateTimeLocalDaysFromNow(days),
    });
  };

  const activePromosCount = services.filter(service => getServicePriceState(service).isPromoActive).length;
  const scheduledIncreasesCount = services.filter((service) => {
    const priceState = getServicePriceState(service);
    return Boolean(priceState.nextPrice && priceState.countdownTarget);
  }).length;
  const campaignServices = services
    .map(service => ({
      service,
      priceState: getServicePriceState(service),
    }))
    .filter(({ priceState }) => priceState.isPromoActive || Boolean(priceState.nextPrice && priceState.countdownTarget))
    .slice(0, 4);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-[#385144]">Услуги</h2>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
            setFormData(emptyFormData);
          }}
          className="bg-[#385144] text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#2d4238] transition"
        >
          <Plus className="w-4 h-4" />
          Добавить услугу
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-[#385144]/10 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-400">Всего услуг</p>
          <p className="mt-2 text-3xl font-black text-[#385144]">{services.length}</p>
        </div>
        <div className="rounded-2xl border border-[#B8795C]/20 bg-[#FFF9F0] p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#B8795C]/70">Акции сейчас</p>
          <p className="mt-2 text-3xl font-black text-[#B8795C]">{activePromosCount}</p>
        </div>
        <div className="rounded-2xl border border-[#385144]/10 bg-[#F8F5F2] p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-400">Повышения цен</p>
          <p className="mt-2 text-3xl font-black text-[#385144]">{scheduledIncreasesCount}</p>
        </div>
      </div>

      {loadWarning && (
        <div className="rounded-2xl border border-[#B8795C]/25 bg-[#FFF9F0] p-4 text-sm font-semibold leading-relaxed text-[#8A5A3F]">
          {loadWarning}
        </div>
      )}

      <div className="rounded-[1.5rem] border border-[#B8795C]/20 bg-[#FFF9F0] p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#B8795C]/70">promo center</p>
            <h3 className="text-xl font-black text-[#385144]">Сейчас действует</h3>
          </div>
          <p className="text-sm font-semibold text-[#6C756C]">
            Акции и будущие повышения видны клиентам как таймеры.
          </p>
        </div>

        {campaignServices.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {campaignServices.map(({ service, priceState }) => {
              const countdown = formatCountdown(priceState.countdownTarget);
              const isPromo = priceState.isPromoActive;

              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => handleEdit(service)}
                  className="rounded-[1.25rem] border border-white/80 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${
                      isPromo ? 'bg-[#B8795C] text-white' : 'bg-[#EAF1EA] text-[#385144]'
                    }`}>
                      {isPromo ? 'Акция' : 'Повышение цены'}
                    </span>
                    {countdown && (
                      <span className="rounded-full bg-[#F8F5F2] px-3 py-1 text-xs font-black text-[#385144]">
                        {countdown}
                      </span>
                    )}
                  </div>
                  <p className="font-black text-[#385144]">{service.title}</p>
                  <p className="mt-1 text-sm font-semibold text-[#6C756C]">
                    {isPromo
                      ? `${priceState.basePrice} ₽ → ${priceState.currentPrice} ₽`
                      : `${priceState.basePrice} ₽ → ${priceState.nextPrice} ₽`}
                  </p>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[1.25rem] border border-dashed border-[#B8795C]/30 bg-white/65 p-5 text-sm font-semibold text-[#6C756C]">
            Активных акций нет. Можно открыть любую услугу и включить акцию или запланировать повышение цены.
          </div>
        )}
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-bold text-[#385144] mb-4">
            {editingId ? 'Редактировать услугу' : 'Новая услуга'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Название
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-[#385144] focus:border-transparent"
                placeholder="Например: Расклад Таро"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Описание
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-[#385144] focus:border-transparent"
                rows={3}
                placeholder="Описание услуги..."
              />
            </div>

            <div className="rounded-2xl border border-[#385144]/10 bg-[#F8F5F2] p-4">
              <h4 className="mb-3 font-bold text-[#385144]">Витрина и смысл услуги</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Категория
                  </label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({...formData, category_id: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-[#385144] focus:border-transparent"
                  >
                    {SERVICE_CATEGORIES.map(category => (
                      <option key={category.id} value={category.id}>{category.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Бейдж в карточке
                  </label>
                  <input
                    list="service-badges"
                    value={formData.display_badge}
                    onChange={(e) => setFormData({...formData, display_badge: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-[#385144] focus:border-transparent"
                    placeholder="Например: Для сложного запроса"
                  />
                  <datalist id="service-badges">
                    {SERVICE_BADGES.map(badge => (
                      <option key={badge || 'empty'} value={badge} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Привязка к запросам
                  </label>
                  <input
                    value={formData.request_tags}
                    onChange={(e) => setFormData({...formData, request_tags: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-[#385144] focus:border-transparent"
                    placeholder="отношения, выбор, ресурс"
                  />
                  <p className="mt-1 text-xs text-gray-500">Через запятую — потом можно использовать для умного подбора.</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Порядок в списке
                  </label>
                  <input
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) => setFormData({...formData, sort_order: parseInt(e.target.value) || 0})}
                    className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-[#385144] focus:border-transparent"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Короткое описание для карточки
                  </label>
                  <textarea
                    value={formData.short_description}
                    onChange={(e) => setFormData({...formData, short_description: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-[#385144] focus:border-transparent"
                    rows={2}
                    placeholder="Короткая версия, чтобы карточка не перегружалась..."
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Цена (₽)
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({...formData, price: parseInt(e.target.value) || 0})}
                  className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-[#385144] focus:border-transparent"
                  placeholder="1000"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Длительность (мин)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.duration_minutes}
                  onChange={(e) => setFormData({...formData, duration_minutes: parseInt(e.target.value) || 0})}
                  className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-[#385144] focus:border-transparent"
                  placeholder="60"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-[#385144]/10 bg-[#F8F5F2] p-4">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h4 className="font-bold text-[#385144]">План повышения цены</h4>
                  <p className="text-sm text-gray-500">
                    В указанную дату цена тихо станет новой. У клиентов появится таймер.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, next_price: 0, price_increase_at: '' })}
                  className="text-xs font-bold text-gray-500 hover:text-[#385144]"
                >
                  Очистить
                </button>
              </div>
              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => applyPriceIncreasePreset(7)}
                  className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#385144] shadow-sm hover:bg-[#EAF1EA]"
                >
                  +15% через 7 дней
                </button>
                <button
                  type="button"
                  onClick={() => applyPriceIncreasePreset(14)}
                  className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#385144] shadow-sm hover:bg-[#EAF1EA]"
                >
                  +15% через 14 дней
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Новая цена (₽)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.next_price}
                    onChange={(e) => setFormData({...formData, next_price: parseInt(e.target.value) || 0})}
                    className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-[#385144] focus:border-transparent"
                    placeholder="Например: 3500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Дата и время повышения
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.price_increase_at}
                    onChange={(e) => setFormData({...formData, price_increase_at: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-[#385144] focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#B8795C]/20 bg-[#FFF9F0] p-4">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h4 className="font-bold text-[#385144]">Акция</h4>
                  <p className="text-sm text-gray-500">
                    Акционная цена действует между датами. На клиентской стороне будет таймер до конца.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({
                    ...formData,
                    promo_title: '',
                    promo_price: 0,
                    promo_starts_at: '',
                    promo_ends_at: '',
                  })}
                  className="text-xs font-bold text-gray-500 hover:text-[#385144]"
                >
                  Очистить
                </button>
              </div>
              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => applyPromoPreset(3)}
                  className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#B8795C] shadow-sm hover:bg-[#FFF1E8]"
                >
                  Акция -15% на 3 дня
                </button>
                <button
                  type="button"
                  onClick={() => applyPromoPreset(7)}
                  className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#B8795C] shadow-sm hover:bg-[#FFF1E8]"
                >
                  Акция -15% на неделю
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Название акции
                  </label>
                  <input
                    type="text"
                    value={formData.promo_title}
                    onChange={(e) => setFormData({...formData, promo_title: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-[#385144] focus:border-transparent"
                    placeholder="Например: Летний период"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Акционная цена (₽)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.promo_price}
                    onChange={(e) => setFormData({...formData, promo_price: parseInt(e.target.value) || 0})}
                    className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-[#385144] focus:border-transparent"
                    placeholder="Например: 2500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Старт акции
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.promo_starts_at}
                    onChange={(e) => setFormData({...formData, promo_starts_at: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-[#385144] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Конец акции
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.promo_ends_at}
                    onChange={(e) => setFormData({...formData, promo_ends_at: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-[#385144] focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-green-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-600 transition"
              >
                <Save className="w-4 h-4" />
                {editingId ? 'Сохранить' : 'Создать'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-400 transition"
              >
                <X className="w-4 h-4" />
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-3">
        {services.map((service) => {
          const priceState = getServicePriceState(service);
          const countdown = formatCountdown(priceState.countdownTarget);

          return (
            <div
              key={service.id}
              className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex justify-between items-center"
            >
              <div className="flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-lg text-[#385144]">{service.title}</h3>
                  {service.category_id && (
                    <span className="rounded-full bg-[#EAF1EA] px-2 py-0.5 text-xs font-bold text-[#385144]">
                      {SERVICE_CATEGORIES.find(category => category.id === service.category_id)?.label || service.category_id}
                    </span>
                  )}
                  {service.display_badge && (
                    <span className="rounded-full bg-[#FFF1E8] px-2 py-0.5 text-xs font-bold text-[#B8795C]">
                      {service.display_badge}
                    </span>
                  )}
                </div>
                <p className="text-gray-600 text-sm mt-1">{service.short_description || service.description}</p>
                <div className="flex flex-wrap gap-3 mt-2 text-sm">
                  {priceState.currentPrice !== priceState.basePrice ? (
                    <span className="font-bold text-[#B8795C]">
                      {priceState.currentPrice} ₽ <span className="text-gray-400 line-through">{priceState.basePrice} ₽</span>
                    </span>
                  ) : (
                    <span className="text-[#8A5A3F] font-bold">{service.price} ₽</span>
                  )}
                  <span className="text-gray-500">{service.duration_minutes} мин</span>
                  {countdown && (
                    <span className="rounded-full bg-[#385144]/10 px-2 py-0.5 text-xs font-bold text-[#385144]">
                      {priceState.countdownLabel}: {countdown}
                    </span>
                  )}
                  {priceState.nextPrice && !countdown && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-500">
                      Новая цена: {priceState.nextPrice} ₽
                    </span>
                  )}
                  {(service.request_tags || []).map(tag => (
                    <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-500">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(service)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                  title="Редактировать"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(service.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                  title="Удалить"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}

        {services.length === 0 && (
          <div className="bg-gray-50 p-8 rounded-xl text-center text-gray-500">
            Нет добавленных услуг. Нажмите "Добавить услугу" чтобы создать первую.
          </div>
        )}
      </div>
    </div>
  );
};
