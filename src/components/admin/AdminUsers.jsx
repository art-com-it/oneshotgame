import React, { useState, useEffect } from 'react'

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    fetchUsers()
  }, [search, page])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50'
      })
      if (search) params.append('search', search)

      const response = await fetch(`/api/admin/users?${params}`, {
        credentials: 'include'
      })
      const data = await response.json()
      if (data.ok) {
        setUsers(data.users)
        setTotal(data.total)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleBlock = async (userId, blocked) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/block`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ blocked })
      })
      const data = await response.json()
      if (data.ok) {
        fetchUsers()
      }
    } catch (error) {
      console.error('Error blocking user:', error)
      alert('Ошибка при блокировке пользователя')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-white">Управление пользователями</h1>
      </div>

      {/* Search */}
      <div className="bg-[#1a1a1a] border border-[#333333] rounded-lg p-4 mb-6">
        <input
          type="text"
          placeholder="Поиск по email, имени..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          className="w-full px-4 py-2 bg-[#0C0C0C] border border-[#333333] rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-cyan-500"
        />
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="text-white/80">Загрузка...</div>
      ) : (
        <div className="bg-[#1a1a1a] border border-[#333333] rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-[#0C0C0C]">
              <tr>
                <th className="px-4 py-3 text-left text-white/80 text-sm font-semibold">Код</th>
                <th className="px-4 py-3 text-left text-white/80 text-sm font-semibold">ID</th>
                <th className="px-4 py-3 text-left text-white/80 text-sm font-semibold">Имя</th>
                <th className="px-4 py-3 text-left text-white/80 text-sm font-semibold">Email</th>
                <th className="px-4 py-3 text-left text-white/80 text-sm font-semibold">Провайдер</th>
                <th className="px-4 py-3 text-left text-white/80 text-sm font-semibold">Роль</th>
                <th className="px-4 py-3 text-left text-white/80 text-sm font-semibold">Статус</th>
                <th className="px-4 py-3 text-left text-white/80 text-sm font-semibold">Дата регистрации</th>
                <th className="px-4 py-3 text-left text-white/80 text-sm font-semibold">Действия</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-[#333333] hover:bg-[#0C0C0C]">
                  <td className="px-4 py-3">
                    {user.code ? (
                      <span className="px-2 py-1 rounded text-xs bg-green-500/20 text-green-400 font-mono font-semibold">
                        {user.code}
                      </span>
                    ) : (
                      <span className="text-white/40 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-white/60 text-sm">{user.id}</td>
                  <td className="px-4 py-3 text-white">{user.displayName || '—'}</td>
                  <td className="px-4 py-3 text-white/80">{user.email || '—'}</td>
                  <td className="px-4 py-3 text-white/60 text-sm">{user.provider || '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        user.role === 'admin'
                          ? 'bg-purple-500/20 text-purple-400'
                          : 'bg-gray-500/20 text-gray-400'
                      }`}
                    >
                      {user.role || 'user'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {user.isBlocked ? (
                      <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs">Заблокирован</span>
                    ) : (
                      <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">Активен</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-white/60 text-sm">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString('ru-RU') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleBlock(user.id, !user.isBlocked)}
                      className={`px-3 py-1 rounded text-sm transition-colors ${
                        user.isBlocked
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : 'bg-red-600 hover:bg-red-700 text-white'
                      }`}
                    >
                      {user.isBlocked ? 'Разблокировать' : 'Заблокировать'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <div className="p-8 text-center text-white/40">Пользователи не найдены</div>
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

