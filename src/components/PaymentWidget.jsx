import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

export default function PaymentWidget({ amount, currency = 'RUB', description = '', onPaymentCreated, additionalData = {}, disableRedirect = false, defaultEmail = '' }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [userEmail, setUserEmail] = useState(defaultEmail || '')
  const [userName, setUserName] = useState('')
  
  // Обновляем email при изменении defaultEmail
  useEffect(() => {
    if (defaultEmail && defaultEmail !== userEmail) {
      console.log('[PaymentWidget] Обновляем email из defaultEmail:', defaultEmail)
      setUserEmail(defaultEmail)
    }
  }, [defaultEmail])
  const [captchaToken, setCaptchaToken] = useState(null)
  const [captchaLoaded, setCaptchaLoaded] = useState(false)
  const captchaContainerRef = useRef(null)
  const captchaInitializedRef = useRef(false) // Флаг для предотвращения множественной инициализации
  const captchaInstanceRef = useRef(null) // Сохраняем ID экземпляра капчи для очистки
  const captchaContainerKeyRef = useRef(`captcha-${Date.now()}-${Math.random()}`)
  const isMountedRef = useRef(true) // Флаг для отслеживания монтирования компонента
  const navigate = useNavigate()
  
  // Логирование при монтировании
  useEffect(() => {
    console.log('[PaymentWidget] Компонент смонтирован')
    console.log('[PaymentWidget] Props:', { amount, currency, description, disableRedirect, defaultEmail })
    isMountedRef.current = true
    // НЕ очищаем капчу при размонтировании - это вызывает конфликт с React
    // React сам управляет DOM и удалит контейнер при размонтировании
    // Попытка удалить элементы капчи вручную вызывает ошибку removeChild
    return () => {
      console.log('[PaymentWidget] Компонент размонтируется - React сам очистит DOM')
      isMountedRef.current = false
      // Только сбрасываем флаги, НЕ трогаем DOM вообще
      // React сам удалит контейнер и все дочерние элементы
      // Любые попытки вручную удалить элементы капчи вызывают ошибку removeChild
      captchaInitializedRef.current = false
      captchaInstanceRef.current = null
    }
  }, [])
  
  // Инициализация капчи
  const initializeCaptcha = React.useCallback(() => {
    console.log('[PaymentWidget] initializeCaptcha called')
    console.log('[PaymentWidget] window.smartCaptcha:', !!window.smartCaptcha)
    console.log('[PaymentWidget] captchaContainerRef.current:', !!captchaContainerRef.current)
    console.log('[PaymentWidget] captchaInitializedRef.current:', captchaInitializedRef.current)
    
    if (!window.smartCaptcha) {
      console.error('[PaymentWidget] ❌ smartCaptcha не загружен!')
      setError('Скрипт капчи не загружен. Проверьте подключение к интернету.')
      return
    }
    
    if (!captchaContainerRef.current) {
      console.error('[PaymentWidget] ❌ Контейнер капчи не готов!')
      return
    }

    // Проверяем, не инициализирована ли уже капча в этом контейнере
    const existingCaptcha = captchaContainerRef.current.querySelector('.smart-captcha')
    if (existingCaptcha) {
      console.log('[PaymentWidget] ✅ Капча уже инициализирована (найдена в DOM), пропускаем')
      captchaInitializedRef.current = true // Устанавливаем флаг, чтобы не пытаться инициализировать снова
      return
    }
    
    if (captchaInitializedRef.current) {
      console.log('[PaymentWidget] ✅ Капча уже инициализирована (флаг установлен), пропускаем')
      return
    }
    
    // Устанавливаем флаг ДО инициализации, чтобы предотвратить повторные вызовы
    captchaInitializedRef.current = true
    console.log('[PaymentWidget] Устанавливаем флаг инициализации')

    // Ключ клиента Яндекс Капчи
    const siteKey = import.meta.env.VITE_YANDEX_CAPTCHA_SITE_KEY || 'ysc1_Clz8SYef73qkj7KGD26iKXQy37BNg2b8YNIJ1R3s2905c8c1'
    
    if (!siteKey || siteKey === 'YOUR_YANDEX_CAPTCHA_SITE_KEY') {
      console.error('[PaymentWidget] ❌ Ключ капчи не настроен!')
      setError('Ключ капчи не настроен. Обратитесь к администратору.')
      return
    }
    
    console.log('[PaymentWidget] 🔑 Инициализация капчи с ключом:', siteKey.substring(0, 20) + '...')
    console.log('[PaymentWidget] Контейнер размеры:', {
      width: captchaContainerRef.current.offsetWidth,
      height: captchaContainerRef.current.offsetHeight
    })
    
    try {
      // Сохраняем ID экземпляра капчи для последующей очистки
      const container = captchaContainerRef.current
      if (!container) {
        console.error('[PaymentWidget] ❌ Контейнер потерян перед инициализацией')
        captchaInitializedRef.current = false
        return
      }
      
      // Проверяем, что компонент еще смонтирован
      if (!isMountedRef.current) {
        console.log('[PaymentWidget] Компонент размонтирован, пропускаем инициализацию капчи')
        captchaInitializedRef.current = false
        return
      }
      
      try {
        const captchaId = window.smartCaptcha.render(container, {
          sitekey: siteKey,
          callback: (token) => {
            console.log('[PaymentWidget] ✅ Капча пройдена, токен получен:', token ? token.substring(0, 20) + '...' : 'empty')
            // Проверяем, что компонент еще смонтирован перед обновлением состояния
            if (isMountedRef.current && token) {
              setCaptchaToken(token)
              setError(null) // Очищаем ошибки при успешной проверке
            }
          },
          'error-callback': (error) => {
            console.error('[PaymentWidget] ❌ Ошибка капчи:', error)
            // Проверяем, что компонент еще смонтирован перед обновлением состояния
            if (isMountedRef.current) {
              setError('Ошибка загрузки капчи: ' + (error?.message || 'Неизвестная ошибка') + '. Пожалуйста, обновите страницу.')
              setCaptchaToken(null)
              captchaInitializedRef.current = false // Сбрасываем флаг при ошибке
              captchaInstanceRef.current = null
            }
          }
        })
        captchaInstanceRef.current = captchaId
        console.log('[PaymentWidget] ✅ Капча успешно инициализирована, ID:', captchaId)
      } catch (renderError) {
        console.error('[PaymentWidget] ❌ Ошибка рендеринга капчи:', renderError)
        captchaInitializedRef.current = false
        captchaInstanceRef.current = null
        if (isMountedRef.current) {
          setError('Не удалось загрузить капчу: ' + (renderError?.message || 'Неизвестная ошибка'))
        }
      }
    } catch (error) {
      console.error('[PaymentWidget] ❌ Ошибка инициализации капчи:', error)
      console.error('[PaymentWidget] Error stack:', error?.stack)
      setError('Не удалось загрузить капчу: ' + (error?.message || 'Неизвестная ошибка'))
      setCaptchaToken(null)
      captchaInitializedRef.current = false
      captchaInstanceRef.current = null
    }
  }, [])

  // Загружаем Яндекс Капчу
  useEffect(() => {
    // Загружаем скрипт Яндекс Капчи
    const scriptId = 'yandex-captcha-script'
    
    // Проверяем, загружен ли уже скрипт
    if (window.smartCaptcha) {
      if (isMountedRef.current) {
        setCaptchaLoaded(true)
      }
      // Небольшая задержка для гарантии, что контейнер готов
      const timeoutId = setTimeout(() => {
        if (isMountedRef.current && !captchaInitializedRef.current) {
          initializeCaptcha()
        }
      }, 200)
      return () => clearTimeout(timeoutId)
    }

    if (document.getElementById(scriptId)) {
      // Скрипт уже добавлен, ждем загрузки
      let timeoutId2 = null
      const checkInterval = setInterval(() => {
        if (window.smartCaptcha) {
          if (isMountedRef.current) {
            setCaptchaLoaded(true)
          }
          clearInterval(checkInterval)
          timeoutId2 = setTimeout(() => {
            if (isMountedRef.current && !captchaInitializedRef.current) {
              initializeCaptcha()
            }
          }, 200)
        }
      }, 100)
      
      return () => {
        clearInterval(checkInterval)
        if (timeoutId2) clearTimeout(timeoutId2)
      }
    }

    const script = document.createElement('script')
    script.id = scriptId
    script.src = 'https://smartcaptcha.yandexcloud.net/captcha.js'
    script.async = true
    script.defer = true
    
    script.onload = () => {
      console.log('[PaymentWidget] ✅ Скрипт капчи загружен успешно')
      console.log('[PaymentWidget] window.smartCaptcha доступен:', typeof window.smartCaptcha)
      if (isMountedRef.current) {
        setCaptchaLoaded(true)
      }
      // Задержка для гарантии, что контейнер готов
      const timeoutId1 = setTimeout(() => {
        if (!isMountedRef.current) return
        
        const container = captchaContainerRef.current
        if (container) {
          console.log('[PaymentWidget] ✅ Контейнер готов, инициализируем капчу')
          console.log('[PaymentWidget] Размеры контейнера:', {
            width: container.offsetWidth,
            height: container.offsetHeight,
            visible: container.offsetParent !== null
          })
          if (!captchaInitializedRef.current) {
            initializeCaptcha()
          } else {
            console.log('[PaymentWidget] Капча уже инициализирована, пропускаем')
          }
        } else {
          console.warn('[PaymentWidget] ⚠️ Контейнер еще не готов, повторная попытка через 500ms')
          const timeoutId2 = setTimeout(() => {
            if (!isMountedRef.current) return
            
            const containerRetry = captchaContainerRef.current
            if (containerRetry && !captchaInitializedRef.current) {
              console.log('[PaymentWidget] ✅ Контейнер найден при повторной попытке')
              initializeCaptcha()
            } else if (containerRetry && captchaInitializedRef.current) {
              console.log('[PaymentWidget] Капча уже инициализирована')
            } else {
              console.error('[PaymentWidget] ❌ Контейнер капчи не найден после загрузки скрипта')
              if (isMountedRef.current) {
                setError('Не удалось найти контейнер для капчи. Обновите страницу.')
              }
            }
          }, 500)
          
          // Очистка timeoutId2 будет выполнена при размонтировании через return ниже
        }
      }, 300)
      
      return () => clearTimeout(timeoutId1)
    }
    
    script.onerror = () => {
      console.error('[PaymentWidget] Ошибка загрузки скрипта капчи')
      setError('Не удалось загрузить скрипт капчи')
    }

    document.head.appendChild(script)

    return () => {
      // Не удаляем скрипт, так как он может использоваться другими компонентами
    }
  }, [initializeCaptcha])

  // УБРАНО: Дублирующие useEffect для инициализации капчи
  // Инициализация происходит только в основном useEffect при загрузке скрипта

  const handleCreatePayment = async () => {
    console.log('\n' + '='.repeat(80))
    console.log('[PaymentWidget] 🚀 НАЧАЛО СОЗДАНИЯ ПЛАТЕЖА')
    console.log('[PaymentWidget] handleCreatePayment called')
    console.log('[PaymentWidget] State:', {
      amount,
      userEmail,
      userName,
      captchaToken: captchaToken ? 'present' : 'missing',
      captchaLoaded
    })
    console.log('='.repeat(80) + '\n')
    
    try {
      setLoading(true)
      setError(null)

      // Проверяем капчу
      if (!captchaToken) {
        console.error('[PaymentWidget] Captcha token missing!')
        setError('Пожалуйста, пройдите проверку капчи')
        setLoading(false)
        return
      }
      console.log('[PaymentWidget] Captcha token validated:', captchaToken.substring(0, 20) + '...')

      // Проверяем email с помощью регулярного выражения
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!userEmail || !emailRegex.test(userEmail.trim())) {
        console.error('[PaymentWidget] Email validation failed:', userEmail)
        setError('Пожалуйста, укажите корректный email адрес')
        setLoading(false)
        return
      }
      console.log('[PaymentWidget] Email validated:', userEmail)

      // Определяем endpoint в зависимости от типа платежа
      let endpoint = '/api/payments/create-by-amount'
      if (additionalData.steamId) {
        endpoint = '/api/payments/create-steam-topup'
      } else if (additionalData.deeplinkId) {
        // Для диплинков используем специальный endpoint
        endpoint = `/api/deeplink/${additionalData.deeplinkId}/pay`
      }
      
      const requestBody = {
        amount,
        userEmail: userEmail.trim(),
        userName: userName.trim() || undefined,
        captchaToken: captchaToken,
        ...(additionalData.deeplinkId ? {} : additionalData) // Для диплинков не передаем дополнительные данные
      }

      const fullUrl = window.location.origin + endpoint
      console.log('[PaymentWidget] Sending request to:', endpoint)
      console.log('[PaymentWidget] Full URL:', fullUrl)
      console.log('[PaymentWidget] Request body (without captcha token):', {
        ...requestBody,
        captchaToken: requestBody.captchaToken ? 'present' : 'missing'
      })
      console.log('[PaymentWidget] About to send fetch request...')

      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(requestBody)
      })

      console.log('[PaymentWidget] Response received')
      console.log('[PaymentWidget] Response status:', response.status)
      console.log('[PaymentWidget] Response headers:', {
        'content-type': response.headers.get('content-type'),
        'content-length': response.headers.get('content-length')
      })
      
      // Проверяем, что ответ не пустой
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        console.error('[PaymentWidget] ❌ Non-JSON response received')
        console.error('[PaymentWidget] Response text:', text.substring(0, 500))
        throw new Error('Сервер вернул неожиданный ответ: ' + (text.substring(0, 100) || 'пустой ответ'))
      }
      
      let data
      try {
        const text = await response.text()
        console.log('[PaymentWidget] Response text length:', text.length)
        if (!text) {
          console.error('[PaymentWidget] ❌ Пустой ответ от сервера')
          throw new Error('Пустой ответ от сервера')
        }
        data = JSON.parse(text)
        console.log('[PaymentWidget] ✅ Response parsed successfully')
        console.log('[PaymentWidget] Response data:', JSON.stringify(data, null, 2))
      } catch (parseError) {
        console.error('[PaymentWidget] ❌ JSON parse error:', parseError)
        console.error('[PaymentWidget] Parse error stack:', parseError?.stack)
        throw new Error('Ошибка обработки ответа сервера: ' + parseError?.message)
      }

      if (!data.ok) {
        throw new Error(data.error || 'Ошибка создания платежа')
      }

      if (data.payment?.deeplink || data.payment?.id) {
        console.log('\n' + '='.repeat(80))
        console.log('[PaymentWidget] ✅ ПЛАТЕЖ УСПЕШНО СОЗДАН')
        console.log('[PaymentWidget] Payment ID:', data.payment.id)
        console.log('[PaymentWidget] disableRedirect:', disableRedirect)
        console.log('='.repeat(80) + '\n')
        
        if (onPaymentCreated) {
          onPaymentCreated(data.payment)
        }
        
        // Переход на страницу оплаты только если не отключено
        if (!disableRedirect && data.payment?.id) {
          console.log('[PaymentWidget] Redirecting to:', `/pay/${data.payment.id}`)
          navigate(`/pay/${data.payment.id}`)
        } else {
          console.log('[PaymentWidget] Redirect disabled, staying on current page')
        }
      } else {
        throw new Error('Не получена ссылка для оплаты')
      }
    } catch (err) {
      console.error('\n' + '='.repeat(80))
      console.error('[PaymentWidget] ❌ ОШИБКА ПРИ СОЗДАНИИ ПЛАТЕЖА')
      console.error('Payment creation error:', err)
      console.error('='.repeat(80) + '\n')
      setError(err.message || 'Ошибка создания платежа')
    } finally {
      setLoading(false)
    }
  }

  const formatAmount = (amount) => {
    return parseFloat(amount || 0).toFixed(2)
  }

  const getCurrencySymbol = (currency) => {
    const symbols = {
      'RUB': '₽',
      'USD': '$',
      'EUR': '€',
      'UAH': '₴'
    }
    return symbols[currency?.toUpperCase()] || currency || '₽'
  }

  return (
    <div className="payment-widget bg-white rounded-lg shadow-lg p-6 max-w-md mx-auto">
      <div className="payment-widget-header mb-6">
        <h3 className="text-2xl font-bold text-gray-800 mb-2">Оплата</h3>
        {description && (
          <p className="text-gray-600 text-sm">{description}</p>
        )}
      </div>

      <div className="payment-widget-amount mb-6">
        <div className="text-center">
          <div className="text-4xl font-bold text-blue-600 mb-1">
            {formatAmount(amount)} {getCurrencySymbol(currency)}
          </div>
          <div className="text-sm text-gray-500">
            Включая НДС {(parseFloat(amount) * 0.20 / 1.20).toFixed(2)} {getCurrencySymbol(currency)}
          </div>
        </div>
      </div>

      {/* Форма для ввода email и имени */}
      <div className="mb-4 space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email для получения уведомлений <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={userEmail}
            onChange={(e) => setUserEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
            style={{ color: '#111827' }}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Ваше имя (необязательно)
          </label>
          <input
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="Иван Иванов"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
            style={{ color: '#111827' }}
          />
        </div>
        
        {/* Яндекс Капча */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Подтвердите, что вы не робот <span className="text-red-500">*</span>
          </label>
          <div 
            ref={captchaContainerRef} 
            key={captchaContainerKeyRef.current}
            className="flex justify-center min-h-[65px] items-center border-2 border-dashed border-gray-300 rounded-lg p-2 bg-gray-50"
            style={{ minHeight: '65px', width: '100%' }}
            suppressHydrationWarning
            data-captcha-container="true"
          >
            {!captchaLoaded && (
              <div className="text-sm text-gray-500 py-4">
                <span className="inline-block animate-pulse">⏳ Загрузка капчи...</span>
              </div>
            )}
            {captchaLoaded && !captchaToken && !captchaContainerRef.current?.querySelector('.smart-captcha') && (
              <div className="text-xs text-yellow-600 text-center p-2">
                ⚠️ Капча загружена, но не отображается.<br/>
                Проверьте консоль браузера (F12) для диагностики.
              </div>
            )}
          </div>
          {captchaLoaded && !captchaToken && (
            <p className="text-xs text-yellow-600 mt-1 text-center font-medium">
              ⚠️ Пожалуйста, пройдите проверку капчи выше
            </p>
          )}
          {captchaToken && (
            <p className="text-xs text-green-600 mt-1 text-center font-semibold">
              ✅ Капча пройдена успешно
            </p>
          )}
          {error && error.includes('капч') && (
            <p className="text-xs text-red-600 mt-1 text-center font-medium">
              ❌ {error}
            </p>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      <button
        onClick={(e) => {
          console.log('[PaymentWidget] Кнопка "Перейти к оплате" нажата')
          console.log('[PaymentWidget] Button state:', {
            loading,
            amount,
            captchaToken: captchaToken ? 'present' : 'missing',
            userEmail: userEmail || 'missing',
            disabled: loading || !amount || amount <= 0 || !captchaToken || !userEmail
          })
          if (!captchaToken) {
            console.error('[PaymentWidget] ❌ Капча не пройдена!')
            setError('Пожалуйста, пройдите проверку капчи')
            return
          }
          if (!userEmail) {
            console.error('[PaymentWidget] ❌ Email не указан!')
            setError('Пожалуйста, укажите email')
            return
          }
          if (!amount || amount <= 0) {
            console.error('[PaymentWidget] ❌ Сумма не указана!')
            setError('Сумма должна быть больше 0')
            return
          }
          handleCreatePayment()
        }}
        disabled={loading || !amount || amount <= 0 || !captchaToken || !userEmail}
        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
        title={
          !captchaToken ? '❌ Пройдите проверку капчи' : 
          !userEmail ? '❌ Укажите email' : 
          !amount || amount <= 0 ? '❌ Укажите сумму' : 
          '✅ Все готово к оплате'
        }
        onMouseEnter={() => {
          console.log('[PaymentWidget] Hover over button:', {
            loading,
            amount,
            captchaToken: captchaToken ? 'present' : 'missing',
            userEmail: userEmail || 'missing'
          })
          if (!captchaToken) {
            console.warn('[PaymentWidget] ⚠️ Попытка оплаты без капчи!')
          }
        }}
      >
        {loading ? (
          <span className="flex items-center justify-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Создание платежа...
          </span>
        ) : (
          'Перейти к оплате'
        )}
      </button>

      <div className="mt-4 text-xs text-center text-gray-500">
        Безопасная оплата через защищенное соединение
      </div>
    </div>
  )
}


