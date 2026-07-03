import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { 
  ListChecks, 
  Clock, 
  DollarSign, 
  Calendar, 
  User, 
  MapPin, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Edit3,
  Save,
  MessageSquare,
  Sparkles,
  Crown
} from 'lucide-react';
import { 
  notifyClientBonusUpdate,
  notifyClientPaymentRequired,
  notifyClientStatusChange,
  notifyClientTimeConfirmed,
  notifyClientTimeProposal
} from '../lib/notifications';
import { getBonusPercent, getConsultationCycleDate, getCurrentLoyaltyCycleStart, getNextLoyaltyStatus, isPersonalTarologistService } from '../lib/bonusLogic';

interface AdminConsultationsManagerProps {
  admin: any;
  onBack: () => void;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  confirmed: 'bg-blue-100 text-blue-800 border-blue-300',
  in_progress: 'bg-purple-100 text-purple-800 border-purple-300',
  awaiting_payment: 'bg-orange-100 text-orange-800 border-orange-300',
  completed: 'bg-green-100 text-green-800 border-green-300',
  cancelled: 'bg-red-100 text-red-800 border-red-300',
};

const statusLabels: Record<string, string> = {
  pending: 'Ожидает подтверждения',
  confirmed: 'Подтверждена',
  needs_admin_time: 'Нужно предложить время',
  awaiting_client_confirmation: 'Ждём ответ клиента',
  client_countered: 'Клиент предложил время',
  in_progress: 'В процессе',
  awaiting_payment: 'Ждёт оплату',
  completed: 'Завершена',
  cancelled: 'Отменена',
};

const manualSchedulingStatuses = new Set([
  'needs_admin_time',
  'awaiting_client_confirmation',
  'client_countered',
]);

const isManualScheduling = (consultation: any) => (
  manualSchedulingStatuses.has(consultation?.scheduling_status)
);

