import React from 'react'
import { getCompanyInfo } from '../utils/companyInfo'

export default function Privacy() {
  const company = getCompanyInfo()
  return (
    <div className="min-h-screen bg-[#0D1A2F] text-white py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
            Политика конфиденциальности
          </h1>
          <p className="text-white/70 text-lg">
            Последнее обновление: 15 декабря 2024 года
          </p>
        </div>

        <div className="prose prose-invert max-w-none">
          <div className="bg-white/5 border border-white/10 rounded-lg p-8 mb-8">
            <h2 className="text-2xl font-bold mb-4 text-blue-200">1. Общие положения</h2>
            <p className="text-white/80 leading-relaxed mb-4">
              Game Sale ("мы", "наш", "компания") серьезно относится к защите вашей конфиденциальности. 
              Данная Политика конфиденциальности описывает, как мы собираем, используем, храним и защищаем 
              вашу персональную информацию при использовании нашего веб-сайта и услуг.
            </p>
            <p className="text-white/80 leading-relaxed">
              Используя наш сайт, вы соглашаетесь с условиями данной Политики конфиденциальности. 
              Если вы не согласны с какими-либо условиями, пожалуйста, не используйте наш сайт.
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-lg p-8 mb-8">
            <h2 className="text-2xl font-bold mb-4 text-blue-200">2. Какую информацию мы собираем</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2 text-white">Персональная информация:</h3>
                <ul className="list-disc list-inside text-white/80 space-y-1">
                  <li>Имя и фамилия</li>
                  <li>Адрес электронной почты</li>
                  <li>Steam ID и профиль Steam</li>
                  <li>Платежная информация (обрабатывается через защищенные платежные системы)</li>
                  <li>История покупок</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2 text-white">Техническая информация:</h3>
                <ul className="list-disc list-inside text-white/80 space-y-1">
                  <li>IP-адрес и местоположение</li>
                  <li>Тип браузера и операционной системы</li>
                  <li>Данные о посещениях и активности на сайте</li>
                  <li>Cookies и аналогичные технологии</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-lg p-8 mb-8">
            <h2 className="text-2xl font-bold mb-4 text-blue-200">3. Как мы используем вашу информацию</h2>
            <ul className="list-disc list-inside text-white/80 space-y-2">
              <li>Обработка заказов и проведение транзакций</li>
              <li>Предоставление клиентской поддержки</li>
              <li>Отправка уведомлений о заказах и важных обновлениях</li>
              <li>Улучшение качества наших услуг</li>
              <li>Предотвращение мошенничества и обеспечение безопасности</li>
              <li>Соблюдение правовых требований</li>
              <li>Маркетинговые коммуникации (только с вашего согласия)</li>
            </ul>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-lg p-8 mb-8">
            <h2 className="text-2xl font-bold mb-4 text-blue-200">4. Защита данных</h2>
            <p className="text-white/80 leading-relaxed mb-4">
              Мы применяем современные технические и организационные меры для защиты ваших данных:
            </p>
            <ul className="list-disc list-inside text-white/80 space-y-2">
              <li>SSL-шифрование для всех передач данных</li>
              <li>Регулярные аудиты безопасности</li>
              <li>Ограниченный доступ к персональным данным</li>
              <li>Регулярное резервное копирование</li>
              <li>Соответствие стандартам PCI DSS для платежных данных</li>
            </ul>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-lg p-8 mb-8">
            <h2 className="text-2xl font-bold mb-4 text-blue-200">5. Передача данных третьим лицам</h2>
            <p className="text-white/80 leading-relaxed mb-4">
              Мы не продаем и не передаем ваши персональные данные третьим лицам, за исключением:
            </p>
            <ul className="list-disc list-inside text-white/80 space-y-2">
              <li>Платежных систем для обработки транзакций</li>
              <li>Steam API для проведения торговых операций</li>
              <li>Сервисов аналитики (в анонимизированном виде)</li>
              <li>Случаев, требуемых законом</li>
            </ul>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-lg p-8 mb-8">
            <h2 className="text-2xl font-bold mb-4 text-blue-200">6. Ваши права</h2>
            <p className="text-white/80 leading-relaxed mb-4">
              В соответствии с применимым законодательством, вы имеете право:
            </p>
            <ul className="list-disc list-inside text-white/80 space-y-2">
              <li>Получать информацию о обработке ваших данных</li>
              <li>Исправлять неточные данные</li>
              <li>Удалять ваши данные (право на забвение)</li>
              <li>Ограничивать обработку данных</li>
              <li>Переносить данные к другому провайдеру</li>
              <li>Отозвать согласие на обработку</li>
            </ul>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-lg p-8 mb-8">
            <h2 className="text-2xl font-bold mb-4 text-blue-200">7. Cookies</h2>
            <p className="text-white/80 leading-relaxed mb-4">
              Мы используем cookies для улучшения работы сайта. Типы cookies:
            </p>
            <ul className="list-disc list-inside text-white/80 space-y-2">
              <li><strong>Необходимые:</strong> для базовой функциональности сайта</li>
              <li><strong>Функциональные:</strong> для запоминания ваших предпочтений</li>
              <li><strong>Аналитические:</strong> для анализа использования сайта</li>
              <li><strong>Маркетинговые:</strong> для персонализированной рекламы</li>
            </ul>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-lg p-8 mb-8">
            <h2 className="text-2xl font-bold mb-4 text-blue-200">8. Хранение данных</h2>
            <p className="text-white/80 leading-relaxed">
              Мы храним ваши данные только в течение необходимого периода:
            </p>
            <ul className="list-disc list-inside text-white/80 space-y-2 mt-4">
              <li>Данные аккаунта: до удаления аккаунта</li>
              <li>История транзакций: 7 лет (требование законодательства)</li>
              <li>Логи доступа: 12 месяцев</li>
              <li>Маркетинговые данные: до отзыва согласия</li>
            </ul>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-lg p-8">
            <h2 className="text-2xl font-bold mb-4 text-blue-200">9. Контактная информация</h2>
            <p className="text-white/80 leading-relaxed mb-4">
              По вопросам конфиденциальности обращайтесь:
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
