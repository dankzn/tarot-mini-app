import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import './CalendarStyles.css';
import { format, addMinutes, isBefore, startOfDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ArrowLeft, Calendar as CalendarIcon, Clock, Sparkles, MessageSquare, X } from 'lucide-react';
import { notifyAdminNewBooking } from '../lib/notifications';
import { formatCountdown, getServicePriceState } from '../lib/serviceCampaigns';

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

const backButtonClassName = 'inline-flex items-center rounded-2xl border border-[#385144]/15 bg-white px-4 py-2.5 text-sm font-black text-[#385144] shadow-[0_10px_24px_rgba(56,81,68,0.12)] transition hover:bg-[#EAF1EA] active:scale-[0.98]';
const PRIORITY_BOOKING_FEE = 150;

export const BookingForm = ({ user, service, onSuccess, onCancel }: BookingFormProps) => {
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);
  const [allSlots, setAllSlots] = useState<TimeSlot[]>([]);
  const [notes, setNotes] = useState('');
  const [mainQuestion, setMainQuestion] = useState('');
  const [desiredResult, setDesiredResult] = useState('');
  const [step, setStep] = useState(1);
  const [isPriorityRequest, setIsPriorityRequest] = useState(false);

  const [useBonuses, setUseBonuses] = useState(false);
  const [bonusAmount, setBonusAmount] = useState(0);
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<any>(null);
  const [promoError, setPromoError] = useState('');

  const duration = service.duration_minutes || 60;
  const priceState = getServicePriceState(service);
  const originalPrice = priceState.currentPrice;
  const userBalance = user.bonus_balance || 0;
  const campaignCountdown = formatCountdown(priceState.countdownTarget);

  const promoDiscount = appliedPromo?.discount || 0;
  const priceAfterPromo = Math.max(0, originalPrice - promoDiscount);
  const maxBonusUsable = Math.min(userBalance, Math.floor(priceAfterPromo * 0.5));
  const priorityFee = isPriorityRequest ? PRIORITY_BOOKING_FEE : 0;
  const finalPrice = Math.max(0, (useBonuses ? priceAfterPromo - bonusAmount : priceAfterPromo) + priorityFee);

  useEffect(() => {
    if (selectedDate) {
      loadAllSlots();
    }
  }, [selectedDate, service.id]);

  useEffect(() => {
    if (bonusAmount > maxBonusUsable) {
      setBonusAmount(maxBonusUsable);
    }
  }, [bonusAmount, maxBonusUsable]);

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
    setIsPriorityRequest(false);
    setSelectedTime(slotOption.time);
    setSelectedSlotIds(slotOption.slotIds);
    setStep(3);
  };

  const handlePriorityRequest = () => {
    setIsPriorityRequest(true);
    setSelectedTime(null);
    setSelectedSlotIds([]);
    setStep(3);
  };

  const applyPromoCode = async () => {
    const normalizedCode = promoCode.trim().toUpperCase();
    setPromoError('');
    setAppliedPromo(null);

    if (!normalizedCode) return;

    const { data: promo, error } = await supabase
      .from('promo_codes')
      .select('*')
      .ilike('code', normalizedCode)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !promo) {
      setPromoError('Промокод не найден или уже не действует');
      return;
    }

    const now = new Date();
    if (promo.starts_at && new Date(promo.starts_at) > now) {
      setPromoError('Промокод ещё не начал действовать');
      return;
    }
    if (promo.expires_at && new Date(promo.expires_at) < now) {
      setPromoError('Срок действия промокода закончился');
      return;
    }

    const { data: usedByUser } = await supabase
      .from('promo_code_redemptions')
      .select('id')
      .eq('promo_code_id', promo.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (usedByUser) {
      setPromoError('Этот промокод уже использован');
      return;
    }

    if (promo.max_uses) {
      const { count } = await supabase
        .from('promo_code_redemptions')
        .select('id', { count: 'exact', head: true })
        .eq('promo_code_id', promo.id);

      if ((count || 0) >= promo.max_uses) {
        setPromoError('Лимит использований промокода закончился');
        return;
      }
    }

    const discount = promo.discount_type === 'percent'
      ? Math.floor(originalPrice * (promo.discount_value / 100))
      : promo.discount_value;

    setAppliedPromo({
      ...promo,
      code: normalizedCode,
      discount: Math.max(0, Math.min(originalPrice, discount)),
    });
    setBonusAmount(current => Math.min(current, maxBonusUsable));
  };

  const handleSubmit = async () => {
    if (!selectedDate) return;
    if (!isPriorityRequest && (!selectedTime || selectedSlotIds.length === 0)) return;

    setLoading(true);

    try {
      let bookingDateTime: Date | null = null;

      if (!isPriorityRequest && selectedTime) {
        const [hours, minutes] = selectedTime.split(':').map(Number);
        bookingDateTime = new Date(selectedDate);
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
      }

      const preparedNotes = [
        mainQuestion.trim() ? `Что важно обсудить: ${mainQuestion.trim()}` : '',
        desiredResult.trim() ? `Желаемый результат: ${desiredResult.trim()}` : '',
        notes.trim() ? `Комментарий: ${notes.trim()}` : '',
      ].filter(Boolean).join('\n\n');

      const { data: consultationData, error: consultError } = await supabase
        .from('consultations')
        .insert([
          {
            user_id: user.id,
            service_id: service.id,
            scheduled_at: bookingDateTime?.toISOString() || null,
            requested_date: selectedDate.toISOString().slice(0, 10),
            requested_time_text: isPriorityRequest ? 'Приоритетная заявка без окна' : selectedTime,
            scheduling_status: isPriorityRequest ? 'needs_admin_time' : 'scheduled',
            notes: preparedNotes,
            price: finalPrice,
            payment_amount: finalPrice,
            payment_status: 'unpaid',
            priority_fee: priorityFee,
            bonus_used: useBonuses ? bonusAmount : 0,
            promo_code_id: appliedPromo?.id || null,
            promo_code: appliedPromo?.code || null,
            promo_discount: promoDiscount,
            status: 'pending',
          }
        ])
        .select('id')
        .single();

      if (consultError) {
        if (!isPriorityRequest && selectedSlotIds.length > 0) {
          await supabase
            .from('time_slots')
            .update({
              is_booked: false,
              booked_by: null,
            })
            .in('id', selectedSlotIds);
        }

        throw consultError;
      }

      if (appliedPromo?.id && consultationData?.id) {
        const { error: promoUseError } = await supabase
          .from('promo_code_redemptions')
          .insert([
            {
              promo_code_id: appliedPromo.id,
              user_id: user.id,
              consultation_id: consultationData.id,
            },
          ]);

        if (promoUseError) {
          console.error('❌ Не удалось отметить промокод использованным:', promoUseError);
        }
      }

      // Отправляем уведомление всем админам с Telegram ID, но не блокируем запись
      const { data: adminsData, error: adminsError } = await supabase
        .from('users')
        .select('telegram_id')
        .eq('role', 'admin')
        .not('telegram_id', 'is', null);

      const adminTelegramIds = adminsError ? [] : Array.from(
        new Set((adminsData || []).map(admin => admin.telegram_id).filter(Boolean))
      );

      if (adminsError) {
        console.error('❌ Не удалось загрузить админов для уведомления:', adminsError);
      }

      const notificationResult = await notifyAdminNewBooking(
        adminTelegramIds,
        user.name || 'Клиент',
        user.username || null,
        service.title,
        bookingDateTime
          ? format(bookingDateTime, 'dd MMMM yyyy HH:mm', { locale: ru })
          : `${format(selectedDate, 'dd MMMM yyyy', { locale: ru })} • приоритетная заявка без окна`,
        finalPrice
      );

      if (!notificationResult.ok) {
        console.error('❌ Уведомление админу не отправлено:', notificationResult.error);
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
  const stepLabels = ['Дата', 'Время', 'Детали'];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#E7EFE7_0,#F8F3EC_42%,#EFE6DA_100%)] p-4 text-[#2F463B]">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#8A5A3F]/70">
            booking
          </p>
          <h2 className="text-2xl font-black text-[#385144]">Запись на консультацию</h2>
        </div>
        <button onClick={onCancel} className="rounded-2xl bg-white/80 p-3 text-gray-500 shadow-sm transition hover:text-[#385144]">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-2">
        {stepLabels.map((label, index) => {
          const stepNumber = index + 1;
          const isActive = step === stepNumber;
          const isDone = step > stepNumber;

          return (
            <div
              key={label}
              className={`rounded-2xl border p-3 text-center text-xs font-black transition ${
                isActive || isDone
                  ? 'border-[#385144]/20 bg-[#385144] text-white shadow-[0_10px_24px_rgba(56,81,68,0.16)]'
                  : 'border-white/80 bg-white/70 text-[#6C756C]'
              }`}
            >
              <span className="mb-1 block text-[10px] opacity-75">0{stepNumber}</span>
              {label}
            </div>
          );
        })}
      </div>

      <div className="mb-6 rounded-[1.75rem] border border-white/80 bg-gradient-to-br from-[#FFF9F0] via-white to-[#EAF1EA] p-5 shadow-[0_16px_40px_rgba(56,81,68,0.10)]">
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1 pr-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#8A5A3F]/70">
              выбранный формат
            </p>
            <h3 className="text-[#385144] font-black text-xl leading-tight">{service.title}</h3>
          </div>
          <div className="text-right ml-3">
            {useBonuses && bonusAmount > 0 ? (
              <div className="flex flex-col items-end">
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#8FA092]">с бонусами</span>
                <span className="text-[#8A5A3F] font-bold text-xl">{finalPrice} ₽</span>
              </div>
            ) : priceState.currentPrice !== priceState.basePrice ? (
              <div className="flex flex-col items-end">
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#B8795C]">акция</span>
                <span className="text-[#8A5A3F] font-bold text-xl">{originalPrice} ₽</span>
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
        {campaignCountdown && (
          <div className={`mt-4 overflow-hidden rounded-[1.25rem] border p-4 ${
            priceState.isPromoActive
              ? 'border-[#B8795C]/25 bg-[#FFF1E8]'
              : 'border-[#385144]/15 bg-[#EAF1EA]'
          }`}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${
                priceState.isPromoActive
                  ? 'bg-[#B8795C] text-white'
                  : 'bg-[#385144] text-white'
              }`}>
                <Sparkles className="mr-1 h-3 w-3" />
                {priceState.isPromoActive ? 'Акция действует' : 'Цена скоро изменится'}
              </span>
              <span className="rounded-full bg-white/75 px-3 py-1 text-xs font-black text-[#385144]">
                {campaignCountdown}
              </span>
            </div>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-sm font-black text-[#385144]">
                  {priceState.isPromoActive ? priceState.promoTitle : 'Можно записаться по текущей цене'}
                </p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#8A5A3F]/75">
                  {priceState.countdownLabel}
                </p>
              </div>
              <div className="text-right">
                {priceState.isPromoActive ? (
                  <>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[#B8795C]">успейте записаться</p>
                    <p className="text-xl font-black text-[#B8795C]">{priceState.currentPrice} ₽</p>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-bold text-[#385144]">Цена скоро изменится</p>
                    <p className="text-[11px] font-semibold text-[#6C756C]">Лучше записаться заранее</p>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3">
        <div className="rounded-[1.5rem] border border-white/80 bg-white/70 p-4 shadow-sm">
          <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-[#8A5A3F]/70">
            как подготовиться
          </p>
          <div className="grid gap-2 text-sm leading-relaxed text-[#59645C]">
            <span>— можно кратко описать вопрос в комментарии;</span>
            <span>— если формулировки нет, достаточно выбрать тему и время;</span>
            <span>— после заявки я подтвержу запись лично.</span>
          </div>
        </div>
      </div>

      {step === 1 && (
        <div className="bg-white/85 rounded-[1.75rem] p-5 shadow-sm border border-white/80">
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
        <div className="bg-white/85 rounded-[1.75rem] p-5 shadow-sm border border-white/80">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[#385144] font-bold flex items-center">
              <Clock className="w-5 h-5 mr-2" />
              {selectedDate ? format(selectedDate, 'd MMMM yyyy', { locale: ru }) : ''}
            </h3>
            <button onClick={() => setStep(1)} className={backButtonClassName}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Назад
            </button>
          </div>

          {availableSlotOptions.length === 0 ? (
            <div className="space-y-4 text-center py-6">
              <div className="rounded-[1.5rem] border border-[#B8795C]/20 bg-[#FFF6EF] p-5">
                <Sparkles className="mx-auto mb-3 h-7 w-7 text-[#B8795C]" />
                <p className="font-black text-[#385144]">На эту дату свободных окон нет</p>
                <p className="mt-2 text-sm leading-relaxed text-[#6C756C]">
                  Можно оставить приоритетную заявку — я предложу время лично в личном кабинете.
                </p>
              </div>
              <button
                onClick={handlePriorityRequest}
                className="w-full rounded-2xl bg-[#385144] px-4 py-4 font-black text-white shadow-[0_14px_30px_rgba(56,81,68,0.18)]"
              >
                Записаться приоритетно
              </button>
              <button onClick={() => setStep(1)} className="w-full rounded-2xl bg-white px-4 py-3 font-black text-[#385144] shadow-sm">
                Выбрать другую дату
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {availableSlotOptions.map((slotOption) => (
                  <button
                    key={slotOption.id}
                    onClick={() => handleTimeSelect(slotOption)}
                    className="p-3 rounded-2xl font-bold transition bg-[#385144] text-white hover:bg-[#2d4238] shadow-sm"
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
                      className="p-3 rounded-2xl font-bold bg-gray-200 text-gray-400 cursor-not-allowed"
                    >
                      {slotTime}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={handlePriorityRequest}
                className="w-full rounded-2xl border border-[#385144]/15 bg-white px-4 py-3 text-sm font-black text-[#385144] shadow-sm"
              >
                Не подходит время — оставить приоритетную заявку
              </button>
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-white/85 rounded-[1.75rem] p-5 shadow-sm border border-white/80">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[#385144] font-bold">Подтверждение</h3>
              <button onClick={() => setStep(2)} className={backButtonClassName}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Назад
              </button>
            </div>

            <div className="space-y-3 mb-4">
              <div className="flex items-center text-gray-700">
                <CalendarIcon className="w-5 h-5 mr-3 text-[#385144]" />
                <span>{selectedDate ? format(selectedDate, 'd MMMM yyyy', { locale: ru }) : ''}</span>
              </div>
              <div className="flex items-center text-gray-700">
                <Clock className="w-5 h-5 mr-3 text-[#385144]" />
                <span>{isPriorityRequest ? 'Время предложит администратор' : selectedTime}</span>
              </div>
              <div className="flex items-center text-gray-700">
                <span className="text-[#8A5A3F]">₽</span>
                <span className="font-bold">{finalPrice} ₽</span>
              </div>
            </div>

            {isPriorityRequest && (
              <div className="mb-4 rounded-[1.25rem] border border-[#B8795C]/25 bg-[#FFF6EF] p-4">
                <p className="text-sm font-black text-[#385144]">Приоритетная заявка</p>
                <p className="mt-1 text-sm leading-relaxed text-[#6C756C]">
                  К стоимости добавляется сервисный сбор за запись вне открытых окон: +{PRIORITY_BOOKING_FEE} ₽.
                </p>
              </div>
            )}

            <div className="mb-4 rounded-[1.25rem] border border-[#385144]/10 bg-[#F8F5F2] p-4">
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#8A5A3F]">
                Промокод
              </label>
              <div className="flex gap-2">
                <input
                  className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 font-bold uppercase text-[#385144] outline-none focus:border-[#385144]"
                  placeholder="Введите код"
                  value={promoCode}
                  onChange={(event) => {
                    setPromoCode(event.target.value);
                    setAppliedPromo(null);
                    setPromoError('');
                  }}
                />
                <button
                  type="button"
                  onClick={applyPromoCode}
                  className="rounded-xl bg-[#385144] px-4 py-2 text-sm font-black text-white"
                >
                  ОК
                </button>
              </div>
              {appliedPromo && (
                <p className="mt-2 text-sm font-bold text-[#385144]">
                  Промокод применён: −{promoDiscount} ₽
                </p>
              )}
              {promoError && (
                <p className="mt-2 text-sm font-bold text-red-600">{promoError}</p>
              )}
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
                    <label className="text-gray-700 text-xs mb-1 block">
                      Списать бонусов: максимум 50% стоимости ({maxBonusUsable} ₽)
                    </label>
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
                    <div className="flex justify-end mt-2 text-sm">
                      <span className="text-[#4ADE80] font-bold">К оплате: {finalPrice} ₽</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white/85 rounded-[1.75rem] p-5 shadow-sm border border-white/80">
            <label className="text-[#385144] font-bold text-sm mb-2 block flex items-center">
              <MessageSquare className="w-4 h-4 mr-2" />
              Подготовка к консультации
            </label>
            <div className="mb-3 grid gap-3">
              <input
                className="w-full rounded-lg border border-gray-200 bg-[#F8F5F2] p-3 text-gray-700 placeholder-gray-400 focus:border-[#385144] focus:outline-none"
                placeholder="Что важно обсудить?"
                value={mainQuestion}
                onChange={(e) => setMainQuestion(e.target.value)}
              />
              <input
                className="w-full rounded-lg border border-gray-200 bg-[#F8F5F2] p-3 text-gray-700 placeholder-gray-400 focus:border-[#385144] focus:outline-none"
                placeholder="Какой результат хочется получить?"
                value={desiredResult}
                onChange={(e) => setDesiredResult(e.target.value)}
              />
            </div>
            <textarea
              rows={3}
              className="w-full p-3 bg-[#F8F5F2] border border-gray-200 rounded-lg text-gray-700 placeholder-gray-400 focus:outline-none focus:border-[#385144]"
              placeholder="Дополнительный комментарий, если хочется..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="rounded-[1.5rem] border border-[#385144]/10 bg-[#EAF1EA] p-4">
            <p className="mb-2 text-sm font-black text-[#385144]">Что будет дальше</p>
            <div className="grid grid-cols-4 gap-2">
              {['Заявка', 'Подтверждение', 'Консультация', 'Рекомендации'].map((label, index) => (
                <div key={label} className="text-center">
                  <div className={`mx-auto mb-2 h-2 rounded-full ${index === 0 ? 'bg-[#385144]' : 'bg-[#C9D8CD]'}`} />
                  <p className={`text-[10px] font-black leading-tight ${index === 0 ? 'text-[#385144]' : 'text-[#6C756C]'}`}>
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="flex-1 rounded-2xl border border-[#385144]/15 bg-white p-4 font-black text-[#385144] shadow-[0_10px_24px_rgba(56,81,68,0.10)] transition hover:bg-[#EAF1EA]">
              Назад
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 bg-[#385144] text-white p-4 rounded-2xl font-bold hover:bg-[#2d4238] transition disabled:opacity-50 shadow-[0_12px_28px_rgba(56,81,68,0.20)]"
            >
              {loading ? 'Отправка...' : 'Подтвердить запись'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
