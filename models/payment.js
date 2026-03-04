import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const PAYMENTS_FILE = path.join(process.cwd(), 'data', 'payments.json')
const COMPANY_CONFIG_FILE = path.join(process.cwd(), 'data', 'company.json')

// Данные компании (по умолчанию)
const DEFAULT_COMPANY = {
  name: 'GameSale',
  legalName: 'ООО "GameSale"',
  inn: '',
  kpp: '',
  ogrn: '',
  address: '',
  phone: '',
  email: 'info@gamesale.shop',
  website: 'https://gamesale.shop',
  bankAccount: '',
  bankName: '',
  bik: '',
  correspondentAccount: ''
}

// Загружаем конфигурацию компании
export function loadCompanyConfig() {
  try {
    if (!fs.existsSync(COMPANY_CONFIG_FILE)) {
      saveCompanyConfig(DEFAULT_COMPANY)
      return DEFAULT_COMPANY
    }
    const data = fs.readFileSync(COMPANY_CONFIG_FILE, 'utf8')
    const company = JSON.parse(data)
    return { ...DEFAULT_COMPANY, ...company }
  } catch (error) {
    console.error('[company] Error loading company config:', error?.message)
    return DEFAULT_COMPANY
  }
}

// Сохраняем конфигурацию компании
export function saveCompanyConfig(company) {
  try {
    fs.mkdirSync(path.dirname(COMPANY_CONFIG_FILE), { recursive: true })
    fs.writeFileSync(COMPANY_CONFIG_FILE, JSON.stringify(company, null, 2), 'utf8')
    return true
  } catch (error) {
    console.error('[company] Error saving company config:', error?.message)
    return false
  }
}

// Загружаем платежи
export function loadPayments() {
  try {
    if (!fs.existsSync(PAYMENTS_FILE)) {
      return []
    }
    const data = fs.readFileSync(PAYMENTS_FILE, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    console.error('[payments] Error loading payments:', error?.message)
    return []
  }
}

// Сохраняем платежи
export function savePayments(payments) {
  try {
    fs.mkdirSync(path.dirname(PAYMENTS_FILE), { recursive: true })
    fs.writeFileSync(PAYMENTS_FILE, JSON.stringify(payments, null, 2), 'utf8')
    return true
  } catch (error) {
    console.error('[payments] Error saving payments:', error?.message)
    return false
  }
}

// Создать платеж
export function createPayment(paymentData) {
  const payments = loadPayments()
  
  const paymentId = `pay_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
  
  const {
    userId,
    userEmail,
    userName,
    userPhone,
    amount,
    vatRate = 0.20, // 20% НДС по умолчанию
    currency = 'RUB',
    description = '',
    metadata = {},
    returnUrl = null,
    notifyUrl = null
  } = paymentData

  // Рассчитываем НДС
  const amountWithoutVAT = amount / (1 + vatRate)
  const vat = amount - amountWithoutVAT
  
  const company = loadCompanyConfig()

  const payment = {
    id: paymentId,
    transactionId: paymentId, // ID сделки
    userId: userId || null,
    userEmail: userEmail || null,
    userName: userName || null,
    userPhone: userPhone || null,
    
    // Суммы
    amount: parseFloat(amount), // Общая сумма с НДС
    amountWithoutVAT: parseFloat(amountWithoutVAT.toFixed(2)), // Сумма без НДС
    vat: parseFloat(vat.toFixed(2)), // НДС
    vatRate: vatRate, // Ставка НДС (0.20 = 20%)
    currency: currency || 'RUB',
    
    // Описание
    description: description || '',
    
    // Данные компании
    company: {
      name: company.name,
      legalName: company.legalName,
      inn: company.inn,
      kpp: company.kpp,
      ogrn: company.ogrn,
      address: company.address,
      phone: company.phone,
      email: company.email,
      website: company.website,
      bankAccount: company.bankAccount,
      bankName: company.bankName,
      bik: company.bik,
      correspondentAccount: company.correspondentAccount
    },
    
    // Статус и данные платежа
    status: 'pending', // 'pending', 'processing', 'completed', 'failed', 'cancelled'
    paymentMethod: null, // Будет заполнено при оплате
    paymentProvider: null, // Будет заполнено при подключении эквайринга
    
    // Ссылки
    deeplink: null, // Deeplink для оплаты (будет создан)
    returnUrl: returnUrl || null,
    notifyUrl: notifyUrl || null,
    
    // Временные метки
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    paidAt: null,
    expiredAt: null,
    
    // Метаданные
    metadata: {
      ...metadata,
      createdBy: userId || 'system'
    },
    
    // Данные эквайринга (пока не подключен)
    acquirerData: null,
    receiptId: null
  }

  payments.push(payment)
  savePayments(payments)
  
  return payment
}

// Обновить платеж
export function updatePayment(paymentId, updates) {
  const payments = loadPayments()
  const index = payments.findIndex(p => p.id === paymentId || p.transactionId === paymentId)
  
  if (index < 0) {
    return null
  }

  payments[index] = {
    ...payments[index],
    ...updates,
    updatedAt: new Date().toISOString()
  }

  savePayments(payments)
  return payments[index]
}

// Получить платеж по ID
export function getPaymentById(paymentId) {
  const payments = loadPayments()
  return payments.find(p => p.id === paymentId || p.transactionId === paymentId)
}

// Получить платежи пользователя
export function getUserPayments(userId, options = {}) {
  const payments = loadPayments()
  const { status, limit = 100, offset = 0 } = options
  
  let filtered = payments.filter(p => p.userId === userId)

  if (status) {
    filtered = filtered.filter(p => p.status === status)
  }

  // Сортируем по дате создания (новые сначала)
  filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  return {
    items: filtered.slice(offset, offset + limit),
    total: filtered.length,
    limit,
    offset
  }
}

// Генерация deeplink для оплаты
export function generatePaymentDeeplink(paymentId, baseUrl = null) {
  const payment = getPaymentById(paymentId)
  if (!payment) {
    throw new Error('Payment not found')
  }

  const frontendUrl = baseUrl || process.env.FRONTEND_URL || 'https://gamesale.shop'
  const deeplink = `${frontendUrl}/pay/${paymentId}`

  // Обновляем платеж с deeplink
  updatePayment(paymentId, { deeplink })

  return deeplink
}

// Проверка статуса платежа
export function checkPaymentStatus(paymentId) {
  const payment = getPaymentById(paymentId)
  if (!payment) {
    return null
  }

  return {
    id: payment.id,
    transactionId: payment.transactionId,
    status: payment.status,
    amount: payment.amount,
    currency: payment.currency,
    createdAt: payment.createdAt,
    paidAt: payment.paidAt
  }
}





