import React, { useState, useEffect } from 'react'
import { useNavigate, Routes, Route, NavLink } from 'react-router-dom'
import AdminDashboard from '../components/admin/AdminDashboard'
import AdminProducts from '../components/admin/AdminProducts'
import AdminOrders from '../components/admin/AdminOrders'
import AdminUsers from '../components/admin/AdminUsers'
import AdminPayments from '../components/admin/AdminPayments'
import AdminDeeplinks from '../components/admin/AdminDeeplinks'
import AdminActivityLog from '../components/admin/AdminActivityLog'
import AdminAccounting from '../components/admin/AdminAccounting'

export default function Admin() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const response = await fetch('/auth/status', {
        credentials: 'include'
      })
      const data = await response.json()

      console.log('[Admin] Auth status response:', data)

      if (!data.ok) {
        console.log('[Admin] Not authenticated, redirecting to home')
        navigate('/')
        return
      }

      if (data.role !== 'admin') {
        console.log('[Admin] User role is not admin:', data.role, 'redirecting to home')
        navigate('/')
        return
      }

      console.log('[Admin] User authenticated as admin:', data.email)
      setUser(data)
    } catch (error) {
      console.error('Auth check error:', error)
      navigate('/')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0C0C0C] flex items-center justify-center">
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

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-[#0C0C0C] flex items-center justify-center pt-20">
        <div className="bg-[#1a1a1a] border border-[#333333] rounded-lg p-8 max-w-md w-full text-center">
          <div className="text-red-400 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-white mb-4">Доступ запрещен</h1>
          <p className="text-white/80 mb-6">У вас нет прав доступа к админ-панели.</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors font-semibold"
          >
            Вернуться на главную
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0C0C0C] pt-20">
      {/* Burger Menu Button - Desktop & Mobile */}
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="fixed top-24 left-4 z-[60] p-2 bg-[#1a1a1a] border border-[#333333] rounded-lg text-white hover:bg-[#2a2a2a] transition-colors shadow-lg"
        aria-label="Toggle menu"
      >
        {menuOpen ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {/* Overlay - Mobile Only */}
      {menuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-[45] top-20"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <div className="flex">
        {/* Sidebar */}
        <aside className={`
          w-64 max-w-[80vw] bg-[#1a1a1a] border-r border-[#333333] h-[calc(100vh-5rem)] fixed left-0 top-20 z-[50]
          transition-transform duration-300 ease-in-out overflow-y-auto
          ${menuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className="p-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Админ-панель</h2>
              <button
                onClick={() => setMenuOpen(false)}
                className="text-white/70 hover:text-white"
                aria-label="Close menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="space-y-2">
              <NavLink
                to="/admin"
                end
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  }`
                }
                onClick={() => setMenuOpen(false)}
              >
                <span className="text-xl">📊</span>
                <span>Dashboard</span>
              </NavLink>
              <NavLink
                to="/admin/products"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  }`
                }
                onClick={() => setMenuOpen(false)}
              >
                <span className="text-xl">🎮</span>
                <span>Товары</span>
              </NavLink>
              <NavLink
                to="/admin/orders"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  }`
                }
                onClick={() => setMenuOpen(false)}
              >
                <span className="text-xl">📦</span>
                <span>Заказы</span>
              </NavLink>
              <NavLink
                to="/admin/users"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  }`
                }
                onClick={() => setMenuOpen(false)}
              >
                <span className="text-xl">👥</span>
                <span>Пользователи</span>
              </NavLink>
              <NavLink
                to="/admin/payments"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  }`
                }
                onClick={() => setMenuOpen(false)}
              >
                <span className="text-xl">💳</span>
                <span>Платежи</span>
              </NavLink>
              <NavLink
                to="/admin/deeplinks"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  }`
                }
                onClick={() => setMenuOpen(false)}
              >
                <span className="text-xl">🔗</span>
                <span>Диплинки</span>
              </NavLink>
              <NavLink
                to="/admin/activity-log"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  }`
                }
                onClick={() => setMenuOpen(false)}
              >
                <span className="text-xl">📋</span>
                <span>История операций</span>
              </NavLink>
              <NavLink
                to="/admin/accounting"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  }`
                }
                onClick={() => setMenuOpen(false)}
              >
                <span className="text-xl">📊</span>
                <span>Бухгалтерия</span>
              </NavLink>
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 w-full p-4 md:p-8 relative z-0 min-w-0">
          <Routes>
            <Route index element={<AdminDashboard />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="payments" element={<AdminPayments />} />
            <Route path="deeplinks" element={<AdminDeeplinks />} />
            <Route path="activity-log" element={<AdminActivityLog />} />
            <Route path="accounting" element={<AdminAccounting />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
