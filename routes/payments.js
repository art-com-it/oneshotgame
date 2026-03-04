// Роуты для платежей и deeplinks
import express from 'express'
import { 
  createPayment, 
  updatePayment, 
  getPaymentById, 
  getUserPayments,
  generatePaymentDeeplink,
  checkPaymentStatus,
  loadCompanyConfig,
  saveCompanyConfig,
  loadPayments
} from '../models/payment.js'
import { findUserById } from '../models/user.js'
import { calculateFeesAndVAT } from '../services/receiptService.js'
import { 
  exportPaymentsToCSV, 
  exportPaymentsToJSON, 
  exportPaymentsToHTML,
  filterPaymentsByPeriod 
} from '../services/exportService.js'
import { 
  sendPaymentReceiptToCustomer,
  sendPaymentNotificationToAdmin 
} from '../services/paymentNotificationService.js'
import { verifyYandexCaptcha } from '../services/yandexCaptchaService.js'

// Глобальное логирование для отладки
console.log('='.repeat(80))
console.log('[payments] Модуль платежей загружен')
console.log('[payments] Готов к обработке запросов')
console.log('='.repeat(80))

const router = express.Router()

// Middleware для проверки авторизации
function requireAuth(req, res, next) {
  if (!req.session || !req.session.user || !req.session.user.id) {
    return res.status(401).json({ ok: false, error: 'unauthorized' })
  }
  next()
}

/**
 * POST /api/payments/create - Создать платеж
 * 
 * Body:
 * {
 *   "amount": 1000,           // Сумма с НДС
 *   "vatRate": 0.20,          // Ставка НДС (опционально, по умолчанию 0.20)
 *   "currency": "RUB",        // Валюта (опционально, по умолчанию RUB)
 *   "description": "Оплата за товар",
 *   "userEmail": "user@example.com",  // Опционально, если не указан - берется из сессии
 *   "userName": "Иван Иванов",         // Опционально
 *   "userPhone": "+79001234567",       // Опционально
 *   "returnUrl": "https://gamesale.shop/thanks",
 *   "notifyUrl": "https://gamesale.shop/api/payments/webhook",
 *   "metadata": {} // Дополнительные данные
 * }
 */
router.post('/create', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id
    const user = findUserById(userId)
    
    const {
      amount,
      vatRate = 0.20,
      currency = 'RUB',
      description = '',
      userEmail,
      userName,
      userPhone,
      returnUrl,
      notifyUrl,
      metadata = {}
    } = req.body

    if (!amount || amount <= 0) {
      return res.status(400).json({ ok: false, error: 'invalid_amount' })
    }

    // Создаем платеж
    const payment = createPayment({
      userId,
      userEmail: userEmail || user?.email || null,
      userName: userName || user?.username || user?.displayName || null,
      userPhone: userPhone || user?.phone || null,
      amount: parseFloat(amount),
      vatRate: parseFloat(vatRate) || 0.20,
      currency: currency || 'RUB',
      description: description || '',
      returnUrl: returnUrl || null,
      notifyUrl: notifyUrl || null,
      metadata: {
        ...metadata,
        userId,
        userAgent: req.headers['user-agent'] || null,
        ip: req.ip || req.connection?.remoteAddress || null
      }
    })

    // Генерируем deeplink
    const deeplink = generatePaymentDeeplink(payment.id)

    // Отправляем уведомление администратору о новом платеже
    try {
      await sendPaymentNotificationToAdmin(payment, 'new_payment')
    } catch (error) {
      console.warn('[payments] Failed to send admin notification:', error?.message)
    }

    return res.json({
      ok: true,
      payment: {
        id: payment.id,
        transactionId: payment.transactionId,
        amount: payment.amount,
        amountWithoutVAT: payment.amountWithoutVAT,
        vat: payment.vat,
        vatRate: payment.vatRate,
        currency: payment.currency,
        status: payment.status,
        deeplink: deeplink,
        createdAt: payment.createdAt,
        company: payment.company
      }
    })
  } catch (error) {
    console.error('[payments] Create payment error:', error?.message)
    return res.status(500).json({ ok: false, error: error.message || 'payment_creation_failed' })
  }
})

/**
 * POST /api/payments/create-steam-topup - Создать платеж для пополнения Steam
 * 
 * Body:
 * {
 *   "amount": 1000,        // Сумма с НДС
 *   "steamId": "STEAM_0:1:12345678",  // Steam ID пользователя
 *   "userEmail": "user@example.com",   // Email пользователя
 *   "userName": "Иван Иванов",         // Имя пользователя
 *   "captchaToken": "..."              // Токен капчи
 * }
 */
