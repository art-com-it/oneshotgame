// Сервис для уведомлений о платежах
import { sendTransactionReceiptEmail } from './emailService.js'
import { generateReceiptHTML } from './receiptService.js'

/**
 * Отправить чек покупателю на email
 */
export async function sendPaymentReceiptToCustomer(payment) {
  try {
    if (!payment.userEmail) {
      console.warn('[payment-notification] No email for payment', payment.id)
      return { success: false, error: 'no_email' }
    }

    const receiptData = {
      receiptId: payment.receiptId || payment.transactionId,
      transactionId: payment.transactionId,
      date: payment.paidAt || payment.createdAt,
      buyerName: payment.userName || 'Клиент',
      buyerEmail: payment.userEmail,
      sellerName: (payment.company && payment.company.name) || 'GameSale',
      sellerEmail: (payment.company && payment.company.email) || 'info@gamesale.shop',
      itemName: payment.description || 'Оплата товара/услуги',
      itemType: 'payment',
      quantity: 1,
      unitPrice: payment.amount,
      totalAmount: payment.amount,
      vat: payment.vat,
      vatRate: payment.vatRate,
      fee: 0,
      feeType: 'buyer',
      netAmount: payment.amount,
      currency: payment.currency,
      paymentMethod: payment.paymentMethod || 'card',
      status: payment.status
    }

    const result = await sendTransactionReceiptEmail({
      email: payment.userEmail,
      ...receiptData
    })

    return result
  } catch (error) {
    console.error('[payment-notification] Send receipt error:', error?.message)
    return { success: false, error: error.message }
  }
}

/**
 * Отправить уведомление администратору о новом платеже
 */
