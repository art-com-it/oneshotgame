import React, { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'

export default function PaymentChat({ paymentId, payment }) {
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [socket, setSocket] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [userData, setUserData] = useState({
    name: payment?.userName || '',
    email: payment?.userEmail || ''
  })
  const [showUserForm, setShowUserForm] = useState(false)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef(null)
  const chatContainerRef = useRef(null)

  // Загружаем сохраненные данные пользователя из localStorage
  useEffect(() => {
    const savedSessionId = localStorage.getItem(`payment_chat_session_${paymentId}`)
    const savedUserData = localStorage.getItem(`payment_chat_user_${paymentId}`)
    
    if (savedSessionId) {
      setSessionId(savedSessionId)
    }
    
    // Проверяем сохраненные данные пользователя
    if (savedUserData) {
      try {
        const parsed = JSON.parse(savedUserData)
        // Если есть и имя, и email - не показываем форму
        if (parsed.name && parsed.email) {
          setUserData(parsed)
          setShowUserForm(false)
        } else {
          // Если частично заполнено - показываем форму, но предзаполняем
          setUserData(prev => ({
            name: prev.name || parsed.name || '',
            email: prev.email || parsed.email || ''
          }))
          setShowUserForm(true)
        }
      } catch (e) {
        console.error('Failed to parse saved user data:', e)
        // Используем данные из payment, если есть
        if (payment?.userName && payment?.userEmail) {
          setUserData({
            name: payment.userName,
            email: payment.userEmail
          })
          setShowUserForm(false)
        } else {
          setShowUserForm(true)
        }
      }
    } else {
      // Если данных нет - показываем форму только если нет данных в payment
      if (payment?.userName && payment?.userEmail) {
        setUserData({
          name: payment.userName,
          email: payment.userEmail
        })
        setShowUserForm(false)
        
        // Сохраняем в localStorage
        localStorage.setItem(`payment_chat_user_${paymentId}`, JSON.stringify({
          name: payment.userName,
          email: payment.userEmail
        }))
      } else {
        setShowUserForm(true)
      }
    }
  }, [paymentId, payment])

  // Инициализация socket
  useEffect(() => {
    const newSocket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    })

    newSocket.on('connect', () => {
      console.log('Chat socket connected')
      
      // Присоединяемся к существующей сессии или создаем новую
      if (sessionId) {
        newSocket.emit('chat:join', { sessionId }, (response) => {
          if (response.ok && response.session) {
            loadMessagesFromSession(response.session)
          }
        })
      } else {
        createChatSession()
      }
    })

    newSocket.on('chat:session', (session) => {
      if (session && session.id) {
        setSessionId(session.id)
        // Сохраняем sessionId в localStorage
        localStorage.setItem(`payment_chat_session_${paymentId}`, session.id)
        loadMessagesFromSession(session)
      }
    })

    newSocket.on('chat:message', (message) => {
      setMessages(prev => [...prev, message])
      scrollToBottom()
    })

    newSocket.on('chat:session-updated', (session) => {
      if (session && session.id === sessionId) {
        loadMessagesFromSession(session)
      }
    })

    newSocket.on('disconnect', () => {
      console.log('Chat socket disconnected')
    })

    setSocket(newSocket)

    return () => {
      newSocket.close()
    }
  }, [sessionId])

  const createChatSession = async () => {
    try {
      const response = await fetch('/product-messages', {
        method: 'GET',
        credentials: 'include'
      })
      const data = await response.json()
      
      // Создаем новую сессию через API (если есть endpoint)
      // Пока используем существующий механизм через socket
    } catch (error) {
      console.error('Failed to create chat session:', error)
    }
  }

  const loadMessagesFromSession = (session) => {
    if (session && session.messages && Array.isArray(session.messages)) {
      setMessages(session.messages)
      
      // Загружаем сохраненные данные пользователя из сессии
      if (session.user) {
        const savedUser = {
          name: session.user.name || userData.name,
          email: session.user.email || userData.email
        }
        
        if (savedUser.name || savedUser.email) {
          setUserData(savedUser)
          setShowUserForm(false)
          
          // Сохраняем в localStorage
          localStorage.setItem(`payment_chat_user_${paymentId}`, JSON.stringify(savedUser))
        }
      }
      
      scrollToBottom()
    }
  }

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmitUserForm = async (e) => {
    e.preventDefault()
    
    if (!userData.name || !userData.email) {
      alert('Пожалуйста, заполните все поля')
      return
    }

    // Сохраняем данные пользователя
    localStorage.setItem(`payment_chat_user_${paymentId}`, JSON.stringify(userData))
    
    // Если есть сессия, обновляем данные пользователя
    if (sessionId && socket) {
      socket.emit('chat:update-user', {
        sessionId,
        user: userData
      })
    }
    
    setShowUserForm(false)
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    
    if (!newMessage.trim()) return
    
    if (!userData.name || !userData.email) {
      setShowUserForm(true)
      return
    }

    if (!sessionId || !socket) {
      alert('Чат не подключен. Пожалуйста, обновите страницу.')
      return
    }

    try {
      setSending(true)
      
      socket.emit('chat:message', {
        sessionId,
        authorRole: 'user',
        authorName: userData.name,
        body: newMessage.trim(),
        meta: {
          paymentId,
          email: userData.email
        }
      }, (response) => {
        if (response.ok) {
          setNewMessage('')
        } else {
          alert('Ошибка отправки сообщения: ' + (response.error || 'Неизвестная ошибка'))
        }
      })
    } catch (error) {
      console.error('Send message error:', error)
      alert('Ошибка отправки сообщения')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col h-full" style={{ minHeight: '500px' }}>
      {/* Заголовок чата */}
      <div className="bg-blue-600 text-white p-4 rounded-t-lg">
        <h3 className="text-lg font-semibold">Поддержка</h3>
        <p className="text-sm text-blue-100">Обратитесь к нам, если у вас есть вопросы</p>
      </div>

      {/* Форма ввода данных пользователя (показывается один раз) */}
      {showUserForm && (
        <div className="p-4 bg-yellow-50 border-b border-yellow-200">
          <form onSubmit={handleSubmitUserForm} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ваше имя</label>
              <input
                type="text"
                value={userData.name}
                onChange={(e) => setUserData({ ...userData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                placeholder="Введите ваше имя"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={userData.email}
                onChange={(e) => setUserData({ ...userData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                placeholder="your@email.com"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Продолжить
            </button>
          </form>
        </div>
      )}

      {/* Сообщения */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50"
        style={{ maxHeight: '500px' }}
      >
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>Начните общение с поддержкой</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.authorRole === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  message.authorRole === 'user'
                    ? 'bg-blue-600 text-white'
                    : message.authorRole === 'admin'
                    ? 'bg-white text-gray-800 border border-gray-200'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                {message.authorRole !== 'user' && (
                  <div className="text-xs font-semibold mb-1 text-blue-600">
                    {message.authorName || 'Поддержка'}
                  </div>
                )}
                <div className="text-sm whitespace-pre-wrap">{message.body}</div>
                <div className={`text-xs mt-1 ${message.authorRole === 'user' ? 'text-blue-100' : 'text-gray-500'}`}>
                  {new Date(message.createdAt).toLocaleTimeString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Форма отправки сообщения */}
      {!showUserForm && (
        <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 bg-white rounded-b-lg">
          <div className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Введите сообщение..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={sending || !sessionId}
            />
            <button
              type="submit"
              disabled={sending || !newMessage.trim() || !sessionId}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {sending ? '...' : 'Отправить'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

