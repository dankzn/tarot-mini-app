import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Edit, Trash2, Save, X } from 'lucide-react';

interface Service {
  id: string;
  title: string;
  description: string;
  price: number;
  duration_minutes?: number;
}

export const ServicesManager = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: 0,
    duration_minutes: 60,
  });

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
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
    setFormData({ title: '', description: '', price: 0, duration_minutes: 60 });
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
    setFormData({ title: '', description: '', price: 0, duration_minutes: 60 });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-[#385144]">Услуги</h2>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
            setFormData({ title: '', description: '', price: 0, duration_minutes: 60 });
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
                className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-[#6B4EE6] focus:border-transparent"
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
                className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-[#6B4EE6] focus:border-transparent"
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
                  className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-[#6B4EE6] focus:border-transparent"
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
                  className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-[#6B4EE6] focus:border-transparent"
                  placeholder="60"
                />
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
        {services.map((service) => (
          <div 
            key={service.id} 
            className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex justify-between items-center"
          >
            <div className="flex-1">
              <h3 className="font-bold text-lg text-[#385144]">{service.title}</h3>
              <p className="text-gray-600 text-sm mt-1">{service.description}</p>
              <div className="flex gap-4 mt-2 text-sm">
                <span className="text-[#D4AF37] font-bold">{service.price} ₽</span>
                <span className="text-gray-500">{service.duration_minutes} мин</span>
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
        ))}
        
        {services.length === 0 && (
          <div className="bg-gray-50 p-8 rounded-xl text-center text-gray-500">
            Нет добавленных услуг. Нажмите "Добавить услугу" чтобы создать первую.
          </div>
        )}
      </div>
    </div>
  );
};