export async function sendPaymentNotificationToAdmin(payment, notificationType = 'new_payment') {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || process.env.SUPPORT_NOTIFY_EMAIL || process.env.SUPPORT_EMAIL
    
    if (!adminEmail) {
      console.warn('[payment-notification] No admin email configured')
      return { success: false, error: 'no_admin_email' }
    }

    // Импортируем Resend напрямую
    const { Resend } = await import('resend')
    const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
    
    if (!RESEND_API_KEY || 
        RESEND_API_KEY === 're_your_api_key_here' || 
        !RESEND_API_KEY.startsWith('re_') ||
        RESEND_API_KEY.length < 20) {
      console.warn('[payment-notification] Resend API key not configured')
      return { success: false, error: 'email_not_configured' }
    }

    const resend = new Resend(RESEND_API_KEY)

    const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
    const RESEND_FROM_NAME = process.env.RESEND_FROM_NAME || 'GameSale'

    let subject = ''
    let html = ''

    if (notificationType === 'new_payment') {
      subject = `Новый платеж #${payment.transactionId} - GameSale`
      
      html = `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Новый платеж</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px;">Новый платеж</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px;">
              <h2 style="margin: 0 0 20px 0; color: #1f2937; font-size: 20px;">🔔 Уведомление о новом платеже</h2>
              
              <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
                <p style="margin: 5px 0; color: #374151;"><strong>ID платежа:</strong> ${payment.id}</p>
                <p style="margin: 5px 0; color: #374151;"><strong>ID сделки:</strong> ${payment.transactionId}</p>
                <p style="margin: 5px 0; color: #374151;"><strong>Дата:</strong> ${new Date(payment.createdAt).toLocaleString('ru-RU')}</p>
                <p style="margin: 5px 0; color: #374151;"><strong>Статус:</strong> <span style="color: #f59e0b; font-weight: bold;">${payment.status}</span></p>
              </div>

              <h3 style="margin: 20px 0 15px 0; color: #1f2937; font-size: 18px;">Информация о клиенте:</h3>
              <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
                <p style="margin: 5px 0; color: #374151;"><strong>Имя:</strong> ${payment.userName || 'Не указано'}</p>
                <p style="margin: 5px 0; color: #374151;"><strong>Email:</strong> ${payment.userEmail || 'Не указано'}</p>
                <p style="margin: 5px 0; color: #374151;"><strong>Телефон:</strong> ${payment.userPhone || 'Не указано'}</p>
              </div>

              <h3 style="margin: 20px 0 15px 0; color: #1f2937; font-size: 18px;">Детали платежа:</h3>
              <div style="background-color: #eff6ff; padding: 15px; border-radius: 6px; border-left: 4px solid #2563eb;">
                <p style="margin: 5px 0; color: #1e40af;"><strong>Сумма (с НДС):</strong> ${parseFloat(payment.amount).toFixed(2)} ${payment.currency}</p>
                <p style="margin: 5px 0; color: #1e40af;"><strong>Сумма (без НДС):</strong> ${parseFloat(payment.amountWithoutVAT).toFixed(2)} ${payment.currency}</p>
                <p style="margin: 5px 0; color: #1e40af;"><strong>НДС (${(payment.vatRate * 100).toFixed(0)}%):</strong> ${parseFloat(payment.vat).toFixed(2)} ${payment.currency}</p>
                <p style="margin: 5px 0; color: #1e40af;"><strong>Описание:</strong> ${payment.description || 'Нет описания'}</p>
              </div>

              ${payment.status === 'pending' ? `
              <div style="background-color: #fef3c7; padding: 15px; border-radius: 6px; border-left: 4px solid #f59e0b; margin-top: 20px;">
                <p style="margin: 0; color: #92400e;"><strong>⚠️ Внимание:</strong> Платеж ожидает обработки. Требуется ручная проверка и подтверждение товара.</p>
                <p style="margin: 10px 0 0 0; color: #92400e;">Deeplink для оплаты: <a href="${payment.deeplink}" style="color: #2563eb;">${payment.deeplink}</a></p>
              </div>
              ` : ''}

              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <a href="${process.env.FRONTEND_URL || 'https://gamesale.shop'}/admin/payments/${payment.id}" 
                   style="display: inline-block; background-color: #667eea; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                  Открыть в панели администратора
                </a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `
    } else if (notificationType === 'payment_completed') {
      subject = `Платеж оплачен #${payment.transactionId} - GameSale`
      
      html = `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Платеж оплачен</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px;">✅ Платеж оплачен</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px;">
              <h2 style="margin: 0 0 20px 0; color: #1f2937; font-size: 20px;">Платеж успешно обработан</h2>
              
              <div style="background-color: #f0fdf4; padding: 15px; border-radius: 6px; border-left: 4px solid #10b981; margin-bottom: 20px;">
                <p style="margin: 5px 0; color: #166534;"><strong>ID сделки:</strong> ${payment.transactionId}</p>
                <p style="margin: 5px 0; color: #166534;"><strong>Сумма:</strong> ${parseFloat(payment.amount).toFixed(2)} ${payment.currency}</p>
                <p style="margin: 5px 0; color: #166534;"><strong>Дата оплаты:</strong> ${payment.paidAt ? new Date(payment.paidAt).toLocaleString('ru-RU') : 'Не указано'}</p>
                <p style="margin: 5px 0; color: #166534;"><strong>Способ оплаты:</strong> ${payment.paymentMethod || 'Не указан'}</p>
              </div>

              <p style="margin: 20px 0; color: #4b5563;">Клиент получил чек на email: <strong>${payment.userEmail || 'Не указан'}</strong></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `
    }

    const fromEmail = `${RESEND_FROM_NAME} <${RESEND_FROM_EMAIL}>`
    
    const result = await resend.emails.send({
      from: fromEmail,
      to: adminEmail,
      subject,
      html,
      replyTo: process.env.RESEND_REPLY_TO || RESEND_FROM_EMAIL
    })

    if (result.error) {
      console.error('[payment-notification] Admin notification error:', result.error)
      return { success: false, error: result.error.message }
    }

    console.log('[payment-notification] Admin notification sent:', { paymentId: payment.id, type: notificationType })
    return { success: true, messageId: result.data?.id }
  } catch (error) {
    console.error('[payment-notification] Send admin notification error:', error?.message)
    return { success: false, error: error.message }
  }
}

