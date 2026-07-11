import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Gem,
  HeartHandshake,
  LogOut,
  MessageCircle,
  Moon,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PaymentMethod {
  id: string;
  title: string;
  payment_url: string;
  instructions?: string | null;
}

interface SiteUser {
  id: string;
  telegram_id: number;
  username?: string | null;
  name: string;
  city?: string | null;
  status?: string | null;
  bonus_balance?: number | null;
  role?: string | null;
  personal_tarologist_until?: string | null;
}

const BOT_URL = 'https://t.me/danil_tarot_bot';
const BOT_USERNAME = (import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'danil_tarot_bot').replace('@', '');

const consultations = [
  {
    title: 'Консультации',
    text: 'Бережный разбор отношений, выбора, состояния, денег, работы или внутреннего тупика.',
    meta: 'личный формат',
  },
  {
    title: 'Глубокий разбор',
    text: 'Когда нужно увидеть структуру ситуации, несколько сценариев и собрать понятный план действий.',
    meta: 'для сложного запроса',
  },
  {
    title: 'Карта дня',
    text: 'Короткий самостоятельный формат: мягкий ориентир на день без привязки к отношениям или работе.',
    meta: 'daily ritual',
  },
];

const academy = [
  { title: 'Индивидуальное базовое', price: '20 000 ₽', text: 'Личная траектория, база Таро, первые расклады и спокойная практика.' },
  { title: 'Индивидуальное расширенное', price: '40 000 ₽', text: 'Глубже в структуру, практику, трактовки, этику чтения и уверенную работу.' },
  { title: 'Групповое базовое', price: '11 500 ₽ / с человека', text: 'Камерная группа, общий ритм, домашние задания и практика в парах.' },
];

const studioPrinciples = [
  'без мистического давления',
  'конфиденциально',
  'с уважением к состоянию',
  'с понятным следующим шагом',
];

const openExternal = (url: string) => {
  window.open(url, '_blank', 'noopener,noreferrer');
};

const TelegramLoginWidget = ({ onReady }: { onReady?: () => void }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    containerRef.current.innerHTML = '';
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', BOT_USERNAME);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '18');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-userpic', 'false');
    script.setAttribute('data-auth-url', `${window.location.origin}/api/site/telegram-login`);
    script.onload = () => onReady?.();

    containerRef.current.appendChild(script);
  }, [onReady]);

  return <div ref={containerRef} className="min-h-[44px]" />;
};

