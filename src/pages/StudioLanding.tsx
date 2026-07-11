import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  ChevronLeft,
  CreditCard,
  LogOut,
  Menu,
  MoonStar,
  UserRound,
  X,
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

type SitePage = 'home' | 'consultations' | 'academy' | 'profile' | 'payment';

const BOT_URL = 'https://t.me/danil_tarot_bot';
const BOT_USERNAME = (import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'danil_tarot_bot').replace('@', '');

const routes: { page: SitePage; label: string; href: string }[] = [
  { page: 'home', label: 'Студия', href: '/site' },
  { page: 'consultations', label: 'Консультации', href: '/site/consultations' },
  { page: 'academy', label: 'Академия', href: '/site/academy' },
  { page: 'profile', label: 'Кабинет', href: '/site/profile' },
  { page: 'payment', label: 'Оплата', href: '/site/payment' },
];

const consultationCards = [
  {
    title: 'Личный разбор',
    tag: 'когда нужно понять, что происходит',
    text: 'Берём ситуацию без красивой упаковки и смотрим, где факты, где тревога, где чужое влияние и какой шаг сейчас самый трезвый',
  },
  {
    title: 'Отношения и контакт',
    tag: 'без гадания на чужую голову',
    text: 'Смотрим динамику, намерения, напряжение, точки сближения и то, где вы теряете себя в ожидании ответа от другого человека',
  },
  {
    title: 'Выбор и развилка',
    tag: 'работа, деньги, переезд, решение',
    text: 'Сравниваем варианты по последствиям, рискам и внутренней цене, чтобы решение стало не идеальным, а вашим',
  },
  {
    title: 'Карта дня',
    tag: 'отдельный короткий формат',
    text: 'Это не отношения, не работа и не прогноз судьбы, а спокойный ориентир на день, настроение и ближайший фокус',
  },
];

const academyCards = [
  {
    title: 'База индивидуально',
    price: '20 000 ₽',
    text: 'Для спокойного входа в Таро без гонки, стыда и ощущения, что нужно сразу понимать всё',
  },
  {
    title: 'Расширенная программа',
    price: '40 000 ₽',
    text: 'Для тех, кто хочет собрать практику, язык трактовок, уверенность и этику работы с людьми',
  },
  {
    title: 'Группа',
    price: '11 500 ₽ / с человека',
    text: 'Камерный ритм, живые занятия, домашние задания, практика и нормальная поддержка в процессе',
  },
];

const homeCards = [
  ['без шоу', 'Таро здесь не театр и не страшилка'],
  ['без давления', 'Никаких срочных покупок и “вам надо прямо сейчас”'],
  ['без публичности', 'Личные темы остаются личными'],
];

const openExternal = (url: string) => {
  window.open(url, '_blank', 'noopener,noreferrer');
};

const getCurrentPage = (): SitePage => {
  const path = window.location.pathname.replace(/\/$/, '');
  if (path.endsWith('/consultations')) return 'consultations';
  if (path.endsWith('/academy')) return 'academy';
  if (path.endsWith('/profile')) return 'profile';
  if (path.endsWith('/payment')) return 'payment';
  return 'home';
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
    script.setAttribute('data-radius', '12');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-userpic', 'false');
    script.setAttribute('data-auth-url', `${window.location.origin}/api/site/telegram-login`);
    script.onload = () => onReady?.();

    containerRef.current.appendChild(script);
  }, [onReady]);

  return <div ref={containerRef} className="min-h-[42px]" />;
};

const SiteLink = ({ href, children, className = '' }: { href: string; children: React.ReactNode; className?: string }) => (
  <a href={href} className={className}>{children}</a>
);

