import http from 'http'
import express from 'express'
import session from 'express-session'
import passport from 'passport'
import passportSteam from 'passport-steam'
import multer from 'multer'
import compression from 'compression'
import crypto from 'crypto'
const SteamStrategy = passportSteam.Strategy
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import { RedisStore } from 'connect-redis'
import { createClient as createRedisClient } from 'redis'
import { Server as SocketIOServer } from 'socket.io'
import nodemailer from 'nodemailer'
import initTelegramBot from './telegram/telegramBot.js'
import { sendOrderConfirmationEmail, sendOrderReceiptEmail } from './services/emailService.js'
import { getAccountingData, exportToCSV, generateApiKey, validateApiKey } from './services/accountingService.js'

// Загружаем переменные окружения из .env файла
dotenv.config()

const PORT = parseInt(process.env.PORT || '3001', 10)
const SITE_DOMAIN = (process.env.SITE_DOMAIN || 'oneshotgame.shop').trim().toLowerCase()
const RAW_DOMAIN = (process.env.DOMAIN || process.env.APP_DOMAIN || process.env.VERCEL_URL || process.env.RENDER_EXTERNAL_URL || '').trim()
const NORMALIZED_DOMAIN = RAW_DOMAIN ? RAW_DOMAIN.replace(/^https?:\/\//i, '').replace(/\/$/, '') : ''
const IS_PRODUCTION = process.env.NODE_ENV === 'production'
const FALLBACK_DOMAIN = NORMALIZED_DOMAIN || (IS_PRODUCTION ? SITE_DOMAIN : '')
const fallbackHost = FALLBACK_DOMAIN ? `https://${FALLBACK_DOMAIN}` : ''
const stripTrailingSlash = (value = '') => value.replace(/\/$/, '')
const defaultBackendBase = stripTrailingSlash(process.env.BASE_URL || process.env.BACKEND_URL || fallbackHost || `http://localhost:${PORT}`)
const FRONTEND_URL = stripTrailingSlash((process.env.FRONTEND_URL || '').trim() || fallbackHost || 'http://localhost:5173')

const parseHost = (value) => {
  if (!value) return ''
  try {
    const url = new URL(value)
    return url.host.toLowerCase()
  } catch {
    return ''
  }
}

const FRONTEND_HOST = parseHost(FRONTEND_URL)
const allowedFrontendHosts = new Set([FRONTEND_HOST, (FALLBACK_DOMAIN || '').toLowerCase(), (NORMALIZED_DOMAIN || '').toLowerCase(), SITE_DOMAIN, 'www.' + SITE_DOMAIN, 'localhost', '127.0.0.1'].filter(Boolean))

const isAllowedFrontendHost = (host) => allowedFrontendHosts.has(String(host || '').toLowerCase())
const buildAllowedOrigins = () => {
  const collection = new Set([process.env.FRONTEND_URL || '', 'http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:5173', 'https://' + SITE_DOMAIN, 'http://' + SITE_DOMAIN, 'https://www.' + SITE_DOMAIN, 'http://www.' + SITE_DOMAIN].filter(Boolean))
  if (process.env.DOMAIN) {
    const domain = process.env.DOMAIN.replace(/^https?:\/\//i, '')
    if (domain) {
      collection.add(`https://${domain}`)
      collection.add(`http://${domain}`)
    }
  }
  allowedFrontendHosts.forEach((host) => {
    if (!host) return
    try {
      collection.add(`https://${host}`)
      collection.add(`http://${host}`)
    } catch {
      // ignore malformed host strings
    }
  })
  return Array.from(collection)
}
const ALLOWED_ORIGINS = buildAllowedOrigins()
const RETURN_URL = stripTrailingSlash((process.env.RETURN_URL || '').trim()) || `${defaultBackendBase}/auth/steam/return`
const REALM_URL = stripTrailingSlash((process.env.REALM || '').trim()) || `${defaultBackendBase}/`
const STEAM_API_KEY = process.env.STEAM_API_KEY || ''
const ADMIN_API_KEY = (process.env.ADMIN_API_KEY || '').trim()
const TELEGRAM_BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '').trim()
const TELEGRAM_ADMIN_CHAT_ID = (process.env.TELEGRAM_ADMIN_CHAT_ID || '').trim()
const TELEGRAM_NOTIFICATIONS_CHAT_ID = (process.env.TELEGRAM_NOTIFICATIONS_CHAT_ID || '').trim()
const SUPPORT_NOTIFY_EMAIL =
  (process.env.SUPPORT_NOTIFY_EMAIL ||
    process.env.SUPPORT_INBOX_EMAIL ||
    process.env.SUPPORT_EMAIL ||
    '').trim()
const SMTP_HOST = (process.env.SMTP_HOST || '').trim()
const SMTP_PORT = parseInt(process.env.SMTP_PORT || process.env.SMTP_PORT || '0', 10)
const SMTP_SECURE = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true'
const SMTP_USER = (process.env.SMTP_USER || process.env.SMTP_LOGIN || '').trim()
const SMTP_PASS = (process.env.SMTP_PASS || process.env.SMTP_PASSWORD || '').trim()
const PUBLIC_DIR = path.join(process.cwd(), 'public')
const PUBLIC_IMAGES_DIR = path.join(PUBLIC_DIR, 'images')
const SKINS_STATIC_DIR = path.join(PUBLIC_DIR, 'skins-steams')
const fsPromises = fs.promises
const STEAM_CDN_BASE = 'https://cdn.cloudflare.steamstatic.com'
const STEAM_ECONOMY_BASE = 'https://steamcommunity-a.akamaihd.net'
const PASSWORD_ITERATIONS = parseInt(process.env.PASSWORD_ITERATIONS || '120000', 10)
const PASSWORD_KEYLEN = 64
const PASSWORD_DIGEST = 'sha512'
const CORE_DATA_URL = String(process.env.CORE_DATA_URL || process.env.CORE_DATA_BASE || '').trim()
const CORE_DATA_API_KEY = String(process.env.CORE_DATA_API_KEY || process.env.CORE_DATA_TOKEN || '').trim()
const CORE_DATA_SITE_CODE = String(process.env.CORE_DATA_SITE_CODE || 'ai-game-store').trim()
const CORE_DATA_SYNC_INTERVAL_MS = Math.max(
  60000,
  parseInt(process.env.CORE_DATA_SYNC_INTERVAL_MS || process.env.CORE_DATA_SYNC_INTERVAL || '300000', 10)
)
const randomUUID = () =>
  typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex')
const coreDataState = {
  lastAttempt: 0,
  lastSuccess: 0,
  syncing: null,
  lastError: null
}
const isCoreDataEnabled = () => Boolean(CORE_DATA_URL && CORE_DATA_API_KEY && CORE_DATA_SITE_CODE)
async function ensureDirectoryExists(targetPath) {
  try {
    await fsPromises.mkdir(path.dirname(targetPath), { recursive: true })
  } catch (_) {}
}

const createTelegramStub = () => ({
  isEnabled: false,
  notifyChatMessage: () => {},
  notifyOrder: () => {},
  notifyAuth: () => {},
  notifyGeneric: () => {}
})
let telegramBot = createTelegramStub()

function sanitizeRelativePath(input = '') {
  return path
    .normalize(input)
    .replace(/^([.]{2}[\/])+/, '')
    .replace(/^[\/]+/, '')
}

function sanitizeRedirectPath(input = '') {
  if (typeof input !== 'string') return ''
  const trimmed = input.trim()
  if (!trimmed || !trimmed.startsWith('/')) return ''
  if (trimmed.startsWith('//')) return ''
  return trimmed
}

async function serveRemoteImage({
  res,
  remoteUrl,
  localPath,
  cache = true,
  extraHeaders = {},
  onNotFound,
  referer = 'https://store.steampowered.com/'
}) {
  try {
    if (localPath) {
      try {
        await fsPromises.access(localPath, fs.constants.R_OK)
        res.set({ 'Cache-Control': 'public, max-age=604800', ...extraHeaders })
        return res.sendFile(localPath)
      } catch (_) {}
    }

    const response = await fetch(remoteUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Referer': referer
      }
    })

    if (!response.ok) {
      if (typeof onNotFound === 'function') {
        return onNotFound(response)
      }
      return res.status(response.status).send('Image not found')
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg'
    const buffer = Buffer.from(await response.arrayBuffer())

    if (cache && localPath) {
      try {
        await ensureDirectoryExists(localPath)
        await fsPromises.writeFile(localPath, buffer)
      } catch (err) {
        console.warn('[steam-image] Failed to cache image', localPath, err?.message)
      }
    }

    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
      ...extraHeaders
    })
    return res.send(buffer)
  } catch (error) {
    console.error('[steam-image] Error serving', remoteUrl, error?.message)
    if (!res.headersSent) {
      res.status(404).send('Image not available')
    }
  }
}

function resolveBaseFromRequest(req, fallback = defaultBackendBase) {
  if (!req || !req.headers) return fallback
  const proto = String(req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http')).split(',')[0].trim() || 'https'
  const hostHeader = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim()
  if (hostHeader) {
    return stripTrailingSlash(`${proto}://${hostHeader}`)
  }
  return fallback
}

function resolveFrontendFromRequest(req) {
  if (!req) return FRONTEND_URL
  const directOrigin = req.query?.origin || req.headers?.origin
  if (typeof directOrigin === 'string' && /^https?:\/\//i.test(directOrigin)) {
    try {
      const url = new URL(directOrigin)
      if (isAllowedFrontendHost(url.host)) {
        return stripTrailingSlash(`${url.protocol}//${url.host}`)
      }
    } catch {
      // ignore
    }
  }
  const referer = req.headers?.referer
  if (typeof referer === 'string' && /^https?:\/\//i.test(referer)) {
    try {
      const url = new URL(referer)
      if (isAllowedFrontendHost(url.host)) {
        return `${url.protocol}//${url.host}`
      }
    } catch (_) {}
  }
  return resolveBaseFromRequest(req, FRONTEND_URL)
}

if (!STEAM_API_KEY) {
  console.warn('[server] WARNING: STEAM_API_KEY is not set. Steam login will fail until you provide a valid key.')
}

// Простая файловая БД для сообщений по товарам
const DATA_DIR = path.join(process.cwd(), 'data')
const MSG_FILE = path.join(DATA_DIR, 'product_messages.json')
function ensureMessagesFile() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }) } catch {}
  if (!fs.existsSync(MSG_FILE)) {
    fs.writeFileSync(MSG_FILE, JSON.stringify({}, null, 2), 'utf-8')
  }
}
function loadMessages() {
  try {
    const raw = fs.readFileSync(MSG_FILE, 'utf-8')
    return JSON.parse(raw || '{}')
  } catch {
    return {}
  }
}
function saveMessages(obj) {
  try {
    fs.writeFileSync(MSG_FILE, JSON.stringify(obj, null, 2), 'utf-8')
    return true
  } catch {
    return false
  }
}
ensureMessagesFile()
const app = express()
const httpServer = http.createServer(app)
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    credentials: true
  }
})
app.set('trust proxy', 1)
io.use((socket, next) => {
  try {
    const auth = socket.handshake?.auth || {}
    const adminKey = String(auth.adminKey || socket.handshake?.headers?.['x-admin-key'] || '').trim()
    if (ADMIN_API_KEY && adminKey && adminKey === ADMIN_API_KEY) {
      socket.data.isAdmin = true
    } else {
      socket.data.isAdmin = false
    }
    socket.data.sessionId = auth.sessionId || null
  } catch {
    // ignore
  }
  next()
})

const USERS_FILE = path.join(DATA_DIR, 'users.json')

function ensureUsersFile() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }) } catch {}
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2), 'utf-8')
  }
}
ensureUsersFile()

