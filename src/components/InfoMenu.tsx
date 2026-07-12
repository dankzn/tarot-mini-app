import { useState } from 'react';
import { AlertTriangle, ChevronRight, Heart, LockKeyhole, Scale, ShieldCheck, Sparkles, X } from 'lucide-react';
import { offerTerms, personalDataPolicy } from '../lib/legalContent';

interface InfoMenuProps {
  onClose: () => void;
}

type InfoSection = 'about' | 'privacy' | 'terms';

const tabs: Array<{ id: InfoSection; title: string; subtitle: string }> = [
  { id: 'about', title: 'Обо мне', subtitle: 'подход и ценности' },
  { id: 'privacy', title: 'Данные', subtitle: 'как храним' },
  { id: 'terms', title: 'Оферта', subtitle: 'условия работы' },
];

export const InfoMenu = ({ onClose }: InfoMenuProps) => {
  const [activeSection, setActiveSection] = useState<InfoSection>('about');

  return (
    <div className="fixed inset-0 z-[60]">
      <button
        aria-label="Закрыть информацию"
        className="absolute inset-0 bg-[#111]/45 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      <div className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[92vh] max-w-xl flex-col overflow-hidden rounded-t-[2rem] bg-[#F8F3EC] shadow-[0_-20px_60px_rgba(17,17,17,0.24)] animate-slide-up">
        <div className="relative overflow-hidden bg-[#385144] px-5 pb-4 pt-4 text-white">
          <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-[0.22em] text-white/55">
                information space
              </p>
              <h2 className="text-2xl font-black">Информация</h2>
            </div>
            <button
              onClick={onClose}
              className="rounded-2xl bg-white/10 p-3 text-white/75 transition hover:bg-white/15 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-none border-b border-[#E8DED2] bg-white/70 px-4 py-3">
          <div className="grid grid-cols-3 gap-2">
            {tabs.map((tab) => {
              const isActive = activeSection === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSection(tab.id)}
                  className={`rounded-2xl px-3 py-3 text-left transition ${
                    isActive
                      ? 'bg-[#385144] text-white shadow-[0_10px_24px_rgba(56,81,68,0.18)]'
                      : 'bg-white text-[#6C756C]'
                  }`}
                >
                  <span className="block text-sm font-black leading-tight">{tab.title}</span>
                  <span className={`mt-0.5 block text-[10px] font-bold uppercase tracking-[0.12em] ${
                    isActive ? 'text-white/55' : 'text-[#8FA092]'
                  }`}>
                    {tab.subtitle}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5">
          {activeSection === 'about' && (
            <div className="space-y-3">
              <div className="rounded-[1.6rem] border border-white/80 bg-white/85 p-5 shadow-[0_14px_34px_rgba(56,81,68,0.08)]">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EAF1EA] text-[#385144]">
                    <Heart className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-[#385144]">Данил, таролог</h3>
                    <p className="text-sm font-semibold text-[#8A5A3F]">3+ года практики</p>
                  </div>
                </div>
                <p className="text-[15px] leading-relaxed text-[#4B5563]">
                  Я помогаю бережно разобраться в ситуации, увидеть возможные сценарии и найти точку опоры.
                  Консультация — это не приговор, а честный разговор с вниманием к вашему состоянию.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Без осуждения', 'Можно говорить прямо и быть собой.'],
                  ['Индивидуально', 'Формат подстраивается под ваш запрос.'],
                  ['Конфиденциально', 'Личное остаётся между нами.'],
                  ['С опорой', 'Фокус на ясности, а не на страхе.'],
                ].map(([title, text]) => (
                  <div key={title} className="rounded-[1.35rem] bg-white/80 p-4 shadow-sm">
                    <Sparkles className="mb-3 h-4 w-4 text-[#B8795C]" />
                    <p className="font-black text-[#385144]">{title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-[#6C756C]">{text}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-[1.5rem] border border-[#B8795C]/20 bg-[#FFF1E8] p-4">
                <p className="text-sm leading-relaxed text-[#6B4D3E]">
                  В консультациях нет места дискриминации по гендерному, расовому, половому признаку,
                  сексуальной ориентации и другим личным особенностям.
                </p>
              </div>
            </div>
          )}

          {activeSection === 'privacy' && (
            <div className="space-y-3">
              <div className="rounded-[1.6rem] border border-white/80 bg-white/85 p-5 shadow-[0_14px_34px_rgba(56,81,68,0.08)]">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EAF1EA] text-[#385144]">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-[#385144]">{personalDataPolicy.title}</h3>
                    <p className="text-sm font-semibold text-[#8A5A3F]">{personalDataPolicy.subtitle}</p>
                  </div>
                </div>
                <p className="text-[15px] leading-relaxed text-[#4B5563]">
                  {personalDataPolicy.intro}
                </p>
              </div>

              {personalDataPolicy.sections.map((section) => (
                <div key={section.title} className="flex items-start gap-3 rounded-[1.35rem] bg-white/80 p-4 shadow-sm">
                  <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-[#385144]" />
                  <div>
                    <p className="font-black text-[#385144]">{section.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-[#6C756C]">{section.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeSection === 'terms' && (
            <div className="space-y-3">
              <div className="rounded-[1.6rem] border border-white/80 bg-white/85 p-5 shadow-[0_14px_34px_rgba(56,81,68,0.08)]">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EAF1EA] text-[#385144]">
                    <Scale className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-[#385144]">{offerTerms.title}</h3>
                    <p className="text-sm font-semibold text-[#8A5A3F]">{offerTerms.subtitle}</p>
                  </div>
                </div>
                <p className="text-[15px] leading-relaxed text-[#4B5563]">{offerTerms.intro}</p>
              </div>

              {offerTerms.sections.map((section, index) => (
                <div key={section.title} className="rounded-[1.45rem] border border-white/80 bg-white/85 p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#EAF1EA] text-sm font-black text-[#385144]">
                        0{index + 1}
                      </div>
                      <p className="font-black text-[#385144]">{section.title}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-[#8FA092]" />
                  </div>
                  <p className="text-sm leading-relaxed text-[#6C756C]">{section.text}</p>
                </div>
              ))}

              <div className="rounded-[1.5rem] border border-[#B8795C]/25 bg-[#FFF1E8] p-4">
                <p className="flex items-start text-sm leading-relaxed text-[#6B4D3E]">
                  <AlertTriangle className="mr-2 mt-0.5 h-4 w-4 shrink-0" />
                  Таро не заменяет медицинскую, юридическую, финансовую или психологическую помощь
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-[#385144]/15 bg-[#EAF1EA] p-4">
                <p className="flex items-start text-sm leading-relaxed text-[#385144]">
                  <Scale className="mr-2 mt-0.5 h-4 w-4 shrink-0" />
                  Регистрация и запись означают согласие с условиями оферты и обработкой персональных данных
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