router.post('/create-steam-topup', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id
    const user = findUserById(userId)
    const { amount, steamId, userEmail, userName, captchaToken } = req.body

    if (!amount || amount <= 0) {
      return res.status(400).json({ ok: false, error: 'invalid_amount' })
    }

    if (amount < 100) {
      return res.status(400).json({ ok: false, error: 'amount_too_low', message: 'Минимальная сумма пополнения: 100 ₽' })
    }

    if (amount > 50000) {
      return res.status(400).json({ ok: false, error: 'amount_too_high', message: 'Максимальная сумма пополнения: 50,000 ₽' })
    }

    if (!steamId || !steamId.trim()) {
      return res.status(400).json({ ok: false, error: 'steam_id_required', message: 'Пожалуйста, укажите ваш Steam ID' })
    }

    // Проверка Яндекс Капчи (обязательна)
    if (!captchaToken) {
      return res.status(400).json({ 
        ok: false, 
        error: 'captcha_required',
        message: 'Пожалуйста, пройдите проверку капчи'
      })
    }
    
    const captchaResult = await verifyYandexCaptcha(captchaToken, req.ip)
    if (!captchaResult.success) {
      console.warn('[payments] Captcha verification failed:', captchaResult.error)
      return res.status(400).json({ 
        ok: false, 
        error: 'captcha_verification_failed',
        message: 'Проверка капчи не пройдена. Пожалуйста, попробуйте еще раз.'
      })
    }

    // Приоритет: email из запроса > email пользователя из сессии
    const finalEmail = userEmail || user?.email || null
    const finalName = userName || user?.username || user?.displayName || null

    const payment = createPayment({
      userId,
      userEmail: finalEmail,
      userName: finalName,
      userPhone: user?.phone || null,
      amount: parseFloat(amount),
      description: `Пополнение Steam кошелька на ${amount} ₽`,
      metadata: {
        userId,
        createdBy: 'steam-topup',
        emailProvided: !!userEmail,
        steamId: steamId.trim(),
        serviceType: 'steam_wallet_topup'
      }
    })

    const deeplink = generatePaymentDeeplink(payment.id)

    // Отправляем уведомление администратору о новом платеже
    try {
      await sendPaymentNotificationToAdmin(payment, 'new_payment')
    } catch (error) {
      console.warn('[payments] Failed to send admin notification:', error?.message)
    }

    // Отправляем email пользователю о создании платежа (если указан email)
    if (finalEmail) {
      try {
        await sendPaymentReceiptToCustomer(payment)
        console.log('[payments] Steam top-up payment receipt email sent to:', finalEmail)
      } catch (error) {
        console.warn('[payments] Failed to send payment receipt email:', error?.message)
      }
    }

    return res.json({
      ok: true,
      payment: {
        id: payment.id,
        transactionId: payment.transactionId,
        amount: payment.amount,
        amountWithoutVAT: payment.amountWithoutVAT,
        vat: payment.vat,
        vatRate: payment.vatRate,
        currency: payment.currency,
        status: payment.status,
        deeplink: deeplink,
        createdAt: payment.createdAt
      }
    })
  } catch (error) {
    console.error('[payments] Create Steam top-up payment error:', error?.message)
    return res.status(500).json({ ok: false, error: error.message || 'payment_creation_failed' })
  }
})

/**
 * POST /api/payments/create-by-amount - Создать платеж по сумме (простой вариант)
 * 
 * Body:
 * {
 *   "amount": 1000  // Сумма с НДС
 * }
 */
