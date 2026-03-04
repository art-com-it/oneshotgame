import React, { useState } from 'react'
import PaymentWidget from '../components/PaymentWidget'

export default function TestPayment() {
  const [amount, setAmount] = useState(1000)

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">Тестовая страница оплаты</h1>
            <p className="text-gray-600 mb-4">
              На этой странице можно протестировать форму оплаты с Яндекс Капчей.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Сумма платежа (руб.)
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="1"
              />
            </div>
          </div>

          <PaymentWidget 
            amount={amount} 
            currency="RUB" 
            description="Тестовый платеж"
            onPaymentCreated={(payment) => {
              console.log('Payment created:', payment)
              alert(`Платеж создан! ID: ${payment.id}`)
            }}
          />
        </div>
      </div>
    </div>
  )
}