function loadUsers() {
  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf-8')
    const parsed = JSON.parse(raw || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveUsers(list) {
  try {
    const normalized = Array.isArray(list) ? list : []
    fs.writeFileSync(USERS_FILE, JSON.stringify(normalized, null, 2), 'utf-8')
    return true
  } catch (error) {
    console.error('[users] save error', error?.message)
    return false
  }
}

const normalizeEmail = (email) => String(email || '').trim().toLowerCase()

function findUserById(users, id) {
  if (!id) return null
  return (Array.isArray(users) ? users : []).find((user) => user && user.id === id) || null
}

function findUserBySteamId(users, steamId) {
  if (!steamId) return null
  return (Array.isArray(users) ? users : []).find((user) => user && user.steamId === steamId) || null
}

function findUserByEmail(users, email) {
  const normalized = normalizeEmail(email)
  if (!normalized) return null
  return (Array.isArray(users) ? users : []).find((user) => user && normalizeEmail(user.email) === normalized) || null
}

function sanitizeUserForClient(user) {
  if (!user) return null
  const provider = user.provider || (user.steamId ? 'steam' : user.email ? 'local' : 'session')
  const avatar = user.avatar || user.photo || ''
  const displayName = user.displayName || user.personaname || user.email || ''
  return {
    id: user.id || null,
    code: user.code || null,
    steamId: user.steamId || null,
    email: user.email || null,
    displayName,
    avatar,
    photo: avatar,
    provider,
    role: user.role || 'user'
  }
}

function buildSessionUser(user) {
  const safe = sanitizeUserForClient(user)
  if (!safe) return null
  return safe
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(String(password || ''), salt, PASSWORD_ITERATIONS, PASSWORD_KEYLEN, PASSWORD_DIGEST).toString('hex')
  return { hash, salt }
}

function verifyPassword(password, user) {
  if (!user || !user.passwordHash || !user.passwordSalt) return false
  try {
    const computed = crypto.pbkdf2Sync(String(password || ''), user.passwordSalt, PASSWORD_ITERATIONS, PASSWORD_KEYLEN, PASSWORD_DIGEST).toString('hex')
    const a = Buffer.from(computed, 'hex')
    const b = Buffer.from(user.passwordHash, 'hex')
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

// Генерация уникального кода для пользователя
function generateUserCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Исключаем похожие символы (0, O, I, 1)
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// Генерация уникального кода для операции
function generateOperationCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'OP-'
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// Проверка уникальности кода пользователя
function isUserCodeUnique(users, code) {
  return !users.some(u => u.code === code)
}

// Проверка уникальности кода операции
function isOperationCodeUnique(logs, code) {
  return !logs.some(l => l.code === code)
}

function upsertSteamUser({ steamId, displayName, avatar, profile }) {
  if (!steamId) return null
  const users = loadUsers()
  const now = new Date().toISOString()
  let user = findUserBySteamId(users, steamId)
  if (!user) {
    // Генерируем уникальный код для нового пользователя
    let userCode = generateUserCode()
    let attempts = 0
    while (!isUserCodeUnique(users, userCode) && attempts < 10) {
      userCode = generateUserCode()
      attempts++
    }
    
    user = {
      id: randomUUID(),
      code: userCode,
      provider: 'steam',
      steamId,
      displayName: displayName || 'Steam пользователь',
      avatar: avatar || '',
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
      role: 'user'
    }
    if (profile) {
      user.steamProfile = profile
    }
    users.push(user)
  } else {
    // Если у пользователя нет кода, генерируем его
    if (!user.code) {
      let userCode = generateUserCode()
      let attempts = 0
      while (!isUserCodeUnique(users, userCode) && attempts < 10) {
        userCode = generateUserCode()
        attempts++
      }
      user.code = userCode
    }
    if (displayName) user.displayName = displayName
    if (avatar) user.avatar = avatar
    if (profile) user.steamProfile = profile
    user.provider = 'steam'
    user.updatedAt = now
    user.lastLoginAt = now
  }
  saveUsers(users)
  return user
}

function getUserById(id) {
  const users = loadUsers()
  return findUserById(users, id)
}

async function fetchSteamPlayerSummary(steamId) {
  if (!STEAM_API_KEY || !steamId) return null
  try {
    const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${encodeURIComponent(
      STEAM_API_KEY
    )}&steamids=${encodeURIComponent(steamId)}`
    
    // Добавляем таймаут для запроса к Steam API (5 секунд)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      })
      clearTimeout(timeoutId)
      
      if (!response.ok) return null
      const json = await response.json()
      const players = json?.response?.players
      if (Array.isArray(players) && players.length > 0) {
        return players[0]
      }
    } catch (fetchError) {
      clearTimeout(timeoutId)
      if (fetchError.name === 'AbortError') {
        console.warn('[steam] API request timeout for steamId:', steamId)
      } else {
        throw fetchError
      }
    }
  } catch (error) {
    console.warn('[steam] failed to fetch player summary', error?.message)
  }
  return null
}

app.use(cors({
  origin: (origin, callback) => {
    // Разрешаем запросы без origin (например, из браузера или мобильных приложений)
    if (!origin) return callback(null, true)
    
    try {
      const url = new URL(origin)
      const host = url.host.toLowerCase()
      
      // Проверяем разрешенные хосты
      if (isAllowedFrontendHost(host)) {
        return callback(null, true)
      }
      
      // Проверяем разрешенные origins
      if (ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true)
      }
      
      // Разрешаем localhost для разработки
      if (host === 'localhost' || host.startsWith('localhost:') || host === '127.0.0.1' || host.startsWith('127.0.0.1:')) {
        return callback(null, true)
      }
      
      callback(new Error('Not allowed by CORS'))
    } catch {
      callback(new Error('Invalid origin'))
    }
  },
  credentials: true
}))
app.use(express.json())
// Сжатие ответов для ускорения загрузки
app.use(compression())

// Статика для изображений (включая загруженные)
app.get('/images/steam-games/*', async (req, res, next) => {
  try {
    const relative = sanitizeRelativePath(req.path.replace(/^\/images\/steam-games\//i, ''))
    if (!relative) return next()

    const localPath = path.join(PUBLIC_IMAGES_DIR, 'steam-games', relative)
    
    // Сначала проверяем, существует ли локальный файл
    try {
      await fsPromises.access(localPath, fs.constants.R_OK)
      // Файл существует - отдаем его напрямую
      res.set({ 
        'Cache-Control': 'public, max-age=604800',
        'Access-Control-Allow-Origin': '*'
      })
      return res.sendFile(path.resolve(localPath))
    } catch (_) {
      // Локального файла нет - пытаемся загрузить с удаленного сервера
      const remoteUrl = `${STEAM_CDN_BASE}/${relative.replace(/\\/g, '/')}`
      return await serveRemoteImage({
        res,
        remoteUrl,
        localPath,
        extraHeaders: { 'Access-Control-Allow-Origin': '*' },
        onNotFound: () => next()
      })
    }
  } catch (err) {
    console.error('[steam-image] Proxy error', err?.message)
    return next()
  }
})

app.use('/images', express.static(PUBLIC_IMAGES_DIR, {
  maxAge: process.env.NODE_ENV === 'production' ? '30d' : 0,
  etag: true
}))
app.use('/images/skins-steams', express.static(SKINS_STATIC_DIR, {
  maxAge: process.env.NODE_ENV === 'production' ? '30d' : 0,
  etag: true
}))
const redisEnabled = String(process.env.ENABLE_REDIS || '').toLowerCase() === '1'
let redisStoreInstance = null
if (redisEnabled) {
  try {
    const redisUrl = process.env.REDIS_URL || ''
    const redisHost = process.env.REDIS_HOST || '127.0.0.1'
    const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10)
    const redisPassword = process.env.REDIS_PASSWORD || undefined
    const useTls = String(process.env.REDIS_TLS || '').toLowerCase() === '1'

    const redisClient = createRedisClient({
      legacyMode: true,
      url: redisUrl || undefined,
      password: redisPassword,
      socket: redisUrl
        ? undefined
        : {
            host: redisHost,
            port: redisPort,
            tls: useTls ? {} : undefined
          }
    })

    redisClient.on('error', (err) => {
      console.error('[redis] Client error', err?.message)
    })
    redisClient.connect().catch((err) => {
      console.error('[redis] Connect error', err?.message)
    })

    redisStoreInstance = new RedisStore({
      client: redisClient,
      prefix: process.env.REDIS_PREFIX || 'session:'
    })
    console.log('[redis] Session store initialized')
  } catch (error) {
    console.error('[redis] Failed to initialize Redis store, falling back to MemoryStore', error?.message)
  }
}

const resolveSecureCookieSetting = () => {
  const explicit = String(process.env.SESSION_COOKIE_SECURE || '').trim().toLowerCase()
  if (explicit === 'true' || explicit === '1') return true
  if (explicit === 'false' || explicit === '0') return false
  return 'auto'
}

const sessionOptions = {
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: resolveSecureCookieSetting(),
    sameSite: (process.env.SESSION_COOKIE_SAMESITE || 'lax').toLowerCase(),
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 часа
  }
}

if (redisStoreInstance) {
  sessionOptions.store = redisStoreInstance
} else if (redisEnabled) {
  console.warn('[session] Redis store not available, using in-memory store as fallback')
}

app.use(session(sessionOptions))
app.use(passport.initialize())
app.use(passport.session())

passport.serializeUser((user, done) => done(null, user))
passport.deserializeUser((obj, done) => done(null, obj))

passport.use(new SteamStrategy({
  returnURL: RETURN_URL,
  realm: REALM_URL,
  apiKey: STEAM_API_KEY
}, (identifier, profile, done) => {
  // profile contains .id, .displayName, .photos
  profile.identifier = identifier
  return done(null, profile)
}))

app.get('/auth/steam', (req, res, next) => {
  if (req.session) {
    req.session.steamRedirect = resolveFrontendFromRequest(req)
    const redirectPath = sanitizeRedirectPath(req.query?.redirect)
    if (redirectPath) {
      req.session.steamRedirectPath = redirectPath
    } else {
      delete req.session.steamRedirectPath
    }
  }
  passport.authenticate('steam', { session: true })(req, res, next)
})

app.get('/auth/steam/return', (req, res, next) => {
  const failureBase = resolveFrontendFromRequest(req) || FRONTEND_URL
  const storedRedirectPath = req.session ? sanitizeRedirectPath(req.session.steamRedirectPath) : ''
  const buildFailureRedirect = (reason = 'steam_error') => {
    try {
      const url = new URL(storedRedirectPath || '/profile', failureBase)
      url.searchParams.set('login', 'failed')
      if (reason) url.searchParams.set('reason', reason)
      return url.toString()
      } catch {
        const base = failureBase.replace(/\/$/, '')
        const path = storedRedirectPath || '/profile'
        const separator = path.includes('?') ? '&' : '?'
        return `${base}${path}${separator}login=failed&reason=${encodeURIComponent(reason)}`
    }
  }

  passport.authenticate('steam', (err, user) => {
    if (err) {
      if (err?.openidError?.message === 'Invalid or replayed nonce') {
        const nonce = req.query?.['openid.response_nonce']
        let skewSeconds = null
        if (nonce && typeof nonce === 'string') {
          const nonceTs = nonce.split('Z')[0]
          try {
            const nonceDate = new Date(`${nonceTs}Z`)
            if (Number.isFinite(nonceDate.getTime())) {
              skewSeconds = Math.round((Date.now() - nonceDate.getTime()) / 1000)
            }
          } catch (_) {}
        }
        console.warn('[auth/steam/return] invalid nonce', {
          nonce,
          skewSeconds,
          now: new Date().toISOString(),
          sessionId: req.sessionID || null
        })
      } else {
        console.error('[auth/steam/return] strategy error', err)
      }
      const failureRedirect = buildFailureRedirect('steam_error')
      if (req.session) {
        delete req.session.steamRedirect
        delete req.session.steamRedirectPath
        return req.session.save(() => res.redirect(failureRedirect))
      }
      return res.redirect(failureRedirect)
    }

    if (!user) {
      const failureRedirect = buildFailureRedirect('no_user')
      if (req.session) {
        delete req.session.steamRedirect
        delete req.session.steamRedirectPath
        return req.session.save(() => res.redirect(failureRedirect))
      }
      return res.redirect(failureRedirect)
    }

    const processSteamLogin = async () => {
      const avatar = Array.isArray(user.photos) && user.photos[0] && user.photos[0].value
      
      // Сначала создаем пользователя с базовыми данными для быстрой авторизации
      const storedUser = upsertSteamUser({
        steamId: user.id,
        displayName: user.displayName,
        avatar,
        profile: undefined // Профиль загрузим асинхронно
      })
      if (!storedUser) {
        throw new Error('steam_user_upsert_failed')
      }
      const sessionUser = buildSessionUser(storedUser)
      if (!sessionUser) {
        throw new Error('invalid_session_user')
      }

      // Загружаем детали профиля асинхронно в фоне (не блокируем авторизацию)
      if (user.id) {
        fetchSteamPlayerSummary(user.id).then(profileDetails => {
          if (profileDetails) {
            upsertSteamUser({
              steamId: user.id,
              displayName: user.displayName,
              avatar,
              profile: profileDetails
            })
          }
        }).catch(err => {
          console.warn('[steam] Background profile fetch failed', err?.message)
        })
      }

      req.logIn(sessionUser, (loginErr) => {
        if (loginErr) {
          console.error('[auth/steam/return] login error', loginErr)
          const failureRedirect = buildFailureRedirect('session_error')
          if (req.session) {
            delete req.session.steamRedirect
            delete req.session.steamRedirectPath
            return req.session.save(() => res.redirect(failureRedirect))
          }
          return res.redirect(failureRedirect)
        }

        let redirectBase = FRONTEND_URL
        if (telegramBot?.notifyAuth && typeof telegramBot.notifyAuth === 'function') {
          try {
            telegramBot.notifyAuth({
              provider: 'steam',
              displayName: sessionUser.displayName,
              email: storedUser?.email || null,
              steamId: storedUser?.steamId || user.id || null
            })
          } catch (error) {
            console.warn('[telegram] steam auth notify error', error?.message)
          }
        }
        if (req.session?.steamRedirect) {
          const host = parseHost(req.session.steamRedirect)
          if (isAllowedFrontendHost(host)) {
            redirectBase = stripTrailingSlash(req.session.steamRedirect)
          }
        }
        if (!redirectBase) {
          redirectBase = FRONTEND_URL
        }
        if (req.session) {
          // Используем только данные из storedUser, так как profileDetails загружается асинхронно
          if (storedUser?.steamProfile) {
            req.session.steamProfile = storedUser.steamProfile
          } else {
            delete req.session.steamProfile
          }
          delete req.session.steamRedirect
          delete req.session.steamRedirectPath
        }

        let destination
        try {
          const url = new URL(storedRedirectPath || '/profile', redirectBase)
          url.searchParams.set('login', 'steam')
          if (storedUser.steamId) url.searchParams.set('steamid', storedUser.steamId)
          if (sessionUser.displayName) url.searchParams.set('name', sessionUser.displayName)
          if (sessionUser.photo) url.searchParams.set('photo', sessionUser.photo)
          destination = url.toString()
        } catch {
          const base = redirectBase.replace(/\/$/, '')
          const path = storedRedirectPath || '/profile'
          const separator = path.includes('?') ? '&' : '?'
          const queryParts = [`login=steam`]
          if (storedUser.steamId) queryParts.push(`steamid=${encodeURIComponent(storedUser.steamId)}`)
          if (sessionUser.displayName) queryParts.push(`name=${encodeURIComponent(sessionUser.displayName)}`)
          if (sessionUser.photo) queryParts.push(`photo=${encodeURIComponent(sessionUser.photo)}`)
          destination = `${base}${path}${separator}${queryParts.join('&')}`
        }

        if (req.session) {
          return req.session.save(() => res.redirect(destination))
        }
        return res.redirect(destination)
      })
    }

    processSteamLogin().catch((processError) => {
      console.error('[auth/steam/return] processing error', processError?.message)
      const failureRedirect = buildFailureRedirect('steam_error')
      if (req.session) {
        delete req.session.steamRedirect
        delete req.session.steamRedirectPath
        return req.session.save(() => res.redirect(failureRedirect))
      }
      return res.redirect(failureRedirect)
    })
  })(req, res, next)
})

app.post('/auth/logout', (req, res) => {
  try {
    if (typeof req.logout === 'function') {
      req.logout(() => res.json({ ok: true }))
    } else {
      req.session.destroy(() => res.json({ ok: true }))
    }
  } catch (_) {
    res.json({ ok: true })
  }
})

app.post('/auth/register', (req, res) => {
  const body = req.body || {}
  const email = normalizeEmail(body.email)
  const password = String(body.password || '')
  const rawName = String(body.name || body.displayName || '').trim()

  if (!email) {
    return res.status(400).json({ ok: false, error: 'invalid_email' })
  }
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailPattern.test(email)) {
    return res.status(400).json({ ok: false, error: 'invalid_email' })
  }
  if (password.length < 6) {
    return res.status(400).json({ ok: false, error: 'weak_password' })
  }

  const users = loadUsers()
  if (findUserByEmail(users, email)) {
    return res.status(409).json({ ok: false, error: 'email_taken' })
  }

  const { hash, salt } = hashPassword(password)
  const now = new Date().toISOString()
  
  // Генерируем уникальный код для нового пользователя
  let userCode = generateUserCode()
  let attempts = 0
  while (!isUserCodeUnique(users, userCode) && attempts < 10) {
    userCode = generateUserCode()
    attempts++
  }
  
  const userRecord = {
    id: randomUUID(),
    code: userCode,
    provider: 'local',
    email,
    displayName: rawName || email.split('@')[0] || 'Пользователь',
    avatar: '',
    passwordHash: hash,
    passwordSalt: salt,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
    role: 'user'
  }
  users.push(userRecord)
  if (!saveUsers(users)) {
    return res.status(500).json({ ok: false, error: 'persist_failed' })
  }

  const sessionUser = buildSessionUser(userRecord)
  if (!sessionUser) {
    return res.status(500).json({ ok: false, error: 'session_init_failed' })
  }

  req.logIn(sessionUser, (loginErr) => {
    if (loginErr) {
      console.error('[auth/register] login error', loginErr)
      return res.status(500).json({ ok: false, error: 'session_error' })
    }
    if (req.session) {
      delete req.session.steamProfile
    }
    const payload = sanitizeUserForClient(userRecord)
    if (!payload) {
      return res.status(500).json({ ok: false, error: 'session_error' })
    }
    if (telegramBot?.notifyAuth && typeof telegramBot.notifyAuth === 'function') {
      try {
        telegramBot.notifyAuth({
          provider: 'local',
          displayName: payload.displayName,
          email: payload.email
        })
      } catch (error) {
        console.warn('[telegram] auth notify error', error?.message)
      }
    }
    if (req.session) {
      return req.session.save(() => res.json({ ok: true, ...payload }))
    }
    return res.json({ ok: true, ...payload })
  })
})

app.post('/auth/login', (req, res) => {
  const body = req.body || {}
  const email = normalizeEmail(body.email)
  const password = String(body.password || '')

  if (!email || password.length === 0) {
    return res.status(400).json({ ok: false, error: 'invalid_credentials' })
  }

  const users = loadUsers()
  const userRecord = findUserByEmail(users, email)

  if (!userRecord || (!userRecord.passwordHash || !verifyPassword(password, userRecord))) {
    return res.status(400).json({ ok: false, error: 'invalid_credentials' })
  }

  userRecord.lastLoginAt = new Date().toISOString()
  userRecord.updatedAt = userRecord.lastLoginAt
  saveUsers(users)

  const sessionUser = buildSessionUser(userRecord)
  if (!sessionUser) {
    return res.status(500).json({ ok: false, error: 'session_init_failed' })
  }

  console.log('[auth/login] Logging in user:', { id: sessionUser.id, email: sessionUser.email, role: sessionUser.role })

  req.logIn(sessionUser, (loginErr) => {
    if (loginErr) {
      console.error('[auth/login] login error', loginErr)
      return res.status(500).json({ ok: false, error: 'session_error' })
    }
    if (req.session) {
      delete req.session.steamProfile
    }
    const payload = sanitizeUserForClient(userRecord)
    if (!payload) {
      return res.status(500).json({ ok: false, error: 'session_error' })
    }
    console.log('[auth/login] Login successful, payload:', { id: payload.id, email: payload.email, role: payload.role })
    if (telegramBot?.notifyAuth && typeof telegramBot.notifyAuth === 'function') {
      try {
        telegramBot.notifyAuth({
          provider: 'local',
          displayName: payload.displayName,
          email: payload.email
        })
      } catch (error) {
        console.warn('[telegram] auth notify error', error?.message)
      }
    }
    if (req.session) {
      return req.session.save(() => res.json({ ok: true, ...payload }))
    }
    return res.json({ ok: true, ...payload })
  })
})

// Эквайринг: заглушки эндпоинтов под интеграцию платежей
app.post('/payments/intent', (req, res) => {
  const { amount, currency = 'USD', orderId } = req.body || {}
  if (!amount || amount <= 0) return res.status(400).json({ ok: false, error: 'invalid_amount' })
  // TODO: Интеграция с провайдером эквайринга: создать платежный интент/сессию
  return res.json({ ok: true, orderId: orderId || `order_${Date.now()}`, amount, currency, status: 'created' })
})

app.post('/payments/callback', (req, res) => {
  // TODO: Проверка подписи провайдера и обновление статуса заказа
  return res.json({ ok: true })
})

// База данных сообщений по товарам
app.get('/product-messages', (req, res) => {
  const all = loadMessages()
  res.json({ ok: true, data: all })
})
app.get('/product-messages/:productId', (req, res) => {
  const { productId } = req.params
  const all = loadMessages()
  res.json({ ok: true, productId, data: all[productId] || null })
})
app.put('/product-messages/:productId', (req, res) => {
  const { productId } = req.params
  const payload = req.body || {}
  const all = loadMessages()
  all[productId] = { ...(all[productId] || {}), ...payload }
  const ok = saveMessages(all)
  res.json({ ok, productId, data: all[productId] || null })
})
app.get('/auth/status', (req, res) => {
  try {
    const isAuth = req.isAuthenticated && req.isAuthenticated()
    console.log('[auth/status] isAuthenticated:', isAuth)
    console.log('[auth/status] req.user:', req.user ? { id: req.user.id, email: req.user.email, role: req.user.role } : null)
    
    if (isAuth) {
      const sessionUser = req.user || {}
      const storedUser = sessionUser.id ? getUserById(sessionUser.id) : null
      console.log('[auth/status] storedUser:', storedUser ? { id: storedUser.id, email: storedUser.email, role: storedUser.role } : null)
      
      const payload = sanitizeUserForClient(storedUser || sessionUser)
      console.log('[auth/status] payload:', payload ? { id: payload.id, email: payload.email, role: payload.role } : null)
      
      if (!payload) {
        return res.json({ ok: false })
      }
      return res.json({
        ok: true,
        ...payload,
        profile: req.session?.steamProfile || storedUser?.steamProfile || null
      })
    }
    res.json({ ok: false })
  } catch (error) {
    console.error('[auth/status] error:', error?.message)
    res.json({ ok: false, error: error?.message })
  }
})

io.on('connection', (socket) => {
  const markReadTarget = socket.data.isAdmin ? 'admin' : 'user'

  const joinSessionRoom = (sessionId) => {
    if (!sessionId) return null
    const sessions = loadChatSessions()
    const session = findChatSessionById(sessions, sessionId)
    if (!session) return null
    socket.join(sessionId)
    let updated = false
    if (markReadTarget === 'admin' && session.unreadForAdmin) {
      session.unreadForAdmin = false
      updated = true
    } else if (markReadTarget === 'user' && session.unreadForUser) {
      session.unreadForUser = false
      updated = true
    }
    if (updated) {
      session.updatedAt = new Date().toISOString()
      saveChatSessions(sessions)
      io.to('admins').emit('chat:session-updated', summarizeChatSession(session))
    }
    socket.emit('chat:session', session)
    return session
  }

  if (socket.data.isAdmin) {
    socket.join('admins')
  }
  if (socket.data.sessionId) {
    joinSessionRoom(socket.data.sessionId)
  }

  socket.on('chat:join', (payload = {}, callback) => {
    try {
      const requestedSession = payload.sessionId || payload.id || null
      const adminKey = String(payload.adminKey || '').trim()
      if (ADMIN_API_KEY && adminKey && adminKey === ADMIN_API_KEY) {
        socket.data.isAdmin = true
        socket.join('admins')
      }
      const session = joinSessionRoom(requestedSession)
      if (!session) {
        callback?.({ ok: false, error: 'not_found' })
        return
      }
      callback?.({ ok: true, session })
    } catch (error) {
      console.error('[socket] chat:join error', error?.message)
      callback?.({ ok: false, error: 'server_error' })
    }
  })

  socket.on('chat:update-user', (payload = {}, callback) => {
    try {
      const sessionId = payload.sessionId || payload.id || socket.data.sessionId || null
      if (!sessionId) {
        callback?.({ ok: false, error: 'session_id_required' })
        return
      }
      const sessions = loadChatSessions()
      let session = findChatSessionById(sessions, sessionId)
      if (!session) {
        // Создаем новую сессию если ее нет
        const now = new Date().toISOString()
        session = {
          id: sessionId,
          createdAt: now,
          updatedAt: now,
          lastMessageAt: null,
          status: 'open',
          messages: [],
          user: { name: null, email: null },
          unreadForAdmin: false,
          unreadForUser: false
        }
        sessions.push(session)
      }
      
      // Обновляем данные пользователя
      if (payload.user) {
        if (!session.user) {
          session.user = { name: null, email: null }
        }
        if (payload.user.name && !session.user.name) {
          session.user.name = String(payload.user.name).trim()
        }
        if (payload.user.email && !session.user.email) {
          session.user.email = String(payload.user.email).trim()
        }
      }
      
      session.updatedAt = new Date().toISOString()
      saveChatSessions(sessions)
      socket.emit('chat:session', session)
      callback?.({ ok: true, session })
    } catch (error) {
      console.error('[socket] chat:update-user error', error?.message)
      callback?.({ ok: false, error: 'server_error' })
    }
  })

  socket.on('chat:message', (payload = {}, callback) => {
    try {
      let sessionId = payload.sessionId || payload.id || socket.data.sessionId || null
      const text = String(payload.body || payload.message || '').trim()
      if (!text) {
        callback?.({ ok: false, error: 'message_required' })
        return
      }
      const now = new Date().toISOString()
      const sessions = loadChatSessions()
      let session = sessionId ? findChatSessionById(sessions, sessionId) : null
      if (!session) {
        sessionId = sessionId || generateChatSessionId()
        session = {
          id: sessionId,
          createdAt: now,
          updatedAt: now,
          lastMessageAt: now,
          status: 'open',
          messages: [],
          user: { name: null, email: null },
          unreadForAdmin: false,
          unreadForUser: false
        }
        sessions.push(session)
      }
      const authorRole = socket.data.isAdmin ? 'admin' : 'user'
      if (authorRole === 'user') {
        // Сохраняем данные пользователя, если они переданы, но не перезаписываем существующие
        const newName = String(payload.user?.name || payload.authorName || payload.meta?.name || '').trim()
        const newEmail = String(payload.user?.email || payload.email || payload.meta?.email || '').trim()
        
        // Обновляем только если данных еще нет или переданы новые данные
        if (!session.user) {
          session.user = { name: null, email: null }
        }
        
        if (newName && !session.user.name) {
          session.user.name = newName
        }
        if (newEmail && !session.user.email) {
          session.user.email = newEmail
        }
      }
      // Извлекаем данные пользователя из meta, если переданы
      if (payload.meta) {
        if (payload.meta.name && !session.user?.name) {
          if (!session.user) session.user = { name: null, email: null }
          session.user.name = String(payload.meta.name).trim()
        }
        if (payload.meta.email && !session.user?.email) {
          if (!session.user) session.user = { name: null, email: null }
          session.user.email = String(payload.meta.email).trim()
        }
      }
      
      // Используем сохраненные данные пользователя из сессии
      const authorName = payload.authorName || 
        (authorRole === 'admin' ? 'Operator' : session.user?.name || 'Пользователь')
      
      const message = appendChatMessage(session, {
        authorRole,
        authorName: authorName,
        body: text,
        meta: {
          ...(payload.meta || {}),
          paymentId: payload.meta?.paymentId || null,
          email: session.user?.email || payload.meta?.email || null,
          name: session.user?.name || payload.meta?.name || null
        }
      })
      if (authorRole === 'admin') {
        session.unreadForAdmin = false
        session.unreadForUser = true
      }
      saveChatSessions(sessions)
      socket.join(sessionId)
      socket.emit('chat:session', session)
      io.to(sessionId).emit('chat:message', { sessionId, message })
      io.to('admins').emit('chat:session-updated', summarizeChatSession(session))
      callback?.({ ok: true, sessionId, message, session })
      if (authorRole === 'user') {
        notifySupportOperators(session, message)
      }
    } catch (error) {
      console.error('[socket] chat:message error', error?.message)
      callback?.({ ok: false, error: 'server_error' })
    }
  })

  socket.on('chat:markRead', (payload = {}, callback) => {
    try {
      const sessionId = payload.sessionId || payload.id
      const target = payload.target || (socket.data.isAdmin ? 'admin' : 'user')
      const sessions = loadChatSessions()
      const session = findChatSessionById(sessions, sessionId)
      if (!session) {
        callback?.({ ok: false, error: 'not_found' })
        return
      }
      if (target === 'admin') {
        if (!socket.data.isAdmin && ADMIN_API_KEY) {
          callback?.({ ok: false, error: 'forbidden' })
          return
        }
        session.unreadForAdmin = false
      } else {
        session.unreadForUser = false
      }
      session.updatedAt = new Date().toISOString()
      saveChatSessions(sessions)
      socket.emit('chat:session', session)
      io.to('admins').emit('chat:session-updated', summarizeChatSession(session))
      callback?.({ ok: true, session })
    } catch (error) {
      console.error('[socket] chat:markRead error', error?.message)
      callback?.({ ok: false, error: 'server_error' })
    }
  })
})

// Файловая БД для динамических продуктов (бот)
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json')
const BLOCKED_PRODUCT_KEYS = new Set([
  'rvthereyet',
  'rvthereyet1762859157944',
  'arcraidersupgradetodeluxeedition',
  'fallout4creationsbundle1762829333208',
  'fallout4creationsbundle',
  'steamdeckvalvecertifiedrefurbished',
  'steam:3868650',
  'steam:3948510',
  'steam:2550670'
])
const sanitizeProductKey = (value = '') =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
const getProductKey = (product) => {
  if (!product) return ''
  if (product.steamAppId) return `steam:${product.steamAppId}`
  return sanitizeProductKey(product.name || product.id)
}
const hasLocalProductImage = (product) => {
  if (!product) return false
  const check = (src) => typeof src === 'string' && src.startsWith('/images/')
  if (check(product?.image) || check(product?.introImage)) return true
  if (Array.isArray(product?.images)) return product.images.some(check)
  return false
}
const pickPreferredProduct = (current, candidate) => {
  if (!current) return candidate
  if (!candidate) return current
  const currentLocal = hasLocalProductImage(current)
  const candidateLocal = hasLocalProductImage(candidate)
  if (currentLocal !== candidateLocal) {
    return candidateLocal ? candidate : current
  }
  const currentImages = Array.isArray(current.images) ? current.images.length : 0
  const candidateImages = Array.isArray(candidate.images) ? candidate.images.length : 0
  if (candidateImages !== currentImages) {
    return candidateImages > currentImages ? candidate : current
  }
  if (!current.description && candidate.description) return candidate
  if (current.description && !candidate.description) return current
  if ((!current.price || current.price <= 0) && candidate.price) return candidate
  if ((!candidate.price || candidate.price <= 0) && current.price) return current
  return current
}
const normalizePrice = (price) => {
  // Конвертируем строку в число если нужно
  let numPrice = price
  if (typeof price === 'string') {
    numPrice = parseFloat(price) || 0
  }
  if (typeof numPrice !== 'number' || isNaN(numPrice) || numPrice <= 0) {
    // Если цена невалидна, возвращаем исходное значение
    return price
  }
  
  // Если цена меньше 100, вероятно это USD цена со Steam - конвертируем в рубли
  // Курс USD к RUB примерно 90-100
  const USD_TO_RUB_RATE = 95
  if (numPrice < 100 && numPrice > 0) {
    numPrice = numPrice * USD_TO_RUB_RATE
  }
  
  // Убеждаемся, что цена минимум 1000 рублей
  if (numPrice < 1000) {
    return 1000
  }
  
  // Округляем до целого числа (рубли)
  return Math.round(numPrice)
}

const normalizeProductsList = (list = []) => {
  const map = new Map()
  for (const item of Array.isArray(list) ? list : []) {
    if (!item) continue
    const key = getProductKey(item)
    if (!key || BLOCKED_PRODUCT_KEYS.has(key)) continue
    // Нормализуем цену перед обработкой
    const normalizedItem = (item.price !== undefined && item.price !== null)
      ? { ...item, price: normalizePrice(item.price) }
      : item
    const existing = map.get(key)
    const preferred = pickPreferredProduct(existing, normalizedItem)
    // Убеждаемся, что финальная цена также нормализована
    if (preferred && (preferred.price !== undefined && preferred.price !== null)) {
      map.set(key, { ...preferred, price: normalizePrice(preferred.price) })
    } else {
      map.set(key, preferred)
    }
  }
  return Array.from(map.values())
}
function ensureProductsFile() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }) } catch {}
  if (!fs.existsSync(PRODUCTS_FILE)) {
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify([], null, 2), 'utf-8')
  }
}
function loadProducts() {
  try {
    const raw = fs.readFileSync(PRODUCTS_FILE, 'utf-8')
    const parsed = JSON.parse(raw || '[]')
    const normalized = normalizeProductsList(parsed)
    if (normalized.length !== parsed.length) {
      try {
        fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(normalized, null, 2), 'utf-8')
      } catch (_) {}
    }
    return normalized
  } catch {
    return []
  }
}

// Подключаем роуты для авторизации, баланса, Steam инвентаря и платежей
(async () => {
  try {
    const authRoutes = (await import('./routes/auth.js')).default
    const balanceRoutes = (await import('./routes/balance.js')).default
    const steamInventoryRoutes = (await import('./routes/steamInventory.js')).default
    const paymentsRoutes = (await import('./routes/payments.js')).default
    app.use('/api/auth', authRoutes)
    app.use('/api/balance', balanceRoutes)
    app.use('/api/steam', steamInventoryRoutes)
    app.use('/api/payments', paymentsRoutes)
    console.log('[server] Auth, balance, Steam inventory and payments routes loaded')
  } catch (error) {
    console.warn('[server] Failed to load routes:', error?.message)
  }
})()

httpServer.listen(PORT, () => {
  console.log(`[server] Steam auth server running on ${defaultBackendBase}`)
})
function saveProducts(list) {
  try {
    const normalized = normalizeProductsList(list)
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(normalized, null, 2), 'utf-8')
    return true
  } catch {
    return false
  }
}
function buildCoreDataUrl(pathname = '/') {
  if (!CORE_DATA_URL) return ''
  try {
    return new URL(pathname, CORE_DATA_URL).toString()
  } catch (_) {
    const base = CORE_DATA_URL.replace(/\/+$/, '')
    return `${base}${pathname.startsWith('/') ? pathname : `/${pathname}`}`
  }
}
function mapCoreItemToProduct(item) {
  if (!item) return null
  const rawMetadata = item.metadata && typeof item.metadata === 'object' ? item.metadata : {}
  const rawProduct =
    rawMetadata && typeof rawMetadata.raw === 'object' && rawMetadata.raw
      ? rawMetadata.raw
      : {}
  const base = { ...rawProduct, ...item }
  const id = base.id || item.id
  if (!id) return null
  const coreSite = item.site || {}
  const mergedImages = Array.isArray(base.images) && base.images.length
    ? base.images
    : Array.isArray(item.images) && item.images.length
      ? item.images
      : []
  const singleImage =
    base.image ||
    base.introImage ||
    base.coverImage ||
    (mergedImages.length ? mergedImages[0] : null)
  const price =
    (coreSite.price !== undefined ? coreSite.price : undefined) ??
    base.sitePrice ??
    base.price ??
    null
  const currency =
    coreSite.currency ||
    base.siteCurrency ||
    base.currency ||
    'USD'
  const stock =
    (coreSite.stock !== undefined ? coreSite.stock : undefined) ??
    base.stock ??
    null
  const specs =
    base.specs ||
    (rawProduct && rawProduct.specs) ||
    {}
  const descriptionHtml =
    base.descriptionHtml ||
    base.description_html ||
    rawProduct.descriptionHtml ||
    ''
  const description =
    base.description ||
    rawProduct.description ||
    ''
  const category =
    base.category ||
    rawProduct.category ||
    'game'
  const type =
    base.type ||
    rawProduct.type ||
    null
  const mapped = {
    ...rawProduct,
    ...base,
    id,
    name: base.name || rawProduct.name || '',
    price,
    currency,
    stock: stock === undefined ? null : stock,
    image: singleImage || null,
    introImage: base.introImage || singleImage || null,
    images: Array.from(new Set(mergedImages.length ? mergedImages : singleImage ? [singleImage] : [])),
    description,
    descriptionHtml,
    specs,
    category,
    type,
    source: base.source || rawProduct.source || 'core',
    steamAppId:
      base.steamAppId ||
      base.steam_app_id ||
      rawProduct.steamAppId ||
      rawProduct.steam_app_id ||
      null,
    metadata: {
      ...(typeof rawProduct.metadata === 'object' ? rawProduct.metadata : {}),
      core: rawMetadata,
      coreSite
    }
  }
  return mapped
}
async function fetchCatalogFromCore() {
  if (!isCoreDataEnabled()) return []
  const url = buildCoreDataUrl(`/catalog/${encodeURIComponent(CORE_DATA_SITE_CODE)}?status=active`)
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${CORE_DATA_API_KEY}`,
      'Content-Type': 'application/json'
    }
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`core_data_http_${response.status}: ${text.slice(0, 200)}`)
  }
  const payload = await response.json().catch(() => null)
  if (!payload || payload.ok !== true || !Array.isArray(payload.items)) {
    throw new Error('core_data_invalid_payload')
  }
  return payload.items
}
async function syncProductsFromCore({ force = false } = {}) {
  if (!isCoreDataEnabled()) return { ok: false, reason: 'disabled' }
  const nowTs = Date.now()
  if (!force && coreDataState.lastAttempt && nowTs - coreDataState.lastAttempt < CORE_DATA_SYNC_INTERVAL_MS) {
    return { ok: true, skipped: true, reason: 'interval' }
  }
  if (coreDataState.syncing) {
    return coreDataState.syncing
  }
  coreDataState.syncing = (async () => {
    coreDataState.lastAttempt = Date.now()
    try {
      const items = await fetchCatalogFromCore()
      const mapped = items
        .map((item) => {
          try {
            return mapCoreItemToProduct(item)
          } catch (err) {
            console.warn('[core-sync] map error', err?.message)
            return null
          }
        })
        .filter(Boolean)
      const existing = loadProducts()
      const mergedMap = new Map()
      for (const product of mapped) {
        mergedMap.set(product.id, product)
      }
      for (const product of existing) {
        if (!mergedMap.has(product.id)) {
          mergedMap.set(product.id, product)
        }
      }
      const mergedList = Array.from(mergedMap.values())
      saveProducts(mergedList)
      coreDataState.lastSuccess = Date.now()
      coreDataState.lastError = null
      console.info('[core-sync] synchronized products from core service', {
        remoteCount: mapped.length,
        total: mergedList.length
      })
      return { ok: true, remoteCount: mapped.length, total: mergedList.length }
    } catch (error) {
      coreDataState.lastError = error?.message || 'unknown_error'
      console.warn('[core-sync] failed', error?.message)
      return { ok: false, error: coreDataState.lastError }
    } finally {
      coreDataState.syncing = null
    }
  })()
  return coreDataState.syncing
}
ensureProductsFile()
if (isCoreDataEnabled()) {
  syncProductsFromCore({ force: true }).catch((error) => {
    console.warn('[core-sync] initial sync failed', error?.message)
  })
  try {
    const timer = setInterval(() => {
      syncProductsFromCore().catch((error) => {
        console.warn('[core-sync] interval sync failed', error?.message)
      })
    }, CORE_DATA_SYNC_INTERVAL_MS)
    if (typeof timer.unref === 'function') {
      timer.unref()
    }
  } catch (err) {
    console.warn('[core-sync] setInterval failed', err?.message)
  }
}
// Настройка загрузки изображений
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'images', 'uploads')
try { fs.mkdirSync(UPLOADS_DIR, { recursive: true }) } catch {}
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const safe = (str) => String(str).toLowerCase().replace(/[^a-z0-9\-_.]+/g, '-').replace(/^-+|-+$/g, '')
    const ext = path.extname(file.originalname || '') || '.jpg'
    const base = safe((req.body && req.body.name) || 'product')
    cb(null, `${base}-${Date.now()}${ext}`)
  }
})
const upload = multer({ storage })
// Динамические продукты: выдача
app.get('/products', (req, res) => {
  const list = loadProducts()
  // Фильтруем скрытые игры (hidden: true)
  const visible = list.filter((item) => !item.hidden)
  res.json({ ok: true, data: visible })
})
app.get('/products/:id', (req, res) => {
  const { id } = req.params || {}
  if (!id) {
    return res.status(400).json({ ok: false, error: 'missing_id' })
  }
  const list = loadProducts()
  const match = list.find((item) => String(item.id) === String(id))
  if (!match) {
    return res.status(404).json({ ok: false, error: 'not_found' })
  }
  // Если игра скрыта, возвращаем 404
  if (match.hidden) {
    return res.status(404).json({ ok: false, error: 'not_found' })
  }
  return res.json({ ok: true, data: match })
})
// Версия каталога по времени изменения файла
app.get('/products/version', (req, res) => {
  try {
    const stat = fs.statSync(PRODUCTS_FILE)
    return res.json({ ok: true, version: Math.floor(stat.mtimeMs) })
  } catch {
    return res.json({ ok: true, version: 0 })
  }
})
app.get('/core/sync-status', (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ ok: false, error: 'forbidden' })
  }
  return res.json({
    ok: true,
    enabled: isCoreDataEnabled(),
    lastAttempt: coreDataState.lastAttempt,
    lastSuccess: coreDataState.lastSuccess,
    lastError: coreDataState.lastError
  })
})
app.post('/core/sync', async (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ ok: false, error: 'forbidden' })
  }
  try {
    const result = await syncProductsFromCore({ force: true })
    return res.json({ ok: true, result, state: coreDataState })
  } catch (error) {
    return res.status(500).json({ ok: false, error: error?.message || 'core_sync_failed' })
  }
})
// Массовый импорт всех продуктов из products.json в базу данных
app.post('/bot/import-all-products', async (req, res) => {
  // Разрешаем импорт без админ-права для локального использования
  // if (!isAdminRequest(req)) {
  //   return res.status(403).json({ ok: false, error: 'forbidden' })
  // }
  try {
    const allProducts = loadProducts()
    const results = {
      total: allProducts.length,
      imported: 0,
      skipped: 0,
      failed: 0,
      errors: []
    }

    for (const product of allProducts) {
      try {
        // Импортируем только Steam игры (с steamAppId)
        if (product.steamAppId && product.category === 'game') {
          const ingestPayload = {
            appId: product.steamAppId,
            markupPercent: 0,
            cc: 'us',
            lang: 'en',
            allowNoPrice: true,
            fallbackPrice: product.price || 29.99,
            name: product.name
          }

          // Вызываем steam-ingest для импорта
          const ingestRes = await fetch(`http://localhost:${PORT}/bot/steam-ingest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ingestPayload)
          })

          if (ingestRes.ok) {
            results.imported++
          } else {
            results.skipped++
            results.errors.push({ product: product.name, reason: 'ingest_failed' })
          }
        } else {
          results.skipped++
        }
      } catch (error) {
        results.failed++
        results.errors.push({ product: product.name, error: error?.message })
      }
    }

    return res.json({ ok: true, results })
  } catch (error) {
    console.error('[bot/import-all-products] error', error)
    return res.status(500).json({ ok: false, error: error?.message || 'import_failed' })
  }
})
// Динамические продукты: приём из бота
app.post('/bot/ingest', upload.single('photo'), (req, res) => {
  try {
    const body = req.body || {}
    const name = String(body.name || '').trim()
    const description = String(body.description || body.info || '').trim()
    const price = parseFloat(body.price || '0')
    const type = String(body.type || '').trim()
    let category = String(body.category || '').trim().toLowerCase()
    if (!name || !req.file) return res.status(400).json({ ok: false, error: 'name_or_photo_missing' })
    if (!price || price <= 0) return res.status(400).json({ ok: false, error: 'invalid_price' })
    const detectCategory = () => {
      const text = `${name} ${description}`.toLowerCase()
      const skinHints = ['awp','cs2','cs:go','csgo','knife','керамбит','перчатки','бизон','deagle','karambit','gloves','skin']
      const gameHints = ['game','rpg','шутер','strategy','стратегия','гонки','horror','инди','sports','ea','battlefield','gta','jurassic']
      const isSkin = skinHints.some(k => text.includes(k))
      const isGame = gameHints.some(k => text.includes(k))
      if (isSkin && !isGame) return 'skin'
      if (isGame && !isSkin) return 'game'
      if (['weapon','armor','character'].includes(type.toLowerCase())) return 'skin'
      return 'game'
    }
    if (!category) category = detectCategory()
    const relPath = `/images/uploads/${req.file.filename}`
    const safe = (str) => String(str).toLowerCase().replace(/[^a-z0-9\-]+/g, '-').replace(/^-+|-+$/g, '')
    let id = safe(name)
    const list = loadProducts()
    if (list.find(p => p.id === id)) id = `${id}-${Date.now()}`
    const product = {
      id,
      name,
      price: Math.round(price * 100) / 100,
      image: relPath,
      introImage: relPath,
      category,
      type: type || (category === 'skin' ? 'weapon' : 'indie'),
      images: [relPath],
      description
    }
    const next = [product, ...list]
    const ok = saveProducts(next)
    if (!ok) return res.status(500).json({ ok: false, error: 'persist_failed' })
    return res.json({ ok: true, data: product })
  } catch (e) {
    console.error('[bot/ingest] error', e)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})

// Интеграция с Steam Store: создание товара по appId с наценкой
async function fetchSteamAppDetails(appId, cc = 'us', lang = 'en') {
  try {
    const url = `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=${cc}&l=${lang}`
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01'
      }
    })
    if (!resp.ok) return null
    const json = await resp.json()
    const entry = json[String(appId)]
    if (!entry || !entry.success) return null
    return entry.data || null
  } catch (_) {
    return null
  }
}

function parseAppIdFromUrl(steamUrl) {
  try {
    const u = new URL(steamUrl)
    // Ожидаем формат store.steampowered.com/app/<appId>
    const parts = u.pathname.split('/').filter(Boolean)
    const idx = parts.indexOf('app')
    if (idx >= 0 && parts[idx + 1]) {
      const candidate = parseInt(parts[idx + 1], 10)
      if (!isNaN(candidate)) return candidate
    }
    return null
  } catch (_) {
    return null
  }
}

// Динамические продукты: приём из Steam по appId/URL и наценке
app.post('/bot/steam-ingest', async (req, res) => {
  try {
    const body = req.body || {}
    let { appId, steamUrl, markupPercent = 0, cc = 'us', lang = 'en', name: nameOverride, allowNoPrice = false, fallbackPrice = 29.99 } = body
    if (!appId && steamUrl) appId = parseAppIdFromUrl(steamUrl)
    appId = parseInt(appId, 10)
    if (!appId || isNaN(appId)) return res.status(400).json({ ok: false, error: 'invalid_appId' })

    const data = await fetchSteamAppDetails(appId, cc, lang)
    if (!data) return res.status(404).json({ ok: false, error: 'app_not_found' })

    const baseName = nameOverride || data.name || `app-${appId}`
    const priceInfo = data.price_overview || null
    if (!priceInfo || typeof priceInfo.final !== 'number') {
      if (!allowNoPrice) {
        return res.status(400).json({ ok: false, error: 'price_not_available' })
      }
    }

    const basePrice = (priceInfo && typeof priceInfo.final === 'number')
      ? Math.round(priceInfo.final) / 100
      : Math.max(0, parseFloat(fallbackPrice || 0))
    const pct = parseFloat(markupPercent || 0)
    const finalPrice = Math.round(basePrice * (1 + (isNaN(pct) ? 0 : pct) / 100) * 100) / 100

    // Изображение из Steam CDN через прокси
    const headerImage = `/images/steam-games/steam/apps/${appId}/header.jpg`
    const capsuleImage = `/images/steam-games/steam/apps/${appId}/capsule_616x353.jpg`
    const chosenImage = headerImage

    const shortDesc = (data.short_description || '').trim()
    const aboutHtml = String(data.about_the_game || '').trim()
    const aboutText = aboutHtml.replace(/<[^>]+>/g, '').trim()
    const genres = Array.isArray(data.genres) ? data.genres.map(g => g.description.toLowerCase()) : []
    const type = genres.includes('action') ? 'action' : (genres[0] || 'indie')
    const screenshots = Array.isArray(data.screenshots) ? data.screenshots : []
    const gallery = screenshots.slice(0, 5).map(s => s.path_full).filter(Boolean)
    const specs = {
      pcRequirementsMinimum: (data.pc_requirements && data.pc_requirements.minimum) || '',
      pcRequirementsRecommended: (data.pc_requirements && data.pc_requirements.recommended) || '',
      developers: Array.isArray(data.developers) ? data.developers : [],
      publishers: Array.isArray(data.publishers) ? data.publishers : [],
      releaseDate: (data.release_date && data.release_date.date) || '',
      supportedLanguages: String(data.supported_languages || ''),
      genres: Array.isArray(data.genres) ? data.genres.map(g => g.description) : []
    }

    const safe = (str) => String(str).toLowerCase().replace(/[^a-z0-9\-]+/g, '-').replace(/^-+|-+$/g, '')
    let id = safe(baseName)
    const list = loadProducts()
    if (list.find(p => p.id === id)) id = `${id}-${Date.now()}`

    const product = {
      id,
      name: baseName,
      price: finalPrice,
      image: chosenImage,
      introImage: chosenImage,
      category: 'game',
      type,
      images: [chosenImage, capsuleImage, ...gallery],
      description: aboutText || shortDesc || `Steam app ${appId}`,
      descriptionHtml: aboutHtml,
      specs,
      source: 'steam',
      steamAppId: appId
    }

    const next = [product, ...list]
    const ok = saveProducts(next)
    if (!ok) return res.status(500).json({ ok: false, error: 'persist_failed' })
    return res.json({ ok: true, data: product })
  } catch (e) {
    console.error('[bot/steam-ingest] error', e)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})

// ======= Кэш списка приложений Steam и поиск по названию =======
const STEAM_APPS_FILE = path.join(DATA_DIR, 'steam_apps.json')
function loadSteamAppsCache() {
  try {
    if (!fs.existsSync(STEAM_APPS_FILE)) return { apps: [], fetchedAt: 0 }
    const raw = fs.readFileSync(STEAM_APPS_FILE, 'utf-8')
    return JSON.parse(raw || '{"apps":[],"fetchedAt":0}')
  } catch {
    return { apps: [], fetchedAt: 0 }
  }
}
async function refreshSteamAppsCache() {
  try {
    const url = 'https://api.steampowered.com/ISteamApps/GetAppList/v2/'
    const resp = await fetch(url)
    if (!resp.ok) throw new Error('fetch_failed')
    const json = await resp.json()
    const apps = (json && json.applist && Array.isArray(json.applist.apps)) ? json.applist.apps : []
    const payload = { apps, fetchedAt: Date.now() }
    fs.writeFileSync(STEAM_APPS_FILE, JSON.stringify(payload, null, 2), 'utf-8')
    return payload
  } catch (e) {
    return loadSteamAppsCache()
  }
}
async function getSteamApps() {
  const cache = loadSteamAppsCache()
  const maxAge = 24 * 60 * 60 * 1000 // 24 часа
  if (!cache.fetchedAt || (Date.now() - cache.fetchedAt) > maxAge || !Array.isArray(cache.apps) || cache.apps.length === 0) {
    return await refreshSteamAppsCache()
  }
  return cache
}
function rankByQuery(name, qLower) {
  const n = String(name || '').toLowerCase()
  if (n.startsWith(qLower)) return 3
  if (n.includes(qLower)) return 2
  return 1
}
// Поиск по названию (без ключа) с опциональным обогащением ценой
app.get('/bot/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim()
    const limit = Math.min(parseInt(req.query.limit || '20', 10) || 20, 50)
    const priced = String(req.query.priced || 'false').toLowerCase() === 'true'
    const cc = String(req.query.cc || 'us')
    const lang = String(req.query.lang || 'en')
    if (!q) return res.status(400).json({ ok: false, error: 'query_required' })

    const { apps } = await getSteamApps()
    const qLower = q.toLowerCase()
    const candidates = apps
      .filter(a => a && a.name && a.appid && String(a.name).toLowerCase().includes(qLower))
      .map(a => ({ appId: a.appid, name: a.name, rank: rankByQuery(a.name, qLower) }))
      .sort((a, b) => b.rank - a.rank || String(a.name).localeCompare(String(b.name)))
      .slice(0, limit)

    if (!priced) {
      return res.json({ ok: true, data: candidates.map(c => ({ appId: c.appId, name: c.name })) })
    }

    const detailed = await Promise.all(candidates.map(async c => {
      const d = await fetchSteamAppDetails(c.appId, cc, lang)
      const priceInfo = d && d.price_overview
      return {
        appId: c.appId,
        name: c.name,
        price: priceInfo ? Math.round(priceInfo.final) / 100 : null,
        currency: priceInfo ? priceInfo.currency : null,
        image: d ? `/images/steam-games/steam/apps/${c.appId}/header.jpg` : null
      }
    }))
    const filtered = detailed.filter(x => x.price !== null)
    return res.json({ ok: true, data: filtered })
  } catch (e) {
    console.error('[bot/search] error', e)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})

// Массовая загрузка игр по appId с наценкой
app.post('/bot/steam-batch-ingest', async (req, res) => {
  try {
    const body = req.body || {}
    const appIds = Array.isArray(body.appIds) ? body.appIds : (Array.isArray(body.ids) ? body.ids : [])
    const markupPercent = parseFloat(body.markupPercent || 0)
    const cc = String(body.cc || 'us')
    const lang = String(body.lang || 'en')
    const allowNoPrice = !!body.allowNoPrice
    const fallbackPrice = Math.max(0, parseFloat(body.fallbackPrice || 29.99))
    if (!appIds.length) return res.status(400).json({ ok: false, error: 'appIds_required' })

    const list = loadProducts()
    const created = []
    const skipped = []
    const errors = []
    // Если парсинг рынка не дал результатов, заполним items локальным топом
    if (!items || !items.length) {
      const localImages = [
        '/images/skins/AWP-GUNGNIR.png',
        '/images/skins/Desert-eagle-fenek.png',
        '/images/skins/kerambit-gradient.png',
        '/images/skins/negev-tra-ta-ta.png',
        '/images/skins/pp-bizon-syd-annubisa.png',
        '/images/skins/saved-off-cracken.png',
        '/images/skins/sport-perchatky-myasnik.png'
      ]
      const topNames = [
        'AK-47 | Redline (Field-Tested)', 'AK-47 | Case Hardened', 'AK-47 | Vulcan', 'AK-47 | Asiimov', 'AK-47 | Fire Serpent', 'AK-47 | Neon Rider',
        'M4A4 | Howl', 'M4A1-S | Printstream', 'M4A1-S | Hyper Beast', 'M4A1-S | Cyrex',
        'AWP | Dragon Lore', 'AWP | Gungnir', 'AWP | Asiimov', 'AWP | Medusa', 'AWP | Hyper Beast',
        'Desert Eagle | Blaze', 'Desert Eagle | Printstream', 'Desert Eagle | Code Red',
        'USP-S | Kill Confirmed', 'USP-S | Neo-Noir', 'USP-S | Cortex',
        'Glock-18 | Fade', 'Glock-18 | Vogue', 'Glock-18 | Neo-Noir',
        'P250 | Asiimov', 'P2000 | Fire Elemental', 'Five-SeveN | Monkey Business', 'CZ75-Auto | Victoria', 'Desert Eagle | Fennec Fox',
        'Bayonet | Doppler', 'Karambit | Doppler', 'Karambit | Fade', 'Karambit | Marble Fade',
        'Butterfly Knife | Doppler', 'Butterfly Knife | Fade', 'Butterfly Knife | Lore',
        'M9 Bayonet | Doppler', 'M9 Bayonet | Crimson Web', 'Talon Knife | Marble Fade',
        'Stiletto Knife | Damascus Steel', 'Navaja Knife | Doppler', 'Shadow Daggers | Fade',
        'Flip Knife | Tiger Tooth', 'Huntsman Knife | Doppler', 'Skeleton Knife | Fade',
        'Paracord Knife | Crimson Web', 'Nomad Knife | Case Hardened', 'Survival Knife | Fade',
        'Specialist Gloves | Crimson Kimono', 'Sport Gloves | Pandora\'s Box', 'Driver Gloves | King Snake'
      ]
      const limitNames = topNames.slice(0, limit)
      items = limitNames.map((n, i) => ({ name: n, image: localImages[i % localImages.length] }))
    }
    for (const rawId of appIds) {
      try {
        const appId = parseInt(rawId, 10)
        const data = await fetchSteamAppDetails(appId, cc, lang)
        if (!data) { skipped.push({ appId, reason: 'app_not_found' }); continue }
        const priceInfo = data.price_overview
        if (!priceInfo || typeof priceInfo.final !== 'number') {
          if (!allowNoPrice) { skipped.push({ appId, reason: 'price_not_available' }); continue }
        }
        const basePrice = (priceInfo && typeof priceInfo.final === 'number')
          ? Math.round(priceInfo.final) / 100
          : fallbackPrice
        const finalPrice = Math.round(basePrice * (1 + (isNaN(markupPercent) ? 0 : markupPercent) / 100) * 100) / 100
        const name = data.name || `app-${appId}`
        const image = `/images/steam-games/steam/apps/${appId}/header.jpg`
        const capsuleImage = `/images/steam-games/steam/apps/${appId}/capsule_616x353.jpg`
        const shortDesc = (data.short_description || '').trim()
        const aboutHtml = String(data.about_the_game || '').trim()
        const aboutText = aboutHtml.replace(/<[^>]+>/g, '').trim()
        const genres = Array.isArray(data.genres) ? data.genres.map(g => g.description.toLowerCase()) : []
        const type = genres.includes('action') ? 'action' : (genres[0] || 'indie')
        const screenshots = Array.isArray(data.screenshots) ? data.screenshots : []
        const gallery = screenshots.slice(0, 5).map(s => s.path_full).filter(Boolean)
        const specs = {
          pcRequirementsMinimum: (data.pc_requirements && data.pc_requirements.minimum) || '',
          pcRequirementsRecommended: (data.pc_requirements && data.pc_requirements.recommended) || '',
          developers: Array.isArray(data.developers) ? data.developers : [],
          publishers: Array.isArray(data.publishers) ? data.publishers : [],
          releaseDate: (data.release_date && data.release_date.date) || '',
          supportedLanguages: String(data.supported_languages || ''),
          genres: Array.isArray(data.genres) ? data.genres.map(g => g.description) : []
        }
        const safe = (str) => String(str).toLowerCase().replace(/[^a-z0-9\-]+/g, '-').replace(/^-+|-+$/g, '')
        let id = safe(name)
        if (list.find(p => p.id === id)) id = `${id}-${Date.now()}`
        const product = {
          id,
          name,
          price: finalPrice,
          image,
          introImage: image,
          category: 'game',
          type,
          images: [image, capsuleImage, ...gallery],
          description: aboutText || shortDesc || `Steam app ${appId}`,
          descriptionHtml: aboutHtml,
          specs,
          source: 'steam',
          steamAppId: appId
        }
        created.push(product)
      } catch (e) {
        errors.push({ appId: rawId, error: 'ingest_failed' })
      }
    }
    const next = [...created, ...list]
    const ok = saveProducts(next)
    if (!ok) return res.status(500).json({ ok: false, error: 'persist_failed' })
    
    // Уведомление в Telegram о добавленных играх
    if (telegramBot?.isEnabled && created.length > 0) {
      try {
        const host = req.headers['x-forwarded-host'] || req.headers.host || 'gamesale.shop'
        const siteName = getSiteNameForHost(host)
        const message = [
          `🎮 <b>Добавлены игры (batch-ingest)</b>`,
          `Сайт: ${siteName}`,
          `Добавлено: <b>${created.length}</b> игр`,
          ``,
          `<b>Добавленные игры:</b>`
        ]
        
        // Показываем первые 10 игр
        created.slice(0, 10).forEach((game, idx) => {
          const price = game.price ? `${game.price} ${game.currency || 'USD'}` : 'Цена не указана'
          message.push(`${idx + 1}. <b>${game.name}</b> - ${price}`)
          if (game.steamAppId) {
            message.push(`   Steam App ID: ${game.steamAppId}`)
          }
        })
        
        if (created.length > 10) {
          message.push(``)
          message.push(`... и еще ${created.length - 10} игр`)
        }
        
        if (errors.length > 0) {
          message.push(``)
          message.push(`⚠️ Ошибок: ${errors.length}`)
        }
        
        await telegramBot.notifyGeneric(message.join('\n'))
      } catch (error) {
        console.warn('[telegram] notify batch games error', error?.message)
      }
    }
    
    return res.json({ ok: true, createdCount: created.length, skipped, errors })
  } catch (e) {
    console.error('[bot/steam-batch-ingest] error', e)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})
// Удаление товара по id
app.delete('/products/:id', (req, res) => {
  const { id } = req.params
  const list = loadProducts()
  const next = list.filter(p => p.id !== id)
  const ok = saveProducts(next)
  res.json({ ok, deletedId: id, remaining: next.length })
})

// API для формы поддержки
const SUPPORT_FILE = path.join(DATA_DIR, 'support_tickets.json')
function ensureSupportFile() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }) } catch {}
  if (!fs.existsSync(SUPPORT_FILE)) {
    fs.writeFileSync(SUPPORT_FILE, JSON.stringify([], null, 2), 'utf-8')
  }
}
function loadSupportTickets() {
  try {
    const raw = fs.readFileSync(SUPPORT_FILE, 'utf-8')
    return JSON.parse(raw || '[]')
  } catch {
    return []
  }
}
function saveSupportTicket(ticket) {
  try {
    const tickets = loadSupportTickets()
    tickets.push({
      ...ticket,
      id: `ticket-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      status: 'open'
    })
    fs.writeFileSync(SUPPORT_FILE, JSON.stringify(tickets, null, 2), 'utf-8')
    return true
  } catch {
    return false
  }
}
ensureSupportFile()

const CHAT_SESSIONS_FILE = path.join(DATA_DIR, 'chat_sessions.json')
function ensureChatSessionsFile() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }) } catch {}
  if (!fs.existsSync(CHAT_SESSIONS_FILE)) {
    fs.writeFileSync(CHAT_SESSIONS_FILE, JSON.stringify([], null, 2), 'utf-8')
  }
}
function loadChatSessions() {
  try {
    const raw = fs.readFileSync(CHAT_SESSIONS_FILE, 'utf-8')
    const parsed = JSON.parse(raw || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
function saveChatSessions(list) {
  try {
    const normalized = Array.isArray(list) ? list : []
    fs.writeFileSync(CHAT_SESSIONS_FILE, JSON.stringify(normalized, null, 2), 'utf-8')
    return true
  } catch (error) {
    console.error('[chat] save error', error?.message)
    return false
  }
}
ensureChatSessionsFile()
const CHAT_MESSAGE_ROLES = new Set(['user', 'admin', 'system'])
const generateChatSessionId = () => `chat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
const findChatSessionById = (list, id) => (Array.isArray(list) ? list : []).find((s) => s && s.id === id) || null
const findChatSessionByEmail = (list, email) => {
  if (!email || !Array.isArray(list)) return null
  const normalizedEmail = String(email).trim().toLowerCase()
  return list.find((s) => s && s.user && s.user.email && String(s.user.email).trim().toLowerCase() === normalizedEmail) || null
}
const summarizeChatSession = (session) => {
  if (!session) return null
  const lastMessage = Array.isArray(session.messages) && session.messages.length
    ? session.messages[session.messages.length - 1]
    : null
  return {
    id: session.id,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    lastMessageAt: session.lastMessageAt,
    user: session.user || null,
    status: session.status || 'open',
    unreadForAdmin: !!session.unreadForAdmin,
    unreadForUser: !!session.unreadForUser,
    lastMessage
  }
}
function appendChatMessage(session, messagePayload) {
  if (!session) return null
  const now = new Date().toISOString()
  if (!Array.isArray(session.messages)) {
    session.messages = []
  }
  const message = {
    id: `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    authorRole: CHAT_MESSAGE_ROLES.has(messagePayload?.authorRole) ? messagePayload.authorRole : 'user',
    authorName: messagePayload?.authorName || '',
    body: String(messagePayload?.body || '').trim(),
    meta: messagePayload?.meta || null
  }
  session.messages.push(message)
  session.updatedAt = now
  session.lastMessageAt = now
  if (message.authorRole === 'user') {
    session.unreadForAdmin = true
  } else if (message.authorRole === 'admin') {
    session.unreadForUser = true
  }
  session.status = message.authorRole === 'admin' ? 'answered' : (session.status || 'open')
  return message
}

let mailTransporter = null
function getMailTransporter() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null
  if (mailTransporter) return mailTransporter
  const port = Number.isFinite(SMTP_PORT) && SMTP_PORT > 0 ? SMTP_PORT : (SMTP_SECURE ? 465 : 587)
  mailTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: SMTP_SECURE || port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  })
  return mailTransporter
}