router.post('/create-by-amount', async (req, res) => {
  console.log('\n' + '='.repeat(80))
  console.log('[payments/create-by-amount] 🚀 НОВЫЙ ЗАПРОС НА СОЗДАНИЕ ПЛАТЕЖА')
  console.log('[payments/create-by-amount] Request received')
  console.log('[payments/create-by-amount] Body:', {
    amount: req.body.amount,
    userEmail: req.body.userEmail,
    userName: req.body.userName,
    captchaToken: req.body.captchaToken ? 'present' : 'missing',
    hasSteamId: !!req.body.steamId
  })
  console.log('[payments/create-by-amount] IP:', req.ip || req.connection.remoteAddress)
  console.log('='.repeat(80) + '\n')
  
  try {
    // userId опционален - если пользователь авторизован, используем его ID
    const userId = req.session?.user?.id || null
    const user = userId ? findUserById(userId) : null
    const { amount, userEmail, userName, captchaToken } = req.body

    console.log('[payments/create-by-amount] User ID:', userId)
    console.log('[payments/create-by-amount] Amount:', amount)

    if (!amount || amount <= 0) {
      console.error('[payments/create-by-amount] Invalid amount:', amount)
      return res.status(400).json({ ok: false, error: 'invalid_amount' })
    }

    // Проверка Яндекс Капчи (обязательна)
    if (!captchaToken) {
      console.error('[payments/create-by-amount] Captcha token missing!')
      return res.status(400).json({ 
        ok: false, 
        error: 'captcha_required',
        message: 'Пожалуйста, пройдите проверку капчи'
      })
    }
    
    console.log('[payments/create-by-amount] Verifying captcha...')
    const captchaResult = await verifyYandexCaptcha(captchaToken, req.ip)
    console.log('[payments/create-by-amount] Captcha verification result:', captchaResult)
    
    if (!captchaResult.success) {
      console.error('[payments/create-by-amount] Captcha verification failed:', captchaResult.error)
      return res.status(400).json({ 
        ok: false, 
        error: 'captcha_verification_failed',
        message: 'Проверка капчи не пройдена. Пожалуйста, попробуйте еще раз.'
      })
    }
    
    console.log('[payments/create-by-amount] Captcha verified successfully')

    // Приоритет: email из запроса > email пользователя из сессии
    const finalEmail = userEmail || user?.email || null
    const finalName = userName || user?.username || user?.displayName || null

    const payment = createPayment({
      userId: userId || null, // userId может быть null для неавторизованных пользователей
      userEmail: finalEmail,
      userName: finalName,
      userPhone: user?.phone || null,
      amount: parseFloat(amount),
      description: `Оплата на сумму ${amount} ${user?.currency || 'RUB'}`,
      metadata: {
        userId: userId || null,
        createdBy: 'simple-amount',
        emailProvided: !!userEmail,
        isGuest: !userId // Флаг, что платеж создан гостем
      }
    })

    const deeplink = generatePaymentDeeplink(payment.id)

    // Отправляем уведомление администратору о новом платеже
    try {
      await sendPaymentNotificationToAdmin(payment, 'new_payment')
    } catch (error) {
      console.warn('[payments] Failed to send admin notification:', error?.message)
    }

    // Отправляем email пользователю о создании платежа (если указан email)
    console.log('[payments/create-by-amount] Final email:', finalEmail)
    if (finalEmail) {
      console.log('[payments/create-by-amount] Attempting to send receipt email to:', finalEmail)
      try {
        const emailResult = await sendPaymentReceiptToCustomer(payment)
        console.log('[payments/create-by-amount] Email send result:', emailResult)
        if (emailResult.success) {
          console.log('[payments/create-by-amount] ✅ Payment receipt email sent successfully to:', finalEmail)
        } else {
          console.error('[payments/create-by-amount] ❌ Email send failed:', emailResult.error)
        }
      } catch (error) {
        console.error('[payments/create-by-amount] ❌ Exception sending email:', error?.message)
        console.error('[payments/create-by-amount] Error stack:', error?.stack)
        // Не прерываем процесс, если email не отправился
      }
    } else {
      console.warn('[payments/create-by-amount] ⚠️ No email provided, skipping receipt email')
    }

    console.log('\n' + '='.repeat(80))
    console.log('[payments/create-by-amount] ✅ ПЛАТЕЖ УСПЕШНО СОЗДАН')
    console.log('[payments/create-by-amount] Payment ID:', payment.id)
    console.log('[payments/create-by-amount] Amount:', payment.amount, payment.currency)
    console.log('[payments/create-by-amount] Email:', finalEmail)
    console.log('='.repeat(80) + '\n')

    return res.json({
      ok: true,
      payment: {
        id: payment.id,
        transactionId: payment.transactionId,
        amount: payment.amount,
        amountWithoutVAT: payment.amountWithoutVAT,
        vat: payment.vat,
        vatRate: payment.vatRate,
        currency: payment.currency,
        status: payment.status,
        deeplink: deeplink,
        createdAt: payment.createdAt
      }
    })
  } catch (error) {
    console.error('\n' + '='.repeat(80))
    console.error('[payments/create-by-amount] ❌ ОШИБКА ПРИ СОЗДАНИИ ПЛАТЕЖА')
    console.error('[payments] Create payment by amount error:', error?.message)
    console.error('[payments] Error stack:', error?.stack)
    console.error('='.repeat(80) + '\n')
    return res.status(500).json({ ok: false, error: error.message || 'payment_creation_failed' })
  }
})

