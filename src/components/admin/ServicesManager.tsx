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
    const { data } = await supabase
      .from('services')
      .select('*')
      .order('price', { ascending: true });
    
    if (data) setServices(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingId) {
      await supabase
        .from('services')
        .update(formData)
        .eq('id', editingId);
    } else {
      await supabase
        .from('services')
        .insert([formData]);
    }
    
    setShowForm(false);
    setEditingId(null);
    setFormData({ title: '', description: '', price: 0, duration_minutes: 60 });
    loadServices();
  };

  const handleEdit = (service: Service) => {
    setEditingId(service.id);
    setFormData({
      title: service.title,
      description: service.description,
      price: service.price,
      duration_minutes: service.duration_minutes || 60,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Удалить услугу?')) {
      await supabase.from('services').delete().eq('id', id);
      loadServices();
    }
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
          className="bg-[#385144] text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#2d4238]"
        >
          <Plus className="w-4 h-4" />
          Добавить услугу
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Название</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                className="w-full p-3 border border-gray-300 rounded-lg"
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Описание</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full p-3 border border-gray-300 rounded-lg"
                rows={3}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Цена (₽)</label>
                <input
                  type="number"
                  required
                  value={formData.price}
                  onChange={(e) => setFormData({...formData, price: parseInt(e.target.value)})}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Длительность (мин)</label>
                <input
                  type="number"
                  value={formData.duration_minutes}
                  onChange={(e) => setFormData({...formData, duration_minutes: parseInt(e.target.value)})}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <button type="submit" className="bg-green-500 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                <Save className="w-4 h-4" />
                {editingId ? 'Сохранить' : 'Создать'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2"
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
          <div key={service.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex justify-between items-center">
            <div className="flex-1">
              <h3 className="font-bold text-lg text-[#385144]">{service.title}</h3>
              <p className="text-gray-600 text-sm">{service.description}</p>
              <div className="flex gap-4 mt-2 text-sm text-gray-500">
                <span className="text-[#D4AF37] font-bold">{service.price} ₽</span>
                <span>{service.duration_minutes} мин</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleEdit(service)}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(service.id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};