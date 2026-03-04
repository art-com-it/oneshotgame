import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import PaymentChat from '../components/PaymentChat'
import OfferModal from '../components/OfferModal'

export default function PaymentPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [payment, setPayment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showOffer, setShowOffer] = useState(false)

  useEffect(() => {
    loadPayment()
  }, [id])

  const loadPayment = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/payments/${id}`, {
        credentials: 'include'
      })
      const data = await response.json()

      if (!data.ok) {
        throw new Error(data.error || 'Платеж не найден')
      }

      setPayment(data.payment)
    } catch (err) {
      console.error('Load payment error:', err)
      setError(err.message || 'Ошибка загрузки платежа')
    } finally {
      setLoading(false)
    }
  }

  const formatAmount = (amount) => {
    return parseFloat(amount || 0).toFixed(2)
  }

  const getCurrencySymbol = (currency) => {
    const symbols = {
      'RUB': '₽',
      'USD': '$',
      'EUR': '€',
      'UAH': '₴'
    }
    return symbols[currency?.toUpperCase()] || currency || '₽'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-600">Загрузка...</p>
        </div>
      </div>
    )
  }

  if (error || !payment) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-lg shadow-md">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Ошибка</h2>
          <p className="text-gray-600 mb-6">{error || 'Платеж не найден'}</p>
          <button
            onClick={() => navigate('/')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            На главную
          </button>
        </div>
      </div>
    )
  }

  const statusColors = {
    pending: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    completed: 'text-green-600 bg-green-50 border-green-200',
    failed: 'text-red-600 bg-red-50 border-red-200',
    cancelled: 'text-gray-600 bg-gray-50 border-gray-200'
  }

  const statusTexts = {
    pending: 'Ожидает оплаты',
    completed: 'Оплачен',
    failed: 'Ошибка',
    cancelled: 'Отменен'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Заголовок */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-800">Оплата</h1>
            <span className={`px-4 py-2 rounded-full border text-sm font-semibold ${statusColors[payment.status] || statusColors.pending}`}>
              {statusTexts[payment.status] || 'Неизвестно'}
            </span>
          </div>
          
          <div className="border-t pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">ID платежа</p>
                <p className="font-mono text-sm font-semibold">{payment.id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">ID сделки</p>
                <p className="font-mono text-sm font-semibold">{payment.transactionId}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Сумма (с НДС)</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatAmount(payment.amount)} {getCurrencySymbol(payment.currency)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Сумма (без НДС)</p>
                <p className="text-lg font-semibold text-gray-700">
                  {formatAmount(payment.amountWithoutVAT)} {getCurrencySymbol(payment.currency)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">НДС ({((payment.vatRate || 0.20) * 100).toFixed(0)}%)</p>
                <p className="text-lg font-semibold text-gray-700">
                  {formatAmount(payment.vat)} {getCurrencySymbol(payment.currency)}
                </p>
              </div>
              {payment.description && (
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-500 mb-1">Описание</p>
                  <p className="text-gray-700">{payment.description}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Основной контент - Чат */}
        <div className="bg-white rounded-lg shadow-md mb-6" style={{ minHeight: '500px' }}>
          <PaymentChat paymentId={id} payment={payment} />
        </div>

        {/* Договор оферты - кнопки внизу */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg p-4 z-50">
          <div className="container mx-auto flex flex-col sm:flex-row gap-4 items-center justify-center">
            <button
              onClick={() => setShowOffer(true)}
              className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm font-medium"
            >
              Договор оферты
            </button>
            <button
              onClick={() => setShowOffer(true)}
              className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm font-medium"
            >
              Политика конфиденциальности
            </button>
          </div>
        </div>

        {/* Модальное окно с офертой */}
        {showOffer && (
          <OfferModal onClose={() => setShowOffer(false)} />
        )}
      </div>
    </div>
  )
}





