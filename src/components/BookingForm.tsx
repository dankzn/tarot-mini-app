import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import './CalendarStyles.css';
import { format, addMinutes, isBefore, startOfDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Calendar as CalendarIcon, Clock, Sparkles, MessageSquare, X } from 'lucide-react';
import { notifyAdminNewBooking } from '../lib/notifications';

interface BookingFormProps {
  user: any;
  service: any;
  onSuccess: () => void;
  onCancel: () => void;
}

interface TimeSlot {
  id: string;
  start_time: string;
  duration_minutes: number;
  is_booked: boolean;
}

interface SlotOption {
  id: string;
  time: string;
  slotIds: string[];
}

const buildSlotOptions = (slots: TimeSlot[], duration: number): SlotOption[] => {
  const optionsByTime = new Map<string, SlotOption>();
  const sortedSlots = [...slots].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  sortedSlots
    .filter(slot => !slot.is_booked && slot.duration_minutes === duration)
    .forEach(slot => {
      const time = format(new Date(slot.start_time), 'HH:mm');
      optionsByTime.set(time, {
        id: slot.id,
        time,
        slotIds: [slot.id],
      });
    });

  if (duration % 30 !== 0) {
    return Array.from(optionsByTime.values());
  }

  const slotsNeeded = duration / 30;
  const freeThirtyMinuteSlots = sortedSlots.filter(
    slot => !slot.is_booked && slot.duration_minutes === 30
  );
  const slotsByStartTime = new Map(
    freeThirtyMinuteSlots.map(slot => [new Date(slot.start_time).getTime(), slot])
  );

  freeThirtyMinuteSlots.forEach(slot => {
    const start = new Date(slot.start_time);
    const chain = Array.from({ length: slotsNeeded }, (_, index) => {
      const expectedStart = addMinutes(start, index * 30).getTime();
      return slotsByStartTime.get(expectedStart);
    });

    if (chain.every(Boolean)) {
      const time = format(start, 'HH:mm');
      if (!optionsByTime.has(time)) {
        optionsByTime.set(time, {
          id: slot.id,
          time,
          slotIds: chain.map(chainSlot => chainSlot!.id),
        });
      }
    }
  });

  return Array.from(optionsByTime.values()).sort((a, b) => a.time.localeCompare(b.time));
};

