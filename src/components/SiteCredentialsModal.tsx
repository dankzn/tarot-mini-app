import { useState } from 'react';
import { Lock, Mail, Save, ShieldCheck, UserRound, X } from 'lucide-react';
import { offerTerms, personalDataPolicy, type LegalDocument } from '../lib/legalContent';

interface SiteCredentialsModalProps {
  user: any;
  onComplete: (updatedUser: any) => void;
}

export const SiteCredentialsModal = ({ user, onComplete }: SiteCredentialsModalProps) => {
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [passwordRepeat, setPasswordRepeat] = useState('');
  const [loading, setLoading] = useState(false);
  const [personalDataAccepted, setPersonalDataAccepted] = useState(false);
  const [offerAccepted, setOfferAccepted] = useState(false);
  const [legalDocument, setLegalDocument] = useState<LegalDocument | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (password.length < 8) {
      alert('Пароль должен быть от 8 символов');
      return;
    }

    if (password !== passwordRepeat) {
      alert('Пароли не совпадают');
      return;
    }

    if (!personalDataAccepted || !offerAccepted) {
      alert('Нужно принять условия регистрации');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    try {
      const response = await fetch('/api/site/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          telegram_id: user.telegram_id,
          email,
          password,
          personalDataAccepted,
          offerAccepted,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Не удалось сохранить данные');
      }

      onComplete(payload.user);
    } catch (error: any) {
      setErrorMessage(error.message || 'Не удалось сохранить данные для входа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-[#15241D]/55 px-4 py-5 backdrop-blur-xl">
      <form
        onSubmit={submit}
        className="mx-auto flex min-h-0 w-full max-w-md flex-col rounded-[2rem] border border-white/70 bg-[#F8F3EC] p-5 shadow-[0_26px_90px_rgba(21,36,29,0.32)] sm:p-6"
      >
        <p className="mb-3 text-xs font-black uppercase tracking-[0.32em] text-[#B8795C]">Вход на сайт</p>
        <h2 className="mb-3 text-3xl font-black leading-tight text-[#385144]">Добавьте почту и пароль</h2>
        <p className="mb-6 text-base font-bold leading-relaxed text-[#66746B]">
          Эти данные нужны для входа в личный кабинет на сайте
        </p>

        <div className="mb-4 rounded-2xl border border-[#385144]/10 bg-white/70 p-4">
          <label className="mb-2 flex items-center text-sm font-black text-[#385144]">
            <UserRound className="mr-2 h-4 w-4" />
            Telegram
          </label>
          <input
            value={user?.username ? `@${user.username}` : String(user?.telegram_id || '')}
            readOnly
            className="w-full rounded-xl border border-[#385144]/10 bg-[#EDE7DE] p-3 font-black text-[#66746B] outline-none"
          />
        </div>

        <div className="mb-4 rounded-2xl border border-[#385144]/10 bg-white/70 p-4">
          <label className="mb-2 flex items-center text-sm font-black text-[#385144]">
            <Mail className="mr-2 h-4 w-4" />
            Почта
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-xl border border-[#385144]/10 bg-[#F8F3EC] p-3 font-bold text-[#385144] outline-none focus:border-[#385144]"
            placeholder="mail@example.com"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#385144]/10 bg-white/70 p-4">
            <label className="mb-2 flex items-center text-sm font-black text-[#385144]">
              <Lock className="mr-2 h-4 w-4" />
              Пароль
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-[#385144]/10 bg-[#F8F3EC] p-3 font-bold text-[#385144] outline-none focus:border-[#385144]"
              placeholder="от 8 символов"
            />
          </div>
          <div className="rounded-2xl border border-[#385144]/10 bg-white/70 p-4">
            <label className="mb-2 flex items-center text-sm font-black text-[#385144]">
              <Lock className="mr-2 h-4 w-4" />
              Повтор
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={passwordRepeat}
              onChange={(event) => setPasswordRepeat(event.target.value)}
              className="w-full rounded-xl border border-[#385144]/10 bg-[#F8F3EC] p-3 font-bold text-[#385144] outline-none focus:border-[#385144]"
              placeholder="ещё раз"
            />
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-[#385144]/10 bg-white/70 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-black text-[#385144]">
            <ShieldCheck className="h-4 w-4" />
            <span>Согласия</span>
          </div>
          <div className="space-y-3">
            <label className="flex items-start gap-3 text-sm font-bold leading-relaxed text-[#385144]">
              <input
                type="checkbox"
                required
                checked={personalDataAccepted}
                onChange={(event) => setPersonalDataAccepted(event.target.checked)}
                className="mt-1 h-5 w-5 accent-[#385144]"
              />
              <span>
                Согласен на{' '}
                <button
                  type="button"
                  onClick={() => setLegalDocument(personalDataPolicy)}
                  className="underline decoration-[#B8795C] underline-offset-4"
                >
                  обработку персональных данных
                </button>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm font-bold leading-relaxed text-[#385144]">
              <input
                type="checkbox"
                required
                checked={offerAccepted}
                onChange={(event) => setOfferAccepted(event.target.checked)}
                className="mt-1 h-5 w-5 accent-[#385144]"
              />
              <span>
                Принимаю{' '}
                <button
                  type="button"
                  onClick={() => setLegalDocument(offerTerms)}
                  className="underline decoration-[#B8795C] underline-offset-4"
                >
                  условия договора-оферты
                </button>
              </span>
            </label>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-4 rounded-2xl border border-[#B8795C]/25 bg-[#FFF1E8] px-4 py-3 text-sm font-black leading-relaxed text-[#8A5A3F]">
            {errorMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-5 flex w-full items-center justify-center rounded-2xl bg-[#385144] p-4 text-lg font-black text-white transition disabled:opacity-60"
        >
          <Save className="mr-2 h-5 w-5" />
          {loading ? 'Сохраняю' : 'Сохранить вход'}
        </button>
      </form>

      {legalDocument && (
        <div className="absolute inset-0 z-[10000] flex items-end justify-center bg-[#15241D]/55 p-4 backdrop-blur-xl sm:items-center">
          <div className="max-h-[82vh] w-full max-w-md overflow-hidden rounded-[2rem] bg-[#F8F3EC] shadow-[0_24px_80px_rgba(21,36,29,0.28)]">
            <div className="flex items-start justify-between gap-4 bg-[#385144] p-5 text-white">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-white/55">
                  {legalDocument.subtitle}
                </p>
                <h2 className="mt-2 text-2xl font-black">{legalDocument.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setLegalDocument(null)}
                className="rounded-2xl bg-white/10 p-3"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-5">
              <p className="text-sm font-semibold leading-relaxed text-[#66746B]">{legalDocument.intro}</p>
              <div className="mt-5 space-y-3">
                {legalDocument.sections.map((section) => (
                  <div key={section.title} className="rounded-2xl bg-white/80 p-4">
                    <p className="font-black text-[#385144]">{section.title}</p>
                    <p className="mt-2 text-sm font-semibold leading-relaxed text-[#66746B]">{section.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