export const StudioLanding = () => {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [user, setUser] = useState<SiteUser | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [authFailed, setAuthFailed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setAuthFailed(params.get('auth') === 'failed');

    if (params.has('auth')) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    const loadSiteData = async () => {
      const [sessionResponse, paymentResponse] = await Promise.all([
        fetch('/api/site/session').then((response) => response.json()).catch(() => null),
        supabase
          .from('payment_methods')
          .select('id, title, payment_url, instructions')
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
          .limit(3),
      ]);

      if (sessionResponse?.authenticated) setUser(sessionResponse.user);
      if (!paymentResponse.error) setPaymentMethods(paymentResponse.data || []);
      setSessionLoading(false);
    };

    loadSiteData();
  }, []);

  const primaryPaymentMethod = useMemo(() => paymentMethods[0] || null, [paymentMethods]);
  const userLabel = user?.username ? `@${user.username}` : user?.telegram_id ? `ID ${user.telegram_id}` : 'Telegram';

  const logout = async () => {
    await fetch('/api/site/logout', { method: 'POST' }).catch(() => null);
    setUser(null);
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#F7F0E7] text-[#263D33]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(217,229,218,0.85),transparent_30%),radial-gradient(circle_at_88%_18%,rgba(184,121,92,0.18),transparent_24%),linear-gradient(135deg,#FBF7EF_0%,#EDE2D4_100%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(47,70,59,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(47,70,59,0.1)_1px,transparent_1px)] [background-size:64px_64px]" />

      <div className="relative z-10">
        <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 md:px-10 lg:px-14">
          <a href="#home" className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#263D33] text-white shadow-[0_18px_40px_rgba(38,61,51,0.18)]">
              <Moon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.32em] text-[#A97861]">Tarot Studio</p>
              <p className="text-lg font-black text-[#263D33]">by Danil</p>
            </div>
          </a>

          <nav className="hidden items-center gap-7 text-sm font-black text-[#5F6B62] lg:flex">
            <a href="#method" className="hover:text-[#263D33]">Подход</a>
            <a href="#consultations" className="hover:text-[#263D33]">Консультации</a>
            <a href="#academy" className="hover:text-[#263D33]">Академия</a>
            <a href="#payment" className="hover:text-[#263D33]">Оплата</a>
          </nav>

          <div className="flex items-center gap-3">
            {user ? (
              <button
                onClick={logout}
                className="hidden items-center gap-2 rounded-full bg-white/65 px-4 py-3 text-sm font-black text-[#263D33] shadow-sm backdrop-blur md:flex"
              >
                <LogOut className="h-4 w-4" />
                Выйти
              </button>
            ) : null}
            <a href="#login" className="rounded-full bg-[#263D33] px-5 py-3 text-sm font-black text-white shadow-[0_16px_40px_rgba(38,61,51,0.2)]">
              {user ? 'Кабинет' : 'Войти через Telegram'}
            </a>
          </div>
        </header>

        <section id="home" className="mx-auto grid max-w-7xl gap-8 px-5 pb-16 pt-8 md:px-10 lg:grid-cols-[1.08fr_0.92fr] lg:px-14 lg:pt-14">
          <div className="rounded-[3.25rem] bg-[#263D33] p-7 text-white shadow-[0_34px_110px_rgba(38,61,51,0.28)] md:p-11">
            <p className="mb-5 text-xs font-black uppercase tracking-[0.42em] text-[#F3E8C8]/80">private practice · tarot academy</p>
            <h1 className="max-w-4xl text-5xl font-black leading-[0.92] tracking-tight md:text-7xl lg:text-8xl">
              Пространство Таро без шума и давления.
            </h1>
            <p className="mt-7 max-w-2xl text-lg font-bold leading-relaxed text-white/78 md:text-xl">
              Консультации, обучение и личная практика в эстетике спокойной ясности: когда важно не напугать себя, а увидеть следующий честный шаг.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a href="#login" className="inline-flex items-center justify-center rounded-2xl bg-white px-6 py-4 font-black text-[#263D33]">
                Войти через Telegram
                <ArrowRight className="ml-2 h-5 w-5" />
              </a>
              <button onClick={() => openExternal(BOT_URL)} className="inline-flex items-center justify-center rounded-2xl border border-white/25 px-6 py-4 font-black text-white">
                Открыть mini app
              </button>
            </div>
          </div>

          <aside id="login" className="grid gap-4">
            <div className="rounded-[2.75rem] border border-white/80 bg-white/68 p-6 shadow-[0_24px_70px_rgba(38,61,51,0.12)] backdrop-blur-xl md:p-8">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.32em] text-[#A97861]">client portal</p>
                  <h2 className="mt-2 text-3xl font-black text-[#263D33]">Личный вход</h2>
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E9F1E8] text-[#263D33]">
                  <UserRound className="h-6 w-6" />
                </div>
              </div>

              {sessionLoading ? (
                <div className="rounded-3xl bg-[#F8F3EC] p-5 font-black text-[#687268]">Проверяю вход...</div>
              ) : user ? (
                <div className="space-y-4">
                  <div className="rounded-3xl bg-[#263D33] p-5 text-white">
                    <p className="text-xs font-black uppercase tracking-[0.24em] text-[#F3E8C8]/75">вы вошли как</p>
                    <p className="mt-2 text-3xl font-black">{user.name}</p>
                    <p className="mt-1 font-bold text-white/65">{userLabel}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-3xl bg-[#F8F3EC] p-4">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#A97861]">статус</p>
                      <p className="mt-2 font-black text-[#263D33]">{user.status || 'Первое знакомство'}</p>
                    </div>
                    <div className="rounded-3xl bg-[#F8F3EC] p-4">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#A97861]">бонусы</p>
                      <p className="mt-2 font-black text-[#263D33]">{Number(user.bonus_balance || 0).toLocaleString('ru-RU')} ₽</p>
                    </div>
                  </div>
                  <button onClick={() => openExternal(BOT_URL)} className="flex w-full items-center justify-center rounded-2xl bg-[#263D33] px-5 py-4 font-black text-white">
                    Перейти к записи и обучению
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="font-bold leading-relaxed text-[#687268]">
                    Авторизация идёт через Telegram: сайт получает ваш Telegram ID и username, создаёт/находит профиль и открывает клиентскую зону.
                  </p>
                  <div className="rounded-3xl border border-[#E3D7CA] bg-[#FBF7EF] p-5">
                    <TelegramLoginWidget />
                    {authFailed && (
                      <p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">
                        Telegram-вход не прошёл. Проверь домен в настройках бота и попробуй ещё раз.
                      </p>
                    )}
                  </div>
                  <p className="text-sm font-bold leading-relaxed text-[#8A948B]">
                    Если кнопка Telegram не появилась, открой mini app через бот — профиль всё равно будет единым.
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-[2rem] bg-white/66 p-5 shadow-sm backdrop-blur">
                <Sparkles className="mb-4 h-6 w-6 text-[#B8795C]" />
                <p className="text-2xl font-black text-[#263D33]">2</p>
                <p className="font-bold text-[#687268]">направления: консультации и академия</p>
              </div>
              <div className="rounded-[2rem] bg-white/66 p-5 shadow-sm backdrop-blur">
                <ShieldCheck className="mb-4 h-6 w-6 text-[#B8795C]" />
                <p className="text-2xl font-black text-[#263D33]">100%</p>
                <p className="font-bold text-[#687268]">бережная конфиденциальность</p>
              </div>
            </div>
          </aside>
        </section>

        <section id="method" className="mx-auto max-w-7xl px-5 py-12 md:px-10 lg:px-14">
          <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.34em] text-[#A97861]">studio method</p>
              <h2 className="mt-3 text-4xl font-black leading-tight text-[#263D33] md:text-6xl">Таро как разговор, а не приговор.</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {studioPrinciples.map((item) => (
                <div key={item} className="rounded-[2rem] border border-white/80 bg-white/66 p-5 shadow-sm backdrop-blur">
                  <CheckCircle2 className="mb-4 h-6 w-6 text-[#B8795C]" />
                  <p className="text-xl font-black text-[#263D33]">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="consultations" className="mx-auto max-w-7xl px-5 py-12 md:px-10 lg:px-14">
          <div className="mb-7 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.34em] text-[#A97861]">readings</p>
              <h2 className="text-4xl font-black text-[#263D33] md:text-6xl">Консультации</h2>
            </div>
            <p className="max-w-xl text-lg font-bold leading-relaxed text-[#687268]">
              Выбор формата, дата, оплата, бонусы и история остаются в mini app — сайт становится красивым входом и кабинетом идентичности.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {consultations.map((item) => (
              <article key={item.title} className="rounded-[2.5rem] border border-white/80 bg-white/70 p-6 shadow-[0_18px_50px_rgba(38,61,51,0.09)] backdrop-blur">
                <p className="mb-6 inline-flex rounded-full bg-[#F4E9DE] px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#8A5A3F]">{item.meta}</p>
                <h3 className="text-3xl font-black text-[#263D33]">{item.title}</h3>
                <p className="mt-4 font-bold leading-relaxed text-[#687268]">{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="academy" className="mx-auto max-w-7xl px-5 py-12 md:px-10 lg:px-14">
          <div className="rounded-[3rem] bg-[#263D33] p-7 text-white shadow-[0_30px_90px_rgba(38,61,51,0.2)] md:p-10">
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
              <div>
                <p className="mb-4 text-xs font-black uppercase tracking-[0.34em] text-[#F3E8C8]/75">tarot academy</p>
                <h2 className="text-4xl font-black leading-tight md:text-6xl">Обучение, где курс не теряется.</h2>
                <p className="mt-5 text-lg font-bold leading-relaxed text-white/75">
                  После зачисления студент видит личный кабинет: план занятий, домашки, посещаемость, дедлайны и статус сдачи.
                </p>
              </div>
              <div className="grid gap-4">
                {academy.map((item) => (
                  <div key={item.title} className="rounded-[2rem] bg-white/10 p-5 ring-1 ring-white/12">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-2xl font-black">{item.title}</p>
                        <p className="mt-2 font-bold leading-relaxed text-white/68">{item.text}</p>
                      </div>
                      <p className="shrink-0 rounded-2xl bg-white px-4 py-3 text-right font-black text-[#263D33]">{item.price}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="payment" className="mx-auto max-w-7xl px-5 py-12 md:px-10 lg:px-14">
          <div className="grid gap-5 lg:grid-cols-[1fr_0.85fr] lg:items-stretch">
            <div className="rounded-[2.75rem] border border-white/80 bg-white/72 p-7 shadow-[0_18px_60px_rgba(38,61,51,0.1)] backdrop-blur md:p-9">
              <p className="text-xs font-black uppercase tracking-[0.34em] text-[#A97861]">payment architecture</p>
              <h2 className="mt-3 text-4xl font-black leading-tight text-[#263D33] md:text-5xl">Т-Банк без тяжёлого эквайринга.</h2>
              <p className="mt-5 text-lg font-bold leading-relaxed text-[#687268]">
                Сайт показывает активный способ оплаты, а рабочий сценарий остаётся контролируемым: клиент оплачивает по ссылке, отмечает оплату, админ подтверждает поступление — только потом начисляются бонусы.
              </p>
              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                {['ссылка управляется в админке', 'нет токена банка на клиенте', 'ручное подтверждение оплаты'].map((item) => (
                  <div key={item} className="rounded-3xl bg-[#F8F3EC] p-4 font-black text-[#263D33]">{item}</div>
                ))}
              </div>
            </div>

            <div className="rounded-[2.75rem] bg-[#F8F3EC] p-6 shadow-inner">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#263D33] text-white">
                  <CreditCard className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-[#A97861]">active method</p>
                  <p className="text-xl font-black text-[#263D33]">Способ оплаты</p>
                </div>
              </div>
              {primaryPaymentMethod ? (
                <div className="space-y-3">
                  <div className="rounded-[2rem] bg-white p-5">
                    <p className="text-2xl font-black text-[#263D33]">{primaryPaymentMethod.title}</p>
                    {primaryPaymentMethod.instructions && <p className="mt-3 font-bold leading-relaxed text-[#687268]">{primaryPaymentMethod.instructions}</p>}
                  </div>
                  <button onClick={() => openExternal(primaryPaymentMethod.payment_url)} className="flex w-full items-center justify-center rounded-2xl bg-[#263D33] px-5 py-4 font-black text-white">
                    Открыть оплату
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </button>
                </div>
              ) : (
                <div className="rounded-[2rem] border border-dashed border-[#B8795C]/35 bg-white/72 p-5 font-bold leading-relaxed text-[#687268]">
                  Добавь ссылку Т-Банка в админке — сайт подтянет её автоматически.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-16 pt-10 md:px-10 lg:px-14">
          <div className="rounded-[3rem] bg-[#263D33] p-7 text-white md:p-10">
            <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="mb-3 text-xs font-black uppercase tracking-[0.34em] text-[#F3E8C8]/75">start softly</p>
                <h2 className="text-4xl font-black md:text-6xl">Начать можно с одного входа через Telegram.</h2>
                <p className="mt-4 max-w-2xl text-lg font-bold leading-relaxed text-white/72">
                  А дальше — консультация, обучение, оплата и кабинет уже собираются в единую систему.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:w-[460px]">
                <a href="#login" className="rounded-2xl bg-white px-5 py-4 font-black text-[#263D33]">
                  <HeartHandshake className="mb-2 h-5 w-5" />
                  Войти на сайт
                </a>
                <button onClick={() => openExternal(BOT_URL)} className="rounded-2xl bg-white/10 px-5 py-4 text-left font-black text-white ring-1 ring-white/15">
                  <MessageCircle className="mb-2 h-5 w-5" />
                  Открыть Telegram
                </button>
              </div>
            </div>
          </div>
        </section>

        <footer className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 border-t border-[#263D33]/10 px-5 py-8 text-sm font-bold text-[#687268] md:flex-row md:px-10 lg:px-14">
          <div className="flex items-center gap-2">
            <Gem className="h-4 w-4 text-[#B8795C]" />
            Tarot by Danil · сайт студии
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <span>Telegram Login</span>
            <span>Т-Банк link payments</span>
            <span>Mini app connected</span>
          </div>
        </footer>
      </div>
    </main>
  );
};

export default StudioLanding;
