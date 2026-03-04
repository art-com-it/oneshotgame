// Сервис для проверки Яндекс Капчи на сервере
const YANDEX_CAPTCHA_SECRET_KEY = (process.env.YANDEX_CAPTCHA_SECRET_KEY || '').trim()

/**
 * Проверка токена Яндекс Капчи на сервере
 * @param {string} token - Токен капчи, полученный от клиента
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function verifyYandexCaptcha(token, ipAddress = '') {
  console.log('\n' + '─'.repeat(60))
  console.log('[yandex-captcha] 🔐 НАЧАЛО ПРОВЕРКИ КАПЧИ')
  console.log('[yandex-captcha] verifyYandexCaptcha called')
  console.log('[yandex-captcha] Token:', token ? token.substring(0, 20) + '...' : 'missing')
  console.log('[yandex-captcha] IP:', ipAddress || 'not provided')
  console.log('[yandex-captcha] Secret key:', YANDEX_CAPTCHA_SECRET_KEY ? YANDEX_CAPTCHA_SECRET_KEY.substring(0, 20) + '...' : 'missing')
  
  if (!token) {
    console.error('[yandex-captcha] ❌ Token missing!')
    return { success: false, error: 'captcha_token_missing' }
  }

  if (!YANDEX_CAPTCHA_SECRET_KEY || YANDEX_CAPTCHA_SECRET_KEY === 'YOUR_YANDEX_CAPTCHA_SERVER_KEY') {
    console.error('[yandex-captcha] ❌ Secret key not configured!')
    return { success: false, error: 'captcha_server_key_not_configured' }
  }

  try {
    const requestBody = new URLSearchParams({
      secret: YANDEX_CAPTCHA_SECRET_KEY,
      token: token,
      ip: ipAddress || ''
    })
    
    console.log('[yandex-captcha] Sending verification request...')
    const response = await fetch('https://smartcaptcha.yandexcloud.net/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: requestBody
    })

    console.log('[yandex-captcha] Response status:', response.status)
    const data = await response.json()
    console.log('[yandex-captcha] Response data:', data)

    if (data.status === 'ok') {
      console.log('[yandex-captcha] ✅ ПРОВЕРКА КАПЧИ УСПЕШНА')
      console.log('[yandex-captcha] Verification successful')
      console.log('─'.repeat(60) + '\n')
      return { success: true }
    } else {
      console.error('[yandex-captcha] ❌ ПРОВЕРКА КАПЧИ НЕ ПРОЙДЕНА')
      console.error('[yandex-captcha] Verification failed:', data)
      console.error('─'.repeat(60) + '\n')
      return { success: false, error: data.message || 'captcha_verification_failed' }
    }
  } catch (error) {
    console.error('[yandex-captcha] ❌ Verification error:', error?.message)
    console.error('[yandex-captcha] Error stack:', error?.stack)
    return { success: false, error: 'captcha_verification_error' }
  }
}

