import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import PaymentWidget from '../components/PaymentWidget'

export default function DeeplinkPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [deeplink, setDeeplink] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [paymentCreated, setPaymentCreated] = useState(false)

  useEffect(() => {
    fetchDeeplink()
  }, [id])

  const fetchDeeplink = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/deeplink/${id}`)
      const data = await response.json()
      
      if (data.ok) {
        setDeeplink(data.deeplink)
      } else {
        if (data.error === 'expired') {
          setError('Ссылка истекла')
        } else if (data.error === 'already_used') {
          setError('Эта ссылка уже была использована')
        } else if (data.error === 'inactive') {
          setError('Ссылка неактивна')
        } else {
          setError('Ссылка не найдена')
        }
      }
    } catch (error) {
      console.error('Error fetching deeplink:', error)
      setError('Ошибка при загрузке ссылки')
    } finally {
      setLoading(false)
    }
  }

  const handlePaymentCreated = async (payment) => {
    try {
      // Create payment via deeplink endpoint
      const response = await fetch(`/api/deeplink/${id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: payment.userEmail || payment.email,
          name: payment.userName || payment.name
        })
      })
      
      const data = await response.json()
      if (data.ok) {
        setPaymentCreated(true)
        // Redirect to payment page if payment ID is available
        if (data.payment?.id) {
          setTimeout(() => {
            window.location.href = `/pay/${data.payment.id}`
          }, 1000)
        } else if (payment.paymentUrl) {
          window.location.href = payment.paymentUrl
        }
      } else {
        alert('Ошибка при создании платежа: ' + (data.error || 'Неизвестная ошибка'))
      }
    } catch (error) {
      console.error('Error processing payment:', error)
      alert('Ошибка при обработке платежа')
    }
  }

  const formatPrice = (value, currency = 'RUB') => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0
    }).format(value || 0)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0C0C0C] flex items-center justify-center pt-20">
        <div className="text-center">
          <svg className="animate-spin h-12 w-12 text-cyan-400 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-white/80">Загрузка...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0C0C0C] flex items-center justify-center pt-20">
        <div className="bg-[#1a1a1a] border border-[#333333] rounded-lg p-8 max-w-md w-full text-center">
          <div className="text-red-400 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-white mb-4">Ошибка</h1>
          <p className="text-white/80 mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors"
          >
            Вернуться на главную
          </button>
        </div>
      </div>
    )
  }

  if (paymentCreated) {
    return (
      <div className="min-h-screen bg-[#0C0C0C] flex items-center justify-center pt-20">
        <div className="bg-[#1a1a1a] border border-[#333333] rounded-lg p-8 max-w-md w-full text-center">
          <div className="text-green-400 text-6xl mb-4">✓</div>
          <h1 className="text-2xl font-bold text-white mb-4">Платеж создан</h1>
          <p className="text-white/80 mb-6">Вы будете перенаправлены на страницу оплаты...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0C0C0C] pt-20 pb-16">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-[#1a1a1a] border border-[#333333] rounded-lg p-8 mb-6">
            <h1 className="text-3xl font-bold text-white mb-4">Оплата по ссылке</h1>
            {deeplink?.description && (
              <p className="text-white/80 mb-6">{deeplink.description}</p>
            )}
            <div className="bg-[#0C0C0C] border border-[#333333] rounded-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-white/60">Сумма к оплате:</span>
                <span className="text-3xl font-bold text-cyan-400">
                  {formatPrice(deeplink?.amount, deeplink?.currency)}
                </span>
              </div>
            </div>

            <PaymentWidget
              amount={deeplink?.amount || 0}
              currency={deeplink?.currency || 'RUB'}
              description={deeplink?.description || `Оплата по диплинку`}
              onPaymentCreated={handlePaymentCreated}
              disableRedirect={true}
              additionalData={{ deeplinkId: id }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

