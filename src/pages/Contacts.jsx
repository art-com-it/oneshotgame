import React, { useState } from 'react'
import { getCompanyInfo } from '../utils/companyInfo'

export default function Contacts() {
  const company = getCompanyInfo()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  })
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    // Здесь будет логика отправки формы
    setIsSubmitted(true)
    setTimeout(() => setIsSubmitted(false), 3000)
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  return (
    <div className="min-h-screen bg-[#0D1A2F] text-white py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
            Контакты
          </h1>
          <p className="text-white/70 text-lg">
            Свяжитесь с нами любым удобным способом
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Контактная информация */}
          <div>
            <h2 className="text-2xl font-bold mb-8">Как с нами связаться</h2>
            
            <div className="space-y-6">
              {/* Онлайн чат */}
              <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">💬</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Онлайн чат</h3>
                    <p className="text-white/70 text-sm">Самый быстрый способ получить помощь</p>
                  </div>
                </div>
                <p className="text-white/80 mb-4">
                  Наши операторы онлайн 24/7 и готовы помочь с любыми вопросами по торговле скинами.
                </p>
                <button className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg font-semibold transition-colors">
                  Открыть чат
                </button>
              </div>

              {/* Email */}
              <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">📧</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Email поддержка</h3>
                    <p className="text-white/70 text-sm">Для детальных вопросов</p>
                  </div>
                </div>
                <div className="space-y-2 text-white/80">
                  <p><strong>Общие вопросы:</strong> {company.email}</p>
                  <p><strong>Поддержка:</strong> {company.email}</p>
                  <p><strong>Телефон:</strong> {company.phone}</p>
                  <p className="text-white/60 text-sm">Среднее время ответа — 1 час</p>
                </div>
              </div>

              {/* Социальные сети */}
              <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">🌐</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Социальные сети</h3>
                    <p className="text-white/70 text-sm">Следите за новостями</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 bg-[#FF0000]/15 border border-[#FF0000]/30 px-4 py-3 rounded-lg text-white/70">
                    <span className="text-xl">📺</span>
                    <div>
                      <div className="font-semibold text-white">YouTube</div>
                      <div className="text-xs text-white/60">Канал запустим скоро</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Рабочие часы */}
              <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-yellow-600 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">🕒</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Время работы</h3>
                    <p className="text-white/70 text-sm">Когда мы доступны</p>
                  </div>
                </div>
                <div className="space-y-2 text-white/80">
                  <p><strong>Онлайн чат:</strong> 24/7</p>
                  <p><strong>Email поддержка:</strong> Среднее время ответа — 1 час</p>
                  <p><strong>Телефон:</strong> Пн-Пт 9:00-21:00 (МСК)</p>
                  <p><strong>Выходные:</strong> Сб-Вс 10:00-18:00 (МСК)</p>
                </div>
              </div>
            </div>
          </div>

          {/* Форма обратной связи */}
          <div>
            <h2 className="text-2xl font-bold mb-8">Напишите нам</h2>
            
            {isSubmitted && (
              <div className="bg-green-600/20 border border-green-500/50 rounded-lg p-4 mb-6">
                <p className="text-green-200 font-semibold">✅ Сообщение отправлено!</p>
                <p className="text-green-200/80 text-sm">Мы ответим вам в ближайшее время.</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold mb-2">Имя *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/50 focus:border-blue-500 focus:outline-none"
                    placeholder="Ваше имя"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Email *</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/50 focus:border-blue-500 focus:outline-none"
                    placeholder="your@email.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Тема обращения *</label>
                <select
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Выберите тему</option>
                  <option value="support">Техническая поддержка</option>
                  <option value="trading">Вопросы по торговле</option>
                  <option value="account">Проблемы с аккаунтом</option>
                  <option value="payment">Вопросы по оплате</option>
                  <option value="partnership">Партнерство</option>
                  <option value="other">Другое</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Сообщение *</label>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  rows={6}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/50 focus:border-blue-500 focus:outline-none resize-none"
                  placeholder="Опишите ваш вопрос подробно..."
                />
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 px-6 py-4 rounded-lg font-semibold transition-colors"
              >
                Отправить сообщение
              </button>
            </form>

            {/* FAQ быстрые ссылки */}
            <div className="mt-12">
              <h3 className="text-lg font-semibold mb-4">Часто задаваемые вопросы</h3>
              <div className="space-y-3">
                <a href="/faq" className="block bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-colors">
                  <h4 className="font-semibold text-blue-200">Безопасность сделок</h4>
                  <p className="text-white/70 text-sm">Как мы защищаем ваши сделки</p>
                </a>
                <a href="/faq" className="block bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-colors">
                  <h4 className="font-semibold text-blue-200">Комиссии и выплаты</h4>
                  <p className="text-white/70 text-sm">Информация о комиссиях</p>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Статистика поддержки */}
        <div className="mt-16 grid md:grid-cols-4 gap-6">
          <div className="bg-white/5 border border-white/10 rounded-lg p-6 text-center">
            <div className="text-3xl font-bold text-blue-400 mb-2">24/7</div>
            <div className="text-white/70">Поддержка</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-6 text-center">
            <div className="text-3xl font-bold text-green-400 mb-2">&lt;2 мин</div>
            <div className="text-white/70">Ответ в чате</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-6 text-center">
            <div className="text-3xl font-bold text-yellow-400 mb-2">98%</div>
            <div className="text-white/70">Довольных клиентов</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-6 text-center">
            <div className="text-3xl font-bold text-purple-400 mb-2">50k+</div>
            <div className="text-white/70">Решенных вопросов</div>
          </div>
        </div>
      </div>
    </div>
  )
}