async function notifySupportOperators(session, message) {
  if (!session || !message) return
  if (telegramBot?.notifyChatMessage && typeof telegramBot.notifyChatMessage === 'function') {
    if (message.authorRole === 'user') {
      telegramBot.notifyChatMessage({ sessionId: session.id, session, message })
    }
  }
  const transporter = getMailTransporter()
  if (!transporter || !SUPPORT_NOTIFY_EMAIL) {
    console.log('[chat] New message', {
      sessionId: session.id,
      from: message.authorRole,
      body: message.body
    })
    return
  }
  try {
    const subject =
      message.authorRole === 'admin'
        ? `Ответ для клиента (${session.user?.name || session.user?.email || session.id})`
        : `Новый чат клиент #${session.id}`
    const textLines = [
      `Сессия: ${session.id}`,
      `Время: ${message.createdAt}`,
      `От кого: ${message.authorRole}`,
      `Имя клиента: ${session.user?.name || 'не указано'}`,
      `Email клиента: ${session.user?.email || 'не указан'}`,
      '',
      message.body || '(пустое сообщение)'
    ]
    await transporter.sendMail({
      from: SMTP_USER,
      to: SUPPORT_NOTIFY_EMAIL,
      subject,
      text: textLines.join('\n')
    })
  } catch (error) {
    console.warn('[chat] Failed to send email notification', error?.message)
  }
}

