import fs from 'fs'
import path from 'path'
import TelegramBot from 'node-telegram-bot-api'
import https from 'https'
import http from 'http'

const DEFAULT_HELP_MESSAGE = [
  '📋 Команды:',
  '/help — справка',
  '/get_id — получить ID текущего чата',
  '/sessions — список активных чатов',
  '/orders — последние заказы',
  '/reply <sessionId> <сообщение> — ответить пользователю в чат',
  '/addproduct key=value ... — добавить игру или скин (поля: type=game|skin, name, price, category=game|skin, rarity, image, introImage, steamAppId, description)',
  '',
  '💡 Отправьте фото с текстом (caption) или несколькими фото и текстом для создания товара',
  '',
  'Пример: /addproduct type=game name="Portal 2" price=299 category=game steamAppId=620 description="Пазл от Valve"'
].join('\n')

const parseKeyValuePairs = (text) => {
  if (!text) return {}
  const result = {}
  const regex = /([a-zA-Z0-9_]+)=("([^"]*)"|'([^']*)'|[^\s]+)/g
  let match
  while ((match = regex.exec(text)) !== null) {
    const key = match[1]
    const rawValue = match[3] ?? match[4] ?? match[2]
    result[key.toLowerCase()] = rawValue
  }
  return result
}

const formatOrderSummary = (order) => {
  if (!order) return '—'
  const lines = [
    `🛒 Заказ ${order.orderId || order.id}`,
    `Клиент: ${order.userName || '—'} ${order.userEmail ? `<${order.userEmail}>` : ''}`,
    `Сумма: ${order.totalAmount || 0} ${order.currency || 'USD'}`,
    `Позиции: ${order.itemsCount || 0}`,
    `Статус: ${order.status || 'new'}`
  ]
  return lines.filter(Boolean).join('\n')
}

const noop = () => {}