/**
 * GET /api/payments/:id - Получить информацию о платеже
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const payment = getPaymentById(id)

    if (!payment) {
      return res.status(404).json({ ok: false, error: 'payment_not_found' })
    }

    // Проверяем права доступа (только владелец или admin)
    const isOwner = req.session?.user?.id === payment.userId
    const isAdmin = req.session?.user?.role === 'admin'

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ ok: false, error: 'forbidden' })
    }

    return res.json({
      ok: true,
      payment: {
        id: payment.id,
        transactionId: payment.transactionId,
        userId: payment.userId,
        userEmail: payment.userEmail,
        userName: payment.userName,
        userPhone: payment.userPhone,
        amount: payment.amount,
        amountWithoutVAT: payment.amountWithoutVAT,
        vat: payment.vat,
        vatRate: payment.vatRate,
        currency: payment.currency,
        description: payment.description,
        status: payment.status,
        deeplink: payment.deeplink,
        company: payment.company,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
        paidAt: payment.paidAt,
        paymentMethod: payment.paymentMethod,
        receiptId: payment.receiptId
      }
    })
  } catch (error) {
    console.error('[payments] Get payment error:', error?.message)
    return res.status(500).json({ ok: false, error: 'fetch_failed' })
  }
})

/**
 * GET /api/payments/:id/status - Получить статус платежа
 */
router.get('/:id/status', async (req, res) => {
  try {
    const { id } = req.params
    const status = checkPaymentStatus(id)

    if (!status) {
      return res.status(404).json({ ok: false, error: 'payment_not_found' })
    }

    return res.json({
      ok: true,
      ...status
    })
  } catch (error) {
    console.error('[payments] Get payment status error:', error?.message)
    return res.status(500).json({ ok: false, error: 'fetch_failed' })
  }
})

/**
 * GET /api/payments - Получить список платежей пользователя
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id
    const { status, limit = 50, offset = 0 } = req.query

    const result = getUserPayments(userId, {
      status: status || null,
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0
    })

    return res.json({
      ok: true,
      ...result
    })
  } catch (error) {
    console.error('[payments] Get payments error:', error?.message)
    return res.status(500).json({ ok: false, error: 'fetch_failed' })
  }
})

/**
 * POST /api/payments/:id/update-status - Обновить статус платежа (для webhook'ов)
 */
router.post('/:id/update-status', async (req, res) => {
  try {
    const { id } = req.params
    const { status, paymentMethod, paymentProvider, acquirerData, receiptId } = req.body

    const payment = getPaymentById(id)
    if (!payment) {
      return res.status(404).json({ ok: false, error: 'payment_not_found' })
    }

    const updates = {
      status: status || payment.status,
      updatedAt: new Date().toISOString()
    }

    const wasCompleted = payment.status === 'completed'
    const isNowCompleted = (status || payment.status) === 'completed'

    if (isNowCompleted && !payment.paidAt) {
      updates.paidAt = new Date().toISOString()
      
      // Генерируем receiptId если его нет
      if (!receiptId && !payment.receiptId) {
        const { generateReceiptId } = await import('../services/receiptService.js')
        updates.receiptId = generateReceiptId()
      }
    }

    if (paymentMethod) {
      updates.paymentMethod = paymentMethod
    }

    if (paymentProvider) {
      updates.paymentProvider = paymentProvider
    }

    if (acquirerData) {
      updates.acquirerData = acquirerData
    }

    if (receiptId) {
      updates.receiptId = receiptId
    }

    const updatedPayment = updatePayment(id, updates)

    // Если платеж только что завершился - отправляем чек и уведомление
    if (isNowCompleted && !wasCompleted) {
      try {
        // Отправляем чек покупателю
        await sendPaymentReceiptToCustomer(updatedPayment)
        
        // Отправляем уведомление администратору о завершении платежа
        await sendPaymentNotificationToAdmin(updatedPayment, 'payment_completed')
      } catch (error) {
        console.warn('[payments] Failed to send notifications:', error?.message)
      }
    }

    return res.json({
      ok: true,
      payment: {
        id: updatedPayment.id,
        transactionId: updatedPayment.transactionId,
        status: updatedPayment.status,
        paidAt: updatedPayment.paidAt,
        receiptId: updatedPayment.receiptId
      }
    })
  } catch (error) {
    console.error('[payments] Update payment status error:', error?.message)
    return res.status(500).json({ ok: false, error: 'update_failed' })
  }
})

