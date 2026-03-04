// Информация о компании — oneshotgame.shop
export const getCompanyInfo = () => getOneshotgameInfo()

export const getOneshotgameInfo = () => ({
  fullNameRu: 'ООО "СОЛЮТЕКС"',
  fullNameEn: 'LLC "SOLUTEX"',
  fullNameKg: 'ООО "СОЛЮТЕКС"',
  legalAddress: 'КР, г.Бишкек, Первомайский район, ул.Пр. Чынгыза Айтматова, д.16, кв.68',
  phone: '+996 (998) 233-425',
  email: 'support@oneshotgame.shop',
  registrationNumber: '224226-3301-000',
  okpo: '',
  inn: '01411202310525',
  okved: 'Деятельность по обработке данных, предоставление услуг по размещению информации и связанная с этим деятельность (63.11)',
  bank: {
    name: 'ОАО "Айыл Банк"',
    swift: '',
    bik: '',
    account: '135010 0020 152182',
    accountType: 'мультивалютный',
    currencies: '',
    correspondentAccount: '30111 8103000 000 00050',
    rubleBank: {
      name: 'Межгосударственный банк Москва',
      bik: '044525362',
      note: 'для платежей в рублях'
    }
  }
})