// Функция для загрузки фото из Telegram и сохранения локально
async function downloadTelegramPhoto(bot, fileId, uploadsDir, baseFilename, logger) {
  try {
    const file = await bot.getFile(fileId)
    if (!file || !file.file_path) {
      throw new Error('file_not_found')
    }
    
    const fileUrl = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`
    
    // Используем встроенный fetch или https/http для совместимости
    let buffer
    if (typeof fetch !== 'undefined') {
      // Node.js 18+ с встроенным fetch
      const response = await fetch(fileUrl)
      if (!response.ok) {
        throw new Error('download_failed')
      }
      buffer = Buffer.from(await response.arrayBuffer())
    } else {
      // Fallback для старых версий Node.js
      buffer = await new Promise((resolve, reject) => {
        const protocol = fileUrl.startsWith('https') ? https : http
        protocol.get(fileUrl, (res) => {
          if (res.statusCode !== 200) {
            reject(new Error('download_failed'))
            return
          }
          const chunks = []
          res.on('data', (chunk) => chunks.push(chunk))
          res.on('end', () => resolve(Buffer.concat(chunks)))
          res.on('error', reject)
        }).on('error', reject)
      })
    }
    
    const ext = path.extname(file.file_path) || '.jpg'
    const filename = `${baseFilename}-${Date.now()}${ext}`
    const filepath = path.join(uploadsDir, filename)
    
    await fs.promises.mkdir(uploadsDir, { recursive: true })
    await fs.promises.writeFile(filepath, buffer)
    
    return `/images/uploads/${filename}`
  } catch (error) {
    if (logger) logger.warn('[telegram] download photo error', error?.message)
    return null
  }
}

// Парсинг текста для извлечения параметров товара
function parseProductText(text) {
  if (!text) return {}
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const result = {}
  
  for (const line of lines) {
    // Парсим строки вида "ключ: значение" или "ключ = значение"
    const colonMatch = line.match(/^([a-zA-Z0-9_]+):\s*(.+)$/i)
    const eqMatch = line.match(/^([a-zA-Z0-9_]+)\s*=\s*(.+)$/i)
    const match = colonMatch || eqMatch
    
    if (match) {
      const key = match[1].toLowerCase()
      let value = match[2].trim()
      // Убираем кавычки если есть
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      result[key] = value
    }
  }
  
  // Если текст не содержит ключей, считаем его названием или описанием
  if (Object.keys(result).length === 0 && text) {
    const firstLine = lines[0]
    if (firstLine) {
      // Пытаемся определить, что это - название или описание
      if (firstLine.length < 100) {
        result.name = firstLine
      }
      if (lines.length > 1) {
        result.description = lines.slice(1).join('\n')
      } else if (firstLine.length >= 100) {
        result.description = firstLine
      }
    }
  }
  
  return result
}

export function initTelegramBot({
  token,
  adminChatId,
  notificationsChatId,
  onListSessions = async () => [],
  onListOrders = async () => [],
  onReplyToSession = async () => ({ ok: false, error: 'not_implemented' }),
  onAddProduct = async () => ({ ok: false, error: 'not_implemented' }),
  logger = console
} = {}) {
  if (!token) {
    logger.warn('[telegram] Bot token not provided. Telegram integration disabled.')
    return {
      isEnabled: false,
      notifyChatMessage: noop,
      notifyOrder: noop,
      notifyAuth: noop,
      notifyGeneric: noop
    }
  }

  if (!adminChatId) {
    logger.warn('[telegram] Admin chat ID not provided. Bot will work, but admin commands will be disabled. Use /get_id to get your chat ID.')
  }

  // Настройка бота с обработкой ошибок подключения
  const bot = new TelegramBot(token, { 
    polling: {
      interval: 300,
      autoStart: true,
      params: {
        timeout: 10
      }
    }
  })
  
  // Обработка ошибок подключения Telegram
  bot.on('polling_error', (error) => {
    // Подавляем частые ошибки подключения, логируем только критичные
    const errorMsg = error.message || ''
    const isNetworkError = errorMsg.includes('ENOTFOUND') || 
                          errorMsg.includes('ETIMEDOUT') || 
                          errorMsg.includes('ECONNRESET') ||
                          errorMsg.includes('EFATAL')
    
    if (!isNetworkError) {
      logger.error('[telegram] Polling error:', error.message)
    } else {
      // Логируем сетевые ошибки только раз в минуту (чтобы не спамить)
      const lastErrorTime = bot._lastNetworkErrorLog || 0
      const now = Date.now()
      if (now - lastErrorTime > 60000) {
        logger.warn('[telegram] Network error (will retry):', error.code || error.message)
        bot._lastNetworkErrorLog = now
      }
    }
  })
  
  const adminId = adminChatId ? String(adminChatId) : null
  const notifyId = adminId ? (notificationsChatId ? String(notificationsChatId) : adminId) : null
  
  // Директория для загрузки фото
  const UPLOADS_DIR = path.join(process.cwd(), 'public', 'images', 'uploads')
  try { fs.mkdirSync(UPLOADS_DIR, { recursive: true }) } catch {}

  // Функция для экранирования HTML в тексте (защита от парсинга email как HTML тегов)
  const escapeHtml = (text) => {
    if (!text || typeof text !== 'string') return ''
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }
  
  // Функция для безопасной отправки сообщений с автоматическим экранированием
  const safeSend = async (chatId, message, options = {}) => {
    try {
      // Если сообщение содержит email адреса вне тегов <code> или <pre>, экранируем их
      let safeMessage = message
      
      // Находим email адреса, которые не внутри <code> или <pre> тегов
      const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g
      let match
      const emails = []
      
      // Собираем все email адреса
      while ((match = emailRegex.exec(message)) !== null) {
        emails.push(match[0])
      }
      
      // Экранируем email адреса, которые не находятся внутри <code> или <pre> тегов
      emails.forEach(email => {
        // Проверяем, находится ли email внутри <code>...</code> или <pre>...</pre>
        const beforeEmail = message.substring(0, message.indexOf(email))
        const openCodeTags = (beforeEmail.match(/<code>/g) || []).length
        const closeCodeTags = (beforeEmail.match(/<\/code>/g) || []).length
        const openPreTags = (beforeEmail.match(/<pre>/g) || []).length
        const closePreTags = (beforeEmail.match(/<\/pre>/g) || []).length
        const inCodeTag = openCodeTags > closeCodeTags || openPreTags > closePreTags
        
        // Если email не в теге, экранируем его
        if (!inCodeTag) {
          safeMessage = safeMessage.replace(email, escapeHtml(email))
        }
      })
      
      return await bot.sendMessage(chatId, safeMessage, { parse_mode: 'HTML', ...options })
    } catch (error) {
      // Не логируем ошибки "chat_id is empty" - это нормально для неинициализированного бота
      if (!error.message || !error.message.includes('chat_id is empty')) {
        logger.warn('[telegram] send error', error?.message)
      }
      return null
    }
  }

  const sendHelp = (chatId) => safeSend(chatId, DEFAULT_HELP_MESSAGE)

  bot.onText(/^\/start$/, (msg) => {
    // /get_id доступна в любом чате, остальные команды - только в админском
    if (adminId && String(msg.chat.id) !== adminId) {
      safeSend(msg.chat.id, '👋 Привет! Используйте /get_id чтобы узнать ID этого чата и настроить бота.')
      return
    }
    sendHelp(msg.chat.id)
  })

  bot.onText(/^\/help$/, (msg) => {
    if (adminId && String(msg.chat.id) !== adminId) {
      safeSend(msg.chat.id, 'Для использования админских команд настройте TELEGRAM_ADMIN_CHAT_ID в .env файле. Используйте /get_id чтобы узнать ID чата.')
      return
    }
    sendHelp(msg.chat.id)
  })

  // Команда /get_id - получить ID чата (доступна в любом чате!)
  bot.onText(/^\/get_id$/, (msg) => {
    const chatId = String(msg.chat.id)
    const chatType = msg.chat.type || 'unknown'
    const chatTitle = msg.chat.title || msg.chat.username || msg.chat.first_name || 'Unknown'
    const isAdminChat = adminId ? String(msg.chat.id) === adminId : false
    
    const message = [
      `🆔 <b>Информация о чате</b>`,
      ``,
      `Chat ID: <code>${chatId}</code>`,
      `Тип чата: ${chatType}`,
      `Название: ${chatTitle}`,
      ``,
      `${isAdminChat ? '✅ Это админский чат' : '⚠️ Это НЕ админский чат'}`,
      ``,
      `📝 Добавьте в файл <code>.env</code>:`,
      `<code>TELEGRAM_ADMIN_CHAT_ID=${chatId}</code>`,
      ``,
      `${!adminId ? 'После добавления перезапустите сервер: pm2 restart storegame' : isAdminChat ? '✅ Настроено корректно' : 'После настройки перезапустите сервер.'}`
    ].join('\n')
    
    safeSend(msg.chat.id, message)
  })

  bot.onText(/^\/sessions$/, async (msg) => {
    if (!adminId || String(msg.chat.id) !== adminId) {
      if (!adminId) {
        await safeSend(msg.chat.id, '❌ Админский чат не настроен. Используйте /get_id чтобы узнать ID чата.')
      }
      return
    }
    try {
      const sessions = await onListSessions()
      if (!sessions || sessions.length === 0) {
        await safeSend(msg.chat.id, 'Активных чатов нет.')
        return
      }
      const lines = sessions.slice(0, 15).map((session) => {
        const name = session.user?.name || session.user?.email || session.id
        const status = session.unreadForAdmin ? '🟡' : '🟢'
        const lastAt = session.lastMessageAt || session.updatedAt || session.createdAt
        return `${status} <b>${name}</b>\nID: <code>${session.id}</code>\nСообщений: ${session.messagesCount || '?'}, обновлено: ${lastAt || '—'}`
      })
      await safeSend(msg.chat.id, lines.join('\n\n'))
    } catch (error) {
      logger.warn('[telegram] sessions error', error?.message)
      await safeSend(msg.chat.id, 'Не удалось получить список чатов.')
    }
  })

  bot.onText(/^\/orders$/, async (msg) => {
    if (!adminId || String(msg.chat.id) !== adminId) {
      if (!adminId) {
        await safeSend(msg.chat.id, '❌ Админский чат не настроен. Используйте /get_id чтобы узнать ID чата.')
      }
      return
    }
    try {
      const orders = await onListOrders()
      if (!orders || orders.length === 0) {
        await safeSend(msg.chat.id, 'Заказов пока нет.')
        return
      }
      const lines = orders.slice(0, 10).map((order) => formatOrderSummary(order))
      await safeSend(msg.chat.id, lines.join('\n\n'))
    } catch (error) {
      logger.warn('[telegram] orders error', error?.message)
      await safeSend(msg.chat.id, 'Не удалось получить список заказов.')
    }
  })

  bot.onText(/^\/reply\s+([^\s]+)\s+([\s\S]+)$/i, async (msg, match) => {
    if (!adminId || String(msg.chat.id) !== adminId) {
      if (!adminId) {
        await safeSend(msg.chat.id, '❌ Админский чат не настроен. Используйте /get_id чтобы узнать ID чата.')
      }
      return
    }
    const sessionId = match[1]
    const replyText = match[2]
    if (!sessionId || !replyText) {
      await safeSend(msg.chat.id, 'Использование: /reply <sessionId> <сообщение>')
      return
    }
    try {
      const result = await onReplyToSession(sessionId, replyText)
      if (result?.ok) {
        await safeSend(msg.chat.id, `✅ Сообщение отправлено в чат ${sessionId}`)
      } else {
        await safeSend(msg.chat.id, `⚠️ Не удалось отправить сообщение: ${result?.error || 'unknown_error'}`)
      }
    } catch (error) {
      logger.warn('[telegram] reply error', error?.message)
      await safeSend(msg.chat.id, `⚠️ Ошибка отправки: ${error?.message}`)
    }
  })

  bot.onText(/^\/addproduct\s+([\s\S]+)$/i, async (msg, match) => {
    if (!adminId || String(msg.chat.id) !== adminId) {
      if (!adminId) {
        await safeSend(msg.chat.id, '❌ Админский чат не настроен. Используйте /get_id чтобы узнать ID чата.')
      }
      return
    }
    const args = parseKeyValuePairs(match[1])
    if (!args.name || !args.price) {
      await safeSend(
        msg.chat.id,
        'Укажите как минимум name и price. Пример:\n/addproduct type=game name="Portal 2" price=299 category=game steamAppId=620'
      )
      return
    }
    try {
      const result = await onAddProduct(args)
      if (result?.ok) {
        await safeSend(
          msg.chat.id,
          `✅ Товар добавлен: <b>${result.product?.name || args.name}</b>\nID: <code>${result.product?.id}</code>`
        )
      } else {
        await safeSend(msg.chat.id, `⚠️ Не удалось добавить товар: ${result?.error || 'unknown_error'}`)
      }
    } catch (error) {
      logger.warn('[telegram] addproduct error', error?.message)
      await safeSend(msg.chat.id, `⚠️ Ошибка добавления: ${error?.message}`)
    }
  })

  // Обработка фото с текстом для создания товара
  bot.on('photo', async (msg) => {
    if (!adminId || String(msg.chat.id) !== adminId) {
      if (!adminId) {
        await safeSend(msg.chat.id, '❌ Админский чат не настроен. Используйте /get_id чтобы узнать ID чата.')
      }
      return
    }
    
    try {
      // Получаем самое большое фото
      const photos = Array.isArray(msg.photo) ? msg.photo : []
      if (photos.length === 0) return
      
      // Берем последнее (самое большое) фото
      const largestPhoto = photos[photos.length - 1]
      const caption = msg.caption || ''
      
      // Парсим текст из caption для получения параметров товара
      const params = parseProductText(caption)
      
      // Если нет названия в параметрах, просим его указать
      if (!params.name) {
        await safeSend(msg.chat.id, 
          '📸 Фото получено! Отправьте описание товара в формате:\n\n' +
          '<code>name: Название товара\nprice: 100\ncategory: game</code>\n\n' +
          'Или отправьте фото с подписью (caption), содержащей эти параметры.',
          { reply_to_message_id: msg.message_id }
        )
        return
      }
      
      // Загружаем фото
      const baseFilename = params.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      const imagePath = await downloadTelegramPhoto(bot, largestPhoto.file_id, UPLOADS_DIR, baseFilename, logger)
      
      if (!imagePath) {
        await safeSend(msg.chat.id, '❌ Не удалось загрузить фото. Попробуйте еще раз.')
        return
      }
      
      // Формируем данные для товара
      const productData = {
        name: params.name,
        price: parseFloat(params.price || '0'),
        description: params.description || caption || '',
        category: params.category || (caption.toLowerCase().includes('skin') || caption.toLowerCase().includes('скин') ? 'skin' : 'game'),
        type: params.type || '',
        image: imagePath,
        introImage: imagePath,
        images: [imagePath]
      }
      
      // Проверяем обязательные поля
      if (!productData.price || productData.price <= 0) {
        await safeSend(msg.chat.id, 
          '❌ Укажите цену товара в подписи к фото:\n\n' +
          '<code>name: Название\nprice: 100</code>',
          { reply_to_message_id: msg.message_id }
        )
        return
      }
      
      // Добавляем товар через callback
      const result = await onAddProduct(productData)
      
      if (result?.ok) {
        await safeSend(msg.chat.id, 
          `✅ Товар создан!\n\n` +
          `Название: <b>${result.product?.name || productData.name}</b>\n` +
          `Цена: ${result.product?.price || productData.price}\n` +
          `ID: <code>${result.product?.id}</code>\n` +
          `Категория: ${result.product?.category || productData.category}`,
          { reply_to_message_id: msg.message_id }
        )
      } else {
        await safeSend(msg.chat.id, 
          `❌ Ошибка создания товара: ${result?.error || 'unknown_error'}`,
          { reply_to_message_id: msg.message_id }
        )
      }
    } catch (error) {
      logger.error('[telegram] photo handler error', error)
      await safeSend(msg.chat.id, `❌ Ошибка обработки фото: ${error?.message || 'unknown_error'}`)
    }
  })

  bot.on('message', (msg) => {
    // Игнорируем команды, которые уже обработаны выше
    if (msg.text && msg.text.trim().startsWith('/')) {
      const cmd = msg.text.trim().split(/\s/)[0]
      // /get_id обрабатывается отдельно и доступна везде
      if (cmd === '/get_id') return
      // Для остальных команд проверяем админский чат
      if (!adminId || String(msg.chat.id) !== adminId) {
        if (!adminId) {
          safeSend(msg.chat.id, '❌ Админский чат не настроен. Используйте /get_id чтобы узнать ID чата.')
        }
        return
      }
      return
    }
    
    // Для обычных сообщений (не команд) в админском чате
    if (adminId && String(msg.chat.id) === adminId && msg.text) {
      const isCommand = msg.text.trim().startsWith('/')
      if (!isCommand) {
        safeSend(msg.chat.id, 'Неизвестная команда. Используйте /help или отправьте фото с подписью для создания товара.')
      }
    }
  })

  const notifyChatMessage = async ({ sessionId, session, message }) => {
    if (!sessionId || !message) return
    const lines = [
      '💬 <b>Новый запрос в чате</b>',
      `ID: <code>${sessionId}</code>`,
      `От: ${session?.user?.name || session?.user?.email || 'Гость'}`,
      '',
      message.body || ''
    ]
    await safeSend(notifyId, lines.join('\n'), {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: 'Ответить в Telegram',
              url: `https://t.me/${bot.options?.username || ''}`
            }
          ],
          [
            {
              text: 'Открыть кабинет',
              url: 'https://gamesale.shop/admin/support'
            }
          ]
        ]
      }
    })
  }

  const notifyOrder = async (order) => {
    if (!order) return
    await safeSend(notifyId, `✅ <b>Новый заказ</b>\n${formatOrderSummary(order)}`)
  }

  const notifyAuth = async ({ provider, displayName, email, steamId }) => {
    const lines = [
      '👤 <b>Авторизация</b>',
      `Способ: ${provider || 'unknown'}`,
      `Имя: ${displayName || '—'}`,
      email ? `Email: ${email}` : null,
      steamId ? `SteamID: ${steamId}` : null
    ].filter(Boolean)
    await safeSend(notifyId, lines.join('\n'))
  }

  const notifyGeneric = async (text) => safeSend(notifyId, text)

  logger.info('[telegram] Bot started')

  return {
    isEnabled: true,
    notifyChatMessage,
    notifyOrder,
    notifyAuth,
    notifyGeneric,
    bot
  }
}

export default initTelegramBot


