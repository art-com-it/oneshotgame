import React, { useState, useEffect } from 'react'

export default function AdminActivityLog() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    fetchLogs()
  }, [filter, page])

  const fetchLogs = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50'
      })
      if (filter) params.append('filter', filter)

      const response = await fetch(`/api/admin/activity-log?${params}`, {
        credentials: 'include'
      })
      const data = await response.json()
      if (data.ok) {
        setLogs(data.logs)
        setTotal(data.total)
      }
    } catch (error) {
      console.error('Error fetching activity log:', error)
    } finally {
      setLoading(false)
    }
  }

  const exportToCSV = async () => {
    try {
      const response = await fetch('/api/admin/activity-log/export', {
        credentials: 'include'
      })
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `activity-log-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting CSV:', error)
      alert('Ошибка при экспорте данных')
    }
  }

  const getActionIcon = (action) => {
    if (action.includes('создан') || action.includes('добавлен')) return '➕'
    if (action.includes('обновлен') || action.includes('изменен')) return '✏️'
    if (action.includes('удален')) return '🗑️'
    if (action.includes('оплата') || action.includes('платеж')) return '💳'
    if (action.includes('заказ')) return '📦'
    return '📝'
  }

  const getActionColor = (action) => {
    if (action.includes('создан') || action.includes('добавлен')) return 'text-green-400'
    if (action.includes('обновлен') || action.includes('изменен')) return 'text-blue-400'
    if (action.includes('удален')) return 'text-red-400'
    if (action.includes('оплата') || action.includes('платеж')) return 'text-yellow-400'
    return 'text-white/80'
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-white">История операций</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={exportToCSV}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors font-semibold"
          >
            📥 Экспорт CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#1a1a1a] border border-[#333333] rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="Поиск по действию, пользователю..."
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value)
              setPage(1)
            }}
            className="px-4 py-2 bg-[#0C0C0C] border border-[#333333] rounded-lg text-white focus:outline-none focus:border-cyan-500"
          />
          <div className="text-white/60 text-sm flex items-center">
            Всего записей: {total}
          </div>
        </div>
      </div>

      {/* Logs Table */}
      {loading ? (
        <div className="text-white/80">Загрузка...</div>
      ) : (
        <div className="bg-[#1a1a1a] border border-[#333333] rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-[#0C0C0C]">
              <tr>
                <th className="px-4 py-3 text-left text-white/80 text-sm font-semibold">Код операции</th>
                <th className="px-4 py-3 text-left text-white/80 text-sm font-semibold">Время</th>
                <th className="px-4 py-3 text-left text-white/80 text-sm font-semibold">Действие</th>
                <th className="px-4 py-3 text-left text-white/80 text-sm font-semibold">Пользователь</th>
                <th className="px-4 py-3 text-left text-white/80 text-sm font-semibold">Детали</th>
                <th className="px-4 py-3 text-left text-white/80 text-sm font-semibold">Тип</th>
              </tr>
            </thead>
            <tbody>
              {logs.length > 0 ? (
                logs.map((log) => (
                  <tr key={log.id} className="border-t border-[#333333] hover:bg-[#0C0C0C]">
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded text-xs bg-green-500/20 text-green-400 font-mono font-semibold">
                        {log.code || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/60 text-sm">
                      {log.createdAt ? new Date(log.createdAt).toLocaleString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      }) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{getActionIcon(log.action)}</span>
                        <span className={getActionColor(log.action)}>{log.action}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-white/80 text-sm">
                      {log.userEmail || log.userName || log.adminEmail || 'Система'}
                    </td>
                    <td className="px-4 py-3 text-white/60 text-sm max-w-md truncate">
                      {log.details || log.entityId || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded text-xs bg-cyan-500/20 text-cyan-400">
                        {log.entityType || 'общее'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-white/40">
                    Записи не найдены
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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

