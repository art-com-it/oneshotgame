import React from 'react'

export default function FAQ() {
  const faqData = [
    {
      question: "Как купить скины на сайте?",
      answer: "Для покупки скинов выберите нужный товар в каталоге, добавьте в корзину и оформите заказ. Оплата производится через Steam Trade или банковские карты. После оплаты скины автоматически поступают в ваш инвентарь Steam."
    },
    {
      question: "Безопасно ли торговать на вашем сайте?",
      answer: "Да, абсолютно безопасно. Мы используем официальный Steam API для всех операций. Все сделки проходят через защищенные серверы Steam. Мы не храним ваши логины и пароли - авторизация происходит напрямую через Steam."
    },
    {
      question: "Какие способы оплаты вы принимаете?",
      answer: "Мы принимаем: банковские карты Visa/MasterCard, электронные кошельки (Qiwi, WebMoney, ЮMoney), криптовалюты (Bitcoin, Ethereum), Steam Wallet, мобильные платежи. Все платежи защищены SSL-шифрованием."
    },
    {
      question: "Сколько времени занимает доставка скинов?",
      answer: "Скины поступают в ваш инвентарь мгновенно после подтверждения оплаты. В редких случаях доставка может занять до 15 минут из-за технических особенностей Steam API."
    },
    {
      question: "Что делать, если скин не пришел?",
      answer: "Если скин не поступил в течение 15 минут, обратитесь в службу поддержки через чат на сайте или напишите на support@aigamestore.com. Мы решим проблему в течение 30 минут или вернем деньги."
    },
    {
      question: "Можно ли вернуть купленный скин?",
      answer: "Возврат возможен в течение 24 часов с момента покупки, если скин не был использован в игре. Для возврата обратитесь в поддержку с указанием номера заказа."
    },
    {
      question: "Как работает система рейтингов скинов?",
      answer: "Мы используем официальную систему качества Steam: Factory New (FN), Minimal Wear (MW), Field-Tested (FT), Well-Worn (WW), Battle-Scarred (BS). Чем выше качество, тем лучше внешний вид скина."
    },
    {
      question: "Есть ли программа лояльности?",
      answer: "Да! За каждую покупку вы получаете бонусные баллы (1% от суммы). Баллы можно тратить на скидки при следующих покупках. VIP-клиенты получают дополнительные привилегии и эксклюзивные предложения."
    },
    {
      question: "Как связаться с поддержкой?",
      answer: "Поддержка работает 24/7. Способы связи: онлайн-чат на сайте, email: support@aigamestore.com, Discord: Game Sale#1234. Среднее время ответа - 5 минут."
    }
  ]

  return (
    <div className="min-h-screen bg-[#0D1A2F] text-white py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
            Часто задаваемые вопросы
          </h1>
          <p className="text-white/70 text-lg">
            Ответы на самые популярные вопросы о покупке игр и скинов
          </p>
        </div>

        <div className="space-y-6">
          {faqData.map((item, index) => (
            <div key={index} className="bg-white/5 border border-white/10 rounded-lg p-6 hover:bg-white/10 transition-colors">
              <h3 className="text-xl font-semibold mb-3 text-blue-200">
                {item.question}
              </h3>
              <p className="text-white/80 leading-relaxed">
                {item.answer}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-3">Не нашли ответ на свой вопрос?</h3>
            <p className="text-white/70 mb-4">
              Наша служба поддержки работает круглосуточно и готова помочь вам с любыми вопросами
            </p>
            <button className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold transition-colors">
              Связаться с поддержкой
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
