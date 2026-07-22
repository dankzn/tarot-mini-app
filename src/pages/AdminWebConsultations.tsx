import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Calendar, 
  User, 
  DollarSign,
  Search,
  MessageSquare,
  FileText,
  Sparkles,
  Plus
} from 'lucide-react';
import { AdminBackButton } from '../components/admin/AdminBackButton';
import { ensureAdminSession } from '../lib/adminAuth';
import { notifyClientBonusUpdate, notifyClientPaymentRequired, notifyClientTimeConfirmed, notifyClientTimeProposal } from '../lib/notifications';
import { getBonusPercent, getConsultationCycleDate, getCurrentLoyaltyCycleStart, getNextLoyaltyStatus, isPersonalTarologistService } from '../lib/bonusLogic';
import { toMoscowDateTimeStringFromParts } from '../lib/moscowTime';
import { getServicePriceState } from '../lib/serviceCampaigns';

const parseAdminDateTime = (value: string) => {
  const normalized = value.trim().replace(' ', 'T');
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateTime = (value: string | null | undefined) => (
  value ? format(new Date(value), 'dd MMMM yyyy HH:mm', { locale: ru }) : 'Дата не указана'
);

const toAdminMoscowDateTime = (value: string) => {
  if (!value) return null;
  const [date, time] = value.trim().replace(' ', 'T').split('T');
  if (!date || !time) return null;
  const normalized = time.length === 5 ? time : time.slice(0, 5);
  return toMoscowDateTimeStringFromParts(date, normalized);
};

const getAdminServicePrice = (service: any) => getServicePriceState({
  price: Number(service?.price || 0),
  next_price: service?.next_price,
  price_increase_at: service?.price_increase_at,
  promo_title: service?.promo_title,
  promo_price: service?.promo_price,
  promo_starts_at: service?.promo_starts_at,
  promo_ends_at: service?.promo_ends_at,
}).currentPrice;

const manualSchedulingStatuses = new Set([
  'needs_admin_time',
  'awaiting_client_confirmation',
  'client_countered',
]);

const isManualScheduling = (consultation: any) => (
  manualSchedulingStatuses.has(consultation?.scheduling_status)
);

export const AdminWebConsultations = () => {
  const navigate = useNavigate();
  const [consultations, setConsultations] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showCompleteForm, setShowCompleteForm] = useState(false);
  const [selectedConsultation, setSelectedConsultation] = useState<any>(null);
  const [manualRecord, setManualRecord] = useState({
    user_id: '',
    scheduled_at: '',
    notes: '',
    total_price: 0,
  });
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [completeData, setCompleteData] = useState({
    admin_notes: '',
    new_price: 0,
  });

  useEffect(() => {
    checkAuth();
    loadConsultations();
  }, []);

  const checkAuth = async () => {
    const { ok } = await ensureAdminSession();
    if (!ok) {
      navigate('/admin-web');
    }
  };

  const loadConsultations = async () => {
    try {
      const { data: consultationsData } = await supabase
        .from('consultations')
        .select('*')
        .order('scheduled_at', { ascending: false });

      const { data: usersData } = await supabase
        .from('users')
        .select('id, name, telegram_id, username, email, city, status, bonus_balance, personal_tarologist_until');

      const { data: servicesData } = await supabase
        .from('services')
        .select('id, title, price, duration_minutes, next_price, price_increase_at, promo_title, promo_price, promo_starts_at, promo_ends_at')
        .order('price', { ascending: true });

      const enriched = (consultationsData || []).map(c => ({
        ...c,
        users: usersData?.find(u => u.id === c.user_id) || null,
        services: servicesData?.find(s => s.id === c.service_id) || null,
      }));

      setConsultations(enriched);
      setUsers((usersData || []).sort((left, right) => (left.name || '').localeCompare(right.name || '', 'ru')));
      setServices(servicesData || []);
    } catch (error) {
      console.error('Ошибка загрузки:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetCreateForm = () => {
    setManualRecord({
      user_id: '',
      scheduled_at: '',
      notes: '',
      total_price: 0,
    });
    setSelectedServiceIds([]);
  };

  const openCreateForm = () => {
    resetCreateForm();
    setShowCreateForm(true);
  };

  const toggleManualService = (serviceId: string) => {
    setSelectedServiceIds((current) => {
      const next = current.includes(serviceId)
        ? current.filter((id) => id !== serviceId)
        : [...current, serviceId];
      const nextServices = services.filter((service) => next.includes(service.id));
      const nextPrice = nextServices.reduce((sum, service) => sum + getAdminServicePrice(service), 0);
      setManualRecord((record) => ({ ...record, total_price: nextPrice }));
      return next;
    });
  };

  const getDistributedPrices = (selectedServices: any[], totalPrice: number) => {
    if (selectedServices.length === 0) return [];
    if (selectedServices.length === 1) return [totalPrice];

    const baseTotal = selectedServices.reduce((sum, service) => sum + getAdminServicePrice(service), 0);
    let remaining = totalPrice;

    return selectedServices.map((service, index) => {
      if (index === selectedServices.length - 1) return remaining;

      const basePrice = getAdminServicePrice(service);
      const value = baseTotal > 0
        ? Math.round(totalPrice * (basePrice / baseTotal))
        : Math.floor(totalPrice / selectedServices.length);
      remaining -= value;
      return value;
    });
  };

  const handleManualCreate = async () => {
    const selectedUser = users.find((user) => user.id === manualRecord.user_id);
    const selectedServices = services.filter((service) => selectedServiceIds.includes(service.id));
    const totalPrice = Math.max(0, Number(manualRecord.total_price || 0));
    const scheduledAt = manualRecord.scheduled_at
      ? toAdminMoscowDateTime(manualRecord.scheduled_at)
      : null;

    if (!selectedUser) {
      alert('Выберите клиента');
      return;
    }

    if (selectedServices.length === 0) {
      alert('Выберите хотя бы один формат');
      return;
    }

    if (manualRecord.scheduled_at && !scheduledAt) {
      alert('Не получилось распознать дату и время записи');
      return;
    }

    const prices = getDistributedPrices(selectedServices, totalPrice);
    const titles = selectedServices.map((service) => service.title).join(', ');
    const commonNotes = [
      manualRecord.notes.trim() ? manualRecord.notes.trim() : '',
      selectedServices.length > 1 ? `Мультизапись администратора: ${titles}` : '',
      `Итоговая сумма к оплате: ${totalPrice} ₽`,
    ].filter(Boolean).join('\n\n');

    const rows = selectedServices.map((service, index) => ({
      user_id: selectedUser.id,
      service_id: service.id,
      scheduled_at: scheduledAt,
      requested_date: scheduledAt ? format(new Date(scheduledAt), 'yyyy-MM-dd') : null,
      requested_time_text: scheduledAt ? format(new Date(scheduledAt), 'HH:mm') : 'Время назначит администратор',
      scheduling_status: scheduledAt ? 'scheduled' : 'needs_admin_time',
      status: 'awaiting_payment',
      notes: commonNotes,
      price: prices[index],
      payment_amount: prices[index],
      payment_status: 'payment_requested',
      bonus_used: 0,
      priority_fee: 0,
      admin_notes: selectedServices.length > 1
        ? `Часть мультизаписи: ${index + 1}/${selectedServices.length}`
        : 'Запись создана администратором',
    }));

    const { error } = await supabase
      .from('consultations')
      .insert(rows);

    if (error) {
      alert('Ошибка: ' + error.message);
      return;
    }

    if (selectedUser.telegram_id && totalPrice > 0) {
      const notificationResult = await notifyClientPaymentRequired(
        selectedUser.telegram_id,
        selectedServices.length > 1 ? `Несколько консультаций: ${titles}` : selectedServices[0].title,
        totalPrice
      );

      if (!notificationResult.ok) {
        console.error('❌ Уведомление клиенту об оплате не отправлено:', notificationResult.error);
      }
    }

    alert(`✅ Создано записей: ${rows.length}. К оплате: ${totalPrice} ₽`);
    setShowCreateForm(false);
    resetCreateForm();
    await loadConsultations();
  };

  const updateStatus = async (consultationId: string, newStatus: string) => {
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
      alert('✅ Статус обновлён!');
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

  const handleComplete = async () => {
    if (!selectedConsultation) return;

    try {
      const finalPrice = completeData.new_price;

      if (selectedConsultation.status === 'completed') {
        const { error } = await supabase
          .from('consultations')
          .update({
            admin_notes: completeData.admin_notes,
            price: finalPrice,
            payment_amount: finalPrice,
          })
          .eq('id', selectedConsultation.id);

        if (error) throw error;

        alert('✅ Консультация обновлена');
        setShowCompleteForm(false);
        setSelectedConsultation(null);
        await loadConsultations();
        return;
      }

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

      if (consultError) throw consultError;

      if (selectedConsultation.users?.telegram_id) {
        const notificationResult = await notifyClientPaymentRequired(
          selectedConsultation.users.telegram_id,
          selectedConsultation.services?.title || 'Консультация',
          finalPrice
        );

        if (!notificationResult.ok) {
          console.error('❌ Уведомление клиенту об оплате не отправлено:', notificationResult.error);
          alert(`Консультация завершена, но уведомление клиенту не отправилось: ${notificationResult.error}`);
        }
      }

      alert('✅ Консультация завершена. Бонусы и статус будут начислены после подтверждения оплаты.');
      setShowCompleteForm(false);
      setSelectedConsultation(null);
      await loadConsultations();
    } catch (error: any) {
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

      const { error: consultationError } = await supabase
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

      if (consultationError) throw consultationError;

      const userUpdateData: any = {
        status: newStatus,
        bonus_balance: newBonusBalance,
      };

      if (isPersonalTarologist) {
        const untilDate = new Date();
        untilDate.setDate(untilDate.getDate() + 30);
        userUpdateData.personal_tarologist_until = untilDate.toISOString();
      }

      const { error: userError } = await supabase
        .from('users')
        .update(userUpdateData)
        .eq('id', consultation.user_id);

      if (userError) throw userError;

      alert(`✅ Оплата подтверждена!\n\nСписано: -${bonusUsed} ₽\nНачислено: +${bonusEarned} ₽\nБаланс: ${newBonusBalance} ₽\nСтатус: ${newStatus}`);

      if (consultation.users?.telegram_id) {
        await notifyClientBonusUpdate(
          consultation.users.telegram_id,
          bonusEarned,
          newBonusBalance,
          consultation.services?.title || 'Консультация'
        );
      }

      await loadConsultations();
    } catch (error: any) {
      alert('Ошибка: ' + error.message);
    }
  };

  const filteredConsultations = consultations.filter(c => {
    const matchesFilter = filter === 'all' || c.status === filter;
    const matchesSearch = !searchQuery || 
      c.users?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.users?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.services?.title?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    confirmed: 'bg-blue-100 text-blue-800 border-blue-300',
    in_progress: 'bg-purple-100 text-purple-800 border-purple-300',
    awaiting_payment: 'bg-orange-100 text-orange-800 border-orange-300',
    completed: 'bg-green-100 text-green-800 border-green-300',
    cancelled: 'bg-red-100 text-red-800 border-red-300',
  };

  const statusLabels: Record<string, string> = {
    pending: 'Ожидает',
    confirmed: 'Подтверждена',
    needs_admin_time: 'Нужно предложить время',
    awaiting_client_confirmation: 'Ждём ответ клиента',
    client_countered: 'Клиент предложил время',
    in_progress: 'В процессе',
    awaiting_payment: 'Ждёт оплату',
    completed: 'Завершена',
    cancelled: 'Отменена',
  };

  if (showCreateForm) {
    const selectedServices = services.filter((service) => selectedServiceIds.includes(service.id));
    const servicesBasePrice = selectedServices.reduce((sum, service) => sum + getAdminServicePrice(service), 0);
    const distributedPrices = getDistributedPrices(selectedServices, Number(manualRecord.total_price || 0));

    return (
      <div className="min-h-screen bg-[#F8F5F2]">
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <AdminBackButton onClick={() => setShowCreateForm(false)} />
            <h1 className="text-2xl font-bold text-[#385144]">Записать клиента</h1>
            <div></div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-5">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <label className="text-[#385144] font-bold text-sm mb-2 block flex items-center">
                  <User className="w-4 h-4 mr-2" />
                  Клиент
                </label>
                <select
                  value={manualRecord.user_id}
                  onChange={(e) => setManualRecord({ ...manualRecord, user_id: e.target.value })}
                  className="w-full p-3 bg-[#F8F5F2] border border-gray-200 rounded-lg text-[#385144] font-bold focus:outline-none focus:border-[#385144]"
                >
                  <option value="">Выберите зарегистрированного клиента</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name || 'Без имени'} {user.username ? `@${user.username}` : ''} {user.email ? `· ${user.email}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <label className="text-[#385144] font-bold text-sm flex items-center">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Форматы консультации
                  </label>
                  <span className="rounded-full bg-[#F8F5F2] px-3 py-1 text-xs font-black text-[#385144]/70">
                    выбрано: {selectedServiceIds.length}
                  </span>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {services.map((service) => {
                    const selected = selectedServiceIds.includes(service.id);

                    return (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => toggleManualService(service.id)}
                        className={`rounded-2xl border p-4 text-left transition ${
                          selected
                            ? 'border-[#385144] bg-[#EAF1EA] text-[#385144]'
                            : 'border-gray-100 bg-[#F8F5F2] text-[#385144] hover:border-[#385144]/30'
                        }`}
                      >
                        <span className="flex items-start justify-between gap-3">
                          <span>
                            <span className="block font-black">{service.title}</span>
                            <span className="mt-1 block text-sm font-semibold text-[#385144]/58">
                              {service.duration_minutes ? `${service.duration_minutes} мин · ` : ''}{getAdminServicePrice(service).toLocaleString('ru-RU')} ₽
                            </span>
                          </span>
                          <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg border ${
                            selected ? 'border-[#385144] bg-[#385144] text-white' : 'border-[#385144]/20 bg-white'
                          }`}>
                            {selected ? <CheckCircle className="h-4 w-4" /> : null}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <label className="text-[#385144] font-bold text-sm mb-2 block flex items-center">
                  <Calendar className="w-4 h-4 mr-2" />
                  Дата и время
                </label>
                <input
                  type="datetime-local"
                  value={manualRecord.scheduled_at}
                  onChange={(e) => setManualRecord({ ...manualRecord, scheduled_at: e.target.value })}
                  className="w-full p-3 bg-[#F8F5F2] border border-gray-200 rounded-lg text-[#385144] font-bold focus:outline-none focus:border-[#385144]"
                />
                <p className="mt-2 text-xs font-semibold text-gray-500">
                  Можно оставить пустым, тогда запись попадёт в режим подбора времени.
                </p>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <label className="text-[#385144] font-bold text-sm mb-2 block flex items-center">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Комментарий
                </label>
                <textarea
                  rows={5}
                  value={manualRecord.notes}
                  onChange={(e) => setManualRecord({ ...manualRecord, notes: e.target.value })}
                  className="w-full p-3 bg-[#F8F5F2] border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-[#385144]"
                  placeholder="Что важно зафиксировать по записи..."
                />
              </div>
            </div>

            <div className="space-y-5">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#B8795C]">Итог к оплате</p>
                <label className="mt-4 block">
                  <span className="mb-2 block text-sm font-bold text-[#385144]">Цена, которая пойдёт на оплату</span>
                  <input
                    type="number"
                    min={0}
                    value={manualRecord.total_price}
                    onChange={(e) => setManualRecord({ ...manualRecord, total_price: Number(e.target.value) })}
                    className="w-full p-4 bg-[#F8F5F2] border border-gray-200 rounded-xl text-3xl font-black text-[#385144] focus:outline-none focus:border-[#385144]"
                  />
                </label>
                <div className="mt-4 rounded-2xl bg-[#F8F5F2] p-4 text-sm font-semibold text-[#385144]/70">
                  <div className="flex justify-between gap-3">
                    <span>Сумма выбранных форматов</span>
                    <span className="text-[#385144]">{servicesBasePrice.toLocaleString('ru-RU')} ₽</span>
                  </div>
                  <div className="mt-2 flex justify-between gap-3">
                    <span>Ручная итоговая цена</span>
                    <span className="text-[#B8795C]">{Number(manualRecord.total_price || 0).toLocaleString('ru-RU')} ₽</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#B8795C]">Как ляжет в оплату</p>
                <div className="mt-4 space-y-3">
                  {selectedServices.length === 0 ? (
                    <p className="text-sm font-semibold text-gray-500">Выберите форматы слева</p>
                  ) : (
                    selectedServices.map((service, index) => (
                      <div key={service.id} className="rounded-2xl bg-[#F8F5F2] p-4">
                        <p className="font-black text-[#385144]">{service.title}</p>
                        <p className="mt-1 text-sm font-semibold text-[#385144]/58">
                          К оплате по этой записи: {Number(distributedPrices[index] || 0).toLocaleString('ru-RU')} ₽
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 bg-gray-200 text-gray-700 p-4 rounded-xl font-bold hover:bg-gray-300 transition"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleManualCreate}
                  className="flex-1 bg-[#385144] text-white p-4 rounded-xl font-bold hover:bg-[#2d4238] transition flex items-center justify-center"
                >
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Создать
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showCompleteForm && selectedConsultation) {
    const isEdit = selectedConsultation.status === 'completed';
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
    const bonusPercent = getBonusPercent(previewNewStatus);
    const bonusEarned = Math.floor(completeData.new_price * (bonusPercent / 100));
    const currentBonusBalance = selectedConsultation.users?.bonus_balance || 0;
    const bonusUsed = selectedConsultation.bonus_used || 0;
    const newBonusBalance = currentBonusBalance - bonusUsed + bonusEarned;

    return (
      <div className="min-h-screen bg-[#F8F5F2]">
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <AdminBackButton onClick={() => setShowCompleteForm(false)} />
            <h1 className="text-2xl font-bold text-[#385144]">
              {isEdit ? 'Редактирование консультации' : 'Завершение консультации'}
            </h1>
            <div></div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-2xl p-6 mb-6 shadow-sm border border-gray-100">
            <h3 className="text-[#385144] font-bold text-lg mb-2 flex items-center">
              <User className="w-5 h-5 mr-2" />
              {selectedConsultation.users?.name || 'Клиент'}
              {selectedConsultation.users?.username && (
                <a 
                  href={`https://t.me/${selectedConsultation.users.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-[#6B4EE6] hover:underline text-sm"
                >
                  @{selectedConsultation.users.username}
                </a>
              )}
            </h3>
            <p className="text-gray-600">
              {selectedConsultation.services?.title} • {formatDateTime(selectedConsultation.scheduled_at)}
            </p>
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <label className="text-[#385144] font-bold text-sm mb-2 block flex items-center">
                <FileText className="w-4 h-4 mr-2" />
                Рекомендации и главное из консультации:
              </label>
              <textarea
                rows={6}
                className="w-full p-3 bg-[#F8F5F2] border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-[#385144]"
                placeholder="Опишите основные рекомендации..."
                value={completeData.admin_notes}
                onChange={(e) => setCompleteData({ ...completeData, admin_notes: e.target.value })}
              />
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
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
            </div>

            {!isEdit && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
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
            )}

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setShowCompleteForm(false)}
                className="flex-1 bg-gray-200 text-gray-700 p-4 rounded-xl font-bold hover:bg-gray-300 transition"
              >
                Отмена
              </button>
              <button
                onClick={handleComplete}
                className="flex-1 bg-[#385144] text-white p-4 rounded-xl font-bold hover:bg-[#2d4238] transition flex items-center justify-center"
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                {isEdit ? 'Сохранить изменения' : 'Завершить консультацию'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F5F2]">
      {/* Шапка */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <AdminBackButton onClick={() => navigate('/admin-web/dashboard')} label="В dashboard" />
          <h1 className="text-2xl font-bold text-[#385144]">Управление записями</h1>
          <button
            type="button"
            onClick={openCreateForm}
            className="bg-[#385144] text-white px-4 py-2 rounded-xl font-bold hover:bg-[#2d4238] transition flex items-center"
          >
            <Plus className="w-5 h-5 mr-2" />
            Записать
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Фильтры и поиск */}
        <div className="bg-white rounded-2xl p-6 mb-6 shadow-sm border border-gray-100">
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Поиск по имени, username или услуге..."
                  className="w-full pl-10 pr-4 py-2 bg-[#F8F5F2] border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-[#385144]"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-xl font-bold transition ${
                filter === 'all' ? 'bg-[#385144] text-white' : 'bg-[#F8F5F2] text-[#385144] border border-gray-200'
              }`}
            >
              Все ({consultations.length})
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-4 py-2 rounded-xl font-bold transition ${
                filter === 'pending' ? 'bg-yellow-500 text-white' : 'bg-[#F8F5F2] text-[#385144] border border-gray-200'
              }`}
            >
              Ожидают ({consultations.filter(c => c.status === 'pending').length})
            </button>
            <button
              onClick={() => setFilter('confirmed')}
              className={`px-4 py-2 rounded-xl font-bold transition ${
                filter === 'confirmed' ? 'bg-blue-500 text-white' : 'bg-[#F8F5F2] text-[#385144] border border-gray-200'
              }`}
            >
              Подтверждены ({consultations.filter(c => c.status === 'confirmed').length})
            </button>
            <button
              onClick={() => setFilter('awaiting_payment')}
              className={`px-4 py-2 rounded-xl font-bold transition ${
                filter === 'awaiting_payment' ? 'bg-orange-500 text-white' : 'bg-[#F8F5F2] text-[#385144] border border-gray-200'
              }`}
            >
              Ждут оплату ({consultations.filter(c => c.status === 'awaiting_payment').length})
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`px-4 py-2 rounded-xl font-bold transition ${
                filter === 'completed' ? 'bg-green-500 text-white' : 'bg-[#F8F5F2] text-[#385144] border border-gray-200'
              }`}
            >
              Завершены ({consultations.filter(c => c.status === 'completed').length})
            </button>
          </div>
        </div>

        {/* Список записей */}
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
                  className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-[#385144] font-bold text-lg flex items-center">
                        <User className="w-5 h-5 mr-2" />
                        {user?.name || 'Неизвестный клиент'}
                      </h3>
                      <div className="flex gap-2 text-sm text-gray-500 flex-wrap items-center mt-1">
                        {user?.username ? (
                          <a 
                            href={`https://t.me/${user.username}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#6B4EE6] hover:underline flex items-center gap-1"
                          >
                            <User className="w-3 h-3" />
                            @{user.username}
                          </a>
                        ) : (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            ID: {user?.telegram_id || 'N/A'}
                          </span>
                        )}
                        {user?.city && (
                          <>
                            <span>•</span>
                            <span>{user.city}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusColors[consultation.status] || statusColors.pending}`}>
                      {statusLabels[consultation.scheduling_status] || statusLabels[consultation.status]}
                    </span>
                  </div>

                  <div className="bg-[#F8F5F2] p-4 rounded-xl mb-4">
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
                    <div className="bg-[#FFF6EF] border border-[#B8795C]/20 p-3 rounded-xl mb-4">
                      <p className="text-[#8A5A3F] text-sm font-bold">
                        Приоритетная заявка без окна. Клиент ждёт предложенное время.
                      </p>
                    </div>
                  )}

                  {consultation.scheduling_status === 'awaiting_client_confirmation' && (
                    <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl mb-4">
                      <p className="text-blue-700 text-sm font-bold">
                        Клиенту предложено: {formatDateTime(consultation.proposed_at || consultation.scheduled_at)}
                      </p>
                    </div>
                  )}

                  {consultation.scheduling_status === 'client_countered' && (
                    <div className="bg-[#EAF1EA] border border-[#385144]/15 p-3 rounded-xl mb-4">
                      <p className="text-[#385144] text-xs font-black uppercase tracking-[0.12em]">Клиент предложил</p>
                      <p className="mt-1 text-sm font-bold text-[#59645C]">{consultation.client_time_counterproposal}</p>
                    </div>
                  )}

                  {consultation.notes && (
                    <div className="bg-gray-50 p-3 rounded-xl mb-4">
                      <p className="text-gray-500 text-xs mb-1 flex items-center">
                        <MessageSquare className="w-3 h-3 mr-1" />
                        Комментарий клиента:
                      </p>
                      <p className="text-gray-700 text-sm">{consultation.notes}</p>
                    </div>
                  )}

                  {consultation.admin_notes && (
                    <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded-r-xl mb-4">
                      <p className="text-blue-700 text-xs mb-1 flex items-center">
                        <FileText className="w-3 h-3 mr-1" />
                        Ваши заметки:
                      </p>
                      <p className="text-gray-700 text-sm">{consultation.admin_notes}</p>
                    </div>
                  )}

                  <div className="flex gap-2 flex-wrap">
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
                          <CheckCircle className="w-4 h-4 mr-1" />
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
                          onClick={() => updateStatus(consultation.id, 'confirmed')}
                          className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-xl font-bold hover:bg-blue-600 transition flex items-center justify-center"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Подтвердить
                        </button>
                        <button
                          onClick={() => updateStatus(consultation.id, 'cancelled')}
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
                        <CheckCircle className="w-4 h-4 mr-1" />
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
                        onClick={() => openCompleteForm(consultation)}
                        className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-xl font-bold hover:bg-gray-300 transition flex items-center justify-center"
                      >
                        <FileText className="w-4 h-4 mr-1" />
                        Редактировать
                      </button>
                    )}

                    {consultation.status === 'cancelled' && (
                      <div className="flex-1 text-red-500 text-sm font-bold py-2 text-center">
                        ❌ Отменена
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
