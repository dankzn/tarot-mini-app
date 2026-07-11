import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  ChevronDown,
  CreditCard,
  Flame,
  Gem,
  LogOut,
  MoonStar,
  Shield,
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
}

const BOT_URL = 'https://t.me/danil_tarot_bot';
const BOT_USERNAME = (import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'danil_tarot_bot').replace('@', '');

const serviceCards = [
  {
    number: '01',
    title: 'Разобрать ситуацию',
    text: 'Когда в голове уже десятый круг, а решение всё равно не собирается. Смотрим спокойно: что происходит, где ваша зона влияния, что делать дальше',
  },
  {
    number: '02',
    title: 'Понять человека',
    text: 'Не “любит — не любит”, а честнее: что между вами происходит, какие намерения видны, где фантазия, а где факты',
  },
  {
    number: '03',
    title: 'Выбрать путь',
    text: 'Подходит для развилок: работа, деньги, переезд, отношения, обучение. Сравниваем варианты без драматизации',
  },
  {
    number: '04',
    title: 'Карта дня',
    text: 'Короткий отдельный формат. Не про отношения, не про карьеру, не про “судьбу”. Просто ориентир на день и состояние',
  },
];

const academyCards = [
  ['База индивидуально', '20 000 ₽', 'Если хочется спокойно войти в Таро без гонки и стыда за “глупые вопросы”'],
  ['Расширенный формат', '40 000 ₽', 'Для тех, кто уже пробовал и хочет собрать систему, практику и уверенность'],
  ['Группа', '11 500 ₽ / с человека', 'Живой ритм, домашки, практика и ощущение, что вы не одни в процессе'],
];

const quietRules = ['без страшилок', 'без давления', 'без публичности', 'без “вам срочно надо”'];

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
    script.setAttribute('data-radius', '14');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-userpic', 'false');
    script.setAttribute('data-auth-url', `${window.location.origin}/api/site/telegram-login`);
    script.onload = () => onReady?.();

    containerRef.current.appendChild(script);
  }, [onReady]);

  return <div ref={containerRef} className="min-h-[42px]" />;
};