/**
 * GET /api/payments/config/company - Получить данные компании
 */
router.get('/config/company', async (req, res) => {
  try {
    const company = loadCompanyConfig()
    
    // Показываем только публичные данные
    return res.json({
      ok: true,
      company: {
        name: company.name,
        legalName: company.legalName,
        address: company.address,
        phone: company.phone,
        email: company.email,
        website: company.website
      }
    })
  } catch (error) {
    console.error('[payments] Get company config error:', error?.message)
    return res.status(500).json({ ok: false, error: 'fetch_failed' })
  }
})

/**
 * PUT /api/payments/config/company - Обновить данные компании (только для админов)
 */
router.put('/config/company', requireAuth, async (req, res) => {
  try {
    const user = findUserById(req.session.user.id)
    
    if (user.role !== 'admin') {
      return res.status(403).json({ ok: false, error: 'forbidden' })
    }

    const companyData = req.body
    const currentCompany = loadCompanyConfig()
    
    const updatedCompany = {
      ...currentCompany,
      ...companyData,
      updatedAt: new Date().toISOString()
    }

    saveCompanyConfig(updatedCompany)

    return res.json({
      ok: true,
      company: updatedCompany
    })
  } catch (error) {
    console.error('[payments] Update company config error:', error?.message)
    return res.status(500).json({ ok: false, error: 'update_failed' })
  }
})

/**
 * GET /api/payments/export/csv - Выгрузка платежей в CSV за период
 * Query params:
 *   startDate - начало периода (YYYY-MM-DD)
 *   endDate - конец периода (YYYY-MM-DD)
 *   status - фильтр по статусу (опционально)
 */
router.get('/export/csv', requireAuth, async (req, res) => {
  try {
    const user = findUserById(req.session.user.id)
    
    // Проверяем права (только админы)
    if (user.role !== 'admin') {
      return res.status(403).json({ ok: false, error: 'forbidden' })
    }

    const { startDate, endDate, status } = req.query
    
    let payments = loadPayments()

    // Фильтруем по периоду
    if (startDate || endDate) {
      payments = filterPaymentsByPeriod(payments, startDate, endDate)
    }

    // Фильтруем по статусу
    if (status) {
      payments = payments.filter(p => p.status === status)
    }

    // Экспортируем в CSV
    const csv = exportPaymentsToCSV(payments)

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="payments_${startDate || 'all'}_${endDate || 'all'}.csv"`)
    
    return res.send('\ufeff' + csv) // BOM для корректного отображения в Excel
  } catch (error) {
    console.error('[payments] Export CSV error:', error?.message)
    return res.status(500).json({ ok: false, error: 'export_failed' })
  }
})

/**
 * GET /api/payments/export/json - Выгрузка платежей в JSON за период
 */
router.get('/export/json', requireAuth, async (req, res) => {
  try {
    const user = findUserById(req.session.user.id)
    
    if (user.role !== 'admin') {
      return res.status(403).json({ ok: false, error: 'forbidden' })
    }

    const { startDate, endDate, status } = req.query
    
    let payments = loadPayments()

    if (startDate || endDate) {
      payments = filterPaymentsByPeriod(payments, startDate, endDate)
    }

    if (status) {
      payments = payments.filter(p => p.status === status)
    }

    const json = exportPaymentsToJSON(payments, { pretty: true })

    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="payments_${startDate || 'all'}_${endDate || 'all'}.json"`)
    
    return res.send(json)
  } catch (error) {
    console.error('[payments] Export JSON error:', error?.message)
    return res.status(500).json({ ok: false, error: 'export_failed' })
  }
})

/**
 * GET /api/payments/export/html - Выгрузка платежей в HTML за период
 */
