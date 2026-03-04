import React, { useState, useEffect } from 'react'

export default function AdminAccounting() {
  const [config, setConfig] = useState({
    syncUrl: '',
    enabled: false,
    autoSync: false,
    syncInterval: 3600000,
    lastSync: null,
    hasApiKey: false
  })
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [testResult, setTestResult] = useState(null)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      const response = await fetch('/api/admin/accounting/config', {
        credentials: 'include'
      })
      const data = await response.json()
      if (data.ok) {
        setConfig(data.config)
      }
    } catch (error) {
      console.error('Error loading config:', error)
    }
  }

  const loadApiKey = async () => {
    try {
      const response = await fetch('/api/admin/accounting/api-key', {
        credentials: 'include'
      })
      const data = await response.json()
      if (data.ok) {
        setApiKey(data.apiKey)
        setShowApiKey(true)
      }
    } catch (error) {
      console.error('Error loading API key:', error)
    }
  }

  const handleSaveConfig = async () => {
    setLoading(true)
    setMessage({ type: '', text: '' })
    try {
      const response = await fetch('/api/admin/accounting/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          syncUrl: config.syncUrl,
          enabled: config.enabled,
          autoSync: config.autoSync,
          syncInterval: config.syncInterval
        })
      })
      const data = await response.json()
      if (data.ok) {
        setMessage({ type: 'success', text: 'Настройки сохранены успешно' })
        setConfig(data.config)
      } else {
        setMessage({ type: 'error', text: data.error || 'Ошибка сохранения' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Ошибка соединения с сервером' })
    } finally {
      setLoading(false)
    }
  }

  const handleRegenerateKey = async () => {
    if (!confirm('Вы уверены, что хотите сгенерировать новый API ключ? Старый ключ перестанет работать.')) {
      return
    }
    setLoading(true)
    setMessage({ type: '', text: '' })
    try {
      const response = await fetch('/api/admin/accounting/regenerate-key', {
        method: 'POST',
        credentials: 'include'
      })
      const data = await response.json()
      if (data.ok) {
        setApiKey(data.apiKey)
        setShowApiKey(true)
        setMessage({ type: 'success', text: 'Новый API ключ сгенерирован' })
      } else {
        setMessage({ type: 'error', text: data.error || 'Ошибка генерации ключа' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Ошибка соединения с сервером' })
    } finally {
      setLoading(false)
    }
  }

  const handleTestSync = async () => {
    if (!config.syncUrl) {
      setMessage({ type: 'error', text: 'Укажите URL для синхронизации' })
      return
    }
    setLoading(true)
    setTestResult(null)
    setMessage({ type: '', text: '' })
    try {
      const response = await fetch('/api/admin/accounting/test-sync', {
        method: 'POST',
        credentials: 'include'
      })
      const data = await response.json()
      if (data.ok) {
        setTestResult({ success: true, message: data.message, response: data.response })
        setMessage({ type: 'success', text: 'Тестовая синхронизация выполнена успешно' })
        loadConfig() // Обновляем lastSync
      } else {
        setTestResult({ success: false, error: data.error, message: data.message })
        setMessage({ type: 'error', text: data.message || 'Ошибка синхронизации' })
      }
    } catch (error) {
      setTestResult({ success: false, error: 'connection_error', message: error.message })
      setMessage({ type: 'error', text: 'Ошибка соединения с сервером' })
    } finally {
      setLoading(false)
    }
  }

  const handleExportCSV = () => {
    window.open('/api/accounting/export/csv?apiKey=' + encodeURIComponent(apiKey), '_blank')
  }

  const formatInterval = (ms) => {
    const hours = Math.floor(ms / 3600000)
    const minutes = Math.floor((ms % 3600000) / 60000)
    if (hours > 0) return `${hours} ч ${minutes > 0 ? minutes + ' мин' : ''}`
    return `${minutes} мин`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Бухгалтерия и синхронизация</h1>
      </div>

      {message.text && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-500/20 border border-green-500/30 text-green-400' :
          'bg-red-500/20 border border-red-500/30 text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      {/* API Ключ */}
      <div className="bg-[#1a1a1a] border border-[#333333] rounded-xl p-6">
        <h2 className="text-xl font-bold text-white mb-4">API Ключ для синхронизации</h2>
        <p className="text-white/60 mb-4">
          Этот ключ используется для аутентификации при синхронизации данных с внешним сервером.
          Храните его в безопасности и не передавайте третьим лицам.
        </p>
        <div className="flex items-center gap-4">
          {!showApiKey ? (
            <button
              onClick={loadApiKey}
              className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-400 rounded-lg transition-colors"
            >
              Показать API ключ
            </button>
          ) : (
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <code className="flex-1 px-4 py-2 bg-[#0C0C0C] border border-[#333333] rounded-lg text-white/80 font-mono text-sm break-all">
                  {apiKey}
                </code>
                <button
                  onClick={() => navigator.clipboard.writeText(apiKey)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg transition-colors"
                  title="Копировать"
                >
                  📋
                </button>
              </div>
              <button
                onClick={handleRegenerateKey}
                disabled={loading}
                className="px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 text-yellow-400 rounded-lg transition-colors disabled:opacity-50"
              >
                Сгенерировать новый ключ
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Настройки синхронизации */}
      <div className="bg-[#1a1a1a] border border-[#333333] rounded-xl p-6">
        <h2 className="text-xl font-bold text-white mb-4">Настройки синхронизации</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-white/80 mb-2">URL внешнего сервера для синхронизации</label>
            <input
              type="url"
              value={config.syncUrl}
              onChange={(e) => setConfig({ ...config, syncUrl: e.target.value })}
              placeholder="https://accounting.example.com/api/sync"
              className="w-full px-4 py-2 bg-[#0C0C0C] border border-[#333333] rounded-lg text-white focus:border-cyan-500 focus:outline-none"
            />
            <p className="text-white/60 text-sm mt-1">
              URL должен принимать POST запросы с JSON данными и заголовком X-Accounting-API-Key
            </p>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                className="w-5 h-5 rounded border-[#333333] bg-[#0C0C0C] text-cyan-500 focus:ring-cyan-500"
              />
              <span className="text-white/80">Включить синхронизацию</span>
            </label>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.autoSync}
                onChange={(e) => setConfig({ ...config, autoSync: e.target.checked })}
                className="w-5 h-5 rounded border-[#333333] bg-[#0C0C0C] text-cyan-500 focus:ring-cyan-500"
              />
              <span className="text-white/80">Автоматическая синхронизация</span>
            </label>
          </div>

          {config.autoSync && (
            <div>
              <label className="block text-white/80 mb-2">
                Интервал синхронизации: {formatInterval(config.syncInterval)}
              </label>
              <input
                type="range"
                min="60000"
                max="86400000"
                step="60000"
                value={config.syncInterval}
                onChange={(e) => setConfig({ ...config, syncInterval: parseInt(e.target.value, 10) })}
                className="w-full"
              />
              <div className="flex justify-between text-white/60 text-sm mt-1">
                <span>1 мин</span>
                <span>24 часа</span>
              </div>
            </div>
          )}

          {config.lastSync && (
            <div className="text-white/60 text-sm">
              Последняя синхронизация: {new Date(config.lastSync).toLocaleString('ru-RU')}
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={handleSaveConfig}
              disabled={loading}
              className="px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors font-semibold disabled:opacity-50"
            >
              Сохранить настройки
            </button>
            <button
              onClick={handleTestSync}
              disabled={loading || !config.syncUrl}
              className="px-6 py-3 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-400 rounded-lg transition-colors font-semibold disabled:opacity-50"
            >
              Тестовая синхронизация
            </button>
          </div>
        </div>
      </div>

      {/* Результат тестовой синхронизации */}
      {testResult && (
        <div className={`bg-[#1a1a1a] border rounded-xl p-6 ${
          testResult.success ? 'border-green-500/30' : 'border-red-500/30'
        }`}>
          <h3 className={`text-lg font-bold mb-2 ${
            testResult.success ? 'text-green-400' : 'text-red-400'
          }`}>
            {testResult.success ? '✅ Синхронизация успешна' : '❌ Ошибка синхронизации'}
          </h3>
          <p className="text-white/80 mb-2">{testResult.message}</p>
          {testResult.response && (
            <pre className="bg-[#0C0C0C] p-4 rounded-lg text-white/60 text-xs overflow-auto">
              {JSON.stringify(testResult.response, null, 2)}
            </pre>
          )}
          {testResult.error && (
            <p className="text-red-400 text-sm">Ошибка: {testResult.error}</p>
          )}
        </div>
      )}

      {/* Экспорт данных */}
      <div className="bg-[#1a1a1a] border border-[#333333] rounded-xl p-6">
        <h2 className="text-xl font-bold text-white mb-4">Экспорт данных</h2>
        <p className="text-white/60 mb-4">
          Экспортируйте бухгалтерские данные в CSV формат для загрузки в другую систему.
        </p>
        <div className="flex gap-4">
          <button
            onClick={handleExportCSV}
            disabled={!apiKey}
            className="px-6 py-3 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-400 rounded-lg transition-colors font-semibold disabled:opacity-50"
          >
            Экспорт в CSV
          </button>
          <a
            href="/api/admin/export/payments"
            className="px-6 py-3 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-400 rounded-lg transition-colors font-semibold inline-block"
          >
            Экспорт платежей (старый формат)
          </a>
        </div>
      </div>

      {/* Инструкция по настройке */}
      <div className="bg-[#1a1a1a] border border-[#333333] rounded-xl p-6">
        <h2 className="text-xl font-bold text-white mb-4">Инструкция по настройке внешнего сервера</h2>
        <div className="space-y-4 text-white/80">
          <div>
            <h3 className="font-semibold text-white mb-2">1. API Endpoints:</h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><code className="bg-[#0C0C0C] px-2 py-1 rounded">GET /api/accounting/sync</code> - Получить все данные</li>
              <li><code className="bg-[#0C0C0C] px-2 py-1 rounded">GET /api/accounting/export/csv</code> - Экспорт в CSV</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-white mb-2">2. Аутентификация:</h3>
            <p>Все запросы должны содержать заголовок:</p>
            <code className="block bg-[#0C0C0C] px-4 py-2 rounded mt-2">
              X-Accounting-API-Key: ваш_api_ключ
            </code>
          </div>
          <div>
            <h3 className="font-semibold text-white mb-2">3. Формат данных:</h3>
            <p>Данные возвращаются в JSON формате и включают:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Платежи (payments) - все транзакции</li>
              <li>Заказы (orders) - все заказы</li>
              <li>Пользователи (users) - все пользователи</li>
              <li>История операций (activityLog) - все операции</li>
              <li>Сводка (summary) - статистика</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

