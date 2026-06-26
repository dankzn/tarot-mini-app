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
};

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

export const ServicesManager = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<ServiceFormData>(emptyFormData);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    await supabase.rpc('apply_due_service_price_changes');

    const { data, error } = await supabase
      .from('services')
      .select('*')
      .order('price', { ascending: true });

    if (error) {
      console.error('Ошибка загрузки услуг:', error);
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

    if (editingId) {
      const updateData = {
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

      console.log('Обновляем услугу ID:', editingId);
      console.log('Данные для обновления:', updateData);

      const { data, error } = await supabase
        .from('services')
        .update(updateData)
        .eq('id', editingId)
        .select();

      if (error) {
        console.error('❌ Ошибка обновления услуги:', error);
        alert('Ошибка при обновлении: ' + error.message);
        return;
      }

      console.log('✅ Услуга обновлена:', data);
    } else {
      const insertData = {
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

      console.log('Создаем новую услугу:', insertData);

      const { data, error } = await supabase
        .from('services')
        .insert([insertData])
        .select();

      if (error) {
        console.error('❌ Ошибка создания услуги:', error);
        alert('Ошибка при создании: ' + error.message);
        return;
      }

      console.log('✅ Услуга создана:', data);
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
                <h3 className="font-bold text-lg text-[#385144]">{service.title}</h3>
                <p className="text-gray-600 text-sm mt-1">{service.description}</p>
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
