// Сервис для выгрузки данных
import fs from 'fs'
import path from 'path'

/**
 * Экспорт платежей в CSV
 */
export function exportPaymentsToCSV(payments, options = {}) {
  const {
    includeHeaders = true,
    delimiter = ',',
    dateFormat = 'YYYY-MM-DD HH:mm:ss'
  } = options

  if (!payments || payments.length === 0) {
    return includeHeaders ? 'No data' : ''
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toISOString().replace('T', ' ').slice(0, 19)
  }

  const formatAmount = (amount) => {
    return parseFloat(amount || 0).toFixed(2)
  }

  const escapeCSV = (value) => {
    if (value === null || value === undefined) return ''
    const str = String(value)
    if (str.includes(delimiter) || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const headers = [
    'ID платежа',
    'ID сделки',
    'Дата создания',
    'Дата оплаты',
    'Статус',
    'Email пользователя',
    'Имя пользователя',
    'Телефон',
    'Сумма (с НДС)',
    'Сумма (без НДС)',
    'НДС',
    'Ставка НДС',
    'Валюта',
    'Описание',
    'Способ оплаты',
    'ID чека'
  ]

  let csv = ''

  if (includeHeaders) {
    csv += headers.map(escapeCSV).join(delimiter) + '\n'
  }

  payments.forEach(payment => {
    const row = [
      payment.id,
      payment.transactionId,
      formatDate(payment.createdAt),
      formatDate(payment.paidAt),
      payment.status,
      payment.userEmail || '',
      payment.userName || '',
      payment.userPhone || '',
      formatAmount(payment.amount),
      formatAmount(payment.amountWithoutVAT),
      formatAmount(payment.vat),
      `${(payment.vatRate * 100).toFixed(0)}%`,
      payment.currency,
      payment.description || '',
      payment.paymentMethod || '',
      payment.receiptId || ''
    ]
    csv += row.map(escapeCSV).join(delimiter) + '\n'
  })

  return csv
}

/**
 * Экспорт платежей в JSON
 */
export function exportPaymentsToJSON(payments, options = {}) {
  const { pretty = true } = options
  
  if (pretty) {
    return JSON.stringify(payments, null, 2)
  }
  return JSON.stringify(payments)
}

/**
 * Экспорт платежей в Excel-подобный формат (HTML таблица)
 */
export function exportPaymentsToHTML(payments, options = {}) {
  const { title = 'Выгрузка платежей' } = options

  if (!payments || payments.length === 0) {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title></head><body><p>Нет данных</p></body></html>`
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleString('ru-RU')
  }

  const formatAmount = (amount) => {
    return parseFloat(amount || 0).toFixed(2)
  }

  const escapeHtml = (text) => {
    if (text === null || text === undefined) return ''
    const str = String(text)
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  let html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 {
      color: #333;
      margin-bottom: 20px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 12px;
      text-align: left;
    }
    th {
      background-color: #667eea;
      color: white;
      font-weight: bold;
    }
    tr:nth-child(even) {
      background-color: #f9fafb;
    }
    tr:hover {
      background-color: #f3f4f6;
    }
    .status-completed { color: #10b981; font-weight: bold; }
    .status-pending { color: #f59e0b; font-weight: bold; }
    .status-failed { color: #ef4444; font-weight: bold; }
    .summary {
      margin-top: 20px;
      padding: 15px;
      background-color: #eff6ff;
      border-left: 4px solid #2563eb;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${escapeHtml(title)}</h1>
    <p>Дата выгрузки: ${new Date().toLocaleString('ru-RU')}</p>
    <p>Всего записей: ${payments.length}</p>
    
    <table>
      <thead>
        <tr>
          <th>ID платежа</th>
          <th>ID сделки</th>
          <th>Дата создания</th>
          <th>Дата оплаты</th>
          <th>Статус</th>
          <th>Email</th>
          <th>Имя</th>
          <th>Телефон</th>
          <th>Сумма (с НДС)</th>
          <th>Сумма (без НДС)</th>
          <th>НДС</th>
          <th>Валюта</th>
          <th>Описание</th>
        </tr>
      </thead>
      <tbody>
`

  payments.forEach(payment => {
    const statusClass = `status-${payment.status}`
    html += `
        <tr>
          <td>${escapeHtml(payment.id)}</td>
          <td>${escapeHtml(payment.transactionId)}</td>
          <td>${formatDate(payment.createdAt)}</td>
          <td>${formatDate(payment.paidAt)}</td>
          <td class="${statusClass}">${escapeHtml(payment.status)}</td>
          <td>${escapeHtml(payment.userEmail || '')}</td>
          <td>${escapeHtml(payment.userName || '')}</td>
          <td>${escapeHtml(payment.userPhone || '')}</td>
          <td>${formatAmount(payment.amount)}</td>
          <td>${formatAmount(payment.amountWithoutVAT)}</td>
          <td>${formatAmount(payment.vat)}</td>
          <td>${escapeHtml(payment.currency)}</td>
          <td>${escapeHtml(payment.description || '')}</td>
        </tr>
    `
  })

  // Подсчет итогов
  const totalAmount = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
  const totalVAT = payments.reduce((sum, p) => sum + (parseFloat(p.vat) || 0), 0)
  const totalWithoutVAT = payments.reduce((sum, p) => sum + (parseFloat(p.amountWithoutVAT) || 0), 0)
  const completedCount = payments.filter(p => p.status === 'completed').length

  html += `
      </tbody>
    </table>
    
    <div class="summary">
      <h3>Итоги:</h3>
      <p><strong>Всего платежей:</strong> ${payments.length}</p>
      <p><strong>Оплачено:</strong> ${completedCount}</p>
      <p><strong>Общая сумма (с НДС):</strong> ${formatAmount(totalAmount)} ${payments[0]?.currency || 'RUB'}</p>
      <p><strong>Общая сумма (без НДС):</strong> ${formatAmount(totalWithoutVAT)} ${payments[0]?.currency || 'RUB'}</p>
      <p><strong>Общий НДС:</strong> ${formatAmount(totalVAT)} ${payments[0]?.currency || 'RUB'}</p>
    </div>
  </div>
</body>
</html>
  `

  return html
}

/**
 * Фильтрация платежей по периоду
 */
export function filterPaymentsByPeriod(payments, startDate, endDate) {
  if (!startDate && !endDate) {
    return payments
  }

  return payments.filter(payment => {
    const paymentDate = new Date(payment.createdAt)
    
    if (startDate && paymentDate < new Date(startDate)) {
      return false
    }
    
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999) // До конца дня
      if (paymentDate > end) {
        return false
      }
    }
    
    return true
  })
}





