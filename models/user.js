import fs from 'fs'
import path from 'path'

const USERS_FILE = path.join(process.cwd(), 'data', 'users.json')

// Загружаем пользователей из файла
export function loadUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) {
      return []
    }
    const data = fs.readFileSync(USERS_FILE, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    console.error('[users] Error loading users:', error?.message)
    return []
  }
}

// Сохраняем пользователей в файл
export function saveUsers(users) {
  try {
    fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true })
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8')
    return true
  } catch (error) {
    console.error('[users] Error saving users:', error?.message)
    return false
  }
}

// Найти пользователя по ID
export function findUserById(userId) {
  const users = loadUsers()
  return users.find(u => u.id === userId)
}

// Найти пользователя по Steam ID
export function findUserBySteamId(steamId) {
  const users = loadUsers()
  return users.find(u => u.steamId === steamId)
}

// Найти пользователя по email
export function findUserByEmail(email) {
  const users = loadUsers()
  return users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase())
}

// Хеширование пароля
function hashPassword(password) {
  if (!password) return { hash: null, salt: null }
  const salt = crypto.randomBytes(32).toString('hex')
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex')
  return { hash, salt }
}

// Проверка пароля
function verifyPassword(password, hash, salt) {
  if (!password || !hash || !salt) return false
  const hashToVerify = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex')
  return hash === hashToVerify
}

export { hashPassword, verifyPassword }

// Создать или обновить пользователя
export function upsertUser(userData) {
  const users = loadUsers()
  const existingIndex = users.findIndex(u => 
    u.id === userData.id || 
    (userData.steamId && u.steamId === userData.steamId) ||
    (userData.email && u.email && u.email.toLowerCase() === userData.email.toLowerCase())
  )
  
  const user = {
    id: userData.id || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    steamId: userData.steamId || null,
    email: userData.email || null,
    emailVerified: userData.emailVerified !== undefined ? userData.emailVerified : (existingIndex >= 0 ? users[existingIndex].emailVerified : false),
    emailVerificationToken: userData.emailVerificationToken || null,
    emailVerificationExpires: userData.emailVerificationExpires || null,
    passwordHash: userData.passwordHash || null,
    passwordSalt: userData.passwordSalt || null,
    username: userData.username || userData.displayName || 'User',
    displayName: userData.displayName || userData.username || 'User',
    avatar: userData.avatar || null,
    balance: userData.balance !== undefined ? userData.balance : (existingIndex >= 0 ? (users[existingIndex].balance || 0) : 0),
    currency: userData.currency || 'RUB',
    createdAt: userData.createdAt || (existingIndex >= 0 ? users[existingIndex].createdAt : new Date().toISOString()),
    updatedAt: new Date().toISOString(),
    lastLoginAt: userData.lastLoginAt || null,
    provider: userData.provider || 'local',
    role: userData.role || 'user',
    settings: {
      emailNotifications: userData.settings?.emailNotifications !== false,
      transactionNotifications: userData.settings?.transactionNotifications !== false,
      ...(existingIndex >= 0 ? users[existingIndex].settings || {} : {}),
      ...(userData.settings || {})
    },
    stats: {
      totalSales: userData.stats?.totalSales || (existingIndex >= 0 ? (users[existingIndex].stats?.totalSales || 0) : 0),
      totalPurchases: userData.stats?.totalPurchases || (existingIndex >= 0 ? (users[existingIndex].stats?.totalPurchases || 0) : 0),
      totalRevenue: userData.stats?.totalRevenue || (existingIndex >= 0 ? (users[existingIndex].stats?.totalRevenue || 0) : 0),
      totalSpent: userData.stats?.totalSpent || (existingIndex >= 0 ? (users[existingIndex].stats?.totalSpent || 0) : 0),
      ...(existingIndex >= 0 ? users[existingIndex].stats || {} : {}),
      ...(userData.stats || {})
    }
  }

  if (existingIndex >= 0) {
    // Обновляем существующего пользователя
    const existing = users[existingIndex]
    user.id = existing.id
    user.createdAt = existing.createdAt
    user.balance = userData.balance !== undefined ? userData.balance : existing.balance
    user.email = userData.email || existing.email
    user.emailVerified = userData.emailVerified !== undefined ? userData.emailVerified : existing.emailVerified
    users[existingIndex] = user
  } else {
    // Добавляем нового пользователя
    users.push(user)
  }

  saveUsers(users)
  return user
}

// Обновить баланс пользователя
export function updateUserBalance(userId, amount, operation = 'add') {
  const users = loadUsers()
  const userIndex = users.findIndex(u => u.id === userId)
  
  if (userIndex < 0) {
    throw new Error('User not found')
  }

  const user = users[userIndex]
  const newBalance = operation === 'add' 
    ? (user.balance || 0) + amount
    : (user.balance || 0) - amount

  if (newBalance < 0) {
    throw new Error('Insufficient balance')
  }

  user.balance = newBalance
  user.updatedAt = new Date().toISOString()
  users[userIndex] = user
  
  saveUsers(users)
  return user
}

// Установить email как подтвержденный
export function verifyUserEmail(userId, token) {
  const users = loadUsers()
  const userIndex = users.findIndex(u => u.id === userId)
  
  if (userIndex < 0) {
    return { success: false, error: 'User not found' }
  }

  const user = users[userIndex]
  
  if (!user.emailVerificationToken || user.emailVerificationToken !== token) {
    return { success: false, error: 'Invalid verification token' }
  }

  if (user.emailVerificationExpires && new Date(user.emailVerificationExpires) < new Date()) {
    return { success: false, error: 'Verification token expired' }
  }

  user.emailVerified = true
  user.emailVerificationToken = null
  user.emailVerificationExpires = null
  user.updatedAt = new Date().toISOString()
  users[userIndex] = user
  
  saveUsers(users)
  return { success: true, user }
}

