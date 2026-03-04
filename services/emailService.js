// Email сервис на базе Gmail SMTP (nodemailer)
import nodemailer from 'nodemailer'
import dotenv from 'dotenv'

// Загружаем переменные окружения
dotenv.config()

// Настройки Gmail SMTP
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com'
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10)
const SMTP_SECURE = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true'
const SMTP_USER = process.env.SMTP_USER || process.env.SMTP_LOGIN || ''
const SMTP_PASS = process.env.SMTP_PASS || process.env.SMTP_PASSWORD || ''
const SMTP_FROM_EMAIL = process.env.SMTP_FROM_EMAIL || SMTP_USER || 'noreply@gmail.com'
const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || 'GameSale'

// Кэш транспорта для переиспользования
let mailTransporter = null

// Функция получения nodemailer транспорта
export function getMailTransporter() {
  // Если транспорт уже создан, возвращаем его
  if (mailTransporter) {
    return mailTransporter
  }
  
  // Проверяем, что настройки есть
  if (!SMTP_USER || !SMTP_PASS) {
    console.warn('[email] Gmail SMTP not configured. Set SMTP_USER and SMTP_PASS (App Password) in .env')
    return null
  }
  
  try {
    mailTransporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE, // true для 465, false для других портов
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      },
      tls: {
        // Не отклонять недействительные сертификаты (для разработки)
        rejectUnauthorized: false,
        ciphers: 'SSLv3'
      },
      connectionTimeout: 10000, // 10 секунд таймаут подключения
      greetingTimeout: 10000, // 10 секунд таймаут приветствия
      socketTimeout: 10000, // 10 секунд таймаут сокета
      debug: true, // Включить отладку
      logger: true // Логировать все операции
    })
    
    console.log('[email] ✅ Gmail SMTP transporter created successfully:', {
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      user: SMTP_USER,
      fromEmail: SMTP_FROM_EMAIL,
      fromName: SMTP_FROM_NAME
    })
    
    // Проверяем соединение при старте
    mailTransporter.verify().then(() => {
      console.log('[email] ✅ Gmail SMTP connection verified successfully')
    }).catch((error) => {
      console.error('[email] ❌ Gmail SMTP connection verification failed:', error?.message)
    })
    
    return mailTransporter
  } catch (error) {
    console.error('[email] Failed to create Gmail SMTP transporter:', error?.message)
    return null
  }
}

/**
 * Отправка письма о покупке (подтверждение заказа)
 */
