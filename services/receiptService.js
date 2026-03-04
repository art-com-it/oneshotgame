// Сервис для генерации чеков с НДС
import crypto from 'crypto'

const VAT_RATE = 0.20 // 20% НДС для РФ
const SELLER_FEE_RATE = 0.05 // 5% комиссия для продавца (Steam-style)
const BUYER_FEE_RATE = 0.10 // 10% комиссия для покупателя (Steam-style)

/**
 * Рассчитать НДС и комиссии
 */
export function calculateFeesAndVAT(amount, vatRate = VAT_RATE) {
  // Для продавца: комиссия 5%
  const sellerFee = amount * SELLER_FEE_RATE
  const amountAfterSellerFee = amount - sellerFee
  
  // НДС считается с суммы после вычета комиссии продавца
  const vat = amountAfterSellerFee * vatRate
  const amountBeforeVAT = amountAfterSellerFee - vat
  
  // Для покупателя: комиссия 10%
  const buyerFee = amount * BUYER_FEE_RATE
  const buyerTotal = amount + buyerFee
  
  return {
    originalAmount: amount,
    sellerFee,
    sellerFeeRate: SELLER_FEE_RATE,
    amountAfterSellerFee,
    vat,
    vatRate,
    amountBeforeVAT,
    netAmount: amountBeforeVAT, // Чистая сумма для продавца после всех вычетов
    buyerFee,
    buyerFeeRate: BUYER_FEE_RATE,
    buyerTotal // Общая сумма для покупателя
  }
}

/**
 * Генерация уникального номера чека
 */
export function generateReceiptId() {
  const timestamp = Date.now()
  const random = crypto.randomBytes(4).toString('hex').toUpperCase()
  return `RECEIPT-${timestamp}-${random}`
}

/**
 * Форматирование даты для чека
 */
