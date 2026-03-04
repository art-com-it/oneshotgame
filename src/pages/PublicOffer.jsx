import React from 'react'
import { getCompanyInfo } from '../utils/companyInfo'

export default function PublicOffer() {
  const companyInfo = getCompanyInfo()
  
  const currentDate = new Date().toLocaleDateString('ru-RU', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })

  return (
    <div className="min-h-screen bg-[#0C0C0C] text-white py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">Договор публичной оферты</h1>
        
        <div className="bg-[#1a1a1a] border border-[#333333] rounded-lg p-8 space-y-6">
          <div className="text-center mb-8">
            <p className="text-xl font-semibold mb-2">ПУБЛИЧНАЯ ОФЕРТА</p>
            <p className="text-lg">о заключении договора купли-продажи цифрового контента</p>
          </div>

          <div className="space-y-4">
            <p className="text-right text-sm text-gray-400">г. Бишкек</p>
            <p className="text-right text-sm text-gray-400">{currentDate}</p>
          </div>

          <div className="space-y-4">
            <p>
              Настоящий документ является официальной публичной офертой (далее – «Оферта») 
              <strong> {companyInfo.fullNameRu}</strong> (далее – «Продавец»), 
              адресованной неограниченному кругу физических и юридических лиц (далее – «Покупатель»), 
              о заключении договора купли-продажи цифрового контента на условиях, изложенных ниже.
            </p>
            
            <p className="font-semibold text-center">
              В соответствии со статьей 395 Гражданского кодекса Кыргызской Республики, 
              акцепт настоящей Оферты означает полное и безоговорочное принятие Покупателем всех условий 
              настоящего Договора без каких-либо изъятий или ограничений.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold mt-6">1. ОПРЕДЕЛЕНИЯ</h2>
            <p>
              1.1. <strong>Продавец</strong> – {companyInfo.fullNameRu}, осуществляющий продажу 
              цифрового контента через интернет-магазин {window.location.hostname}.
            </p>
            <p>
              1.2. <strong>Покупатель</strong> – физическое или юридическое лицо, принявшее условия 
              настоящей Оферты и осуществившее заказ товара.
            </p>
            <p>
              1.3. <strong>Товар</strong> – цифровой контент (игровые ключи, скины, виртуальные товары), 
              предлагаемый к продаже в интернет-магазине.
            </p>
            <p>
              1.4. <strong>Заказ</strong> – оформленный Покупателем запрос на приобретение Товара.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold mt-6">2. ПРЕДМЕТ ДОГОВОРА</h2>
            <p>
              2.1. Продавец обязуется передать в собственность Покупателя, а Покупатель обязуется 
              принять и оплатить Товар на условиях настоящего Договора.
            </p>
            <p>
              2.2. Настоящий Договор считается заключенным с момента акцепта Оферты Покупателем, 
              который выражается в оформлении Заказа и оплате Товара.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold mt-6">3. ЦЕНА ТОВАРА И ПОРЯДОК РАСЧЕТОВ</h2>
            <p>
              3.1. Цена Товара указывается на сайте интернет-магазина и может быть изменена Продавцом 
              в одностороннем порядке без предварительного уведомления Покупателя.
            </p>
            <p>
              3.2. Оплата Товара осуществляется Покупателем в полном объеме до момента передачи Товара.
            </p>
            <p>
              3.3. Прием платежей осуществляется через платежные системы, указанные на сайте.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold mt-6">4. ПЕРЕДАЧА ТОВАРА</h2>
            <p>
              4.1. Товар передается Покупателю в электронном виде в течение 24 часов с момента 
              подтверждения оплаты.
            </p>
            <p>
              4.2. Способ передачи Товара указывается при оформлении Заказа (ключ активации, 
              отправка в Steam инвентарь и т.д.).
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold mt-6">5. ПРАВА И ОБЯЗАННОСТИ СТОРОН</h2>
            <p>
              5.1. Продавец обязуется передать Покупателю Товар надлежащего качества в установленные сроки.
            </p>
            <p>
              5.2. Покупатель обязуется оплатить Товар в полном объеме и в установленные сроки.
            </p>
            <p>
              5.3. Покупатель имеет право на возврат денежных средств в случае неполучения Товара 
              в установленные сроки.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold mt-6">6. ОТВЕТСТВЕННОСТЬ СТОРОН</h2>
            <p>
              6.1. Продавец не несет ответственности за невозможность использования Товара, 
              связанную с отсутствием у Покупателя необходимых технических условий.
            </p>
            <p>
              6.2. Покупатель несет полную ответственность за достоверность указанных при оформлении 
              Заказа данных.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold mt-6">7. РЕКВИЗИТЫ ПРОДАВЦА</h2>
            <div className="bg-[#0C0C0C] p-4 rounded border border-[#333333] mt-4">
              <p className="font-semibold mb-2">{companyInfo.fullNameRu}</p>
              <p className="text-sm text-gray-400">Адрес: {companyInfo.legalAddress}</p>
              <p className="text-sm text-gray-400">ИНН: {companyInfo.inn}</p>
              <p className="text-sm text-gray-400">Регистрационный номер: {companyInfo.registrationNumber}</p>
              <p className="text-sm text-gray-400">Email: {companyInfo.email}</p>
              <p className="text-sm text-gray-400">Телефон: {companyInfo.phone}</p>
              {companyInfo.bank && (
                <>
                  <p className="text-sm text-gray-400 mt-2">Банк: {companyInfo.bank.name}</p>
                  <p className="text-sm text-gray-400">р/сч {companyInfo.bank.account}</p>
                  {companyInfo.bank.correspondentAccount && companyInfo.bank.rubleBank && (
                    <>
                      <p className="text-sm text-gray-400">к/с {companyInfo.bank.correspondentAccount} {companyInfo.bank.rubleBank.name}, БИК {companyInfo.bank.rubleBank.bik}, ИНН {companyInfo.bank.rubleBank.inn} ({companyInfo.bank.rubleBank.note})</p>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-[#333333]">
            <p className="text-sm text-gray-400">
              Оформляя Заказ и оплачивая Товар, Покупатель подтверждает, что ознакомился 
              и согласен со всеми условиями настоящей Оферты.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

