import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { 
  Send, 
  Users, 
  Calendar,
  Eye,
  Clock,
  MessageSquare,
  Trash2
} from 'lucide-react';
import { AdminBackButton } from '../components/admin/AdminBackButton';
import { ensureAdminSession } from '../lib/adminAuth';

const EMOJI_PRESETS = ['✨', '🔮', '🕯️', '🪄', '🌙', '💫', '❤️', '🫶', '🔥', '🎁', '⏳', '✅'];

const escapeHtml = (value: string) => (
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
);

const isSafePreviewUrl = (value: string) => {
  try {
    const url = new URL(value);
    return ['http:', 'https:', 'tg:'].includes(url.protocol);
  } catch {
    return false;
  }
};

const renderTelegramPreview = (value: string) => (
  escapeHtml(value)
    .replace(/&lt;(\/?)(b|strong)&gt;/g, '<$1b>')
    .replace(/&lt;(\/?)(i|em)&gt;/g, '<$1i>')
    .replace(/&lt;(\/?)(u|ins)&gt;/g, '<$1u>')
    .replace(/&lt;(\/?)(s|strike|del)&gt;/g, '<$1s>')
    .replace(/&lt;(\/?)(code)&gt;/g, '<$1code>')
    .replace(/&lt;(\/?)(pre)&gt;/g, '<$1pre>')
    .replace(/&lt;blockquote&gt;/g, '<blockquote>')
    .replace(/&lt;\/blockquote&gt;/g, '</blockquote>')
    .replace(/&lt;a href=&quot;([^"]+)&quot;&gt;([\s\S]*?)&lt;\/a&gt;/g, (_, url, label) => (
      isSafePreviewUrl(url)
        ? `<a href="${url}" class="font-bold text-[#385144] underline" target="_blank" rel="noreferrer">${label}</a>`
        : `<span class="font-bold text-[#385144] underline">${label}</span>`
    ))
    .replace(/&lt;tg-spoiler&gt;/g, '<span class="rounded bg-[#385144]/10 px-1 text-[#385144]">')
    .replace(/&lt;\/tg-spoiler&gt;/g, '</span>')
    .replace(/\n/g, '<br />')
);

export const AdminWebMailings = () => {
  const navigate = useNavigate();
  const messageRef = useRef<HTMLTextAreaElement | null>(null);
  const [mailings, setMailings] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [sending, setSending] = useState(false);
  
  // Форма рассылки
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [recipientFilter, setRecipientFilter] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [previewMode, setPreviewMode] = useState(false);

  const insertIntoMessage = (before: string, after = '', placeholder = 'текст') => {
    const textarea = messageRef.current;

    if (!textarea) {
      setMessage(prev => `${prev}${before}${placeholder}${after}`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = message.slice(start, end) || placeholder;
    const nextMessage = `${message.slice(0, start)}${before}${selectedText}${after}${message.slice(end)}`;
    const nextCursor = start + before.length + selectedText.length + after.length;

    setMessage(nextMessage);

    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const insertLink = () => {
    const url = window.prompt('Ссылка для Telegram-кнопки в тексте:', 'https://');
    if (!url) return;

    insertIntoMessage(`<a href="${url}">`, '</a>', 'текст ссылки');
  };

  const insertEmoji = (emoji: string) => {
    insertIntoMessage(emoji, '', '');
  };

  useEffect(() => {
    checkAuth();
    loadData();
  }, []);

  const checkAuth = async () => {
    const { ok } = await ensureAdminSession();
    if (!ok) {
      navigate('/admin-web');
    }
  };

  const loadData = async () => {
    try {
      const { data: mailingsData } = await supabase
        .from('mailings')
        .select('*')
        .order('created_at', { ascending: false });

      const { data: usersData } = await supabase
        .from('users')
        .select('id, name, username, telegram_id, status, created_at')
        .order('created_at', { ascending: false });

      setMailings(mailingsData || []);
      setUsers(usersData || []);
    } catch (error) {
      console.error('Ошибка загрузки:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRecipients = () => {
    let recipients = users;

    if (recipientFilter === 'status' && selectedStatus) {
      recipients = recipients.filter(u => u.status === selectedStatus);
    } else if (recipientFilter === 'new') {
      // Последние 7 дней
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      recipients = recipients.filter(u => new Date(u.created_at) >= weekAgo);
    } else if (recipientFilter === 'active') {
      // С активными консультациями
      recipients = recipients.filter(u => u.status !== 'Первое знакомство');
    }

    // Фильтруем только тех у кого есть telegram_id
    return recipients.filter(u => u.telegram_id);
  };

  const handleSend = async () => {
    if (!title || !message) {
      alert('Заполните заголовок и текст сообщения');
      return;
    }

    const recipients = getRecipients();
    if (recipients.length === 0) {
      alert('Нет получателей для выбранного фильтра');
      return;
    }

    if (!confirm(`Отправить рассылку ${recipients.length} получателям?`)) {
      return;
    }

    setSending(true);

    try {
      const { sendBulkNotification } = await import('../lib/notifications');
      
      const telegramIds = recipients.map(u => u.telegram_id.toString());
      const results = await sendBulkNotification(telegramIds, message);

      // Сохраняем в историю
      const { data: { session } } = await supabase.auth.getSession();
      await supabase
        .from('mailings')
        .insert([
          {
            title,
            message,
            recipients_count: recipients.length,
            status: results.failed === 0 ? 'sent' : 'partial',
            created_by: session?.user?.id,
          },
        ]);

      alert(
        `✅ Рассылка завершена!\n\n` +
        `Отправлено: ${results.success}\n` +
        `Ошибок: ${results.failed}\n` +
        `Всего: ${recipients.length}`
      );

      // Сброс формы
      setTitle('');
      setMessage('');
      setShowCreateForm(false);
      await loadData();
    } catch (error: any) {
      alert('Ошибка: ' + error.message);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (mailingId: string) => {
    if (!confirm('Удалить запись о рассылке?')) return;

    try {
      await supabase
        .from('mailings')
        .delete()
        .eq('id', mailingId);
      await loadData();
    } catch (error: any) {
      alert('Ошибка: ' + error.message);
    }
  };

  const recipients = getRecipients();

  if (showCreateForm) {
    return (
      <div className="min-h-screen bg-[#F8F5F2]">
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <AdminBackButton onClick={() => setShowCreateForm(false)} />
            <h1 className="text-2xl font-bold text-[#385144]">Новая рассылка</h1>
            <div></div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="space-y-6">
            {/* Заголовок */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <label className="text-[#385144] font-bold text-sm mb-2 block">
                Заголовок рассылки
              </label>
              <input
                type="text"
                className="w-full p-3 bg-[#F8F5F2] border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-[#385144]"
                placeholder="Например: Новогодняя акция"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Получатели */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <label className="text-[#385144] font-bold text-sm mb-3 block flex items-center">
                <Users className="w-4 h-4 mr-2" />
                Получатели
              </label>

              <div className="space-y-3">
                <select
                  className="w-full p-3 bg-[#F8F5F2] border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-[#385144]"
                  value={recipientFilter}
                  onChange={(e) => setRecipientFilter(e.target.value)}
                >
                  <option value="all">Все клиенты ({users.filter(u => u.telegram_id).length})</option>
                  <option value="status">По статусу</option>
                  <option value="new">Новые (за 7 дней)</option>
                  <option value="active">Активные клиенты</option>
                </select>

                {recipientFilter === 'status' && (
                  <select
                    className="w-full p-3 bg-[#F8F5F2] border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-[#385144]"
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                  >
                    <option value="">Выберите статус</option>
                    <option value="Первое знакомство">Первое знакомство</option>
                    <option value="Basic">Basic</option>
                    <option value="Silver">Silver</option>
                    <option value="Gold">Gold</option>
                    <option value="Platinum">Platinum</option>
                    <option value="Личное ведение">Личное ведение</option>
                  </select>
                )}

                <div className="bg-[#F8F5F2] p-4 rounded-xl border border-[#385144]/20">
                  <p className="text-[#385144] font-bold text-sm mb-1">Будет отправлено:</p>
                  <p className="text-2xl font-bold text-[#385144]">{recipients.length} клиентов</p>
                </div>
              </div>
            </div>

            {/* Текст сообщения */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <label className="text-[#385144] font-bold text-sm mb-2 block flex items-center">
                <MessageSquare className="w-4 h-4 mr-2" />
                Текст сообщения
              </label>
              <p className="text-gray-500 text-xs mb-2">
                Поддерживается Telegram HTML: жирный, курсив, подчёркивание, зачёркивание, код, цитаты, спойлеры и ссылки.
              </p>
              <div className="mb-3 rounded-2xl border border-[#385144]/10 bg-[#F8F5F2] p-3">
                <div className="mb-3 flex flex-wrap gap-2">
                  {[
                    { label: 'Жирный', before: '<b>', after: '</b>', sample: 'важно' },
                    { label: 'Курсив', before: '<i>', after: '</i>', sample: 'мягко' },
                    { label: 'Подчеркнуть', before: '<u>', after: '</u>', sample: 'акцент' },
                    { label: 'Зачеркнуть', before: '<s>', after: '</s>', sample: 'неактуально' },
                    { label: 'Код', before: '<code>', after: '</code>', sample: 'код' },
                    { label: 'Цитата', before: '<blockquote>', after: '</blockquote>', sample: 'цитата' },
                    { label: 'Спойлер', before: '<tg-spoiler>', after: '</tg-spoiler>', sample: 'секрет' },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => insertIntoMessage(item.before, item.after, item.sample)}
                      className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-[#385144] shadow-sm transition hover:bg-[#EAF1EA]"
                    >
                      {item.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={insertLink}
                    className="rounded-full bg-[#385144] px-3 py-1.5 text-xs font-black text-white shadow-sm transition hover:bg-[#2d4238]"
                  >
                    Ссылка
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_PRESETS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => insertEmoji(emoji)}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg shadow-sm transition hover:-translate-y-0.5"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                ref={messageRef}
                rows={10}
                className="w-full p-3 bg-[#F8F5F2] border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-[#385144] font-mono text-sm"
                placeholder={'Например:\\n<b>Новая акция</b> ✨\\nЗапись открыта до конца недели.'}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            {/* Предпросмотр */}
            {message && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <button
                  onClick={() => setPreviewMode(!previewMode)}
                  className="flex items-center text-[#385144] font-bold mb-3 hover:text-[#6B4EE6]"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  {previewMode ? 'Скрыть предпросмотр' : 'Показать предпросмотр'}
                </button>
                
                {previewMode && (
                  <div className="bg-[#F8F5F2] p-4 rounded-xl border border-[#385144]/20">
                    <p className="text-gray-500 text-xs mb-2">Так будет выглядеть сообщение:</p>
                    <div
                      className="bg-white p-4 rounded-lg shadow-sm text-gray-700 [&_blockquote]:border-l-4 [&_blockquote]:border-[#385144]/30 [&_blockquote]:pl-3 [&_blockquote]:italic [&_code]:rounded [&_code]:bg-[#F8F5F2] [&_code]:px-1 [&_pre]:rounded-xl [&_pre]:bg-[#F8F5F2] [&_pre]:p-3"
                      dangerouslySetInnerHTML={{ __html: renderTelegramPreview(message) }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Кнопки */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowCreateForm(false)}
                className="flex-1 bg-gray-200 text-gray-700 p-4 rounded-xl font-bold hover:bg-gray-300 transition"
              >
                Отмена
              </button>
              <button
                onClick={handleSend}
                disabled={sending || !title || !message || recipients.length === 0}
                className="flex-1 bg-[#385144] text-white p-4 rounded-xl font-bold hover:bg-[#2d4238] transition disabled:opacity-50 flex items-center justify-center"
              >
                {sending ? (
                  <>
                    <Clock className="w-5 h-5 mr-2 animate-spin" />
                    Отправка...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5 mr-2" />
                    Отправить рассылку
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F5F2]">
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <AdminBackButton onClick={() => navigate('/admin-web/dashboard')} label="В dashboard" />
          <h1 className="text-2xl font-bold text-[#385144]">Рассылка акций</h1>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-[#385144] text-white px-4 py-2 rounded-xl font-bold hover:bg-[#2d4238] transition flex items-center"
          >
            <Send className="w-5 h-5 mr-2" />
            Новая рассылка
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-10 bg-white rounded-2xl shadow-sm border border-gray-100">
            <p className="text-gray-500">Загрузка...</p>
          </div>
        ) : mailings.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-2xl shadow-sm border border-gray-100">
            <Send className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">Рассылок ещё не было</p>
            <p className="text-gray-400 text-sm mt-1">Нажмите "Новая рассылка" чтобы создать первую</p>
          </div>
        ) : (
          <div className="space-y-4">
            {mailings.map((mailing) => (
              <div key={mailing.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-[#385144] font-bold text-lg">{mailing.title}</h3>
                    <p className="text-gray-500 text-sm flex items-center mt-1">
                      <Calendar className="w-4 h-4 mr-1" />
                      {format(new Date(mailing.created_at), 'dd MMMM yyyy HH:mm', { locale: ru })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      mailing.status === 'sent' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {mailing.status === 'sent' ? 'Отправлено' : 'Частично'}
                    </span>
                    <button
                      onClick={() => handleDelete(mailing.id)}
                      className="text-gray-400 hover:text-red-500 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="bg-[#F8F5F2] p-4 rounded-xl mb-4">
                  <p className="text-gray-700 text-sm whitespace-pre-wrap">{mailing.message}</p>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    Получателей: <strong>{mailing.recipients_count}</strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
