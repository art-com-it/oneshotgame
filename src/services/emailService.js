// Сервис для отправки email уведомлений после покупки

// Функция для определения email поддержки в зависимости от домена
const getSupportEmail = () => {
  if (typeof window === 'undefined') {
    return 'support@gamesale.shop' // SSR default
  }
  const hostname = window.location.hostname.toLowerCase()
  if (hostname.includes('oneshotgame.shop') || hostname.includes('oneshotgame')) {
    return 'support@oneshotgame.shop'
  }
  return 'support@gamesale.shop'
}

// Функция для определения базового URL
const getBaseUrl = () => {
  if (typeof window === 'undefined') {
    return 'https://gamesale.shop' // SSR default
  }
  return window.location.origin
}

class EmailService {
  constructor() {
    this.apiEndpoint = '/api/send-email' // Эндпоинт для отправки email
    this.templates = {
      cs2: {
        subject: 'Покупка скинов CS2 - Game Sale',
        gameTitle: 'Counter-Strike 2',
        gameIcon: '🔫',
        color: '#FF6B35'
      },
      dota2: {
        subject: 'Покупка предметов Dota 2 - Game Sale',
        gameTitle: 'Dota 2',
        gameIcon: '⚔️',
        color: '#D32F2F'
      },
      tf2: {
        subject: 'Покупка предметов Team Fortress 2 - Game Sale',
        gameTitle: 'Team Fortress 2',
        gameIcon: '🎯',
        color: '#FF9800'
      },
      rust: {
        subject: 'Покупка скинов Rust - Game Sale',
        gameTitle: 'Rust',
        gameIcon: '🦀',
        color: '#8D6E63'
      },
      pubg: {
        subject: 'Покупка предметов PUBG - Game Sale',
        gameTitle: 'PUBG',
        gameIcon: '🎮',
        color: '#FFC107'
      }
    }
  }

  // Отправка уведомления о покупке
  async sendPurchaseNotification(orderData) {
    try {
      const { userEmail, items, totalAmount, orderId, game } = orderData
      const template = this.templates[game] || this.templates.cs2

      const emailData = {
        to: userEmail,
        subject: template.subject,
        html: this.generatePurchaseEmailHTML(orderData, template),
        text: this.generatePurchaseEmailText(orderData, template)
      }

      // В реальном приложении здесь будет отправка через API
      console.log('Отправка email уведомления:', emailData)
      
      // Симуляция отправки
      await this.simulateEmailSend(emailData)
      
      return { success: true, message: 'Email отправлен успешно' }
    } catch (error) {
      console.error('Ошибка отправки email:', error)
      return { success: false, error: error.message }
    }
  }