export async function sendOrderConfirmationEmail({ email, userName, orderId, items, totalAmount, currency = 'USD', createdAt }) {
  const transporter = getMailTransporter()
  if (!transporter) {
    console.warn('[email] Gmail SMTP not configured, skipping email to', email)
    return { success: false, error: 'email_not_configured' }
  }

  try {
    const orderDate = new Date(createdAt || new Date()).toLocaleString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

    const itemsHtml = items.map(item => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px; text-align: left;">${escapeHtml(item.name || 'Товар')}</td>
        <td style="padding: 12px; text-align: right;">${item.activationKey || '—'}</td>
        <td style="padding: 12px; text-align: right;">${formatPrice(item.price || 0, currency)}</td>
      </tr>
    `).join('')

    const html = `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Подтверждение заказа #${orderId}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">GameSale</h1>
              <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 16px; opacity: 0.9;">Спасибо за покупку!</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <h2 style="margin: 0 0 20px 0; color: #1f2937; font-size: 20px;">Здравствуйте, ${escapeHtml(userName || 'Покупатель')}!</h2>
              
              <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 16px; line-height: 1.5;">
                Ваш заказ <strong>#${orderId}</strong> успешно оформлен и оплачен.
              </p>
              
              <div style="background-color: #f9fafb; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; color: #1f2937; font-size: 14px;">
                  <strong>Дата заказа:</strong> ${orderDate}<br>
                  <strong>Номер заказа:</strong> ${orderId}
                </p>
              </div>
              
              <h3 style="margin: 20px 0 15px 0; color: #1f2937; font-size: 18px;">Состав заказа:</h3>
              
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 20px;">
                <thead>
                  <tr style="background-color: #f3f4f6; border-bottom: 2px solid #e5e7eb;">
                    <th style="padding: 12px; text-align: left; color: #374151; font-weight: 600;">Товар</th>
                    <th style="padding: 12px; text-align: right; color: #374151; font-weight: 600;">Ключ активации</th>
                    <th style="padding: 12px; text-align: right; color: #374151; font-weight: 600;">Цена</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
                <tfoot>
                  <tr style="background-color: #f9fafb; border-top: 2px solid #e5e7eb;">
                    <td colspan="2" style="padding: 15px 12px; text-align: right; font-weight: 600; color: #1f2937;">Итого:</td>
                    <td style="padding: 15px 12px; text-align: right; font-weight: 700; color: #667eea; font-size: 18px;">${formatPrice(totalAmount || 0, currency)}</td>
                  </tr>
                </tfoot>
              </table>
              
              <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 15px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0; color: #1e40af; font-weight: 600; font-size: 14px;">📦 Инструкция по активации:</p>
                <ol style="margin: 0; padding-left: 20px; color: #1e40af; font-size: 14px; line-height: 1.8;">
                  <li>Откройте Steam на вашем компьютере</li>
                  <li>Перейдите в раздел "Игры" → "Активировать продукт Steam"</li>
                  <li>Введите ключ активации из таблицы выше</li>
                  <li>Следуйте инструкциям на экране</li>
                </ol>
              </div>
              
              <p style="margin: 20px 0 0 0; color: #4b5563; font-size: 14px; line-height: 1.5;">
                Если у вас возникли вопросы, пожалуйста, свяжитесь с нашей <a href="${process.env.FRONTEND_URL || 'https://gamesale.shop'}/support" style="color: #667eea; text-decoration: none;">службой поддержки</a>.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 12px;">
                © ${new Date().getFullYear()} GameSale. Все права защищены.<br>
                <a href="${process.env.FRONTEND_URL || 'https://gamesale.shop'}/privacy" style="color: #667eea; text-decoration: none;">Политика конфиденциальности</a> | 
                <a href="${process.env.FRONTEND_URL || 'https://gamesale.shop'}/terms" style="color: #667eea; text-decoration: none;">Условия использования</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `

    const fromEmail = `${SMTP_FROM_NAME} <${SMTP_FROM_EMAIL}>`
    console.log('[email] Sending confirmation email:', {
      from: fromEmail,
      to: email,
      orderId
    })

    const mailOptions = {
      from: fromEmail,
      to: email,
      subject: `Подтверждение заказа #${orderId} - GameSale`,
      html,
      replyTo: process.env.SMTP_REPLY_TO || SMTP_FROM_EMAIL
    }

    const result = await transporter.sendMail(mailOptions)

    console.log('[email] Gmail SMTP response:', {
      success: !!result.messageId,
      messageId: result.messageId,
      response: result.response,
      email: email,
      accepted: result.accepted,
      rejected: result.rejected
    })

    if (!result.messageId) {
      console.error('[email] ❌ Gmail SMTP error: No messageId returned')
      console.error('[email] Response:', result.response)
      console.error('[email] Rejected:', result.rejected)
      return { success: false, error: 'send_failed', details: result.response }
    }

    if (result.rejected && result.rejected.length > 0) {
      console.error('[email] ❌ Email rejected by server:', result.rejected)
      return { success: false, error: 'email_rejected', rejected: result.rejected }
    }

    console.log('[email] ✅ Order confirmation sent successfully to', email, 'messageId:', result.messageId)
    return { success: true, messageId: result.messageId || 'sent' }
  } catch (error) {
    console.error('[email] ❌ Failed to send order confirmation:', error?.message)
    console.error('[email] Error code:', error?.code)
    console.error('[email] Error stack:', error?.stack)
    return { success: false, error: error?.message || 'send_failed', code: error?.code }
  }
}

/**
 * Отправка чека (фискального документа)
 */