const isAdminRequest = (req) => {
  if (req?.user && req.user.role === 'admin') return true
  const headerKey = String(req?.headers?.['x-admin-key'] || req?.headers?.['x-admin-token'] || '').trim()
  if (ADMIN_API_KEY && headerKey && headerKey === ADMIN_API_KEY) return true
  return false
}

const ORDERS_FILE = path.join(DATA_DIR, 'orders.json')
function ensureOrdersFile() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }) } catch {}
  if (!fs.existsSync(ORDERS_FILE)) {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify([], null, 2), 'utf-8')
  }
}
function loadOrders() {
  try {
    const raw = fs.readFileSync(ORDERS_FILE, 'utf-8')
    const parsed = JSON.parse(raw || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}
function saveOrders(list) {
  try {
    const normalized = Array.isArray(list) ? list : []
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(normalized, null, 2), 'utf-8')
    return true
  } catch (error) {
    console.error('[orders] save error', error?.message)
    return false
  }
}
const summarizeOrderRecord = (order) => {
  if (!order) return null
  return {
    id: order.id,
    orderId: order.orderId,
    userEmail: order.userEmail || '',
    userName: order.userName || '',
    totalAmount: order.totalAmount || 0,
    currency: order.currency || 'USD',
    itemsCount: Array.isArray(order.items) ? order.items.length : 0,
    status: order.status || 'new',
    createdAt: order.createdAt,
    paymentMethod: order.paymentMethod || 'manual'
  }
}
async function notifySupportAboutOrder(order) {
  if (!order) return
  if (telegramBot?.notifyOrder && typeof telegramBot.notifyOrder === 'function') {
    try {
      telegramBot.notifyOrder(summarizeOrderRecord(order))
    } catch (error) {
      console.warn('[orders] telegram notify error', error?.message)
    }
  }
  const transporter = getMailTransporter()
  if (!transporter || !SUPPORT_NOTIFY_EMAIL) {
    console.log('[orders] Новый заказ', summarizeOrderRecord(order))
    return
  }
  try {
    const subject = `Новый заказ ${order.orderId || order.id}`
    const lines = [
      `Заказ: ${order.orderId || order.id}`,
      `Создан: ${order.createdAt}`,
      `Клиент: ${order.userName || '—'} <${order.userEmail || '—'}>`,
      `Сумма: ${order.totalAmount || 0} ${order.currency || 'USD'}`,
      `Позиций: ${Array.isArray(order.items) ? order.items.length : 0}`,
      `Метод оплаты: ${order.paymentMethod || 'manual'}`,
      '',
      'Состав заказа:',
      ...(Array.isArray(order.items)
        ? order.items.map(
            (item, idx) =>
              `${idx + 1}. ${item.name || 'товар'} - ${item.price || 0} ${order.currency || 'USD'}${
                item.activationKey ? ` (ключ: ${item.activationKey})` : ''
              }`
          )
        : [])
    ]
    await transporter.sendMail({
      from: SMTP_USER || 'no-reply@gamesale.shop',
      to: SUPPORT_NOTIFY_EMAIL,
      subject,
      text: lines.join('\n')
    })
  } catch (error) {
    console.warn('[orders] Failed to send email notification', error?.message)
  }
}
ensureOrdersFile()

app.post('/api/support', (req, res) => {
  try {
    const { name, email, category, subject, message } = req.body
    
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ ok: false, error: 'missing_fields' })
    }
    
    const ticket = {
      name: String(name).trim(),
      email: String(email).trim(),
      category: String(category || 'general').trim(),
      subject: String(subject).trim(),
      message: String(message).trim()
    }
    
    const ok = saveSupportTicket(ticket)
    if (!ok) {
      return res.status(500).json({ ok: false, error: 'save_failed' })
    }
    
    // Здесь можно добавить отправку email через nodemailer
    console.log(`[support] Новый тикет: ${ticket.subject} от ${ticket.email}`)
    
    return res.json({ ok: true, message: 'Ticket created successfully' })
  } catch (e) {
    console.error('[api/support] error', e)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})

app.post('/api/chat/session', (req, res) => {
  try {
    const body = req.body || {}
    const now = new Date().toISOString()
    const requestedId = typeof body.sessionId === 'string' && body.sessionId.trim() ? body.sessionId.trim() : null
    const userEmail = String(body.email || body.userIdentifier || '').trim() || null
    const sessions = loadChatSessions()
    
    // Сначала ищем по запрошенному ID
    let session = requestedId ? findChatSessionById(sessions, requestedId) : null
    
    // Если сессии нет, но есть email - ищем существующую сессию по email
    if (!session && userEmail) {
      session = findChatSessionByEmail(sessions, userEmail)
    }
    
    if (!session) {
      // Создаем новую сессию
      session = {
        id: requestedId || generateChatSessionId(),
        createdAt: now,
        updatedAt: now,
        lastMessageAt: null,
        status: 'open',
        messages: [],
        user: {
          name: String(body.name || '').trim() || null,
          email: userEmail || null
        },
        unreadForAdmin: false,
        unreadForUser: false
      }
      sessions.push(session)
    } else {
      // Обновляем существующую сессию
      session.updatedAt = now
      // Обновляем данные пользователя, но не перезаписываем существующие
      if (!session.user) {
        session.user = { name: null, email: null }
      }
      if (body.name && !session.user.name) {
        session.user.name = String(body.name).trim() || null
      }
      if (userEmail && !session.user.email) {
        session.user.email = userEmail
      }
    }
    saveChatSessions(sessions)
    return res.json({ ok: true, session })
  } catch (error) {
    console.error('[api/chat/session] error', error?.message)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})

app.get('/api/chat/session/:id', (req, res) => {
  try {
    const { id } = req.params
    const sessions = loadChatSessions()
    const session = findChatSessionById(sessions, id)
    if (!session) return res.status(404).json({ ok: false, error: 'not_found' })
    if (req.user && req.user.role !== 'admin') {
      session.unreadForUser = false
      saveChatSessions(sessions)
    }
    return res.json({ ok: true, session })
  } catch (error) {
    console.error('[api/chat/session/:id] error', error?.message)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})

app.get('/api/chat/sessions', (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ ok: false, error: 'forbidden' })
  }
  try {
    const sessions = loadChatSessions()
    const sorted = [...sessions]
      .map((session) => summarizeChatSession(session))
      .filter(Boolean)
      .sort((a, b) => {
        const aTime = new Date(a.lastMessageAt || a.updatedAt || a.createdAt || 0).getTime()
        const bTime = new Date(b.lastMessageAt || b.updatedAt || b.createdAt || 0).getTime()
        return bTime - aTime
      })
    return res.json({ ok: true, sessions: sorted })
  } catch (error) {
    console.error('[api/chat/sessions] error', error?.message)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})