export function formatReceiptDate(date = new Date()) {
  const d = new Date(date)
  return d.toLocaleString('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

/**
 * Генерация HTML чека
 */
export function generateReceiptHTML(receiptData) {
  const {
    receiptId,
    transactionId,
    date,
    buyerName,
    buyerEmail,
    sellerName,
    sellerEmail,
    itemName,
    itemType = 'skin',
    quantity = 1,
    unitPrice,
    totalAmount,
    vat,
    vatRate,
    fee,
    feeType, // 'seller' или 'buyer'
    netAmount,
    currency = 'RUB',
    paymentMethod = 'balance',
    status = 'completed'
  } = receiptData

  const formattedDate = date || formatReceiptDate()
  const vatPercent = (vatRate * 100).toFixed(0)
  const currencySymbol = currency === 'RUB' ? '₽' : currency === 'USD' ? '$' : currency

  return `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Чек об операции #${receiptId}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #c7d5e0;
      background: linear-gradient(135deg, #1b2838 0%, #16202d 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .receipt-container {
      max-width: 900px;
      margin: 0 auto;
      background: linear-gradient(180deg, #1e2329 0%, #1b2838 100%);
      border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .receipt-header {
      background: linear-gradient(135deg, #171a21 0%, #1b2838 50%, #2a475e 100%);
      padding: 40px 30px;
      text-align: center;
      border-bottom: 2px solid rgba(66, 192, 251, 0.3);
      position: relative;
    }
    .receipt-header::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, transparent, #42c0fb, transparent);
    }
    .receipt-header h1 {
      margin: 0 0 15px 0;
      color: #66c0f4;
      font-size: 32px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 2px;
      text-shadow: 0 2px 10px rgba(102, 192, 244, 0.3);
    }
    .receipt-subtitle {
      color: #8f98a0;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 20px;
    }
    .receipt-id {
      font-size: 20px;
      color: #66c0f4;
      margin: 15px 0;
      font-weight: 600;
      font-family: 'Courier New', monospace;
    }
    .receipt-date {
      color: #c7d5e0;
      font-size: 16px;
      margin-top: 10px;
    }
    .status-badge {
      display: inline-block;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 600;
      margin-left: 15px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .status-completed {
      background: linear-gradient(135deg, #5c7e10 0%, #4a6b0a 100%);
      color: #beee11;
      box-shadow: 0 0 10px rgba(190, 238, 17, 0.3);
    }
    .status-pending {
      background: linear-gradient(135deg, #a46a0f 0%, #8b5a0a 100%);
      color: #ffb838;
      box-shadow: 0 0 10px rgba(255, 184, 56, 0.3);
    }
    .receipt-content {
      padding: 30px;
    }
    .receipt-section {
      margin-bottom: 30px;
      background: rgba(23, 26, 33, 0.5);
      border-radius: 6px;
      padding: 20px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
    .receipt-section h2 {
      font-size: 18px;
      color: #66c0f4;
      border-bottom: 2px solid rgba(102, 192, 244, 0.3);
      padding-bottom: 10px;
      margin-bottom: 15px;
      text-transform: uppercase;
      letter-spacing: 1px;
      font-weight: 600;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .info-label {
      color: #8f98a0;
      font-weight: 500;
      font-size: 14px;
    }
    .info-value {
      color: #c7d5e0;
      font-weight: 600;
      font-size: 14px;
      text-align: right;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
      background: rgba(23, 26, 33, 0.3);
      border-radius: 4px;
      overflow: hidden;
    }
    .items-table th {
      background: linear-gradient(135deg, #1b2838 0%, #2a475e 100%);
      padding: 15px;
      text-align: left;
      font-weight: 600;
      color: #66c0f4;
      border-bottom: 2px solid rgba(102, 192, 244, 0.3);
      text-transform: uppercase;
      font-size: 12px;
      letter-spacing: 1px;
    }
    .items-table td {
      padding: 15px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      color: #c7d5e0;
    }
    .items-table tr:last-child td {
      border-bottom: none;
    }
    .items-table tr:hover {
      background: rgba(102, 192, 244, 0.1);
    }
    .text-right {
      text-align: right;
    }
    .totals {
      background: linear-gradient(135deg, rgba(23, 26, 33, 0.8) 0%, rgba(27, 40, 56, 0.8) 100%);
      padding: 25px;
      border-radius: 6px;
      margin-top: 25px;
      border: 1px solid rgba(102, 192, 244, 0.2);
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      font-size: 15px;
      color: #c7d5e0;
    }
    .total-row.grand-total {
      font-size: 22px;
      font-weight: 700;
      color: #66c0f4;
      border-top: 2px solid rgba(102, 192, 244, 0.3);
      margin-top: 15px;
      padding-top: 20px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .footer {
      margin-top: 30px;
      padding-top: 25px;
      border-top: 2px solid rgba(255, 255, 255, 0.1);
      text-align: center;
      color: #8f98a0;
      font-size: 13px;
      line-height: 1.8;
    }
    .vat-info {
      background: rgba(102, 192, 244, 0.1);
      padding: 20px;
      border-radius: 6px;
      margin-top: 20px;
      border-left: 4px solid #66c0f4;
    }
    .vat-info p {
      margin: 8px 0;
      font-size: 14px;
      color: #c7d5e0;
    }
    .vat-info strong {
      color: #66c0f4;
    }
    .transaction-info {
      background: rgba(23, 26, 33, 0.6);
      padding: 15px;
      border-radius: 4px;
      margin-top: 10px;
      border: 1px solid rgba(102, 192, 244, 0.2);
    }
    .transaction-id {
      font-family: 'Courier New', monospace;
      color: #66c0f4;
      font-size: 16px;
      font-weight: 600;
    }
    @media (max-width: 600px) {
      .receipt-container {
        margin: 10px;
        border-radius: 4px;
      }
      .receipt-header {
        padding: 25px 20px;
      }
      .receipt-header h1 {
        font-size: 24px;
      }
      .receipt-content {
        padding: 20px;
      }
      .info-row {
        flex-direction: column;
        gap: 5px;
      }
      .info-value {
        text-align: left;
      }
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <div class="receipt-header">
      <div class="receipt-subtitle">Чек об операции</div>
      <h1>GameSale</h1>
      <div class="receipt-id">№ ${receiptId}</div>
      <div class="receipt-date">
        ${formattedDate}
        <span class="status-badge status-${status}">${status === 'completed' ? 'Оплачено' : 'В обработке'}</span>
      </div>
    </div>

    <div class="receipt-content">
      <div class="receipt-section">
        <h2>Информация о транзакции</h2>
        <div class="transaction-info">
          <div class="info-row">
            <span class="info-label">ID транзакции:</span>
            <span class="info-value transaction-id">${transactionId}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Способ оплаты:</span>
            <span class="info-value">${paymentMethod === 'balance' ? 'Баланс счета' : paymentMethod === 'card' ? 'Банковская карта' : paymentMethod === 'steam' ? 'Steam Wallet' : 'Онлайн-платеж'}</span>
          </div>
        </div>
      </div>

      <div class="receipt-section">
        <h2>Покупатель</h2>
        <div class="info-row">
          <span class="info-label">Имя:</span>
          <span class="info-value">${buyerName || 'Не указано'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Email:</span>
          <span class="info-value">${buyerEmail || 'Не указано'}</span>
        </div>
      </div>

      <div class="receipt-section">
        <h2>Продавец</h2>
        <div class="info-row">
          <span class="info-label">Название:</span>
          <span class="info-value">${sellerName || 'GameSale'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Email:</span>
          <span class="info-value">${sellerEmail || 'info@gamesale.shop'}</span>
        </div>
      </div>

      <div class="receipt-section">
        <h2>Товар</h2>
        <table class="items-table">
          <thead>
            <tr>
              <th>Наименование</th>
              <th class="text-right">Кол-во</th>
              <th class="text-right">Цена</th>
              <th class="text-right">Сумма</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>${itemName}</strong><br><span style="color: #8f98a0; font-size: 12px;">${itemType}</span></td>
              <td class="text-right">${quantity}</td>
              <td class="text-right">${unitPrice.toFixed(2)} ${currencySymbol}</td>
              <td class="text-right"><strong style="color: #66c0f4;">${totalAmount.toFixed(2)} ${currencySymbol}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="totals">
        <div class="total-row">
          <span>Сумма товара:</span>
          <span><strong>${totalAmount.toFixed(2)} ${currencySymbol}</strong></span>
        </div>
        ${fee > 0 ? `
        <div class="total-row">
          <span>Комиссия платформы ${feeType === 'seller' ? '(продавец)' : '(покупатель)'}:</span>
          <span><strong style="color: #8f98a0;">${fee.toFixed(2)} ${currencySymbol}</strong></span>
        </div>
        ` : ''}
        ${vat > 0 ? `
        <div class="total-row">
          <span>НДС (${vatPercent}%):</span>
          <span><strong style="color: #8f98a0;">${vat.toFixed(2)} ${currencySymbol}</strong></span>
        </div>
        ` : ''}
        <div class="total-row grand-total">
          <span>${feeType === 'seller' ? 'К получению' : 'К оплате'}:</span>
          <span>${netAmount.toFixed(2)} ${currencySymbol}</span>
        </div>
      </div>

      ${vat > 0 ? `
      <div class="vat-info">
        <p><strong>Информация о НДС:</strong></p>
        <p>Сумма без НДС: ${(netAmount - vat).toFixed(2)} ${currencySymbol}</p>
        <p>НДС (${vatPercent}%): ${vat.toFixed(2)} ${currencySymbol}</p>
        <p>Всего к ${feeType === 'seller' ? 'получению' : 'оплате'}: ${netAmount.toFixed(2)} ${currencySymbol}</p>
      </div>
      ` : ''}

      <div class="footer">
        <p><strong>Этот документ является официальным чеком об оплате.</strong></p>
        <p>Сохраните его для отчетности и налогового учета.</p>
        <p style="margin-top: 20px; font-size: 11px; color: #6b7280;">
          Сгенерировано автоматически системой GameSale • ${new Date().getFullYear()}
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim()
}


