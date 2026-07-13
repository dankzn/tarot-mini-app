import { type AnchorHTMLAttributes, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CalendarCheck,
  ChevronLeft,
  Clock,
  CreditCard,
  GraduationCap,
  Lock,
  LogOut,
  Mail,
  Menu,
  Moon,
  MoonStar,
  Save,
  ShoppingCart,
  Sparkles,
  Sun,
  Trash2,
  UserRound,
  Wallet,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { offerTerms, personalDataPolicy, type LegalDocument } from '../lib/legalContent';

interface PaymentMethod {
  id: string;
  title: string;
  payment_url: string;
  instructions?: string | null;
}

interface SiteUser {
  id: string;
  telegram_id?: number | null;
  username?: string | null;
  name: string;
  city?: string | null;
  phone?: string | null;
  birth_date?: string | null;
  gender?: 'male' | 'female' | 'other' | null;
  email?: string | null;
  has_site_password?: boolean;
  status?: string | null;
  bonus_balance?: number | null;
  role?: string | null;
}

interface SiteService {
  id: string;
  title: string;
  description?: string | null;
  price?: number | null;
  duration_minutes?: number | null;
  category?: string | null;
  is_active?: boolean | null;
}

interface SiteConsultation {
  id: string;
  status?: string | null;
  scheduled_at?: string | null;
  requested_date?: string | null;
  requested_time_text?: string | null;
  scheduling_status?: string | null;
  payment_status?: string | null;
  payment_amount?: number | null;
  price?: number | null;
  priority_fee?: number | null;
  services?: {
    title?: string | null;
    duration_minutes?: number | null;
  } | null;
}

interface TrainingEnrollment {
  id: string;
  status?: string | null;
  payment_status?: string | null;
  final_price?: number | null;
  created_at?: string | null;
  training_programs?: {
    title?: string | null;
    price?: number | null;
  } | null;
  training_groups?: {
    title?: string | null;
    starts_at?: string | null;
  } | null;
}

type CartItem = {
  id: string;
  source: 'service' | 'consultation' | 'training';
  title: string;
  price: number;
  meta?: string;
};

type SitePage = 'home' | 'consultations' | 'academy' | 'profile' | 'payment' | 'privacy' | 'offer';
type SiteTheme = 'light' | 'dark';

const BOT_URL = 'https://t.me/danil_tarot_bot';
const BOT_USERNAME = (import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'danil_tarot_bot').replace('@', '');

const routes: { page: SitePage; label: string; href: string }[] = [
  { page: 'home', label: 'Студия', href: '/site' },
  { page: 'consultations', label: 'Консультации', href: '/site/consultations' },
  { page: 'academy', label: 'Академия', href: '/site/academy' },
  { page: 'profile', label: 'Кабинет', href: '/site/profile' },
  { page: 'payment', label: 'Оплата', href: '/site/payment' },
];

const legalRoutes = [
  { page: 'privacy' as SitePage, label: 'Политика данных', href: '/site/privacy' },
  { page: 'offer' as SitePage, label: 'Оферта', href: '/site/offer' },
];

const studioPrinciples = [
  ['Консультации', 'Выбираете формат и оставляете заявку'],
  ['Обучение', 'Смотрите программы и записываетесь на курс'],
  ['Кабинет', 'Записи, оплата и материалы остаются под рукой'],
];

const consultationCards = [
  {
    title: 'Личный разбор',
    tag: 'когда нужно разобраться',
    text: 'Подходит, если ситуация запуталась и хочется спокойно разложить её по шагам',
  },
  {
    title: 'Отношения',
    tag: 'отношения и контакт',
    text: 'Разбор общения, ожиданий, поведения и того, что можно сделать со своей стороны',
  },
  {
    title: 'Выбор',
    tag: 'несколько вариантов',
    text: 'Когда есть несколько решений и нужно посмотреть, к чему может привести каждое',
  },
  {
    title: 'Карта дня',
    tag: 'отдельный формат',
    text: 'Короткий формат на день, без привязки к отношениям, работе или большой теме',
  },
];

const academyCards = [
  {
    title: 'Индивидуальная база',
    price: '20 000 ₽',
    text: 'Базовая программа один на один: структура колоды, первые расклады и практика',
  },
  {
    title: 'Расширенная программа',
    price: '40 000 ₽',
    text: 'Для тех, кто хочет глубже работать с трактовками, практикой и сложными запросами',
  },
  {
    title: 'Группа',
    price: '11 500 ₽ / с человека',
    text: 'Групповое обучение с занятиями, домашними заданиями и разбором практики',
  },
];

const academySteps = ['заявка', 'детали', 'зачисление', 'занятия', 'домашние задания', 'практика'];

const studioSpaces = [
  {
    title: 'Консультации',
    label: 'запись',
    text: 'Выберите формат консультации, удобное время или оставьте заявку без окна',
    href: '/site/consultations',
  },
  {
    title: 'Академия',
    label: 'обучение Таро',
    text: 'Программы для индивидуального и группового обучения с личным кабинетом студента',
    href: '/site/academy',
  },
  {
    title: 'Кабинет',
    label: 'личный раздел',
    text: 'Ваши записи, обучение, бонусы, статусы и оплата в одном месте',
    href: '/site/profile',
  },
];

const studioMoods = ['консультация', 'обучение', 'кабинет', 'оплата'];

const openExternal = (url: string) => {
  window.open(url, '_blank', 'noopener,noreferrer');
};

const formatMoney = (value?: number | null) => `${Math.max(0, Number(value || 0)).toLocaleString('ru-RU')} ₽`;

const formatDateTime = (value?: string | null) => {
  if (!value) return 'время согласуется';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'время согласуется';
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const getConsultationTitle = (item: SiteConsultation) => item.services?.title || 'Консультация';

const getConsultationPrice = (item: SiteConsultation) => Number(item.payment_amount ?? item.price ?? 0);

const needsPayment = (status?: string | null) => !['paid', 'confirmed', 'completed'].includes(String(status || '').toLowerCase());

const getStoredTheme = (): SiteTheme => {
  if (typeof window === 'undefined') return 'light';
  const saved = window.localStorage.getItem('tarot-site-theme');
  if (saved === 'dark' || saved === 'light') return saved;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const getStoredCart = (): CartItem[] => {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem('tarot-site-cart') || '[]');
    return Array.isArray(parsed) ? parsed.filter((item) => item?.id && item?.title) : [];
  } catch {
    return [];
  }
};

const one = <T,>(value: T | T[] | null | undefined): T | null => {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
};

const getCurrentPage = (): SitePage => {
  const path = window.location.pathname.replace(/\/$/, '');
  if (path.endsWith('/consultations')) return 'consultations';
  if (path.endsWith('/academy')) return 'academy';
  if (path.endsWith('/profile')) return 'profile';
  if (path.endsWith('/payment')) return 'payment';
  if (path.endsWith('/privacy')) return 'privacy';
  if (path.endsWith('/offer')) return 'offer';
  return 'home';
};

const MotionEngine = () => {
  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;

    const updateScroll = () => {
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      root.style.setProperty('--site-scroll', `${Math.min(1, window.scrollY / maxScroll)}`);
    };

    const onPointerMove = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        root.style.setProperty('--site-x', `${event.clientX}px`);
        root.style.setProperty('--site-y', `${event.clientY}px`);
      });
    };

    const onScroll = () => {
      requestAnimationFrame(updateScroll);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('is-visible');
        });
      },
      { threshold: 0.16 },
    );

    document.querySelectorAll('.site-reveal').forEach((element) => observer.observe(element));

    const magneticItems = Array.from(document.querySelectorAll<HTMLElement>('[data-magnetic]'));
    const cleanups = magneticItems.map((element) => {
      const onMove = (event: MouseEvent) => {
        const rect = element.getBoundingClientRect();
        const x = event.clientX - rect.left - rect.width / 2;
        const y = event.clientY - rect.top - rect.height / 2;
        element.style.transform = `translate3d(${x * 0.14}px, ${y * 0.18}px, 0)`;
      };
      const onLeave = () => {
        element.style.transform = '';
      };
      element.addEventListener('mousemove', onMove);
      element.addEventListener('mouseleave', onLeave);
      return () => {
        element.removeEventListener('mousemove', onMove);
        element.removeEventListener('mouseleave', onLeave);
      };
    });

    updateScroll();
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      cleanups.forEach((cleanup) => cleanup());
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return null;
};

const TarotBackground = () => (
  <div className="site-tarot-bg" aria-hidden="true">
    <div className="site-tarot-card site-tarot-card-one">
      <span>XVII</span>
      <Sparkles className="h-10 w-10" />
    </div>
    <div className="site-tarot-card site-tarot-card-two">
      <span>VI</span>
      <MoonStar className="h-10 w-10" />
    </div>
    <div className="site-tarot-ring site-tarot-ring-one" />
    <div className="site-tarot-ring site-tarot-ring-two" />
    <div className="site-tarot-star site-tarot-star-one">✦</div>
    <div className="site-tarot-star site-tarot-star-two">✧</div>
  </div>
);

