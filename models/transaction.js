import fs from 'fs'
import path from 'path'

const TRANSACTIONS_FILE = path.join(process.cwd(), 'data', 'transactions.json')

// Загружаем транзакции из файла
export function loadTransactions() {
  try {
    if (!fs.existsSync(TRANSACTIONS_FILE)) {
      return []
    }
    const data = fs.readFileSync(TRANSACTIONS_FILE, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    console.error('[transactions] Error loading transactions:', error?.message)
    return []
  }
}

// Сохраняем транзакции в файл
export function saveTransactions(transactions) {
  try {
    fs.mkdirSync(path.dirname(TRANSACTIONS_FILE), { recursive: true })
    fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify(transactions, null, 2), 'utf8')
    return true
  } catch (error) {
    console.error('[transactions] Error saving transactions:', error?.message)
    return false
  }
}

// Создать транзакцию
export function createTransaction(transactionData) {
  const transactions = loadTransactions()
  
  const transaction = {
    id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: transactionData.type, // 'purchase', 'deposit', 'withdrawal'
    status: transactionData.status || 'pending', // 'pending', 'completed', 'failed', 'cancelled'
    buyerId: transactionData.buyerId || null,
    itemId: transactionData.itemId || null,
    itemType: transactionData.itemType || 'game', // 'game', etc.
    itemName: transactionData.itemName || null,
    amount: transactionData.amount || 0, // Полная сумма
    fee: transactionData.fee || 0, // Комиссия платформы
    buyerFee: transactionData.buyerFee || 0, // Комиссия покупателя
    vat: transactionData.vat || 0, // НДС (20% для РФ)
    vatRate: transactionData.vatRate || 0.20, // Ставка НДС (20%)
    currency: transactionData.currency || 'RUB',
    receiptId: null, // Будет заполнено после генерации чека
    paymentMethod: transactionData.paymentMethod || 'balance', // 'balance', 'card', 'steam'
    metadata: transactionData.metadata || {},
    createdAt: new Date().toISOString(),
    completedAt: transactionData.completedAt || null,
    cancelledAt: transactionData.cancelledAt || null,
    emailSent: false
  }

  transactions.push(transaction)
  saveTransactions(transactions)
  
  return transaction
}

// Обновить транзакцию
export function updateTransaction(transactionId, updates) {
  const transactions = loadTransactions()
  const index = transactions.findIndex(t => t.id === transactionId)
  
  if (index < 0) {
    return null
  }

  transactions[index] = {
    ...transactions[index],
    ...updates,
    updatedAt: new Date().toISOString()
  }

  saveTransactions(transactions)
  return transactions[index]
}

// Получить транзакции пользователя
export function getUserTransactions(userId, options = {}) {
  const transactions = loadTransactions()
  const { type, status, limit = 100 } = options
  
  let filtered = transactions.filter(t => 
    t.buyerId === userId
  )

  if (type) {
    filtered = filtered.filter(t => t.type === type)
  }

  if (status) {
    filtered = filtered.filter(t => t.status === status)
  }

  // Сортируем по дате создания (новые сначала)
  filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  return filtered.slice(0, limit)
}

// Получить транзакцию по ID
export function getTransactionById(transactionId) {
  const transactions = loadTransactions()
  return transactions.find(t => t.id === transactionId)
}


