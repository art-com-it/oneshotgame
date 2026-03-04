import React, { useState, useEffect } from 'react'

export default function AdminOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    fetchOrders()
  }, [statusFilter])

  const fetchOrders = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/orders', {
        credentials: 'include'
      })
      const data = await response.json()
      if (data.ok) {
        let filtered = data.orders || []
        if (search) {
          const searchLower = search.toLowerCase()
          filtered = filtered.filter(o =>
            o.orderId?.toLowerCase().includes(searchLower) ||
            o.userEmail?.toLowerCase().includes(searchLower) ||
            o.userName?.toLowerCase().includes(searchLower)
          )
        }
        if (statusFilter) {
          filtered = filtered.filter(o => o.status === statusFilter)
        }
        setOrders(filtered)
      }
    } catch (error) {
      console.error('Error fetching orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus })
      })
      const data = await response.json()
      if (data.ok) {
        fetchOrders()
      }
    } catch (error) {
      console.error('Error updating order status:', error)
      alert('Ошибка при обновлении статуса заказа')
    }
  }

  const handleExport = async () => {
    try {
      const response = await fetch('/api/admin/export/orders?format=csv', {
        credentials: 'include'
      })
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `orders_${Date.now()}.csv`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting orders:', error)
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
        <h1 className="text-3xl font-bold text-white">Управление заказами</h1>
        <button
          onClick={handleExport}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
        >
          Экспорт CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-[#1a1a1a] border border-[#333333] rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Поиск по номеру заказа, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-4 py-2 bg-[#0C0C0C] border border-[#333333] rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-cyan-500"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-[#0C0C0C] border border-[#333333] rounded-lg text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="">Все статусы</option>
            <option value="new">Новый</option>
            <option value="processing">В обработке</option>
            <option value="completed">Завершен</option>
            <option value="failed">Ошибка</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      {loading ? (
        <div className="text-white/80">Загрузка...</div>
      ) : (
        <div className="bg-[#1a1a1a] border border-[#333333] rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-[#0C0C0C]">
              <tr>
                <th className="px-4 py-3 text-left text-white/80 text-sm font-semibold">Номер заказа</th>
                <th className="px-4 py-3 text-left text-white/80 text-sm font-semibold">Пользователь</th>
                <th className="px-4 py-3 text-left text-white/80 text-sm font-semibold">Товары</th>
                <th className="px-4 py-3 text-left text-white/80 text-sm font-semibold">Сумма</th>
                <th className="px-4 py-3 text-left text-white/80 text-sm font-semibold">Статус</th>
                <th className="px-4 py-3 text-left text-white/80 text-sm font-semibold">Дата</th>
                <th className="px-4 py-3 text-left text-white/80 text-sm font-semibold">Действия</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t border-[#333333] hover:bg-[#0C0C0C]">
                  <td className="px-4 py-3 text-white font-semibold">{order.orderId}</td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-white">{order.userName || 'Пользователь'}</p>
                      <p className="text-white/60 text-sm">{order.userEmail}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-white/80 text-sm">
                    {order.items?.length || 0} товар(ов)
                  </td>
                  <td className="px-4 py-3 text-cyan-400 font-semibold">
                    {formatPrice(order.totalAmount)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        order.status === 'completed'
                          ? 'bg-green-500/20 text-green-400'
                          : order.status === 'processing'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : order.status === 'failed'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-gray-500/20 text-gray-400'
                      }`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/60 text-sm">
                    {new Date(order.createdAt).toLocaleDateString('ru-RU')}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={order.status}
                      onChange={(e) => handleStatusChange(order.id, e.target.value)}
                      className="px-3 py-1 bg-[#0C0C0C] border border-[#333333] rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                    >
                      <option value="new">Новый</option>
                      <option value="processing">В обработке</option>
                      <option value="completed">Завершен</option>
                      <option value="failed">Ошибка</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && (
            <div className="p-8 text-center text-white/40">Заказы не найдены</div>
          )}
        </div>
      )}
    </div>
  )
}

