import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const DATA_DIR = path.join(process.cwd(), 'data')

// Загрузка данных
function loadUsers() {
  try {
    const file = path.join(DATA_DIR, 'users.json')
    if (!fs.existsSync(file)) return []
    const raw = fs.readFileSync(file, 'utf-8')
    return JSON.parse(raw || '[]')
  } catch {
    return []
  }
}

function loadOrders() {
  try {
    const file = path.join(DATA_DIR, 'orders.json')
    if (!fs.existsSync(file)) return []
    const raw = fs.readFileSync(file, 'utf-8')
    return JSON.parse(raw || '[]')
  } catch {
    return []
  }
}

function loadPayments() {
  try {
    const file = path.join(DATA_DIR, 'payments.json')
    if (!fs.existsSync(file)) return []
    const raw = fs.readFileSync(file, 'utf-8')
    return JSON.parse(raw || '[]')
  } catch {
    return []
  }
}

function loadProducts() {
  try {
    const file = path.join(DATA_DIR, 'products.json')
    if (!fs.existsSync(file)) return []
    const raw = fs.readFileSync(file, 'utf-8')
    return JSON.parse(raw || '[]')
  } catch {
    return []
  }
}

function loadActivityLog() {
  try {
    const file = path.join(DATA_DIR, 'activity_log.json')
    if (!fs.existsSync(file)) return []
    const raw = fs.readFileSync(file, 'utf-8')
    return JSON.parse(raw || '[]')
  } catch {
    return []
  }
}

/**
 * Получить полные бухгалтерские данные для синхронизации
 * @param {Object} options - Опции фильтрации
 * @param {string} options.startDate - Начальная дата (ISO string)
 * @param {string} options.endDate - Конечная дата (ISO string)
 * @param {string} options.site - Название сайта (gamesale.shop или oneshotgame.shop)
 * @returns {Object} Полные бухгалтерские данные
 */
