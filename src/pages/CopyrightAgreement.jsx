import React from 'react'
import { getCompanyInfo } from '../utils/companyInfo'

export default function CopyrightAgreement() {
  const companyInfo = getCompanyInfo()
  
  // Данные правообладателя (Турецкая компания)
  const copyrightHolder = {
    name: 'Частное общество с ограниченной ответственностью',
    registrationCode: '17275617',
    address: 'Харьюмаа, Таллинн, район Кесклинн, Ластекоду, 18-45, 10113',
    addressTurkey: 'Турция', // Турецкий правообладатель
    email: 'suleyman@kopazar.com',
    phone: '+90 05058210176',
    country: 'Турция'
  }

  const currentDate = new Date().toLocaleDateString('ru-RU', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })

  return (
    <div className="min-h-screen bg-[#0C0C0C] text-white py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">Договор с правообладателем</h1>
        
        <div className="bg-[#1a1a1a] border border-[#333333] rounded-lg p-8 space-y-6">
          <div className="text-center mb-8">
            <p className="text-xl font-semibold mb-2">ДОГОВОР</p>
            <p className="text-lg">о предоставлении прав на использование цифрового контента</p>
          </div>

          <div className="space-y-4">
            <p className="text-right text-sm text-gray-400">г. Бишкек</p>
            <p className="text-right text-sm text-gray-400">{currentDate}</p>
          </div>

          <div className="space-y-4">
            <p>
              <strong>{companyInfo.fullNameRu}</strong>, именуемое в дальнейшем «<strong>Исполнитель</strong>», 
              в лице уполномоченного представителя, действующего на основании устава, с одной стороны, и
            </p>
            
            <p>
              <strong>{copyrightHolder.name}</strong> (Регистрационный код: {copyrightHolder.registrationCode}, {copyrightHolder.country}), 
              именуемое в дальнейшем «<strong>Правообладатель</strong>», 
              в лице уполномоченного представителя, действующего на основании устава, с другой стороны,
            </p>
            
            <p className="text-center font-semibold">вместе именуемые «Стороны», заключили настоящий Договор о нижеследующем:</p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold mt-6">1. ПРЕДМЕТ ДОГОВОРА</h2>
            <p>
              1.1. Правообладатель предоставляет Исполнителю неисключительное право на использование 
              цифрового контента (игровых ключей, скинов, виртуальных товаров) в рамках деятельности 
              интернет-магазина {window.location.hostname} на территории всего мира.
            </p>
            <p>
              1.2. Исполнитель обязуется использовать предоставленный контент исключительно в целях 
              розничной продажи конечным потребителям через интернет-магазин.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold mt-6">2. ПРАВА И ОБЯЗАННОСТИ СТОРОН</h2>
            <p>
              2.1. Правообладатель гарантирует наличие у него всех необходимых прав на предоставляемый контент.
            </p>
            <p>
              2.2. Исполнитель обязуется соблюдать все условия использования контента, установленные Правообладателем.
            </p>
            <p>
              2.3. Исполнитель не вправе передавать полученные права третьим лицам без письменного согласия Правообладателя.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold mt-6">3. СРОК ДЕЙСТВИЯ ДОГОВОРА</h2>
            <p>
              3.1. Настоящий договор вступает в силу с момента подписания и действует до полного выполнения 
              сторонами своих обязательств.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold mt-6">4. РЕКВИЗИТЫ СТОРОН</h2>
            
            <div className="grid md:grid-cols-2 gap-6 mt-4">
              <div className="bg-[#0C0C0C] p-4 rounded border border-[#333333]">
                <p className="font-semibold mb-2">ИСПОЛНИТЕЛЬ:</p>
                <p>{companyInfo.fullNameRu}</p>
                <p className="text-sm text-gray-400 mt-2">Адрес: {companyInfo.legalAddress}</p>
                <p className="text-sm text-gray-400">ИНН: {companyInfo.inn}</p>
                <p className="text-sm text-gray-400">Рег. номер: {companyInfo.registrationNumber}</p>
                <p className="text-sm text-gray-400">Email: {companyInfo.email}</p>
                <p className="text-sm text-gray-400">Телефон: {companyInfo.phone}</p>
              </div>
              
              <div className="bg-[#0C0C0C] p-4 rounded border border-[#333333]">
                <p className="font-semibold mb-2">ПРАВООБЛАДАТЕЛЬ ({copyrightHolder.country}):</p>
                <p>{copyrightHolder.name}</p>
                <p className="text-sm text-gray-400 mt-2">Рег. код: {copyrightHolder.registrationCode}</p>
                <p className="text-sm text-gray-400">Адрес: {copyrightHolder.address}</p>
                <p className="text-sm text-gray-400">Страна: {copyrightHolder.country}</p>
                <p className="text-sm text-gray-400">Email: {copyrightHolder.email}</p>
                <p className="text-sm text-gray-400">Телефон: {copyrightHolder.phone}</p>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-[#333333]">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <p className="font-semibold mb-4">Исполнитель:</p>
                <p className="text-sm text-gray-400">{companyInfo.fullNameRu}</p>
                <p className="text-sm text-gray-400 mt-4">_________________</p>
                <p className="text-xs text-gray-500 mt-1">Подпись</p>
              </div>
              <div>
                <p className="font-semibold mb-4">Правообладатель:</p>
                <p className="text-sm text-gray-400">{copyrightHolder.name}</p>
                <p className="text-sm text-gray-400 mt-4">_________________</p>
                <p className="text-xs text-gray-500 mt-1">Подпись</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

