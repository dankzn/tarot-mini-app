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
  ['без шоу', 'без страшилок, давления и мистического спектакля'],
  ['без публичности', 'личные темы остаются между нами'],
  ['без спешки', 'решение должно созреть, а не быть продано'],
];

const consultationCards = [
  {
    title: 'Личный разбор',
    tag: 'сложная ситуация',
    text: 'Смотрим, где факты, где тревога, где чужое влияние и какой шаг сейчас самый трезвый',
  },
  {
    title: 'Отношения',
    tag: 'контакт и динамика',
    text: 'Без гадания на чужую голову, с фокусом на вашу позицию, ожидания и реальные сигналы',
  },
  {
    title: 'Выбор',
    tag: 'работа, деньги, переезд',
    text: 'Сравниваем варианты по последствиям, рискам и внутренней цене решения',
  },
  {
    title: 'Карта дня',
    tag: 'отдельный формат',
    text: 'Не отношения и не работа, а короткий ориентир на день, состояние и ближайший фокус',
  },
];

const academyCards = [
  {
    title: 'Индивидуальная база',
    price: '20 000 ₽',
    text: 'Спокойный вход в Таро, структура колоды, первые расклады и практика без гонки',
  },
  {
    title: 'Расширенная программа',
    price: '40 000 ₽',
    text: 'Глубже в трактовки, этику, сложные запросы, уверенность и собственный язык чтения',
  },
  {
    title: 'Группа',
    price: '11 500 ₽ / с человека',
    text: 'Камерный ритм, живые занятия, домашние задания и практика в общем учебном поле',
  },
];

const academySteps = ['заявка', 'созвон', 'зачисление', 'занятия', 'домашки', 'практика'];

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
    <div className="site-brand-mark grid h-14 w-14 place-items-center rounded-[1.35rem] bg-[#F4EBDD] text-[#0D1510] shadow-[0_20px_70px_rgba(0,0,0,0.34)]">
      <MoonStar className="h-5 w-5 transition duration-500 group-hover:rotate-12" />
    </div>
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.34em] text-[#C79672]">Tarot by Danil</p>
      <p className="text-lg font-black lowercase leading-none text-[#F8F0E4]">studio</p>
    </div>
  </SiteLink>
);