  // Генерация HTML для email
  generatePurchaseEmailHTML(orderData, template) {
    const { userEmail, items, totalAmount, orderId, game, userName } = orderData
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${template.subject}</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
            .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
            .header { background: linear-gradient(135deg, ${template.color}, #1a1a2e); color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; }
            .order-info { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
            .total { font-size: 18px; font-weight: bold; color: ${template.color}; text-align: right; margin-top: 15px; }
            .footer { background-color: #1a1a2e; color: white; padding: 20px; text-align: center; }
            .button { display: inline-block; background-color: ${template.color}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>${template.gameIcon} ${template.gameTitle}</h1>
                <h2>Спасибо за покупку!</h2>
                <p>Ваш заказ успешно обработан</p>
            </div>
            
            <div class="content">
                <h3>Привет, ${userName || 'Игрок'}!</h3>
                <p>Ваш заказ в Game Sale успешно обработан и предметы уже добавлены в ваш инвентарь Steam.</p>
                
                <div class="order-info">
                    <h4>Детали заказа #${orderId}</h4>
                    <p><strong>Email:</strong> ${userEmail}</p>
                    <p><strong>Игра:</strong> ${template.gameTitle}</p>
                    <p><strong>Дата:</strong> ${new Date().toLocaleDateString('ru-RU')}</p>
                    
                    <h4>Купленные предметы:</h4>
                    ${items.map(item => {
                      let itemHtml = `
                        <div class="item" style="flex-direction: column; align-items: flex-start; padding: 15px; margin: 10px 0; background-color: #fff; border: 1px solid #ddd; border-radius: 8px;">
                          <div style="display: flex; justify-content: space-between; width: 100%; margin-bottom: 10px;">
                            <span style="font-weight: bold;">${item.name} ${item.quality ? `(${item.quality})` : ''}</span>
                            <span style="font-weight: bold; color: ${template.color};">$${item.price}</span>
                          </div>`
                      
                      // Если это игра с ключом активации
                      if (item.category === 'game' && item.activationKey) {
                        itemHtml += `
                          <div style="background-color: #f0f8ff; padding: 15px; border-radius: 6px; margin-top: 10px; border-left: 4px solid ${template.color};">
                            <p style="margin: 0 0 10px 0; font-weight: bold; color: #333;">🎮 Ключ активации:</p>
                            <div style="background-color: #fff; padding: 12px; border-radius: 4px; font-family: 'Courier New', monospace; font-size: 18px; font-weight: bold; text-align: center; letter-spacing: 2px; color: ${template.color}; border: 2px dashed ${template.color};">
                              ${item.activationKey}
                            </div>
                            <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">
                              <strong>Инструкция по активации:</strong><br>
                              1. Откройте Steam<br>
                              2. Перейдите в "Игры" → "Активировать продукт Steam"<br>
                              3. Введите ключ активации выше<br>
                              4. Следуйте инструкциям для завершения активации
                            </p>
                          </div>`
                      } else if (item.category === 'skin') {
                        itemHtml += `
                          <div style="background-color: #fff3cd; padding: 15px; border-radius: 6px; margin-top: 10px; border-left: 4px solid #ffc107;">
                            <p style="margin: 0; font-size: 14px; color: #856404;">
                              <strong>📦 Способ доставки:</strong> Steam инвентарь<br>
                              Скин будет отправлен в ваш Steam инвентарь в течение 24 часов после оплаты. Проверьте свою торговую площадку Steam или раздел "Инвентарь" в Steam клиенте.
                            </p>
                          </div>`
                      }
                      
                      itemHtml += `</div>`
                      return itemHtml
                    }).join('')}
                    
                    <div class="total">
                        Итого: $${totalAmount}
                    </div>
                </div>
                
                <h4>Что дальше?</h4>
                <ul style="line-height: 1.8;">
                    ${items.some(i => i.category === 'game' && i.activationKey) ? 
                      '<li><strong>Для игр:</strong> Используйте ключ активации выше для активации в Steam</li>' : 
                      ''}
                    ${items.some(i => i.category === 'skin') ? 
                      '<li><strong>Для скинов:</strong> Предметы будут отправлены в ваш Steam инвентарь в течение 24 часов</li>' : 
                      ''}
                    <li>Все купленные товары также доступны в вашем <a href="${getBaseUrl()}/profile" style="color: ${template.color};">личном кабинете</a></li>
                    <li>При возникновении проблем обращайтесь в поддержку</li>
                </ul>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${getBaseUrl()}/profile" class="button">Мой профиль</a>
                    <a href="${getBaseUrl()}/support" class="button">Поддержка</a>
                </div>
            </div>
            
            <div class="footer">
                <p><strong>Game Sale</strong> - Лучшая платформа для торговли игровыми предметами</p>
                <p>Поддержка 24/7 | ${getSupportEmail()}</p>
                <p style="font-size: 12px; color: #ccc;">
                    Это автоматическое сообщение. Пожалуйста, не отвечайте на него.
                </p>
            </div>
        </div>
    </body>
    </html>
    `
  }

  // Генерация текстовой версии email
  generatePurchaseEmailText(orderData, template) {
    const { userEmail, items, totalAmount, orderId, userName } = orderData
    
    return `
${template.gameIcon} ${template.gameTitle} - Спасибо за покупку!

Привет, ${userName || 'Игрок'}!

Ваш заказ в Game Sale успешно обработан и предметы уже добавлены в ваш инвентарь Steam.

Детали заказа #${orderId}:
- Email: ${userEmail}
- Игра: ${template.gameTitle}
- Дата: ${new Date().toLocaleDateString('ru-RU')}

Купленные предметы:
${items.map(item => `- ${item.name} ${item.quality ? `(${item.quality})` : ''} - $${item.price}`).join('\n')}

Итого: $${totalAmount}

Что дальше?
- Предметы автоматически добавлены в ваш Steam инвентарь
- Проверьте ваш инвентарь в Steam клиенте
- При возникновении проблем обращайтесь в поддержку

Game Sale - Лучшая платформа для торговли игровыми предметами
Поддержка 24/7 | ${getSupportEmail()}
    `
  }

  // Симуляция отправки email (в реальном приложении заменить на реальный API)
  async simulateEmailSend(emailData) {
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log('📧 Email отправлен:', {
          to: emailData.to,
          subject: emailData.subject,
          timestamp: new Date().toISOString()
        })
        resolve(true)
      }, 1000)
    })
  }

}

// Экспорт экземпляра сервиса
export const emailService = new EmailService()

// Функция для интеграции с процессом покупки
export const sendPurchaseEmail = async (orderData) => {
  return await emailService.sendPurchaseNotification(orderData)
}

export default EmailService