export async function sendOrderReceiptEmail({ email, userName, orderId, items, totalAmount, currency = 'USD', paymentMethod, createdAt }) {
  const transporter = getMailTransporter()
  if (!transporter) {
    console.warn('[email] Gmail SMTP not configured, skipping receipt email to', email)
    return { success: false, error: 'email_not_configured' }
  }

  try {
    const orderDate = new Date(createdAt || new Date()).toLocaleString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

    const itemsHtml = items.map((item, index) => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 10px; text-align: center;">${index + 1}</td>
        <td style="padding: 10px; text-align: left;">${escapeHtml(item.name || 'Товар')}</td>
        <td style="padding: 10px; text-align: center;">1</td>
        <td style="padding: 10px; text-align: right;">${formatPrice(item.price || 0, currency)}</td>
        <td style="padding: 10px; text-align: right;">${formatPrice(item.price || 0, currency)}</td>
      </tr>
    `).join('')

    const html = `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Чек заказа #${orderId}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Courier New', monospace; background-color: #ffffff; font-size: 12px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 400px; margin: 0 auto; padding: 20px;">
    <tr>
      <td>
        <!-- Receipt Header -->
        <div style="text-align: center; border-bottom: 2px dashed #000; padding-bottom: 15px; margin-bottom: 15px;">
          <h1 style="margin: 0; font-size: 18px; font-weight: bold; text-transform: uppercase;">GameSale</h1>
          <p style="margin: 5px 0; font-size: 11px;">Чек № ${orderId}</p>
          <p style="margin: 5px 0; font-size: 11px;">${orderDate}</p>
        </div>
        
        <!-- Customer Info -->
        <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #000;">
          <p style="margin: 5px 0; font-size: 11px;"><strong>Покупатель:</strong> ${escapeHtml(userName || 'Гость')}</p>
          <p style="margin: 5px 0; font-size: 11px;"><strong>Email:</strong> ${escapeHtml(email)}</p>
          <p style="margin: 5px 0; font-size: 11px;"><strong>Способ оплаты:</strong> ${escapeHtml(paymentMethod || 'Не указан')}</p>
        </div>
        
        <!-- Items -->
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 15px;">
          <thead>
            <tr style="border-bottom: 1px solid #000;">
              <th style="padding: 5px; text-align: center; font-size: 10px; font-weight: bold;">№</th>
              <th style="padding: 5px; text-align: left; font-size: 10px; font-weight: bold;">Товар</th>
              <th style="padding: 5px; text-align: center; font-size: 10px; font-weight: bold;">Кол-во</th>
              <th style="padding: 5px; text-align: right; font-size: 10px; font-weight: bold;">Цена</th>
              <th style="padding: 5px; text-align: right; font-size: 10px; font-weight: bold;">Сумма</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        
        <!-- Total -->
        <div style="border-top: 2px solid #000; padding-top: 10px; margin-top: 15px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding: 5px 0; text-align: right; font-size: 12px; font-weight: bold;">ИТОГО:</td>
              <td style="padding: 5px 0; text-align: right; font-size: 14px; font-weight: bold; width: 100px;">${formatPrice(totalAmount || 0, currency)}</td>
            </tr>
          </table>
        </div>
        
        <!-- Footer -->
        <div style="margin-top: 20px; padding-top: 15px; border-top: 1px dashed #000; text-align: center; font-size: 10px; color: #666;">
          <p style="margin: 5px 0;">Спасибо за покупку!</p>
          <p style="margin: 5px 0;">www.gamesale.shop</p>
          <p style="margin: 5px 0;">${new Date().getFullYear()}</p>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
    `

    const fromEmail = `${SMTP_FROM_NAME} <${SMTP_FROM_EMAIL}>`
    console.log('[email] Sending receipt email:', {
      from: fromEmail,
      to: email,
      orderId
    })

    const mailOptions = {
      from: fromEmail,
      to: email,
      subject: `Чек заказа #${orderId} - GameSale`,
      html,
      replyTo: process.env.SMTP_REPLY_TO || SMTP_FROM_EMAIL
    }

    const result = await transporter.sendMail(mailOptions)

    console.log('[email] Gmail SMTP response (receipt):', {
      success: !!result.messageId,
      messageId: result.messageId,
      response: result.response,
      email: email
    })

    if (!result.messageId) {
      console.error('[email] Gmail SMTP error (receipt): No messageId returned')
      return { success: false, error: 'send_failed' }
    }

    console.log('[email] Order receipt sent successfully to', email, 'messageId:', result.messageId)
    return { success: true, messageId: result.messageId || 'sent' }
  } catch (error) {
    console.error('[email] Failed to send order receipt:', error?.message)
    return { success: false, error: error?.message || 'send_failed' }
  }
}

/**
 * Утилиты
 */