app.post('/api/chat/session/:id/message', (req, res) => {
  try {
    const { id } = req.params
    const { body, authorName, authorRole } = req.body || {}
    const text = String(body || '').trim()
    if (!text) return res.status(400).json({ ok: false, error: 'message_required' })
    const sessions = loadChatSessions()
    const session = findChatSessionById(sessions, id)
    if (!session) return res.status(404).json({ ok: false, error: 'not_found' })
    const role = CHAT_MESSAGE_ROLES.has(authorRole) ? authorRole : (isAdminRequest(req) ? 'admin' : 'user')
    const message = appendChatMessage(session, { authorRole: role, authorName, body: text })
    if (role === 'admin') {
      session.unreadForAdmin = false
    }
    saveChatSessions(sessions)
    notifySupportOperators(session, message)
    io.to(id).emit('chat:message', { sessionId: id, message })
    io.to('admins').emit('chat:session-updated', summarizeChatSession(session))
    return res.json({ ok: true, message, session })
  } catch (error) {
    console.error('[api/chat/session/:id/message] error', error?.message)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})

app.post('/api/chat/session/:id/read', (req, res) => {
  try {
    const { id } = req.params
    const { target } = req.body || {}
    const sessions = loadChatSessions()
    const session = findChatSessionById(sessions, id)
    if (!session) return res.status(404).json({ ok: false, error: 'not_found' })
    if (target === 'admin') {
      if (!isAdminRequest(req)) return res.status(403).json({ ok: false, error: 'forbidden' })
      session.unreadForAdmin = false
    } else {
      session.unreadForUser = false
    }
    session.updatedAt = new Date().toISOString()
    saveChatSessions(sessions)
    io.to(id).emit('chat:session', session)
    io.to('admins').emit('chat:session-updated', summarizeChatSession(session))
    return res.json({ ok: true, session })
  } catch (error) {
    console.error('[api/chat/session/:id/read] error', error?.message)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})

app.post('/api/chat/session/:id/status', (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ ok: false, error: 'forbidden' })
  }
  try {
    const { id } = req.params
    const { status } = req.body || {}
    const sessions = loadChatSessions()
    const session = findChatSessionById(sessions, id)
    if (!session) return res.status(404).json({ ok: false, error: 'not_found' })
    const normalizedStatus = String(status || '').trim().toLowerCase()
    if (normalizedStatus) {
      session.status = normalizedStatus
    }
    session.updatedAt = new Date().toISOString()
    saveChatSessions(sessions)
    io.to(id).emit('chat:session', session)
    io.to('admins').emit('chat:session-updated', summarizeChatSession(session))
    return res.json({ ok: true, session })
  } catch (error) {
    console.error('[api/chat/session/:id/status] error', error?.message)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})

app.post('/api/orders', (req, res) => {
  try {
    const body = req.body || {}
    const now = new Date().toISOString()
    const order = {
      id: randomUUID(),
      orderId: String(body.orderId || `order-${Date.now()}`),
      userEmail: String(body.userEmail || '').trim(),
      userName: String(body.userName || '').trim(),
      totalAmount: Number(body.totalAmount) || 0,
      currency: String(body.currency || 'USD').toUpperCase(),
      paymentMethod: String(body.paymentMethod || 'manual'),
      paymentStatus: String(body.paymentStatus || 'paid'),
      status: 'new',
      items: Array.isArray(body.items)
        ? body.items.map((item) => ({
            name: item?.name || '',
            price: Number(item?.price) || 0,
            category: item?.category || '',
            type: item?.type || '',
            activationKey: item?.activationKey || null
          }))
        : [],
      createdAt: now,
      meta: {
        raw: body.meta || null
      }
    }
    const orders = loadOrders()
    orders.unshift(order)
    const saved = saveOrders(orders)
    if (!saved) {
      return res.status(500).json({ ok: false, error: 'persist_failed' })
    }
    
    // Отправляем уведомление администраторам
    notifySupportAboutOrder(order)
    
    // Отправляем письма покупателю через Resend
    console.log('[api/orders] Email check:', {
      hasEmail: !!order.userEmail,
      email: order.userEmail,
      paymentStatus: order.paymentStatus,
      willSend: !!(order.userEmail && order.paymentStatus === 'paid')
    })
    
    if (order.userEmail && order.paymentStatus === 'paid') {
      console.log('[api/orders] Sending confirmation email to', order.userEmail)
      // Отправляем подтверждение заказа
      sendOrderConfirmationEmail({
        email: order.userEmail,
        userName: order.userName || 'Покупатель',
        orderId: order.orderId,
        items: order.items || [],
        totalAmount: order.totalAmount,
        currency: order.currency,
        createdAt: order.createdAt
      }).then((result) => {
        if (result?.success) {
          console.log('[api/orders] ✅ Confirmation email sent successfully to', order.userEmail, 'messageId:', result.messageId)
        } else {
          console.error('[api/orders] ❌ Failed to send confirmation email:', result?.error || 'unknown_error')
          console.error('[api/orders] Email error details:', JSON.stringify(result, null, 2))
        }
      }).catch((error) => {
        console.error('[api/orders] ❌ Exception sending confirmation email:', error?.message || error)
        console.error('[api/orders] Error stack:', error?.stack)
      })
      
      console.log('[api/orders] Sending receipt email to', order.userEmail)
      // Отправляем чек
      sendOrderReceiptEmail({
        email: order.userEmail,
        userName: order.userName || 'Покупатель',
        orderId: order.orderId,
        items: order.items || [],
        totalAmount: order.totalAmount,
        currency: order.currency,
        paymentMethod: order.paymentMethod,
        createdAt: order.createdAt
      }).then((result) => {
        if (result?.success) {
          console.log('[api/orders] ✅ Receipt email sent successfully to', order.userEmail, 'messageId:', result.messageId)
        } else {
          console.error('[api/orders] ❌ Failed to send receipt email:', result?.error || 'unknown_error')
          console.error('[api/orders] Email error details:', JSON.stringify(result, null, 2))
        }
      }).catch((error) => {
        console.error('[api/orders] ❌ Exception sending receipt email:', error?.message || error)
        console.error('[api/orders] Error stack:', error?.stack)
      })
    } else {
      if (!order.userEmail) {
        console.warn('[api/orders] Cannot send email: userEmail is missing')
      }
      if (order.paymentStatus !== 'paid') {
        console.warn('[api/orders] Cannot send email: paymentStatus is', order.paymentStatus, '(expected "paid")')
      }
    }
    
    const summary = summarizeOrderRecord(order)
    io.to('admins').emit('orders:new', summary)
    return res.json({ ok: true, order })
  } catch (error) {
    console.error('[api/orders] error', error?.message)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})

app.get('/api/orders', (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ ok: false, error: 'forbidden' })
  }
  try {
    const orders = loadOrders()
    const sorted = [...orders].sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    )
    return res.json({
      ok: true,
      orders: sorted.map(summarizeOrderRecord),
      total: sorted.length
    })
  } catch (error) {
    console.error('[api/orders] load error', error?.message)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})

// User orders endpoint
app.get('/api/user/orders', (req, res) => {
  try {
    const userEmail = req.user?.email || req.query?.email || null
    if (!userEmail) {
      return res.status(401).json({ ok: false, error: 'unauthorized' })
    }
    
    const orders = loadOrders()
    const userOrders = orders
      .filter(o => {
        const orderEmail = (o.userEmail || '').toLowerCase().trim()
        return orderEmail === userEmail.toLowerCase().trim()
      })
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .map(summarizeOrderRecord)
    
    return res.json({
      ok: true,
      orders: userOrders,
      total: userOrders.length
    })
  } catch (error) {
    console.error('[api/user/orders] error', error?.message)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})

// User stats endpoint
app.get('/api/user/stats', (req, res) => {
  try {
    const userEmail = req.user?.email || req.query?.email || null
    if (!userEmail) {
      return res.status(401).json({ ok: false, error: 'unauthorized' })
    }
    
    const orders = loadOrders()
    const payments = loadPayments()
    
    const userOrders = orders.filter(o => {
      const orderEmail = (o.userEmail || '').toLowerCase().trim()
      return orderEmail === userEmail.toLowerCase().trim()
    })
    
    const userPayments = payments.filter(p => {
      const paymentEmail = (p.userEmail || '').toLowerCase().trim()
      return paymentEmail === userEmail.toLowerCase().trim()
    })
    
    const totalSpent = userPayments
      .filter(p => p.status === 'success' || p.status === 'completed' || p.status === 'paid')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
    
    return res.json({
      ok: true,
      stats: {
        totalOrders: userOrders.length,
        totalSpent,
        completedOrders: userOrders.filter(o => o.status === 'completed').length,
        pendingOrders: userOrders.filter(o => o.status === 'processing' || o.status === 'new').length
      }
    })
  } catch (error) {
    console.error('[api/user/stats] error', error?.message)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})

app.post('/api/orders/:id/status', (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ ok: false, error: 'forbidden' })
  }
  try {
    const { id } = req.params
    const { status } = req.body || {}
    if (!status) {
      return res.status(400).json({ ok: false, error: 'status_required' })
    }
    const orders = loadOrders()
    const order = orders.find((item) => item && item.id === id)
    if (!order) {
      return res.status(404).json({ ok: false, error: 'not_found' })
    }
    const now = new Date().toISOString()
    order.status = String(status).trim().toLowerCase()
    order.updatedAt = now
    if (!Array.isArray(order.history)) {
      order.history = []
    }
    order.history.push({
      status: order.status,
      changedAt: now
    })
    const saved = saveOrders(orders)
    if (!saved) {
      return res.status(500).json({ ok: false, error: 'persist_failed' })
    }
    const summary = summarizeOrderRecord(order)
    io.to('admins').emit('orders:updated', summary)
    
    // Log activity
    const adminEmail = req.user?.email || null
    logActivity(`Заказ #${summary.orderId || summary.id} обновлен: статус → ${order.status}`, 'order', order.id, { orderId: summary.orderId, status: order.status }, adminEmail)
    
    if (telegramBot?.notifyGeneric && typeof telegramBot.notifyGeneric === 'function') {
      try {
        telegramBot.notifyGeneric(
          `ℹ️ Обновление заказа ${summary.orderId || summary.id}: статус → ${order.status}`
        )
      } catch (error) {
        console.warn('[telegram] order status notify error', error?.message)
      }
    }
    return res.json({ ok: true, order: summary })
  } catch (error) {
    console.error('[api/orders/:id/status] error', error?.message)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})

const slugifyId = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `item-${Date.now()}`

// ======= Admin Panel API Endpoints =======
const PAYMENTS_FILE = path.join(DATA_DIR, 'payments.json')
function ensurePaymentsFile() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }) } catch {}
  if (!fs.existsSync(PAYMENTS_FILE)) {
    fs.writeFileSync(PAYMENTS_FILE, JSON.stringify([], null, 2), 'utf-8')
  }
}
function loadPayments() {
  try {
    const raw = fs.readFileSync(PAYMENTS_FILE, 'utf-8')
    const parsed = JSON.parse(raw || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
function savePayments(list) {
  try {
    const normalized = Array.isArray(list) ? list : []
    fs.writeFileSync(PAYMENTS_FILE, JSON.stringify(normalized, null, 2), 'utf-8')
    return true
  } catch {
    return false
  }
}
ensurePaymentsFile()

// Activity Log System
const ACTIVITY_LOG_FILE = path.join(DATA_DIR, 'activity_log.json')
function ensureActivityLogFile() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }) } catch {}
  if (!fs.existsSync(ACTIVITY_LOG_FILE)) {
    fs.writeFileSync(ACTIVITY_LOG_FILE, JSON.stringify([], null, 2), 'utf-8')
  }
}
function loadActivityLog() {
  try {
    const raw = fs.readFileSync(ACTIVITY_LOG_FILE, 'utf-8')
    const parsed = JSON.parse(raw || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
function saveActivityLog(logs) {
  try {
    const normalized = Array.isArray(logs) ? logs : []
    fs.writeFileSync(ACTIVITY_LOG_FILE, JSON.stringify(normalized, null, 2), 'utf-8')
    return true
  } catch {
    return false
  }
}
function logActivity(action, entityType, entityId, details = {}, adminEmail = null) {
  try {
    const logs = loadActivityLog()
    // Генерируем уникальный код для операции
    let operationCode = generateOperationCode()
    let attempts = 0
    while (!isOperationCodeUnique(logs, operationCode) && attempts < 10) {
      operationCode = generateOperationCode()
      attempts++
    }
    
    const logEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      code: operationCode,
      action: String(action),
      entityType: String(entityType),
      entityId: entityId ? String(entityId) : null,
      details: typeof details === 'object' ? JSON.stringify(details) : String(details),
      adminEmail: adminEmail || null,
      createdAt: new Date().toISOString()
    }
    logs.unshift(logEntry)
    // Храним только последние 10000 записей
    if (logs.length > 10000) {
      logs.splice(10000)
    }
    saveActivityLog(logs)
  } catch (error) {
    console.warn('[activity-log] Failed to log activity:', error?.message)
  }
}
ensureActivityLogFile()

// Admin Dashboard - Statistics
app.get('/api/admin/stats', (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ ok: false, error: 'forbidden' })
  }
  try {
    const oneMonthAgo = new Date()
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
    
    const payments = loadPayments()
    const orders = loadOrders()
    const users = loadUsers()
    
    // Revenue (successful payments)
    const successfulPayments = payments.filter(p => 
      p.status === 'success' || p.status === 'completed' || p.status === 'paid'
    )
    const revenueThisMonth = successfulPayments
      .filter(p => new Date(p.createdAt || 0) >= oneMonthAgo)
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
    const revenueLastMonth = successfulPayments
      .filter(p => {
        const date = new Date(p.createdAt || 0)
        const twoMonthsAgo = new Date(oneMonthAgo)
        twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 1)
        return date >= twoMonthsAgo && date < oneMonthAgo
      })
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
    const revenueChange = revenueLastMonth > 0 
      ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100 
      : 0
    
    // Orders
    const ordersThisMonth = orders.filter(o => new Date(o.createdAt || 0) >= oneMonthAgo).length
    const ordersLastMonth = orders.filter(o => {
      const date = new Date(o.createdAt || 0)
      const twoMonthsAgo = new Date(oneMonthAgo)
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 1)
      return date >= twoMonthsAgo && date < oneMonthAgo
    }).length
    const ordersChange = ordersLastMonth > 0 
      ? ((ordersThisMonth - ordersLastMonth) / ordersLastMonth) * 100 
      : 0
    
    // Users
    const totalUsers = users.length
    const newUsersThisMonth = users.filter(u => new Date(u.createdAt || 0) >= oneMonthAgo).length
    const newUsersLastMonth = users.filter(u => {
      const date = new Date(u.createdAt || 0)
      const twoMonthsAgo = new Date(oneMonthAgo)
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 1)
      return date >= twoMonthsAgo && date < oneMonthAgo
    }).length
    const usersChange = newUsersLastMonth > 0 
      ? ((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth) * 100 
      : 0
    
    return res.json({
      ok: true,
      stats: {
        revenue: {
          value: revenueThisMonth,
          change: revenueChange
        },
        orders: {
          value: ordersThisMonth,
          change: ordersChange
        },
        users: {
          value: newUsersThisMonth,
          total: totalUsers,
          change: usersChange
        }
      }
    })
  } catch (error) {
    console.error('[api/admin/stats] error', error?.message)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})

// Admin Dashboard - Recent orders and reviews
app.get('/api/admin/dashboard', (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ ok: false, error: 'forbidden' })
  }
  try {
    const orders = loadOrders()
    const sortedOrders = [...orders]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 10)
      .map(summarizeOrderRecord)
    
    // Reviews (placeholder - можно добавить позже)
    const reviews = []
    
    return res.json({
      ok: true,
      recentOrders: sortedOrders,
      pendingReviews: reviews
    })
  } catch (error) {
    console.error('[api/admin/dashboard] error', error?.message)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})

// Admin Products - CRUD
app.get('/api/admin/products', (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ ok: false, error: 'forbidden' })
  }
  try {
    const { search, category, type, page = 1, limit = 50 } = req.query
    let products = loadProducts()
    
    // Filter
    if (search) {
      const searchLower = String(search).toLowerCase()
      products = products.filter(p => 
        String(p.name || '').toLowerCase().includes(searchLower) ||
        String(p.id || '').toLowerCase().includes(searchLower)
      )
    }
    if (category) {
      products = products.filter(p => p.category === category)
    }
    if (type) {
      products = products.filter(p => p.type === type)
    }
    
    // Pagination
    const pageNum = Math.max(1, parseInt(page, 10))
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)))
    const start = (pageNum - 1) * limitNum
    const end = start + limitNum
    const paginated = products.slice(start, end)
    
    return res.json({
      ok: true,
      products: paginated,
      total: products.length,
      page: pageNum,
      limit: limitNum
    })
  } catch (error) {
    console.error('[api/admin/products] error', error?.message)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})

app.post('/api/admin/products', (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ ok: false, error: 'forbidden' })
  }
  try {
    const body = req.body || {}
    const products = loadProducts()
    
    const product = {
      id: body.id || slugifyId(body.name || `product-${Date.now()}`),
      name: String(body.name || '').trim(),
      price: Number(body.price) || 0,
      image: String(body.image || '').trim(),
      introImage: String(body.introImage || body.image || '').trim(),
      category: String(body.category || 'game').trim(),
      type: String(body.type || 'indie').trim(),
      images: Array.isArray(body.images) ? body.images : [],
      description: String(body.description || '').trim(),
      descriptionHtml: String(body.descriptionHtml || '').trim(),
      specs: body.specs || {},
      source: String(body.source || 'manual').trim(),
      steamAppId: body.steamAppId ? Number(body.steamAppId) : null,
      hidden: body.hidden === true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    if (!product.name) {
      return res.status(400).json({ ok: false, error: 'name_required' })
    }
    
    products.unshift(product)
    const saved = saveProducts(products)
    if (!saved) {
      return res.status(500).json({ ok: false, error: 'persist_failed' })
    }
    
    // Log activity
    const adminEmail = req.user?.email || null
    logActivity(`Товар "${product.name}" создан`, 'product', product.id, { name: product.name, price: product.price }, adminEmail)
    
    return res.json({ ok: true, product })
  } catch (error) {
    console.error('[api/admin/products] create error', error?.message)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})

app.put('/api/admin/products/:id', (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ ok: false, error: 'forbidden' })
  }
  try {
    const { id } = req.params
    const body = req.body || {}
    const products = loadProducts()
    const index = products.findIndex(p => p.id === id)
    
    if (index === -1) {
      return res.status(404).json({ ok: false, error: 'not_found' })
    }
    
    const existing = products[index]
    const updated = {
      ...existing,
      ...body,
      id: existing.id, // Don't allow ID change
      updatedAt: new Date().toISOString()
    }
    
    products[index] = updated
    const saved = saveProducts(products)
    if (!saved) {
      return res.status(500).json({ ok: false, error: 'persist_failed' })
    }
    
    // Log activity
    const adminEmail = req.user?.email || null
    logActivity(`Товар "${updated.name}" обновлен`, 'product', updated.id, { name: updated.name, changes: Object.keys(body) }, adminEmail)
    
    return res.json({ ok: true, product: updated })
  } catch (error) {
    console.error('[api/admin/products/:id] update error', error?.message)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})

app.delete('/api/admin/products/:id', (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ ok: false, error: 'forbidden' })
  }
  try {
    const { id } = req.params
    const products = loadProducts()
    const filtered = products.filter(p => p.id !== id)
    
    if (filtered.length === products.length) {
      return res.status(404).json({ ok: false, error: 'not_found' })
    }
    
    const deletedProduct = products.find(p => p.id === id)
    const saved = saveProducts(filtered)
    if (!saved) {
      return res.status(500).json({ ok: false, error: 'persist_failed' })
    }
    
    // Log activity
    const adminEmail = req.user?.email || null
    logActivity(`Товар "${deletedProduct?.name || id}" удален`, 'product', id, { name: deletedProduct?.name }, adminEmail)
    
    return res.json({ ok: true, deletedId: id })
  } catch (error) {
    console.error('[api/admin/products/:id] delete error', error?.message)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})

// Admin Users
app.get('/api/admin/users', (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ ok: false, error: 'forbidden' })
  }
  try {
    const { search, page = 1, limit = 50 } = req.query
    let users = loadUsers()
    
    // Filter
    if (search) {
      const searchLower = String(search).toLowerCase()
      users = users.filter(u => 
        String(u.email || '').toLowerCase().includes(searchLower) ||
        String(u.displayName || '').toLowerCase().includes(searchLower) ||
        String(u.id || '').toLowerCase().includes(searchLower)
      )
    }
    
    // Pagination
    const pageNum = Math.max(1, parseInt(page, 10))
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)))
    const start = (pageNum - 1) * limitNum
    const end = start + limitNum
    const paginated = users.slice(start, end).map(u => sanitizeUserForClient(u))
    
    return res.json({
      ok: true,
      users: paginated,
      total: users.length,
      page: pageNum,
      limit: limitNum
    })
  } catch (error) {
    console.error('[api/admin/users] error', error?.message)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})