export function getAccountingData(options = {}) {
  const { startDate, endDate, site } = options
  
  const users = loadUsers()
  const orders = loadOrders()
  const payments = loadPayments()
  const products = loadProducts()
  const activityLog = loadActivityLog()
  
  // Фильтрация по датам
  let filteredPayments = payments
  let filteredOrders = orders
  let filteredActivityLog = activityLog
  
  if (startDate || endDate) {
    const start = startDate ? new Date(startDate) : null
    const end = endDate ? new Date(endDate) : null
    
    filteredPayments = payments.filter(p => {
      const date = new Date(p.createdAt || p.date || 0)
      if (start && date < start) return false
      if (end && date > end) return false
      return true
    })
    
    filteredOrders = orders.filter(o => {
      const date = new Date(o.createdAt || o.date || 0)
      if (start && date < start) return false
      if (end && date > end) return false
      return true
    })
    
    filteredActivityLog = activityLog.filter(log => {
      const date = new Date(log.timestamp || log.date || 0)
      if (start && date < start) return false
      if (end && date > end) return false
      return true
    })
  }
  
  // Обогащение данных для бухгалтерии
  const enrichedPayments = filteredPayments.map(payment => {
    const user = users.find(u => u.id === payment.userId || u.email === payment.email)
    const order = orders.find(o => o.id === payment.orderId)
    const productIds = order?.items?.map(item => item.productId).filter(Boolean) || 
                      (payment.productId ? [payment.productId] : []) ||
                      (payment.items ? payment.items.map(i => i.productId || i.id).filter(Boolean) : [])
    
    return {
      // Основные данные платежа
      paymentId: payment.id,
      operationCode: payment.operationCode || payment.id,
      amount: payment.amount || 0,
      currency: payment.currency || 'RUB',
      status: payment.status || 'pending',
      method: payment.method || 'unknown',
      createdAt: payment.createdAt || payment.date || new Date().toISOString(),
      
      // Данные пользователя
      userId: payment.userId || user?.id || null,
      userCode: user?.code || user?.userCode || null,
      email: payment.email || user?.email || null,
      
      // Данные товаров
      productIds: productIds,
      productIdsString: productIds.join(', '),
      
      // Данные заказа
      orderId: order?.id || payment.orderId || null,
      
      // Ссылки
      receiptUrl: payment.receiptUrl || (payment.id ? `/pay/${payment.id}` : null),
      contractUrl: '/copyright-agreement',
      
      // Дополнительные данные
      description: payment.description || order?.description || null,
      metadata: payment.metadata || {}
    }
  })
  
  const enrichedOrders = filteredOrders.map(order => {
    const user = users.find(u => u.id === order.userId || u.email === order.email)
    const payment = payments.find(p => p.orderId === order.id || p.id === order.paymentId)
    
    return {
      orderId: order.id,
      operationCode: order.operationCode || order.id,
      userId: order.userId || user?.id || null,
      userCode: user?.code || user?.userCode || null,
      email: order.email || user?.email || null,
      items: order.items || [],
      total: order.total || 0,
      status: order.status || 'pending',
      createdAt: order.createdAt || order.date || new Date().toISOString(),
      paymentId: payment?.id || order.paymentId || null,
      paymentStatus: payment?.status || null
    }
  })
  
  const enrichedUsers = users.map(user => ({
    userId: user.id,
    userCode: user.code || user.userCode || null,
    email: user.email,
    name: user.name || user.profileName || null,
    createdAt: user.createdAt || user.date || null,
    totalSpent: payments
      .filter(p => p.userId === user.id || p.email === user.email)
      .filter(p => p.status === 'completed' || p.status === 'success')
      .reduce((sum, p) => sum + (p.amount || 0), 0),
    totalOrders: orders.filter(o => o.userId === user.id || o.email === user.email).length
  }))
  
  return {
    site: site || 'gamesale.shop',
    exportedAt: new Date().toISOString(),
    period: {
      startDate: startDate || null,
      endDate: endDate || null
    },
    summary: {
      totalUsers: enrichedUsers.length,
      totalOrders: enrichedOrders.length,
      totalPayments: enrichedPayments.length,
      totalRevenue: enrichedPayments
        .filter(p => p.status === 'completed' || p.status === 'success')
        .reduce((sum, p) => sum + (p.amount || 0), 0),
      totalPending: enrichedPayments
        .filter(p => p.status === 'pending')
        .reduce((sum, p) => sum + (p.amount || 0), 0)
    },
    data: {
      payments: enrichedPayments,
      orders: enrichedOrders,
      users: enrichedUsers,
      activityLog: filteredActivityLog
    }
  }
}

/**
 * Экспорт в CSV формат для бухгалтерии
 * @param {Object} accountingData - Данные из getAccountingData
 * @returns {string} CSV строка
 */
export function exportToCSV(accountingData) {
  const { payments } = accountingData.data
  const headers = [
    'ID пользователя',
    'Код пользователя',
    'ID операции',
    'Код операции',
    'ID товара(ов)',
    'Сумма сделки',
    'Валюта',
    'Почта',
    'Статус',
    'Метод оплаты',
    'Дата создания',
    'Договор',
    'Ссылка на чек',
    'Описание'
  ]
  
  const rows = payments.map(p => [
    p.userId || '',
    p.userCode || '',
    p.paymentId || '',
    p.operationCode || '',
    p.productIdsString || '',
    p.amount || 0,
    p.currency || 'RUB',
    p.email || '',
    p.status || '',
    p.method || '',
    p.createdAt || '',
    p.contractUrl || '',
    p.receiptUrl || '',
    p.description || ''
  ])
  
  const csv = [
    headers.join(','),
    ...rows.map(row => row.map(cell => {
      const str = String(cell || '')
      // Экранируем запятые и кавычки
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }).join(','))
  ].join('\n')
  
  return csv
}

/**
 * Генерация API ключа для синхронизации
 * @returns {string} Случайный API ключ
 */
export function generateApiKey() {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Валидация API ключа
 * @param {string} providedKey - Предоставленный ключ
 * @param {string} storedKey - Сохраненный ключ
 * @returns {boolean}
 */
export function validateApiKey(providedKey, storedKey) {
  if (!providedKey || !storedKey) return false
  try {
    const provided = Buffer.from(providedKey, 'hex')
    const stored = Buffer.from(storedKey, 'hex')
    if (provided.length !== stored.length) return false
    return crypto.timingSafeEqual(provided, stored)
  } catch {
    return false
  }
}

