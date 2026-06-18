import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Edit, Save, X, Users } from 'lucide-react';

interface User {
  id: string;
  telegram_id: number;
  name: string;
  username?: string;
  gender?: string;
  status?: string;
  referred_by?: number;
}

export const ClientsManager = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    gender: 'other',
    referred_by: '',
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) setUsers(data);
  };

  const handleEdit = (user: User) => {
    setEditingId(user.id);
    setFormData({
      username: user.username || '',
      gender: user.gender || 'other',
      referred_by: user.referred_by?.toString() || '',
    });
  };

  const handleSave = async () => {
    if (!editingId) return;
    
    const updateData: any = {
      username: formData.username || null,
      gender: formData.gender,
    };
    
    if (formData.referred_by) {
      updateData.referred_by = parseInt(formData.referred_by);
    } else {
      updateData.referred_by = null;
    }
    
    await supabase
      .from('users')
      .update(updateData)
      .eq('id', editingId);
    
    setEditingId(null);
    loadUsers();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-6">
        <Users className="w-6 h-6 text-[#385144]" />
        <h2 className="text-2xl font-bold text-[#385144]">Клиенты</h2>
      </div>

      <div className="space-y-3">
        {users.map((user) => (
          <div key={user.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            {editingId === user.id ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Username</label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({...formData, username: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded text-sm"
                      placeholder="@username"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Пол</label>
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({...formData, gender: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded text-sm"
                    >
                      <option value="male">Мужской</option>
                      <option value="female">Женский</option>
                      <option value="other">Не указан</option>
                    </select>
                  </div>
                  
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-600 mb-1">Реферер (telegram_id)</label>
                    <input
                      type="text"
                      value={formData.referred_by}
                      onChange={(e) => setFormData({...formData, referred_by: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded text-sm"
                      placeholder="Оставьте пустым если нет"
                    />
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    className="bg-green-500 text-white px-3 py-1 rounded text-sm flex items-center gap-1"
                  >
                    <Save className="w-3 h-3" />
                    Сохранить
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-bold text-[#385144]">{user.name}</div>
                  <div className="text-sm text-gray-500">
                    @{user.username || 'не указан'} • {user.gender === 'male' ? 'М' : user.gender === 'female' ? 'Ж' : '—'}
                    {user.referred_by && ` • Реферер: ${user.referred_by}`}
                  </div>
                </div>
                <button
                  onClick={() => handleEdit(user)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                >
                  <Edit className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};