const MagneticLink = ({ href, children, variant = 'light' }: { href: string; children: React.ReactNode; variant?: 'light' | 'dark' }) => (
  <SiteLink
    href={href}
    className={`site-magnetic inline-flex items-center justify-center rounded-full px-7 py-4 text-base font-black transition will-change-transform ${
      variant === 'dark'
        ? 'bg-[#0E1511] text-[#F7EDE0] shadow-[0_22px_80px_rgba(0,0,0,0.28)]'
        : 'bg-[#F7EDE0] text-[#0E1511] shadow-[0_22px_80px_rgba(0,0,0,0.2)]'
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
    <main className="site-stage min-h-screen overflow-x-hidden bg-[#0B120E] text-[#F7EDE0]">
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

          <nav className="hidden items-center rounded-full border border-white/10 bg-white/[0.055] p-1 text-sm font-black text-[#F7EDE0]/60 shadow-[0_18px_80px_rgba(0,0,0,0.18)] backdrop-blur-2xl lg:flex">
            {routes.map((route) => (
              <SiteLink
                key={route.page}
                href={route.href}
                className={`rounded-full px-5 py-3 transition ${
                  page === route.page ? 'bg-[#F7EDE0] text-[#0D1510]' : 'hover:bg-white/[0.08] hover:text-[#F7EDE0]'
                }`}
              >
                {route.label}
              </SiteLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <SiteLink href="/site/profile" className="hidden rounded-full bg-[#F7EDE0] px-6 py-3 text-sm font-black text-[#0D1510] shadow-[0_18px_70px_rgba(0,0,0,0.28)] transition hover:-translate-y-0.5 md:block">
              {user ? 'Кабинет' : 'Войти'}
            </SiteLink>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.08] text-[#F7EDE0] lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </header>

        {children}

        <footer className="mx-auto flex max-w-[1540px] flex-col gap-5 border-t border-white/10 px-5 py-10 text-sm font-bold text-[#F7EDE0]/48 md:flex-row md:items-center md:justify-between md:px-10 xl:px-16">
          <span>Tarot by Danil · private studio</span>
          <div className="flex flex-wrap gap-4">
            <SiteLink href="/site/consultations" className="transition hover:text-[#F7EDE0]">Консультации</SiteLink>
            <SiteLink href="/site/academy" className="transition hover:text-[#F7EDE0]">Академия</SiteLink>
            <SiteLink href="/site/profile" className="transition hover:text-[#F7EDE0]">Вход через Telegram</SiteLink>
          </div>
        </footer>
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-50 bg-[#0B120E]/94 p-5 backdrop-blur-2xl lg:hidden">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-[0.32em] text-[#C79672]">Меню</p>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="grid h-12 w-12 place-items-center rounded-2xl bg-[#F7EDE0] text-[#0D1510]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-12 grid gap-3">
            {routes.map((route) => (
              <SiteLink key={route.page} href={route.href} className="site-reveal rounded-[2rem] border border-white/10 bg-white/[0.08] p-6 text-3xl font-black text-[#F7EDE0]">
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
    <p className="mb-4 text-xs font-black uppercase tracking-[0.42em] text-[#C79672]">{eyebrow}</p>
    <h2 className="text-[clamp(3rem,7vw,7rem)] font-black leading-[0.88] tracking-[-0.075em] text-[#F8F0E4]">{title}</h2>
    <p className="mt-6 text-xl font-semibold leading-relaxed text-[#F8F0E4]/58">{text}</p>
  </div>
);

const HomePage = () => (
  <>
    <section className="mx-auto grid min-h-[calc(100vh-92px)] max-w-[1540px] items-center gap-12 px-5 pb-20 pt-10 md:px-10 xl:grid-cols-[1.05fr_0.95fr] xl:px-16">
      <div className="site-reveal">
        <div className="mb-8 inline-flex rounded-full border border-white/12 bg-white/[0.055] px-5 py-3 text-xs font-black uppercase tracking-[0.34em] text-[#C79672] backdrop-blur-xl">
          private tarot studio
        </div>
        <h1 aria-label="Таро без спектакля" className="max-w-5xl text-[clamp(4.7rem,11vw,11.6rem)] font-black leading-[0.82] tracking-[-0.095em] text-[#F8F0E4]">
          Таро без
          <span className="block text-[#B98266]">спектакля</span>
        </h1>
        <p className="mt-8 max-w-2xl text-[clamp(1.25rem,2vw,2rem)] font-semibold leading-relaxed text-[#F8F0E4]/64">
          Для моментов, когда внутри шумно, а решение нужно принимать не из паники
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <MagneticLink href="/site/profile">
            Войти через Telegram
            <ArrowRight className="ml-3 h-5 w-5" />
          </MagneticLink>
          <MagneticLink href="/site/consultations" variant="dark">
            Смотреть форматы
          </MagneticLink>
        </div>
      </div>

      <div className="site-reveal site-delay-1 relative min-h-[620px]">
        <div className="site-hero-ring" />
        <div className="site-hero-device absolute right-0 top-4 w-full max-w-[640px] rounded-[3.5rem] border border-white/18 bg-[#111B15]/86 p-7 shadow-[0_50px_160px_rgba(0,0,0,0.48)] backdrop-blur-2xl">
          <div className="rounded-[2.5rem] border border-white/12 bg-[radial-gradient(circle_at_16%_0%,rgba(199,150,114,0.24),transparent_34%),linear-gradient(150deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-7">
            <p className="text-xs font-black uppercase tracking-[0.45em] text-[#C79672]">inside the room</p>
            <h2 className="mt-5 text-[clamp(2.2rem,4vw,4.7rem)] font-black leading-[0.92] tracking-[-0.06em]">
              меньше шума больше ясности
            </h2>
            <div className="mt-8 grid gap-4">
              {studioPrinciples.map(([title, text]) => (
                <div key={title} className="site-premium-card rounded-[1.7rem] border border-white/16 bg-black/14 p-5">
                  <p className="text-2xl font-black">{title}</p>
                  <p className="mt-2 font-semibold text-[#F8F0E4]/48">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="site-floating-card absolute bottom-0 left-0 max-w-[410px] rounded-[2.4rem] bg-[#B98266] p-7 text-[#160E0A] shadow-[0_32px_100px_rgba(0,0,0,0.34)]">
          <p className="text-xs font-black uppercase tracking-[0.34em] text-[#160E0A]/60">telegram вход</p>
          <h3 className="mt-3 text-3xl font-black leading-tight">профиль открывается без пароля</h3>
          <p className="mt-4 font-bold text-[#160E0A]/64">сайт, бот и mini app смотрят на одного клиента</p>
        </div>
      </div>
    </section>

    <section className="site-marquee border-y border-white/10 bg-white/[0.04] py-5 text-sm font-black uppercase tracking-[0.38em] text-[#F8F0E4]/52">
      <div className="site-marquee-track">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="flex gap-10">
            <span>консультации</span>
            <span>обучение</span>
            <span>кабинет через Telegram</span>
            <span>ручное подтверждение оплаты</span>
            <span>без публичности</span>
          </div>
        ))}
      </div>
    </section>

    <section className="mx-auto grid max-w-[1540px] gap-5 px-5 py-20 md:grid-cols-3 md:px-10 xl:px-16">
      {[
        ['Консультации', 'Выбрать формат, дату и перейти к записи', '/site/consultations'],
        ['Академия', 'Посмотреть обучение и оставить заявку', '/site/academy'],
        ['Кабинет', 'Войти через Telegram и увидеть свой профиль', '/site/profile'],
      ].map(([title, text, href], index) => (
        <SiteLink
          key={title}
          href={href}
          className={`site-reveal site-premium-card site-delay-${index + 1} group min-h-[320px] rounded-[2.8rem] border border-white/12 bg-white/[0.06] p-8 backdrop-blur-xl transition hover:-translate-y-2 hover:bg-white/[0.1]`}
        >
          <div className="flex h-full flex-col justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.38em] text-[#C79672]">space 0{index + 1}</p>
              <h3 className="mt-5 text-5xl font-black leading-[0.9] tracking-[-0.06em] text-[#F8F0E4]">{title}</h3>
              <p className="mt-6 text-lg font-semibold leading-relaxed text-[#F8F0E4]/56">{text}</p>
            </div>
            <div className="mt-10 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#F7EDE0] text-[#0D1510] transition group-hover:translate-x-2">
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
        eyebrow="consultation room"
        title="Формат под ситуацию"
        text="В списке нет давления и лишней мистики, только понятный вход в разговор и честный выбор темпа"
      />
      <div className="site-reveal site-delay-1 rounded-[3rem] border border-white/12 bg-[#F7EDE0] p-7 text-[#0D1510] shadow-[0_42px_120px_rgba(0,0,0,0.3)]">
        <p className="text-xs font-black uppercase tracking-[0.36em] text-[#B98266]">как проходит</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {['выбираете формат', 'оставляете заявку', 'получаете подтверждение'].map((step, index) => (
            <div key={step} className="rounded-[2rem] bg-[#0D1510]/6 p-5">
              <p className="text-5xl font-black text-[#B98266]">0{index + 1}</p>
              <p className="mt-5 text-xl font-black">{step}</p>
            </div>
          ))}
        </div>
      </div>
    </div>

    <div className="mt-14 grid gap-5 md:grid-cols-2">
      {consultationCards.map((card, index) => (
        <div key={card.title} className={`site-reveal site-premium-card site-delay-${index + 1} rounded-[2.8rem] border border-white/12 bg-white/[0.065] p-7 backdrop-blur-xl transition hover:-translate-y-2`}>
          <div className="mb-8 flex items-start justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.38em] text-[#C79672]">{card.tag}</p>
              <h3 className="mt-4 text-[clamp(2.2rem,4vw,4.4rem)] font-black leading-[0.9] tracking-[-0.06em]">{card.title}</h3>
            </div>
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#F7EDE0] text-[#0D1510]">
              <MoonStar className="h-5 w-5" />
            </div>
          </div>
          <p className="min-h-[110px] text-xl font-semibold leading-relaxed text-[#F8F0E4]/58">{card.text}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <MagneticLink href="/site/profile">Записаться</MagneticLink>
            <MagneticLink href={BOT_URL} variant="dark">Открыть bot</MagneticLink>
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
        eyebrow="tarot academy"
        title="Учиться без хаоса"
        text="База, расширенная программа и группы выглядят как нормальная учебная система, а не как набор обещаний"
      />
      <div className="site-reveal site-delay-1 rounded-[3rem] border border-[#C79672]/26 bg-[#B98266] p-7 text-[#160E0A] shadow-[0_42px_130px_rgba(0,0,0,0.32)]">
        <p className="text-xs font-black uppercase tracking-[0.36em] text-[#160E0A]/58">academy path</p>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {academySteps.map((step, index) => (
            <div key={step} className="rounded-[1.6rem] bg-[#160E0A]/9 p-4">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[#160E0A]/56">0{index + 1}</p>
              <p className="mt-2 text-xl font-black">{step}</p>
            </div>
          ))}
        </div>
      </div>
    </div>

    <div className="mt-14 grid gap-5 lg:grid-cols-3">
      {academyCards.map((card, index) => (
        <div key={card.title} className={`site-reveal site-premium-card site-delay-${index + 1} min-h-[430px] rounded-[2.8rem] border border-white/12 bg-white/[0.065] p-7 backdrop-blur-xl transition hover:-translate-y-2`}>
          <BookOpen className="h-8 w-8 text-[#C79672]" />
          <p className="mt-10 text-xs font-black uppercase tracking-[0.38em] text-[#C79672]">program 0{index + 1}</p>
          <h3 className="mt-4 text-4xl font-black leading-[0.95] tracking-[-0.05em]">{card.title}</h3>
          <p className="mt-5 text-5xl font-black text-[#B98266]">{card.price}</p>
          <p className="mt-7 text-lg font-semibold leading-relaxed text-[#F8F0E4]/58">{card.text}</p>
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
        eyebrow="telegram access"
        title={user ? 'Кабинет открыт' : 'Вход через Telegram'}
        text={user ? 'Сайт, bot и mini app используют один профиль, поэтому история не расползается' : 'Без паролей и длинных форм, Telegram подтверждает личность, а сайт открывает профиль'}
      />

      <div className="site-reveal site-delay-1 rounded-[3rem] border border-white/12 bg-white/[0.065] p-7 backdrop-blur-xl">
        {user ? (
          <div>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.36em] text-[#C79672]">client profile</p>
                <h2 className="mt-4 text-5xl font-black tracking-[-0.06em]">{user.name}</h2>
                <p className="mt-3 text-lg font-bold text-[#F8F0E4]/50">
                  @{user.username || 'telegram'} · ID {user.telegram_id}
                </p>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center justify-center rounded-full bg-[#F7EDE0] px-5 py-3 text-sm font-black text-[#0D1510]"
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
                <div key={label} className="rounded-[2rem] bg-black/16 p-5">
                  <p className="text-xs font-black uppercase tracking-[0.3em] text-[#C79672]">{label}</p>
                  <p className="mt-4 text-3xl font-black">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <MagneticLink href={BOT_URL}>Открыть mini app</MagneticLink>
              <MagneticLink href="/site/academy" variant="dark">Посмотреть академию</MagneticLink>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-xs font-black uppercase tracking-[0.36em] text-[#C79672]">secure login</p>
            <h2 className="mt-4 text-4xl font-black tracking-[-0.05em]">один вход для сайта и mini app</h2>
            <p className="mt-4 text-lg font-semibold leading-relaxed text-[#F8F0E4]/58">
              После входа сайт поймёт ваш Telegram ID и покажет личный кабинет без отдельной регистрации
            </p>
            <div className="mt-8 rounded-[2rem] bg-[#F7EDE0] p-5 text-[#0D1510]">
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
          eyebrow="payment"
          title="Оплата без лишней сцены"
          text="Рабочая ссылка живёт в админке, а подтверждение оплаты остаётся под ручным контролем"
        />
        <div className="site-reveal site-delay-1 rounded-[3rem] bg-[#F7EDE0] p-7 text-[#0D1510] shadow-[0_42px_130px_rgba(0,0,0,0.28)]">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[#0D1510] text-[#F7EDE0]">
              <CreditCard className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.36em] text-[#B98266]">активная ссылка</p>
              <h2 className="mt-2 text-4xl font-black tracking-[-0.05em]">{activeMethod?.title || 'Т-Банк'}</h2>
            </div>
          </div>
          <p className="mt-7 text-lg font-bold leading-relaxed text-[#0D1510]/58">
            {activeMethod?.instructions || 'После перевода нажмите “я оплатил” в приложении, чтобы админ проверил оплату вручную'}
          </p>
          <button
            type="button"
            onClick={() => activeMethod?.payment_url && openExternal(activeMethod.payment_url)}
            disabled={!activeMethod?.payment_url}
            className="site-magnetic mt-8 inline-flex w-full items-center justify-center rounded-full bg-[#0D1510] px-7 py-5 text-lg font-black text-[#F7EDE0] transition disabled:opacity-40"
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
          <SiteLink href="/site" className="site-reveal inline-flex items-center rounded-full border border-white/10 bg-white/[0.065] px-5 py-3 text-sm font-black text-[#F7EDE0] backdrop-blur-xl transition hover:bg-white/12">
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
