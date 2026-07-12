import { type AnchorHTMLAttributes, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  ChevronLeft,
  CreditCard,
  Lock,
  LogOut,
  Mail,
  Menu,
  MoonStar,
  Save,
  Sparkles,
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
  phone?: string | null;
  birth_date?: string | null;
  gender?: 'male' | 'female' | 'other' | null;
  email?: string | null;
  has_site_password?: boolean;
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
const SITE_REGISTER_DRAFT_KEY = 'tarot-site-register-draft';

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
  children,
}: {
  page: SitePage;
  user: SiteUser | null;
  children: React.ReactNode;
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <main className="site-stage min-h-screen overflow-x-hidden bg-[#F5EFE6] text-[#2F463B]">
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
  });
  const [registrationDraft, setRegistrationDraft] = useState({
    name: '',
    city: '',
    phone: '',
    birth_date: '',
    gender: 'other' as 'male' | 'female' | 'other',
    email: '',
    password: '',
    passwordRepeat: '',
  });
  const [showTelegramStep, setShowTelegramStep] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    let draft: Partial<typeof registrationDraft> = {};
    try {
      draft = JSON.parse(window.localStorage.getItem(SITE_REGISTER_DRAFT_KEY) || '{}');
    } catch {
      draft = {};
    }

    setForm((current) => ({
      ...current,
      name: user.name || draft.name || '',
      city: user.city || draft.city || '',
      phone: user.phone || draft.phone || '',
      birth_date: user.birth_date || draft.birth_date || '',
      gender: user.gender || draft.gender || 'other',
      email: user.email || draft.email || '',
      password: draft.password || '',
      passwordRepeat: draft.passwordRepeat || '',
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
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Не удалось сохранить вход');
      }

      await onSessionRefresh();
      window.localStorage.removeItem(SITE_REGISTER_DRAFT_KEY);
    } catch (error: any) {
      alert(error.message || 'Не удалось сохранить вход');
    } finally {
      setLoading(false);
    }
  };

  const prepareSiteRegistration = (event: React.FormEvent) => {
    event.preventDefault();

    if (registrationDraft.password.length < 8) {
      alert('Пароль должен быть от 8 символов');
      return;
    }

    if (registrationDraft.password !== registrationDraft.passwordRepeat) {
      alert('Пароли не совпадают');
      return;
    }

    window.localStorage.setItem(SITE_REGISTER_DRAFT_KEY, JSON.stringify(registrationDraft));
    setShowTelegramStep(true);
  };

  const needsProfileAccess = Boolean(user && (!user.email || !user.has_site_password));

  return (
    <section className="mx-auto max-w-[1540px] px-5 pb-24 pt-14 md:px-10 xl:px-16">
      <div className="grid gap-10 xl:grid-cols-[0.78fr_1.22fr]">
        <SectionIntro
          eyebrow="Кабинет"
          title={user ? 'Ваш кабинет' : 'Войти в кабинет'}
          text={user ? 'Здесь будут записи, обучение, бонусы и оплата' : 'Вход для клиентов и регистрация через Telegram'}
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
                <form onSubmit={prepareSiteRegistration} className="mt-8 rounded-[1.7rem] bg-[#F7EDE0] p-5 text-[#2F463B]">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block md:col-span-2">
                      <span className="mb-2 flex items-center text-sm font-semibold">
                        <UserRound className="mr-2 h-4 w-4" />
                        Telegram
                      </span>
                      <input
                        value="подтянется автоматически"
                        readOnly
                        className="w-full rounded-2xl border border-[#2F463B]/10 bg-[#E7DED2] px-4 py-4 font-semibold text-[#2F463B]/48 outline-none"
                      />
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
                  <button
                    type="submit"
                    className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-[#2F463B] px-6 py-4 text-base font-semibold text-[#F7EDE0]"
                  >
                    Продолжить через Telegram
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </button>

                  {showTelegramStep && (
                    <div className="mt-5 rounded-[1.5rem] border border-[#2F463B]/10 bg-white/60 p-4">
                      <p className="mb-4 text-sm font-semibold text-[#2F463B]/62">
                        Осталось подтвердить Telegram, после входа форма заполнится автоматически
                      </p>
                      <TelegramLoginWidget />
                    </div>
                  )}
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

const PaymentPage = ({ paymentMethods }: { paymentMethods: PaymentMethod[] }) => {
  const activeMethod = paymentMethods[0];

  return (
    <section className="mx-auto max-w-[1540px] px-5 pb-24 pt-14 md:px-10 xl:px-16">
      <div className="grid gap-10 xl:grid-cols-[0.92fr_1.08fr]">
        <SectionIntro
          eyebrow="Оплата"
          title="Оплатить запись"
          text="Выберите удобный способ и вернитесь в приложение после перевода"
        />
        <div className="site-reveal site-delay-1 rounded-[2.4rem] bg-white/[0.74] p-7 text-[#2F463B] shadow-[0_32px_100px_rgba(47,70,59,0.12)] backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[#2F463B] text-[#F7EDE0]">
              <CreditCard className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.36em] text-[#B98266]">способ оплаты</p>
              <h2 className="site-display mt-2 text-[clamp(2rem,3vw,3.2rem)] leading-[1.02]">{activeMethod?.title || 'Т-Банк'}</h2>
            </div>
          </div>
          <p className="mt-7 text-lg font-medium leading-relaxed text-[#2F463B]/58">
            {activeMethod?.instructions || 'После перевода вернитесь в приложение и нажмите “я оплатил”'}
          </p>
          <button
            type="button"
            onClick={() => activeMethod?.payment_url && openExternal(activeMethod.payment_url)}
            disabled={!activeMethod?.payment_url}
            className="site-magnetic mt-8 inline-flex w-full items-center justify-center rounded-full bg-[#2F463B] px-7 py-5 text-lg font-semibold text-[#F7EDE0] transition disabled:opacity-40"
            data-magnetic
          >
            Открыть оплату
            <ArrowRight className="ml-3 h-5 w-5" />
          </button>
        </div>
      </div>
    </section>
  );
};

export const StudioLanding = () => {
  const [page, setPage] = useState<SitePage>(() => getCurrentPage());
  const [user, setUser] = useState<SiteUser | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

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

  const logout = async () => {
    try {
      await fetch('/api/site/logout', { method: 'POST', credentials: 'include' });
    } finally {
      setUser(null);
    }
  };

  const content = useMemo(() => {
    if (page === 'consultations') return <ConsultationsPage />;
    if (page === 'academy') return <AcademyPage />;
    if (page === 'profile') return <ProfilePage user={user} onLogout={logout} onSessionRefresh={loadSession} />;
    if (page === 'payment') return <PaymentPage paymentMethods={paymentMethods} />;
    return <HomePage />;
  }, [page, paymentMethods, user]);

  return (
    <PageShell page={page} user={user}>
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
