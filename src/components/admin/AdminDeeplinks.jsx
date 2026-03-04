import React, { useState, useEffect } from 'react'

export default function AdminDeeplinks() {
  const [deeplinks, setDeeplinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    amount: '',
    currency: 'RUB',
    description: '',
    expiresInDays: 30
  })

  useEffect(() => {
    fetchDeeplinks()
  }, [statusFilter, page])

  const fetchDeeplinks = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50'
      })
      if (statusFilter) params.append('status', statusFilter)

      const response = await fetch(`/api/admin/deeplinks?${params}`, {
        credentials: 'include'
      })
      const data = await response.json()
      if (data.ok) {
        setDeeplinks(data.deeplinks)
        setTotal(data.total)
      }
    } catch (error) {
      console.error('Error fetching deeplinks:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/admin/deeplinks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount) || 0
        })
      })

      const data = await response.json()
      if (data.ok) {
        setShowModal(false)
        setFormData({
          amount: '',
          currency: 'RUB',
          description: '',
          expiresInDays: 30
        })
        fetchDeeplinks()
      } else {
        alert('Ошибка: ' + (data.error || 'Неизвестная ошибка'))
      }
    } catch (error) {
      console.error('Error creating deeplink:', error)
      alert('Ошибка при создании диплинка')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Вы уверены, что хотите удалить этот диплинк?')) return

    try {
      const response = await fetch(`/api/admin/deeplinks/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      const data = await response.json()
      if (data.ok) {
        fetchDeeplinks()
      }
    } catch (error) {
      console.error('Error deleting deeplink:', error)
      alert('Ошибка при удалении диплинка')
    }
  }

  const handleToggleActive = async (id, isActive) => {
    try {
      const response = await fetch(`/api/admin/deeplinks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive: !isActive })
      })
      const data = await response.json()
      if (data.ok) {
        fetchDeeplinks()
      }
    } catch (error) {
      console.error('Error updating deeplink:', error)
      alert('Ошибка при обновлении диплинка')
    }
  }

  const copyDeeplinkUrl = (deeplinkId) => {
    const url = `${window.location.origin}/deeplink/${deeplinkId}`
    navigator.clipboard.writeText(url).then(() => {
      alert('Ссылка скопирована в буфер обмена!')
    }).catch(() => {
      alert('Не удалось скопировать ссылку')
    })
  }

  const formatPrice = (value) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0
    }).format(value || 0)
  }

  const getStatusBadge = (deeplink) => {
    if (deeplink.status === 'completed' || deeplink.status === 'paid') {
      return <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">Использован</span>
    }
    if (deeplink.expiresAt && new Date(deeplink.expiresAt) <= new Date()) {
      return <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs">Истек</span>
    }
    if (!deeplink.isActive) {
      return <span className="px-2 py-1 bg-gray-500/20 text-gray-400 rounded text-xs">Неактивен</span>
    }
    return <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded text-xs">Активен</span>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-white">Управление диплинками</h1>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors"
        >
          + Создать диплинк
        </button>
      </div>

      {/* Filters */}
      <div className="bg-[#1a1a1a] border border-[#333333] rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            className="px-4 py-2 bg-[#0C0C0C] border border-[#333333] rounded-lg text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="">Все статусы</option>
            <option value="active">Активные</option>
            <option value="used">Использованные</option>
            <option value="expired">Истекшие</option>
            <option value="pending">Ожидает</option>
          </select>
          <div className="text-white/60 text-sm flex items-center">
            Всего: {total}
          </div>
        </div>
      </div>

      {/* Deeplinks Table */}
      {loading ? (
        <div className="text-white/80">Загрузка...</div>
      ) : (
        <div className="bg-[#1a1a1a] border border-[#333333] rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-[#0C0C0C]">
              <tr>
                <th className="px-4 py-3 text-left text-white/80 text-sm font-semibold">ID</th>
                <th className="px-4 py-3 text-left text-white/80 text-sm font-semibold">Сумма</th>
                <th className="px-4 py-3 text-left text-white/80 text-sm font-semibold">Описание</th>
                <th className="px-4 py-3 text-left text-white/80 text-sm font-semibold">Статус</th>
                <th className="px-4 py-3 text-left text-white/80 text-sm font-semibold">Переходы</th>
                <th className="px-4 py-3 text-left text-white/80 text-sm font-semibold">Срок действия</th>
                <th className="px-4 py-3 text-left text-white/80 text-sm font-semibold">Действия</th>
              </tr>
            </thead>
            <tbody>
              {deeplinks.map((deeplink) => (
                <tr key={deeplink.id} className="border-t border-[#333333] hover:bg-[#0C0C0C]">
                  <td className="px-4 py-3 text-white/60 text-sm font-mono">{deeplink.deeplinkId}</td>
                  <td className="px-4 py-3 text-cyan-400 font-semibold">
                    {formatPrice(deeplink.amount)} {deeplink.currency}
                  </td>
                  <td className="px-4 py-3 text-white/80 text-sm">{deeplink.description || '—'}</td>
                  <td className="px-4 py-3">
                    {getStatusBadge(deeplink)}
                  </td>
                  <td className="px-4 py-3 text-white/60 text-sm">{deeplink.clickCount || 0}</td>
                  <td className="px-4 py-3 text-white/60 text-sm">
                    {deeplink.expiresAt ? new Date(deeplink.expiresAt).toLocaleDateString('ru-RU') : 'Без ограничений'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyDeeplinkUrl(deeplink.deeplinkId)}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
                      >
                        Копировать
                      </button>
                      <button
                        onClick={() => handleToggleActive(deeplink.id, deeplink.isActive)}
                        className={`px-3 py-1 rounded text-sm transition-colors ${
                          deeplink.isActive
                            ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                            : 'bg-green-600 hover:bg-green-700 text-white'
                        }`}
                      >
                        {deeplink.isActive ? 'Деактивировать' : 'Активировать'}
                      </button>
                      <button
                        onClick={() => handleDelete(deeplink.id)}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
                      >
                        Удалить
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {deeplinks.length === 0 && (
            <div className="p-8 text-center text-white/40">Диплинки не найдены</div>
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

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] border border-[#333333] rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold text-white mb-4">Создать диплинк</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-white/80 text-sm mb-2">Сумма</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                  className="w-full px-4 py-2 bg-[#0C0C0C] border border-[#333333] rounded-lg text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-white/80 text-sm mb-2">Валюта</label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full px-4 py-2 bg-[#0C0C0C] border border-[#333333] rounded-lg text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="RUB">RUB</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
              <div>
                <label className="block text-white/80 text-sm mb-2">Описание</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-[#0C0C0C] border border-[#333333] rounded-lg text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-white/80 text-sm mb-2">Срок действия (дней)</label>
                <input
                  type="number"
                  min="1"
                  value={formData.expiresInDays}
                  onChange={(e) => setFormData({ ...formData, expiresInDays: parseInt(e.target.value) || 30 })}
                  className="w-full px-4 py-2 bg-[#0C0C0C] border border-[#333333] rounded-lg text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="px-6 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors"
                >
                  Создать
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setFormData({
                      amount: '',
                      currency: 'RUB',
                      description: '',
                      expiresInDays: 30
                    })
                  }}
                  className="px-6 py-2 bg-[#333333] hover:bg-[#444444] text-white rounded-lg transition-colors"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