app.put('/api/admin/users/:id/block', (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ ok: false, error: 'forbidden' })
  }
  try {
    const { id } = req.params
    const { blocked } = req.body || {}
    const users = loadUsers()
    const user = findUserById(users, id)
    
    if (!user) {
      return res.status(404).json({ ok: false, error: 'not_found' })
    }
    
    user.isBlocked = blocked === true
    user.updatedAt = new Date().toISOString()
    const saved = saveUsers(users)
    if (!saved) {
      return res.status(500).json({ ok: false, error: 'persist_failed' })
    }
    
    // Log activity
    const adminEmail = req.user?.email || null
    logActivity(`Пользователь "${user.email || user.id}" ${blocked ? 'заблокирован' : 'разблокирован'}`, 'user', user.id, { email: user.email, blocked }, adminEmail)
    
    return res.json({ ok: true, user: sanitizeUserForClient(user) })
  } catch (error) {
    console.error('[api/admin/users/:id/block] error', error?.message)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})

// Admin Payments
app.get('/api/admin/payments', (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ ok: false, error: 'forbidden' })
  }
  try {
    const { status, startDate, endDate, page = 1, limit = 50 } = req.query
    let payments = loadPayments()
    
    // Filter
    if (status) {
      payments = payments.filter(p => p.status === status)
    }
    if (startDate) {
      const start = new Date(startDate)
      payments = payments.filter(p => new Date(p.createdAt || 0) >= start)
    }
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      payments = payments.filter(p => new Date(p.createdAt || 0) <= end)
    }
    
    // Sort by date (newest first)
    payments.sort((a, b) => 
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    )
    
    // Pagination
    const pageNum = Math.max(1, parseInt(page, 10))
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)))
    const start = (pageNum - 1) * limitNum
    const end = start + limitNum
    const paginated = payments.slice(start, end)
    
    return res.json({
      ok: true,
      payments: paginated,
      total: payments.length,
      page: pageNum,
      limit: limitNum
    })
  } catch (error) {
    console.error('[api/admin/payments] error', error?.message)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})

// Admin - Export Products to CSV
app.get('/api/admin/export/products', (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ ok: false, error: 'forbidden' })
  }
  try {
    const products = loadProducts()
    const headers = ['ID', 'Название', 'Цена', 'Категория', 'Тип', 'Скрыт', 'Создан', 'Обновлен']
    const rows = products.map(p => {
      return [
        p.id || '',
        `"${String(p.name || '').replace(/"/g, '""')}"`,
        p.price || 0,
        p.category || '',
        p.type || '',
        p.hidden ? 'Да' : 'Нет',
        p.createdAt ? new Date(p.createdAt).toLocaleString('ru-RU') : '',
        p.updatedAt ? new Date(p.updatedAt).toLocaleString('ru-RU') : ''
      ].join(',')
    })
    const csv = [headers.join(','), ...rows].join('\n')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="products-${new Date().toISOString().split('T')[0]}.csv"`)
    res.send('\ufeff' + csv)
  } catch (error) {
    console.error('[api/admin/export/products] error', error?.message)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})

// Admin - Export Orders to CSV
app.get('/api/admin/export/orders', (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ ok: false, error: 'forbidden' })
  }
  try {
    const orders = loadOrders()
    const headers = ['ID заказа', 'Пользователь', 'Статус', 'Сумма', 'Валюта', 'Товаров', 'Создан', 'Обновлен']
    const rows = orders.map(o => {
      const summary = summarizeOrderRecord(o)
      return [
        summary.orderId || summary.id || '',
        summary.userEmail || summary.userId || '',
        summary.status || '',
        summary.totalAmount || 0,
        summary.currency || 'RUB',
        summary.itemsCount || 0,
        summary.createdAt ? new Date(summary.createdAt).toLocaleString('ru-RU') : '',
        summary.updatedAt ? new Date(summary.updatedAt).toLocaleString('ru-RU') : ''
      ].join(',')
    })
    const csv = [headers.join(','), ...rows].join('\n')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="orders-${new Date().toISOString().split('T')[0]}.csv"`)
    res.send('\ufeff' + csv)
  } catch (error) {
    console.error('[api/admin/export/orders] error', error?.message)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})

// Admin - Export Users to CSV
app.get('/api/admin/export/users', (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ ok: false, error: 'forbidden' })
  }
  try {
    const users = loadUsers()
    const headers = ['Код', 'ID', 'Email', 'Имя', 'Роль', 'Заблокирован', 'Steam ID', 'Создан', 'Обновлен']
    const rows = users.map(u => {
      const sanitized = sanitizeUserForClient(u)
      return [
        sanitized.code || '',
        sanitized.id || '',
        sanitized.email || '',
        `"${String(sanitized.displayName || '').replace(/"/g, '""')}"`,
        sanitized.role || '',
        sanitized.isBlocked ? 'Да' : 'Нет',
        sanitized.steamId || '',
        sanitized.createdAt ? new Date(sanitized.createdAt).toLocaleString('ru-RU') : '',
        sanitized.updatedAt ? new Date(sanitized.updatedAt).toLocaleString('ru-RU') : ''
      ].join(',')
    })
    const csv = [headers.join(','), ...rows].join('\n')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="users-${new Date().toISOString().split('T')[0]}.csv"`)
    res.send('\ufeff' + csv)
  } catch (error) {
    console.error('[api/admin/export/users] error', error?.message)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})

// Admin - Export Payments to CSV
app.get('/api/admin/export/payments', (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ ok: false, error: 'forbidden' })
  }
  try {
    const payments = loadPayments()
    const users = loadUsers()
    const products = loadProducts()
    
    // Создаем мапу пользователей для быстрого поиска
    const usersMap = new Map()
    users.forEach(u => {
      usersMap.set(u.id, u)
      if (u.email) usersMap.set(u.email.toLowerCase(), u)
    })
    
    // Создаем мапу товаров для быстрого поиска
    const productsMap = new Map()
    products.forEach(p => {
      productsMap.set(p.id, p)
    })
    
    // Новый формат согласно требованиям:
    // уникальное id пользователя, уникальное id операции, уникальное id товара (или товаров), 
    // сумма сделки, почта, договор, ссылка на чек
    const headers = [
      'ID пользователя', 
      'ID операции', 
      'ID товара(ов)', 
      'Сумма сделки', 
      'Почта', 
      'Договор', 
      'Ссылка на чек'
    ]
    
    // Функция для получения базового URL из запроса
    const getBaseUrl = (req) => {
      const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http')
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'gamesale.shop'
      return `${protocol}://${host}`
    }
    const baseUrl = getBaseUrl(req)
    
    const rows = payments.map(p => {
      // 1. Уникальное ID пользователя
      const userId = p.userId || ''
      
      // 2. Уникальное ID операции (ID платежа)
      const operationId = p.id || ''
      
      // 3. Уникальное ID товара (или товаров) - собираем все ID товаров
      let productIds = []
      
      // Проверяем разные варианты хранения ID товара
      if (p.productId) {
        productIds.push(String(p.productId))
      } else if (p.items && Array.isArray(p.items) && p.items.length > 0) {
        // Если товары в массиве items
        p.items.forEach(item => {
          const itemId = item.id || item.productId || ''
          if (itemId && !productIds.includes(itemId)) {
            productIds.push(String(itemId))
          }
        })
      } else if (p.orderId) {
        // Пытаемся найти заказ и получить товары из него
        const orders = loadOrders()
        const order = orders.find(o => o.orderId === p.orderId || o.id === p.orderId)
        if (order && order.items && Array.isArray(order.items) && order.items.length > 0) {
          order.items.forEach(item => {
            const itemId = item.id || item.productId || ''
            if (itemId && !productIds.includes(itemId)) {
              productIds.push(String(itemId))
            }
          })
        }
      }
      const productIdsStr = productIds.join('; ') // Разделяем несколько ID точкой с запятой
      
      // 4. Сумма сделки
      const amount = p.amount || 0
      
      // 5. Почта
      const userEmail = p.userEmail || (p.userId ? (usersMap.get(p.userId)?.email || '') : '')
      
      // 6. Договор с правообладателем (ссылка на страницу договора)
      const contract = `${baseUrl}/copyright-agreement`
      
      // 7. Ссылка на чек (ссылка на страницу платежа)
      const receiptUrl = `${baseUrl}/pay/${p.id || ''}`
      
      return [
        userId || '',
        operationId || '',
        productIdsStr || '',
        amount || 0,
        userEmail || '',
        contract || '',
        receiptUrl || ''
      ].join(',')
    })
    const csv = [headers.join(','), ...rows].join('\n')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="payments-${new Date().toISOString().split('T')[0]}.csv"`)
    res.send('\ufeff' + csv)
  } catch (error) {
    console.error('[api/admin/export/payments] error', error?.message)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})

// Admin - Export Deeplinks to CSV
app.get('/api/admin/export/deeplinks', (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ ok: false, error: 'forbidden' })
  }
  try {
    const deeplinks = loadDeeplinks()
    const headers = ['ID', 'Deeplink ID', 'Сумма', 'Валюта', 'Статус', 'Активен', 'Истекает', 'Кликов', 'Платежей', 'Создан', 'Обновлен']
    const rows = deeplinks.map(d => {
      return [
        d.id || '',
        d.deeplinkId || '',
        d.amount || 0,
        d.currency || 'RUB',
        d.status || '',
        d.isActive ? 'Да' : 'Нет',
        d.expiresAt ? new Date(d.expiresAt).toLocaleString('ru-RU') : '',
        d.clickCount || 0,
        d.paymentCount || 0,
        d.createdAt ? new Date(d.createdAt).toLocaleString('ru-RU') : '',
        d.updatedAt ? new Date(d.updatedAt).toLocaleString('ru-RU') : ''
      ].join(',')
    })
    const csv = [headers.join(','), ...rows].join('\n')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="deeplinks-${new Date().toISOString().split('T')[0]}.csv"`)
    res.send('\ufeff' + csv)
  } catch (error) {
    console.error('[api/admin/export/deeplinks] error', error?.message)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})

// ==================== БУХГАЛТЕРИЯ И СИНХРОНИЗАЦИЯ ====================

// Файл для хранения настроек синхронизации бухгалтерии
const ACCOUNTING_CONFIG_FILE = path.join(DATA_DIR, 'accounting_config.json')

function ensureAccountingConfigFile() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }) } catch {}
  if (!fs.existsSync(ACCOUNTING_CONFIG_FILE)) {
    const defaultConfig = {
      apiKey: generateApiKey(),
      syncUrl: '',
      enabled: false,
      lastSync: null,
      autoSync: false,
      syncInterval: 3600000 // 1 час
    }
    fs.writeFileSync(ACCOUNTING_CONFIG_FILE, JSON.stringify(defaultConfig, null, 2), 'utf-8')
    return defaultConfig
  }
  try {
    const raw = fs.readFileSync(ACCOUNTING_CONFIG_FILE, 'utf-8')
    const config = JSON.parse(raw || '{}')
    // Если нет API ключа, генерируем новый
    if (!config.apiKey) {
      config.apiKey = generateApiKey()
      fs.writeFileSync(ACCOUNTING_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8')
    }
    return config
  } catch {
    const defaultConfig = {
      apiKey: generateApiKey(),
      syncUrl: '',
      enabled: false,
      lastSync: null,
      autoSync: false,
      syncInterval: 3600000
    }
    fs.writeFileSync(ACCOUNTING_CONFIG_FILE, JSON.stringify(defaultConfig, null, 2), 'utf-8')
    return defaultConfig
  }
}

