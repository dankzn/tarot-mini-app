import { useState } from 'react';
import { X, User, Shield, FileText, Heart, Scale, AlertTriangle } from 'lucide-react';

interface InfoMenuProps {
  onClose: () => void;
}

export const InfoMenu = ({ onClose }: InfoMenuProps) => {
  const [activeTab, setActiveTab] = useState<'about' | 'privacy' | 'terms'>('about');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col">
        {/* Шапка */}
        <div className="flex-none border-b border-gray-200 p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-[#385144]">Информация</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition p-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Вкладки */}
        <div className="flex-none border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('about')}
              className={`flex-1 py-3 px-2 text-xs font-bold transition ${
                activeTab === 'about' 
                  ? 'text-[#385144] border-b-2 border-[#385144]' 
                  : 'text-gray-500'
              }`}
            >
              <User className="w-4 h-4 inline mr-1" />
              Обо мне
            </button>
            <button
              onClick={() => setActiveTab('privacy')}
              className={`flex-1 py-3 px-2 text-xs font-bold transition ${
                activeTab === 'privacy' 
                  ? 'text-[#385144] border-b-2 border-[#385144]' 
                  : 'text-gray-500'
              }`}
            >
              <Shield className="w-4 h-4 inline mr-1" />
              Конфиденциальность
            </button>
            <button
              onClick={() => setActiveTab('terms')}
              className={`flex-1 py-3 px-2 text-xs font-bold transition ${
                activeTab === 'terms' 
                  ? 'text-[#385144] border-b-2 border-[#385144]' 
                  : 'text-gray-500'
              }`}
            >
              <FileText className="w-4 h-4 inline mr-1" />
              Условия
            </button>
          </div>
        </div>

        {/* Контент */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'about' && (
            <div className="space-y-4">
              <div className="bg-[#F8F5F2] p-4 rounded-xl">
                <h3 className="text-[#385144] font-bold text-lg mb-3 flex items-center">
                  <Heart className="w-5 h-5 mr-2" />
                  Обо мне
                </h3>
                <p className="text-gray-700 leading-relaxed mb-3">
                  Приветствую! Меня зовут Даниил, и я профессиональный таролог. 
                  Моя миссия — помочь вам найти ответы на важные жизненные вопросы, 
                  разобраться в себе и своей ситуации.
                </p>
                <p className="text-gray-700 leading-relaxed mb-3">
                  Я подхожу к каждой консультации индивидуально, с вниманием и пониманием 
                  к вашей ситуации. Моя цель — не просто дать предсказание, а помочь 
                  вам найти свой путь и обрести гармонию.
                </p>
                <p className="text-gray-700 leading-relaxed">
                  Я отношусь к каждому клиенту с уважением и заботой. Всё, чем вы 
                  делитесь со мной, остаётся между нами.
                </p>
              </div>

              <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-xl">
                <p className="text-blue-800 text-sm">
                  💫 <strong>Важно:</strong> Таро — это инструмент для самопознания 
                  и получения guidance, а не окончательный приговор. Вы всегда 
                  свободны в выборе своего пути.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-4">
              <div className="bg-[#F8F5F2] p-4 rounded-xl">
                <h3 className="text-[#385144] font-bold text-lg mb-3 flex items-center">
                  <Shield className="w-5 h-5 mr-2" />
                  Конфиденциальность и защита данных
                </h3>
                
                <div className="space-y-3 text-gray-700 text-sm leading-relaxed">
                  <p>
                    <strong>1. Конфиденциальность</strong><br/>
                    Вся информация, полученная в ходе консультаций, строго конфиденциальна. 
                    Я гарантирую полную сохранность ваших персональных данных и информации, 
                    которой вы делитесь во время консультаций.
                  </p>

                  <p>
                    <strong>2. Юридическая ответственность</strong><br/>
                    Как оператор персональных данных, я несу полную ответственность за 
                    нераспространение и защиту вашей информации в соответствии с:
                  </p>

                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Федеральным законом РФ № 152-ФЗ «О персональных данных»</li>
                    <li>Уголовным кодексом РФ (ст. 137, 272, 273, 274)</li>
                    <li>Кодексом об административных правонарушениях РФ</li>
                    <li>Гаагской конвенцией по вопросам международного частного права</li>
                    <li>Уголовным законодательством Королевства Испания</li>
                    <li>Общим регламентом по защите данных (GDPR) ЕС</li>
                  </ul>

                  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded-r-xl mt-3">
                    <p className="text-yellow-800 text-xs">
                      <strong>⚠️ Нарушение конфиденциальности влечёт:</strong><br/>
                      • Уголовную ответственность (штрафы до 300 000 ₽ или лишение свободы до 4 лет)<br/>
                      • Административную ответственность (штрафы до 75 000 ₽)<br/>
                      • Гражданско-правовую ответственность (возмещение морального вреда)
                    </p>
                  </div>

                  <p>
                    <strong>3. Хранение данных</strong><br/>
                    Ваши данные хранятся на защищённых серверах с применением современных 
                    методов шифрования. Доступ к данным имею только я.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'terms' && (
            <div className="space-y-4">
              <div className="bg-[#F8F5F2] p-4 rounded-xl">
                <h3 className="text-[#385144] font-bold text-lg mb-3 flex items-center">
                  <Scale className="w-5 h-5 mr-2" />
                  Условия оказания услуг
                </h3>
                
                <div className="space-y-3 text-gray-700 text-sm leading-relaxed">
                  <div className="bg-white p-3 rounded-lg">
                    <p className="font-bold text-[#385144] mb-1">1. Оплата услуг</p>
                    <p>
                      Оплата консультаций производится заранее. Средства, внесённые в качестве 
                      оплаты, <strong>не подлежат возврату</strong> после подтверждения записи.
                    </p>
                  </div>

                  <div className="bg-white p-3 rounded-lg">
                    <p className="font-bold text-[#385144] mb-1">2. Природа таро-консультаций</p>
                    <p>
                      Таро — это инструмент для самопознания и получения guidance. Карты Таро 
                      <strong> не дают 100% вероятности</strong> именно такого развития событий. 
                      Будущее многовариантно и зависит от ваших действий и решений.
                    </p>
                  </div>

                  <div className="bg-white p-3 rounded-lg">
                    <p className="font-bold text-[#385144] mb-1">3. Отмена и перенос</p>
                    <p>
                      Перенос или отмена консультации возможны не позднее чем за 24 часа 
                      до назначенного времени. При отмене менее чем за 24 часа оплата не возвращается.
                    </p>
                  </div>

                  <div className="bg-white p-3 rounded-lg">
                    <p className="font-bold text-[#385144] mb-1">4. Ответственность</p>
                    <p>
                      Я не несу ответственности за ваши решения и действия, предпринятые 
                      на основе консультации. Вы самостоятельно принимаете решения и несёте 
                      за них ответственность.
                    </p>
                  </div>

                  <div className="bg-red-50 border-l-4 border-red-400 p-3 rounded-r-xl mt-3">
                    <p className="text-red-800 text-xs flex items-start">
                      <AlertTriangle className="w-4 h-4 mr-1 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>Важно:</strong> Таро не заменяет профессиональную медицинскую, 
                        юридическую или психологическую помощь. В серьёзных вопросах здоровья, 
                        права и психологии обращайтесь к профильным специалистам.
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};