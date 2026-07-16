import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Eye, EyeOff, MessageSquareText, Save, Star, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ensureAdminSession } from '../lib/adminAuth';
import { AdminBackButton } from '../components/admin/AdminBackButton';

type Review = {
  id: string;
  user_id?: string | null;
  author_name: string;
  author_username?: string | null;
  rating: number;
  text: string;
  source: 'client' | 'admin';
  is_published: boolean;
  reviewed_at: string;
  created_at: string;
};

const today = () => new Date().toISOString().slice(0, 10);

export const AdminWebReviews = () => {
  const navigate = useNavigate();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    author_name: '',
    author_username: '',
    rating: 5,
    text: '',
    reviewed_at: today(),
    is_published: true,
  });

  const stats = useMemo(
    () => ({
      total: reviews.length,
      published: reviews.filter((review) => review.is_published).length,
      client: reviews.filter((review) => review.source === 'client').length,
      average:
        reviews.length === 0
          ? '0.0'
          : (reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length).toFixed(1),
    }),
    [reviews],
  );

  const loadReviews = async () => {
    setLoading(true);
    try {
      const { ok } = await ensureAdminSession();
      if (!ok) {
        navigate('/admin-web');
        return;
      }

      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .order('reviewed_at', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReviews((data || []) as Review[]);
    } catch (error) {
      console.error('Не удалось загрузить отзывы:', error);
      setReviews([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, []);

  const createReview = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.author_name.trim() || !draft.text.trim()) {
      alert('Заполните имя и текст отзыва');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('reviews').insert({
        author_name: draft.author_name.trim(),
        author_username: draft.author_username.trim().replace(/^@+/, '') || null,
        rating: draft.rating,
        text: draft.text.trim(),
        source: 'admin',
        is_published: draft.is_published,
        reviewed_at: draft.reviewed_at || today(),
      });

      if (error) throw error;
      setDraft({
        author_name: '',
        author_username: '',
        rating: 5,
        text: '',
        reviewed_at: today(),
        is_published: true,
      });
      await loadReviews();
    } catch (error: any) {
      alert(error?.message || 'Не удалось сохранить отзыв');
    } finally {
      setSaving(false);
    }
  };

  const togglePublished = async (review: Review) => {
    const { error } = await supabase
      .from('reviews')
      .update({
        is_published: !review.is_published,
        updated_at: new Date().toISOString(),
      })
      .eq('id', review.id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadReviews();
  };

  const deleteReview = async (review: Review) => {
    if (!confirm(`Удалить отзыв от ${review.author_name}?`)) return;

    const { error } = await supabase.from('reviews').delete().eq('id', review.id);
    if (error) {
      alert(error.message);
      return;
    }

    await loadReviews();
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#E7EFE7_0,#F8F3EC_42%,#EFE6DA_100%)] text-[#2F463B]">
      <div className="border-b border-white/70 bg-white/75 shadow-[0_12px_35px_rgba(56,81,68,0.08)] backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <AdminBackButton onClick={() => navigate('/admin-web/dashboard')} label="В dashboard" />
          <div className="text-right">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#B8795C]/80">social proof</p>
            <h1 className="text-3xl font-black text-[#385144]">Отзывы</h1>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[0.95fr_1.4fr]">
        <section className="rounded-[1.9rem] border border-white/80 bg-white/86 p-6 shadow-[0_18px_44px_rgba(56,81,68,0.10)]">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#B8795C]/80">new review</p>
              <h2 className="text-2xl font-black text-[#385144]">Добавить отзыв</h2>
            </div>
            <MessageSquareText className="h-6 w-6 text-[#B8795C]" />
          </div>

          <form onSubmit={createReview} className="grid gap-4">
            <label className="block">
              <span className="mb-2 block text-sm font-black text-[#385144]">Имя автора</span>
              <input
                required
                value={draft.author_name}
                onChange={(event) => setDraft({ ...draft, author_name: event.target.value })}
                className="w-full rounded-2xl border border-[#385144]/10 bg-[#F8F5F2] px-4 py-3 font-bold outline-none focus:border-[#385144]"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-black text-[#385144]">Telegram или подпись</span>
              <input
                value={draft.author_username}
                onChange={(event) => setDraft({ ...draft, author_username: event.target.value })}
                className="w-full rounded-2xl border border-[#385144]/10 bg-[#F8F5F2] px-4 py-3 font-bold outline-none focus:border-[#385144]"
                placeholder="@username"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-2 block text-sm font-black text-[#385144]">Дата отзыва</span>
                <input
                  type="date"
                  value={draft.reviewed_at}
                  onChange={(event) => setDraft({ ...draft, reviewed_at: event.target.value })}
                  className="w-full rounded-2xl border border-[#385144]/10 bg-[#F8F5F2] px-4 py-3 font-bold outline-none focus:border-[#385144]"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-black text-[#385144]">Оценка</span>
                <select
                  value={draft.rating}
                  onChange={(event) => setDraft({ ...draft, rating: Number(event.target.value) })}
                  className="w-full rounded-2xl border border-[#385144]/10 bg-[#F8F5F2] px-4 py-3 font-bold outline-none focus:border-[#385144]"
                >
                  {[5, 4, 3, 2, 1].map((rating) => (
                    <option key={rating} value={rating}>{rating}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-black text-[#385144]">Текст</span>
              <textarea
                required
                rows={6}
                value={draft.text}
                onChange={(event) => setDraft({ ...draft, text: event.target.value })}
                className="w-full resize-none rounded-2xl border border-[#385144]/10 bg-[#F8F5F2] px-4 py-3 font-bold leading-relaxed outline-none focus:border-[#385144]"
              />
            </label>

            <label className="flex items-center gap-3 rounded-2xl bg-[#F8F5F2] px-4 py-3 text-sm font-black">
              <input
                type="checkbox"
                checked={draft.is_published}
                onChange={(event) => setDraft({ ...draft, is_published: event.target.checked })}
                className="h-5 w-5 accent-[#385144]"
              />
              Опубликовать на сайте
            </label>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-full items-center justify-center rounded-2xl bg-[#385144] px-5 py-4 font-black text-white disabled:opacity-50"
            >
              <Save className="mr-2 h-5 w-5" />
              {saving ? 'Сохраняю' : 'Сохранить отзыв'}
            </button>
          </form>
        </section>

        <section className="rounded-[1.9rem] border border-white/80 bg-white/86 p-6 shadow-[0_18px_44px_rgba(56,81,68,0.10)]">
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ['Всего', stats.total],
              ['На сайте', stats.published],
              ['От клиентов', stats.client],
              ['Средняя', stats.average],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[1.3rem] bg-[#F8F5F2] p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#B8795C]/75">{label}</p>
                <p className="mt-2 text-2xl font-black text-[#385144]">{value}</p>
              </div>
            ))}
          </div>

          {loading ? (
            <div className="rounded-[1.5rem] bg-[#F8F5F2] p-6 text-center font-black text-[#385144]/60">Загрузка...</div>
          ) : reviews.length === 0 ? (
            <div className="rounded-[1.5rem] bg-[#F8F5F2] p-6 text-center font-black text-[#385144]/60">Отзывы пока не добавлены</div>
          ) : (
            <div className="grid gap-3">
              {reviews.map((review) => (
                <article key={review.id} className="rounded-[1.5rem] bg-[#F8F5F2] p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-black text-[#385144]">{review.author_name}</h3>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-[#8A5A3F]">
                          {review.source === 'admin' ? 'вручную' : 'клиент'}
                        </span>
                        {!review.is_published && (
                          <span className="rounded-full bg-[#E9DDD2] px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-[#8A5A3F]">
                            скрыт
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm font-bold text-[#6C756C]">
                        {review.author_username ? `@${review.author_username} · ` : ''}
                        {format(new Date(review.reviewed_at), 'd MMMM yyyy', { locale: ru })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-[#B8795C]">
                      {Array.from({ length: review.rating }).map((_, index) => (
                        <Star key={index} className="h-4 w-4 fill-current" />
                      ))}
                    </div>
                  </div>

                  <p className="mt-4 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-[#385144]/78">{review.text}</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => togglePublished(review)}
                      className="inline-flex items-center rounded-full bg-white px-4 py-2 text-xs font-black text-[#385144]"
                    >
                      {review.is_published ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                      {review.is_published ? 'Скрыть' : 'Опубликовать'}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteReview(review)}
                      className="inline-flex items-center rounded-full bg-white px-4 py-2 text-xs font-black text-red-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Удалить
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
