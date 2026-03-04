// Роуты для управления балансом
import express from 'express'
import { findUserById, updateUserBalance } from '../models/user.js'
import { createTransaction } from '../models/transaction.js'
import { sendTransactionReceiptEmail } from '../services/emailService.js'
import { calculateFeesAndVAT, generateReceiptId } from '../services/receiptService.js'

const router = express.Router()

// Middleware для проверки авторизации
function requireAuth(req, res, next) {
  if (!req.session || !req.session.user || !req.session.user.id) {
    return res.status(401).json({ ok: false, error: 'unauthorized' })
  }
  next()
}

/**
 * GET /api/balance - Получить баланс пользователя
 */
router.get('/', requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id
    const user = findUserById(userId)

    if (!user) {
      return res.status(404).json({ ok: false, error: 'user_not_found' })
    }

    return res.json({
      ok: true,
      balance: user.balance || 0,
      currency: user.currency || 'RUB'
    })
  } catch (error) {
    console.error('[balance] Get balance error:', error?.message)
    return res.status(500).json({ ok: false, error: 'fetch_failed' })
  }
})

/**
 * POST /api/balance/deposit - Пополнить баланс (создает платеж через систему платежей)
 */
router.post('/deposit', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id
    const { amount, paymentMethod = 'card' } = req.body

    if (!amount || amount <= 0) {
      return res.status(400).json({ ok: false, error: 'invalid_amount' })
    }

    const user = findUserById(userId)
    if (!user) {
      return res.status(404).json({ ok: false, error: 'user_not_found' })
    }

    // Создаем платеж через систему платежей
    const { createPayment, generatePaymentDeeplink } = await import('../models/payment.js')
    
    const payment = createPayment({
      userId,
      userEmail: user.email || null,
      userName: user.username || user.displayName || null,
      userPhone: user.phone || null,
      amount: parseFloat(amount),
      description: `Пополнение баланса на ${amount} ${user.currency || 'RUB'}`,
      metadata: {
        type: 'balance_deposit',
        userId,
        currency: user.currency || 'RUB'
      }
    })

    // Генерируем deeplink
    const deeplink = generatePaymentDeeplink(payment.id)

    // Отправляем уведомление администратору
    try {
      const { sendPaymentNotificationToAdmin } = await import('../services/paymentNotificationService.js')
      await sendPaymentNotificationToAdmin(payment, 'new_payment')
    } catch (error) {
      console.warn('[balance] Failed to send admin notification:', error?.message)
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
        deeplink: deeplink
      }
    })
  } catch (error) {
    console.error('[balance] Deposit error:', error?.message)
    return res.status(500).json({ ok: false, error: error.message || 'deposit_failed' })
  }
})

/**
 * GET /api/balance/transactions - История транзакций баланса
 */
router.get('/transactions', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id
    const { type, limit = 50 } = req.query

    const { getUserTransactions } = await import('../models/transaction.js')
    const transactions = getUserTransactions(userId, {
      type: type || null,
      limit: parseInt(limit) || 50
    })

    return res.json({
      ok: true,
      transactions
    })
  } catch (error) {
    console.error('[balance] Get transactions error:', error?.message)
    return res.status(500).json({ ok: false, error: 'fetch_failed' })
  }
})

export default router

