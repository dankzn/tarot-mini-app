import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  CreditCard,
  Heart,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Star,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PaymentMethod {
  id: string;
  title: string;
  payment_url: string;
  instructions?: string | null;
}

const BOT_URL = 'https://t.me/danil_tarot_bot';

const consultationFormats = [
  {
    title: 'Личная консультация',
    text: 'Бережный разбор ситуации: отношения, выбор, состояние, деньги, работа или внутренний тупик.',
  },
  {
    title: 'Глубокий расклад',
    text: 'Когда важно увидеть структуру происходящего, не застрять в тревоге и собрать понятный план действий.',
  },
  {
    title: 'Карта дня',
    text: 'Отдельный короткий формат — не про отношения и не про работу, а про мягкий ориентир на день.',
  },
];

const academyFormats = [
  'Индивидуальное базовое обучение — 20 000 ₽',
  'Индивидуальное расширенное обучение — 40 000 ₽',
  'Групповое базовое обучение — 11 500 ₽ / с человека',
];

const principles = [
  'Без осуждения и давления',
  'Конфиденциально',
  'С опорой на реальность',
  'С понятным следующим шагом',
];

const openExternal = (url: string) => {
  window.open(url, '_blank', 'noopener,noreferrer');
};

export const StudioLanding = () => {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  useEffect(() => {
    const loadPaymentMethods = async () => {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('id, title, payment_url, instructions')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .limit(3);

      if (!error) setPaymentMethods(data || []);
    };

    loadPaymentMethods();
  }, []);

  const primaryPaymentMethod = useMemo(() => paymentMethods[0] || null, [paymentMethods]);

  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,#E7EFE7_0,#F8F3EC_42%,#EFE6DA_100%)] text-[#2F463B]">
      <section className="relative px-5 pb-16 pt-6 md:px-10 lg:px-16">
        <div className="mx-auto max-w-7xl">
          <header className="mb-10 flex items-center justify-between gap-4 rounded-[2rem] border border-white/80 bg-white/50 px-4 py-3 shadow-[0_18px_48px_rgba(56,81,68,0.08)] backdrop-blur">
            <a href="#top" className="flex items-center gap-3">
              <img src="/logo.png" alt="Tarot by Danil" className="h-12 w-12 rounded-2xl object-cover shadow-sm" />
              <div>
                <p className="luxury-kicker">Tarot Studio</p>
                <p className="font-black text-[#385144]">Tarot by Danil</p>
              </div>
            </a>
            <nav className="hidden items-center gap-6 text-sm font-black text-[#5E675D] md:flex">
              <a href="#consultations" className="hover:text-[#385144]">Консультации</a>
              <a href="#academy" className="hover:text-[#385144]">Обучение</a>
              <a href="#payment" className="hover:text-[#385144]">Оплата</a>
            </nav>
            <button
              onClick={() => openExternal(BOT_URL)}
              className="rounded-full bg-[#385144] px-5 py-3 text-sm font-black text-white shadow-[0_14px_34px_rgba(56,81,68,0.22)]"
            >
              Записаться
            </button>
          </header>

          <div id="top" className="grid items-center gap-8 lg:grid-cols-[1.08fr_0.92fr]">
            <div className="relative">
              <div className="absolute -left-10 top-12 h-44 w-44 rounded-full bg-[#B8795C]/10 blur-3xl" />
              <div className="relative rounded-[3rem] border border-white/85 bg-[#385144] p-7 text-white shadow-[0_30px_90px_rgba(56,81,68,0.24)] md:p-10">
                <p className="mb-5 text-xs font-black uppercase tracking-[0.34em] text-[#F4E7C8]/80">
                  Personal Tarot Space
                </p>
                <h1 className="max-w-4xl text-5xl font-black leading-[0.95] tracking-tight md:text-7xl">
                  Таро-студия, где становится спокойнее и понятнее.
                </h1>
                <p className="mt-6 max-w-2xl text-lg font-bold leading-relaxed text-white/78 md:text-xl">
                  Консультации, обучение и личная практика без мистического шума: бережно, честно и с уважением к вашему состоянию.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <button
                    onClick={() => openExternal(BOT_URL)}
                    className="inline-flex items-center justify-center rounded-2xl bg-white px-6 py-4 font-black text-[#385144]"
                  >
                    Открыть mini app
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </button>
                  <a
                    href="#academy"
                    className="inline-flex items-center justify-center rounded-2xl border border-white/25 px-6 py-4 font-black text-white"
                  >
                    Посмотреть обучение
                  </a>
                </div>
                <div className="mt-9 grid gap-3 sm:grid-cols-3">
                  {['3+ года практики', '2 направления', 'ручная оплата Т-Банк'].map(item => (
                    <div key={item} className="rounded-2xl bg-white/10 p-4">
                      <Sparkles className="mb-3 h-5 w-5 text-[#F4E7C8]" />
                      <p className="font-black">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="premium-surface rounded-[2.5rem] p-6">
                <div className="premium-content">
                  <p className="luxury-kicker mb-2">studio method</p>
                  <h2 className="text-3xl font-black text-[#385144]">Не предсказание ради страха, а разговор ради ясности.</h2>
                  <div className="mt-5 grid gap-3">
                    {principles.map(item => (
                      <div key={item} className="flex items-center gap-3 rounded-2xl bg-white/72 p-4 font-black text-[#385144]">
                        <CheckCircle2 className="h-5 w-5 text-[#B8795C]" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[2rem] bg-white/70 p-5 shadow-sm">
                  <Heart className="mb-4 h-7 w-7 text-[#B8795C]" />
                  <p className="text-xl font-black text-[#385144]">Для бережного разбора</p>
                  <p className="mt-2 font-semibold leading-relaxed text-[#657066]">Когда нужно не “угадать”, а увидеть несколько сценариев и выбрать опору.</p>
                </div>
                <div className="rounded-[2rem] bg-white/70 p-5 shadow-sm">
                  <BookOpen className="mb-4 h-7 w-7 text-[#B8795C]" />
                  <p className="text-xl font-black text-[#385144]">Для обучения Таро</p>
                  <p className="mt-2 font-semibold leading-relaxed text-[#657066]">Индивидуальные и групповые форматы с домашками, практикой и кабинетом ученика.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="consultations" className="px-5 py-14 md:px-10 lg:px-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="luxury-kicker mb-2">consultations</p>
              <h2 className="text-4xl font-black text-[#385144] md:text-5xl">Консультации</h2>
            </div>
            <p className="max-w-xl text-lg font-bold leading-relaxed text-[#657066]">
              Все форматы подбираются в mini app: можно выбрать самому или пройти короткий подбор.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {consultationFormats.map((format, index) => (
              <article key={format.title} className="premium-surface rounded-[2.25rem] p-6">
                <div className="premium-content">
                  <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#385144] text-white">
                    {index + 1}
                  </div>
                  <h3 className="text-2xl font-black text-[#385144]">{format.title}</h3>
                  <p className="mt-4 font-semibold leading-relaxed text-[#657066]">{format.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="academy" className="px-5 py-14 md:px-10 lg:px-16">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[2.75rem] bg-[#385144] p-7 text-white md:p-9">
            <p className="mb-4 text-xs font-black uppercase tracking-[0.34em] text-[#F4E7C8]/80">Tarot Academy</p>
            <h2 className="text-4xl font-black leading-tight md:text-5xl">Обучение Таро как понятная система.</h2>
            <p className="mt-5 text-lg font-bold leading-relaxed text-white/78">
              Для тех, кто хочет читать карты не хаотично, а структурно: уроки, домашние задания, журнал группы и личный кабинет ученика.
            </p>
            <button
              onClick={() => openExternal(BOT_URL)}
              className="mt-8 inline-flex items-center rounded-2xl bg-white px-6 py-4 font-black text-[#385144]"
            >
              Оставить заявку на обучение
              <ArrowRight className="ml-2 h-5 w-5" />
            </button>
          </div>

          <div className="grid gap-4">
            {academyFormats.map(item => (
              <div key={item} className="rounded-[2rem] border border-white/80 bg-white/78 p-5 shadow-[0_16px_44px_rgba(56,81,68,0.08)]">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EAF1EA] text-[#385144]">
                    <Star className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xl font-black text-[#385144]">{item}</p>
                    <p className="mt-2 font-semibold leading-relaxed text-[#657066]">
                      Полное описание и программа открываются после зачисления — на сайте оставляем красивый, честный первый слой.
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="payment" className="px-5 py-14 md:px-10 lg:px-16">
        <div className="mx-auto max-w-7xl rounded-[2.75rem] border border-white/80 bg-white/70 p-7 shadow-[0_22px_70px_rgba(56,81,68,0.1)] md:p-9">
          <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div>
              <p className="luxury-kicker mb-2">payment flow</p>
              <h2 className="text-4xl font-black text-[#385144] md:text-5xl">Оплата через Т-Банк — без тяжёлого эквайринга.</h2>
              <p className="mt-5 text-lg font-bold leading-relaxed text-[#657066]">
                Пока используем ручную оплату по ссылке: клиент записывается в mini app, получает сумму, переходит по кнопке оплаты и отмечает оплату. Админ подтверждает поступление — после этого начисляются бонусы и закрывается консультация.
              </p>
            </div>

            <div className="rounded-[2.25rem] bg-[#F8F3EC] p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#385144] text-white">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-black text-[#385144]">Способ оплаты</p>
                  <p className="text-sm font-bold text-[#657066]">Управляется в админке</p>
                </div>
              </div>

              {primaryPaymentMethod ? (
                <div className="space-y-3">
                  <div className="rounded-2xl bg-white p-4">
                    <p className="text-sm font-black uppercase tracking-[0.18em] text-[#B8795C]">активно</p>
                    <p className="mt-1 text-2xl font-black text-[#385144]">{primaryPaymentMethod.title}</p>
                    {primaryPaymentMethod.instructions && (
                      <p className="mt-2 font-semibold leading-relaxed text-[#657066]">{primaryPaymentMethod.instructions}</p>
                    )}
                  </div>
                  <button
                    onClick={() => openExternal(primaryPaymentMethod.payment_url)}
                    className="flex w-full items-center justify-center rounded-2xl bg-[#385144] px-5 py-4 font-black text-white"
                  >
                    Открыть ссылку оплаты
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-[#B8795C]/35 bg-white/70 p-5">
                  <p className="font-black text-[#385144]">Ссылка оплаты пока не настроена</p>
                  <p className="mt-2 font-semibold leading-relaxed text-[#657066]">
                    Добавь ссылку накопительного счёта Т-Банка в разделе способов оплаты — сайт и mini app подтянут её автоматически.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 pb-16 pt-8 md:px-10 lg:px-16">
        <div className="mx-auto max-w-7xl rounded-[2.75rem] bg-[#385144] p-7 text-white md:p-9">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-[0.34em] text-[#F4E7C8]/80">next step</p>
              <h2 className="text-4xl font-black md:text-5xl">Начать можно мягко — с одного сообщения.</h2>
              <p className="mt-4 max-w-2xl text-lg font-bold leading-relaxed text-white/75">
                Открой mini app, выбери консультацию или обучение — дальше всё будет собрано в личном кабинете.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:w-[440px]">
              <button onClick={() => openExternal(BOT_URL)} className="rounded-2xl bg-white px-5 py-4 font-black text-[#385144]">
                <CalendarCheck className="mb-2 h-5 w-5" />
                Записаться
              </button>
              <button onClick={() => openExternal(BOT_URL)} className="rounded-2xl bg-white/10 px-5 py-4 text-left font-black text-white">
                <MessageCircle className="mb-2 h-5 w-5" />
                Написать в бот
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer className="px-5 pb-8 text-center text-sm font-bold text-[#657066]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 border-t border-[#385144]/10 pt-6 md:flex-row">
          <p>© Tarot by Danil</p>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#B8795C]" />
            Конфиденциально · бережно · без давления
          </div>
        </div>
      </footer>
    </main>
  );
};

export default StudioLanding;
