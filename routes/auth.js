// Роуты для авторизации (Steam + Email)
import express from 'express'
import crypto from 'crypto'
import { findUserByEmail, findUserBySteamId, upsertUser, verifyUserEmail, hashPassword } from '../models/user.js'
import { sendEmailVerificationEmail } from '../services/emailService.js'

const router = express.Router()

/**
 * POST /api/auth/email/register - Регистрация через email
 */
router.post('/email/register', async (req, res) => {
  try {
    const { email, password, username } = req.body

    if (!email || !email.includes('@')) {
      return res.status(400).json({ ok: false, error: 'invalid_email' })
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ ok: false, error: 'password_too_short' })
    }

    // Проверяем, не зарегистрирован ли уже такой email
    const existingUser = findUserByEmail(email)
    if (existingUser) {
      return res.status(409).json({ ok: false, error: 'email_already_registered' })
    }

    // Генерируем токен для подтверждения email
    const verificationToken = crypto.randomBytes(32).toString('hex')
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 часа

    // Хешируем пароль
    const { hash: passwordHash, salt: passwordSalt } = hashPassword(password)

    // Создаем пользователя
    const user = upsertUser({
      email,
      passwordHash,
      passwordSalt,
      emailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: verificationExpires.toISOString(),
      username: username || email.split('@')[0],
      displayName: username || email.split('@')[0],
      balance: 0,
      currency: 'RUB',
      provider: 'local'
    })

    // Отправляем письмо для подтверждения
    const verificationUrl = `${process.env.FRONTEND_URL || 'https://gamesale.shop'}/auth/verify-email?token=${verificationToken}&userId=${user.id}`
    
    try {
      const emailResult = await sendEmailVerificationEmail({
        email,
        userName: user.username,
        verificationToken,
        verificationUrl
      })
      
      if (!emailResult.success) {
        console.warn('[auth] Failed to send verification email:', emailResult.error)
        // Пользователь все равно создан, но email не отправлен
      }
    } catch (error) {
      console.error('[auth] Email verification error:', error?.message)
      // Пользователь создан, но email не отправлен - продолжаем
    }

    return res.json({
      ok: true,
      message: 'verification_email_sent',
      userId: user.id
    })
  } catch (error) {
    console.error('[auth] Email register error:', error?.message)
    return res.status(500).json({ ok: false, error: 'registration_failed' })
  }
})

/**
 * GET /api/auth/email/verify - Подтверждение email
 */
router.get('/email/verify', async (req, res) => {
  try {
    const { token, userId } = req.query

    if (!token || !userId) {
      return res.status(400).json({ ok: false, error: 'missing_params' })
    }

    const result = verifyUserEmail(userId, token)

    if (!result.success) {
      return res.status(400).json({ ok: false, error: result.error })
    }

    // Редирект на страницу успешного подтверждения
    const frontendUrl = process.env.FRONTEND_URL || 'https://gamesale.shop'
    return res.redirect(`${frontendUrl}/auth/email-verified?success=true`)
  } catch (error) {
    console.error('[auth] Email verify error:', error?.message)
    return res.status(500).json({ ok: false, error: 'verification_failed' })
  }
})

/**
 * POST /api/auth/email/login - Вход через email
 */
router.post('/email/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ ok: false, error: 'missing_credentials' })
    }

    const user = findUserByEmail(email)
    if (!user) {
      return res.status(401).json({ ok: false, error: 'invalid_credentials' })
    }

    // Проверка пароля
    const { verifyPassword } = await import('../models/user.js')
    if (!user.passwordHash || !user.passwordSalt || !verifyPassword(password, user.passwordHash, user.passwordSalt)) {
      return res.status(401).json({ ok: false, error: 'invalid_credentials' })
    }

    // Проверяем, что email подтвержден
    if (!user.emailVerified) {
      return res.status(403).json({ ok: false, error: 'email_not_verified' })
    }

    // Обновляем время последнего входа
    upsertUser({
      ...user,
      lastLoginAt: new Date().toISOString()
    })

    // Сохраняем пользователя в сессии
    req.session.user = {
      id: user.id,
      email: user.email,
      username: user.username,
      emailVerified: user.emailVerified,
      steamId: user.steamId
    }
    req.session.save()

    return res.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        emailVerified: user.emailVerified,
        balance: user.balance || 0,
        steamId: user.steamId
      }
    })
  } catch (error) {
    console.error('[auth] Email login error:', error?.message)
    return res.status(500).json({ ok: false, error: 'login_failed' })
  }
})

export default router