function saveAccountingConfig(config) {
  try {
    fs.writeFileSync(ACCOUNTING_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8')
    return true
  } catch {
    return false
  }
}

// Middleware для проверки API ключа бухгалтерии
function validateAccountingApiKey(req, res, next) {
  const providedKey = req.headers['x-accounting-api-key'] || req.query.apiKey || req.body.apiKey
  const config = ensureAccountingConfigFile()
  
  if (!providedKey) {
    return res.status(401).json({ ok: false, error: 'api_key_required' })
  }
  
  // Используем безопасное сравнение
  try {
    if (!validateApiKey(providedKey, config.apiKey)) {
      return res.status(403).json({ ok: false, error: 'invalid_api_key' })
    }
  } catch (error) {
    return res.status(403).json({ ok: false, error: 'invalid_api_key' })
  }
  
  next()
}

// API: Получить полные бухгалтерские данные (требует API ключ)
app.get('/api/accounting/sync', validateAccountingApiKey, (req, res) => {
  try {
    const { startDate, endDate } = req.query
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'gamesale.shop'
    const site = getSiteNameForHost(host)
    
    const accountingData = getAccountingData({
      startDate: startDate || null,
      endDate: endDate || null,
      site
    })
    
    return res.json({
      ok: true,
      ...accountingData
    })
  } catch (error) {
    console.error('[api/accounting/sync] error', error?.message)
    return res.status(500).json({ ok: false, error: 'server_error', message: error?.message })
  }
})

// API для локального агента: получение данных без аутентификации (только с localhost)
app.get('/api/accounting/agent-sync', (req, res) => {
  try {
    // Разрешаем доступ только с localhost
    const clientIp = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || ''
    const isLocalhost = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1' || 
                        req.headers.host?.includes('localhost') || req.headers.host?.includes('127.0.0.1')
    
    if (!isLocalhost) {
      return res.status(403).json({ ok: false, error: 'forbidden', message: 'Доступ разрешен только с localhost' })
    }
    
    const { startDate, endDate } = req.query
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'gamesale.shop'
    const site = getSiteNameForHost(host)
    
    const accountingData = getAccountingData({
      startDate: startDate || null,
      endDate: endDate || null,
      site
    })
    
    return res.json({
      ok: true,
      ...accountingData
    })
  } catch (error) {
    console.error('[api/accounting/agent-sync] error', error?.message)
    return res.status(500).json({ ok: false, error: 'server_error', message: error?.message })
  }
})

// API: Экспорт бухгалтерии в CSV (требует API ключ)
app.get('/api/accounting/export/csv', validateAccountingApiKey, (req, res) => {
  try {
    const { startDate, endDate } = req.query
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'gamesale.shop'
    const site = getSiteNameForHost(host)
    
    const accountingData = getAccountingData({
      startDate: startDate || null,
      endDate: endDate || null,
      site
    })
    
    const csv = exportToCSV(accountingData)
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="accounting-${site}-${new Date().toISOString().split('T')[0]}.csv"`)
    res.send('\ufeff' + csv)
  } catch (error) {
    console.error('[api/accounting/export/csv] error', error?.message)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})

// Admin: Получить настройки синхронизации бухгалтерии
app.get('/api/admin/accounting/config', (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ ok: false, error: 'forbidden' })
  }
  try {
    const config = ensureAccountingConfigFile()
    // Не отправляем API ключ в ответе для безопасности
    return res.json({
      ok: true,
      config: {
        syncUrl: config.syncUrl || '',
        enabled: config.enabled || false,
        lastSync: config.lastSync || null,
        autoSync: config.autoSync || false,
        syncInterval: config.syncInterval || 3600000,
        hasApiKey: !!config.apiKey
      }
    })
  } catch (error) {
    console.error('[api/admin/accounting/config] error', error?.message)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})

// Admin: Получить API ключ для синхронизации (показывается только один раз)
app.get('/api/admin/accounting/api-key', (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ ok: false, error: 'forbidden' })
  }
  try {
    const config = ensureAccountingConfigFile()
    return res.json({
      ok: true,
      apiKey: config.apiKey
    })
  } catch (error) {
    console.error('[api/admin/accounting/api-key] error', error?.message)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})

// Admin: Сгенерировать новый API ключ
app.post('/api/admin/accounting/regenerate-key', (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ ok: false, error: 'forbidden' })
  }
  try {
    const config = ensureAccountingConfigFile()
    config.apiKey = generateApiKey()
    saveAccountingConfig(config)
    return res.json({
      ok: true,
      apiKey: config.apiKey,
      message: 'Новый API ключ сгенерирован'
    })
  } catch (error) {
    console.error('[api/admin/accounting/regenerate-key] error', error?.message)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})

// Admin: Обновить настройки синхронизации
app.post('/api/admin/accounting/config', (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ ok: false, error: 'forbidden' })
  }
  try {
    const { syncUrl, enabled, autoSync, syncInterval } = req.body
    const config = ensureAccountingConfigFile()
    
    if (syncUrl !== undefined) config.syncUrl = String(syncUrl || '').trim()
    if (enabled !== undefined) config.enabled = !!enabled
    if (autoSync !== undefined) config.autoSync = !!autoSync
    if (syncInterval !== undefined) config.syncInterval = Math.max(60000, parseInt(syncInterval, 10) || 3600000)
    
    saveAccountingConfig(config)
    
    return res.json({
      ok: true,
      config: {
        syncUrl: config.syncUrl,
        enabled: config.enabled,
        autoSync: config.autoSync,
        syncInterval: config.syncInterval,
        lastSync: config.lastSync
      }
    })
  } catch (error) {
    console.error('[api/admin/accounting/config] error', error?.message)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})

// Admin: Тестовая синхронизация (отправка данных на внешний сервер)
app.post('/api/admin/accounting/test-sync', (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ ok: false, error: 'forbidden' })
  }
  try {
    const config = ensureAccountingConfigFile()
    if (!config.syncUrl) {
      return res.status(400).json({ ok: false, error: 'sync_url_not_configured' })
    }
    
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'gamesale.shop'
    const site = getSiteNameForHost(host)
    
    const accountingData = getAccountingData({ site })
    
    // Отправляем данные на внешний сервер
    fetch(config.syncUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Accounting-API-Key': config.apiKey
      },
      body: JSON.stringify(accountingData)
    })
    .then(response => response.json())
    .then(data => {
      config.lastSync = new Date().toISOString()
      saveAccountingConfig(config)
      return res.json({
        ok: true,
        message: 'Синхронизация выполнена успешно',
        response: data
      })
    })
    .catch(error => {
      console.error('[accounting/test-sync] fetch error', error?.message)
      return res.status(500).json({
        ok: false,
        error: 'sync_failed',
        message: error?.message
      })
    })
  } catch (error) {
    console.error('[api/admin/accounting/test-sync] error', error?.message)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})

// Export endpoints
app.get('/api/admin/export/:type', (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ ok: false, error: 'forbidden' })
  }
  try {
    const { type } = req.params
    const { format = 'csv' } = req.query
    
    if (type === 'products') {
      const products = loadProducts()
      if (format === 'csv') {
        const headers = ['id', 'name', 'price', 'category', 'type', 'steamAppId', 'hidden', 'createdAt']
        const rows = products.map(p => [
          p.id || '',
          p.name || '',
          p.price || 0,
          p.category || '',
          p.type || '',
          p.steamAppId || '',
          p.hidden ? 'true' : 'false',
          p.createdAt || ''
        ])
        const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n')
        res.setHeader('Content-Type', 'text/csv; charset=utf-8')
        res.setHeader('Content-Disposition', `attachment; filename=products_${Date.now()}.csv`)
        return res.send('\ufeff' + csv) // BOM for Excel
      }
    } else if (type === 'orders') {
      const orders = loadOrders()
      if (format === 'csv') {
        const headers = ['id', 'orderId', 'userEmail', 'userName', 'totalAmount', 'currency', 'status', 'paymentStatus', 'createdAt']
        const rows = orders.map(o => [
          o.id || '',
          o.orderId || '',
          o.userEmail || '',
          o.userName || '',
          o.totalAmount || 0,
          o.currency || '',
          o.status || '',
          o.paymentStatus || '',
          o.createdAt || ''
        ])
        const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n')
        res.setHeader('Content-Type', 'text/csv; charset=utf-8')
        res.setHeader('Content-Disposition', `attachment; filename=orders_${Date.now()}.csv`)
        return res.send('\ufeff' + csv)
      }
    } else if (type === 'payments') {
      const payments = loadPayments()
      if (format === 'csv') {
        const headers = ['id', 'transactionId', 'userEmail', 'amount', 'currency', 'status', 'createdAt']
        const rows = payments.map(p => [
          p.id || '',
          p.transactionId || '',
          p.userEmail || '',
          p.amount || 0,
          p.currency || '',
          p.status || '',
          p.createdAt || ''
        ])
        const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n')
        res.setHeader('Content-Type', 'text/csv; charset=utf-8')
        res.setHeader('Content-Disposition', `attachment; filename=payments_${Date.now()}.csv`)
        return res.send('\ufeff' + csv)
      }
    }
    
    return res.status(400).json({ ok: false, error: 'invalid_type_or_format' })
  } catch (error) {
    console.error('[api/admin/export/:type] error', error?.message)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})

// ======= Deeplink Payment System =======
const DEEPLINKS_FILE = path.join(DATA_DIR, 'deeplinks.json')
function ensureDeeplinksFile() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }) } catch {}
  if (!fs.existsSync(DEEPLINKS_FILE)) {
    fs.writeFileSync(DEEPLINKS_FILE, JSON.stringify([], null, 2), 'utf-8')
  }
}
function loadDeeplinks() {
  try {
    const raw = fs.readFileSync(DEEPLINKS_FILE, 'utf-8')
    const parsed = JSON.parse(raw || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
function saveDeeplinks(list) {
  try {
    const normalized = Array.isArray(list) ? list : []
    fs.writeFileSync(DEEPLINKS_FILE, JSON.stringify(normalized, null, 2), 'utf-8')
    return true
  } catch {
    return false
  }
}
ensureDeeplinksFile()

// Generate unique deeplink ID
function generateDeeplinkId() {
  return `dl_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`
}

// Admin - Create deeplink
app.post('/api/admin/deeplinks', (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ ok: false, error: 'forbidden' })
  }
  try {
    const body = req.body || {}
    const amount = Number(body.amount) || 0
    const expiresInDays = Number(body.expiresInDays) || 30
    const description = String(body.description || '').trim()
    
    if (amount <= 0) {
      return res.status(400).json({ ok: false, error: 'invalid_amount' })
    }
    
    const deeplinks = loadDeeplinks()
    const deeplinkId = generateDeeplinkId()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000)
    
    const deeplink = {
      id: deeplinkId,
      deeplinkId,
      amount,
      currency: String(body.currency || 'RUB').toUpperCase(),
      description,
      status: 'pending',
      isActive: true,
      expiresAt: expiresAt.toISOString(),
      clickCount: 0,
      createdAt: now.toISOString(),
      userId: null,
      paymentId: null
    }
    
    deeplinks.unshift(deeplink)
    const saved = saveDeeplinks(deeplinks)
    if (!saved) {
      return res.status(500).json({ ok: false, error: 'persist_failed' })
    }
    
    return res.json({ ok: true, deeplink })
  } catch (error) {
    console.error('[api/admin/deeplinks] create error', error?.message)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})

// Admin - Get all deeplinks
app.get('/api/admin/deeplinks', (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ ok: false, error: 'forbidden' })
  }
  try {
    const { status, page = 1, limit = 50 } = req.query
    let deeplinks = loadDeeplinks()
    
    // Filter by status
    if (status) {
      deeplinks = deeplinks.filter(d => {
        if (status === 'active') return d.isActive && (!d.expiresAt || new Date(d.expiresAt) > new Date())
        if (status === 'used') return d.status === 'completed' || d.status === 'paid'
        if (status === 'expired') return d.expiresAt && new Date(d.expiresAt) <= new Date()
        return d.status === status
      })
    }
    
    // Sort by date (newest first)
    deeplinks.sort((a, b) => 
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    )
    
    // Pagination
    const pageNum = Math.max(1, parseInt(page, 10))
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)))
    const start = (pageNum - 1) * limitNum
    const end = start + limitNum
    const paginated = deeplinks.slice(start, end)
    
    return res.json({
      ok: true,
      deeplinks: paginated,
      total: deeplinks.length,
      page: pageNum,
      limit: limitNum
    })
  } catch (error) {
    console.error('[api/admin/deeplinks] error', error?.message)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})

// Admin - Update deeplink
app.put('/api/admin/deeplinks/:id', (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ ok: false, error: 'forbidden' })
  }
  try {
    const { id } = req.params
    const body = req.body || {}
    const deeplinks = loadDeeplinks()
    const index = deeplinks.findIndex(d => d.id === id || d.deeplinkId === id)
    
    if (index === -1) {
      return res.status(404).json({ ok: false, error: 'not_found' })
    }
    
    const existing = deeplinks[index]
    const updated = {
      ...existing,
      ...body,
      id: existing.id,
      deeplinkId: existing.deeplinkId
    }
    
    deeplinks[index] = updated
    const saved = saveDeeplinks(deeplinks)
    if (!saved) {
      return res.status(500).json({ ok: false, error: 'persist_failed' })
    }
    
    return res.json({ ok: true, deeplink: updated })
  } catch (error) {
    console.error('[api/admin/deeplinks/:id] update error', error?.message)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})

// Admin - Delete deeplink
app.delete('/api/admin/deeplinks/:id', (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ ok: false, error: 'forbidden' })
  }
  try {
    const { id } = req.params
    const deeplinks = loadDeeplinks()
    const filtered = deeplinks.filter(d => d.id !== id && d.deeplinkId !== id)
    
    if (filtered.length === deeplinks.length) {
      return res.status(404).json({ ok: false, error: 'not_found' })
    }
    
    const saved = saveDeeplinks(filtered)
    if (!saved) {
      return res.status(500).json({ ok: false, error: 'persist_failed' })
    }
    
    // Log activity
    const deletedDeeplink = deeplinks.find(d => d.id === id || d.deeplinkId === id)
    const adminEmail = req.user?.email || null
    logActivity(`Диплинк "${deletedDeeplink?.deeplinkId || id}" удален`, 'deeplink', id, { deeplinkId: deletedDeeplink?.deeplinkId }, adminEmail)
    
    return res.json({ ok: true, deletedId: id })
  } catch (error) {
    console.error('[api/admin/deeplinks/:id] delete error', error?.message)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})

// Admin - Activity Log
app.get('/api/admin/activity-log', (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ ok: false, error: 'forbidden' })
  }
  try {
    const { page = 1, limit = 50, filter = '' } = req.query
    let logs = loadActivityLog()
    
    // Filter
    if (filter) {
      const filterLower = String(filter).toLowerCase()
      logs = logs.filter(log => 
        String(log.action || '').toLowerCase().includes(filterLower) ||
        String(log.entityType || '').toLowerCase().includes(filterLower) ||
        String(log.entityId || '').toLowerCase().includes(filterLower) ||
        String(log.adminEmail || '').toLowerCase().includes(filterLower) ||
        String(log.details || '').toLowerCase().includes(filterLower)
      )
    }
    
    // Pagination
    const pageNum = Math.max(1, parseInt(page, 10))
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)))
    const start = (pageNum - 1) * limitNum
    const end = start + limitNum
    const paginated = logs.slice(start, end)
    
    return res.json({
      ok: true,
      logs: paginated,
      total: logs.length,
      page: pageNum,
      limit: limitNum
    })
  } catch (error) {
    console.error('[api/admin/activity-log] error', error?.message)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})

// Admin - Export Activity Log to CSV
app.get('/api/admin/activity-log/export', (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ ok: false, error: 'forbidden' })
  }
  try {
    const logs = loadActivityLog()
    
    // CSV Header
    const headers = ['Время', 'Действие', 'Тип', 'ID', 'Пользователь', 'Детали']
    const rows = logs.map(log => {
      const time = log.createdAt ? new Date(log.createdAt).toLocaleString('ru-RU') : ''
      const action = String(log.action || '').replace(/"/g, '""')
      const entityType = String(log.entityType || '')
      const entityId = String(log.entityId || '')
      const adminEmail = String(log.adminEmail || 'Система')
      const details = String(log.details || '').replace(/"/g, '""')
      
      return `"${time}","${action}","${entityType}","${entityId}","${adminEmail}","${details}"`
    })
    
    const csv = [headers.map(h => `"${h}"`).join(','), ...rows].join('\n')
    const filename = `activity-log-${new Date().toISOString().split('T')[0]}.csv`
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send('\ufeff' + csv) // BOM for Excel UTF-8 support
  } catch (error) {
    console.error('[api/admin/activity-log/export] error', error?.message)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})

// Public - Get deeplink info
app.get('/api/deeplink/:id', (req, res) => {
  try {
    const { id } = req.params
    const deeplinks = loadDeeplinks()
    const deeplink = deeplinks.find(d => d.deeplinkId === id || d.id === id)
    
    if (!deeplink) {
      return res.status(404).json({ ok: false, error: 'not_found' })
    }
    
    // Check if expired
    if (deeplink.expiresAt && new Date(deeplink.expiresAt) <= new Date()) {
      return res.status(410).json({ ok: false, error: 'expired' })
    }
    
    // Check if already used
    if (deeplink.status === 'completed' || deeplink.status === 'paid') {
      return res.status(410).json({ ok: false, error: 'already_used' })
    }
    
    // Check if inactive
    if (!deeplink.isActive) {
      return res.status(410).json({ ok: false, error: 'inactive' })
    }
    
    // Increment click count
    deeplink.clickCount = (deeplink.clickCount || 0) + 1
    saveDeeplinks(deeplinks)
    
    return res.json({
      ok: true,
      deeplink: {
        id: deeplink.deeplinkId,
        amount: deeplink.amount,
        currency: deeplink.currency,
        description: deeplink.description
      }
    })
  } catch (error) {
    console.error('[api/deeplink/:id] error', error?.message)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})

// Public - Process deeplink payment
app.post('/api/deeplink/:id/pay', async (req, res) => {
  try {
    const { id } = req.params
    const body = req.body || {}
    const deeplinks = loadDeeplinks()
    const deeplink = deeplinks.find(d => d.deeplinkId === id || d.id === id)
    
    if (!deeplink) {
      return res.status(404).json({ ok: false, error: 'not_found' })
    }
    
    // Check if expired
    if (deeplink.expiresAt && new Date(deeplink.expiresAt) <= new Date()) {
      return res.status(410).json({ ok: false, error: 'expired' })
    }
    
    // Check if already used
    if (deeplink.status === 'completed' || deeplink.status === 'paid') {
      return res.status(410).json({ ok: false, error: 'already_used' })
    }
    
    // Check if inactive
    if (!deeplink.isActive) {
      return res.status(410).json({ ok: false, error: 'inactive' })
    }
    
    // Verify captcha if provided
    if (body.captchaToken) {
      const captchaValid = await verifyYandexCaptcha(body.captchaToken)
      if (!captchaValid) {
        return res.status(400).json({ ok: false, error: 'invalid_captcha' })
      }
    }
    
    // Get user from session if available
    let userId = null
    if (req.isAuthenticated && req.isAuthenticated()) {
      userId = req.user?.id || null
    }
    
    // Create payment
    const payments = loadPayments()
    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const now = new Date().toISOString()
    
    const payment = {
      id: paymentId,
      transactionId: paymentId,
      userId,
      userEmail: body.userEmail || body.email || null,
      userName: body.userName || body.name || null,
      amount: deeplink.amount,
      currency: deeplink.currency,
      status: 'pending',
      description: deeplink.description || `Оплата по диплинку ${deeplink.deeplinkId}`,
      deeplinkId: deeplink.deeplinkId,
      createdAt: now
    }
    
    payments.unshift(payment)
    savePayments(payments)
    
    // Update deeplink
    deeplink.status = 'processing'
    deeplink.userId = userId
    deeplink.paymentId = paymentId
    deeplink.updatedAt = now
    saveDeeplinks(deeplinks)
    
    // Create payment URL (similar to regular payments)
    const paymentUrl = `/pay/${paymentId}`
    
    return res.json({
      ok: true,
      payment: {
        id: paymentId,
        amount: deeplink.amount,
        currency: deeplink.currency,
        description: deeplink.description,
        deeplink: true, // Флаг для PaymentWidget
        paymentUrl
      }
    })
  } catch (error) {
    console.error('[api/deeplink/:id/pay] error', error?.message)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})

function listChatSessionsForTelegram() {
  const sessions = loadChatSessions()
  return sessions
    .map((session) => ({
      id: session.id,
      user: session.user || {},
      unreadForAdmin: !!session.unreadForAdmin,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      lastMessageAt: session.lastMessageAt,
      status: session.status || 'open',
      messagesCount: Array.isArray(session.messages) ? session.messages.length : 0
    }))
    .sort((a, b) => {
      const aTime = new Date(a.lastMessageAt || a.updatedAt || a.createdAt || 0).getTime()
      const bTime = new Date(b.lastMessageAt || b.updatedAt || b.createdAt || 0).getTime()
      return bTime - aTime
    })
}

function listOrdersForTelegram() {
  return loadOrders()
    .map((order) => summarizeOrderRecord(order))
    .filter(Boolean)
    .sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime()
    )
}

async function replyToChatSessionFromTelegram(sessionId, text) {
  if (!sessionId || !text) {
    return { ok: false, error: 'invalid_params' }
  }
  const sessions = loadChatSessions()
  const session = findChatSessionById(sessions, sessionId)
  if (!session) {
    return { ok: false, error: 'not_found' }
  }
  const message = appendChatMessage(session, {
    authorRole: 'admin',
    authorName: 'Operator',
    body: text
  })
  session.unreadForAdmin = false
  session.unreadForUser = true
  session.updatedAt = new Date().toISOString()
  const saved = saveChatSessions(sessions)
  if (!saved) {
    return { ok: false, error: 'save_failed' }
  }
  io.to(sessionId).emit('chat:message', { sessionId, message })
  io.to(sessionId).emit('chat:session', session)
  io.to('admins').emit('chat:session-updated', summarizeChatSession(session))
  return { ok: true }
}

function addProductFromTelegram(args = {}) {
  const name = String(args.name || '').trim()
  const priceValue = parseFloat(String(args.price || '').replace(',', '.'))
  if (!name) {
    return { ok: false, error: 'name_required' }
  }
  if (!Number.isFinite(priceValue) || priceValue <= 0) {
    return { ok: false, error: 'invalid_price' }
  }
  const products = loadProducts()
  const normalizedName = name.toLowerCase()
  const duplicateByName = products.find(
    (product) => String(product.name || '').toLowerCase() === normalizedName
  )
  if (duplicateByName) {
    return { ok: false, error: 'duplicate_name' }
  }
  const baseId = args.id ? slugifyId(args.id) : slugifyId(name)
  const id = products.some((product) => product.id === baseId)
    ? `${baseId}-${Date.now().toString(36)}`
    : baseId
  const categoryRaw = String(args.category || '').toLowerCase()
  const category =
    categoryRaw === 'skin' || categoryRaw === 'skins'
      ? 'skin'
      : 'game'
  const createdAt = new Date().toISOString()
  const image = args.image || args.thumbnail || ''
  const introImage = args.introImage || image
  const images = []
  if (Array.isArray(args.images)) {
    args.images.map((img) => String(img).trim()).filter(Boolean).forEach((img) => images.push(img))
  } else if (typeof args.images === 'string') {
    args.images
      .split(',')
      .map((img) => img.trim())
      .filter(Boolean)
      .forEach((img) => images.push(img))
  }
  if (introImage) images.unshift(introImage)
  if (image && !images.includes(image)) images.unshift(image)
  const steamAppId = args.steamappid || args.steamAppId || args.appid
  const parsedSteamId = steamAppId ? parseInt(String(steamAppId), 10) : null
  const description = args.description || args.desc || ''

  const product = {
    id,
    name,
    price: Math.round(priceValue * 100) / 100,
    category,
    createdAt,
    updatedAt: createdAt,
    source: 'telegram',
    image: image || null,
    introImage: introImage || null,
    images: images.length ? Array.from(new Set(images)) : undefined,
    description: description || undefined
  }

  if (category === 'skin') {
    product.type = args.type || args.skinType || 'weapon'
    if (args.rarity) {
      product.rarity = args.rarity
    }
  } else {
    product.type = args.type || args.genre || 'game'
  }

  if (parsedSteamId && Number.isFinite(parsedSteamId)) {
    product.steamAppId = parsedSteamId
  }

  if (args.currency) {
    product.currency = String(args.currency).toUpperCase()
  }

  const next = [product, ...products]
  const saved = saveProducts(next)
  if (!saved) {
    return { ok: false, error: 'persist_failed' }
  }
  io.emit('products:updated', { id: product.id })
  return { ok: true, product }
}

telegramBot = initTelegramBot({
  token: TELEGRAM_BOT_TOKEN,
  adminChatId: TELEGRAM_ADMIN_CHAT_ID,
  notificationsChatId: TELEGRAM_NOTIFICATIONS_CHAT_ID || TELEGRAM_ADMIN_CHAT_ID,
  onListSessions: async () => listChatSessionsForTelegram(),
  onListOrders: async () => listOrdersForTelegram(),
  onReplyToSession: replyToChatSessionFromTelegram,
  onAddProduct: async (args) => addProductFromTelegram(args),
  logger: console
})

// Ингест топ-продавцов из Steam Featured Categories
app.post('/bot/top-ingest', async (req, res) => {
  try {
    const body = req.body || {}
    const limit = Math.max(1, parseInt(body.limit || 50, 10))
    const cc = String(body.cc || 'us')
    const lang = String(body.lang || 'en')
    const markupPercent = parseFloat(body.markupPercent || 0)
    const allowNoPrice = !!body.allowNoPrice
    const fallbackPrice = Math.max(0, parseFloat(body.fallbackPrice || 29.99))

    const url = `https://store.steampowered.com/api/featuredcategories?cc=${cc}&l=${lang}`
    const resp = await fetch(url)
    if (!resp.ok) return res.status(500).json({ ok: false, error: 'fetch_featured_failed' })
    const js = await resp.json()
    const items = (js && js.top_sellers && Array.isArray(js.top_sellers.items)) ? js.top_sellers.items : []
    const ids = items.map(it => it.id).filter(x => !!x).slice(0, limit)
    if (!ids.length) return res.json({ ok: true, createdCount: 0, skipped: [], errors: [], note: 'no_top_sellers' })

    const list = loadProducts()
    const created = []
    const skipped = []
    const errors = []
    for (const appId of ids) {
      try {
        const data = await fetchSteamAppDetails(appId, cc, lang)
        if (!data) { skipped.push({ appId, reason: 'app_not_found' }); continue }
        const priceInfo = data.price_overview
        if (!priceInfo || typeof priceInfo.final !== 'number') {
          if (!allowNoPrice) { skipped.push({ appId, reason: 'price_not_available' }); continue }
        }
        const basePrice = (priceInfo && typeof priceInfo.final === 'number')
          ? Math.round(priceInfo.final) / 100
          : fallbackPrice
        const finalPrice = Math.round(basePrice * (1 + (isNaN(markupPercent) ? 0 : markupPercent) / 100) * 100) / 100

        const name = data.name || `app-${appId}`
        const image = `/images/steam-games/steam/apps/${appId}/header.jpg`
        const capsuleImage = `/images/steam-games/steam/apps/${appId}/capsule_616x353.jpg`
        const shortDesc = (data.short_description || '').trim()
        const aboutHtml = String(data.about_the_game || '').trim()
        const aboutText = aboutHtml.replace(/<[^>]+>/g, '').trim()
        const genres = Array.isArray(data.genres) ? data.genres.map(g => g.description.toLowerCase()) : []
        const type = genres.includes('action') ? 'action' : (genres[0] || 'indie')
        const screenshots = Array.isArray(data.screenshots) ? data.screenshots : []
        const gallery = screenshots.slice(0, 5).map(s => s.path_full).filter(Boolean)
        const safe = (str) => String(str).toLowerCase().replace(/[^a-z0-9\-]+/g, '-').replace(/^-+|-+$/g, '')
        let id = safe(name)
        if (list.find(p => p.id === id)) id = `${id}-${Date.now()}`
        const product = {
          id,
          name,
          price: finalPrice,
          image,
          introImage: image,
          category: 'game',
          type,
          images: [image, capsuleImage, ...gallery],
          description: aboutText || shortDesc || `Steam app ${appId}`,
          descriptionHtml: aboutHtml,
          specs: {
            pcRequirementsMinimum: (data.pc_requirements && data.pc_requirements.minimum) || '',
            pcRequirementsRecommended: (data.pc_requirements && data.pc_requirements.recommended) || '',
            developers: Array.isArray(data.developers) ? data.developers : [],
            publishers: Array.isArray(data.publishers) ? data.publishers : [],
            releaseDate: (data.release_date && data.release_date.date) || '',
            supportedLanguages: String(data.supported_languages || ''),
            genres: Array.isArray(data.genres) ? data.genres.map(g => g.description) : []
          },
          source: 'steam',
          steamAppId: appId
        }
        created.push(product)
      } catch (e) {
        errors.push({ appId, error: 'ingest_failed' })
      }
    }
    const next = [...created, ...list]
    const ok = saveProducts(next)
    if (!ok) return res.status(500).json({ ok: false, error: 'persist_failed' })
    
    // Уведомление в Telegram о добавленных играх
    if (telegramBot?.isEnabled && created.length > 0) {
      try {
        const host = req.headers['x-forwarded-host'] || req.headers.host || 'gamesale.shop'
        const siteName = getSiteNameForHost(host)
        const message = [
          `🎮 <b>Автоматически добавлены игры</b>`,
          `Сайт: ${siteName}`,
          `Добавлено: <b>${created.length}</b> игр`,
          ``,
          `<b>Последние добавленные:</b>`
        ]
        
        // Показываем первые 5 игр
        created.slice(0, 5).forEach((game, idx) => {
          const price = game.price ? `${game.price} ${game.currency || 'USD'}` : 'Цена не указана'
          message.push(`${idx + 1}. <b>${game.name}</b>`)
          message.push(`   Цена: ${price}`)
          if (game.steamAppId) {
            message.push(`   Steam App ID: ${game.steamAppId}`)
          }
          message.push(``)
        })
        
        if (created.length > 5) {
          message.push(`... и еще ${created.length - 5} игр`)
        }
        
        if (errors.length > 0) {
          message.push(``)
          message.push(`⚠️ Ошибок: ${errors.length}`)
        }
        
        await telegramBot.notifyGeneric(message.join('\n'))
      } catch (error) {
        console.warn('[telegram] notify new games error', error?.message)
      }
    }
    
    return res.json({ ok: true, createdCount: created.length, skipped, errors })
  } catch (e) {
    console.error('[bot/top-ingest] error', e)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})

// Ингест топ-скинов CS2 из Steam Community Market
app.post('/bot/cs2-skins-ingest', async (req, res) => {
  try {
    const body = req.body || {}
    const limit = Math.max(1, Math.min(50, parseInt(body.limit || 50, 10)))
    const start = Math.max(0, parseInt(body.start || body.offset || 0, 10))
    const currencyCode = String(body.currency || 'USD').toUpperCase() // 'USD' -> 1
    const currencyMap = { USD: 1, EUR: 3, RUB: 5 }
    const currency = currencyMap[currencyCode] || 1
    const markupPercent = parseFloat(body.markupPercent || 0)
    const allowNoPrice = !!body.allowNoPrice
    const fallbackPrice = Math.max(0, parseFloat(body.fallbackPrice || 19.99))

    // Загружаем существующие продукты и собираем набор уже добавленных CS2 скинов по имени
    const list = loadProducts()
    const existingSkinNames = new Set(
      list
        .filter(p => p && p.source === 'steam_market' && p.category === 'skin')
        .map(p => String(p.cs2MarketName || p.name || '').toLowerCase())
    )

    // Пытаемся получить список топовых CS2 предметов с рынка.
    // Если запрос/парсинг не удаётся, используем офлайн-фолбэк.
    let items = []
    let usedFallback = false
    try {
      const url = `https://steamcommunity.com/market/search/render/?query=&appid=730&start=${start}&count=${limit}&search_descriptions=1&sort_column=popular&sort_dir=desc`
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
          'Accept': 'application/json, text/javascript, text/html, */*; q=0.01'
        }
      })
      if (resp.ok) {
        let js = await resp.json().catch(async () => {
          const txt = await resp.text().catch(() => '')
          return { success: true, results_html: txt }
        })
        if (js && (js.success === true || typeof js.results_html === 'string')) {
          const html = js.results_html || ''
          const rows = []
          const rowRegex = /<a class=\"market_listing_row_link\"[\s\S]*?<\/a>/g
          let match
          while ((match = rowRegex.exec(html)) && rows.length < limit) {
            rows.push(match[0])
          }
          items = rows.map(r => {
            const nameMatch = r.match(/<span class=\"market_listing_item_name\">([^<]+)<\/span>/)
            const name = nameMatch ? nameMatch[1].trim() : ''
            const imgMatch = r.match(/<img[^>]+src=\"([^\"]+)\"/)
            let image = imgMatch ? imgMatch[1] : ''
            image = image.replace('96fx96f', '360fx360f')
            const descMatch = r.match(/<div class=\"market_listing_game_name\">[\s\S]*?<\/div>[\s\S]*?<div class=\"market_listing_item_name_block\">[\s\S]*?<div class=\"market_listing_item_name\">[\s\S]*?<\/div>[\s\S]*?<div class=\"[^\"]*\">([\s\S]*?)<\/div>/)
            const shortDesc = descMatch ? String(descMatch[1]).replace(/<[^>]+>/g, '').trim() : ''
            return { name, image, shortDesc }
          })
          // Убираем пустые имена и дубликаты уже существующих скинов
          .filter(it => it.name && !existingSkinNames.has(String(it.name).toLowerCase()))
        }
      }
    } catch (_) {
      // ignore and use fallback below
    }

    // Офлайн-фолбэк, если не удалось получить ни одного предмета
    if (!Array.isArray(items) || items.length === 0) {
      usedFallback = true
      const localImages = [
        '/images/skins/AWP-GUNGNIR.png',
        '/images/skins/Desert-eagle-fenek.png',
        '/images/skins/kerambit-gradient.png',
        '/images/skins/negev-tra-ta-ta.png',
        '/images/skins/pp-bizon-syd-annubisa.png',
        '/images/skins/saved-off-cracken.png',
        '/images/skins/sport-perchatky-myasnik.png'
      ]
      const topNames = [
        'AK-47 | Fire Serpent', 'M4A1-S | Printstream', 'USP-S | Kill Confirmed', 'AWP | Dragon Lore', 'AK-47 | Case Hardened',
        'Bayonet | Marble Fade', 'Gut Knife | Doppler', 'Butterfly Knife | Fade', 'Shadow Daggers | Ruby', 'Karambit | Doppler',
        'Flip Knife | Tiger Tooth', 'M9 Bayonet | Crimson Web', 'Falchion Knife | Damascus Steel', 'Paracord Knife | Crimson Web',
        'Nomad Knife | Case Hardened', 'Survival Knife | Fade', 'Specialist Gloves | Crimson Kimono', "Sport Gloves | Pandora's Box",
        'Driver Gloves | King Snake', 'Talon Knife | Fade', 'Ursus Knife | Damascus Steel', 'AK-47 | Gold Arabesque', 'Desert Eagle | Blaze',
        'AWP | Asiimov', 'P250 | See Ya Later', 'SG 553 | Dragon Tech', 'Galil AR | Phoenix Blacklight', 'MAC-10 | Stalker',
        'MP9 | Hypersonic', 'Five-SeveN | Crimson Blossom', 'Dual Berettas | Forge', 'CZ75-Auto | Impire', 'P2000 | Oceanic',
        'G3SG1 | Flux', 'SCAR-20 | Magna Carta', 'XM1014 | Oceanic', 'Sawed-Off | Devourer', 'PP-Bizon | Annex',
        'Negev | Power Loader', 'AK-47 | Neon Rider'
      ]
      const limitNames = topNames.slice(0, limit)
      const offline = limitNames
        .map((n, i) => ({ name: n, image: localImages[i % localImages.length] }))
        .filter(o => !existingSkinNames.has(String(o.name).toLowerCase()))
      items = offline
    }

    // Функция определения типа скина
    function detectSkinType(name) {
      const n = String(name).toLowerCase()
      if (n.includes('gloves') || n.includes('перчат')) return 'armor'
      if (n.includes('knife') || n.includes('karambit') || n.includes('bayonet') || n.includes('daggers')) return 'weapon'
      if (n.includes('sticker')) return 'sticker'
      if (n.includes('music kit')) return 'music'
      if (n.includes('patch')) return 'patch'
      if (n.includes('agent')) return 'character'
      return 'weapon'
    }

    // Парсер цены из строки Steam Market ("$12.34", "12,34€" и т.п.)
    function parsePrice(str) {
      if (!str || typeof str !== 'string') return NaN
      const cleaned = str
        .replace(/&nbsp;|\s/g, '')
        .replace(/&#36;/g, '$')
        .replace(/[^0-9,.-]/g, '')
      // Заменяем запятую на точку, сохраняем только первую точку
      const normalized = cleaned.replace(/,(?=[0-9]{2}\b)/, '.').replace(/,/g, '')
      const num = parseFloat(normalized)
      return isNaN(num) ? NaN : num
    }

    // Запрашиваем priceoverview для каждого предмета
    const seenNames = new Set()
    const created = []
    const skipped = []
    const errors = []
    // Вспомогательный парсер описания со страницы листинга предмета
    async function fetchCs2ItemDescription(name) {
      try {
        const enc = encodeURIComponent(name)
        const url = `https://steamcommunity.com/market/listings/730/${enc}`
        const resp = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
          }
        })
        if (!resp.ok) return ''
        const html = await resp.text()
        const m = html.match(/<div class=\"item_desc_description\">([\s\S]*?)<\/div>/)
        const clean = m ? String(m[1]).replace(/<br\s*\/>/g, '\n').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : ''
        return clean
      } catch { return '' }
    }

    for (const [index, item] of items.entries()) {
      try {
        const nameKey = String(item.name).toLowerCase()
        if (seenNames.has(nameKey) || existingSkinNames.has(nameKey)) { skipped.push({ name: item.name, reason: 'duplicate' }); continue }
        let price = NaN
        if (!usedFallback) {
          const nameEnc = encodeURIComponent(item.name)
          const pUrl = `https://steamcommunity.com/market/priceoverview/?appid=730&currency=${currency}&market_hash_name=${nameEnc}`
          const pResp = await fetch(pUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
              'Accept': 'application/json, text/plain, */*'
            }
          })
          if (pResp.ok) {
            const po = await pResp.json().catch(() => null)
            const candidates = [po?.lowest_price, po?.median_price].filter(Boolean)
            for (const s of candidates) {
              const val = parsePrice(String(s))
              if (!isNaN(val)) { price = val; break }
            }
          }
        } else {
          price = fallbackPrice
        }
        if (isNaN(price)) {
          if (!allowNoPrice) { skipped.push({ name: item.name, reason: 'price_not_available' }); continue }
          price = fallbackPrice
        }
        const finalPrice = Math.round(price * (1 + (isNaN(markupPercent) ? 0 : markupPercent) / 100) * 100) / 100

        const safe = (str) => String(str).toLowerCase().replace(/[^a-z0-9\-]+/g, '-').replace(/^-+|-+$/g, '')
        let id = safe(`cs2-${item.name}`)
        if (list.find(p => p.id === id)) id = `${id}-${Date.now()}`

        let descriptionText = item.shortDesc || ''
        if (!usedFallback && !descriptionText) {
          // ограничим парсинг подробного описания для первых 20 предметов, чтобы избежать лишней нагрузки
          descriptionText = index < 20 ? (await fetchCs2ItemDescription(item.name)) : ''
        }
        const product = {
          id,
          name: item.name,
          price: finalPrice,
          image: item.image,
          introImage: item.image,
          category: 'skin',
          type: detectSkinType(item.name),
          images: [item.image],
          description: descriptionText || `CS2 скин: ${item.name}. Источник: Steam Market`,
          source: 'steam_market',
          cs2MarketName: item.name
        }
        created.push(product)
        seenNames.add(nameKey)
      } catch (e) {
        errors.push({ name: item?.name || 'unknown', error: 'ingest_failed' })
      }
    }

    const next = [...created, ...list]
    const ok = saveProducts(next)
    if (!ok) return res.status(500).json({ ok: false, error: 'persist_failed' })
    return res.json({ ok: true, createdCount: created.length, skipped, errors })
  } catch (e) {
    console.error('[bot/cs2-skins-ingest] error', e)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})

