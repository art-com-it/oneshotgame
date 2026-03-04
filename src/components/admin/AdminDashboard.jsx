import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('month')

  useEffect(() => {
    fetchData()
  }, [timeRange])

  const fetchData = async () => {
    try {
      const [statsRes, dashboardRes] = await Promise.all([
        fetch(`/api/admin/stats?range=${timeRange}`, { credentials: 'include' }),
        fetch('/api/admin/dashboard', { credentials: 'include' })
      ])

      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setStats(statsData.stats)
      }

      if (dashboardRes.ok) {
        const dashboardData = await dashboardRes.json()
        setDashboard(dashboardData)
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatPrice = (value) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0
    }).format(value || 0)
  }

  const formatChange = (change) => {
    if (change === undefined || change === null) return <span className="text-white/40">-</span>
    const sign = change >= 0 ? '+' : ''
    const color = change >= 0 ? 'text-green-400' : 'text-red-400'
    return <span className={`${color} text-sm font-semibold`}>{sign}{change.toFixed(1)}%</span>
  }

  const getTimeRangeLabel = () => {
    switch(timeRange) {
      case 'day': return 'за день'
      case 'week': return 'за неделю'
      case 'month': return 'за месяц'
      default: return 'за месяц'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <svg className="animate-spin h-12 w-12 text-cyan-400 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-white/80">Загрузка данных...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2 truncate">Панель администратора</h1>
          <p className="text-white/60 text-sm md:text-base">Добро пожаловать, Администратор</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-4 py-2 bg-[#1a1a1a] border border-[#333333] rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
          >
            <option value="day">За день</option>
            <option value="week">За неделю</option>
            <option value="month">За месяц</option>
          </select>
          <button
            onClick={() => navigate('/admin/products/new')}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors font-semibold whitespace-nowrap"
          >
            + Добавить товар
          </button>
        </div>
      </div>

      {/* Top Row - Key Metrics (Clickable) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div 
          onClick={() => navigate('/admin/payments')}
          className="bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] border border-[#333333] rounded-xl p-6 shadow-lg hover:shadow-xl hover:border-green-500/50 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-14 h-14 bg-gradient-to-br from-green-500/20 to-green-600/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="text-3xl">💰</span>
            </div>
            {formatChange(stats?.revenue?.change)}
          </div>
          <p className="text-white/60 text-sm mb-1">Выручка {getTimeRangeLabel()}</p>
          <p className="text-3xl font-bold text-green-400 mb-1 group-hover:text-green-300 transition-colors">
            {formatPrice(stats?.revenue?.value || 0)}
          </p>
          <p className="text-white/40 text-xs">Всего: {formatPrice(stats?.revenue?.total || stats?.revenue?.value || 0)}</p>
        </div>

        <div 
          onClick={() => navigate('/admin/orders')}
          className="bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] border border-[#333333] rounded-xl p-6 shadow-lg hover:shadow-xl hover:border-blue-500/50 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="text-3xl">📦</span>
            </div>
            {formatChange(stats?.orders?.change)}
          </div>
          <p className="text-white/60 text-sm mb-1">Заказов {getTimeRangeLabel()}</p>
          <p className="text-3xl font-bold text-blue-400 mb-1 group-hover:text-blue-300 transition-colors">
            {stats?.orders?.value || 0}
          </p>
          <p className="text-white/40 text-xs">Всего: {stats?.orders?.total || stats?.orders?.value || 0}</p>
        </div>

        <div 
          onClick={() => navigate('/admin/users')}
          className="bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] border border-[#333333] rounded-xl p-6 shadow-lg hover:shadow-xl hover:border-purple-500/50 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-500/20 to-purple-600/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="text-3xl">👥</span>
            </div>
            {formatChange(stats?.users?.change)}
          </div>
          <p className="text-white/60 text-sm mb-1">Пользователей {getTimeRangeLabel()}</p>
          <p className="text-3xl font-bold text-purple-400 mb-1 group-hover:text-purple-300 transition-colors">
            {stats?.users?.value || 0}
          </p>
          <p className="text-white/40 text-xs">Всего: {stats?.users?.total || 0}</p>
        </div>

        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] border border-[#333333] rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-14 h-14 bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 rounded-xl flex items-center justify-center">
              <span className="text-3xl">👁️</span>
            </div>
            <span className="text-white/40 text-sm">-</span>
          </div>
          <p className="text-white/60 text-sm mb-1">Просмотров</p>
          <p className="text-3xl font-bold text-cyan-400 mb-1">0</p>
          <p className="text-white/40 text-xs">Статистика в разработке</p>
        </div>
      </div>

      {/* Category Cards - All Clickable */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div 
          onClick={() => navigate('/admin/products')}
          className="bg-[#1a1a1a] border border-[#333333] rounded-xl p-6 cursor-pointer hover:bg-[#222222] hover:border-green-500/50 transition-all group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-xl">🎮</span>
              </div>
              <div>
                <p className="text-white font-semibold">Товары</p>
                <p className="text-white/60 text-sm">{stats?.products?.total || 0} записей</p>
              </div>
            </div>
            <span className="text-white/40 group-hover:text-green-400 group-hover:translate-x-1 transition-all">→</span>
          </div>
        </div>

        <div 
          onClick={() => navigate('/admin/users')}
          className="bg-[#1a1a1a] border border-[#333333] rounded-xl p-6 cursor-pointer hover:bg-[#222222] hover:border-blue-500/50 transition-all group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-xl">👥</span>
              </div>
              <div>
                <p className="text-white font-semibold">Пользователи</p>
                <p className="text-white/60 text-sm">{stats?.users?.total || 0} записей</p>
              </div>
            </div>
            <span className="text-white/40 group-hover:text-blue-400 group-hover:translate-x-1 transition-all">→</span>
          </div>
        </div>

        <div 
          onClick={() => navigate('/admin/orders')}
          className="bg-[#1a1a1a] border border-[#333333] rounded-xl p-6 cursor-pointer hover:bg-[#222222] hover:border-purple-500/50 transition-all group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-xl">📦</span>
              </div>
              <div>
                <p className="text-white font-semibold">Заказы</p>
                <p className="text-white/60 text-sm">{stats?.orders?.total || stats?.orders?.value || 0} записей</p>
              </div>
            </div>
            <span className="text-white/40 group-hover:text-purple-400 group-hover:translate-x-1 transition-all">→</span>
          </div>
        </div>

        <div 
          onClick={() => navigate('/admin/reviews')}
          className="bg-[#1a1a1a] border border-[#333333] rounded-xl p-6 cursor-pointer hover:bg-[#222222] hover:border-pink-500/50 transition-all group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-pink-500/20 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-xl">💬</span>
              </div>
              <div>
                <p className="text-white font-semibold">Отзывы</p>
                <p className="text-white/60 text-sm">{stats?.reviews?.total || 0} записей</p>
              </div>
            </div>
            <span className="text-white/40 group-hover:text-pink-400 group-hover:translate-x-1 transition-all">→</span>
          </div>
        </div>
      </div>

      {/* Payments and Deeplinks Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div 
          onClick={() => navigate('/admin/payments')}
          className="bg-[#1a1a1a] border border-[#333333] rounded-xl p-6 cursor-pointer hover:bg-[#222222] hover:border-yellow-500/50 transition-all group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-xl">💳</span>
              </div>
              <div>
                <p className="text-white font-semibold">Платежи</p>
                <p className="text-white/60 text-sm">{stats?.payments?.total || stats?.orders?.value || 0} записей</p>
              </div>
            </div>
            <span className="text-white/40 group-hover:text-yellow-400 group-hover:translate-x-1 transition-all">→</span>
          </div>
        </div>

        <div 
          onClick={() => navigate('/admin/deeplinks')}
          className="bg-[#1a1a1a] border border-[#333333] rounded-xl p-6 cursor-pointer hover:bg-[#222222] hover:border-cyan-500/50 transition-all group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-xl">🔗</span>
              </div>
              <div>
                <p className="text-white font-semibold">Диплинки</p>
                <p className="text-white/60 text-sm">{stats?.deeplinks?.total || 0} записей</p>
              </div>
            </div>
            <span className="text-white/40 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all">→</span>
          </div>
        </div>
      </div>

      {/* Recent Orders and Reviews */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="bg-[#1a1a1a] border border-[#333333] rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Последние заказы</h2>
            <button
              onClick={() => navigate('/admin/orders')}
              className="text-green-400 hover:text-green-300 text-sm font-semibold flex items-center gap-1 transition-colors"
            >
              Все заказы <span>→</span>
            </button>
          </div>
          {dashboard?.recentOrders && dashboard.recentOrders.length > 0 ? (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {dashboard.recentOrders.slice(0, 10).map((order) => (
                <div
                  key={order.id}
                  onClick={() => navigate(`/admin/orders/${order.id}`)}
                  className="bg-[#0C0C0C] border border-[#333333] rounded-lg p-4 hover:border-green-500/30 hover:bg-[#111111] transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1">
                      <div className="text-white font-semibold mb-1">{order.orderId}</div>
                      <div className="text-white/60 text-sm">
                        {order.userEmail || order.userName || 'Пользователь'}
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        order.status === 'completed'
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : order.status === 'processing'
                          ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                          : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                      }`}
                    >
                      {order.status === 'completed' ? 'Выполнен' : order.status === 'processing' ? 'В обработке' : order.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <div className="text-green-400 font-bold text-lg">
                      {formatPrice(order.totalAmount)}
                    </div>
                    <div className="text-white/40 text-xs">
                      {order.createdAt ? new Date(order.createdAt).toLocaleDateString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-white/40">Заказы пока не поступали.</p>
            </div>
          )}
        </div>

        {/* Pending Reviews */}
        <div className="bg-[#1a1a1a] border border-[#333333] rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Отзывы на модерации</h2>
            <button
              onClick={() => navigate('/admin/reviews')}
              className="text-green-400 hover:text-green-300 text-sm font-semibold flex items-center gap-1 transition-colors"
            >
              Все отзывы <span>→</span>
            </button>
          </div>
          {dashboard?.pendingReviews && dashboard.pendingReviews.length > 0 ? (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {dashboard.pendingReviews.slice(0, 10).map((review) => (
                <div
                  key={review.id}
                  onClick={() => navigate(`/admin/reviews/${review.id}`)}
                  className="bg-[#0C0C0C] border border-[#333333] rounded-lg p-4 hover:border-pink-500/30 hover:bg-[#111111] transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-semibold">{review.productName}</span>
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, i) => (
                        <span
                          key={i}
                          className={i < review.rating ? 'text-yellow-400' : 'text-white/20'}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="text-white/60 text-sm mb-2">{review.userName}</p>
                  <p className="text-white/80 text-sm line-clamp-2">{review.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-white/40">Отзывов на модерации нет</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
