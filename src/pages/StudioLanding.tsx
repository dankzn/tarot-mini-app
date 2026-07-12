import { type AnchorHTMLAttributes, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  ChevronLeft,
  CreditCard,
  LogOut,
  Menu,
  MoonStar,
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

  return <div ref={containerRef} className="min-h-[46px]" />;
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
    <div className="site-brand-mark grid h-14 w-14 place-items-center rounded-[1.35rem] bg-[#2F463B] text-[#F7EDE0] shadow-[0_20px_60px_rgba(47,70,59,0.18)]">
      <MoonStar className="h-5 w-5 transition duration-500 group-hover:rotate-12" />
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
}: {
  user: SiteUser | null;
  onLogout: () => Promise<void>;
}) => (
  <section className="mx-auto max-w-[1540px] px-5 pb-24 pt-14 md:px-10 xl:px-16">
    <div className="grid gap-10 xl:grid-cols-[0.78fr_1.22fr]">
      <SectionIntro
        eyebrow="Кабинет"
        title={user ? 'Ваш кабинет' : 'Войти в кабинет'}
        text={user ? 'Здесь будут записи, обучение, бонусы и оплата' : 'Войдите через Telegram, чтобы открыть свой профиль'}
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
            <p className="text-xs font-bold uppercase tracking-[0.36em] text-[#C79672]">Вход</p>
            <h2 className="site-display mt-4 text-[clamp(2rem,3vw,3.2rem)] leading-[1.02]">Личный кабинет</h2>
            <p className="mt-4 text-lg font-medium leading-relaxed text-[#2F463B]/58">
              После входа откроется личный кабинет с вашими записями, обучением и оплатой
            </p>
            <div className="mt-8 rounded-[1.7rem] bg-[#F7EDE0] p-5 text-[#2F463B]">
              <TelegramLoginWidget />
            </div>
          </div>
        )}
      </div>
    </div>
  </section>
);

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

  useEffect(() => {
    const onPopState = () => setPage(getCurrentPage());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    setPage(getCurrentPage());
  }, []);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const response = await fetch('/api/site/session', { credentials: 'include' });
        const payload = await response.json().catch(() => null);
        setUser(payload?.user || null);
      } catch {
        setUser(null);
      }
    };

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
    if (page === 'profile') return <ProfilePage user={user} onLogout={logout} />;
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