export const StudioLanding = () => {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [user, setUser] = useState<SiteUser | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [authFailed, setAuthFailed] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setAuthFailed(params.get('auth') === 'failed');

    if (params.has('auth')) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(max > 0 ? Math.min(window.scrollY / max, 1) : 0);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
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
    <main className="min-h-screen overflow-hidden bg-[#0F1713] text-[#F7F0E4] selection:bg-[#C07A5B]/30">
      <div className="fixed left-0 top-0 z-50 h-1 bg-[#C07A5B] transition-[width] duration-150" style={{ width: `${scrollProgress * 100}%` }} />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(73,105,88,0.38),transparent_30%),radial-gradient(circle_at_86%_12%,rgba(192,122,91,0.22),transparent_24%),linear-gradient(135deg,#0F1713_0%,#17241D_42%,#0D1210_100%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.13] [background-image:linear-gradient(rgba(247,240,228,0.14)_1px,transparent_1px),linear-gradient(90deg,rgba(247,240,228,0.1)_1px,transparent_1px)] [background-size:72px_72px]" />
      <div className="pointer-events-none fixed -right-40 top-24 h-[520px] w-[520px] rounded-full border border-[#F7F0E4]/10 opacity-40 blur-[1px]" />
      <div className="pointer-events-none fixed -left-36 bottom-0 h-[420px] w-[420px] rounded-full bg-[#C07A5B]/10 blur-3xl" />

      <div className="relative z-10">
        <header className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-5 md:px-10 xl:px-16">
          <a href="#top" className="group flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-full border border-[#F7F0E4]/18 bg-[#F7F0E4]/8 backdrop-blur-xl transition group-hover:scale-105">
              <MoonStar className="h-5 w-5 text-[#E8C69A]" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.38em] text-[#CFAE83]">Tarot by Danil</p>
              <p className="text-sm font-black text-[#F7F0E4]/72">private studio</p>
            </div>
          </a>

          <nav className="hidden items-center gap-8 text-sm font-bold text-[#F7F0E4]/58 lg:flex">
            <a href="#work" className="transition hover:text-[#F7F0E4]">как работаем</a>
            <a href="#formats" className="transition hover:text-[#F7F0E4]">форматы</a>
            <a href="#academy" className="transition hover:text-[#F7F0E4]">обучение</a>
            <a href="#login" className="transition hover:text-[#F7F0E4]">вход</a>
          </nav>

          <a href="#login" className="rounded-full border border-[#F7F0E4]/16 bg-[#F7F0E4]/9 px-5 py-3 text-sm font-black text-[#F7F0E4] shadow-[0_18px_45px_rgba(0,0,0,0.16)] backdrop-blur-xl transition hover:bg-[#F7F0E4] hover:text-[#101713]">
            {user ? 'кабинет' : 'войти'}
          </a>
        </header>

        <section id="top" className="mx-auto grid min-h-[calc(100vh-84px)] max-w-[1440px] items-center gap-10 px-5 pb-16 pt-8 md:px-10 xl:grid-cols-[1.05fr_0.95fr] xl:px-16">
          <div className="relative">
            <div className="mb-7 inline-flex items-center gap-3 rounded-full border border-[#F7F0E4]/12 bg-[#F7F0E4]/7 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-[#E8C69A] backdrop-blur-xl">
              <span className="h-2 w-2 rounded-full bg-[#C07A5B] shadow-[0_0_24px_rgba(192,122,91,0.95)]" />
              консультации · обучение · личный кабинет
            </div>
            <h1 className="max-w-5xl text-[4.4rem] font-black leading-[0.82] tracking-[-0.08em] text-[#F7F0E4] md:text-[7.4rem] xl:text-[9.2rem]">
              Не мистика. Разговор.
            </h1>
            <p className="mt-8 max-w-2xl text-xl font-semibold leading-relaxed text-[#F7F0E4]/64 md:text-2xl">
              Иногда нужно не “узнать будущее”, а наконец перестать спорить с собой. Я помогаю разложить ситуацию по полкам — спокойно, честно, без спектакля
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <a href="#login" className="group inline-flex items-center justify-center rounded-full bg-[#F7F0E4] px-7 py-4 text-base font-black text-[#111A15] shadow-[0_22px_60px_rgba(247,240,228,0.16)] transition hover:translate-y-[-2px]">
                войти через Telegram
                <ArrowRight className="ml-3 h-5 w-5 transition group-hover:translate-x-1" />
              </a>
              <button onClick={() => openExternal(BOT_URL)} className="inline-flex items-center justify-center rounded-full border border-[#F7F0E4]/16 px-7 py-4 text-base font-black text-[#F7F0E4] backdrop-blur transition hover:border-[#F7F0E4]/35">
                открыть mini app
              </button>
            </div>
          </div>

          <div className="relative min-h-[620px]">
            <div className="absolute right-0 top-0 h-[520px] w-[84%] rounded-[4rem] border border-[#F7F0E4]/12 bg-[#F7F0E4]/8 p-6 shadow-[0_35px_120px_rgba(0,0,0,0.26)] backdrop-blur-2xl animate-[float-soft_7s_ease-in-out_infinite]">
              <div className="flex h-full flex-col justify-between rounded-[3rem] border border-[#F7F0E4]/10 bg-[linear-gradient(145deg,rgba(247,240,228,0.12),rgba(247,240,228,0.03))] p-7">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.35em] text-[#CFAE83]">current mood</p>
                  <p className="mt-4 max-w-sm text-4xl font-black leading-none text-[#F7F0E4]">меньше шума. больше ясности.</p>
                </div>
                <div className="grid gap-3">
                  {quietRules.map((rule) => (
                    <div key={rule} className="rounded-3xl border border-[#F7F0E4]/10 bg-[#0F1713]/32 px-5 py-4 text-lg font-black text-[#F7F0E4]/76">
                      {rule}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="absolute bottom-8 left-0 w-[72%] rounded-[3rem] bg-[#C07A5B] p-6 text-[#140F0D] shadow-[0_30px_90px_rgba(192,122,91,0.25)]">
              <p className="text-xs font-black uppercase tracking-[0.28em] opacity-65">site access</p>
              <p className="mt-3 text-3xl font-black leading-tight">профиль открывается через Telegram</p>
              <p className="mt-4 font-bold leading-relaxed opacity-72">Никаких паролей и форм на полэкрана. Вошли — сайт понял, кто вы</p>
            </div>
          </div>
        </section>

        <section id="work" className="mx-auto max-w-[1440px] px-5 py-20 md:px-10 xl:px-16">
          <div className="grid gap-8 xl:grid-cols-[0.8fr_1.2fr]">
            <div className="sticky top-10 self-start">
              <p className="mb-5 text-xs font-black uppercase tracking-[0.36em] text-[#CFAE83]">как это устроено</p>
              <h2 className="text-5xl font-black leading-[0.92] tracking-[-0.05em] md:text-7xl">Без дымовой завесы.</h2>
              <p className="mt-6 max-w-md text-lg font-semibold leading-relaxed text-[#F7F0E4]/58">
                Я не продаю “магическое срочно”. Если вопрос живой — мы смотрим его бережно. Если вопрос не к Таро — я так и скажу
              </p>
            </div>
            <div className="grid gap-4">
              {[
                ['сначала вопрос', 'Вы формулируете, что правда болит или мешает. Не нужно красиво — нужно честно'],
                ['потом расклад', 'Я смотрю не одну красивую карту, а связку: контекст, динамику, риски, точки выбора'],
                ['после — действие', 'В конце должен остаться не туман, а понятный следующий шаг. Даже если он маленький'],
              ].map(([title, text], index) => (
                <article key={title} className="group rounded-[3rem] border border-[#F7F0E4]/10 bg-[#F7F0E4]/7 p-7 backdrop-blur-xl transition duration-500 hover:bg-[#F7F0E4]/12 md:p-9">
                  <div className="flex items-start gap-6">
                    <span className="font-mono text-sm font-black text-[#CFAE83]">0{index + 1}</span>
                    <div>
                      <h3 className="text-4xl font-black tracking-[-0.04em] text-[#F7F0E4]">{title}</h3>
                      <p className="mt-4 max-w-2xl text-xl font-semibold leading-relaxed text-[#F7F0E4]/58">{text}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="formats" className="mx-auto max-w-[1440px] px-5 py-20 md:px-10 xl:px-16">
          <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="mb-4 text-xs font-black uppercase tracking-[0.36em] text-[#CFAE83]">форматы</p>
              <h2 className="text-5xl font-black leading-none tracking-[-0.06em] md:text-7xl">Куда можно прийти</h2>
            </div>
            <p className="max-w-lg text-lg font-semibold leading-relaxed text-[#F7F0E4]/58">
              Не надо заранее понимать, “какая услуга вам нужна”. Для этого внутри есть подбор. На сайте — только нормальный человеческий ориентир
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            {serviceCards.map((card) => (
              <article key={card.title} className="group min-h-[420px] rounded-[3rem] border border-[#F7F0E4]/10 bg-[#F7F0E4]/7 p-6 backdrop-blur-xl transition duration-500 hover:-translate-y-2 hover:bg-[#F7F0E4]/12">
                <div className="flex h-full flex-col justify-between">
                  <div>
                    <p className="font-mono text-sm font-black text-[#CFAE83]">{card.number}</p>
                    <h3 className="mt-7 text-4xl font-black leading-[0.96] tracking-[-0.05em] text-[#F7F0E4]">{card.title}</h3>
                  </div>
                  <p className="mt-8 text-lg font-semibold leading-relaxed text-[#F7F0E4]/58">{card.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="academy" className="mx-auto max-w-[1440px] px-5 py-20 md:px-10 xl:px-16">
          <div className="overflow-hidden rounded-[3.5rem] bg-[#F7F0E4] text-[#111A15] shadow-[0_40px_130px_rgba(0,0,0,0.32)]">
            <div className="grid lg:grid-cols-[0.95fr_1.05fr]">
              <div className="p-7 md:p-12">
                <div className="mb-10 inline-flex items-center gap-3 rounded-full bg-[#111A15] px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-[#F7F0E4]">
                  <BookOpenCheck className="h-4 w-4 text-[#CFAE83]" />
                  tarot academy
                </div>
                <h2 className="text-5xl font-black leading-[0.92] tracking-[-0.06em] md:text-7xl">Учиться можно без ощущения, что вы “не такая”.</h2>
                <p className="mt-7 max-w-xl text-xl font-semibold leading-relaxed text-[#4F5E54]">
                  Обучение — не про пафос “тайного знания”. Это про структуру, практику, язык карт и навык не додумывать за клиента
                </p>
              </div>
              <div className="grid gap-px bg-[#111A15]/10 p-px">
                {academyCards.map(([title, price, text]) => (
                  <article key={title} className="bg-[#F7F0E4] p-7 transition hover:bg-[#EFE3D3] md:p-9">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <h3 className="text-3xl font-black tracking-[-0.04em]">{title}</h3>
                        <p className="mt-3 max-w-xl text-lg font-semibold leading-relaxed text-[#5F6A62]">{text}</p>
                      </div>
                      <p className="shrink-0 rounded-full bg-[#111A15] px-5 py-3 text-lg font-black text-[#F7F0E4]">{price}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="login" className="mx-auto grid max-w-[1440px] gap-5 px-5 py-20 md:px-10 xl:grid-cols-[0.86fr_1.14fr] xl:px-16">
          <div className="rounded-[3rem] border border-[#F7F0E4]/10 bg-[#F7F0E4]/7 p-7 backdrop-blur-xl md:p-9">
            <div className="mb-8 flex items-center justify-between gap-4">
              <div>
                <p className="mb-3 text-xs font-black uppercase tracking-[0.34em] text-[#CFAE83]">telegram access</p>
                <h2 className="text-5xl font-black leading-none tracking-[-0.06em]">Вход без пароля</h2>
              </div>
              <div className="grid h-16 w-16 place-items-center rounded-full bg-[#F7F0E4]/10">
                <UserRound className="h-7 w-7 text-[#CFAE83]" />
              </div>
            </div>

            {sessionLoading ? (
              <div className="rounded-[2rem] bg-[#F7F0E4]/9 p-5 text-lg font-black text-[#F7F0E4]/64">Проверяю, вошли ли вы...</div>
            ) : user ? (
              <div className="space-y-4">
                <div className="rounded-[2.5rem] bg-[#F7F0E4] p-6 text-[#111A15]">
                  <p className="text-xs font-black uppercase tracking-[0.28em] text-[#9B6B55]">вы на сайте как</p>
                  <p className="mt-3 text-4xl font-black tracking-[-0.04em]">{user.name}</p>
                  <p className="mt-1 text-lg font-bold text-[#5F6A62]">{userLabel}</p>
                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <div className="rounded-3xl bg-[#EAE0D2] p-4">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9B6B55]">статус</p>
                      <p className="mt-2 font-black">{user.status || 'Первое знакомство'}</p>
                    </div>
                    <div className="rounded-3xl bg-[#EAE0D2] p-4">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9B6B55]">бонусы</p>
                      <p className="mt-2 font-black">{Number(user.bonus_balance || 0).toLocaleString('ru-RU')} ₽</p>
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button onClick={() => openExternal(BOT_URL)} className="rounded-full bg-[#F7F0E4] px-6 py-4 font-black text-[#111A15] transition hover:-translate-y-1">
                    открыть mini app
                  </button>
                  <button onClick={logout} className="inline-flex items-center justify-center rounded-full border border-[#F7F0E4]/16 px-6 py-4 font-black text-[#F7F0E4]">
                    <LogOut className="mr-2 h-5 w-5" /> выйти
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <p className="text-xl font-semibold leading-relaxed text-[#F7F0E4]/62">
                  Нажимаете кнопку Telegram — сайт получает ваш ID и username. Профиль один: сайт, бот и mini app смотрят на одного клиента
                </p>
                <div className="rounded-[2rem] bg-[#F7F0E4] p-5 text-[#111A15]">
                  <TelegramLoginWidget />
                  {authFailed && (
                    <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">
                      Вход не прошёл. Обычно это домен в BotFather или токен на сервере
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-5">
            <div className="rounded-[3rem] bg-[#C07A5B] p-7 text-[#111A15] md:p-9">
              <Flame className="mb-8 h-8 w-8" />
              <h3 className="text-5xl font-black leading-[0.96] tracking-[-0.06em]">Сайт — не вместо Telegram. Сайт — входная дверь.</h3>
              <p className="mt-6 max-w-2xl text-xl font-bold leading-relaxed text-[#111A15]/70">
                Красиво познакомиться, войти через Telegram, увидеть себя в системе — и дальше перейти туда, где уже удобно записываться, учиться и оплачивать.
              </p>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-[2.5rem] border border-[#F7F0E4]/10 bg-[#F7F0E4]/7 p-6 backdrop-blur-xl">
                <Shield className="mb-5 h-7 w-7 text-[#CFAE83]" />
                <p className="text-2xl font-black">Личные данные не гуляют по фронту</p>
                <p className="mt-3 font-semibold leading-relaxed text-[#F7F0E4]/58">Сессия живёт в HttpOnly cookie, Telegram hash проверяется на сервере.</p>
              </div>
              <div className="rounded-[2.5rem] border border-[#F7F0E4]/10 bg-[#F7F0E4]/7 p-6 backdrop-blur-xl">
                <BadgeCheck className="mb-5 h-7 w-7 text-[#CFAE83]" />
                <p className="text-2xl font-black">Оплата остаётся под контролем</p>
                <p className="mt-3 font-semibold leading-relaxed text-[#F7F0E4]/58">Ссылка Т-Банка берётся из админки. Подтверждение оплаты — вручную</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-5 pb-24 pt-10 md:px-10 xl:px-16">
          <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[3rem] border border-[#F7F0E4]/10 bg-[#F7F0E4]/7 p-7 backdrop-blur-xl md:p-10">
              <p className="mb-4 text-xs font-black uppercase tracking-[0.34em] text-[#CFAE83]">payment</p>
              <h2 className="text-5xl font-black leading-[0.95] tracking-[-0.06em]">Т-Банк подключаем без цирка с эквайрингом.</h2>
              <p className="mt-6 max-w-2xl text-xl font-semibold leading-relaxed text-[#F7F0E4]/58">
                Если сейчас рабочая схема — ссылка на накопительный счёт, значит делаем её аккуратно: кнопка оплаты, понятный статус, ручное подтверждение админом
              </p>
            </div>

            <div className="rounded-[3rem] bg-[#F7F0E4] p-7 text-[#111A15] md:p-9">
              <div className="mb-6 flex items-center gap-4">
                <div className="grid h-14 w-14 place-items-center rounded-full bg-[#111A15] text-[#F7F0E4]">
                  <CreditCard className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-[#9B6B55]">активная ссылка</p>
                  <p className="text-xl font-black">из админки</p>
                </div>
              </div>
              {primaryPaymentMethod ? (
                <div>
                  <div className="rounded-[2rem] bg-[#EAE0D2] p-5">
                    <p className="text-3xl font-black tracking-[-0.04em]">{primaryPaymentMethod.title}</p>
                    {primaryPaymentMethod.instructions && <p className="mt-3 font-semibold leading-relaxed text-[#5F6A62]">{primaryPaymentMethod.instructions}</p>}
                  </div>
                  <button onClick={() => openExternal(primaryPaymentMethod.payment_url)} className="mt-4 flex w-full items-center justify-center rounded-full bg-[#111A15] px-6 py-4 font-black text-[#F7F0E4] transition hover:-translate-y-1">
                    открыть оплату
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </button>
                </div>
              ) : (
                <p className="rounded-[2rem] border border-dashed border-[#111A15]/18 p-5 font-bold leading-relaxed text-[#5F6A62]">
                  Ссылка оплаты пока не настроена. Добавишь способ оплаты в админке — сайт подтянет его сам
                </p>
              )}
            </div>
          </div>
        </section>

        <footer className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-4 border-t border-[#F7F0E4]/10 px-5 py-8 text-sm font-bold text-[#F7F0E4]/46 md:flex-row md:px-10 xl:px-16">
          <div className="flex items-center gap-2">
            <Gem className="h-4 w-4 text-[#CFAE83]" />
            Tarot by Danil · private studio
          </div>
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="inline-flex items-center gap-2 rounded-full border border-[#F7F0E4]/12 px-4 py-2 text-[#F7F0E4]/68 transition hover:text-[#F7F0E4]">
            наверх
            <ChevronDown className="h-4 w-4 rotate-180" />
          </button>
        </footer>
      </div>
    </main>
  );
};

export default StudioLanding;
