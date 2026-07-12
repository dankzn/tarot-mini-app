import { useState } from 'react';
import { Lock, Mail, Save, UserRound } from 'lucide-react';

interface SiteCredentialsModalProps {
  user: any;
  onComplete: (updatedUser: any) => void;
}

export const SiteCredentialsModal = ({ user, onComplete }: SiteCredentialsModalProps) => {
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [passwordRepeat, setPasswordRepeat] = useState('');
  const [loading, setLoading] = useState(false);

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

    setLoading(true);
    try {
      const response = await fetch('/api/site/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegram_id: user.telegram_id,
          email,
          password,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Не удалось сохранить данные');
      }

      onComplete(payload.user);
    } catch (error: any) {
      alert(error.message || 'Не удалось сохранить данные для входа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-[#15241D]/55 p-4 backdrop-blur-xl sm:items-center">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-[2rem] border border-white/70 bg-[#F8F3EC] p-6 shadow-[0_26px_90px_rgba(21,36,29,0.32)]"
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

        <button
          type="submit"
          disabled={loading}
          className="mt-5 flex w-full items-center justify-center rounded-2xl bg-[#385144] p-4 text-lg font-black text-white transition disabled:opacity-60"
        >
          <Save className="mr-2 h-5 w-5" />
          {loading ? 'Сохраняю' : 'Сохранить вход'}
        </button>
      </form>
    </div>
  );
};