// Обогащение уже существующих CS2 скинов: обновление описаний и фото с рынка
app.post('/bot/cs2-skins-enrich', async (req, res) => {
  try {
    const body = req.body || {}
    const limit = Math.max(1, parseInt(body.limit || 50, 10))
    const list = loadProducts()
    const skins = list.filter(p => p && p.category === 'skin' && (p.source === 'steam_market' || p.cs2MarketName))
    const target = skins.slice(0, limit)

    // Получение изображения через search/render (надёжнее, чем страница листинга для некоторых предметов)
    async function fetchImageFromSearch(name) {
      try {
        const enc = encodeURIComponent(name)
        const url = `https://steamcommunity.com/market/search/render/?appid=730&query=${enc}&start=0&count=10&search_descriptions=1`
        const resp = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
            'Accept': 'application/json, text/javascript, text/html, */*; q=0.01'
          }
        })
        if (!resp.ok) return ''
        const js = await resp.json().catch(() => ({}))
        const html = String(js.results_html || '')
        // Ищем economy/image
        const m = html.match(/<img[^>]+src="(https?:\/\/[^"\s]+economy\/image[^"\s]+)"/i)
        let img = m ? m[1] : ''
        // Увеличиваем размер если есть суффикс
        if (img) {
          img = img.replace(/\/(\d+)fx\1f/,'/360fx360f')
          img = img.replace('96fx96f','360fx360f')
        }
        return img
      } catch { return '' }
    }

    async function fetchDetails(name) {
      try {
        const enc = encodeURIComponent(name)
        const url = `https://steamcommunity.com/market/listings/730/${enc}`
        const resp = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
          }
        })
        if (!resp.ok) {
          // Попробуем хотя бы картинку через search
          const imgFromSearch = await fetchImageFromSearch(name)
          return { description: '', image: imgFromSearch }
        }
        const html = await resp.text()
        const descMatch = html.match(/<div class=\"item_desc_description\">([\s\S]*?)<\/div>/)
        const description = descMatch ? String(descMatch[1]).replace(/<br\s*\/>/g, '\n').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : ''
        let image = ''
        // Первая попытка: большая картинка на странице листинга
        const imgMatch1 = html.match(/<div class=\"market_listing_largeimage\">[\s\S]*?<img[^>]+src=\"([^\"]+)\"/)
        if (imgMatch1) image = imgMatch1[1]
        // Вторая попытка: economy/image из миниатюры
        if (!image) {
          const imgMatch2 = html.match(/<img[^>]+src=\"(https?:\/\/[^\"]+economy\/image[^\"]+)\"/i)
          if (imgMatch2) image = imgMatch2[1]
        }
        // Если всё ещё пусто — пробуем через search/render
        if (!image) image = await fetchImageFromSearch(name)
        if (image) {
          image = image.replace(/\/(\d+)fx\1f/,'/360fx360f').replace('96fx96f','360fx360f')
        }
        return { description, image }
      } catch { return { description: '', image: '' } }
    }

    const updated = []
    for (const p of target) {
      const name = p.cs2MarketName || p.name
      const details = await fetchDetails(name)
      const next = { ...p }
      if (details.description) next.description = details.description
      if (details.image) {
        next.image = details.image
        next.introImage = details.image
        next.images = [details.image]
        next.source = 'steam_market'
      }
      updated.push(next)
    }
    // merge обратно по id
    const byId = new Map(list.map(p => [p.id, p]))
    for (const u of updated) { byId.set(u.id, u) }
    const merged = Array.from(byId.values())
    const ok = saveProducts(merged)
    if (!ok) return res.status(500).json({ ok: false, error: 'persist_failed' })
    return res.json({ ok: true, updatedCount: updated.length })
  } catch (e) {
    console.error('[bot/cs2-skins-enrich] error', e)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})
// ======= Проксирование изображений Steam для обхода CORS =======
// Прокси для изображений игр (cdn.cloudflare.steamstatic.com)
// ВАЖНО: Эти роуты должны быть ДО статики и catch-all роутов
app.get('/steam-image/*', async (req, res, next) => {
  const imagePath = sanitizeRelativePath(req.params[0])
  if (!imagePath) return next()

  const localPath = path.join(PUBLIC_IMAGES_DIR, 'steam-games', imagePath)
  const remoteUrl = `${STEAM_CDN_BASE}/${imagePath.replace(/\\/g, '/')}`

  await serveRemoteImage({
    res,
    remoteUrl,
    localPath,
    extraHeaders: { 'Access-Control-Allow-Origin': '*' },
    onNotFound: () => next()
  })
})

// Прокси для изображений скинов и предметов (steamcommunity-a.akamaihd.net)
app.get('/steam-economy-image/*', async (req, res, next) => {
  const imagePath = sanitizeRelativePath(req.params[0])
  if (!imagePath) return next()

  const remoteUrl = `${STEAM_ECONOMY_BASE}/economy/image/${imagePath}`
  const localPath = path.join(PUBLIC_IMAGES_DIR, 'steam-economy-image', imagePath)

  await serveRemoteImage({
    res,
    remoteUrl,
    localPath,
    extraHeaders: { 'Access-Control-Allow-Origin': '*' },
    referer: 'https://steamcommunity.com/',
    onNotFound: () => next()
  })
})

// Универсальный прокси для любых Steam изображений (автоматически определяет домен)
app.get('/steam-proxy/:path(*)', async (req, res, next) => {
  try {
    const fullPath = sanitizeRelativePath(req.params.path || req.url.replace('/steam-proxy/', ''))
    if (!fullPath) return next()

    let remoteUrl = ''
    let localPath = ''
    let referer = 'https://store.steampowered.com/'

    const posixFullPath = fullPath.replace(/\\/g, '/')

    if (posixFullPath.startsWith('economy/image/')) {
      remoteUrl = `${STEAM_ECONOMY_BASE}/${posixFullPath}`
      localPath = path.join(PUBLIC_IMAGES_DIR, 'steam-economy-image', fullPath.replace(/^economy\/image\//, ''))
      referer = 'https://steamcommunity.com/'
    } else if (posixFullPath.startsWith('steam/')) {
      remoteUrl = `${STEAM_CDN_BASE}/${posixFullPath}`
      localPath = path.join(PUBLIC_IMAGES_DIR, 'steam-games', fullPath.replace(/^steam\//, ''))
    } else if (posixFullPath.startsWith('apps/')) {
      remoteUrl = `${STEAM_CDN_BASE}/steam/${posixFullPath}`
      localPath = path.join(PUBLIC_IMAGES_DIR, 'steam-games', `steam/${fullPath}`)
    } else {
      remoteUrl = `${STEAM_ECONOMY_BASE}/economy/image/${posixFullPath}`
      localPath = path.join(PUBLIC_IMAGES_DIR, 'steam-economy-image', fullPath)
      referer = 'https://steamcommunity.com/'
      }

    await serveRemoteImage({
      res,
      remoteUrl,
      localPath,
      referer,
      extraHeaders: { 'Access-Control-Allow-Origin': '*' },
      onNotFound: () => res.status(404).send('Image not found')
    })
  } catch (error) {
    console.error('[steam-proxy] Error:', error?.message)
    if (!res.headersSent) {
    res.status(500).send('Error fetching image')
    }
  }
})

// ======= Статические файлы: skins-steams =======
app.use('/skins-steams', express.static(SKINS_STATIC_DIR, {
  maxAge: '30d',
  etag: true
}))

// ======= Статическая выдача собранного фронтенда (Vite dist) =======
// Определяем папку dist в зависимости от домена
function getSiteNameForHost() { return SITE_DOMAIN }

function getDistDirForHost() { return path.join(process.cwd(), 'dist') }

const DIST = path.join(process.cwd(), 'dist')
const distExists = fs.existsSync(DIST) && fs.existsSync(path.join(DIST, 'index.html'))

if (distExists) {
  // Создаём middleware для статических файлов с определением домена
  const serveStaticForDomain = (req, res, next) => {
    // Пропускаем API запросы и специальные пути
    if (req.path.startsWith('/api/') || 
        req.path.startsWith('/auth/') || 
        req.path.startsWith('/bot/') ||
        req.path.startsWith('/images/') ||
        req.path.startsWith('/steam-') ||
        req.path.startsWith('/skins-steams/') ||
        req.path.startsWith('/core/') ||
        req.path.startsWith('/product-messages')) {
      return next()
    }
    
    // Определяем домен из заголовков
    const distDir = getDistDirForHost()
    let indexPath = path.join(distDir, 'index.html')
    
    if (!fs.existsSync(distDir) || !fs.existsSync(indexPath)) { return next() }
    
    // Пробуем отдать статический файл
    const staticMiddleware = express.static(distDir, {
      maxAge: '7d',
      etag: true
    })
    
    staticMiddleware(req, res, () => {
      // Если файл не найден и это не API запрос, отдаём index.html для SPA routing
      if (!res.headersSent) {
        res.sendFile(indexPath)
      }
    })
  }
  
  // Применяем middleware для всех запросов
  app.use(serveStaticForDomain)
  
  // SPA fallback - отдаём index.html для всех путей, которые не являются API или статикой
  app.get('*', (req, res, next) => {
    // Пропускаем API запросы
    if (req.path.startsWith('/api/') || 
        req.path.startsWith('/auth/') || 
        req.path.startsWith('/bot/') ||
        req.path.startsWith('/images/') ||
        req.path.startsWith('/steam-') ||
        req.path.startsWith('/skins-steams/') ||
        req.path.startsWith('/core/') ||
        req.path.startsWith('/product-messages')) {
      return next()
    }
    
    const distDir = getDistDirForHost()
    let indexPath = path.join(distDir, 'index.html')
    if (!fs.existsSync(indexPath)) { return res.status(404).send('Frontend not built. Run npm run build first.') }
    
    res.sendFile(indexPath)
  })
  
  console.log('[server] Frontend dist folder configured: ' + DIST)
} else {
  console.warn('[server] Frontend dist not found. Run npm run build first.')
}

// ======= Автообновление каталога: периодический импорт топ-продаж Steam =======
const AUTO_INGEST_TOP = String(process.env.AUTO_INGEST_TOP || '').trim() === '1'
const AUTO_INGEST_INTERVAL_MIN = Math.max(10, parseInt(process.env.AUTO_INGEST_INTERVAL_MIN || '360', 10))
async function runTopIngestOnce() {
  try {
    const payload = {
      limit: Math.max(10, parseInt(process.env.AUTO_INGEST_LIMIT || '60', 10)),
      markupPercent: parseFloat(process.env.AUTO_INGEST_MARKUP || '10'),
      cc: process.env.AUTO_INGEST_CC || 'us',
      lang: process.env.AUTO_INGEST_LANG || 'en',
      allowNoPrice: true,
      fallbackPrice: Math.max(0, parseFloat(process.env.AUTO_INGEST_FALLBACK || '29.99'))
    }
    const res = await fetch(`http://localhost:${PORT}/bot/top-ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const json = await res.json().catch(() => ({}))
    console.log(`[scheduler] top-ingest status=${res.status} created=${json.createdCount ?? '?'} errors=${(json.errors||[]).length}`)
  } catch (e) {
    console.error('[scheduler] top-ingest error', e)
  }
}
if (AUTO_INGEST_TOP) {
  // Первый запуск при старте
  runTopIngestOnce()
  // Интервальный запуск
  setInterval(runTopIngestOnce, AUTO_INGEST_INTERVAL_MIN * 60_000)
}

// Проверка SMTP при старте сервера
console.log('\n' + '='.repeat(80))
console.log('[server] Проверка конфигурации SMTP...')
import('./services/emailService.js').then(({ getMailTransporter }) => {
  const testTransporter = getMailTransporter()
  if (testTransporter) {
    console.log('[server] ✅ SMTP транспорт успешно инициализирован')
    // Проверяем соединение
    testTransporter.verify().then(() => {
      console.log('[server] ✅ SMTP соединение проверено успешно')
    }).catch((error) => {
      console.error('[server] ❌ Ошибка проверки SMTP соединения:', error?.message)
      console.error('[server] Убедитесь, что SMTP_HOST, SMTP_USER и SMTP_PASS настроены правильно')
    })
  } else {
    console.error('[server] ❌ SMTP транспорт не настроен!')
    console.error('[server] Для отправки email необходимо настроить следующие переменные окружения:')
    console.error('[server]   - SMTP_HOST (например: smtp.gmail.com)')
    console.error('[server]   - SMTP_PORT (например: 465 или 587)')
    console.error('[server]   - SMTP_USER (email для авторизации)')
    console.error('[server]   - SMTP_PASS (пароль приложения)')
    console.error('[server]   - SMTP_SECURE (true для порта 465, false для 587)')
  }
  console.log('='.repeat(80) + '\n')
}).catch((error) => {
  console.error('[server] Ошибка при проверке SMTP:', error?.message)
})