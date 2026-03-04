import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PaymentWidget from './PaymentWidget'

export default function SteamTopUp() {
  const navigate = useNavigate()
  const [selectedAmount, setSelectedAmount] = useState(null)
  const [customAmount, setCustomAmount] = useState('')
  const [steamId, setSteamId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Предустановленные суммы для пополнения
  const presetAmounts = [
    { label: '100 ₽', value: 100 },
    { label: '250 ₽', value: 250 },
    { label: '500 ₽', value: 500 },
    { label: '1000 ₽', value: 1000 },
    { label: '2000 ₽', value: 2000 },
    { label: '5000 ₽', value: 5000 }
  ]

  const handleAmountSelect = (amount) => {
    setSelectedAmount(amount)
    setCustomAmount('')
    setError(null)
  }

  const handleCustomAmountChange = (e) => {
    const value = e.target.value
    if (value === '' || (/^\d+$/.test(value) && parseFloat(value) >= 100 && parseFloat(value) <= 50000)) {
      setCustomAmount(value)
      setSelectedAmount(null)
      setError(null)
    }
  }

  const handleSteamIdChange = (e) => {
    setSteamId(e.target.value.trim())
    setError(null)
  }

  const getFinalAmount = () => {
    if (customAmount) {
      return parseFloat(customAmount)
    }
    return selectedAmount
  }

  const handlePaymentCreated = (payment) => {
    console.log('Steam top-up payment created:', payment)
    // После создания платежа переходим на страницу оплаты
    navigate(`/pay/${payment.id}`)
  }

  const validateForm = () => {
    const amount = getFinalAmount()
    if (!amount || amount < 100) {
      setError('Минимальная сумма пополнения: 100 ₽')
      return false
    }
    if (amount > 50000) {
      setError('Максимальная сумма пополнения: 50,000 ₽')
      return false
    }
    if (!steamId) {
      setError('Пожалуйста, укажите ваш Steam ID или профиль')
      return false
    }
    return true
  }

  // Проверка на ошибки
  React.useEffect(() => {
    console.log('[SteamTopUp] Component mounted')
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1b2838] via-[#16202d] to-[#1b2838] py-12 px-4" style={{ minHeight: '100vh' }}>
      <div className="max-w-4xl mx-auto">
        {/* Заголовок */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-[#66c0f4] to-[#417a9b] rounded-full mb-4 shadow-lg">
            <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.9 1.58h1.9c0-.93-.49-1.93-1.48-2.36-.57-.22-1.2-.35-1.9-.35-2.65 0-3.96 1.47-3.96 3.15 0 1.49 1.02 2.35 2.48 2.85 1.77.51 2.34 1.07 2.34 1.9 0 .73-.55 1.51-2.1 1.51-1.6 0-2.23-.72-2.23-1.64H6.04c0 .95.62 2.2 3.05 2.67.57.13 1.22.2 1.9.2 2.7 0 4.1-1.44 4.1-3.34 0-1.64-.94-2.5-2.58-3.01z"/>
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Пополнение Steam кошелька</h1>
          <p className="text-gray-300 text-lg">
            Пополните ваш Steam кошелек быстро и безопасно
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Левая колонка - Выбор суммы */}
          <div className="bg-[#1e2329] rounded-lg shadow-xl p-6 border border-[#66c0f4]/20">
            <h2 className="text-2xl font-semibold text-[#66c0f4] mb-6">Выберите сумму</h2>
            
            {/* Предустановленные суммы */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {presetAmounts.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => handleAmountSelect(preset.value)}
                  className={`px-4 py-3 rounded-lg font-semibold transition-all duration-200 ${
                    selectedAmount === preset.value
                      ? 'bg-gradient-to-r from-[#66c0f4] to-[#417a9b] text-white shadow-lg scale-105'
                      : 'bg-[#2a475e] text-[#c7d5e0] hover:bg-[#3a5a7a] hover:text-white'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Пользовательская сумма */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-[#8f98a0] mb-2">
                Или укажите свою сумму (от 100 ₽ до 50,000 ₽)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={customAmount}
                  onChange={handleCustomAmountChange}
                  placeholder="Введите сумму"
                  min="100"
                  max="50000"
                  className="w-full px-4 py-3 bg-[#2a475e] border border-[#66c0f4]/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#66c0f4] focus:border-transparent"
                />
                <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-[#8f98a0]">
                  ₽
                </span>
              </div>
            </div>

            {/* Steam ID */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-[#8f98a0] mb-2">
                Ваш Steam ID или ссылка на профиль <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={steamId}
                onChange={handleSteamIdChange}
                placeholder="STEAM_0:1:12345678 или https://steamcommunity.com/profiles/..."
                className="w-full px-4 py-3 bg-[#2a475e] border border-[#66c0f4]/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#66c0f4] focus:border-transparent"
                required
              />
              <p className="mt-2 text-xs text-[#8f98a0]">
                Укажите ваш Steam ID или ссылку на профиль Steam для пополнения кошелька
              </p>
            </div>

            {/* Информация о пополнении */}
            <div className="bg-[#2a475e]/50 rounded-lg p-4 border border-[#66c0f4]/20">
              <h3 className="text-sm font-semibold text-[#66c0f4] mb-2">ℹ️ Информация</h3>
              <ul className="text-xs text-[#c7d5e0] space-y-1">
                <li>• Минимальная сумма: 100 ₽</li>
                <li>• Максимальная сумма: 50,000 ₽</li>
                <li>• Пополнение происходит в течение 24 часов</li>
                <li>• Средства зачисляются на ваш Steam кошелек</li>
                <li>• Комиссия включена в стоимость</li>
              </ul>
            </div>
          </div>

          {/* Правая колонка - Виджет оплаты */}
          <div className="bg-[#1e2329] rounded-lg shadow-xl p-6 border border-[#66c0f4]/20">
            <h2 className="text-2xl font-semibold text-[#66c0f4] mb-6">Оплата</h2>
            
            {error && (
              <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
                {error}
              </div>
            )}

            {getFinalAmount() && steamId ? (
              <PaymentWidget
                amount={getFinalAmount()}
                currency="RUB"
                description={`Пополнение Steam кошелька на ${getFinalAmount()} ₽`}
                onPaymentCreated={handlePaymentCreated}
                additionalData={{ steamId: steamId }}
              />
            ) : (
              <div className="text-center py-12">
                <div className="text-[#8f98a0] mb-4">
                  <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-lg">Выберите сумму и укажите Steam ID</p>
                  <p className="text-sm mt-2">Форма оплаты появится после заполнения всех полей</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Дополнительная информация */}
        <div className="mt-8 bg-[#1e2329] rounded-lg shadow-xl p-6 border border-[#66c0f4]/20">
          <h3 className="text-xl font-semibold text-[#66c0f4] mb-4">Как это работает?</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-[#66c0f4]/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl font-bold text-[#66c0f4]">1</span>
              </div>
              <h4 className="font-semibold text-white mb-2">Выберите сумму</h4>
              <p className="text-sm text-[#8f98a0]">
                Укажите желаемую сумму пополнения и ваш Steam ID
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-[#66c0f4]/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl font-bold text-[#66c0f4]">2</span>
              </div>
              <h4 className="font-semibold text-white mb-2">Оплатите</h4>
              <p className="text-sm text-[#8f98a0]">
                Совершите безопасный платеж через защищенную систему
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-[#66c0f4]/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl font-bold text-[#66c0f4]">3</span>
              </div>
              <h4 className="font-semibold text-white mb-2">Получите средства</h4>
              <p className="text-sm text-[#8f98a0]">
                Средства будут зачислены на ваш Steam кошелек в течение 24 часов
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

