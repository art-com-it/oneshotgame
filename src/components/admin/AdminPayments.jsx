import React, { useState, useEffect } from 'react'

export default function AdminPayments() {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    fetchPayments()
  }, [statusFilter, startDate, endDate, page])

  const fetchPayments = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50'
      })
      if (statusFilter) params.append('status', statusFilter)
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const response = await fetch(`/api/admin/payments?${params}`, {
        credentials: 'include'
      })
      const data = await response.json()
      if (data.ok) {
        setPayments(data.payments)
        setTotal(data.total)
      }
    } catch (error) {
      console.error('Error fetching payments:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({ format: 'csv' })
      if (statusFilter) params.append('status', statusFilter)
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const response = await fetch(`/api/admin/export/payments?${params}`, {
        credentials: 'include'
      })
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `payments_${Date.now()}.csv`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting payments:', error)
      alert('Ошибка при экспорте')
    }
  }

  const formatPrice = (value) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0
    }).format(value || 0)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-white">Управление платежами</h1>
        <button
          onClick={handleExport}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
        >
          Экспорт CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-[#1a1a1a] border border-[#333333] rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            className="px-4 py-2 bg-[#0C0C0C] border border-[#333333] rounded-lg text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="">Все статусы</option>
            <option value="pending">Ожидает</option>
            <option value="processing">В обработке</option>
            <option value="success">Успешно</option>
            <option value="completed">Завершен</option>
            <option value="paid">Оплачен</option>
            <option value="failed">Ошибка</option>
          </select>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value)
              setPage(1)
            }}
            className="px-4 py-2 bg-[#0C0C0C] border border-[#333333] rounded-lg text-white focus:outline-none focus:border-cyan-500"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value)
              setPage(1)
            }}
            className="px-4 py-2 bg-[#0C0C0C] border border-[#333333] rounded-lg text-white focus:outline-none focus:border-cyan-500"
          />
          <div className="text-white/60 text-sm flex items-center">
            Всего: {total}
          </div>
        </div>
      </div>

      {/* Payments Table */}
      {loading ? (
        <div className="text-white/80">Загрузка...</div>
      ) : (
        <div className="bg-[#1a1a1a] border border-[#333333] rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-[#0C0C0C]">
              <tr>
                <th className="px-4 py-3 text-left text-white/80 text-sm font-semibold">ID</th>
                <th className="px-4 py-3 text-left text-white/80 text-sm font-semibold">Транзакция</th>
                <th className="px-4 py-3 text-left text-white/80 text-sm font-semibold">Пользователь</th>
                <th className="px-4 py-3 text-left text-white/80 text-sm font-semibold">Сумма</th>
                <th className="px-4 py-3 text-left text-white/80 text-sm font-semibold">Валюта</th>
                <th className="px-4 py-3 text-left text-white/80 text-sm font-semibold">Статус</th>
                <th className="px-4 py-3 text-left text-white/80 text-sm font-semibold">Дата</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className="border-t border-[#333333] hover:bg-[#0C0C0C]">
                  <td className="px-4 py-3 text-white/60 text-sm">{payment.id}</td>
                  <td className="px-4 py-3 text-white/80 text-sm">{payment.transactionId || '—'}</td>
                  <td className="px-4 py-3 text-white/80">{payment.userEmail || '—'}</td>
                  <td className="px-4 py-3 text-cyan-400 font-semibold">
                    {formatPrice(payment.amount)}
                  </td>
                  <td className="px-4 py-3 text-white/60 text-sm">{payment.currency || 'RUB'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        payment.status === 'success' || payment.status === 'completed' || payment.status === 'paid'
                          ? 'bg-green-500/20 text-green-400'
                          : payment.status === 'processing'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : payment.status === 'failed'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-gray-500/20 text-gray-400'
                      }`}
                    >
                      {payment.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/60 text-sm">
                    {payment.createdAt ? new Date(payment.createdAt).toLocaleDateString('ru-RU') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {payments.length === 0 && (
            <div className="p-8 text-center text-white/40">Платежи не найдены</div>
          )}
        </div>
      )}

      {/* Pagination */}
      {total > 50 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-[#1a1a1a] border border-[#333333] text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#0C0C0C]"
          >
            Назад
          </button>
          <span className="text-white/60">
            Страница {page} из {Math.ceil(total / 50)}
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= Math.ceil(total / 50)}
            className="px-4 py-2 bg-[#1a1a1a] border border-[#333333] text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#0C0C0C]"
          >
            Вперед
          </button>
        </div>
      )}
    </div>
  )
}