export const BookingForm = ({ user, service, onSuccess, onCancel }: BookingFormProps) => {
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);
  const [allSlots, setAllSlots] = useState<TimeSlot[]>([]);
  const [notes, setNotes] = useState('');
  const [step, setStep] = useState(1);

  const [useBonuses, setUseBonuses] = useState(false);
  const [bonusAmount, setBonusAmount] = useState(0);

  const duration = service.duration_minutes || 60;
  const originalPrice = service.price || 0;
  const userBalance = user.bonus_balance || 0;

  const maxBonusUsable = Math.min(userBalance, originalPrice);
  const finalPrice = useBonuses ? originalPrice - bonusAmount : originalPrice;

  useEffect(() => {
    if (selectedDate) {
      loadAllSlots();
    }
  }, [selectedDate, service.id]);

  const loadAllSlots = async () => {
    const startOfDayDate = startOfDay(selectedDate!);
    const now = new Date();

    const { data: allSlotsData, error } = await supabase
      .from('time_slots')
      .select('id, start_time, duration_minutes, is_booked')
      .gte('start_time', format(startOfDayDate, "yyyy-MM-dd'T'00:00:00"))
      .lt('start_time', format(addMinutes(startOfDayDate, 1440), "yyyy-MM-dd'T'00:00:00"))
      .order('start_time', { ascending: true });

    if (error) {
      console.error('❌ Ошибка загрузки слотов:', error);
      return;
    }

    if (allSlotsData) {
      const futureSlots = allSlotsData.filter(slot =>
        !isBefore(new Date(slot.start_time), now)
      );
      
      setAllSlots(futureSlots);
    }
  };

  const handleTimeSelect = (slotOption: SlotOption) => {
    setSelectedTime(slotOption.time);
    setSelectedSlotIds(slotOption.slotIds);
    setStep(3);
  };

  const handleSubmit = async () => {
    if (!selectedDate || !selectedTime || selectedSlotIds.length === 0) return;
    
    setLoading(true);

    try {
      const [hours, minutes] = selectedTime.split(':').map(Number);
      const bookingDateTime = new Date(selectedDate);
      bookingDateTime.setHours(hours, minutes, 0, 0);

      const { data: bookedSlotsData, error: slotError } = await supabase
        .from('time_slots')
        .update({
          is_booked: true,
          booked_by: user.id,
        })
        .in('id', selectedSlotIds)
        .eq('is_booked', false)
        .select('id');

      if (slotError) throw slotError;

      if (!bookedSlotsData || bookedSlotsData.length !== selectedSlotIds.length) {
        await loadAllSlots();
        throw new Error('Это окно только что заняли. Выберите другое время.');
      }

      const { error: consultError } = await supabase
        .from('consultations')
        .insert([
          {
            user_id: user.id,
            service_id: service.id,
            scheduled_at: bookingDateTime.toISOString(),
            notes: notes,
            price: finalPrice,
            bonus_used: useBonuses ? bonusAmount : 0,
            status: 'pending',
          }
        ]);

      if (consultError) {
        await supabase
          .from('time_slots')
          .update({
            is_booked: false,
            booked_by: null,
          })
          .in('id', selectedSlotIds);

        throw consultError;
      }

      // Отправляем уведомление админу
      const { data: adminData } = await supabase
        .from('users')
        .select('telegram_id')
        .eq('role', 'admin')
        .single();

      if (adminData?.telegram_id) {
        await notifyAdminNewBooking(
          adminData.telegram_id,
          user.name || 'Клиент',
          user.username || null,
          service.title,
          format(bookingDateTime, 'dd MMMM yyyy HH:mm', { locale: ru }),
          finalPrice
        );
      }

      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
      onSuccess();
    } catch (error: any) {
      alert('Ошибка: ' + error.message);
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('error');
    } finally {
      setLoading(false);
    }
  };

  const availableSlotOptions = buildSlotOptions(allSlots, duration);
  const bookedSlots = allSlots.filter(slot => slot.is_booked);

  return (
    <div className="min-h-screen bg-[#F8F5F2] p-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-[#385144]">Запись на консультацию</h2>
        <button onClick={onCancel} className="text-gray-500 hover:text-[#385144]">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="bg-white rounded-2xl p-5 mb-6 shadow-sm border border-gray-100">
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-[#385144] font-bold text-lg flex-1">{service.title}</h3>
          <div className="text-right ml-3">
            {useBonuses && bonusAmount > 0 ? (
              <div className="flex flex-col items-end">
                <span className="text-gray-400 line-through text-sm">{originalPrice} ₽</span>
                <span className="text-[#8A5A3F] font-bold text-xl">{finalPrice} ₽</span>
              </div>
            ) : (
              <span className="text-[#8A5A3F] font-bold text-xl">{originalPrice} ₽</span>
            )}
          </div>
        </div>
        <div className="flex items-center text-gray-600 text-sm mb-2">
          <Clock className="w-4 h-4 mr-2" />
          Длительность: {duration} минут
        </div>
        {service.description && (
          <p className="text-gray-600 text-sm mt-2">{service.description}</p>
        )}
      </div>

      {step === 1 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-[#385144] font-bold mb-4 flex items-center">
            <CalendarIcon className="w-5 h-5 mr-2" />
            Выберите дату
          </h3>
          <div className="flex justify-center">
            <Calendar
              onChange={(value: any) => {
                if (value instanceof Date) {
                  setSelectedDate(value);
                  setSelectedTime(null);
                  setSelectedSlotIds([]);
                  setStep(2);
                }
              }}
              value={selectedDate}
              minDate={new Date()}
              locale="ru-RU"
              className="custom-calendar"
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[#385144] font-bold flex items-center">
              <Clock className="w-5 h-5 mr-2" />
              {selectedDate ? format(selectedDate, 'd MMMM yyyy', { locale: ru }) : ''}
            </h3>
            <button onClick={() => setStep(1)} className="text-gray-500 text-sm hover:text-[#385144]">← Назад</button>
          </div>

          {availableSlotOptions.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-500">На эту дату нет доступных окон</p>
              <p className="text-gray-400 text-sm mt-2">Выберите другую дату</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {availableSlotOptions.map((slotOption) => (
                <button
                  key={slotOption.id}
                  onClick={() => handleTimeSelect(slotOption)}
                  className="p-3 rounded-lg font-bold transition bg-[#385144] text-white hover:bg-[#2d4238]"
                >
                  {slotOption.time}
                </button>
              ))}
              {bookedSlots.map((slot) => {
                const slotTime = format(new Date(slot.start_time), 'HH:mm');
                return (
                  <button
                    key={slot.id}
                    disabled
                    className="p-3 rounded-lg font-bold bg-gray-200 text-gray-400 cursor-not-allowed"
                  >
                    {slotTime}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[#385144] font-bold">Подтверждение</h3>
              <button onClick={() => setStep(2)} className="text-gray-500 text-sm">← Назад</button>
            </div>

            <div className="space-y-3 mb-4">
              <div className="flex items-center text-gray-700">
                <CalendarIcon className="w-5 h-5 mr-3 text-[#385144]" />
                <span>{selectedDate ? format(selectedDate, 'd MMMM yyyy', { locale: ru }) : ''}</span>
              </div>
              <div className="flex items-center text-gray-700">
                <Clock className="w-5 h-5 mr-3 text-[#385144]" />
                <span>{selectedTime}</span>
              </div>
              <div className="flex items-center text-gray-700">
                <span className="text-[#8A5A3F]">₽</span>
                <span className="font-bold">{finalPrice} ₽</span>
              </div>
            </div>

            {userBalance > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[#385144] font-bold flex items-center">
                    <Sparkles className="w-5 h-5 mr-2 text-[#B8795C]" />
                    Использовать бонусы?
                  </span>
                  <div 
                    className={`w-12 h-6 rounded-full p-1 cursor-pointer transition ${useBonuses ? 'bg-[#385144]' : 'bg-gray-300'}`}
                    onClick={() => {
                      setUseBonuses(!useBonuses);
                      if (!useBonuses) setBonusAmount(0);
                    }}
                  >
                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition ${useBonuses ? 'translate-x-6' : 'translate-x-0'}`} />
                  </div>
                </div>

                {useBonuses && (
                  <div className="bg-[#F8F5F2] p-4 rounded-xl border border-[#385144]/20">
                    <p className="text-gray-700 text-sm mb-2">
                      Ваш баланс: <span className="text-[#8A5A3F] font-bold">{userBalance} ₽</span>
                    </p>
                    <label className="text-gray-700 text-xs mb-1 block">Списать бонусов (макс. {maxBonusUsable}):</label>
                    <input
                      type="number"
                      min="0"
                      max={maxBonusUsable}
                      className="w-full p-2 bg-white border border-[#385144]/30 rounded-lg text-[#385144] text-lg font-bold focus:outline-none focus:border-[#385144]"
                      value={bonusAmount}
                      onChange={(e) => {
                        let val = Number(e.target.value);
                        if (val > maxBonusUsable) val = maxBonusUsable;
                        if (val < 0) val = 0;
                        setBonusAmount(val);
                      }}
                    />
                    <div className="flex justify-between mt-2 text-sm">
                      <span className="text-gray-400 line-through">Итого: {originalPrice} ₽</span>
                      <span className="text-[#4ADE80] font-bold">К оплате: {finalPrice} ₽</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <label className="text-[#385144] font-bold text-sm mb-2 block flex items-center">
              <MessageSquare className="w-4 h-4 mr-2" />
              Комментарий (необязательно)
            </label>
            <textarea
              rows={3}
              className="w-full p-3 bg-[#F8F5F2] border border-gray-200 rounded-lg text-gray-700 placeholder-gray-400 focus:outline-none focus:border-[#385144]"
              placeholder="Расскажите кратко о вашем вопросе..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="flex-1 bg-gray-200 text-gray-700 p-4 rounded-xl font-bold hover:bg-gray-300 transition">Назад</button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 bg-[#385144] text-white p-4 rounded-xl font-bold hover:bg-[#2d4238] transition disabled:opacity-50"
            >
              {loading ? 'Отправка...' : 'Подтвердить запись'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
