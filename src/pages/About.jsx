import React from 'react'

export default function About() {
  return (
    <div className="min-h-screen bg-[#0D1A2F] text-white py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
            О нас
          </h1>
          <p className="text-white/70 text-lg">
            Ведущая платформа для торговли игровыми скинами в России
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 mb-16">
          <div>
            <h2 className="text-3xl font-bold mb-6">Game Sale</h2>
            <p className="text-white/80 leading-relaxed mb-6">
              Мы создали Game Sale в 2023 году с одной целью — сделать торговлю игровыми скинами 
              максимально простой, безопасной и выгодной для всех игроков. За короткое время мы стали 
              одной из ведущих платформ в России и СНГ.
            </p>
            <p className="text-white/80 leading-relaxed mb-6">
              Наша команда состоит из опытных разработчиков, геймеров и специалистов по кибербезопасности, 
              которые понимают потребности игрового сообщества и работают над созданием лучшего сервиса.
            </p>
            <div className="grid grid-cols-2 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-400 mb-2">50,000+</div>
                <div className="text-white/70">Довольных клиентов</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-400 mb-2">1M+</div>
                <div className="text-white/70">Успешных сделок</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white/5 border border-white/10 rounded-lg p-8">
            <h3 className="text-xl font-bold mb-6">Наши преимущества</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                  ✓
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Безопасность</h4>
                  <p className="text-white/70 text-sm">
                    Все сделки проходят через официальный Steam API с полной защитой данных
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                  ⚡
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Скорость</h4>
                  <p className="text-white/70 text-sm">
                    Мгновенная доставка скинов и быстрые выплаты продавцам
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                  💰
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Выгодные цены</h4>
                  <p className="text-white/70 text-sm">
                    Конкурентные цены и низкая комиссия для продавцов
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-yellow-600 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                  🎯
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Поддержка 24/7</h4>
                  <p className="text-white/70 text-sm">
                    Круглосуточная техническая поддержка на русском языке
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-12">Наша команда</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white/5 border border-white/10 rounded-lg p-6 text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl">
                👨‍💻
              </div>
              <h3 className="text-xl font-bold mb-2">Алексей Иванов</h3>
              <p className="text-blue-400 mb-3">CEO & Основатель</p>
              <p className="text-white/70 text-sm">
                10+ лет в IT, бывший разработчик в Mail.ru Group. Создал платформу с нуля.
              </p>
            </div>
            
            <div className="bg-white/5 border border-white/10 rounded-lg p-6 text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-green-600 to-blue-600 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl">
                👩‍💼
              </div>
              <h3 className="text-xl font-bold mb-2">Мария Петрова</h3>
              <p className="text-green-400 mb-3">Head of Security</p>
              <p className="text-white/70 text-sm">
                Эксперт по кибербезопасности, обеспечивает защиту всех операций на платформе.
              </p>
            </div>
            
            <div className="bg-white/5 border border-white/10 rounded-lg p-6 text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl">
                👨‍🎮
              </div>
              <h3 className="text-xl font-bold mb-2">Дмитрий Козлов</h3>
              <p className="text-purple-400 mb-3">Head of Community</p>
              <p className="text-white/70 text-sm">
                Pro-игрок CS:GO, знает все о скинах и потребностях игрового сообщества.
              </p>
            </div>
          </div>
        </div>

        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-12">Поддерживаемые игры</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white/5 border border-white/10 rounded-lg p-6 text-center">
              <div className="text-4xl mb-4">🔫</div>
              <h3 className="font-bold mb-2">Counter-Strike 2</h3>
              <p className="text-white/70 text-sm">Самый популярный раздел с тысячами скинов</p>
            </div>
            
            <div className="bg-white/5 border border-white/10 rounded-lg p-6 text-center">
              <div className="text-4xl mb-4">⚔️</div>
              <h3 className="font-bold mb-2">Dota 2</h3>
              <p className="text-white/70 text-sm">Редкие сеты и иммортальные предметы</p>
            </div>
            
            <div className="bg-white/5 border border-white/10 rounded-lg p-6 text-center">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="font-bold mb-2">Team Fortress 2</h3>
              <p className="text-white/70 text-sm">Классические шляпы и необычные эффекты</p>
            </div>
            
            <div className="bg-white/5 border border-white/10 rounded-lg p-6 text-center">
              <div className="text-4xl mb-4">🏗️</div>
              <h3 className="font-bold mb-2">Rust</h3>
              <p className="text-white/70 text-sm">Скины для оружия и одежды</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-lg p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Присоединяйтесь к нам</h2>
          <p className="text-white/70 mb-6 max-w-2xl mx-auto">
            Станьте частью крупнейшего игрового сообщества в России. Покупайте, продавайте 
            и обменивайтесь скинами безопасно и выгодно.
          </p>
          <div className="flex justify-center gap-4">
            <button className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold transition-colors">
              Начать торговлю
            </button>
            <button className="border border-white/20 hover:bg-white/10 px-6 py-3 rounded-lg font-semibold transition-colors">
              Связаться с нами
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