router.get('/export/html', requireAuth, async (req, res) => {
  try {
    const user = findUserById(req.session.user.id)
    
    if (user.role !== 'admin') {
      return res.status(403).json({ ok: false, error: 'forbidden' })
    }

    const { startDate, endDate, status } = req.query
    
    let payments = loadPayments()

    if (startDate || endDate) {
      payments = filterPaymentsByPeriod(payments, startDate, endDate)
    }

    if (status) {
      payments = payments.filter(p => p.status === status)
    }

    const title = `Выгрузка платежей ${startDate ? `с ${startDate}` : ''} ${endDate ? `по ${endDate}` : ''}`.trim()
    const html = exportPaymentsToHTML(payments, { title })

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="payments_${startDate || 'all'}_${endDate || 'all'}.html"`)
    
    return res.send(html)
  } catch (error) {
    console.error('[payments] Export HTML error:', error?.message)
    return res.status(500).json({ ok: false, error: 'export_failed' })
  }
})

/**
 * POST /api/payments/:id/complete-manual - Ручное завершение платежа (для покупок через сайт без реального товара)
 */
router.post('/:id/complete-manual', requireAuth, async (req, res) => {
  try {
    const user = findUserById(req.session.user.id)
    
    if (user.role !== 'admin') {
      return res.status(403).json({ ok: false, error: 'forbidden' })
    }

    const { id } = req.params
    const { paymentMethod = 'manual', notes } = req.body

    const payment = getPaymentById(id)
    if (!payment) {
      return res.status(404).json({ ok: false, error: 'payment_not_found' })
    }

    if (payment.status === 'completed') {
      return res.status(400).json({ ok: false, error: 'payment_already_completed' })
    }

    const { generateReceiptId } = await import('../services/receiptService.js')

    const updates = {
      status: 'completed',
      paymentMethod: paymentMethod,
      paidAt: new Date().toISOString(),
      receiptId: payment.receiptId || generateReceiptId(),
      updatedAt: new Date().toISOString(),
      metadata: {
        ...payment.metadata,
        completedManually: true,
        completedBy: user.id,
        completedAt: new Date().toISOString(),
        notes: notes || null
      }
    }

    const updatedPayment = updatePayment(id, updates)

    // Если это пополнение баланса - обновляем баланс пользователя
    if (updatedPayment.metadata?.type === 'balance_deposit' && isNowCompleted && !wasCompleted) {
      try {
        const { updateUserBalance } = await import('../models/user.js')
        updateUserBalance(updatedPayment.userId, updatedPayment.amount, 'add')
        console.log('[payments] Balance updated for user:', updatedPayment.userId, 'amount:', updatedPayment.amount)
      } catch (error) {
        console.error('[payments] Failed to update balance:', error?.message)
      }
    }

    // Отправляем чек покупателю и уведомление администратору
    if (isNowCompleted && !wasCompleted) {
      try {
        await sendPaymentReceiptToCustomer(updatedPayment)
        await sendPaymentNotificationToAdmin(updatedPayment, 'payment_completed')
      } catch (error) {
        console.warn('[payments] Failed to send notifications:', error?.message)
      }
    }

    return res.json({
      ok: true,
      payment: {
        id: updatedPayment.id,
        transactionId: updatedPayment.transactionId,
        status: updatedPayment.status,
        paidAt: updatedPayment.paidAt,
        receiptId: updatedPayment.receiptId
      }
    })
  } catch (error) {
    console.error('[payments] Complete manual error:', error?.message)
    return res.status(500).json({ ok: false, error: 'completion_failed' })
  }
})

/**
 * POST /api/payments/test-email - Тестовый endpoint для проверки отправки уведомлений на почту
 * 
 * Body:
 * {
 *   "email": "test@example.com",  // Email для отправки тестового уведомления
 *   "userName": "Тестовый пользователь"  // Опционально
 * }
 */
router.post('/test-email', async (req, res) => {
  try {
    const { email, userName = 'Тестовый пользователь' } = req.body

    if (!email || !email.includes('@')) {
      return res.status(400).json({ ok: false, error: 'invalid_email' })
    }

    // Импортируем функцию отправки email
    const { sendOrderConfirmationEmail } = await import('../services/emailService.js')

    // Создаем тестовые данные заказа
    const testOrderData = {
      email: email.trim(),
      userName: userName.trim(),
      orderId: `TEST-${Date.now()}`,
      items: [
        {
          name: 'Тестовый товар',
          activationKey: 'TEST-KEY-12345',
          price: 1000
        }
      ],
      totalAmount: 1000,
      currency: 'RUB',
      createdAt: new Date().toISOString()
    }

    // Отправляем тестовое письмо
    const result = await sendOrderConfirmationEmail(testOrderData)

    if (result.success) {
      return res.json({
        ok: true,
        message: 'Тестовое письмо успешно отправлено',
        email: email,
        messageId: result.messageId
      })
    } else {
      return res.status(500).json({
        ok: false,
        error: result.error || 'email_send_failed',
        message: 'Не удалось отправить тестовое письмо'
      })
    }
  } catch (error) {
    console.error('[payments] Test email error:', error?.message)
    return res.status(500).json({ ok: false, error: error.message || 'test_failed' })
  }
})

export default router

