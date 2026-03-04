import React, { useState } from 'react'

export default function Support() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    category: 'general',
    subject: '',
    message: ''
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState(null) // 'success' | 'error' | null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitStatus(null)

    try {
      const response = await fetch('/api/support', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const result = await response.json()

      if (response.ok && result.ok) {
        setSubmitStatus('success')
        setFormData({
          name: '',
          email: '',
          category: 'general',
          subject: '',
          message: ''
        })
        // Очистить статус через 5 секунд
        setTimeout(() => setSubmitStatus(null), 5000)
      } else {
        setSubmitStatus('error')
      }
    } catch (error) {
      console.error('Ошибка отправки формы:', error)
      setSubmitStatus('error')
    } finally {
      setIsSubmitting(false)
    }
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
            Служба поддержки
          </h1>
          <p className="text-white/70 text-lg">
            Мы работаем 24/7 и готовы помочь вам с любыми вопросами
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Контактная информация */}
          <div>
            <h2 className="text-2xl font-bold mb-6">Способы связи</h2>
            
            <div className="space-y-6">
              <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                <div className="flex items-center mb-3">
                  <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center mr-4">
                    💬
                  </div>
                  <div>
                    <h3 className="font-semibold">Онлайн-чат</h3>
                    <p className="text-white/70 text-sm">Самый быстрый способ</p>
                  </div>
                </div>
                <p className="text-white/80 mb-3">
                  Среднее время ответа: 2-5 минут
                </p>
                <button className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
                  Начать чат
                </button>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                <div className="flex items-center mb-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center mr-4">
                    📧
                  </div>
                  <div>
                    <h3 className="font-semibold">Email</h3>
                    <p className="text-white/70 text-sm">support@aigamestore.com</p>
                  </div>
                </div>
                <p className="text-white/80">
                  Среднее время ответа: 1 час
                </p>
              </div>


            </div>

            <div className="mt-8 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-3">Статистика поддержки</h3>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-green-400">98.7%</div>
                  <div className="text-white/70 text-sm">Довольных клиентов</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-400">2.3 мин</div>
                  <div className="text-white/70 text-sm">Среднее время ответа</div>
                </div>
              </div>
            </div>
          </div>

          {/* Форма обращения */}
          <div>
            <h2 className="text-2xl font-bold mb-6">Написать в поддержку</h2>
            
            {submitStatus === 'success' && (
              <div className="mb-6 bg-green-600/20 border border-green-500/50 rounded-lg p-4">
                <p className="text-green-200 font-semibold">✅ Обращение успешно отправлено!</p>
                <p className="text-green-200/80 text-sm">Мы ответим на ваш email в течение 1 часа.</p>
              </div>
            )}

            {submitStatus === 'error' && (
              <div className="mb-6 bg-red-600/20 border border-red-500/50 rounded-lg p-4">
                <p className="text-red-200 font-semibold">❌ Ошибка при отправке</p>
                <p className="text-red-200/80 text-sm">Пожалуйста, попробуйте еще раз или свяжитесь с нами другим способом.</p>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Ваше имя</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/50 focus:border-blue-500 focus:outline-none"
                    placeholder="Введите ваше имя"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/50 focus:border-blue-500 focus:outline-none"
                    placeholder="your@email.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Категория обращения</label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="general">Общие вопросы</option>
                  <option value="payment">Проблемы с оплатой</option>
                  <option value="delivery">Доставка скинов</option>
                  <option value="account">Проблемы с аккаунтом</option>
                  <option value="technical">Технические проблемы</option>
                  <option value="refund">Возврат средств</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Тема обращения</label>
                <input
                  type="text"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/50 focus:border-blue-500 focus:outline-none"
                  placeholder="Кратко опишите проблему"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Подробное описание</label>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  rows={6}
                  className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/50 focus:border-blue-500 focus:outline-none resize-none"
                  placeholder="Опишите вашу проблему подробно. Укажите номер заказа, если он есть."
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed py-3 rounded-lg font-semibold transition-colors"
              >
                {isSubmitting ? 'Отправка...' : 'Отправить обращение'}
              </button>
            </form>

            <div className="mt-6 text-center text-white/60 text-sm">
              Мы ответим на ваше обращение в течение 1 часа
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}