const Shell = ({
  page,
  user,
  children,
}: {
  page: SitePage;
  user: SiteUser | null;
  children: React.ReactNode;
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [cursor, setCursor] = useState({ x: 50, y: 30 });

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      setCursor({ x: (event.clientX / window.innerWidth) * 100, y: (event.clientY / window.innerHeight) * 100 });
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  return (
    <main className="min-h-screen overflow-hidden bg-[#EEE6DB] text-[#141A16]">
      <div className="pointer-events-none fixed inset-0 opacity-90" style={{ background: `radial-gradient(circle at ${cursor.x}% ${cursor.y}%, rgba(183, 118, 86, 0.22), transparent 26%), linear-gradient(135deg, #EEE6DB 0%, #D8D1C5 100%)` }} />
      <div className="pointer-events-none fixed inset-0 opacity-[0.08] [background-image:linear-gradient(#141A16_1px,transparent_1px),linear-gradient(90deg,#141A16_1px,transparent_1px)] [background-size:54px_54px]" />
      <div className="pointer-events-none fixed -right-48 top-20 h-[620px] w-[620px] rounded-full border border-[#141A16]/10" />
      <div className="pointer-events-none fixed -left-40 bottom-0 h-[520px] w-[520px] rounded-full bg-[#173326]/10 blur-3xl" />

      <div className="relative z-10">
        <header className="mx-auto flex max-w-[1480px] items-center justify-between px-5 py-5 md:px-10 xl:px-16">
          <SiteLink href="/site" className="group flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#141A16] text-[#EEE6DB] shadow-[0_18px_50px_rgba(20,26,22,0.18)] transition group-hover:rotate-6 group-hover:scale-105">
              <MoonStar className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.34em] text-[#9A6A52]">Tarot by Danil</p>
              <p className="text-base font-black lowercase text-[#141A16]/76">studio</p>
            </div>
          </SiteLink>

          <nav className="hidden items-center rounded-full bg-[#141A16]/7 p-1 text-sm font-black lg:flex">
            {routes.map((route) => (
              <SiteLink
                key={route.page}
                href={route.href}
                className={`rounded-full px-5 py-3 transition ${page === route.page ? 'bg-[#141A16] text-[#EEE6DB]' : 'text-[#141A16]/58 hover:text-[#141A16]'}`}
              >
                {route.label}
              </SiteLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <SiteLink href="/site/profile" className="hidden rounded-full bg-[#141A16] px-5 py-3 text-sm font-black text-[#EEE6DB] shadow-[0_18px_45px_rgba(20,26,22,0.18)] md:block">
              {user ? 'Кабинет' : 'Войти'}
            </SiteLink>
            <button onClick={() => setMenuOpen(true)} className="grid h-12 w-12 place-items-center rounded-2xl bg-[#141A16]/8 lg:hidden">
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </header>

        {children}

        <footer className="mx-auto flex max-w-[1480px] flex-col gap-4 border-t border-[#141A16]/10 px-5 py-8 text-sm font-bold text-[#141A16]/48 md:flex-row md:items-center md:justify-between md:px-10 xl:px-16">
          <span>Tarot by Danil</span>
          <div className="flex flex-wrap gap-4">
            <SiteLink href="/site/consultations">Консультации</SiteLink>
            <SiteLink href="/site/academy">Академия</SiteLink>
            <SiteLink href="/site/profile">Вход через Telegram</SiteLink>
          </div>
        </footer>
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-50 bg-[#141A16]/88 p-5 backdrop-blur-xl lg:hidden">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-[#EEE6DB]/50">Меню</p>
            <button onClick={() => setMenuOpen(false)} className="grid h-12 w-12 place-items-center rounded-2xl bg-[#EEE6DB] text-[#141A16]">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-12 grid gap-3">
            {routes.map((route) => (
              <SiteLink key={route.page} href={route.href} className="rounded-[2rem] bg-[#EEE6DB] p-6 text-3xl font-black text-[#141A16]">
                {route.label}
              </SiteLink>
            ))}
          </div>
        </div>
      )}
    </main>
  );
};

const HomePage = () => (
  <>
    <section className="mx-auto grid min-h-[calc(100vh-88px)] max-w-[1480px] items-center gap-10 px-5 pb-16 pt-8 md:px-10 xl:grid-cols-[1.08fr_0.92fr] xl:px-16">
      <div>
        <div className="mb-7 inline-flex rounded-full border border-[#141A16]/12 bg-[#EEE6DB]/55 px-4 py-2 text-xs font-black uppercase tracking-[0.28em] text-[#9A6A52] backdrop-blur">
          private tarot studio
        </div>
        <h1 className="max-w-5xl text-[4.6rem] font-black leading-[0.78] tracking-[-0.1em] md:text-[8rem] xl:text-[10rem]">
          Не гадать страшно
          <span className="block text-[#9A6A52]">а смотреть честно</span>
        </h1>
        <p className="mt-9 max-w-2xl text-2xl font-semibold leading-relaxed text-[#141A16]/62">
          Консультации и обучение Таро без театра, давления и мистического тумана
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <SiteLink href="/site/profile" className="group inline-flex items-center justify-center rounded-full bg-[#141A16] px-7 py-4 text-base font-black text-[#EEE6DB] shadow-[0_24px_70px_rgba(20,26,22,0.22)] transition hover:-translate-y-1">
            Войти через Telegram
            <ArrowRight className="ml-3 h-5 w-5 transition group-hover:translate-x-1" />
          </SiteLink>
          <SiteLink href="/site/consultations" className="inline-flex items-center justify-center rounded-full border border-[#141A16]/14 px-7 py-4 text-base font-black text-[#141A16] transition hover:bg-[#141A16] hover:text-[#EEE6DB]">
            Смотреть форматы
          </SiteLink>
        </div>
      </div>

      <div className="relative min-h-[650px]">
        <div className="absolute right-0 top-0 h-[560px] w-[86%] overflow-hidden rounded-[4rem] bg-[#141A16] p-8 text-[#EEE6DB] shadow-[0_40px_130px_rgba(20,26,22,0.32)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(238,230,219,0.2),transparent_28%),radial-gradient(circle_at_85%_15%,rgba(154,106,82,0.35),transparent_26%)]" />
          <div className="relative flex h-full flex-col justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.36em] text-[#CDA989]">inside the room</p>
              <h2 className="mt-5 max-w-sm text-5xl font-black leading-[0.92] tracking-[-0.06em]">меньше шума больше ясности</h2>
            </div>
            <div className="grid gap-3">
              {homeCards.map(([title, text]) => (
                <div key={title} className="rounded-[2rem] border border-[#EEE6DB]/12 bg-[#EEE6DB]/8 p-5 backdrop-blur">
                  <p className="text-2xl font-black">{title}</p>
                  <p className="mt-2 font-semibold text-[#EEE6DB]/55">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="absolute bottom-5 left-0 max-w-sm rounded-[3rem] bg-[#B9785D] p-7 text-[#141A16] shadow-[0_28px_90px_rgba(185,120,93,0.28)]">
          <p className="text-xs font-black uppercase tracking-[0.28em] opacity-55">Telegram вход</p>
          <p className="mt-3 text-3xl font-black leading-[0.98]">без паролей и лишних форм</p>
        </div>
      </div>
    </section>

    <section className="mx-auto max-w-[1480px] px-5 py-16 md:px-10 xl:px-16">
      <div className="grid gap-5 lg:grid-cols-3">
        {[
          ['01', 'Консультации', 'Для ситуаций, где хочется перестать крутить одно и то же'],
          ['02', 'Обучение', 'Для тех, кто хочет изучать Таро системно и спокойно'],
          ['03', 'Кабинет', 'Telegram связывает сайт, бот и mini app в один профиль'],
        ].map(([number, title, text]) => (
          <article key={title} className="group rounded-[3rem] border border-[#141A16]/10 bg-[#EEE6DB]/52 p-7 backdrop-blur-xl transition duration-500 hover:-translate-y-2 hover:bg-[#141A16] hover:text-[#EEE6DB]">
            <p className="font-mono text-sm font-black text-[#9A6A52] group-hover:text-[#CDA989]">{number}</p>
            <h3 className="mt-12 text-4xl font-black tracking-[-0.05em]">{title}</h3>
            <p className="mt-4 text-lg font-semibold leading-relaxed opacity-62">{text}</p>
          </article>
        ))}
      </div>
    </section>
  </>
);

const ConsultationsPage = () => (
  <section className="mx-auto max-w-[1480px] px-5 py-12 md:px-10 xl:px-16">
    <SiteLink href="/site" className="mb-8 inline-flex items-center rounded-full bg-[#141A16]/8 px-5 py-3 font-black text-[#141A16]/70">
      <ChevronLeft className="mr-2 h-4 w-4" />
      Назад
    </SiteLink>
    <div className="grid gap-10 xl:grid-cols-[0.75fr_1.25fr]">
      <div className="sticky top-10 self-start">
        <p className="text-xs font-black uppercase tracking-[0.34em] text-[#9A6A52]">consultations</p>
        <h1 className="mt-5 text-6xl font-black leading-[0.86] tracking-[-0.08em] md:text-8xl">Форматы без витрины страха</h1>
        <p className="mt-7 text-xl font-semibold leading-relaxed text-[#141A16]/58">
          Если вы не знаете, что выбрать, это нормально
          Внутри mini app есть подбор, а здесь только общее ощущение направлений
        </p>
      </div>
      <div className="grid gap-5">
        {consultationCards.map((card, index) => (
          <article key={card.title} className="group rounded-[3.5rem] bg-[#141A16] p-8 text-[#EEE6DB] shadow-[0_28px_90px_rgba(20,26,22,0.16)] transition duration-500 hover:scale-[1.015] md:p-10">
            <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="font-mono text-sm font-black text-[#CDA989]">{String(index + 1).padStart(2, '0')}</p>
                <h2 className="mt-8 text-5xl font-black tracking-[-0.06em]">{card.title}</h2>
                <p className="mt-4 text-sm font-black uppercase tracking-[0.22em] text-[#CDA989]/82">{card.tag}</p>
              </div>
              <p className="max-w-xl text-xl font-semibold leading-relaxed text-[#EEE6DB]/64">{card.text}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  </section>
);

const AcademyPage = () => (
  <section className="mx-auto max-w-[1480px] px-5 py-12 md:px-10 xl:px-16">
    <SiteLink href="/site" className="mb-8 inline-flex items-center rounded-full bg-[#141A16]/8 px-5 py-3 font-black text-[#141A16]/70">
      <ChevronLeft className="mr-2 h-4 w-4" />
      Назад
    </SiteLink>
    <div className="overflow-hidden rounded-[4rem] bg-[#141A16] text-[#EEE6DB] shadow-[0_38px_130px_rgba(20,26,22,0.28)]">
      <div className="grid xl:grid-cols-[0.9fr_1.1fr]">
        <div className="p-8 md:p-12">
          <BookOpen className="mb-10 h-10 w-10 text-[#CDA989]" />
          <h1 className="text-6xl font-black leading-[0.86] tracking-[-0.08em] md:text-8xl">Академия Таро</h1>
          <p className="mt-8 max-w-xl text-xl font-semibold leading-relaxed text-[#EEE6DB]/62">
            Обучение без пафоса тайного знания
            Нормальная структура, практика, домашки и личный кабинет ученика
          </p>
        </div>
        <div className="grid gap-px bg-[#EEE6DB]/10 p-px">
          {academyCards.map((card) => (
            <article key={card.title} className="bg-[#141A16] p-8 transition hover:bg-[#1E2A22] md:p-10">
              <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-4xl font-black tracking-[-0.05em]">{card.title}</h2>
                  <p className="mt-4 max-w-2xl text-lg font-semibold leading-relaxed text-[#EEE6DB]/58">{card.text}</p>
                </div>
                <p className="shrink-0 rounded-full bg-[#EEE6DB] px-5 py-3 text-lg font-black text-[#141A16]">{card.price}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  </section>
);

const ProfilePage = ({
  user,
  sessionLoading,
  authFailed,
  onLogout,
}: {
  user: SiteUser | null;
  sessionLoading: boolean;
  authFailed: boolean;
  onLogout: () => Promise<void>;
}) => {
  const userLabel = user?.username ? `@${user.username}` : user?.telegram_id ? `ID ${user.telegram_id}` : 'Telegram';

  return (
    <section className="mx-auto max-w-[1180px] px-5 py-12 md:px-10 xl:px-16">
      <SiteLink href="/site" className="mb-8 inline-flex items-center rounded-full bg-[#141A16]/8 px-5 py-3 font-black text-[#141A16]/70">
        <ChevronLeft className="mr-2 h-4 w-4" />
        Назад
      </SiteLink>
      <div className="rounded-[4rem] bg-[#141A16] p-7 text-[#EEE6DB] shadow-[0_38px_120px_rgba(20,26,22,0.26)] md:p-10">
        <div className="mb-10 flex items-start justify-between gap-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.34em] text-[#CDA989]">Telegram login</p>
            <h1 className="mt-4 text-6xl font-black leading-[0.86] tracking-[-0.08em] md:text-8xl">Личный вход</h1>
          </div>
          <div className="grid h-16 w-16 place-items-center rounded-full bg-[#EEE6DB]/10">
            <UserRound className="h-7 w-7 text-[#CDA989]" />
          </div>
        </div>

        {sessionLoading ? (
          <div className="rounded-[2rem] bg-[#EEE6DB]/8 p-6 text-xl font-black text-[#EEE6DB]/58">Проверяю вход</div>
        ) : user ? (
          <div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
            <div className="rounded-[3rem] bg-[#EEE6DB] p-7 text-[#141A16]">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-[#9A6A52]">профиль</p>
              <h2 className="mt-4 text-5xl font-black tracking-[-0.06em]">{user.name}</h2>
              <p className="mt-2 text-xl font-bold text-[#141A16]/54">{userLabel}</p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[2rem] bg-[#DCD2C4] p-5">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9A6A52]">статус</p>
                  <p className="mt-3 text-2xl font-black">{user.status || 'Первое знакомство'}</p>
                </div>
                <div className="rounded-[2rem] bg-[#DCD2C4] p-5">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9A6A52]">бонусы</p>
                  <p className="mt-3 text-2xl font-black">{Number(user.bonus_balance || 0).toLocaleString('ru-RU')} ₽</p>
                </div>
              </div>
            </div>
            <div className="grid gap-3">
              <button onClick={() => openExternal(BOT_URL)} className="rounded-[2rem] bg-[#B9785D] p-6 text-left text-3xl font-black text-[#141A16] transition hover:-translate-y-1">
                Открыть mini app
                <ArrowRight className="mt-8 h-7 w-7" />
              </button>
              <button onClick={onLogout} className="inline-flex items-center justify-center rounded-[2rem] border border-[#EEE6DB]/14 p-6 text-xl font-black text-[#EEE6DB]">
                <LogOut className="mr-2 h-5 w-5" />
                Выйти
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="rounded-[3rem] bg-[#EEE6DB] p-7 text-[#141A16]">
              <p className="text-2xl font-black leading-tight">Вход через Telegram</p>
              <p className="mt-4 text-lg font-semibold leading-relaxed text-[#141A16]/58">
                Сайт получает Telegram ID и username
                Профиль общий для сайта, бота и mini app
              </p>
            </div>
            <div className="rounded-[3rem] bg-[#EEE6DB] p-7 text-[#141A16]">
              <TelegramLoginWidget />
              {authFailed && (
                <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">
                  Вход не прошёл
                  Проверь домен в BotFather
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

const PaymentPage = ({ primaryPaymentMethod }: { primaryPaymentMethod: PaymentMethod | null }) => (
  <section className="mx-auto max-w-[1240px] px-5 py-12 md:px-10 xl:px-16">
    <SiteLink href="/site" className="mb-8 inline-flex items-center rounded-full bg-[#141A16]/8 px-5 py-3 font-black text-[#141A16]/70">
      <ChevronLeft className="mr-2 h-4 w-4" />
      Назад
    </SiteLink>
    <div className="grid gap-5 lg:grid-cols-[1fr_0.82fr]">
      <div className="rounded-[4rem] bg-[#141A16] p-8 text-[#EEE6DB] shadow-[0_38px_130px_rgba(20,26,22,0.26)] md:p-11">
        <CreditCard className="mb-10 h-10 w-10 text-[#CDA989]" />
        <h1 className="text-6xl font-black leading-[0.86] tracking-[-0.08em] md:text-8xl">Оплата</h1>
        <p className="mt-8 max-w-2xl text-xl font-semibold leading-relaxed text-[#EEE6DB]/62">
          Сейчас рабочая схема простая
          Клиент оплачивает по ссылке, отмечает оплату, админ проверяет поступление
        </p>
      </div>
      <div className="rounded-[4rem] bg-[#EEE6DB] p-7 text-[#141A16] shadow-[0_24px_80px_rgba(20,26,22,0.12)] md:p-9">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-[#9A6A52]">активный способ</p>
        {primaryPaymentMethod ? (
          <div className="mt-6">
            <h2 className="text-4xl font-black tracking-[-0.05em]">{primaryPaymentMethod.title}</h2>
            {primaryPaymentMethod.instructions && <p className="mt-4 text-lg font-semibold leading-relaxed text-[#141A16]/58">{primaryPaymentMethod.instructions}</p>}
            <button onClick={() => openExternal(primaryPaymentMethod.payment_url)} className="mt-8 flex w-full items-center justify-center rounded-full bg-[#141A16] px-6 py-4 font-black text-[#EEE6DB] transition hover:-translate-y-1">
              Открыть оплату
              <ArrowRight className="ml-2 h-5 w-5" />
            </button>
          </div>
        ) : (
          <p className="mt-6 rounded-[2rem] border border-dashed border-[#141A16]/18 p-6 text-lg font-bold text-[#141A16]/58">
            Способ оплаты пока не настроен
          </p>
        )}
      </div>
    </div>
  </section>
);

export const StudioLanding = () => {
  const [page] = useState<SitePage>(getCurrentPage);
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

  const logout = async () => {
    await fetch('/api/site/logout', { method: 'POST' }).catch(() => null);
    setUser(null);
  };

  const renderPage = () => {
    if (page === 'consultations') return <ConsultationsPage />;
    if (page === 'academy') return <AcademyPage />;
    if (page === 'profile') return <ProfilePage user={user} sessionLoading={sessionLoading} authFailed={authFailed} onLogout={logout} />;
    if (page === 'payment') return <PaymentPage primaryPaymentMethod={primaryPaymentMethod} />;
    return <HomePage />;
  };

  return (
    <Shell page={page} user={user}>
      <div className="animate-[fade-in_0.4s_ease-out]">
        {renderPage()}
      </div>
    </Shell>
  );
};

export default StudioLanding;
