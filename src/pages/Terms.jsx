import React from 'react'
import { getCompanyInfo } from '../utils/companyInfo'

export default function Terms() {
  const company = getCompanyInfo()
  return (
    <div className="min-h-screen bg-[#0D1A2F] text-white py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
            Пользовательское соглашение
          </h1>
          <p className="text-white/70 text-lg">
            Последнее обновление: 15 декабря 2024 года
          </p>
        </div>

        <div className="prose prose-invert max-w-none">
          <div className="bg-white/5 border border-white/10 rounded-lg p-8 mb-8">
            <h2 className="text-2xl font-bold mb-4 text-blue-200">1. Принятие условий</h2>
            <p className="text-white/80 leading-relaxed">
              Добро пожаловать в Game Sale! Используя наш веб-сайт и услуги, вы соглашаетесь 
              соблюдать и быть связанными настоящими Условиями использования. Если вы не согласны 
              с какими-либо из этих условий, пожалуйста, не используйте наш сервис.
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-lg p-8 mb-8">
            <h2 className="text-2xl font-bold mb-4 text-blue-200">2. Описание услуг</h2>
            <p className="text-white/80 leading-relaxed mb-4">
              Game Sale предоставляет платформу для покупки игр, внутриигровых предметов, 
              скинов и другого цифрового контента для различных игр, включая:
            </p>
            <ul className="list-disc list-inside text-white/80 space-y-2">
              <li>Counter-Strike 2 (CS2)</li>
              <li>Dota 2</li>
              <li>Team Fortress 2</li>
              <li>Rust</li>
              <li>И другие поддерживаемые игры</li>
            </ul>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-lg p-8 mb-8">
            <h2 className="text-2xl font-bold mb-4 text-blue-200">3. Регистрация аккаунта</h2>
            <div className="space-y-4">
              <p className="text-white/80 leading-relaxed">
                Для использования наших услуг вы должны:
              </p>
              <ul className="list-disc list-inside text-white/80 space-y-2">
                <li>Быть не младше 18 лет или иметь согласие родителей/опекунов</li>
                <li>Предоставить точную и актуальную информацию</li>
                <li>Иметь действующий аккаунт Steam</li>
                <li>Поддерживать безопасность своего аккаунта</li>
                <li>Не передавать доступ к аккаунту третьим лицам</li>
              </ul>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-lg p-8 mb-8">
            <h2 className="text-2xl font-bold mb-4 text-blue-200">4. Правила торговли</h2>
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Покупка предметов:</h3>
              <ul className="list-disc list-inside text-white/80 space-y-2">
                <li>Все цены указаны в российских рублях</li>
                <li>Оплата производится до получения предмета</li>
                <li>Предметы доставляются через Steam Trade</li>
                <li>Время доставки: мгновенно до 15 минут</li>
              </ul>
              
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-lg p-8 mb-8">
            <h2 className="text-2xl font-bold mb-4 text-blue-200">5. Платежи и возвраты</h2>
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Способы оплаты:</h3>
              <ul className="list-disc list-inside text-white/80 space-y-2">
                <li>Банковские карты Visa/MasterCard</li>
                <li>Электронные кошельки (Qiwi, WebMoney, ЮMoney)</li>
                <li>Криптовалюты (Bitcoin, Ethereum)</li>
                <li>Steam Wallet</li>
              </ul>
              
              <h3 className="text-lg font-semibold text-white mt-6">Политика возвратов:</h3>
              <ul className="list-disc list-inside text-white/80 space-y-2">
                <li>Возврат возможен в течение 24 часов после покупки</li>
                <li>Предмет не должен быть использован в игре</li>
                <li>Возврат производится на тот же способ оплаты</li>
                <li>Комиссии платежных систем не возвращаются</li>
              </ul>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-lg p-8 mb-8">
            <h2 className="text-2xl font-bold mb-4 text-blue-200">6. Запрещенные действия</h2>
            <p className="text-white/80 leading-relaxed mb-4">
              При использовании нашего сервиса запрещается:
            </p>
            <ul className="list-disc list-inside text-white/80 space-y-2">
              <li>Мошенничество и обман других пользователей</li>
              <li>Использование ботов или автоматизированных систем</li>
              <li>Создание множественных аккаунтов</li>
              <li>Попытки взлома или нарушения безопасности</li>
              <li>Торговля украденными предметами</li>
              <li>Нарушение авторских прав</li>
              <li>Спам и нежелательная реклама</li>
              <li>Оскорбления и угрозы другим пользователям</li>
            </ul>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-lg p-8 mb-8">
            <h2 className="text-2xl font-bold mb-4 text-blue-200">7. Ответственность</h2>
            <div className="space-y-4">
              <p className="text-white/80 leading-relaxed">
                Game Sale не несет ответственности за:
              </p>
              <ul className="list-disc list-inside text-white/80 space-y-2">
                <li>Изменения в играх, влияющие на стоимость предметов</li>
                <li>Технические проблемы Steam или других внешних сервисов</li>
                <li>Потери, связанные с колебаниями рыночных цен</li>
                <li>Действия третьих лиц</li>
                <li>Форс-мажорные обстоятельства</li>
              </ul>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-lg p-8 mb-8">
            <h2 className="text-2xl font-bold mb-4 text-blue-200">8. Интеллектуальная собственность</h2>
            <p className="text-white/80 leading-relaxed">
              Все материалы на сайте, включая дизайн, логотипы, тексты и программное обеспечение, 
              являются собственностью Game Sale или используются с разрешения правообладателей. 
              Запрещается копирование, распространение или использование материалов без письменного согласия.
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-lg p-8 mb-8">
            <h2 className="text-2xl font-bold mb-4 text-blue-200">9. Изменения условий</h2>
            <p className="text-white/80 leading-relaxed">
              Мы оставляем за собой право изменять данные условия в любое время. Существенные изменения 
              будут уведомлены пользователям по электронной почте или через уведомления на сайте. 
              Продолжение использования сервиса после изменений означает принятие новых условий.
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-lg p-8 mb-8">
            <h2 className="text-2xl font-bold mb-4 text-blue-200">10. Прекращение обслуживания</h2>
            <p className="text-white/80 leading-relaxed">
              Мы можем приостановить или прекратить предоставление услуг любому пользователю 
              в случае нарушения данных условий. При прекращении обслуживания все неиспользованные 
              средства на балансе будут возвращены в течение 30 дней.
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-lg p-8">
            <h2 className="text-2xl font-bold mb-4 text-blue-200">11. Контактная информация</h2>
            <p className="text-white/80 leading-relaxed mb-4">
              По вопросам, связанным с данными условиями, обращайтесь:
            </p>
            <div className="text-white/80 space-y-2">
              <p><strong>Полное наименование:</strong> {company.fullNameRu}</p>
              {company.fullNameEn && <p><strong>Full name:</strong> {company.fullNameEn}</p>}
              {company.fullNameKg && <p><strong>Толук аталышы:</strong> {company.fullNameKg}</p>}
              <p><strong>Юридический адрес:</strong> {company.legalAddress}</p>
              <p><strong>Телефон:</strong> {company.phone}</p>
              <p><strong>Email:</strong> {company.email}</p>
              <p><strong>Регистрационный номер:</strong> {company.registrationNumber}</p>
              {company.okpo && <p><strong>ОКПО:</strong> {company.okpo}</p>}
              <p><strong>ИНН:</strong> {company.inn}</p>
              <p><strong>ОКВЭД:</strong> {company.okved}</p>
              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="font-semibold mb-2">Банковские реквизиты:</p>
                <p><strong>Банк:</strong> {company.bank.name}</p>
                {company.bank.swift && <p><strong>SWIFT:</strong> {company.bank.swift}</p>}
                {company.bank.bik && <p><strong>БИК:</strong> {company.bank.bik}</p>}
                <p><strong>р/сч:</strong> {company.bank.account} ({company.bank.accountType})</p>
                {company.bank.currencies && <p><strong>Валюты:</strong> {company.bank.currencies}</p>}
                {company.bank.correspondentAccount && <p><strong>к/с:</strong> {company.bank.correspondentAccount}</p>}
                {company.bank.rubleBank && (
                  <div className="mt-2">
                    <p><strong>Банк (для платежей в рублях):</strong> {company.bank.rubleBank.name}, БИК {company.bank.rubleBank.bik}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