const TelegramLoginWidget = ({ onReady }: { onReady?: () => void }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hasWidgetError, setHasWidgetError] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    setHasWidgetError(false);
    containerRef.current.innerHTML = '';
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', BOT_USERNAME);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '14');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-userpic', 'false');
    script.setAttribute('data-auth-url', `${window.location.origin}/api/site/telegram-login?return_to=/site/profile`);
    script.onload = () => onReady?.();

    containerRef.current.appendChild(script);

    const timeout = window.setTimeout(() => {
      const text = containerRef.current?.textContent || '';
      const hasTelegramFrame = Boolean(containerRef.current?.querySelector('iframe'));
      if (text.includes('Bot domain invalid') || !hasTelegramFrame) {
        setHasWidgetError(true);
      }
    }, 2200);

    return () => window.clearTimeout(timeout);
  }, [onReady]);

  return (
    <div>
      <div ref={containerRef} className={hasWidgetError ? 'hidden' : 'min-h-[46px]'} />
      {hasWidgetError && (
        <div className="rounded-[1.4rem] border border-[#2F463B]/10 bg-white/70 p-4">
          <p className="text-base font-semibold text-[#2F463B]">Telegram-вход временно не открылся на сайте</p>
          <p className="mt-2 text-sm font-medium leading-relaxed text-[#2F463B]/58">
            Можно открыть бота и продолжить регистрацию там
          </p>
          <button
            type="button"
            onClick={() => openExternal(BOT_URL)}
            className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-[#2F463B] px-5 py-3 text-sm font-semibold text-[#F7EDE0]"
          >
            Открыть Telegram
            <ArrowRight className="ml-2 h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};

const SiteLink = ({
  href,
  children,
  className = '',
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: React.ReactNode }) => (
  <a href={href} className={className} {...props}>
    {children}
  </a>
);

const BrandMark = () => (
  <SiteLink href="/site" className="group flex items-center gap-3">
    <div className="site-brand-mark grid h-14 w-14 place-items-center overflow-hidden rounded-[1.35rem] bg-[#F8F3EC] shadow-[0_20px_60px_rgba(47,70,59,0.18)]">
      <img
        src="/logo.png"
        alt="Tarot by Danil"
        className="h-full w-full object-contain p-2 transition duration-500 group-hover:scale-105"
      />
    </div>
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.34em] text-[#C79672]">Tarot by Danil</p>
      <p className="text-lg font-semibold lowercase leading-none text-[#2F463B]">studio</p>
    </div>
  </SiteLink>
);

const MagneticLink = ({ href, children, variant = 'light' }: { href: string; children: React.ReactNode; variant?: 'light' | 'dark' }) => (
  <SiteLink
    href={href}
    className={`site-magnetic inline-flex items-center justify-center rounded-full px-7 py-4 text-base font-semibold transition will-change-transform ${
      variant === 'dark'
        ? 'bg-[#2F463B] text-[#F7EDE0] shadow-[0_22px_70px_rgba(47,70,59,0.18)]'
        : 'bg-[#F7EDE0] text-[#2F463B] shadow-[0_22px_70px_rgba(47,70,59,0.12)]'
    }`}
    data-magnetic
  >
    {children}
  </SiteLink>
);

const PageShell = ({
  page,
  user,
  cartCount,
  theme,
  onToggleTheme,
  children,
}: {
  page: SitePage;
  user: SiteUser | null;
  cartCount: number;
  theme: SiteTheme;
  onToggleTheme: () => void;
  children: React.ReactNode;
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <main className={`site-stage site-theme-${theme} min-h-screen overflow-x-hidden bg-[#F5EFE6] text-[#2F463B]`}>
      <MotionEngine />
      <div className="site-scroll-progress" />
      <div className="site-cursor-light" />
      <div className="site-noise" />
      <div className="site-orb site-orb-one" />
      <div className="site-orb site-orb-two" />
      <div className="site-orb site-orb-three" />
      <TarotBackground />

      <div className="relative z-10">
        <header className="site-header sticky top-0 z-40 mx-auto flex max-w-[1540px] items-center justify-between px-5 py-5 md:px-10 xl:px-16">
          <BrandMark />

          <nav className="hidden items-center rounded-full border border-[#2F463B]/10 bg-white/[0.68] p-1 text-sm font-semibold text-[#2F463B]/58 shadow-[0_18px_70px_rgba(47,70,59,0.1)] backdrop-blur-2xl lg:flex">
            {routes.map((route) => (
              <SiteLink
                key={route.page}
                href={route.href}
                className={`rounded-full px-5 py-3 transition ${
                  page === route.page ? 'bg-[#2F463B] text-[#F7EDE0]' : 'hover:bg-[#2F463B]/7 hover:text-[#2F463B]'
                }`}
              >
                {route.label}
              </SiteLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onToggleTheme}
              className="hidden h-12 w-12 place-items-center rounded-2xl border border-[#2F463B]/10 bg-white/70 text-[#2F463B] shadow-[0_18px_70px_rgba(47,70,59,0.08)] transition hover:-translate-y-0.5 md:grid"
              aria-label="Переключить тему"
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <SiteLink
              href="/site/payment"
              className="relative hidden h-12 w-12 place-items-center rounded-2xl border border-[#2F463B]/10 bg-white/70 text-[#2F463B] shadow-[0_18px_70px_rgba(47,70,59,0.08)] transition hover:-translate-y-0.5 md:grid"
              aria-label="Корзина"
            >
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#B98266] px-1 text-[11px] font-bold text-white">
                  {cartCount}
                </span>
              )}
            </SiteLink>
            <SiteLink href="/site/profile" className="hidden rounded-full bg-[#2F463B] px-6 py-3 text-sm font-semibold text-[#F7EDE0] shadow-[0_18px_70px_rgba(47,70,59,0.18)] transition hover:-translate-y-0.5 md:block">
              {user ? 'Кабинет' : 'Войти'}
            </SiteLink>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="grid h-12 w-12 place-items-center rounded-2xl border border-[#2F463B]/10 bg-white/70 text-[#2F463B] lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </header>

        {children}

        <footer className="mx-auto flex max-w-[1540px] flex-col gap-5 border-t border-[#2F463B]/10 px-5 py-10 text-sm font-medium text-[#2F463B]/48 md:flex-row md:items-center md:justify-between md:px-10 xl:px-16">
          <span>Tarot by Danil studio</span>
          <div className="flex flex-wrap gap-4">
            <SiteLink href="/site/consultations" className="transition hover:text-[#2F463B]">Консультации</SiteLink>
            <SiteLink href="/site/academy" className="transition hover:text-[#2F463B]">Академия</SiteLink>
            <SiteLink href="/site/profile" className="transition hover:text-[#2F463B]">Кабинет</SiteLink>
            {legalRoutes.map((route) => (
              <SiteLink key={route.page} href={route.href} className="transition hover:text-[#2F463B]">
                {route.label}
              </SiteLink>
            ))}
          </div>
        </footer>
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-50 bg-[#F5EFE6]/94 p-5 backdrop-blur-2xl lg:hidden">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-[0.32em] text-[#C79672]">Меню</p>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="grid h-12 w-12 place-items-center rounded-2xl bg-[#2F463B] text-[#F7EDE0]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-12 grid gap-3">
            {routes.map((route) => (
              <SiteLink key={route.page} href={route.href} className="site-reveal rounded-[2rem] border border-[#2F463B]/10 bg-white/[0.7] p-6 text-3xl font-semibold text-[#2F463B]">
                {route.label}
                {route.page === 'payment' && cartCount > 0 ? ` · ${cartCount}` : ''}
              </SiteLink>
            ))}
            <button
              type="button"
              onClick={onToggleTheme}
              className="site-reveal rounded-[2rem] border border-[#2F463B]/10 bg-white/[0.7] p-6 text-left text-2xl font-semibold text-[#2F463B]"
            >
              {theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
            </button>
            {legalRoutes.map((route) => (
              <SiteLink key={route.page} href={route.href} className="site-reveal rounded-[2rem] border border-[#2F463B]/10 bg-white/[0.7] p-6 text-2xl font-semibold text-[#2F463B]">
                {route.label}
              </SiteLink>
            ))}
          </div>
        </div>
      )}
    </main>
  );
};

const SectionIntro = ({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) => (
  <div className="site-reveal max-w-3xl">
    <p className="mb-4 text-xs font-bold uppercase tracking-[0.42em] text-[#C79672]">{eyebrow}</p>
    <h2 className="site-display text-[clamp(2.3rem,4vw,4.2rem)] leading-[1.05] text-[#2F463B]">{title}</h2>
    <p className="mt-6 max-w-2xl text-xl font-medium leading-relaxed text-[#2F463B]/62">{text}</p>
  </div>
);

const HomePage = () => (
  <>
    <section className="mx-auto grid min-h-[calc(100vh-92px)] max-w-[1540px] items-center gap-14 px-5 pb-20 pt-10 md:px-10 xl:grid-cols-[0.92fr_0.78fr] xl:px-16">
      <div className="site-reveal">
        <div className="mb-8 inline-flex rounded-full border border-[#2F463B]/10 bg-white/60 px-5 py-3 text-xs font-bold uppercase tracking-[0.32em] text-[#A9795F] backdrop-blur-xl">
          Tarot by Danil
        </div>
        <h1 className="site-display max-w-4xl text-[clamp(2.7rem,4.8vw,4.8rem)] leading-[1.04] text-[#2F463B]">
          Консультации и обучение Таро
        </h1>
        <p className="mt-7 max-w-2xl text-[clamp(1.05rem,1.3vw,1.28rem)] font-medium leading-relaxed text-[#2F463B]/66">
          Сайт для записи на консультации, обучения и входа в личный кабинет
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <MagneticLink href="/site/consultations" variant="dark">
            Выбрать консультацию
            <ArrowRight className="ml-3 h-5 w-5" />
          </MagneticLink>
          <MagneticLink href="/site/academy">
            Посмотреть обучение
          </MagneticLink>
        </div>
        <div className="mt-10 grid max-w-2xl gap-3 sm:grid-cols-4">
          {studioMoods.map((mood) => (
            <span key={mood} className="rounded-[1.2rem] border border-[#2F463B]/10 bg-white/[0.58] px-4 py-3 text-center text-sm font-semibold text-[#2F463B]/62 backdrop-blur-xl">
              {mood}
            </span>
          ))}
        </div>
      </div>

      <div className="site-reveal site-delay-1">
        <div className="site-service-board rounded-[2.8rem] border border-[#2F463B]/12 bg-white/[0.62] p-6 shadow-[0_36px_120px_rgba(47,70,59,0.14)] backdrop-blur-2xl">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.36em] text-[#A9795F]">Tarot by Danil</p>
              <h2 className="site-display mt-5 text-[clamp(1.9rem,2.5vw,2.8rem)] leading-[1.08] text-[#2F463B]">
                Что можно сделать на сайте
              </h2>
            </div>
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#2F463B] text-[#F7EDE0]">
              <MoonStar className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-8 grid gap-3">
            {studioPrinciples.map(([title, text]) => (
              <div key={title} className="site-service-row rounded-[1.5rem] border border-[#2F463B]/10 bg-[#F8F3EC]/72 p-5">
                <p className="text-2xl font-semibold text-[#2F463B]">{title}</p>
                <p className="mt-2 text-base font-medium leading-relaxed text-[#2F463B]/56">{text}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 rounded-[1.8rem] bg-[#2F463B] p-5 text-[#F7EDE0]">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#E6CDBA]/70">Личный кабинет</p>
            <p className="mt-3 text-2xl font-semibold">После входа видны записи, обучение и оплата</p>
          </div>
        </div>
      </div>
    </section>

    <section className="mx-auto grid max-w-[1540px] gap-5 px-5 py-20 md:grid-cols-3 md:px-10 xl:px-16">
      {studioSpaces.map((space, index) => (
        <SiteLink
          key={space.title}
          href={space.href}
          className={`site-reveal site-premium-card site-delay-${index + 1} group min-h-[320px] rounded-[2.4rem] border border-[#2F463B]/10 bg-white/[0.64] p-8 shadow-[0_24px_90px_rgba(47,70,59,0.1)] backdrop-blur-xl transition hover:-translate-y-2 hover:bg-white/[0.82]`}
        >
          <div className="flex h-full flex-col justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.34em] text-[#A9795F]">{space.label}</p>
              <h3 className="site-display mt-5 text-[clamp(1.8rem,2.5vw,2.6rem)] leading-[1.06] text-[#2F463B]">{space.title}</h3>
              <p className="mt-6 text-lg font-medium leading-relaxed text-[#2F463B]/58">{space.text}</p>
            </div>
            <div className="mt-10 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#2F463B] text-[#F7EDE0] transition group-hover:translate-x-2">
              <ArrowRight className="h-5 w-5" />
            </div>
          </div>
        </SiteLink>
      ))}
    </section>
  </>
);

const ConsultationsPage = () => (
  <section className="mx-auto max-w-[1540px] px-5 pb-24 pt-14 md:px-10 xl:px-16">
    <div className="grid gap-10 xl:grid-cols-[0.86fr_1.14fr]">
      <SectionIntro
        eyebrow="Консультации"
        title="Выберите формат"
        text="Можно записаться на конкретное время или оставить заявку без свободного окна"
      />
      <div className="site-reveal site-delay-1 rounded-[2.4rem] border border-[#2F463B]/10 bg-white/[0.72] p-7 text-[#2F463B] shadow-[0_32px_100px_rgba(47,70,59,0.12)] backdrop-blur-xl">
        <p className="text-xs font-bold uppercase tracking-[0.36em] text-[#B98266]">Запись</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {['выберите формат', 'оставьте заявку', 'дождитесь подтверждения'].map((step, index) => (
            <div key={step} className="rounded-[1.7rem] bg-[#2F463B]/6 p-5">
              <p className="site-display text-5xl text-[#A9795F]">0{index + 1}</p>
              <p className="mt-5 text-xl font-semibold">{step}</p>
            </div>
          ))}
        </div>
      </div>
    </div>

    <div className="mt-14 grid gap-5 md:grid-cols-2">
      {consultationCards.map((card, index) => (
        <div key={card.title} className={`site-reveal site-premium-card site-delay-${index + 1} rounded-[2.4rem] border border-[#2F463B]/10 bg-white/[0.68] p-7 shadow-[0_24px_90px_rgba(47,70,59,0.09)] backdrop-blur-xl transition hover:-translate-y-2`}>
          <div className="mb-8 flex items-start justify-between gap-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.38em] text-[#C79672]">{card.tag}</p>
              <h3 className="site-display mt-4 text-[clamp(1.8rem,2.5vw,2.7rem)] leading-[1.06]">{card.title}</h3>
            </div>
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#2F463B] text-[#F7EDE0]">
              <MoonStar className="h-5 w-5" />
            </div>
          </div>
          <p className="min-h-[110px] text-xl font-medium leading-relaxed text-[#2F463B]/58">{card.text}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <MagneticLink href="/site/profile">Записаться</MagneticLink>
            <MagneticLink href={BOT_URL} variant="dark">Открыть приложение</MagneticLink>
          </div>
        </div>
      ))}
    </div>
  </section>
);

const AcademyPage = () => (
  <section className="mx-auto max-w-[1540px] px-5 pb-24 pt-14 md:px-10 xl:px-16">
    <div className="grid gap-10 xl:grid-cols-[0.9fr_1.1fr]">
      <SectionIntro
        eyebrow="Академия"
        title="Обучение Таро"
        text="Индивидуальные и групповые программы с занятиями, домашними заданиями и кабинетом студента"
      />
      <div className="site-reveal site-delay-1 rounded-[2.4rem] border border-[#C79672]/22 bg-[#C79672]/18 p-7 text-[#2F463B] shadow-[0_32px_100px_rgba(47,70,59,0.1)] backdrop-blur-xl">
        <p className="text-xs font-bold uppercase tracking-[0.36em] text-[#A9795F]">Этапы</p>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {academySteps.map((step, index) => (
            <div key={step} className="rounded-[1.6rem] bg-white/[0.58] p-4">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#A9795F]/70">0{index + 1}</p>
              <p className="mt-2 text-xl font-semibold">{step}</p>
            </div>
          ))}
        </div>
      </div>
    </div>

    <div className="mt-14 grid gap-5 lg:grid-cols-3">
      {academyCards.map((card, index) => (
        <div key={card.title} className={`site-reveal site-premium-card site-delay-${index + 1} min-h-[430px] rounded-[2.4rem] border border-[#2F463B]/10 bg-white/[0.68] p-7 shadow-[0_24px_90px_rgba(47,70,59,0.09)] backdrop-blur-xl transition hover:-translate-y-2`}>
          <BookOpen className="h-8 w-8 text-[#C79672]" />
          <p className="mt-10 text-xs font-bold uppercase tracking-[0.38em] text-[#C79672]">Программа 0{index + 1}</p>
          <h3 className="site-display mt-4 text-[clamp(1.8rem,2.4vw,2.6rem)] leading-[1.06]">{card.title}</h3>
          <p className="mt-5 text-4xl font-semibold text-[#B98266]">{card.price}</p>
          <p className="mt-7 text-lg font-medium leading-relaxed text-[#2F463B]/58">{card.text}</p>
          <div className="mt-9">
            <MagneticLink href="/site/profile">Оставить заявку</MagneticLink>
          </div>
        </div>
      ))}
    </div>
  </section>
);

const ProfilePage = ({
  user,
  onLogout,
  onSessionRefresh,
}: {
  user: SiteUser | null;
  onLogout: () => Promise<void>;
  onSessionRefresh: () => Promise<void>;
}) => {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [form, setForm] = useState({
    name: user?.name || '',
    city: user?.city || '',
    phone: user?.phone || '',
    birth_date: user?.birth_date || '',
    gender: user?.gender || 'other',
    email: user?.email || '',
    password: '',
    passwordRepeat: '',
    personalDataAccepted: false,
    offerAccepted: false,
  });
  const [registrationDraft, setRegistrationDraft] = useState({
    username: '',
    name: '',
    city: '',
    phone: '',
    birth_date: '',
    gender: 'other' as 'male' | 'female' | 'other',
    email: '',
    password: '',
    passwordRepeat: '',
    personalDataAccepted: false,
    offerAccepted: false,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;

    setForm((current) => ({
      ...current,
      name: user.name || '',
      city: user.city || '',
      phone: user.phone || '',
      birth_date: user.birth_date || '',
      gender: user.gender || 'other',
      email: user.email || '',
      password: '',
      passwordRepeat: '',
      personalDataAccepted: false,
      offerAccepted: false,
    }));
  }, [user]);

  const loginWithEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/site/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Не удалось войти');
      }

      await onSessionRefresh();
    } catch (error: any) {
      alert(error.message || 'Не удалось войти');
    } finally {
      setLoading(false);
    }
  };

  const saveProfileAccess = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!user?.telegram_id) return;

    if (form.password.length < 8) {
      alert('Пароль должен быть от 8 символов');
      return;
    }

    if (form.password !== form.passwordRepeat) {
      alert('Пароли не совпадают');
      return;
    }

    if (!form.personalDataAccepted || !form.offerAccepted) {
      alert('Нужно принять условия регистрации');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/site/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegram_id: user.telegram_id,
          name: form.name,
          city: form.city,
          phone: form.phone,
          birth_date: form.birth_date,
          gender: form.gender,
          email: form.email,
          password: form.password,
          personalDataAccepted: form.personalDataAccepted,
          offerAccepted: form.offerAccepted,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Не удалось сохранить вход');
      }

      await onSessionRefresh();
    } catch (error: any) {
      alert(error.message || 'Не удалось сохранить вход');
    } finally {
      setLoading(false);
    }
  };

  const registerOnSite = async (event: React.FormEvent) => {
    event.preventDefault();

    const username = registrationDraft.username.trim().replace(/^@+/, '').toLowerCase();

    if (username.length < 2 || username.length > 64 || /[\u0000-\u001F\u007F<>]/.test(username)) {
      alert('Введите Telegram-ник или контактный ник от 2 символов');
      return;
    }

    if (registrationDraft.password.length < 8) {
      alert('Пароль должен быть от 8 символов');
      return;
    }

    if (registrationDraft.password !== registrationDraft.passwordRepeat) {
      alert('Пароли не совпадают');
      return;
    }

    if (!registrationDraft.personalDataAccepted || !registrationDraft.offerAccepted) {
      alert('Нужно принять условия регистрации');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/site/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username,
          name: registrationDraft.name,
          city: registrationDraft.city,
          phone: registrationDraft.phone,
          birth_date: registrationDraft.birth_date,
          gender: registrationDraft.gender,
          email: registrationDraft.email,
          password: registrationDraft.password,
          personalDataAccepted: registrationDraft.personalDataAccepted,
          offerAccepted: registrationDraft.offerAccepted,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Не удалось зарегистрироваться');
      }

      await onSessionRefresh();
    } catch (error: any) {
      alert(error.message || 'Не удалось зарегистрироваться');
    } finally {
      setLoading(false);
    }
  };

  const needsProfileAccess = Boolean(user && (!user.email || !user.has_site_password));

  return (
    <section className="mx-auto max-w-[1540px] px-5 pb-24 pt-14 md:px-10 xl:px-16">
      <div className="grid gap-10 xl:grid-cols-[0.78fr_1.22fr]">
        <SectionIntro
          eyebrow="Кабинет"
          title={user ? 'Ваш кабинет' : 'Войти в кабинет'}
          text={user ? 'Здесь будут записи, обучение, бонусы и оплата' : 'Можно войти по почте или создать профиль на сайте'}
        />

        <div className="site-reveal site-delay-1 rounded-[2.4rem] border border-[#2F463B]/10 bg-white/[0.68] p-7 shadow-[0_24px_90px_rgba(47,70,59,0.09)] backdrop-blur-xl">
          {user ? (
            <div>
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.36em] text-[#C79672]">Профиль</p>
                  <h2 className="site-display mt-4 text-[clamp(2rem,3vw,3rem)] leading-[1.06]">{user.name}</h2>
                  <p className="mt-3 text-lg font-medium text-[#2F463B]/50">
                    @{user.username || 'telegram'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  className="inline-flex items-center justify-center rounded-full bg-[#2F463B] px-5 py-3 text-sm font-semibold text-[#F7EDE0]"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Выйти
                </button>
              </div>

              {needsProfileAccess && (
                <form onSubmit={saveProfileAccess} className="mt-8 rounded-[2rem] border border-[#C79672]/20 bg-[#F7EDE0]/74 p-5">
                  <p className="mb-4 text-xs font-bold uppercase tracking-[0.34em] text-[#B98266]">Вход на сайт</p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 flex items-center text-sm font-semibold text-[#2F463B]">
                        <UserRound className="mr-2 h-4 w-4" />
                        Telegram
                      </span>
                      <input
                        value={user.username ? `@${user.username}` : String(user.telegram_id)}
                        readOnly
                        className="w-full rounded-2xl border border-[#2F463B]/10 bg-[#E7DED2] px-4 py-4 font-semibold text-[#2F463B]/58 outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 text-sm font-semibold text-[#2F463B]">Имя</span>
                      <input
                        value={form.name}
                        onChange={(event) => setForm({ ...form, name: event.target.value })}
                        className="w-full rounded-2xl border border-[#2F463B]/10 bg-white/74 px-4 py-4 font-semibold text-[#2F463B] outline-none focus:border-[#2F463B]"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 text-sm font-semibold text-[#2F463B]">Город</span>
                      <input
                        value={form.city}
                        onChange={(event) => setForm({ ...form, city: event.target.value })}
                        className="w-full rounded-2xl border border-[#2F463B]/10 bg-white/74 px-4 py-4 font-semibold text-[#2F463B] outline-none focus:border-[#2F463B]"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 text-sm font-semibold text-[#2F463B]">Телефон</span>
                      <input
                        value={form.phone}
                        onChange={(event) => setForm({ ...form, phone: event.target.value })}
                        className="w-full rounded-2xl border border-[#2F463B]/10 bg-white/74 px-4 py-4 font-semibold text-[#2F463B] outline-none focus:border-[#2F463B]"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 text-sm font-semibold text-[#2F463B]">День рождения</span>
                      <input
                        type="date"
                        value={form.birth_date || ''}
                        onChange={(event) => setForm({ ...form, birth_date: event.target.value })}
                        className="w-full rounded-2xl border border-[#2F463B]/10 bg-white/74 px-4 py-4 font-semibold text-[#2F463B] outline-none focus:border-[#2F463B]"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 text-sm font-semibold text-[#2F463B]">Пол</span>
                      <select
                        value={form.gender || 'other'}
                        onChange={(event) => setForm({ ...form, gender: event.target.value as 'male' | 'female' | 'other' })}
                        className="w-full rounded-2xl border border-[#2F463B]/10 bg-white/74 px-4 py-4 font-semibold text-[#2F463B] outline-none focus:border-[#2F463B]"
                      >
                        <option value="female">Женский</option>
                        <option value="male">Мужской</option>
                        <option value="other">Не указывать</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-2 flex items-center text-sm font-semibold text-[#2F463B]">
                        <Mail className="mr-2 h-4 w-4" />
                        Почта
                      </span>
                      <input
                        type="email"
                        required
                        value={form.email}
                        onChange={(event) => setForm({ ...form, email: event.target.value })}
                        className="w-full rounded-2xl border border-[#2F463B]/10 bg-white/74 px-4 py-4 font-semibold text-[#2F463B] outline-none focus:border-[#2F463B]"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 flex items-center text-sm font-semibold text-[#2F463B]">
                        <Lock className="mr-2 h-4 w-4" />
                        Пароль
                      </span>
                      <input
                        type="password"
                        required
                        minLength={8}
                        value={form.password}
                        onChange={(event) => setForm({ ...form, password: event.target.value })}
                        className="w-full rounded-2xl border border-[#2F463B]/10 bg-white/74 px-4 py-4 font-semibold text-[#2F463B] outline-none focus:border-[#2F463B]"
                      />
                    </label>
                    <label className="block md:col-span-2">
                      <span className="mb-2 flex items-center text-sm font-semibold text-[#2F463B]">
                        <Lock className="mr-2 h-4 w-4" />
                        Повтор пароля
                      </span>
                      <input
                        type="password"
                        required
                        minLength={8}
                        value={form.passwordRepeat}
                        onChange={(event) => setForm({ ...form, passwordRepeat: event.target.value })}
                        className="w-full rounded-2xl border border-[#2F463B]/10 bg-white/74 px-4 py-4 font-semibold text-[#2F463B] outline-none focus:border-[#2F463B]"
                      />
                    </label>
                  </div>
                  <div className="mt-5 space-y-3 rounded-[1.5rem] border border-[#2F463B]/10 bg-white/62 p-4">
                    <label className="flex items-start gap-3 text-sm font-semibold leading-relaxed text-[#2F463B]">
                      <input
                        type="checkbox"
                        required
                        checked={form.personalDataAccepted}
                        onChange={(event) => setForm({ ...form, personalDataAccepted: event.target.checked })}
                        className="mt-1 h-5 w-5 accent-[#2F463B]"
                      />
                      <span>
                        Согласен на{' '}
                        <SiteLink href="/site/privacy" className="underline decoration-[#C79672] underline-offset-4">
                          обработку персональных данных
                        </SiteLink>
                      </span>
                    </label>
                    <label className="flex items-start gap-3 text-sm font-semibold leading-relaxed text-[#2F463B]">
                      <input
                        type="checkbox"
                        required
                        checked={form.offerAccepted}
                        onChange={(event) => setForm({ ...form, offerAccepted: event.target.checked })}
                        className="mt-1 h-5 w-5 accent-[#2F463B]"
                      />
                      <span>
                        Принимаю{' '}
                        <SiteLink href="/site/offer" className="underline decoration-[#C79672] underline-offset-4">
                          условия договора-оферты
                        </SiteLink>
                      </span>
                    </label>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-[#2F463B] px-6 py-4 text-base font-semibold text-[#F7EDE0] disabled:opacity-50"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {loading ? 'Сохраняю' : 'Сохранить вход'}
                  </button>
                </form>
              )}

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                {[
                  ['статус', user.status || 'Первое знакомство'],
                  ['бонусы', `${user.bonus_balance || 0} ₽`],
                  ['город', user.city || 'не указан'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[1.7rem] bg-[#2F463B]/7 p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#C79672]">{label}</p>
                    <p className="mt-4 text-3xl font-semibold">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <MagneticLink href={BOT_URL}>Открыть приложение</MagneticLink>
                <MagneticLink href="/site/academy" variant="dark">Посмотреть академию</MagneticLink>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.36em] text-[#C79672]">
                {authMode === 'login' ? 'Вход' : 'Регистрация'}
              </p>
              <h2 className="site-display mt-4 text-[clamp(2rem,3vw,3.2rem)] leading-[1.02]">Личный кабинет</h2>

              <div className="mt-7 inline-flex rounded-full bg-[#F7EDE0] p-1">
                {[
                  ['login', 'Войти'],
                  ['register', 'Регистрация'],
                ].map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setAuthMode(mode as 'login' | 'register')}
                    className={`rounded-full px-5 py-3 text-sm font-semibold transition ${
                      authMode === mode ? 'bg-[#2F463B] text-[#F7EDE0]' : 'text-[#2F463B]/62'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {authMode === 'login' ? (
                <div className="mt-8 grid gap-5 xl:grid-cols-2">
                  <form onSubmit={loginWithEmail} className="rounded-[1.7rem] bg-[#F7EDE0] p-5 text-[#2F463B]">
                    <p className="mb-4 text-sm font-semibold text-[#2F463B]/58">Войти по почте</p>
                    <label className="mb-4 block">
                      <span className="mb-2 flex items-center text-sm font-semibold">
                        <Mail className="mr-2 h-4 w-4" />
                        Почта
                      </span>
                      <input
                        type="email"
                        required
                        value={loginEmail}
                        onChange={(event) => setLoginEmail(event.target.value)}
                        className="w-full rounded-2xl border border-[#2F463B]/10 bg-white px-4 py-4 font-semibold text-[#2F463B] outline-none focus:border-[#2F463B]"
                      />
                    </label>
                    <label className="mb-5 block">
                      <span className="mb-2 flex items-center text-sm font-semibold">
                        <Lock className="mr-2 h-4 w-4" />
                        Пароль
                      </span>
                      <input
                        type="password"
                        required
                        value={loginPassword}
                        onChange={(event) => setLoginPassword(event.target.value)}
                        className="w-full rounded-2xl border border-[#2F463B]/10 bg-white px-4 py-4 font-semibold text-[#2F463B] outline-none focus:border-[#2F463B]"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex w-full items-center justify-center rounded-full bg-[#2F463B] px-6 py-4 text-base font-semibold text-[#F7EDE0] disabled:opacity-50"
                    >
                      {loading ? 'Вхожу' : 'Войти'}
                    </button>
                  </form>

                  <div className="rounded-[1.7rem] bg-[#F7EDE0] p-5 text-[#2F463B]">
                    <p className="mb-4 text-sm font-semibold text-[#2F463B]/58">Первый вход через Telegram</p>
                    <TelegramLoginWidget />
                  </div>
                </div>
              ) : (
                <form onSubmit={registerOnSite} className="mt-8 rounded-[1.7rem] bg-[#F7EDE0] p-5 text-[#2F463B]">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block md:col-span-2">
                      <span className="mb-2 flex items-center text-sm font-semibold">
                        <UserRound className="mr-2 h-4 w-4" />
                        Telegram-ник
                      </span>
                      <input
                        required
                        value={registrationDraft.username}
                        onChange={(event) => setRegistrationDraft({ ...registrationDraft, username: event.target.value })}
                        className="w-full rounded-2xl border border-[#2F463B]/10 bg-white px-4 py-4 font-semibold text-[#2F463B] outline-none focus:border-[#2F463B]"
                        placeholder="например @tesr"
                      />
                      <span className="mt-2 block text-xs font-semibold text-[#2F463B]/46">
                        Можно указать короткий ник вручную, при входе через Telegram он подтянется сам
                      </span>
                    </label>
                    <label className="block">
                      <span className="mb-2 text-sm font-semibold">Имя</span>
                      <input
                        required
                        value={registrationDraft.name}
                        onChange={(event) => setRegistrationDraft({ ...registrationDraft, name: event.target.value })}
                        className="w-full rounded-2xl border border-[#2F463B]/10 bg-white px-4 py-4 font-semibold text-[#2F463B] outline-none focus:border-[#2F463B]"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 text-sm font-semibold">Город</span>
                      <input
                        required
                        value={registrationDraft.city}
                        onChange={(event) => setRegistrationDraft({ ...registrationDraft, city: event.target.value })}
                        className="w-full rounded-2xl border border-[#2F463B]/10 bg-white px-4 py-4 font-semibold text-[#2F463B] outline-none focus:border-[#2F463B]"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 text-sm font-semibold">Телефон</span>
                      <input
                        value={registrationDraft.phone}
                        onChange={(event) => setRegistrationDraft({ ...registrationDraft, phone: event.target.value })}
                        className="w-full rounded-2xl border border-[#2F463B]/10 bg-white px-4 py-4 font-semibold text-[#2F463B] outline-none focus:border-[#2F463B]"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 text-sm font-semibold">День рождения</span>
                      <input
                        type="date"
                        value={registrationDraft.birth_date}
                        onChange={(event) => setRegistrationDraft({ ...registrationDraft, birth_date: event.target.value })}
                        className="w-full rounded-2xl border border-[#2F463B]/10 bg-white px-4 py-4 font-semibold text-[#2F463B] outline-none focus:border-[#2F463B]"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 text-sm font-semibold">Пол</span>
                      <select
                        value={registrationDraft.gender}
                        onChange={(event) => setRegistrationDraft({ ...registrationDraft, gender: event.target.value as 'male' | 'female' | 'other' })}
                        className="w-full rounded-2xl border border-[#2F463B]/10 bg-white px-4 py-4 font-semibold text-[#2F463B] outline-none focus:border-[#2F463B]"
                      >
                        <option value="female">Женский</option>
                        <option value="male">Мужской</option>
                        <option value="other">Не указывать</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-2 flex items-center text-sm font-semibold">
                        <Mail className="mr-2 h-4 w-4" />
                        Почта
                      </span>
                      <input
                        type="email"
                        required
                        value={registrationDraft.email}
                        onChange={(event) => setRegistrationDraft({ ...registrationDraft, email: event.target.value })}
                        className="w-full rounded-2xl border border-[#2F463B]/10 bg-white px-4 py-4 font-semibold text-[#2F463B] outline-none focus:border-[#2F463B]"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 flex items-center text-sm font-semibold">
                        <Lock className="mr-2 h-4 w-4" />
                        Пароль
                      </span>
                      <input
                        type="password"
                        required
                        minLength={8}
                        value={registrationDraft.password}
                        onChange={(event) => setRegistrationDraft({ ...registrationDraft, password: event.target.value })}
                        className="w-full rounded-2xl border border-[#2F463B]/10 bg-white px-4 py-4 font-semibold text-[#2F463B] outline-none focus:border-[#2F463B]"
                      />
                    </label>
                    <label className="block md:col-span-2">
                      <span className="mb-2 flex items-center text-sm font-semibold">
                        <Lock className="mr-2 h-4 w-4" />
                        Повтор пароля
                      </span>
                      <input
                        type="password"
                        required
                        minLength={8}
                        value={registrationDraft.passwordRepeat}
                        onChange={(event) => setRegistrationDraft({ ...registrationDraft, passwordRepeat: event.target.value })}
                        className="w-full rounded-2xl border border-[#2F463B]/10 bg-white px-4 py-4 font-semibold text-[#2F463B] outline-none focus:border-[#2F463B]"
                      />
                    </label>
                  </div>

                  <div className="mt-5 space-y-3 rounded-[1.5rem] border border-[#2F463B]/10 bg-white/62 p-4">
                    <label className="flex items-start gap-3 text-sm font-semibold leading-relaxed text-[#2F463B]">
                      <input
                        type="checkbox"
                        required
                        checked={registrationDraft.personalDataAccepted}
                        onChange={(event) => setRegistrationDraft({ ...registrationDraft, personalDataAccepted: event.target.checked })}
                        className="mt-1 h-5 w-5 accent-[#2F463B]"
                      />
                      <span>
                        Согласен на{' '}
                        <SiteLink href="/site/privacy" className="underline decoration-[#C79672] underline-offset-4">
                          обработку персональных данных
                        </SiteLink>
                      </span>
                    </label>
                    <label className="flex items-start gap-3 text-sm font-semibold leading-relaxed text-[#2F463B]">
                      <input
                        type="checkbox"
                        required
                        checked={registrationDraft.offerAccepted}
                        onChange={(event) => setRegistrationDraft({ ...registrationDraft, offerAccepted: event.target.checked })}
                        className="mt-1 h-5 w-5 accent-[#2F463B]"
                      />
                      <span>
                        Принимаю{' '}
                        <SiteLink href="/site/offer" className="underline decoration-[#C79672] underline-offset-4">
                          условия договора-оферты
                        </SiteLink>
                      </span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-[#2F463B] px-6 py-4 text-base font-semibold text-[#F7EDE0] disabled:opacity-50"
                  >
                    {loading ? 'Регистрирую' : 'Зарегистрироваться'}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

const LegalPage = ({ document }: { document: LegalDocument }) => (
  <section className="mx-auto max-w-[1120px] px-5 pb-24 pt-14 md:px-10 xl:px-16">
    <div className="site-reveal rounded-[2.6rem] border border-[#2F463B]/10 bg-white/[0.74] p-7 shadow-[0_32px_100px_rgba(47,70,59,0.1)] backdrop-blur-xl md:p-10">
      <p className="text-xs font-bold uppercase tracking-[0.42em] text-[#C79672]">{document.subtitle}</p>
      <h1 className="site-display mt-5 text-[clamp(2.4rem,5vw,5rem)] leading-[1.02] text-[#2F463B]">
        {document.title}
      </h1>
      <p className="mt-6 max-w-3xl text-xl font-medium leading-relaxed text-[#2F463B]/62">
        {document.intro}
      </p>

      <div className="mt-10 grid gap-4">
        {document.sections.map((section, index) => (
          <div
            key={section.title}
            className="rounded-[1.8rem] border border-[#2F463B]/10 bg-[#F7EDE0]/72 p-5 text-[#2F463B]"
          >
            <div className="mb-3 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-sm font-bold text-[#B98266]">
                {index + 1}
              </span>
              <h2 className="text-xl font-semibold">{section.title}</h2>
            </div>
            <p className="text-base font-medium leading-relaxed text-[#2F463B]/62">{section.text}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const SiteCartPanel = ({
  cart,
  paymentMethods,
  onRemove,
  onClear,
  compact = false,
}: {
  cart: CartItem[];
  paymentMethods: PaymentMethod[];
  onRemove: (id: string) => void;
  onClear: () => void;
  compact?: boolean;
}) => {
  const activeMethod = paymentMethods[0];
  const total = cart.reduce((sum, item) => sum + Number(item.price || 0), 0);

  return (
    <div className={`rounded-[2rem] border border-[#2F463B]/10 bg-white/[0.74] p-5 text-[#2F463B] shadow-[0_26px_90px_rgba(47,70,59,0.1)] backdrop-blur-xl ${compact ? '' : 'md:p-7'}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.34em] text-[#B98266]">Корзина</p>
          <h2 className="site-display mt-3 text-[clamp(2rem,3vw,3.2rem)] leading-[1.02]">К оплате</h2>
        </div>
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#2F463B] text-[#F7EDE0]">
          <ShoppingCart className="h-6 w-6" />
        </div>
      </div>

      {cart.length === 0 ? (
        <div className="mt-6 rounded-[1.5rem] border border-dashed border-[#2F463B]/16 bg-[#F7EDE0]/70 p-5">
          <p className="text-base font-semibold">Корзина пока пустая</p>
          <p className="mt-2 text-sm font-medium leading-relaxed text-[#2F463B]/58">
            Добавьте консультацию, курс или услугу — оплата откроется отсюда
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {cart.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-4 rounded-[1.4rem] bg-[#F7EDE0]/82 p-4">
              <div>
                <p className="text-base font-semibold">{item.title}</p>
                {item.meta && <p className="mt-1 text-sm font-medium text-[#2F463B]/50">{item.meta}</p>}
              </div>
              <div className="flex items-center gap-3">
                <span className="whitespace-nowrap text-lg font-semibold text-[#8B604A]">{formatMoney(item.price)}</span>
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#2F463B]/52 transition hover:text-red-500"
                  aria-label="Убрать из корзины"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between rounded-[1.5rem] bg-[#2F463B] p-5 text-[#F7EDE0]">
            <span className="text-sm font-bold uppercase tracking-[0.28em] text-[#F7EDE0]/58">Итого</span>
            <span className="text-3xl font-semibold">{formatMoney(total)}</span>
          </div>
          <button
            type="button"
            onClick={() => activeMethod?.payment_url && openExternal(activeMethod.payment_url)}
            disabled={!activeMethod?.payment_url}
            className="site-magnetic inline-flex w-full items-center justify-center rounded-full bg-[#2F463B] px-7 py-5 text-lg font-semibold text-[#F7EDE0] transition disabled:opacity-40"
            data-magnetic
          >
            Оплатить из корзины
            <ArrowRight className="ml-3 h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={onClear}
            className="inline-flex w-full items-center justify-center rounded-full border border-[#2F463B]/10 bg-white/70 px-6 py-4 text-sm font-semibold text-[#2F463B]/64"
          >
            Очистить корзину
          </button>
        </div>
      )}
    </div>
  );
};

const ProfileCabinetPage = ({
  user,
  onLogout,
  onSessionRefresh,
  cart,
  paymentMethods,
  onAddToCart,
  onRemoveFromCart,
  onClearCart,
}: {
  user: SiteUser | null;
  onLogout: () => Promise<void>;
  onSessionRefresh: () => Promise<void>;
  cart: CartItem[];
  paymentMethods: PaymentMethod[];
  onAddToCart: (item: CartItem) => void;
  onRemoveFromCart: (id: string) => void;
  onClearCart: () => void;
}) => {
  const [services, setServices] = useState<SiteService[]>([]);
  const [consultations, setConsultations] = useState<SiteConsultation[]>([]);
  const [enrollments, setEnrollments] = useState<TrainingEnrollment[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;
    const loadCabinet = async () => {
      setLoadingData(true);
      try {
        const [servicesResponse, consultationsResponse, enrollmentsResponse] = await Promise.allSettled([
          supabase.from('services').select('*').eq('is_active', true).order('price', { ascending: true }),
          supabase
            .from('consultations')
            .select('id, scheduled_at, requested_date, requested_time_text, scheduling_status, status, price, payment_status, payment_amount, priority_fee, services(title, duration_minutes)')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(8),
          supabase
            .from('training_enrollments')
            .select('id,status,payment_status,final_price,created_at,training_programs(title,price),training_groups(title,starts_at)')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(8),
        ]);

        if (cancelled) return;

        if (servicesResponse.status === 'fulfilled') setServices(((servicesResponse.value.data || []) as SiteService[]).filter((item) => item.title));
        if (consultationsResponse.status === 'fulfilled') {
          setConsultations(((consultationsResponse.value.data || []) as any[]).map((item) => ({ ...item, services: one(item.services) })));
        }
        if (enrollmentsResponse.status === 'fulfilled') {
          setEnrollments(
            ((enrollmentsResponse.value.data || []) as any[]).map((item) => ({
              ...item,
              training_programs: one(item.training_programs),
              training_groups: one(item.training_groups),
            })),
          );
        }
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    };

    loadCabinet();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (!user) {
    return <ProfilePage user={user} onLogout={onLogout} onSessionRefresh={onSessionRefresh} />;
  }

  const nextConsultation = consultations.find((item) => item.scheduled_at || item.requested_date) || consultations[0];
  const dueConsultations = consultations.filter((item) => needsPayment(item.payment_status) && getConsultationPrice(item) > 0);
  const dueEnrollments = enrollments.filter((item) => needsPayment(item.payment_status) && Number(item.final_price || item.training_programs?.price || 0) > 0);
  const serviceCategories = Array.from(new Set(services.map((service) => service.category).filter(Boolean))) as string[];

  return (
    <section className="mx-auto max-w-[1540px] px-5 pb-24 pt-14 md:px-10 xl:px-16">
      <div className="grid gap-10 xl:grid-cols-[0.86fr_1.14fr]">
        <div className="site-reveal rounded-[2.7rem] bg-[#2F463B] p-7 text-[#F7EDE0] shadow-[0_34px_110px_rgba(47,70,59,0.22)] md:p-9">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.36em] text-[#E2CDB6]/70">Личный кабинет</p>
              <h1 className="site-display mt-4 text-[clamp(2.6rem,5vw,5.8rem)] leading-[0.98]">{user.name}</h1>
              <p className="mt-4 text-lg font-semibold text-[#F7EDE0]/58">@{user.username || 'telegram'}</p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-[#F7EDE0] transition hover:bg-white/18"
              aria-label="Выйти"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              ['статус', user.status || 'Первое знакомство'],
              ['бонусы', formatMoney(user.bonus_balance || 0)],
              ['записи', consultations.length],
              ['обучение', enrollments.length],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-[1.6rem] bg-white/10 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#E2CDB6]/58">{label}</p>
                <p className="mt-3 text-2xl font-semibold">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-[2rem] border border-white/12 bg-white/8 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.32em] text-[#E2CDB6]/70">Ближайшее</p>
            {nextConsultation ? (
              <>
                <h2 className="mt-3 text-2xl font-semibold">{getConsultationTitle(nextConsultation)}</h2>
                <p className="mt-2 text-base font-medium text-[#F7EDE0]/60">
                  {formatDateTime(nextConsultation.scheduled_at || nextConsultation.requested_date)}
                </p>
              </>
            ) : (
              <p className="mt-3 text-base font-medium text-[#F7EDE0]/60">Пока нет активной записи</p>
            )}
          </div>
        </div>

        <div className="grid gap-5">
          <SiteCartPanel
            cart={cart}
            paymentMethods={paymentMethods}
            onRemove={onRemoveFromCart}
            onClear={onClearCart}
            compact
          />

          <div className="site-reveal site-delay-1 rounded-[2rem] border border-[#2F463B]/10 bg-white/[0.74] p-5 shadow-[0_26px_90px_rgba(47,70,59,0.08)] backdrop-blur-xl md:p-7">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.34em] text-[#B98266]">Ожидает оплаты</p>
                <h2 className="site-display mt-3 text-[clamp(1.8rem,3vw,3rem)] leading-[1.02]">Оплаты и заявки</h2>
              </div>
              <Wallet className="h-8 w-8 text-[#B98266]" />
            </div>
            <div className="mt-6 grid gap-3">
              {[...dueConsultations, ...dueEnrollments].length === 0 && (
                <div className="rounded-[1.5rem] bg-[#F7EDE0]/72 p-5 text-base font-semibold text-[#2F463B]/62">
                  Сейчас нет неоплаченных позиций
                </div>
              )}
              {dueConsultations.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    onAddToCart({
                      id: `consultation:${item.id}`,
                      source: 'consultation',
                      title: getConsultationTitle(item),
                      price: getConsultationPrice(item),
                      meta: formatDateTime(item.scheduled_at || item.requested_date),
                    })
                  }
                  className="flex items-center justify-between gap-4 rounded-[1.5rem] bg-[#F7EDE0]/72 p-5 text-left transition hover:-translate-y-0.5"
                >
                  <span>
                    <span className="block text-lg font-semibold">{getConsultationTitle(item)}</span>
                    <span className="mt-1 block text-sm font-medium text-[#2F463B]/52">{formatDateTime(item.scheduled_at || item.requested_date)}</span>
                  </span>
                  <span className="text-xl font-semibold text-[#8B604A]">{formatMoney(getConsultationPrice(item))}</span>
                </button>
              ))}
              {dueEnrollments.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    onAddToCart({
                      id: `training:${item.id}`,
                      source: 'training',
                      title: item.training_programs?.title || 'Обучение Таро',
                      price: Number(item.final_price || item.training_programs?.price || 0),
                      meta: item.training_groups?.title || 'курс',
                    })
                  }
                  className="flex items-center justify-between gap-4 rounded-[1.5rem] bg-[#F7EDE0]/72 p-5 text-left transition hover:-translate-y-0.5"
                >
                  <span>
                    <span className="block text-lg font-semibold">{item.training_programs?.title || 'Обучение Таро'}</span>
                    <span className="mt-1 block text-sm font-medium text-[#2F463B]/52">{item.training_groups?.title || 'курс'}</span>
                  </span>
                  <span className="text-xl font-semibold text-[#8B604A]">{formatMoney(item.final_price || item.training_programs?.price)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="site-reveal rounded-[2.2rem] border border-[#2F463B]/10 bg-white/[0.72] p-6 shadow-[0_26px_90px_rgba(47,70,59,0.08)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.34em] text-[#B98266]">Сервисы</p>
              <h2 className="site-display mt-3 text-[clamp(2rem,3vw,3.2rem)] leading-[1.02]">Все форматы</h2>
            </div>
            <CalendarCheck className="h-8 w-8 text-[#2F463B]/64" />
          </div>
          {serviceCategories.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {serviceCategories.map((category) => (
                <span key={category} className="rounded-full bg-[#F7EDE0] px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-[#8B604A]">
                  {category}
                </span>
              ))}
            </div>
          )}
          <div className="mt-6 grid gap-3">
            {loadingData && <p className="rounded-[1.5rem] bg-[#F7EDE0]/70 p-5 font-semibold text-[#2F463B]/58">Загружаю данные</p>}
            {!loadingData && services.length === 0 && (
              <p className="rounded-[1.5rem] bg-[#F7EDE0]/70 p-5 font-semibold text-[#2F463B]/58">Услуги пока не загрузились</p>
            )}
            {services.map((service) => (
              <div key={service.id} className="rounded-[1.7rem] bg-[#F7EDE0]/74 p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#B98266]">{service.category || 'формат'}</p>
                    <h3 className="mt-2 text-2xl font-semibold">{service.title}</h3>
                    {service.description && <p className="mt-2 max-w-2xl text-base font-medium leading-relaxed text-[#2F463B]/58">{service.description}</p>}
                    {service.duration_minutes ? (
                      <p className="mt-3 inline-flex items-center rounded-full bg-white px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#2F463B]/58">
                        <Clock className="mr-2 h-4 w-4" />
                        {service.duration_minutes} мин
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-2xl font-semibold text-[#8B604A]">{formatMoney(service.price)}</span>
                    <button
                      type="button"
                      onClick={() =>
                        onAddToCart({
                          id: `service:${service.id}`,
                          source: 'service',
                          title: service.title,
                          price: Number(service.price || 0),
                          meta: service.category || 'услуга',
                        })
                      }
                      className="inline-flex items-center rounded-full bg-[#2F463B] px-5 py-3 text-sm font-semibold text-[#F7EDE0]"
                    >
                      В корзину
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="site-reveal site-delay-1 rounded-[2.2rem] border border-[#2F463B]/10 bg-white/[0.72] p-6 shadow-[0_26px_90px_rgba(47,70,59,0.08)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.34em] text-[#B98266]">Обучение</p>
              <h2 className="site-display mt-3 text-[clamp(2rem,3vw,3.2rem)] leading-[1.02]">Ваши курсы</h2>
            </div>
            <GraduationCap className="h-8 w-8 text-[#2F463B]/64" />
          </div>
          <div className="mt-6 grid gap-3">
            {enrollments.length === 0 && (
              <div className="rounded-[1.5rem] bg-[#F7EDE0]/70 p-5">
                <p className="font-semibold text-[#2F463B]/62">Курсов пока нет</p>
                <SiteLink href="/site/academy" className="mt-4 inline-flex rounded-full bg-[#2F463B] px-5 py-3 text-sm font-semibold text-[#F7EDE0]">
                  Посмотреть академию
                </SiteLink>
              </div>
            )}
            {enrollments.map((item) => (
              <div key={item.id} className="rounded-[1.6rem] bg-[#F7EDE0]/74 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#B98266]">{item.status || 'заявка'}</p>
                <h3 className="mt-2 text-2xl font-semibold">{item.training_programs?.title || 'Обучение Таро'}</h3>
                <p className="mt-2 text-sm font-medium text-[#2F463B]/56">
                  {item.training_groups?.title || 'группа согласуется'} · {formatDateTime(item.training_groups?.starts_at)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const PaymentPage = ({
  paymentMethods,
  cart,
  onRemoveFromCart,
  onClearCart,
}: {
  paymentMethods: PaymentMethod[];
  cart: CartItem[];
  onRemoveFromCart: (id: string) => void;
  onClearCart: () => void;
}) => {
  const activeMethod = paymentMethods[0];

  return (
    <section className="mx-auto max-w-[1540px] px-5 pb-24 pt-14 md:px-10 xl:px-16">
      <div className="grid gap-10 xl:grid-cols-[0.92fr_1.08fr]">
        <SectionIntro
          eyebrow="Оплата"
          title="Корзина и оплата"
          text="Соберите консультации, обучение или услуги в корзину и оплачивайте одной кнопкой"
        />
        <div className="site-reveal site-delay-1">
          <SiteCartPanel
            cart={cart}
            paymentMethods={paymentMethods}
            onRemove={onRemoveFromCart}
            onClear={onClearCart}
          />
        </div>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-3">
        <div className="site-reveal rounded-[1.8rem] border border-[#2F463B]/10 bg-white/[0.66] p-5 text-[#2F463B] backdrop-blur-xl">
          <CreditCard className="h-7 w-7 text-[#B98266]" />
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.3em] text-[#B98266]">Способ</p>
          <h3 className="mt-2 text-2xl font-semibold">{activeMethod?.title || 'Не настроен'}</h3>
        </div>
        <div className="site-reveal site-delay-1 rounded-[1.8rem] border border-[#2F463B]/10 bg-white/[0.66] p-5 text-[#2F463B] backdrop-blur-xl">
          <Wallet className="h-7 w-7 text-[#B98266]" />
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.3em] text-[#B98266]">Итого</p>
          <h3 className="mt-2 text-2xl font-semibold">{formatMoney(cart.reduce((sum, item) => sum + item.price, 0))}</h3>
        </div>
        <div className="site-reveal site-delay-2 rounded-[1.8rem] border border-[#2F463B]/10 bg-white/[0.66] p-5 text-[#2F463B] backdrop-blur-xl">
          <Lock className="h-7 w-7 text-[#B98266]" />
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.3em] text-[#B98266]">Контроль</p>
          <h3 className="mt-2 text-2xl font-semibold">Подтверждение вручную</h3>
        </div>
      </div>

      {activeMethod?.instructions && (
        <div className="site-reveal mt-8 rounded-[2rem] border border-[#2F463B]/10 bg-[#F7EDE0]/72 p-6 text-[#2F463B]">
          <p className="text-xs font-bold uppercase tracking-[0.32em] text-[#B98266]">Комментарий к оплате</p>
          <p className="mt-3 text-base font-medium leading-relaxed text-[#2F463B]/62">{activeMethod.instructions}</p>
        </div>
      )}
    </section>
  );
};

const AuthMethodsNote = () => (
  <div className="mt-5 grid gap-3 rounded-[1.5rem] border border-[#2F463B]/10 bg-white/60 p-4 text-[#2F463B] md:grid-cols-2">
    {[
      ['Почта и пароль', 'работает сейчас'],
      ['Telegram', 'через официальный виджет'],
    ].map(([title, text]) => (
      <div key={title} className="rounded-[1.2rem] bg-[#F7EDE0]/76 p-4">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-[#2F463B]/42">{text}</p>
      </div>
    ))}
  </div>
);

const SiteProfileAuth = ({
  user,
  onLogout,
  onSessionRefresh,
}: {
  user: SiteUser | null;
  onLogout: () => Promise<void>;
  onSessionRefresh: () => Promise<void>;
}) => (
  <>
    <ProfilePage user={user} onLogout={onLogout} onSessionRefresh={onSessionRefresh} />
    {!user && (
      <section className="mx-auto -mt-20 max-w-[1540px] px-5 pb-24 md:px-10 xl:px-16">
        <AuthMethodsNote />
      </section>
    )}
  </>
);

export const StudioLanding = () => {
  const [page, setPage] = useState<SitePage>(() => getCurrentPage());
  const [user, setUser] = useState<SiteUser | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [cart, setCart] = useState<CartItem[]>(() => getStoredCart());
  const [theme, setTheme] = useState<SiteTheme>(() => getStoredTheme());

  const loadSession = async () => {
    try {
      const response = await fetch('/api/site/session', { credentials: 'include' });
      const payload = await response.json().catch(() => null);
      setUser(payload?.user || null);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    const onPopState = () => setPage(getCurrentPage());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    setPage(getCurrentPage());
  }, []);

  useEffect(() => {
    const loadPayments = async () => {
      const { data } = await supabase
        .from('payment_methods')
        .select('id,title,payment_url,instructions')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      setPaymentMethods((data || []) as PaymentMethod[]);
    };

    loadSession();
    loadPayments();
  }, []);

  useEffect(() => {
    window.localStorage.setItem('tarot-site-cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    window.localStorage.setItem('tarot-site-theme', theme);
  }, [theme]);

  const logout = async () => {
    try {
      await fetch('/api/site/logout', { method: 'POST', credentials: 'include' });
    } finally {
      setUser(null);
    }
  };

  const addToCart = (item: CartItem) => {
    if (!item.price || item.price <= 0) return;
    setCart((current) => {
      if (current.some((existing) => existing.id === item.id)) return current;
      return [...current, item];
    });
  };

  const removeFromCart = (id: string) => setCart((current) => current.filter((item) => item.id !== id));
  const clearCart = () => setCart([]);
  const toggleTheme = () => setTheme((current) => (current === 'dark' ? 'light' : 'dark'));

  const content = useMemo(() => {
    if (page === 'consultations') return <ConsultationsPage />;
    if (page === 'academy') return <AcademyPage />;
    if (page === 'profile') {
      return user ? (
        <ProfileCabinetPage
          user={user}
          onLogout={logout}
          onSessionRefresh={loadSession}
          cart={cart}
          paymentMethods={paymentMethods}
          onAddToCart={addToCart}
          onRemoveFromCart={removeFromCart}
          onClearCart={clearCart}
        />
      ) : (
        <SiteProfileAuth user={user} onLogout={logout} onSessionRefresh={loadSession} />
      );
    }
    if (page === 'payment') {
      return (
        <PaymentPage
          paymentMethods={paymentMethods}
          cart={cart}
          onRemoveFromCart={removeFromCart}
          onClearCart={clearCart}
        />
      );
    }
    if (page === 'privacy') return <LegalPage document={personalDataPolicy} />;
    if (page === 'offer') return <LegalPage document={offerTerms} />;
    return <HomePage />;
  }, [cart, page, paymentMethods, user]);

  return (
    <PageShell page={page} user={user} cartCount={cart.length} theme={theme} onToggleTheme={toggleTheme}>
      {page !== 'home' && (
        <div className="mx-auto max-w-[1540px] px-5 pt-7 md:px-10 xl:px-16">
          <SiteLink href="/site" className="site-reveal inline-flex items-center rounded-full border border-[#2F463B]/10 bg-white/70 px-5 py-3 text-sm font-semibold text-[#2F463B] backdrop-blur-xl transition hover:bg-white">
            <ChevronLeft className="mr-2 h-4 w-4" />
            На главную
          </SiteLink>
        </div>
      )}
      {content}
    </PageShell>
  );
};

export default StudioLanding;
