import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface BookingFormProps {
  user: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export const BookingForm = ({ user, onSuccess, onCancel }: BookingFormProps) => {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    service_id: '',
    scheduled_at: '',
    notes: '',
  });

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    const { data } = await supabase
      .from('services')
      .select('*')
      .order('price');
    
    if (data) setServices(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const selectedService = services.find(s => s.id === formData.service_id);
      
      const { error } = await supabase
        .from('consultations')
        .insert([
          {
            user_id: user.id,
            service_id: formData.service_id,
            scheduled_at: formData.scheduled_at,
            notes: formData.notes,
            price: selectedService?.price || 0,
            status: 'pending',
          }
        ]);

      if (error) throw error;

      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
      onSuccess();
    } catch (error: any) {
      alert('Ошибка: ' + error.message);
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a0b2e] to-[#2d1b4e] p-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">📝 Запись на консультацию</h2>
        <button onClick={onCancel} className="text-purple-300">✕</button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-purple-200 text-sm mb-1 block">Выберите услугу *</label>
          <select
            required
            className="w-full p-3 bg-white/10 border border-purple-500/30 rounded-lg text-white focus:outline-none focus:border-purple-400"
            value={formData.service_id}
            onChange={(e) => setFormData({ ...formData, service_id: e.target.value })}
          >
            <option value="" className="bg-purple-900">Выберите услугу...</option>
            {services.map((service) => (
              <option key={service.id} value={service.id} className="bg-purple-900">
                {service.title} - {service.price} ₽
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-purple-200 text-sm mb-1 block">Желаемая дата и время *</label>
          <input
            required
            type="datetime-local"
            className="w-full p-3 bg-white/10 border border-purple-500/30 rounded-lg text-white focus:outline-none focus:border-purple-400"
            value={formData.scheduled_at}
            onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
          />
        </div>

        <div>
          <label className="text-purple-200 text-sm mb-1 block">Комментарий</label>
          <textarea
            rows={4}
            className="w-full p-3 bg-white/10 border border-purple-500/30 rounded-lg text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-400"
            placeholder="Расскажите кратко о вашем вопросе..."
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-white/10 text-white p-4 rounded-lg font-bold hover:bg-white/20 transition"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-gradient-to-r from-purple-600 to-purple-800 text-white p-4 rounded-lg font-bold hover:from-purple-700 hover:to-purple-900 transition disabled:opacity-50"
          >
            {loading ? 'Отправка...' : 'Записаться'}
          </button>
        </div>
      </form>
    </div>
  );
};