const parseAdminDateTime = (value: string) => {
  const normalized = value.trim().replace(' ', 'T');
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateTime = (value: string | null | undefined) => (
  value ? format(new Date(value), 'dd MMMM yyyy HH:mm', { locale: ru }) : 'Дата не указана'
);

export const AdminConsultationsManager = ({ onBack }: AdminConsultationsManagerProps) => {
  const [consultations, setConsultations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [showCompleteForm, setShowCompleteForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedConsultation, setSelectedConsultation] = useState<any>(null);
  const [completeData, setCompleteData] = useState({
    admin_notes: '',
    new_price: 0,
  });
  const [editData, setEditData] = useState({
    admin_notes: '',
    price: 0,
    status: '',
  });

  useEffect(() => {
    loadConsultations();
  }, []);

  const loadConsultations = async () => {
    console.log('🔍 Загрузка консультаций...');
    
    const { data: consultationsData } = await supabase
      .from('consultations')
      .select('*')
      .order('scheduled_at', { ascending: false });

    const { data: usersData } = await supabase
      .from('users')
      .select('id, name, telegram_id, city, status, bonus_balance, personal_tarologist_until');

    const { data: servicesData } = await supabase
      .from('services')
      .select('id, title, price');

    const enrichedConsultations = (consultationsData || []).map(c => ({
      ...c,
      users: usersData?.find(u => u.id === c.user_id) || null,
      services: servicesData?.find(s => s.id === c.service_id) || null,
    }));

    console.log('✅ Загружено записей:', enrichedConsultations.length);
    setConsultations(enrichedConsultations);
    setLoading(false);
  };

  const updateConsultationStatus = async (consultationId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('consultations')
        .update({
          status: newStatus,
          ...(newStatus === 'confirmed' ? { scheduling_status: 'confirmed' } : {}),
        })
        .eq('id', consultationId);

      if (error) throw error;
      
      await loadConsultations();
      alert('Статус обновлён!');
    } catch (error: any) {
      alert('Ошибка: ' + error.message);
    }
  };

  const proposeTime = async (consultation: any, suggestedValue = '') => {
    const value = window.prompt(
      'Введите дату и время в формате YYYY-MM-DD HH:mm',
      suggestedValue
    );
    if (!value) return;

    const proposedDate = parseAdminDateTime(value);
    if (!proposedDate) {
      alert('Не получилось распознать дату. Пример: 2026-07-05 19:30');
      return;
    }

    const { error } = await supabase
      .from('consultations')
      .update({
        scheduled_at: proposedDate.toISOString(),
        proposed_at: proposedDate.toISOString(),
        scheduling_status: 'awaiting_client_confirmation',
        client_time_counterproposal: null,
      })
      .eq('id', consultation.id);

    if (error) {
      alert('Ошибка: ' + error.message);
      return;
    }

    if (consultation.users?.telegram_id) {
      await notifyClientTimeProposal(
        consultation.users.telegram_id,
        consultation.services?.title || 'Консультация',
        format(proposedDate, 'dd MMMM yyyy HH:mm', { locale: ru })
      );
    }

    await loadConsultations();
    alert('✅ Время предложено клиенту');
  };

  const rejectClientCounter = async (consultation: any) => {
    const { error } = await supabase
      .from('consultations')
      .update({
        scheduling_status: 'needs_admin_time',
        client_time_counterproposal: null,
      })
      .eq('id', consultation.id);

    if (error) {
      alert('Ошибка: ' + error.message);
      return;
    }

    await loadConsultations();
    alert('Предложение клиента отклонено. Можно предложить новое время.');
  };

  const confirmClientCounter = async (consultation: any) => {
    const value = window.prompt(
      'Подтвердите дату и время для записи в формате YYYY-MM-DD HH:mm',
      consultation.client_time_counterproposal || ''
    );
    if (!value) return;

    const confirmedDate = parseAdminDateTime(value);
    if (!confirmedDate) {
      alert('Не получилось распознать дату. Пример: 2026-07-05 19:30');
      return;
    }

    const { error } = await supabase
      .from('consultations')
      .update({
        scheduled_at: confirmedDate.toISOString(),
        proposed_at: confirmedDate.toISOString(),
        status: 'confirmed',
        scheduling_status: 'confirmed',
        client_time_counterproposal: null,
      })
      .eq('id', consultation.id);

    if (error) {
      alert('Ошибка: ' + error.message);
      return;
    }

    if (consultation.users?.telegram_id) {
      await notifyClientTimeConfirmed(
        consultation.users.telegram_id,
        consultation.services?.title || 'Консультация',
        format(confirmedDate, 'dd MMMM yyyy HH:mm', { locale: ru })
      );
    }

    await loadConsultations();
    alert('✅ Время клиента подтверждено');
  };

  const openCompleteForm = (consultation: any) => {
    setSelectedConsultation(consultation);
    setCompleteData({
      admin_notes: consultation.admin_notes || '',
      new_price: consultation.price || consultation.services?.price || 0,
    });
    setShowCompleteForm(true);
  };

  const openEditForm = (consultation: any) => {
    setSelectedConsultation(consultation);
    setEditData({
      admin_notes: consultation.admin_notes || '',
      price: consultation.price || 0,
      status: consultation.status,
    });
    setShowEditForm(true);
  };

  const handleCompleteConsultation = async () => {
  if (!selectedConsultation) return;

  try {
    const finalPrice = completeData.new_price;

    const { error: consultError } = await supabase
      .from('consultations')
      .update({
        status: 'awaiting_payment',
        completed_at: new Date().toISOString(),
        admin_notes: completeData.admin_notes,
        price: finalPrice,
        payment_amount: finalPrice,
        payment_status: 'payment_requested',
        bonus_paid: 0,
      })
      .eq('id', selectedConsultation.id);

    if (consultError) {
      console.error('❌ Ошибка консультации:', consultError);
      throw consultError;
    }

    const clientTelegramId = selectedConsultation.users?.telegram_id;
    if (clientTelegramId) {
      await notifyClientPaymentRequired(
        clientTelegramId,
        selectedConsultation.services?.title || 'Консультация',
        finalPrice
      );
    }

    alert('✅ Консультация завершена. Бонусы и статус будут начислены после подтверждения оплаты.');
    
    setShowCompleteForm(false);
    setSelectedConsultation(null);
    await loadConsultations();
    
    setTimeout(() => {
      window.location.href = window.location.href + '?t=' + Date.now();
    }, 1000);
    
  } catch (error: any) {
    console.error('❌ Ошибка:', error);
    alert('Ошибка: ' + error.message);
  }
};

  const confirmPayment = async (consultation: any) => {
    if (!confirm('Подтвердить оплату и начислить бонусы?')) return;

    try {
      const cycleStart = getCurrentLoyaltyCycleStart();
      const completedConsultationsInCycle = consultations.filter(c => {
        const consultationDate = getConsultationCycleDate(c);
        return (
          c.user_id === consultation.user_id &&
          c.status === 'completed' &&
          c.id !== consultation.id &&
          consultationDate &&
          consultationDate >= cycleStart
        );
      });

      const totalCompletedInCycle = completedConsultationsInCycle.length + 1;
      const newStatus = getNextLoyaltyStatus(consultation.users?.status, totalCompletedInCycle);
      const isPersonalTarologist = isPersonalTarologistService(consultation.services?.title);
      const bonusUsed = consultation.bonus_used || 0;
      const finalPrice = consultation.payment_amount || consultation.price || 0;
      const bonusPercent = getBonusPercent(newStatus);
      const bonusEarned = Math.floor(finalPrice * (bonusPercent / 100));
      const currentBonusBalance = consultation.users?.bonus_balance || 0;
      const newBonusBalance = currentBonusBalance - bonusUsed + bonusEarned;

      const { error: consultError } = await supabase
        .from('consultations')
        .update({
          status: 'completed',
          payment_status: 'paid',
          payment_confirmed_at: new Date().toISOString(),
          price: finalPrice,
          payment_amount: finalPrice,
          bonus_paid: bonusEarned,
          completed_at: consultation.completed_at || new Date().toISOString(),
        })
        .eq('id', consultation.id);

      if (consultError) throw consultError;

      const updateData: any = {
        status: newStatus,
        bonus_balance: newBonusBalance,
      };

      if (isPersonalTarologist) {
        const untilDate = new Date();
        untilDate.setDate(untilDate.getDate() + 30);
        updateData.personal_tarologist_until = untilDate.toISOString();
      }

      const { error: userError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', consultation.user_id);

      if (userError) throw userError;

      const clientTelegramId = consultation.users?.telegram_id;
      if (clientTelegramId) {
        if (bonusEarned > 0) {
          await notifyClientBonusUpdate(
            clientTelegramId,
            bonusEarned,
            newBonusBalance,
            consultation.services?.title || 'Консультация'
          );
        }

        if (consultation.users?.status !== newStatus) {
          await notifyClientStatusChange(clientTelegramId, newStatus);
        }
      }

      alert(`✅ Оплата подтверждена!\n\nСписано: -${bonusUsed} ₽\nНачислено: +${bonusEarned} ₽\nБаланс: ${newBonusBalance} ₽\nСтатус: ${newStatus}`);
      await loadConsultations();
    } catch (error: any) {
      alert('Ошибка: ' + error.message);
    }
  };

  const handleEditConsultation = async () => {
    if (!selectedConsultation) return;

    try {
      const { error } = await supabase
        .from('consultations')
        .update({
          admin_notes: editData.admin_notes,
          price: editData.price,
          status: editData.status,
        })
        .eq('id', selectedConsultation.id);

      if (error) throw error;

      alert('✅ Консультация обновлена!');
      
      setShowEditForm(false);
      setSelectedConsultation(null);
      
      await loadConsultations();
      
    } catch (error: any) {
      alert('Ошибка: ' + error.message);
    }
  };

  const filteredConsultations = filter === 'all' 
    ? consultations 
    : consultations.filter(c => c.status === filter);

  // Форма завершения консультации
  if (showCompleteForm && selectedConsultation) {
    // Предварительно вычисляем новый статус
    const cycleStart = getCurrentLoyaltyCycleStart();
    const completedConsultationsInCycle = consultations.filter(c => {
      const consultationDate = getConsultationCycleDate(c);
      return (
        c.user_id === selectedConsultation.user_id &&
        c.status === 'completed' &&
        c.id !== selectedConsultation.id &&
        consultationDate &&
        consultationDate >= cycleStart
      );
    });
    const previewNewStatus = getNextLoyaltyStatus(selectedConsultation.users?.status, completedConsultationsInCycle.length + 1);

    // Используем новый статус для расчёта бонусов
    const bonusPercent = getBonusPercent(previewNewStatus);
    const bonusEarned = Math.floor(completeData.new_price * (bonusPercent / 100));
    const currentBonusBalance = selectedConsultation.users?.bonus_balance || 0;
    const bonusUsed = selectedConsultation.bonus_used || 0;
    const newBonusBalance = currentBonusBalance - bonusUsed + bonusEarned;

    return (
      <div className="min-h-screen bg-[#F8F5F2] p-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-[#385144] flex items-center">
            <CheckCircle2 className="w-6 h-6 mr-2" />
            Завершение консультации
          </h2>
          <button onClick={() => setShowCompleteForm(false)} className="text-gray-500 hover:text-[#385144]">✕</button>
        </div>

        <div className="bg-white rounded-2xl p-5 mb-6 shadow-sm border border-gray-100">
          <h3 className="text-[#385144] font-bold mb-2 flex items-center">
            <User className="w-5 h-5 mr-2" />
            {selectedConsultation.users?.name || 'Клиент'}
          </h3>
          <p className="text-gray-600 text-sm">
            {selectedConsultation.services?.title} • {formatDateTime(selectedConsultation.scheduled_at)}
          </p>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <label className="text-[#385144] font-bold text-sm mb-2 block flex items-center">
              <FileText className="w-4 h-4 mr-2" />
              Рекомендации и главное из консультации:
            </label>
            <textarea
              rows={6}
              className="w-full p-3 bg-[#F8F5F2] border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-[#385144]"
              placeholder="Опишите основные рекомендации, выводы и главное из консультации..."
              value={completeData.admin_notes}
              onChange={(e) => setCompleteData({ ...completeData, admin_notes: e.target.value })}
            />
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <label className="text-[#385144] font-bold text-sm mb-2 block flex items-center">
              <DollarSign className="w-4 h-4 mr-2" />
              Итоговая стоимость (₽):
            </label>
            <input
              type="number"
              className="w-full p-3 bg-[#F8F5F2] border border-gray-200 rounded-lg text-[#385144] font-bold focus:outline-none focus:border-[#385144]"
              value={completeData.new_price}
              onChange={(e) => setCompleteData({ ...completeData, new_price: Number(e.target.value) })}
            />
            <p className="text-gray-500 text-xs mt-1">
              Изначальная цена: {selectedConsultation.services?.price || 0} ₽
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h4 className="text-[#385144] font-bold mb-3 flex items-center">
              <DollarSign className="w-5 h-5 mr-2" />
              Финансы:
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Клиент потратил бонусов:</span>
                <span className="text-red-600 font-bold">-{bonusUsed} ₽</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Клиент заплатил деньгами:</span>
                <span className="text-[#385144] font-bold">{completeData.new_price} ₽</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Кэшбэк ({bonusPercent}% от оплаты):</span>
                <span className="text-green-600 font-bold">+{bonusEarned} ₽</span>
              </div>
              <div className="h-px bg-gray-200 my-2" />
              <div className="flex justify-between text-sm font-bold">
                <span className="text-gray-700">Старый баланс:</span>
                <span className="text-[#D4AF37]">{currentBonusBalance} ₽</span>
              </div>
              <div className="flex justify-between text-sm font-bold">
                <span className="text-gray-700">Новый баланс:</span>
                <span className="text-green-600">{newBonusBalance} ₽</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h4 className="text-[#385144] font-bold mb-3 flex items-center">
              <Crown className="w-5 h-5 mr-2" />
              Автоматическая смена статуса:
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Текущий статус:</span>
                <span className="text-[#D4AF37] font-bold">{selectedConsultation.users?.status || 'Первое знакомство'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Завершено консультаций:</span>
                <span className="text-[#385144] font-bold">{consultations.filter(c => c.user_id === selectedConsultation.user_id && c.status === 'completed').length + 1}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Новый статус:</span>
                <span className="text-[#6B4EE6] font-bold">{previewNewStatus}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setShowCompleteForm(false)}
              className="flex-1 bg-gray-200 text-gray-700 p-4 rounded-xl font-bold hover:bg-gray-300 transition"
            >
              Отмена
            </button>
            <button
              onClick={handleCompleteConsultation}
              className="flex-1 bg-[#385144] text-white p-4 rounded-xl font-bold hover:bg-[#2d4238] transition flex items-center justify-center"
            >
              <CheckCircle2 className="w-5 h-5 mr-2" />
              Завершить консультацию
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Форма редактирования консультации
  if (showEditForm && selectedConsultation) {
    return (
      <div className="min-h-screen bg-[#F8F5F2] p-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-[#385144] flex items-center">
            <Edit3 className="w-6 h-6 mr-2" />
            Редактирование консультации
          </h2>
          <button onClick={() => setShowEditForm(false)} className="text-gray-500 hover:text-[#385144]">✕</button>
        </div>

        <div className="bg-white rounded-2xl p-5 mb-6 shadow-sm border border-gray-100">
          <h3 className="text-[#385144] font-bold mb-2">{selectedConsultation.users?.name}</h3>
          <p className="text-gray-600 text-sm">
            {selectedConsultation.services?.title} • {formatDateTime(selectedConsultation.scheduled_at)}
          </p>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <label className="text-[#385144] font-bold text-sm mb-2 block">Рекомендации:</label>
            <textarea
              rows={6}
              className="w-full p-3 bg-[#F8F5F2] border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-[#385144]"
              value={editData.admin_notes}
              onChange={(e) => setEditData({ ...editData, admin_notes: e.target.value })}
            />
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <label className="text-[#385144] font-bold text-sm mb-2 block">Стоимость (₽):</label>
            <input
              type="number"
              className="w-full p-3 bg-[#F8F5F2] border border-gray-200 rounded-lg text-[#385144] font-bold focus:outline-none focus:border-[#385144]"
              value={editData.price}
              onChange={(e) => setEditData({ ...editData, price: Number(e.target.value) })}
            />
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <label className="text-[#385144] font-bold text-sm mb-2 block">Статус:</label>
            <select
              className="w-full p-3 bg-[#F8F5F2] border border-gray-200 rounded-lg text-[#385144] font-bold focus:outline-none focus:border-[#385144]"
              value={editData.status}
              onChange={(e) => setEditData({ ...editData, status: e.target.value })}
            >
              <option value="pending">Ожидает подтверждения</option>
              <option value="confirmed">Подтверждена</option>
              <option value="in_progress">В процессе</option>
              <option value="completed">Завершена</option>
              <option value="cancelled">Отменена</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setShowEditForm(false)}
              className="flex-1 bg-gray-200 text-gray-700 p-4 rounded-xl font-bold hover:bg-gray-300 transition"
            >
              Отмена
            </button>
            <button
              onClick={handleEditConsultation}
              className="flex-1 bg-[#385144] text-white p-4 rounded-xl font-bold hover:bg-[#2d4238] transition flex items-center justify-center"
            >
              <Save className="w-5 h-5 mr-2" />
              Сохранить изменения
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Основной список консультаций
  return (
    <div className="min-h-screen bg-[#F8F5F2] p-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-[#385144] flex items-center">
          <ListChecks className="w-6 h-6 mr-2" />
          Управление записями
        </h2>
        <button onClick={onBack} className="text-gray-500 hover:text-[#385144]">✕</button>
      </div>

      <div className="mb-6 flex gap-2 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-xl font-bold transition ${
            filter === 'all' ? 'bg-[#385144] text-white' : 'bg-white text-[#385144] border border-gray-200'
          }`}
        >
          Все ({consultations.length})
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`px-4 py-2 rounded-xl font-bold transition ${
            filter === 'pending' ? 'bg-yellow-500 text-white' : 'bg-white text-[#385144] border border-gray-200'
          }`}
        >
          Ожидают ({consultations.filter(c => c.status === 'pending').length})
        </button>
        <button
          onClick={() => setFilter('confirmed')}
          className={`px-4 py-2 rounded-xl font-bold transition ${
            filter === 'confirmed' ? 'bg-blue-500 text-white' : 'bg-white text-[#385144] border border-gray-200'
          }`}
        >
          Подтверждены ({consultations.filter(c => c.status === 'confirmed').length})
        </button>
        <button
          onClick={() => setFilter('awaiting_payment')}
          className={`px-4 py-2 rounded-xl font-bold transition ${
            filter === 'awaiting_payment' ? 'bg-orange-500 text-white' : 'bg-white text-[#385144] border border-gray-200'
          }`}
        >
          Ждут оплату ({consultations.filter(c => c.status === 'awaiting_payment').length})
        </button>
        <button
          onClick={() => setFilter('completed')}
          className={`px-4 py-2 rounded-xl font-bold transition ${
            filter === 'completed' ? 'bg-green-500 text-white' : 'bg-white text-[#385144] border border-gray-200'
          }`}
        >
          Завершены ({consultations.filter(c => c.status === 'completed').length})
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10 bg-white rounded-2xl shadow-sm border border-gray-100">
          <p className="text-gray-500">Загрузка...</p>
        </div>
      ) : filteredConsultations.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-2xl shadow-sm border border-gray-100">
          <p className="text-gray-500">Записей не найдено</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredConsultations.map((consultation) => {
            const user = consultation.users;
            const service = consultation.services;

            return (
              <div 
                key={consultation.id} 
                className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-[#385144] font-bold text-lg flex items-center">
                      <User className="w-5 h-5 mr-2" />
                      {user?.name || 'Неизвестный клиент'}
                    </h3>
                    <p className="text-gray-500 text-sm">
                      Telegram ID: {user?.telegram_id || 'N/A'}
                    </p>
                    {user?.city && (
                      <p className="text-gray-500 text-sm flex items-center mt-1">
                        <MapPin className="w-3 h-3 mr-1" />
                        {user.city}
                      </p>
                    )}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusColors[consultation.status] || statusColors.pending}`}>
                    {statusLabels[consultation.scheduling_status] || statusLabels[consultation.status]}
                  </span>
                </div>

                <div className="bg-[#F8F5F2] p-3 rounded-xl mb-3">
                  <p className="text-[#385144] font-bold">{service?.title || 'Услуга удалена'}</p>
                  <div className="flex gap-4 mt-2 text-sm flex-wrap">
                    <span className="text-gray-600 flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      {consultation.scheduled_at 
                        ? format(new Date(consultation.scheduled_at), 'dd MMMM yyyy', { locale: ru })
                        : 'Дата не указана'
                      }
                    </span>
                    <span className="text-gray-600 flex items-center">
                      <Clock className="w-4 h-4 mr-1" />
                      {consultation.scheduled_at 
                        ? format(new Date(consultation.scheduled_at), 'HH:mm')
                        : ''
                      }
                    </span>
                    <span className="text-[#D4AF37] font-bold flex items-center">
                      <DollarSign className="w-4 h-4 mr-1" />
                      {consultation.price || service?.price || 0} ₽
                    </span>
                  </div>
                  {consultation.bonus_used > 0 && (
                    <p className="text-gray-500 text-xs mt-2 flex items-center">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Списано бонусов: {consultation.bonus_used} ₽
                    </p>
                  )}
                  {consultation.promo_discount > 0 && (
                    <p className="text-gray-500 text-xs mt-2 flex items-center">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Промокод {consultation.promo_code}: −{consultation.promo_discount} ₽
                    </p>
                  )}
                  {consultation.priority_fee > 0 && (
                    <p className="text-gray-500 text-xs mt-2 flex items-center">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Приоритетная запись: +{consultation.priority_fee} ₽
                    </p>
                  )}
                  {consultation.payment_status && consultation.payment_status !== 'paid' && (
                    <p className="mt-2 inline-flex rounded-full bg-[#FFF1E8] px-3 py-1 text-xs font-black text-[#8A5A3F]">
                      Оплата: {consultation.payment_status === 'marked_paid' ? 'клиент отметил оплату' : 'ожидается'}
                    </p>
                  )}
                </div>

                {consultation.scheduling_status === 'needs_admin_time' && (
                  <div className="bg-[#FFF6EF] border border-[#B8795C]/20 p-3 rounded-xl mb-3">
                    <p className="text-[#8A5A3F] text-sm font-bold">
                      Приоритетная заявка без окна. Клиент ждёт предложенное время.
                    </p>
                  </div>
                )}

                {consultation.scheduling_status === 'awaiting_client_confirmation' && (
                  <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl mb-3">
                    <p className="text-blue-700 text-sm font-bold">
                      Клиенту предложено: {formatDateTime(consultation.proposed_at || consultation.scheduled_at)}
                    </p>
                  </div>
                )}

                {consultation.scheduling_status === 'client_countered' && (
                  <div className="bg-[#EAF1EA] border border-[#385144]/15 p-3 rounded-xl mb-3">
                    <p className="text-[#385144] text-xs font-black uppercase tracking-[0.12em]">Клиент предложил</p>
                    <p className="mt-1 text-sm font-bold text-[#59645C]">{consultation.client_time_counterproposal}</p>
                  </div>
                )}

                {consultation.notes && (
                  <div className="bg-gray-50 p-3 rounded-xl mb-3">
                    <p className="text-gray-500 text-xs mb-1 flex items-center">
                      <MessageSquare className="w-3 h-3 mr-1" />
                      Комментарий клиента:
                    </p>
                    <p className="text-gray-700 text-sm">{consultation.notes}</p>
                  </div>
                )}

                {consultation.admin_notes && (
                  <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded-r-xl mb-3">
                    <p className="text-blue-700 text-xs mb-1 flex items-center">
                      <FileText className="w-3 h-3 mr-1" />
                      Ваши заметки:
                    </p>
                    <p className="text-gray-700 text-sm">{consultation.admin_notes}</p>
                  </div>
                )}

                <div className="flex gap-2 flex-wrap mt-3">
                  {(consultation.scheduling_status === 'needs_admin_time' || (!consultation.scheduled_at && consultation.scheduling_status !== 'client_countered')) && (
                    <button
                      onClick={() => proposeTime(consultation)}
                      className="flex-1 bg-[#385144] text-white px-4 py-2 rounded-xl font-bold hover:bg-[#2d4238] transition flex items-center justify-center"
                    >
                      <Clock className="w-4 h-4 mr-1" />
                      Предложить время
                    </button>
                  )}

                  {consultation.scheduling_status === 'client_countered' && (
                    <>
                      <button
                        onClick={() => confirmClientCounter(consultation)}
                        className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-xl font-bold hover:bg-blue-600 transition flex items-center justify-center"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Подтвердить время
                      </button>
                      <button
                        onClick={() => proposeTime(consultation, consultation.client_time_counterproposal || '')}
                        className="flex-1 bg-[#385144] text-white px-4 py-2 rounded-xl font-bold hover:bg-[#2d4238] transition flex items-center justify-center"
                      >
                        <Clock className="w-4 h-4 mr-1" />
                        Предложить другое
                      </button>
                      <button
                        onClick={() => rejectClientCounter(consultation)}
                        className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-xl font-bold hover:bg-gray-300 transition flex items-center justify-center"
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Отклонить
                      </button>
                    </>
                  )}

                  {consultation.status === 'pending' && !isManualScheduling(consultation) && (
                    <>
                      <button
                        onClick={() => updateConsultationStatus(consultation.id, 'confirmed')}
                        className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-xl font-bold hover:bg-blue-600 transition flex items-center justify-center"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Подтвердить
                      </button>
                      <button
                        onClick={() => updateConsultationStatus(consultation.id, 'cancelled')}
                        className="flex-1 bg-red-500 text-white px-4 py-2 rounded-xl font-bold hover:bg-red-600 transition flex items-center justify-center"
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Отменить
                      </button>
                    </>
                  )}

                  {consultation.scheduling_status === 'awaiting_client_confirmation' && (
                    <div className="flex-1 rounded-xl bg-blue-50 px-4 py-2 text-center text-sm font-bold text-blue-700">
                      Ждём подтверждение клиента
                    </div>
                  )}

                  {consultation.status === 'confirmed' && !isManualScheduling(consultation) && (
                    <button
                      onClick={() => openCompleteForm(consultation)}
                      className="flex-1 bg-[#385144] text-white px-4 py-2 rounded-xl font-bold hover:bg-[#2d4238] transition flex items-center justify-center"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      Завершить
                    </button>
                  )}

                  {consultation.status === 'awaiting_payment' && (
                    <button
                      onClick={() => confirmPayment(consultation)}
                      className="flex-1 bg-[#B8795C] text-white px-4 py-2 rounded-xl font-bold hover:bg-[#9E654A] transition flex items-center justify-center"
                    >
                      <DollarSign className="w-4 h-4 mr-1" />
                      Подтвердить оплату
                    </button>
                  )}

                  {consultation.status === 'completed' && (
                    <button
                      onClick={() => openEditForm(consultation)}
                      className="flex-1 bg-[#6B4EE6] text-white px-4 py-2 rounded-xl font-bold hover:bg-[#5a3fd4] transition flex items-center justify-center"
                    >
                      <Edit3 className="w-4 h-4 mr-1" />
                      Редактировать
                    </button>
                  )}

                  {consultation.status === 'cancelled' && (
                    <div className="flex-1 text-red-500 text-sm font-bold py-2 text-center">
                      Отменена
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