function escapeHtml(text) {
  if (typeof text !== 'string') return ''
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return text.replace(/[&<>"']/g, m => map[m])
}

function formatPrice(amount, currency = 'USD') {
  const formattedAmount = parseFloat(amount || 0).toFixed(2)
  
  const currencySymbols = {
    'USD': '$',
    'EUR': '€',
    'RUB': '₽',
    'GBP': '£',
    'UAH': '₴'
  }
  
  const symbol = currencySymbols[currency?.toUpperCase()] || currency?.toUpperCase() || '$'
  
  return `${formattedAmount} ${symbol}`
}

/**
 * Отправка чека о транзакции с НДС
 */
export async function sendTransactionReceiptEmail({ email, receiptId, transactionId, date, buyerName, buyerEmail, sellerName, sellerEmail, itemName, itemType, quantity, unitPrice, totalAmount, vat, vatRate, fee, feeType, netAmount, currency, paymentMethod, status }) {
  console.log('\n' + '─'.repeat(60))
  console.log('[email/sendTransactionReceiptEmail] 📧 ОТПРАВКА EMAIL ЧЕКА')
  console.log('[email/sendTransactionReceiptEmail] Called with:', {
    email,
    receiptId,
    transactionId,
    totalAmount,
    currency
  })
  
  const transporter = getMailTransporter()
  if (!transporter) {
    console.error('[email/sendTransactionReceiptEmail] ❌ Gmail SMTP not configured!')
    console.error('[email/sendTransactionReceiptEmail] SMTP_USER:', SMTP_USER ? 'present' : 'missing')
    console.error('[email/sendTransactionReceiptEmail] SMTP_PASS:', SMTP_PASS ? 'present' : 'missing')
    return { success: false, error: 'email_not_configured' }
  }
  console.log('[email/sendTransactionReceiptEmail] ✅ Gmail SMTP transporter initialized')

  try {
    const { generateReceiptHTML } = await import('./receiptService.js')
    const html = generateReceiptHTML({
      receiptId,
      transactionId,
      date,
      buyerName,
      buyerEmail,
      sellerName,
      sellerEmail,
      itemName,
      itemType,
      quantity,
      unitPrice,
      totalAmount,
      vat,
      vatRate,
      fee,
      feeType,
      netAmount,
      currency,
      paymentMethod,
      status
    })

    const fromEmail = `${SMTP_FROM_NAME} <${SMTP_FROM_EMAIL}>`
    console.log('[email] Sending transaction receipt:', {
      from: fromEmail,
      to: email,
      receiptId,
      transactionId
    })

    const mailOptions = {
      from: fromEmail,
      to: email,
      subject: `Чек № ${receiptId} - GameSale`,
      html,
      replyTo: process.env.SMTP_REPLY_TO || SMTP_FROM_EMAIL
    }

    const result = await transporter.sendMail(mailOptions)

    console.log('[email] Receipt SMTP response:', {
      success: !!result.messageId,
      messageId: result.messageId,
      response: result.response,
      email
    })

    if (!result.messageId) {
      console.error('[email] ❌ ОШИБКА ОТПРАВКИ EMAIL')
      console.error('[email] Gmail SMTP error: No messageId returned')
      console.error('─'.repeat(60) + '\n')
      return { success: false, error: 'send_failed' }
    }

    console.log('[email] ✅ EMAIL УСПЕШНО ОТПРАВЛЕН')
    console.log('[email] Transaction receipt sent successfully to', email, 'messageId:', result.messageId)
    console.log('─'.repeat(60) + '\n')
    return { success: true, messageId: result.messageId || 'sent' }
  } catch (error) {
    console.error('[email] Failed to send transaction receipt:', error?.message)
    return { success: false, error: error?.message || 'send_failed' }
  }
}

/**
 * Отправка письма для подтверждения email
 */
export async function sendEmailVerificationEmail({ email, userName, verificationToken, verificationUrl }) {
  const transporter = getMailTransporter()
  if (!transporter) {
    console.warn('[email] Gmail SMTP not configured, skipping verification email to', email)
    return { success: false, error: 'email_not_configured' }
  }

  try {
    const html = `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Подтверждение email</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px;">GameSale</h1>
              <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 16px;">Подтверждение email</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px;">
              <h2 style="margin: 0 0 20px 0; color: #1f2937; font-size: 20px;">Здравствуйте, ${escapeHtml(userName || 'Пользователь')}!</h2>
              <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 16px; line-height: 1.5;">
                Для завершения регистрации и использования всех функций GameSale, пожалуйста, подтвердите ваш email адрес.
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verificationUrl}" style="display: inline-block; background-color: #667eea; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                  Подтвердить email
                </a>
              </div>
              <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 14px;">
                Или скопируйте и вставьте эту ссылку в браузер:
              </p>
              <p style="margin: 10px 0; color: #667eea; font-size: 12px; word-break: break-all;">
                ${verificationUrl}
              </p>
              <p style="margin: 20px 0 0 0; color: #9ca3af; font-size: 12px;">
                Если вы не регистрировались на GameSale, просто проигнорируйте это письмо.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 12px;">
                © ${new Date().getFullYear()} GameSale. Все права защищены.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `

    const fromEmail = `${SMTP_FROM_NAME} <${SMTP_FROM_EMAIL}>`
    const mailOptions = {
      from: fromEmail,
      to: email,
      subject: 'Подтверждение email - GameSale',
      html,
      replyTo: process.env.SMTP_REPLY_TO || SMTP_FROM_EMAIL
    }

    const result = await transporter.sendMail(mailOptions)

    if (!result.messageId) {
      console.error('[email] Verification email error: No messageId returned')
      return { success: false, error: 'send_failed' }
    }

    console.log('[email] Verification email sent to', email, 'messageId:', result.messageId)
    return { success: true, messageId: result.messageId || 'sent' }
  } catch (error) {
    console.error('[email] Failed to send verification email:', error?.message)
    return { success: false, error: error?.message || 'send_failed' }
  }
}

