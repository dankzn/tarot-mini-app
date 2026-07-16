import { useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

const BOT_URL = 'https://t.me/danil_tarot_bot';

interface InactivityConsentModalProps {
  user: {
    id?: string | null;
    telegram_id?: number | string | null;
    name?: string | null;
  };
  onComplete: (updatedUser: any) => void;
}

export const InactivityConsentModal = ({ user, onComplete }: InactivityConsentModalProps) => {
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!accepted || loading) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/site/inactivity-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          accepted: true,
          user_id: user.id,
          telegram_id: user.telegram_id,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Не удалось сохранить подтверждение');
      }

      onComplete(payload.user || {});
    } catch (submitError: any) {
      setError(submitError?.message || 'Не удалось сохранить подтверждение');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[1.75rem] border border-[#B8795C]/25 bg-[#F8F5F2] p-5 text-[#385144] shadow-2xl">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#B8795C]/12 text-[#9C6A52]">
          <AlertTriangle className="h-6 w-6" />
        </div>

        <p className="mb-2 text-xs font-black uppercase tracking-[0.28em] text-[#B8795C]">важная информация</p>
        <h2 className="text-2xl font-black leading-tight">Срок активности аккаунта</h2>
        <p className="mt-3 text-sm font-semibold leading-relaxed text-[#385144]/72">
          При бездействии аккаунта в течение 365 дней аккаунт и связанные с ним данные удаляются безвозвратно.
          Срок отсчитывается с момента последней активности на сайте или в Telegram-мини-приложении.
        </p>
        <a
          href={BOT_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-[#385144]/10 bg-white/72 px-4 py-3 text-sm font-black text-[#385144] underline decoration-[#B8795C]/60 underline-offset-4"
        >
          Открыть Telegram-бота @{BOT_URL.replace('https://t.me/', '')}
        </a>

        <label className="mt-5 flex items-start gap-3 rounded-2xl border border-[#385144]/10 bg-white/72 p-4 text-sm font-bold leading-relaxed">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
            className="mt-1 h-5 w-5 accent-[#385144]"
          />
          <span>Я ознакомлен(а) и согласен(на) с условием безвозвратного удаления аккаунта после 365 дней бездействия.</span>
        </label>

        {error && (
          <div className="mt-4 rounded-2xl border border-[#B8795C]/25 bg-[#B8795C]/10 px-4 py-3 text-sm font-bold text-[#8A5B45]">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={!accepted || loading}
          className="mt-5 flex w-full items-center justify-center rounded-2xl bg-[#385144] px-5 py-4 text-base font-black text-white transition disabled:cursor-not-allowed disabled:opacity-45"
        >
          <CheckCircle2 className="mr-2 h-5 w-5" />
          {loading ? 'Сохраняю' : 'Подтвердить'}
        </button>
      </div>
    </div>
  );
};
