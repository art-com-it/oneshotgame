import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Link, NavLink, useNavigate, useParams, useLocation } from 'react-router-dom'
import { io as socketIOClient } from 'socket.io-client'
import './style.css'
import PaymentPage from './pages/PaymentPage'
import PaymentWidget from './components/PaymentWidget'
import Admin from './pages/Admin'
import TestPayment from './pages/TestPayment'
import SteamTopUp from './pages/SteamTopUp'
import DeeplinkPage from './pages/DeeplinkPage'
import { getCompanyInfo } from './utils/companyInfo'
// PaymentWidget уже импортирован выше

// Логирование домена при загрузке приложения
if (typeof window !== 'undefined') {
  const hostname = window.location.hostname.toLowerCase()
  console.log('[App] Starting on domain:', hostname)
  console.log('[App] Full URL:', window.location.href)
  const company = getCompanyInfo()
  console.log('[App] Company info:', company.email, company.fullNameRu)
}

const PLACEHOLDER_IMAGE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="grad" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#1a2540"/>
          <stop offset="100%" stop-color="#0d182c"/>
        </linearGradient>
      </defs>
      <rect width="600" height="400" fill="url(#grad)"/>
      <text x="50%" y="50%" font-family="Segoe UI, Arial, sans-serif" font-size="36" fill="#31436e" text-anchor="middle">
        Image loading
      </text>
    </svg>`
  )

const sanitizeKey = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')

const normalizeProductKey = (product) => {
  if (!product) return ''
  if (product.steamAppId) return `steam:${product.steamAppId}`
  const base = String(product.name || product.id || '').trim().toLowerCase()
  return base.replace(/[^a-z0-9]+/g, '')
}

const hashString = (value = '') => {
  let hash = 0
  const str = String(value)
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return hash
}

const BLOCKED_PRODUCT_KEYS = new Set([
  'rvthereyet',
  'rvthereyet1762859157944',
  'arcraidersupgradetodeluxeedition',
  'fallout4creationsbundle1762829333208',
  'fallout4creationsbundle',
  'steamdeckvalvecertifiedrefurbished',
  'steam:3868650',
  'steam:3948510',
  'steam:2550670'
])

const shouldHideProduct = (product) => {
  if (!product) return true
  const key = normalizeProductKey(product)
  if (!key) return false
  return BLOCKED_PRODUCT_KEYS.has(key)
}

const hasLocalImageSource = (product) => {
  if (!product) return false
  const localGameImages = getLocalGameImages(product)
  if (Array.isArray(localGameImages) && localGameImages.length) return true
  const check = (src) => typeof src === 'string' && src.startsWith('/')
  if (check(product?.image) || check(product?.introImage)) return true
  if (Array.isArray(product?.images)) {
    return product.images.some(check)
  }
  return false
}

const normalizePrice = (price) => {
  // Конвертируем строку в число если нужно
  let numPrice = price
  if (typeof price === 'string') {
    numPrice = parseFloat(price) || 0
  }
  if (typeof numPrice !== 'number' || isNaN(numPrice) || numPrice <= 0) {
    // Если цена невалидна, возвращаем исходное значение
    return price
  }
  
  // Если цена меньше 100, вероятно это USD цена со Steam - конвертируем в рубли
  // Курс USD к RUB примерно 90-100
  const USD_TO_RUB_RATE = 95
  if (numPrice < 100 && numPrice > 0) {
    numPrice = numPrice * USD_TO_RUB_RATE
  }
  
  // Убеждаемся, что цена минимум 1000 рублей
  if (numPrice < 1000) {
    return 1000
  }
  
  // Округляем до целого числа (рубли)
  return Math.round(numPrice)
}

const prepareProducts = (items = []) => {
  const filtered = items.filter((item) => item && !shouldHideProduct(item))
  // Нормализуем цены - убеждаемся что они минимум 1000
  const normalized = filtered.map((item) => {
    if (item && (item.price !== undefined && item.price !== null)) {
      const normalizedPrice = normalizePrice(item.price)
      return { ...item, price: normalizedPrice }
    }
    return item
  })
  return dedupeProductsByKey(normalized)
}

function ScrollToTop() {
  const location = useLocation()
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    window.scrollTo({ top: 0, behavior: 'auto' })
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
  }, [location.pathname, location.search, location.hash])
  return null
}

const STEAM_CDN_HOSTS = [
  'shared.akamai.steamstatic.com',
  'cdn.cloudflare.steamstatic.com',
  'steamcdn-a.akamaihd.net'
]

const normalizeImageSrc = (src) => {
  if (!src) return ''
  const trimmed = String(src).trim()
  if (!trimmed) return ''
  // Локальные пути (начинающиеся с /) возвращаем как есть
  if (trimmed.startsWith('/')) {
    return trimmed
  }
  // Если не HTTP/HTTPS, возвращаем как есть (локальный путь без /)
  if (!/^https?:\/\//i.test(trimmed)) {
    // Если это не полный URL, добавляем / в начало если нужно
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  }
  // Обрабатываем внешние URL (Steam CDN)
  try {
    const url = new URL(trimmed)
    const host = url.hostname.toLowerCase()
    const isSteamHost = STEAM_CDN_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))
    if (isSteamHost) {
      const relativePath = url.pathname.replace(/^\/+/, '')
      return `/images/steam-games/${relativePath}`
    }
  } catch {
    // ignore parsing issues
  }
  return trimmed
}

const closeSteamPopupIfNeeded = () => {
  if (typeof window === 'undefined') return false
  if (window.opener && window.opener !== window && window.name === 'steam-login') {
    try {
      window.opener.postMessage({ type: 'steam-auth-success' }, window.location.origin)
      if (typeof window.opener.focus === 'function') {
        window.opener.focus()
      }
    } catch {
      // ignore cross-window issues
    }
    window.close()
    return true
  }
  return false
}

const getStableDiscountPercent = (product, min = 10, max = 45) => {
  const key = normalizeProductKey(product)
  if (!key) return min
  const clampedMin = Math.max(0, Math.min(min, max))
  const clampedMax = Math.max(clampedMin, max)
  const span = clampedMax - clampedMin + 1
  if (span <= 0) return clampedMin
  const hash = Math.abs(hashString(`${key}|discount`))
  return clampedMin + (hash % span)
}

// Функция для округления цены до формата Steam (например, 499, 999, 1999, 2999)
const roundToSteamPrice = (price) => {
  if (!price || price <= 0) return price
  
  // Steam-подобные цены в рублях: 499, 599, 699, 799, 899, 999, 1199, 1299, 1499, 1599, 1999, 2499, 2999, 3499, 3999, 4499, 4999
  const steamPrices = [
    99, 199, 299, 399, 499, 599, 699, 799, 899, 999,
    1199, 1299, 1399, 1499, 1599, 1799, 1999,
    2499, 2999, 3499, 3999, 4499, 4999,
    5999, 6999, 7999, 8999, 9999,
    11999, 12999, 14999, 15999, 19999,
    24999, 29999, 34999, 39999, 49999
  ]
  
  // Если цена меньше минимальной, возвращаем минимальную
  if (price < steamPrices[0]) {
    return steamPrices[0]
  }
  
  // Если цена больше максимальной, округляем до ближайшего кратного 1000 минус 1
  if (price > steamPrices[steamPrices.length - 1]) {
    const rounded = Math.round(price / 1000) * 1000
    return rounded - 1
  }
  
  // Находим ближайшую Steam-подобную цену
  let closest = steamPrices[0]
  let minDiff = Math.abs(price - closest)
  
  for (const steamPrice of steamPrices) {
    const diff = Math.abs(price - steamPrice)
    if (diff < minDiff) {
      minDiff = diff
      closest = steamPrice
    }
  }
  
  return closest
}

// Функция для получения отображаемой цены (с округлением до Steam-формата)
const getDisplayPrice = (product) => {
  if (!product || typeof product.price !== 'number' || product.price <= 0) return 0
  return roundToSteamPrice(product.price)
}

const getOriginalPrice = (product, discountPercent = null) => {
  if (!product || typeof product.price !== 'number' || product.price <= 0) return null
  
  // Округляем текущую цену до Steam-формата
  const roundedPrice = roundToSteamPrice(product.price)
  
  const discount = discountPercent ?? getStableDiscountPercent(product)
  if (!Number.isFinite(discount) || discount <= 0 || discount >= 95) {
    // Если скидка не задана, показываем цену на 30-35% выше
    const original = Math.round(roundedPrice * 1.35)
    return roundToSteamPrice(original)
  }
  const original = roundedPrice / (1 - discount / 100)
  if (!Number.isFinite(original) || original <= roundedPrice) {
    const fallback = Math.round(roundedPrice * 1.3)
    return roundToSteamPrice(fallback)
  }
  return roundToSteamPrice(Math.round(original))
}

const getStableRating = (product, min = 35, max = 48) => {
  const key = normalizeProductKey(product)
  if (!key) return 4.2
  const clampedMin = Math.max(0, Math.min(min, max))
  const clampedMax = Math.max(clampedMin, max)
  const span = clampedMax - clampedMin + 1
  if (span <= 0) return clampedMin / 10
  const hash = Math.abs(hashString(`${key}|rating`))
  return (clampedMin + (hash % span)) / 10
}

const LOCAL_GAME_IMAGES = {
  apexlegends: [
    '/images/games/apex_legends_intro.jpeg',
    '/images/games/apex_legends_1.jpeg',
    '/images/games/apex_legends_2.jpeg',
    '/images/games/apex_legends_3.jpg',
    '/images/games/apex_legends_4.jpeg'
  ],
  assassinscreedvalhalla: [
    '/images/games/Assassin_s_Creed_Valhalla_intro.jpeg',
    '/images/games/Assassin_s_Creed_Valhalla_1.jpeg',
    '/images/games/Assassin_s_Creed_Valhalla_2.jpg',
    '/images/games/Assassin_s_Creed_Valhalla_3.jpeg',
    '/images/games/Assassin_s_Creed_Valhalla_4.jpeg',
    '/images/games/Assassin_s_Creed_Valhalla_5.jpeg'
  ],
  baldursgate3: [
    '/images/games/baldur_s_gate_3_intro.jpg',
    '/images/games/baldur_s_gate_3_1.jpg',
    '/images/games/baldur_s_gate_3_2.jpg',
    '/images/games/baldur_s_gate_3_3.jpeg',
    '/images/games/baldur_s_gate_3_4.jpg'
  ],
  citiesskylinesii: [
    '/images/games/Cities_Skylines_II_intro.jpeg',
    '/images/games/Cities_Skylines_II_1.jpeg',
    '/images/games/Cities_Skylines_II_2.jpeg',
    '/images/games/Cities_Skylines_II_4.jpeg',
    '/images/games/cities-skyline-ii_3.jpg'
  ],
  cs2: [
    '/images/games/cs2_intro.jpeg',
    '/images/games/cs2_1.jpg',
    '/images/games/cs2_2.jpeg',
    '/images/games/cs2_3.jpeg',
    '/images/games/cs2_4.jpg'
  ],
  deathstranding: [
    '/images/games/DEATH_STRANDING_intro.jpg',
    '/images/games/DEATH_STRANDING_1.jpg',
    '/images/games/DEATH_STRANDING_2.jpg',
    '/images/games/DEATH_STRANDING_3.jpg',
    '/images/games/DEATH_STRANDING_4.jpg'
  ],
  dispatch: [
    '/images/games/Dispatch_intro.jpg',
    '/images/games/Dispatch_1.jpg',
    '/images/games/Dispatch_2.jpg',
    '/images/games/Dispatch_3.jpg',
    '/images/games/Dispatch_4.jpg',
    '/images/games/Dispatch_5.jpg'
  ],
  doometernal: [
    '/images/games/doom_eternal_intro.jpg',
    '/images/games/doom_eternal_1.jpeg',
    '/images/games/doom_eternal_2.jpeg',
    '/images/games/doom_eternal_3.jpeg',
    '/images/games/doom_eternal_4.jpg'
  ],
  dyinglight2stayhuman: [
    '/images/games/dying_light_2_intro.jpg',
    '/images/games/dying_light_2_1.jpg',
    '/images/games/dying_light_2_2.jpeg',
    '/images/games/dying_light_2_3.jpeg',
    '/images/games/dying_light_2_4.jpg'
  ],
  eaplay: [
    '/images/games/EA_Play_intro.jpg',
    '/images/games/EA_Play_1.jpg',
    '/images/games/EA_Play_2.jpg'
  ],
  eldenring: [
    '/images/games/ELDEN_RING_intro.jpg',
    '/images/games/ELDEN_RING_1.jpeg',
    '/images/games/ELDEN_RING_2.jpg',
    '/images/games/ELDEN_RING_3.jpg',
    '/images/games/ELDEN_RING_4.jpg'
  ],
  europauniversalisv: [
    '/images/games/Europa_Universalis_V_intro.jpg',
    '/images/games/Europa_Universalis_V_1.jpg',
    '/images/games/Europa_Universalis_V_2.jpg',
    '/images/games/Europa_Universalis_V_3.jpg',
    '/images/games/Europa_Universalis_V_4.jpg'
  ],
  fallout1st: [
    '/images/games/Fallout_1st_intro.jpg',
    '/images/games/Fallout_1st_1.jpg',
    '/images/games/Fallout_1st_2.jpg',
    '/images/games/Fallout_1st_3.jpg',
    '/images/games/Fallout_1st_4.jpg'
  ],
  farcry6: [
    '/images/games/Far_Cry_6_intro.jpeg',
    '/images/games/Far_Cry_6_1.jpg',
    '/images/games/Far_Cry_6_2.jpeg',
    '/images/games/Far_Cry_6_3.jpg',
    '/images/games/Far_Cry_6_4.jpeg'
  ],
  forzahorizon5: [
    '/images/games/Forza_Horizon_5_intro.jpg',
    '/images/games/Forza_Horizon_5_1.jpg',
    '/images/games/Forza_Horizon_5_2.jpeg',
    '/images/games/Forza_Horizon_5_3.jpeg',
    '/images/games/Forza_Horizon_5_4.jpeg'
  ],
  ghostoftsushimadirectorscut: [
    '/images/games/ghost_of_tshushima_intro.jpg',
    '/images/games/ghost_of_tshushima_1.jpg',
    '/images/games/ghost_of_tshushima_2.jpg',
    '/images/games/ghost_of_tshushima_3.jpg'
  ],
  godofwar: [
    '/images/games/god_of_war_intro.jpg',
    '/images/games/god_of_war_1.jpg',
    '/images/games/god_of_war_2.jpeg',
    '/images/games/god_of_war_3.jpg',
    '/images/games/god_of_war_4.jpeg'
  ],
  hades: [
    '/images/games/hades_intro.png',
    '/images/games/hades_1.jpg',
    '/images/games/hades_2.jpeg',
    '/images/games/hades_3.jpg'
  ],
  helldivers2: [
    '/images/games/HELLDIVERS_2_intro.jpg',
    '/images/games/HELLDIVERS_2_1.jpg',
    '/images/games/HELLDIVERS_2_2.jpg',
    '/images/games/HELLDIVERS_2_3.jpg',
    '/images/games/HELLDIVERS_2_4.jpg'
  ],
  hogwartslegacy: [
    '/images/games/hogwarts_legasy_intro.jpg',
    '/images/games/hogwarts_legasy_1.jpeg',
    '/images/games/hogwarts_legasy_2.jpeg',
    '/images/games/hogwarts_legasy_3.jpg',
    '/images/games/hogwarts_legasy_4.jpeg'
  ],
  horizonzerodawncompleteedition: [
    '/images/games/Horizon_Zero_Dawn_intro.jpeg',
    '/images/games/Horizon_Zero_Dawn_1.jpeg',
    '/images/games/Horizon_Zero_Dawn_2.jpeg',
    '/images/games/Horizon_Zero_Dawn_3.jpeg',
    '/images/games/Horizon_Zero_Dawn_4.jpeg'
  ],
  kingdomcomedeliveranceii: [
    '/images/games/Kingdom_Come_Deliverance_II_intro.jpeg',
    '/images/games/Kingdom_Come_Deliverance_II_1.jpeg',
    '/images/games/Kingdom_Come_Deliverance_II_2.jpg',
    '/images/games/Kingdom_Come_Deliverance_II_3.jpeg',
    '/images/games/Kingdom_Come_Deliverance_II_4.jpg'
  ],
  liesofp: [
    '/images/games/lies_of_p_intro.jpg',
    '/images/games/lies_of_p_1.jpg',
    '/images/games/lies_of_p_2.jpg',
    '/images/games/lies_of_p_3.jpg'
  ],
  monsterhunterworld: [
    '/images/games/Monster_Hunter_World_intro.jpg',
    '/images/games/Monster_Hunter_World_1.jpg',
    '/images/games/Monster_Hunter_World_2.jpg',
    '/images/games/Monster_Hunter_World_3.jpeg',
    '/images/games/Monster_Hunter_World_4.jpeg'
  ],
  nomanssky: [
    '/images/games/No_Man_s_Sky_into.jpg',
    '/images/games/No_Man_s_Sky_1.jpg',
    '/images/games/No_Man_s_Sky_2.jpg',
    '/images/games/No_Man_s_Sky_3.jpeg',
    '/images/games/No_Man_s_Sky_4.jpeg'
  ],
  oriandthewillofthewisps: [
    '/images/games/Ori_and_the_Will_of_the_Wisps_intro.jpg',
    '/images/games/Ori_and_the_Will_of_the_Wisps_1.jpg',
    '/images/games/Ori_and_the_Will_of_the_Wisps_2.jpg',
    '/images/games/Ori_and_the_Will_of_the_Wisps_3.jpg'
  ],
  palworld: [
    '/images/games/palworld_intro.jpg',
    '/images/games/palworld-1.jpg',
    '/images/games/palworld-2.jpg',
    '/images/games/palworld-3.jpg',
    '/images/games/palworld_4.png'
  ],
  peak: [
    '/images/games/PEAK_intro.jpg',
    '/images/games/PEAK_1.jpg',
    '/images/games/PEAK_2.jpg',
    '/images/games/PEAK_3.jpg',
    '/images/games/PEAK_4.jpeg'
  ],
  reddeadredemption2: [
    '/images/games/rdr_2_intro.jpeg',
    '/images/games/rdr_2_1.jpeg',
    '/images/games/rdr_2_2.jpg',
    '/images/games/rdr_2_3.jpeg',
    '/images/games/rdr_2_4.jpg'
  ],
  residentevil4: [
    '/images/games/Resident_Evil_4_intro.jpg',
    '/images/games/Resident_Evil_4_1.jpg',
    '/images/games/Resident_Evil_4_2.jpeg',
    '/images/games/Resident_Evil_4_3.jpeg',
    '/images/games/Resident_Evil_4_4.jpg'
  ],
  rimworld: [
    '/images/games/Rimworld_intro.jpg',
    '/images/games/Rimworld_1.jpg',
    '/images/games/Rimworld_2.jpg',
    '/images/games/Rimworld_3.jpeg'
  ],
  sekiroshadowsdietwice: [
    '/images/games/sekiro_intro.jpg',
    '/images/games/sekiro_1.jpeg',
    '/images/games/sekiro_2.jpeg',
    '/images/games/sekiro_3.jpg',
    '/images/games/sekiro_4.jpeg'
  ],
  sonsoftheforest: [
    '/images/games/Sons-of-the-Forest-intro.jpg',
    '/images/games/Sons-of-the-Forest-1.jpg',
    '/images/games/Sons-of-the-Forest-2.png',
    '/images/games/Sons-of-the-Forest-3.jpg',
    '/images/games/Sons-of-the-Forest-4.jpg'
  ],
  stardewvalley: [
    '/images/games/Stardew_Valley_intro.jpg',
    '/images/games/Stardew_Valley_1.jpeg',
    '/images/games/Stardew_Valley_2.jpeg',
    '/images/games/Stardew_Valley_3.jpeg',
    '/images/games/Stardew_Valley_3.jpg'
  ],
  starfield: [
    '/images/games/Starfield_intro.jpg',
    '/images/games/Starfield_1.jpeg',
    '/images/games/Starfield_2.jpeg',
    '/images/games/Starfield_3.jpeg',
    '/images/games/Starfield_4.jpg'
  ],
  teamfortress2: [
    '/images/games/team_fortress_intro.jpg',
    '/images/games/team_fortress_1.jpg',
    '/images/games/team_fortress_2.jpg',
    '/images/games/team_fortress_3.jpg',
    '/images/games/team_fortress_4.jpg'
  ],
  terraria: [
    '/images/games/terraria_intro.png',
    '/images/games/terraria_1.png',
    '/images/games/terraria_2.jpg',
    '/images/games/terraria_3.png'
  ],
  thelastcaretaker: [
    '/images/games/The_Last_Caretaker_intro.jpg',
    '/images/games/The_Last_Caretaker_1.jpg',
    '/images/games/The_Last_Caretaker_2.jpeg',
    '/images/games/The_Last_Caretaker_3.jpg',
    '/images/games/The_Last_Caretaker_4.jpg'
  ],
  thewitcher3wildhunt: [
    '/images/games/the_witcher_3_intro.jpeg',
    '/images/games/the_witcher_3_1.jpg',
    '/images/games/the_witcher_3_2.jpeg',
    '/images/games/the_witcher_3_3.jpeg',
    '/images/games/the_witcher_3_4.jpeg'
  ]
}
const LOCAL_GAME_IMAGE_ALIASES = {
  counterstrike2: 'cs2',
  '730': 'cs2',
  citiesskylineii: 'citiesskylinesii',
  citiesskylines2: 'citiesskylinesii',
  '949230': 'citiesskylinesii',
  '1190460': 'deathstranding',
  '2592160': 'dispatch',
  '782330': 'doometernal',
  dyinglight2: 'dyinglight2stayhuman',
  '534380': 'dyinglight2stayhuman',
  '1289670': 'eaplay',
  '1245620': 'eldenring',
  '3450310': 'europauniversalisv',
  falloutfirst: 'fallout1st',
  '1202520': 'fallout1st',
  farcry: 'farcry6',
  '2369390': 'farcry6',
  forzahorizon: 'forzahorizon5',
  '1551360': 'forzahorizon5',
  ghostoftshushima: 'ghostoftsushimadirectorscut',
  ghostoftsushima: 'ghostoftsushimadirectorscut',
  '2215430': 'ghostoftsushimadirectorscut',
  '1593500': 'godofwar',
  '1145360': 'hades',
  helldivers: 'helldivers2',
  helldiversii: 'helldivers2',
  '553850': 'helldivers2',
  hogwartslegasy: 'hogwartslegacy',
  '990080': 'hogwartslegacy',
  horizonzerodawn: 'horizonzerodawncompleteedition',
  '1151640': 'horizonzerodawncompleteedition',
  '1771300': 'kingdomcomedeliveranceii',
  '1627720': 'liesofp',
  '582010': 'monsterhunterworld',
  '275850': 'nomanssky',
  '1057090': 'oriandthewillofthewisps',
  '1623730': 'palworld',
  '3527290': 'peak',
  rdr2: 'reddeadredemption2',
  rdr: 'reddeadredemption2',
  '1174180': 'reddeadredemption2',
  '2050650': 'residentevil4',
  '294100': 'rimworld',
  sekiro: 'sekiroshadowsdietwice',
  '814380': 'sekiroshadowsdietwice',
  '1326470': 'sonsoftheforest',
  '413150': 'stardewvalley',
  '1716740': 'starfield',
  teamfortress: 'teamfortress2',
  '440': 'teamfortress2',
  '105600': 'terraria',
  thewitcher3: 'thewitcher3wildhunt',
  '292030': 'thewitcher3wildhunt',
  '1783560': 'thelastcaretaker'
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const buildAuthUrl = (path) => `${API_BASE_URL}${path}`
const CHAT_SESSION_STORAGE_KEY = 'support-chat-session-id'
const CHAT_NAME_STORAGE_KEY = 'support-chat-name'
const CHAT_EMAIL_STORAGE_KEY = 'support-chat-email'
const resolveSocketBaseUrl = () => {
  if (API_BASE_URL) return API_BASE_URL
  if (typeof window !== 'undefined') {
    try {
      return window.location.origin.replace(/\/$/, '')
    } catch {
      return ''
    }
  }
  return ''
}
const sortChatMessages = (messages = []) => {
  if (!Array.isArray(messages)) return []
  return [...messages].sort((a, b) => {
    const aTime = new Date(a?.createdAt || a?.timestamp || 0).getTime()
    const bTime = new Date(b?.createdAt || b?.timestamp || 0).getTime()
    return aTime - bTime
  })
}
const SUPPORT_ADMIN_KEY = import.meta.env.VITE_SUPPORT_ADMIN_KEY || ''

const sortImagePaths = (paths = []) => {
  const weight = (p) => {
    const lower = p.toLowerCase()
    if (lower.includes('intro') || lower.includes('header')) return 0
    const match = lower.match(/_(\d+)(?=\.[^./]+$)/)
    if (match) return 1 + parseInt(match[1], 10)
    return 5
  }
  return Array.from(new Set(paths)).sort((a, b) => {
    const diff = weight(a) - weight(b)
    if (diff !== 0) return diff
    return a.localeCompare(b)
  })
}

const getLocalGameImages = (product) => {
  if (!product) return null
  const keys = new Set()
  if (product.name) keys.add(sanitizeKey(product.name))
  if (product.id) keys.add(sanitizeKey(product.id))
  if (product.slug) keys.add(sanitizeKey(product.slug))
  if (product.steamAppId) keys.add(String(product.steamAppId))
  for (const key of keys) {
    if (!key) continue
    if (LOCAL_GAME_IMAGES[key]) return sortImagePaths(LOCAL_GAME_IMAGES[key])
    const alias = LOCAL_GAME_IMAGE_ALIASES[key]
    if (alias && LOCAL_GAME_IMAGES[alias]) return sortImagePaths(LOCAL_GAME_IMAGES[alias])
  }
  return null
}

const AUTH_FLAG_KEY = 'profile-auth'
const AUTH_EXPIRY_KEY = 'profile-auth-expires'
const AUTH_SESSION_MS = 7 * 24 * 60 * 60 * 1000

const extendAuthSession = (durationMs = AUTH_SESSION_MS) => {
  if (typeof window === 'undefined') return
  try {
    const expiresAt = Date.now() + durationMs
    window.localStorage.setItem(AUTH_EXPIRY_KEY, String(expiresAt))
    if (typeof document !== 'undefined') {
      const expiresDate = new Date(expiresAt).toUTCString()
      document.cookie = `profile_auth=1; expires=${expiresDate}; path=/`
    }
  } catch {
    // ignore storage issues
  }
}

const clearAuthSession = () => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(AUTH_FLAG_KEY)
    window.localStorage.removeItem(AUTH_EXPIRY_KEY)
  } catch {
    // ignore
  }
  if (typeof document !== 'undefined') {
    document.cookie = 'profile_auth=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
    document.cookie = 'auth_method=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
  }
}
const hasValidAuthSession = () => {
  if (typeof window === 'undefined') return false
  try {
    if (window.localStorage.getItem(AUTH_FLAG_KEY) !== '1') return false
    const raw = window.localStorage.getItem(AUTH_EXPIRY_KEY)
    if (!raw) return true
    const expiresAt = Number(raw)
    if (!Number.isFinite(expiresAt) || expiresAt <= 0) return true
    if (Date.now() > expiresAt) {
      clearAuthSession()
      return false
    }
    return true
  } catch {
    return false
  }
}

function SupportChatWidget({ defaultName = '', defaultEmail = '' }) {
  const socketRef = React.useRef(null)
  const ensurePromiseRef = React.useRef(null)
  const listRef = React.useRef(null)
  const isOpenRef = React.useRef(false)
  const socketBaseRef = React.useRef(resolveSocketBaseUrl())
  const [isOpen, setIsOpen] = React.useState(false)
  const [session, setSession] = React.useState(null)
  const [messages, setMessages] = React.useState([])
  const [messageText, setMessageText] = React.useState('')
  const [sending, setSending] = React.useState(false)
  const [connecting, setConnecting] = React.useState(false)
  const [unreadCount, setUnreadCount] = React.useState(0)
  const [error, setError] = React.useState('')
  const [orders, setOrders] = React.useState([])
  const [ordersLoading, setOrdersLoading] = React.useState(true)
  const [userName, setUserName] = React.useState(() => {
    if (defaultName) return defaultName
    if (typeof window === 'undefined') return ''
    try {
      const stored = window.localStorage.getItem(CHAT_NAME_STORAGE_KEY)
      if (stored) return stored
      const profile = window.localStorage.getItem('profile-name')
      return profile || ''
    } catch {
      return ''
    }
  })
  const [userEmail, setUserEmail] = React.useState(() => {
    if (defaultEmail) return defaultEmail
    if (typeof window === 'undefined') return ''
    try {
      const stored = window.localStorage.getItem(CHAT_EMAIL_STORAGE_KEY)
      if (stored) return stored
      const profileEmail = window.localStorage.getItem('profile-email')
      return profileEmail || ''
    } catch {
      return ''
    }
  })
  const [showUserFields, setShowUserFields] = React.useState(true)

  const updateFromSession = React.useCallback((data) => {
    if (!data || !data.id) return
    console.log('[chat] Updating from session:', data.id, 'messages:', (data.messages || []).length)
    setSession(data)
    const sessionMessages = sortChatMessages(data.messages || [])
    console.log('[chat] Setting messages:', sessionMessages.length)
    setMessages(sessionMessages)
    
    // Если есть сообщения от пользователя, скрываем поля ввода
    const hasUserMessages = sessionMessages.some((m) => m?.authorRole === 'user')
    if (hasUserMessages) {
      setShowUserFields(false)
    }
    
    // Обновляем данные пользователя из сессии, если они есть
    if (data.user) {
      if (data.user.name && !userName) {
        setUserName(data.user.name)
      }
      if (data.user.email && !userEmail) {
        setUserEmail(data.user.email)
      }
    }
    
    setUnreadCount(data.unreadForUser ? Math.max(1, (data.messages || []).filter((m) => m?.authorRole === 'admin').length ? 1 : 0) : 0)
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(CHAT_SESSION_STORAGE_KEY, data.id)
      }
    } catch {
      // ignore storage issues
    }
  }, [userName, userEmail])

  const ensureSession = React.useCallback(() => {
    if (session?.id) return Promise.resolve(session)
    if (ensurePromiseRef.current) return ensurePromiseRef.current
    
    // Если есть email, ищем существующую сессию по email
    const existingSessionId = (() => {
      if (typeof window === 'undefined') return null
      try {
        return window.localStorage.getItem(CHAT_SESSION_STORAGE_KEY)
      } catch {
        return null
      }
    })()
    
    const payload = {
      sessionId: existingSessionId,
      name: userName || null,
      email: userEmail || null,
      // Используем email как идентификатор пользователя для создания одного чата на пользователя
      userIdentifier: userEmail || null
    }
    setConnecting(true)
    const request = fetch(buildAuthUrl('/api/chat/session'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    })
      .then((res) => res.json().catch(() => null))
      .then((data) => {
        if (data?.ok && data.session) {
          updateFromSession(data.session)
          return data.session
        }
        throw new Error('session_init_failed')
      })
      .catch((err) => {
        console.warn('[chat] ensure session error', err?.message)
        setError('Не удалось подключиться к чату. Попробуйте позже.')
        return null
      })
      .finally(() => {
        ensurePromiseRef.current = null
        setConnecting(false)
      })
    ensurePromiseRef.current = request
    return request
  }, [session?.id, userName, userEmail, updateFromSession])

  const markSessionRead = React.useCallback(() => {
    if (!session?.id) return
    setSession((prev) => (prev ? { ...prev, unreadForUser: false } : prev))
    setUnreadCount(0)
    const payload = { sessionId: session.id, target: 'user' }
    if (socketRef.current) {
      socketRef.current.emit('chat:markRead', payload)
    } else {
      fetch(buildAuthUrl(`/api/chat/session/${session.id}/read`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ target: 'user' })
      }).catch(() => {})
    }
  }, [session?.id])

  React.useEffect(() => {
    isOpenRef.current = isOpen
    if (isOpen) {
      markSessionRead()
    }
  }, [isOpen, markSessionRead])

  React.useEffect(() => {
    if (!isOpen) return
    ensureSession()
  }, [isOpen, ensureSession])

  React.useEffect(() => {
    if (!session?.id) return undefined
    const socketBase = socketBaseRef.current
    if (!socketBase) return undefined
    const socket = socketIOClient(socketBase, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      auth: { sessionId: session.id }
    })
    socketRef.current = socket
    socket.on('connect', () => setError(''))
    socket.on('connect_error', (err) => {
      console.warn('[chat] socket error', err?.message)
    })
    socket.emit('chat:join', { sessionId: session.id }, (response) => {
      if (response?.ok && response.session) {
        updateFromSession(response.session)
      }
    })
    socket.on('chat:session', (payload) => {
      if (!payload) return
      updateFromSession(payload)
    })
    socket.on('chat:message', ({ message }) => {
      if (!message) return
      console.log('[chat] Received message:', message)
      setMessages((prev) => {
        // Проверяем, нет ли уже такого сообщения
        const existing = prev.find((item) => item?.id === message.id)
        if (existing) {
          console.log('[chat] Message already exists, skipping')
          return prev
        }
        const updated = sortChatMessages([...prev, message])
        console.log('[chat] Updated messages count:', updated.length)
        
        // Если это первое сообщение от пользователя, скрываем поля ввода
        if (message.authorRole === 'user' && showUserFields) {
          setShowUserFields(false)
        }
        
        return updated
      })
      setSession((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          lastMessageAt: message.createdAt || prev.lastMessageAt,
          unreadForUser: message.authorRole === 'admin' ? true : prev.unreadForUser
        }
      })
      if (message.authorRole === 'admin' && !isOpenRef.current) {
        setUnreadCount((count) => count + 1)
      }
    })
    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [session?.id, updateFromSession])

  React.useEffect(() => {
    if (!messages.length) return
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages])

  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const handler = () => {
      setError('')
      setIsOpen(true)
      ensureSession().then(() => markSessionRead()).catch(() => {})
    }
    window.addEventListener('support-chat-open', handler)
    return () => window.removeEventListener('support-chat-open', handler)
  }, [ensureSession, markSessionRead])

  React.useEffect(() => {
    if (!defaultName) return
    setUserName((prev) => (prev ? prev : defaultName))
  }, [defaultName])

  React.useEffect(() => {
    if (!defaultEmail) return
    setUserEmail((prev) => (prev ? prev : defaultEmail))
  }, [defaultEmail])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (userName) {
        window.localStorage.setItem(CHAT_NAME_STORAGE_KEY, userName)
      } else {
        window.localStorage.removeItem(CHAT_NAME_STORAGE_KEY)
      }
    } catch {
      // ignore
    }
  }, [userName])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (userEmail) {
        window.localStorage.setItem(CHAT_EMAIL_STORAGE_KEY, userEmail)
      } else {
        window.localStorage.removeItem(CHAT_EMAIL_STORAGE_KEY)
      }
    } catch {
      // ignore
    }
  }, [userEmail])

  const sendMessage = React.useCallback(async () => {
    const trimmed = messageText.trim()
    if (!trimmed) return
    setError('')
    const current = await ensureSession()
    if (!current?.id) return
    setSending(true)
    const payload = {
      sessionId: current.id,
      body: trimmed,
      authorName: userName || '',
      user: {
        name: userName || null,
        email: userEmail || null
      }
    }
    const finalizeSuccess = () => {
      setSending(false)
      setMessageText('')
      // Скрываем поля после первого сообщения
      setShowUserFields(false)
      if (!isOpenRef.current) {
        setIsOpen(true)
      }
    }
    const handleFailure = () => {
      setSending(false)
      setError('Не удалось отправить сообщение. Попробуйте снова.')
    }
    if (socketRef.current?.connected) {
      socketRef.current.emit('chat:message', payload, (ack) => {
        if (ack && ack.ok === false) {
          handleFailure()
        } else {
          // Если получено сообщение в ответе, добавляем его
          if (ack && ack.message) {
            setMessages((prev) => {
              const existing = prev.find((item) => item?.id === ack.message.id)
              if (existing) return prev
              return sortChatMessages([...prev, ack.message])
            })
          }
          // Если получена обновленная сессия, обновляем сообщения
          if (ack && ack.session && ack.session.messages) {
            const sessionMessages = sortChatMessages(ack.session.messages || [])
            setMessages(sessionMessages)
            updateFromSession(ack.session)
          }
          finalizeSuccess()
        }
      })
      return
    }
    try {
      const response = await fetch(buildAuthUrl(`/api/chat/session/${current.id}/message`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          body: trimmed,
          authorName: userName || '',
          authorRole: 'user',
          user: { name: userName || null, email: userEmail || null }
        })
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.ok) {
        handleFailure()
        return
      }
      // Обновляем сообщения после отправки
      if (data.session && data.session.messages) {
        const sessionMessages = sortChatMessages(data.session.messages || [])
        setMessages(sessionMessages)
        updateFromSession(data.session)
      }
      finalizeSuccess()
    } catch (err) {
      console.warn('[chat] send error', err?.message)
      handleFailure()
    }
  }, [messageText, ensureSession, userName, userEmail])

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!sending) {
      sendMessage()
    }
  }

  const formatTime = React.useCallback((value) => {
    if (!value) return ''
    try {
      const date = new Date(value)
      return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }, [])

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-2">
      {isOpen ? (
        <div className="w-72 sm:w-80 bg-[#101a33] border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col">
          <div className="flex items-start justify-between px-4 py-3 border-b border-white/10">
            <div>
              <div className="text-sm font-semibold">Онлайн-чат</div>
              <div className="text-xs text-white/60">
                {connecting ? 'Подключаемся...' : 'Ответим в ближайшее время'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
              aria-label="Закрыть чат"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-3 max-h-64 scrollbar-hide">
            {messages.length === 0 ? (
              <div className="text-xs text-white/60 text-center px-2">
                Здравствуйте! Напишите ваш вопрос, и мы постараемся быстро ответить.
              </div>
            ) : (
              messages.map((message) => {
                const isOperator = message.authorRole === 'admin'
                return (
                  <div key={message.id} className={`flex ${isOperator ? 'justify-start' : 'justify-end'}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-md ${
                        isOperator ? 'bg-white/10 text-white/90' : 'bg-blue-600 text-white'
                      }`}
                    >
                      {isOperator && (
                        <div className="text-xs font-semibold text-white/70 mb-1">Оператор</div>
                      )}
                      {!isOperator && userName && (
                        <div className="text-xs font-semibold text-white/80 mb-1">{userName}</div>
                      )}
                      <div>{message.body}</div>
                      <div className="text-[10px] text-white/50 mt-1 text-right">
                        {formatTime(message.createdAt)}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
          <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-white/10 space-y-2">
            {showUserFields && (
              <>
                <input
                  type="text"
                  placeholder="Ваше имя"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-blue-500"
                  required={messages.length === 0}
                />
                <input
                  type="email"
                  placeholder="Email для ответа"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-blue-500"
                  required={messages.length === 0}
                />
              </>
            )}
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  if (!sending) {
                    sendMessage()
                  }
                }
              }}
              rows={3}
              placeholder="Введите сообщение..."
              className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-blue-500 resize-none"
            />
            {error && <div className="text-xs text-red-400">{error}</div>}
            <button
              type="submit"
              disabled={sending || messageText.trim().length === 0}
              className={`w-full px-4 py-2 rounded text-sm font-semibold transition-colors ${
                sending || messageText.trim().length === 0
                  ? 'bg-blue-900/70 text-white/60 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {sending ? 'Отправка...' : 'Отправить'}
            </button>
          </form>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setIsOpen(true)
            setError('')
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-transform hover:scale-105"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
            />
          </svg>
          <span>Онлайн-чат</span>
          {unreadCount > 0 && (
            <span className="ml-1 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-500 text-white">
              {unreadCount}
            </span>
          )}
        </button>
      )}
    </div>
  )
}
const dedupeProductsByKey = (items = []) => {
  const map = new Map()
  for (const item of items) {
    if (!item) continue
    const key = normalizeProductKey(item)
    if (!key) continue
    // Нормализуем цену перед добавлением
    const normalizedItem = (item.price !== undefined && item.price !== null)
      ? { ...item, price: normalizePrice(item.price) }
      : item
    const existing = map.get(key)
    if (!existing) {
      map.set(key, normalizedItem)
      continue
    }
    const existingLocal = hasLocalImageSource(existing)
    const candidateLocal = hasLocalImageSource(normalizedItem)
    if (existingLocal !== candidateLocal) {
      map.set(key, candidateLocal ? normalizedItem : existing)
      continue
    }
    const existingImages = Array.isArray(existing.images) ? existing.images.length : 0
    const candidateImages = Array.isArray(normalizedItem.images) ? normalizedItem.images.length : 0
    if (candidateImages !== existingImages) {
      map.set(key, candidateImages > existingImages ? normalizedItem : existing)
      continue
    }
    if (!existing.description && normalizedItem.description) {
      map.set(key, normalizedItem)
      continue
    }
    if (existing.description && !normalizedItem.description) {
      map.set(key, existing)
      continue
    }
    const existingPrice = Number(existing.price) || 0
    const candidatePrice = Number(normalizedItem.price) || 0
    if (candidatePrice > 0 && existingPrice <= 0) {
      map.set(key, normalizedItem)
      continue
    }
    if (candidatePrice <= 0 && existingPrice > 0) {
      map.set(key, existing)
      continue
    }
    if (!existing.steamAppId && normalizedItem.steamAppId) {
      map.set(key, normalizedItem)
    }
  }
  // Финальная нормализация всех цен в результате
  return Array.from(map.values()).map(item => {
    if (item && (item.price !== undefined && item.price !== null)) {
      const normalizedPrice = normalizePrice(item.price)
      return { ...item, price: normalizedPrice }
    }
    return item
  })
}
const collectProductImages = (product) => {
  if (!product) return [PLACEHOLDER_IMAGE]
  const collected = []
  const pushUnique = (src) => {
    if (!src) return
    const normalized = normalizeImageSrc(src)
    if (!normalized) return
    // Убеждаемся что локальные пути начинаются с /
    const finalSrc = normalized.startsWith('/') ? normalized : `/${normalized}`
    if (!collected.includes(finalSrc)) {
      collected.push(finalSrc)
    }
  }
  // Сначала добавляем локальные изображения из LOCAL_GAME_IMAGES
  const localImages = getLocalGameImages(product)
  if (Array.isArray(localImages) && localImages.length > 0) {
    localImages.forEach(pushUnique)
  }
  // Затем добавляем изображения из продукта
  const sources = [
    ...(Array.isArray(product.images) ? product.images : []),
    product.image,
    product.introImage
  ]
  sources.forEach(pushUnique)
  // Разделяем на локальные и внешние
  const localSources = collected.filter((src) => {
    // Локальные - это те, что начинаются с / или не начинаются с http
    return src.startsWith('/') || (!src.startsWith('http://') && !src.startsWith('https://'))
  })
  const externalSources = collected.filter((src) => {
    if (!src.startsWith('http://') && !src.startsWith('https://')) return false
    const lower = src.toLowerCase()
    return !lower.includes('steamstatic.com')
  })
  const steamCdnSources = collected.filter((src) => {
    if (!src.startsWith('http://') && !src.startsWith('https://')) return false
    const lower = src.toLowerCase()
    return lower.includes('steamstatic.com')
  })
  // Приоритет: локальные источники сначала
  const ordered = [...localSources, ...externalSources, ...steamCdnSources]
  return ordered.length ? ordered : [PLACEHOLDER_IMAGE]
}
const getPrimaryImage = (product) => collectProductImages(product)[0] || PLACEHOLDER_IMAGE

function LazyImage({
  src,
  alt,
  className = '',
  wrapperClassName = '',
  fallback = PLACEHOLDER_IMAGE,
  onImageLoad,
  onImageError,
  ...props
}) {
  const [currentSrc, setCurrentSrc] = React.useState(fallback)
  const [isLoading, setIsLoading] = React.useState(true)
  const [failed, setFailed] = React.useState(false)
  const containerRef = React.useRef(null)

  React.useEffect(() => {
    setFailed(false)
    setIsLoading(true)
    const node = containerRef.current
    if (!node) {
      return
    }

    const loadImage = () => {
      if (!src) {
        setCurrentSrc(fallback)
        setIsLoading(false)
        setFailed(true)
        if (onImageError) onImageError(new Error('Empty src'))
        return
      }
      const img = new Image()
      img.onload = () => {
        setCurrentSrc(src)
        setIsLoading(false)
        if (onImageLoad) onImageLoad()
      }
      img.onerror = (err) => {
        setCurrentSrc(fallback)
        setIsLoading(false)
        setFailed(true)
        if (onImageError) onImageError(err)
      }
      img.src = src
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            loadImage()
            observer.disconnect()
          }
        })
      },
      { rootMargin: '100px', threshold: 0.1 }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [src, fallback, onImageLoad, onImageError])

  return (
    <div ref={containerRef} className={`relative flex items-center justify-center ${wrapperClassName}`}>
      <img
        src={currentSrc}
        alt={alt}
        className={`transition-opacity duration-300 object-center ${isLoading ? 'opacity-0' : 'opacity-100'} ${className}`}
        loading="lazy"
        decoding="async"
        {...props}
      />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#111833]">
          <div className="w-6 h-6 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
        </div>
      )}
      {failed && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#111833] text-xs text-white/60 text-center px-2">
          Изображение не загрузилось
        </div>
      )}
    </div>
  )
}

// Импорты страниц
import FAQ from './pages/FAQ.jsx'
import Support from './pages/Support.jsx'
import Privacy from './pages/Privacy.jsx'
import Terms from './pages/Terms.jsx'
import CopyrightAgreement from './pages/CopyrightAgreement.jsx'
import PublicOffer from './pages/PublicOffer.jsx'
import About from './pages/About.jsx'
import BlogPage from './pages/Blog.jsx'
import Contacts from './pages/Contacts.jsx'
// Импорт сервиса отправки email
import { sendPurchaseEmail } from './services/emailService.js'

// Единая база данных продуктов (восстановлено)
const DATA = {
  products: [
    // Игры
    { id: 'cyberpunk', name: 'Cyberpunk 2077', price: 29.99, image: '/images/cyberpunk/intro.jpeg', category: 'game', type: 'rpg', introImage: '/images/cyberpunk/intro.jpeg', images: ['/images/cyberpunk/intro.jpeg','/images/cyberpunk/game-cyberpunk-preview-2.jpeg','/images/cyberpunk/game-cyberpunk-preview-3.jpg','/images/cyberpunk/game-cyberpunk-preview-4.jpg','/images/cyberpunk/game-cyberpunk-preview-5.jpg','/images/cyberpunk/intro.jpeg','/images/cyberpunk/game-cyberpunk-preview-2.jpeg','/images/cyberpunk/game-cyberpunk-preview-3.jpg'], specs: { developer: 'CD Projekt Red', release: '2020', platform: 'PC/PlayStation/Xbox', min: 'Intel Core i5, 8GB RAM, GTX 780' }, description: 'Культовая RPG в мире Ночного Города. Исследуйте город, улучшайте импланты, выбирайте свою историю.', fullDescription: 'Cyberpunk 2077 — это масштабная ролевая игра с открытым миром, действие которой происходит в мегаполисе Ночного Города, где власть, роскошь и модификации тела значат все. Вы играете за V — наемника в поисках устройства, позволяющего обрести бессмертие. Создайте уникального персонажа, выбирайте свой стиль игры — хакер, солдат или ниндзя. Исследуйте огромный город, полный опасностей и возможностей. Встречайте запоминающихся персонажей, принимайте решения, влияющие на сюжет, и погрузитесь в атмосферу киберпанка от создателей The Witcher 3.' },
    { id: 'battlefield6', name: 'Battlefield 6', price: 49.99, image: '/images/battlefield6/intro.jpeg', introImage: '/images/battlefield6/intro.jpeg', category: 'game', type: 'shooter', images: ['/images/battlefield6/intro.jpeg','/images/battlefield6/battlefield-preview-1.jpeg','/images/battlefield6/battlefield-preview-2.jpg','/images/battlefield6/battlefield-preview-3.png','/images/battlefield6/battlefield-preview-4.png','/images/battlefield6/intro.jpeg','/images/battlefield6/battlefield-preview-1.jpeg','/images/battlefield6/battlefield-preview-2.jpg'], specs: { developer: 'DICE', release: '2024', platform: 'PC/PlayStation/Xbox', min: 'Intel Core i5-8400, 8GB RAM, GTX 1060' }, description: 'Новейший шутер от DICE с масштабными сражениями до 128 игроков.' },
    { id: 'arc-raiders', name: 'ARC Raiders', price: 39.99, image: '/images/ARC Raiders/intro.jpg', introImage: '/images/ARC Raiders/intro.jpg', category: 'game', type: 'shooter', steamAppId: 1808500, images: ['/images/ARC Raiders/intro.jpg','/images/ARC Raiders/raiders-preview-1.jpeg','/images/ARC Raiders/raiders-preview-2.jpeg','/images/ARC Raiders/raiders-preview-3.jpg','/images/ARC Raiders/raiders-preview-4.jpeg','/images/ARC Raiders/intro.jpg','/images/ARC Raiders/raiders-preview-1.jpeg','/images/ARC Raiders/raiders-preview-2.jpeg','/images/ARC Raiders/raiders-preview-3.jpg'], specs: { developer: 'Embark Studios', release: '2024', platform: 'PC/PlayStation/Xbox', min: 'Intel Core i5-9400F, 12GB RAM, GTX 1660' }, description: 'Кооперативный экшен-шутер от третьего лица в постапокалиптическом мире.' },
    { id: 'ea-sports-fc-26', name: 'EA SPORTS FC 26', price: 59.99, image: '/images/EA SPORTS FC 26/intro.jpg', introImage: '/images/EA SPORTS FC 26/intro.jpg', category: 'game', type: 'sports', images: ['/images/EA SPORTS FC 26/intro.jpg','/images/EA SPORTS FC 26/sports-preview-1.jpeg','/images/EA SPORTS FC 26/sports-preview-2.jpg','/images/EA SPORTS FC 26/sports-preview-3.jpg','/images/EA SPORTS FC 26/sports-preview-4.jpg','/images/EA SPORTS FC 26/intro.jpg','/images/EA SPORTS FC 26/sports-preview-1.jpeg','/images/EA SPORTS FC 26/sports-preview-2.jpg','/images/EA SPORTS FC 26/sports-preview-3.jpg'], specs: { developer: 'EA Sports', release: '2025', platform: 'PC/PlayStation/Xbox', min: 'Intel Core i5-10400F, 8GB RAM, GTX 1650' }, description: 'Футбольный симулятор с улучшенной физикой и анимацией.' },
    { id: 'gta-v', name: 'GTA V', price: 29.99, image: '/images/GTA V/intro.jpg', introImage: '/images/GTA V/intro.jpg', category: 'game', type: 'racing', images: ['/images/GTA V/intro.jpg','/images/GTA V/GTA-preview-1.jpg','/images/GTA V/GTA-preview-2.jpg','/images/GTA V/GTA-preview-3.jpg','/images/GTA V/GTA-preview-4.jpg','/images/GTA V/intro.jpg','/images/GTA V/GTA-preview-1.jpg','/images/GTA V/GTA-preview-2.jpg','/images/GTA V/GTA-preview-3.jpg'], specs: { developer: 'Rockstar Games', release: '2013', platform: 'PC/PlayStation/Xbox', min: 'Intel Core i5-3470, 8GB RAM, GTX 660' }, description: 'Легендарная игра в открытом мире.' },
    { id: 'jurassic-world-evolution-3', name: 'Jurassic World Evolution 3', price: 49.99, image: '/images/Jurassic World Evolution 3/intro.jpg', introImage: '/images/Jurassic World Evolution 3/intro.jpg', category: 'game', type: 'strategy', images: ['/images/Jurassic World Evolution 3/intro.jpg','/images/Jurassic World Evolution 3/evolution-preview-1.jpg','/images/Jurassic World Evolution 3/evolution-preview-2.jpeg','/images/Jurassic World Evolution 3/evolution-preview-3.png','/images/Jurassic World Evolution 3/evolution-preview-4.jpg','/images/Jurassic World Evolution 3/intro.jpg','/images/Jurassic World Evolution 3/evolution-preview-1.jpg','/images/Jurassic World Evolution 3/evolution-preview-2.jpeg','/images/Jurassic World Evolution 3/evolution-preview-3.png'], specs: { developer: 'Frontier Developments', release: '2024', platform: 'PC/PlayStation/Xbox', min: 'Intel Core i5-8400, 12GB RAM, GTX 1060' }, description: 'Управляйте своим парком динозавров.' },
    { id: 'dead-by-daylight', name: 'Dead by Daylight', price: 24.99, image: '/images/dead by daylight/intro.jpg', introImage: '/images/dead by daylight/intro.jpg', category: 'game', type: 'horror', images: ['/images/dead by daylight/intro.jpg','/images/dead by daylight/dead-preview-1.jpg','/images/dead by daylight/dead-preview-2.jpg','/images/dead by daylight/dead-preview-3.png','/images/dead by daylight/dead-preview-4.jpg','/images/dead by daylight/intro.jpg','/images/dead by daylight/dead-preview-1.jpg','/images/dead by daylight/dead-preview-2.jpg','/images/dead by daylight/dead-preview-3.png'], specs: { developer: 'Behaviour Interactive', release: '2016', platform: 'PC/PlayStation/Xbox/Nintendo Switch', min: 'Intel Core i3-4170, 8GB RAM, GTX 460' }, description: 'Асимметричная игра на выживание 4 против 1.' },
    { id: 'baldurs-gate-3', name: "Baldur's Gate 3", price: 59.99, image: '/images/baldurs-gate-3/intro.jpg', introImage: '/images/baldurs-gate-3/intro.jpg', category: 'game', type: 'rpg', images: ['/images/baldurs-gate-3/intro.jpg', '/images/baldurs-gate-3/thumbnail-2.jpg', '/images/baldurs-gate-3/thumbnail-3.jpg', '/images/baldurs-gate-3/thumbnail-4.jpg'], specs: { developer: 'Larian Studios', release: '2023', platform: 'PC/PlayStation/Xbox', min: 'Intel Core i5-4690, 8GB RAM, GTX 970' }, description: 'Классическая RPG по D&D.', fullDescription: "Baldur's Gate 3 — это эпическая ролевая игра, основанная на правилах Dungeons & Dragons. Создайте своего персонажа, соберите отряд и отправляйтесь в захватывающее приключение в мире Forgotten Realms. Ваши решения влияют на сюжет, а боевая система основана на пошаговых сражениях D&D 5-й редакции." },

    // Скины
    { id: 'skin-awp-gungnir', name: 'AWP | GUNGNIR', price: 14.99, image: '/skins-steams/AWP_GUNGNIR.png', category: 'skin', type: 'weapon', description: 'Легендарная снайперская винтовка с мифологическим дизайном.' },
    { id: 'skin-deagle-fenek', name: 'Desert Eagle | Фенек', price: 9.99, image: '/skins-steams/Desert-Eagle-Fennec.png', category: 'skin', type: 'weapon', description: 'Мощный пистолет с ярким дизайном пустынной лисы.' },
    { id: 'skin-karambit-gradient', name: 'Керамбит | Градиент', price: 19.99, image: '/skins-steams/kerambit-gradient.png', category: 'skin', type: 'weapon', description: 'Популярный нож с плавным градиентом.' },
    { id: 'skin-negev-tra-ta-ta', name: 'Negev | Тра-та-та', price: 4.99, image: '/skins-steams/NEGEV-TRA-TA-TA.png', category: 'skin', type: 'weapon', description: 'Пулемёт с весёлым дизайном.' },
    { id: 'skin-pp-bizon-anubis', name: 'PP-Bizon | Сын Анубиса', price: 5.99, image: '/skins-steams/PP-Bizon-Judgement-of-Anubis.png', category: 'skin', type: 'weapon', description: 'Пулемёт с египетской тематикой.' },
    { id: 'skin-sawedoff-kraken', name: 'Sawed-Off | Кракен', price: 3.99, image: '/skins-steams/Sawed-Off-Kraken.png', category: 'skin', type: 'weapon', description: 'Обрез с морской тематикой.' },
    { id: 'skin-sport-gloves-butcher', name: 'Спортивные перчатки | Мясник', price: 24.99, image: '/skins-steams/myasnik.png', category: 'skin', type: 'armor', description: 'Перчатки с брутальным дизайном.' },
    { id: 'skin-ak47-redline', name: 'AK-47 | Redline', price: 45.99, image: '/skins-steams/AK-47-Redline.png', category: 'skin', type: 'weapon', rarity: 'Classified', description: 'Узнаваемый АК-47 с красными полосами.' },
    { id: 'skin-awp-dragon-lore', name: 'AWP | Dragon Lore', price: 2499.99, image: '/skins-steams/AWP_DRAGONLORE.png', category: 'skin', type: 'weapon', rarity: 'Covert', description: 'Редкий и дорогой скин AWP.' },
    { id: 'skin-karambit-fade', name: 'Karambit | Fade', price: 899.99, image: '/skins-steams/kerambit-gradient.png', category: 'skin', type: 'weapon', rarity: '★ Covert', description: 'Нож с градиентной окраской.' },
    // Дополнительные скины (1-15)
    { id: 'skin-m4a4-asimov', name: 'M4A4 | Asiimov', price: 89.99, image: '/skins-steams/M4A4-Asiimov.png', category: 'skin', type: 'weapon', rarity: 'Classified', description: 'Футуристический дизайн M4A4.' },
    { id: 'skin-ak47-fire-serpent', name: 'AK-47 | Fire Serpent', price: 699.99, image: '/skins-steams/AK-47-Fire-Serpent.png', category: 'skin', type: 'weapon', rarity: 'Covert', description: 'Легендарный скин с огненным драконом. Один из самых желанных скинов в CS2. Уникальный дизайн с изображением огненного змея привлекает внимание всех игроков. Редкость Covert делает его особенно ценным коллекционным предметом.' },
    { id: 'skin-awp-medusa', name: 'AWP | Medusa', price: 1999.99, image: '/skins-steams/AWP_MEDUSA.png', category: 'skin', type: 'weapon', rarity: 'Covert', description: 'Редчайший скин с Медузой.' },
    { id: 'skin-m4a1s-knight', name: 'M4A1-S | Knight', price: 149.99, image: '/skins-steams/M4A1-S-Knight.png', category: 'skin', type: 'weapon', rarity: 'Classified', description: 'Рыцарский дизайн M4A1-S.' },
    { id: 'skin-glock-fade', name: 'Glock-18 | Fade', price: 499.99, image: '/skins-steams/Glock-18-Fade.png', category: 'skin', type: 'weapon', rarity: 'Covert', description: 'Редкий градиентный Glock-18.' },
    { id: 'skin-usps-kill-confirmed', name: 'USP-S | Kill Confirmed', price: 129.99, image: '/skins-steams/USP-S-Kill-Confirmed.png', category: 'skin', type: 'weapon', rarity: 'Classified', description: 'Тактический скин USP-S.' },
    { id: 'skin-ak47-vulcan', name: 'AK-47 | Vulcan', price: 179.99, image: '/skins-steams/AK-47-Vulcan.png', category: 'skin', type: 'weapon', rarity: 'Classified', description: 'Популярный скин AK-47 с вулканическим дизайном.' },
    { id: 'skin-deagle-blaze', name: 'Desert Eagle | Blaze', price: 349.99, image: '/skins-steams/Desert-Eagle-Blaze.png', category: 'skin', type: 'weapon', rarity: 'Covert', description: 'Огненный дизайн Desert Eagle.' },
    { id: 'skin-awp-oni-taji', name: 'AWP | Oni Taiji', price: 449.99, image: '/skins-steams/AWP_ONI_TAIJI.png', category: 'skin', type: 'weapon', rarity: 'Covert', description: 'Японский дизайн Oni Taiji.' },
    { id: 'skin-m4a4-howling-dawn', name: 'M4A4 | Howl', price: 1299.99, image: '/skins-steams/M4A4-Howl.png', category: 'skin', type: 'weapon', rarity: 'Contraband', description: 'Легендарный контрабандный скин.' },
    { id: 'skin-karambit-crimson-web', name: 'Karambit | Crimson Web', price: 749.99, image: '/skins-steams/Karambit-Crimson-Web.png', category: 'skin', type: 'weapon', rarity: 'Covert', description: 'Нож с паутиной.' },
    { id: 'skin-karambit-tiger-tooth', name: 'Karambit | Tiger Tooth', price: 849.99, image: '/skins-steams/Karambit-Tiger-Tooth.png', category: 'skin', type: 'weapon', rarity: '★ Covert', description: 'Нож с тигриным узором.' },
    { id: 'skin-ak47-jaguar', name: 'AK-47 | Jaguar', price: 79.99, image: '/skins-steams/AK-47-Jaguar.png', category: 'skin', type: 'weapon', rarity: 'Classified', description: 'АК-47 с ягуаром.' },
    { id: 'skin-m4a1s-icarus-fell', name: 'M4A1-S | Icarus Fell', price: 119.99, image: '/skins-steams/M4A1-S-Icarus-Fell.png', category: 'skin', type: 'weapon', rarity: 'Classified', description: 'Дизайн Икара на M4A1-S.' },
    { id: 'skin-awp-graphite', name: 'AWP | Graphite', price: 49.99, image: '/skins-steams/AWP-Graphite.png', category: 'skin', type: 'weapon', rarity: 'Restricted', description: 'Графитовый дизайн AWP.' },
    { id: 'skin-ak47-point-disarray', name: 'AK-47 | Point Disarray', price: 39.99, image: '/skins-steams/AK-47-Point-Disarray.png', category: 'skin', type: 'weapon', rarity: 'Restricted', description: 'Абстрактный дизайн на AK-47.' },
    // Дополнительные скины (16-35)
    { id: 'skin-m4a4-xray', name: 'M4A4 | X-Ray', price: 59.99, image: '/skins-steams/M4A4-X-Ray.png', category: 'skin', type: 'weapon', rarity: 'Restricted', description: 'Рентгеновский дизайн M4A4.' },
    { id: 'skin-ak47-wasteland-rebel', name: 'AK-47 | Wasteland Rebel', price: 69.99, image: '/skins-steams/AK-47-Wasteland.png', category: 'skin', type: 'weapon', rarity: 'Restricted', description: 'Постапокалиптический дизайн.' },
    { id: 'skin-awp-electric-hive', name: 'AWP | Electric Hive', price: 34.99, image: '/skins-steams/AWP-Electric-Hive.png', category: 'skin', type: 'weapon', rarity: 'Restricted', description: 'Электрический улей на AWP.' },
    { id: 'skin-m4a1s-hyper-beast', name: 'M4A1-S | Hyper Beast', price: 199.99, image: '/skins-steams/M4A1-S-Hyper-Beast.png', category: 'skin', type: 'weapon', rarity: 'Covert', description: 'Яркий звериный дизайн.' },
    { id: 'skin-ak47-hydroponic', name: 'AK-47 | Hydroponic', price: 159.99, image: '/skins-steams/AK-47-Hydroponic.png', category: 'skin', type: 'weapon', rarity: 'Classified', description: 'Гидропонный дизайн AK-47.' },
    { id: 'skin-deagle-crimson-web', name: 'Desert Eagle | Crimson Web', price: 89.99, image: '/skins-steams/Desert-Eagle-Crimson-Web.png', category: 'skin', type: 'weapon', rarity: 'Restricted', description: 'Паутина на Desert Eagle.' },
    { id: 'skin-awp-boom', name: 'AWP | BOOM', price: 24.99, image: '/skins-steams/AWP-BOOM.png', category: 'skin', type: 'weapon', rarity: 'Restricted', description: 'Взрывной дизайн AWP.' },
    { id: 'skin-m4a4-desolate-space', name: 'M4A4 | Desolate Space', price: 109.99, image: '/skins-steams/M4A4-Desolate-Space.png', category: 'skin', type: 'weapon', rarity: 'Classified', description: 'Космический дизайн M4A4.' },
    { id: 'skin-ak47-blue-laminate', name: 'AK-47 | Blue Laminate', price: 19.99, image: '/skins-steams/AK-47-Blue-Laminate.png', category: 'skin', type: 'weapon', rarity: 'Consumer', description: 'Синий ламинат на AK-47.' },
    { id: 'skin-m4a1s-master-piece', name: 'M4A1-S | Master Piece', price: 299.99, image: '/skins-steams/M4A1-S-Master-Piece.png', category: 'skin', type: 'weapon', rarity: 'Covert', description: 'Шедевр на M4A1-S.' },
    { id: 'skin-awp-pink-ddp', name: 'AWP | Pink DDPAT', price: 29.99, image: '/skins-steams/AWP-Pink-DDPAT.png', category: 'skin', type: 'weapon', rarity: 'Restricted', description: 'Розовый камуфляж AWP.' },
    { id: 'skin-karambit-slaughter', name: 'Karambit | Slaughter', price: 599.99, image: '/skins-steams/Karambit-Slaughter.png', category: 'skin', type: 'weapon', rarity: 'Covert', description: 'Нож с резней.' },
    { id: 'skin-ak47-frontside-misty', name: 'AK-47 | Frontside Misty', price: 54.99, image: '/skins-steams/AK-47-Frontside-Misty.png', category: 'skin', type: 'weapon', rarity: 'Restricted', description: 'Туманный дизайн AK-47.' },
    { id: 'skin-m4a4-battle-star', name: 'M4A4 | Battle-Scarred', price: 14.99, image: '/skins-steams/M4A4-Tornado.png', category: 'skin', type: 'weapon', rarity: 'Consumer', description: 'Изношенный M4A4.' },
    { id: 'skin-awp-sun-in-leo', name: 'AWP | Sun in Leo', price: 64.99, image: '/skins-steams/AWP-Sun-in-Leo.png', category: 'skin', type: 'weapon', rarity: 'Restricted', description: 'Солнце во Льве на AWP.' },
    { id: 'skin-gloves-hydra-print', name: 'Hydra Gloves | Print', price: 199.99, image: '/skins-steams/Hydra-Gloves-Print.png', category: 'skin', type: 'gloves', rarity: 'Classified', description: 'Перчатки с принтом гидры.' },
    { id: 'skin-gloves-sport-superconductor', name: 'Sport Gloves | Superconductor', price: 349.99, image: '/skins-steams/Sport-Gloves-Superconductor.png', category: 'skin', type: 'gloves', rarity: 'Covert', description: 'Спортивные перчатки-сверхпроводник.' },
    { id: 'skin-gloves-moto-eclipse', name: 'Moto Gloves | Eclipse', price: 249.99, image: '/skins-steams/Moto-Gloves-Eclipse.png', category: 'skin', type: 'gloves', rarity: 'Classified', description: 'Мото перчатки с затмением.' },
    { id: 'skin-gloves-specialist-fade', name: 'Specialist Gloves | Fade', price: 549.99, image: '/skins-steams/Specialist-Gloves-Fade.png', category: 'skin', type: 'gloves', rarity: 'Covert', description: 'Специализированные перчатки с градиентом.' },
    { id: 'skin-gloves-hand-wraps-cobalt-skulls', name: 'Hand Wraps | Cobalt Skulls', price: 179.99, image: '/skins-steams/Hand-Wraps-Cobalt-Skulls.png', category: 'skin', type: 'gloves', rarity: 'Restricted', description: 'Бинты с кобальтовыми черепами.' },
    { id: 'skin-ak47-cartel', name: 'AK-47 | Cartel', price: 44.99, image: '/skins-steams/AK-47-Cartel.png', category: 'skin', type: 'weapon', rarity: 'Restricted', description: 'Картель на AK-47.' },
    { id: 'skin-m4a1s-cyrex', name: 'M4A1-S | Cyrex', price: 79.99, image: '/skins-steams/M4A1-S_Cyrex.png', category: 'skin', type: 'weapon', rarity: 'Classified', description: 'Футуристический Cyrex на M4A1-S.' },
    { id: 'skin-awp-redline', name: 'AWP | Redline', price: 19.99, image: '/skins-steams/AWP-Redline.png', category: 'skin', type: 'weapon', rarity: 'Restricted', description: 'Красная линия на AWP.' },
    { id: 'skin-karambit-marble-fade', name: 'Karambit | Marble Fade', price: 1049.99, image: '/skins-steams/Karambit-Marble-Fade.png', category: 'skin', type: 'weapon', rarity: '★ Covert', description: 'Мраморный градиент на ноже.' },
    { id: 'skin-ak47-neon-rider', name: 'AK-47 | Neon Rider', price: 94.99, image: '/skins-steams/AK-47-Neon-Rider.png', category: 'skin', type: 'weapon', rarity: 'Classified', description: 'Неоновый райдер на AK-47.' },
    { id: 'skin-m4a4-neo-noir', name: 'M4A4 | Neo-Noir', price: 139.99, image: '/skins-steams/M4A4-Neo-Noir.png', category: 'skin', type: 'weapon', rarity: 'Classified', description: 'Нео-нуар на M4A4.' },
    { id: 'skin-awp-fever-dream', name: 'AWP | Fever Dream', price: 54.99, image: '/skins-steams/AWP-Fever-Dream.png', category: 'skin', type: 'weapon', rarity: 'Restricted', description: 'Лихорадочный сон на AWP.' },
    { id: 'skin-deagle-conspiracy', name: 'Desert Eagle | Conspiracy', price: 64.99, image: '/skins-steams/Desert-Eagle-Conspiracy.png', category: 'skin', type: 'weapon', rarity: 'Restricted', description: 'Заговор на Desert Eagle.' },
    { id: 'skin-ak47-atomic-alloy', name: 'AK-47 | Atomic Alloy', price: 49.99, image: '/skins-steams/AK-47-Atomic-Alloy.png', category: 'skin', type: 'weapon', rarity: 'Restricted', description: 'Атомный сплав на AK-47.' },
    { id: 'skin-m4a1s-golden-coil', name: 'M4A1-S | Golden Coil', price: 169.99, image: '/skins-steams/M4A1-S-Golden-Coil.png', category: 'skin', type: 'weapon', rarity: 'Classified', description: 'Золотая катушка на M4A1-S.' },
    { id: 'skin-awp-worm-god', name: 'AWP | Worm God', price: 84.99, image: '/skins-steams/AWP-Worm-God.png', category: 'skin', type: 'weapon', rarity: 'Restricted', description: 'Бог червей на AWP.' },
    { id: 'skin-gloves-hand-wraps-leather', name: 'Hand Wraps | Leather', price: 99.99, image: '/skins-steams/Hand-Wraps-Leather.png', category: 'skin', type: 'gloves', rarity: 'Consumer', description: 'Кожаные бинты.' },
    { id: 'skin-gloves-driver-king-snake', name: 'Driver Gloves | King Snake', price: 129.99, image: '/skins-steams/Driver-Gloves-King-Snake.png', category: 'skin', type: 'gloves', rarity: 'Restricted', description: 'Перчатки водителя с королевской змеей.' },
    { id: 'skin-karambit-doppler', name: 'Karambit | Doppler', price: 949.99, image: '/skins-steams/Karambit-Doppler.png', category: 'skin', type: 'weapon', rarity: '★ Covert', description: 'Допплер на ноже.' },
    { id: 'skin-ak47-jet-set', name: 'AK-47 | Jet Set', price: 74.99, image: '/skins-steams/AK-47-Jet-Set.png', category: 'skin', type: 'weapon', rarity: 'Restricted', description: 'Реактивный набор на AK-47.' },
    { id: 'skin-m4a4-tornado', name: 'M4A4 | Tornado', price: 12.99, image: '/skins-steams/M4A4-Tornado.png', category: 'skin', type: 'weapon', rarity: 'Consumer', description: 'Торнадо на M4A4.' },
    { id: 'skin-awp-asiimov', name: 'AWP | Asiimov', price: 99.99, image: '/skins-steams/AWP-Asiimov.png', category: 'skin', type: 'weapon', rarity: 'Classified', description: 'Футуристический Asiimov на AWP.' },
    { id: 'skin-gloves-bloodhound-charred', name: 'Bloodhound Gloves | Charred', price: 279.99, image: '/skins-steams/Bloodhound-Gloves-Charred.png', category: 'skin', type: 'gloves', rarity: 'Classified', description: 'Обожженные перчатки ищейки.' },
    { id: 'skin-karambit-case-hardened', name: 'Karambit | Case Hardened', price: 649.99, image: '/skins-steams/Karambit_Case_Hardened.png', category: 'skin', type: 'weapon', rarity: 'Covert', description: 'Закаленный нож.' },
    { id: 'skin-ak47-aquamarine-revenge', name: 'AK-47 | Aquamarine Revenge', price: 69.99, image: '/skins-steams/AK-47-Aquamarine-Revenge.png', category: 'skin', type: 'weapon', rarity: 'Restricted', description: 'Аквамариновая месть на AK-47.' },
    { id: 'skin-m4a1s-decimator', name: 'M4A1-S | Decimator', price: 89.99, image: '/skins-steams/M4A1-S-Decimator.png', category: 'skin', type: 'weapon', rarity: 'Classified', description: 'Дециматор на M4A1-S.' },
    { id: 'skin-awp-paw', name: 'AWP | PAW', price: 39.99, image: '/skins-steams/AWP-PAW.png', category: 'skin', type: 'weapon', rarity: 'Restricted', description: 'Лапа на AWP.' },
    { id: 'skin-gloves-moto-pow', name: 'Moto Gloves | POW!', price: 219.99, image: '/skins-steams/Moto-Gloves-POW!.png', category: 'skin', type: 'gloves', rarity: 'Restricted', description: 'Мото перчатки POW!' },
    { id: 'skin-karambit-lore', name: 'Karambit | Lore', price: 1249.99, image: '/skins-steams/Karambit-Lore.png', category: 'skin', type: 'weapon', rarity: '★ Covert', description: 'Легенда на ноже.' },
    { id: 'skin-ak47-first-class', name: 'AK-47 | First Class', price: 59.99, image: '/skins-steams/AK-47-First-Class.png', category: 'skin', type: 'weapon', rarity: 'Restricted', description: 'Первый класс на AK-47.' },
    { id: 'skin-m4a4-daybreak', name: 'M4A4 | Daybreak', price: 119.99, image: '/skins-steams/M4A4-Daybreak.png', category: 'skin', type: 'weapon', rarity: 'Classified', description: 'Рассвет на M4A4.' },
    { id: 'skin-awp-mortis', name: 'AWP | Mortis', price: 44.99, image: '/skins-steams/AWP-Mortis.png', category: 'skin', type: 'weapon', rarity: 'Restricted', description: 'Мортис на AWP.' }
  ]
}
DATA.products = prepareProducts(DATA.products)
const SKIN_TYPES = new Set([
  'weapon',
  'armor',
  'gloves',
  'knife',
  'melee',
  'agent',
  'sticker',
  'patch',
  'collectible',
  'case',
  'music',
  'spray',
  'utility'
])

const isSkinProduct = (product) => {
  if (!product || product.category !== 'skin') return false
  const normalizedType = String(product.type || '').toLowerCase()
  return SKIN_TYPES.has(normalizedType)
}

const SKIN_IMAGE_TOKEN_BLACKLIST = new Set([
  'w-full',
  'h-full',
  'object-cover',
  'object-fill',
  'object-left',
  'object-right',
  'object-left-top',
  'object-right-top',
  'object-left-bottom',
  'object-right-bottom'
])

const computeProductImageClass = (product, baseClass = '') => {
  const rawTokens = (baseClass || '')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
  if (!isSkinProduct(product)) {
    const classes = [...rawTokens, 'object-cover', 'object-center']
    return classes
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  const sanitizedBase = rawTokens.filter((token) => !SKIN_IMAGE_TOKEN_BLACKLIST.has(token))
  const hasExplicitWidth = sanitizedBase.some((token) => /^w-/.test(token))
  const hasExplicitHeight = sanitizedBase.some((token) => /^h-/.test(token))
  const classes = [
    ...sanitizedBase,
    'object-contain',
    'object-center',
    'max-h-full',
    'max-w-full'
  ]
  if (!hasExplicitHeight) classes.push('h-auto')
  if (!hasExplicitWidth) classes.push('w-auto')
  return classes
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const computeProductWrapperClass = (product, baseClass = '') => {
  let sanitizedBase = baseClass || ''
  if (sanitizedBase) {
    const tokens = sanitizedBase.split(/\s+/).filter(Boolean)
    sanitizedBase = tokens
      .filter((token) => {
        if (!isSkinProduct(product)) return true
        if (token === 'absolute' || token === 'inset-0') return false
        if (token.startsWith('p-') || token.startsWith('px-') || token.startsWith('py-')) return false
        return true
      })
      .join(' ')
  }
  const classes = [sanitizedBase, 'flex items-center justify-center']
  if (isSkinProduct(product)) {
    classes.push('p-6 sm:p-8 lg:p-10')
  }
  return classes
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const StarsRow = ({ count = 5, className = '' }) => (
  <div className={`flex items-center gap-0.5 leading-none ${className}`}>
    {Array.from({ length: count }).map((_, idx) => (
      <span key={idx} className="text-yellow-400">★</span>
    ))}
  </div>
)

const renderRatingStars = (rating, className = '') => {
  return (
    <div className={`flex items-center gap-1 leading-none ${className}`}>
      {Array.from({ length: 5 }).map((_, i) => {
        let color = 'text-gray-600'
        if (i < Math.floor(rating)) {
          color = 'text-yellow-400'
        } else if (i === Math.floor(rating) && rating % 1 !== 0) {
          color = 'text-yellow-400 opacity-50'
        }
        return (
          <span key={i} className={color}>
            ★
          </span>
        )
      })}
    </div>
  )
}

const REVIEW_AUTHORS = [
  'Алексей М.',
  'Мария С.',
  'Дмитрий К.',
  'Ирина В.',
  'Сергей П.',
  'Екатерина Л.',
  'Николай Ж.',
  'Ольга Б.',
  'Владислав Т.',
  'Анна Р.',
  'Георгий Н.',
  'Полина К.',
  'Вера П.',
  'Максим Б.',
  'Кирилл Т.',
  'Саша Л.',
  'Илья Р.',
  'Анастасия Ч.'
]

const REVIEW_NICKNAMES = [
  'ShadowFox',
  'NoobMaster99',
  'L33tPlayer',
  'svatosplay',
  'CYBERWOLF',
  'Mira_owl',
  'RetroGamer',
  'Artemis88',
  'xXNightHawkXx',
  'FrostByte',
  'Hikari',
  'ZenMaster'
]

const REVIEW_TEMPLATES = [
  (name) => `Получил ${name} буквально через несколько минут. Всё активировалось без ошибок, сервис сработал идеально.`,
  (name) => `${name} полностью оправдал ожидания. Приятно, что менеджер уточнил детали и подсказал самые выгодные варианты.`,
  (name) => `Отличное впечатление от покупки ${name}. Цена ниже, чем в других магазинах, оплата и получение заняли меньше пяти минут.`,
  (name) => `Выбрал ${name} по совету поддержки — не пожалел. Всё честно, быстро и с подробной инструкцией.`,
  (name) => `Уже второй раз беру здесь ${name}. Работает стабильно, никаких блокировок или проблем с аккаунтом.`,
  (name) => `Хорошая экономия на ${name}. Порадовало, что в комплекте дали бонус и подсказки по установке.`
]

const REVIEW_STORAGE_VERSION = '2'
const REVIEW_STORAGE_AUTO_TAG = `auto:${REVIEW_STORAGE_VERSION}`
const REVIEW_STORAGE_USER_TAG = 'user'

function getDeterministicReviewCount(product) {
  if (!product) return 0
  const key =
    normalizeProductKey(product) ||
    String(product.id || product.name || '').trim().toLowerCase()
  if (!key) return 0
  const hash = Math.abs(hashString(`${key}|review-count`))
  const bucket = hash % 100
  if (bucket < 65) return 0
  if (bucket < 85) return 1
  if (bucket < 95) return 2
  return 3
}

function pickReviewAuthor(seed) {
  const useNickname = seed % 4 === 0
  if (useNickname) {
    return REVIEW_NICKNAMES[seed % REVIEW_NICKNAMES.length]
  }
  const author = REVIEW_AUTHORS[seed % REVIEW_AUTHORS.length]
  if (seed % 5 === 0) {
    const alias = REVIEW_NICKNAMES[(seed + 7) % REVIEW_NICKNAMES.length]
    return `${author} (${alias})`
  }
  return author
}

function buildReviewDate(seed, index = 0) {
  const now = new Date()
  const monthOffset = (seed % 6) + Math.floor(index / 2)
  now.setHours(12, 0, 0, 0)
  now.setMonth(now.getMonth() - monthOffset)
  const dayOffset = (seed % 21) + index * 5
  now.setDate(Math.max(1, now.getDate() - dayOffset))
  return now.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

function createDefaultReviews(product) {
  if (!product) return []
  const baseSeed = Math.abs(hashString(product.id || product.name || 'product'))
  const productName = product.name || 'товар'
  const reviewCount = getDeterministicReviewCount(product)

  if (reviewCount <= 0) return []

  return Array.from({ length: reviewCount }).map((_, index) => {
    const seed = baseSeed + index * 197
    const author = pickReviewAuthor(seed)
    const template = REVIEW_TEMPLATES[seed % REVIEW_TEMPLATES.length]
    const ratingRaw = 4 + (seed % 4) * 0.5
    const rating = Math.min(5, Math.max(3.5, ratingRaw))
    const formattedDate = buildReviewDate(seed, index)

    return {
      author,
      rating,
      text: template(productName),
      date: formattedDate
    }
  })
}
// Компонент профиля пользователя
function Profile() {
  const [name, setName] = React.useState(() => localStorage.getItem('profile-name') || '')
  const [avatar, setAvatar] = React.useState(() => localStorage.getItem('profile-avatar') || '😄')
  const [authorized, setAuthorized] = React.useState(() => hasValidAuthSession())
  const avatars = ['😄','😎','🤖','🎮','🔥','🎉']
  const navigate = useNavigate()
  const [photo, setPhoto] = React.useState(() => localStorage.getItem('profile-photo') || '')
  const [steamidState, setSteamidState] = React.useState(() => localStorage.getItem('steamid') || '')
  const [authMethod, setAuthMethod] = React.useState(() => localStorage.getItem('auth-method') || '')
  const hasSteamRedirectRef = React.useRef(false)
  const isAdmin = React.useMemo(() => localStorage.getItem('role') === 'admin', [authorized])

  const syncSteamSession = React.useCallback((payload = {}) => {
    const provider = payload.provider || (payload.steamId ? 'steam' : payload.email ? 'local' : 'steam')
    const displayName = payload.displayName || payload.personaname || payload.email || ''
    const avatarUrl = payload.photo || payload.avatar || payload.personaavatar || ''
    const steamIdValue = provider === 'steam' ? (payload.steamId || payload.id || '') : ''
    try {
      if (provider === 'steam') {
        localStorage.setItem('steam-connected', 'true')
      } else {
        localStorage.removeItem('steam-connected')
      }
      localStorage.setItem(AUTH_FLAG_KEY, '1')
      localStorage.setItem('auth-method', provider)
      localStorage.setItem('role', payload.role || 'user')
      const expiresAt = Date.now() + AUTH_SESSION_MS
      localStorage.setItem(AUTH_EXPIRY_KEY, String(expiresAt))
      if (displayName) {
        localStorage.setItem('profile-name', displayName)
        setName(displayName)
      }
      if (avatarUrl) {
        localStorage.setItem('profile-photo', avatarUrl)
        localStorage.setItem('profile-avatar', avatarUrl)
      } else {
        localStorage.removeItem('profile-photo')
        if (!localStorage.getItem('profile-avatar')) {
          localStorage.setItem('profile-avatar', '😄')
        }
      }
      if (payload.email) {
        localStorage.setItem('profile-email', payload.email)
      } else {
        localStorage.removeItem('profile-email')
      }
      if (steamIdValue) {
        localStorage.setItem('steamid', steamIdValue)
        setSteamidState(steamIdValue)
      } else {
        localStorage.removeItem('steamid')
        setSteamidState('')
      }
    } catch {
      // ignore storage issues
    }
    setPhoto(avatarUrl || '')
    const storedAvatar = avatarUrl || localStorage.getItem('profile-avatar') || '😄'
    setAvatar(storedAvatar)
    extendAuthSession()
    setAuthorized(true)
    setAuthMethod(provider)
    window.dispatchEvent(new Event('storage'))
  }, [])

  const fetchAuthStatus = React.useCallback(async () => {
    try {
      const response = await fetch(buildAuthUrl('/auth/status'), { credentials: 'include' })
      if (!response.ok) {
        throw new Error(`Status ${response.status}`)
      }
      const data = await response.json()
      if (data?.ok) {
        syncSteamSession(data)
        return data
      }
    } catch (error) {
      console.warn('[Profile] auth status error', error?.message)
    }
    return null
  }, [syncSteamSession])

  const completeSteamRedirect = React.useCallback(() => {
    let target = '/profile'
    try {
      const stored = localStorage.getItem('steam-auth-redirect')
      if (stored && stored.startsWith('/')) {
        target = stored
      }
      localStorage.removeItem('steam-auth-redirect')
    } catch {
      // ignore storage issues
    }
    if (!hasSteamRedirectRef.current) {
      hasSteamRedirectRef.current = true
      navigate(target, { replace: true })
      window.history.replaceState({}, document.title, target)
    }
  }, [navigate])

  const startSteamLogin = React.useCallback(() => {
    hasSteamRedirectRef.current = false
    const currentPath = window.location.pathname + window.location.search + window.location.hash
    const redirectTarget = currentPath && currentPath.startsWith('/') ? currentPath : '/profile'
    try {
      localStorage.setItem('steam-auth-redirect', redirectTarget)
    } catch {
      // ignore storage issues
    }
    const authUrl = buildAuthUrl(
      `/auth/steam?origin=${encodeURIComponent(window.location.origin)}&redirect=${encodeURIComponent(redirectTarget)}`
    )
    const popup = window.open(authUrl, 'steam-login', 'width=800,height=650')
    if (!popup) {
      window.location.href = authUrl
      return
    }
    const timer = setInterval(() => {
      if (popup.closed) {
        clearInterval(timer)
        fetchAuthStatus().then((data) => {
          if (data?.ok) {
            completeSteamRedirect()
          }
        })
      }
    }, 800)
  }, [fetchAuthStatus, completeSteamRedirect])

  React.useEffect(() => {
    fetchAuthStatus()
  }, [fetchAuthStatus])

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('login') === 'steam') {
      fetchAuthStatus().then((data) => {
        if (data?.ok) {
          if (closeSteamPopupIfNeeded()) {
            return
          }
          completeSteamRedirect()
        } else {
          window.history.replaceState({}, document.title, window.location.pathname + window.location.hash)
        }
      })
    }
  }, [fetchAuthStatus, completeSteamRedirect])

  React.useEffect(() => { localStorage.setItem('profile-name', name) }, [name])
  React.useEffect(() => { localStorage.setItem('profile-avatar', avatar) }, [avatar])
  React.useEffect(() => {
    if (authorized) {
      try { localStorage.setItem(AUTH_FLAG_KEY, '1') } catch { /* ignore */ }
      extendAuthSession()
    } else {
      clearAuthSession()
    }
  }, [authorized])
  const [userStats, setUserStats] = React.useState(null)
  const [userOrders, setUserOrders] = React.useState([])
  const [loadingStats, setLoadingStats] = React.useState(true)
  const userEmail = React.useMemo(() => {
    try {
      return localStorage.getItem('profile-email') || ''
    } catch {
      return ''
    }
  }, [authorized, name])

  React.useEffect(() => {
    if (authorized && userEmail) {
      fetchUserData()
    } else {
      setLoadingStats(false)
    }
  }, [authorized, userEmail])

  const fetchUserData = async () => {
    try {
      setLoadingStats(true)
      const [statsRes, ordersRes] = await Promise.all([
        fetch(buildAuthUrl(`/api/user/stats?email=${encodeURIComponent(userEmail)}`), { credentials: 'include' }),
        fetch(buildAuthUrl(`/api/user/orders?email=${encodeURIComponent(userEmail)}`), { credentials: 'include' })
      ])

      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setUserStats(statsData.stats)
      }

      if (ordersRes.ok) {
        const ordersData = await ordersRes.json()
        setUserOrders(ordersData.orders || [])
      }
    } catch (error) {
      console.error('Error fetching user data:', error)
    } finally {
      setLoadingStats(false)
    }
  }

  const formatPrice = (value) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0
    }).format(value || 0)
  }

  const handleLogout = () => {
    setAuthorized(false)
    clearAuthSession()
    localStorage.removeItem('auth-method')
    localStorage.removeItem('steamid')
    localStorage.removeItem('profile-photo')
    localStorage.removeItem('profile-name')
    localStorage.removeItem('profile-email')
    localStorage.removeItem('role')
    localStorage.removeItem('roulette-inventory')
    localStorage.removeItem('wallet-history')
    localStorage.removeItem('wallet-usd')
    localStorage.removeItem('cart-items')
    localStorage.removeItem('steam-connected')
    setAuthMethod('')
    setSteamidState('')
    setPhoto('')
    setUserStats(null)
    setUserOrders([])
    window.dispatchEvent(new Event('inventory-updated'))
    window.dispatchEvent(new Event('wallet-updated'))
    window.dispatchEvent(new Event('cart-cleared'))
  }

  return (
    <section className="space-y-6">
          {authorized ? (
        <>
          {/* Profile Header */}
          <div className="bg-gradient-to-br from-[#1a1a1a] via-[#0f0f0f] to-[#1a1a1a] border border-[#333333] rounded-2xl p-8 shadow-xl">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              <div className="relative">
                {(() => {
                  // Проверяем валидность URL фото
                  const isValidPhoto = photo && (
                    photo.startsWith('http://') || 
                    photo.startsWith('https://') || 
                    photo.startsWith('/') ||
                    photo.startsWith('data:')
                  ) && !photo.includes('atic.com') && !photo.includes('steamcdn-a.akamaihd.net/atic.com')
                  
                  return isValidPhoto ? (
                    <img 
                      src={photo.startsWith('http') ? photo : (photo.startsWith('//') ? `https:${photo}` : photo)} 
                      alt="Avatar" 
                      className="w-24 h-24 rounded-full border-4 border-green-500/30 shadow-lg object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none'
                        const fallback = e.target.nextElementSibling
                        if (fallback) {
                          fallback.style.display = 'flex'
                        }
                        // Очищаем невалидный URL из localStorage
                        try {
                          localStorage.removeItem('profile-photo')
                        } catch {}
                      }}
                    />
                  ) : null
                })()}
                <div className="w-24 h-24 rounded-full border-4 border-green-500/30 bg-gradient-to-br from-green-500/20 to-green-600/10 flex items-center justify-center text-4xl shadow-lg" style={{ display: (photo && (photo.startsWith('http://') || photo.startsWith('https://') || photo.startsWith('/') || photo.startsWith('data:')) && !photo.includes('atic.com') && !photo.includes('steamcdn-a.akamaihd.net/atic.com')) ? 'none' : 'flex' }}>
                  <span>{avatar || '😄'}</span>
                </div>
              {authMethod === 'steam' && (
                  <div className="absolute -bottom-1 -right-1 bg-[#1b2838] border-2 border-[#0C0C0C] rounded-full p-1.5">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
                    </svg>
                </div>
              )}
            </div>
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-white mb-2">{name || 'Пользователь'}</h1>
                <div className="flex flex-wrap items-center gap-4 text-white/60 text-sm">
                  {authMethod === 'steam' && (
                    <>
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                        Steam аккаунт
                      </span>
                      {steamidState && (
                        <span>SteamID: {steamidState}</span>
                      )}
                    </>
                  )}
                  {userEmail && (
                    <span>{userEmail}</span>
                  )}
            </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                {isAdmin && (
                  <NavLink
                    to="/admin"
                    className="px-6 py-3 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-400 rounded-xl transition-colors font-semibold flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    Админка
                  </NavLink>
                )}
                <button
                  onClick={handleLogout}
                  className="px-6 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 rounded-xl transition-colors font-semibold"
                >
                  Выйти
                </button>
              </div>
            </div>
        </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <span className="text-xl">📦</span>
            </div>
                <div className="text-white/60 text-sm">Всего заказов</div>
              </div>
              <div className="text-3xl font-bold text-green-400">
                {loadingStats ? '...' : (userStats?.totalOrders || 0)}
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <span className="text-xl">✅</span>
                </div>
                <div className="text-white/60 text-sm">Выполнено</div>
              </div>
              <div className="text-3xl font-bold text-blue-400">
                {loadingStats ? '...' : (userStats?.completedOrders || 0)}
              </div>
            </div>

            <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border border-yellow-500/20 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                  <span className="text-xl">⏳</span>
                </div>
                <div className="text-white/60 text-sm">В обработке</div>
              </div>
              <div className="text-3xl font-bold text-yellow-400">
                {loadingStats ? '...' : (userStats?.pendingOrders || 0)}
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <span className="text-xl">💰</span>
                </div>
                <div className="text-white/60 text-sm">Потрачено</div>
              </div>
              <div className="text-3xl font-bold text-purple-400">
                {loadingStats ? '...' : formatPrice(userStats?.totalSpent || 0)}
              </div>
            </div>
          </div>

          {/* Orders History */}
          <div className="bg-[#1a1a1a] border border-[#333333] rounded-xl p-6">
            <h2 className="text-2xl font-bold text-white mb-6">История заказов</h2>
            {loadingStats ? (
              <div className="text-center py-8 text-white/60">Загрузка...</div>
            ) : userOrders.length > 0 ? (
              <div className="space-y-4">
                {userOrders.map((order) => (
                  <div
                    key={order.id}
                    className="bg-[#0C0C0C] border border-[#333333] rounded-lg p-5 hover:border-green-500/30 transition-colors"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-white font-bold text-lg">#{order.orderId}</span>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              order.status === 'completed'
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                : order.status === 'processing'
                                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                            }`}
                          >
                            {order.status === 'completed' ? 'Выполнен' : order.status === 'processing' ? 'В обработке' : order.status}
                          </span>
                        </div>
                        <div className="text-white/60 text-sm mb-1">
                          {order.itemsCount || 0} товар(ов)
                        </div>
                        <div className="text-white/40 text-xs">
                          {order.createdAt ? new Date(order.createdAt).toLocaleString('ru-RU', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : ''}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-green-400 mb-1">
                          {formatPrice(order.totalAmount)}
                        </div>
                        <div className="text-white/40 text-xs">{order.currency || 'RUB'}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📦</div>
                <p className="text-white/60 text-lg mb-2">У вас пока нет заказов</p>
                <NavLink
                  to="/"
                  className="inline-block px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold transition-colors"
                >
                  Перейти в каталог
                </NavLink>
          </div>
        )}
       </div>
        </>
      ) : (
        <div className="bg-gradient-to-br from-[#1a1a1a] via-[#0f0f0f] to-[#1a1a1a] border border-[#333333] rounded-2xl p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="text-6xl mb-6">🔐</div>
            <h2 className="text-3xl font-bold text-white mb-4">Войдите в аккаунт</h2>
            <p className="text-white/60 mb-8">
              Войдите через Steam, чтобы получить доступ к вашему профилю, истории заказов и настройкам
            </p>
            <button
              onClick={startSteamLogin}
              className="px-8 py-4 bg-gradient-to-r from-[#1b2838] to-[#2a475e] hover:from-[#2a475e] hover:to-[#3a5a7e] text-white rounded-xl font-semibold transition-all transform hover:scale-105 shadow-lg"
            >
              Войти через Steam
            </button>
            <p className="text-white/40 text-sm mt-4">
              После входа через Steam ваш профиль будет сохранён на устройстве
            </p>
          </div>
        </div>
      )}

       <div className="bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f172a] rounded-3xl p-8 border border-white/10">
         <div className="text-center space-y-4 mb-8">
           <h3 className="text-3xl font-bold bg-gradient-to-r from-white via-blue-200 to-purple-200 bg-clip-text text-transparent">

           </h3>
           <p className="text-white/70">

           </p>
         </div>

         <form className="max-w-2xl mx-auto space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

             <div className="space-y-2">
              <label className="block text-sm font-medium text-white/80">Имя и фамилия</label>
               <input
                 type="text"
                 placeholder="ведите имя и фамилию"
                 className="w-full px-4 py-3 bg-[#0f172a] border border-white/20 rounded-xl text-white placeholder-white/50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                 required
               />
             </div>

             <div className="space-y-2">
              <label className="block text-sm font-medium text-white/80">Оценка</label>
               <div className="flex gap-2">
                 {[1, 2, 3, 4, 5].map((star) => (
                   <button
                     key={star}
                     type="button"
                     className="text-2xl text-white/30 hover:text-yellow-400 transition-colors focus:text-yellow-400"
                     onClick={(e) => {
                       const stars = e.target.parentElement.children
                       for (let i = 0; i < stars.length; i++) {
                         stars[i].classList.toggle('text-yellow-400', i < star)
                         stars[i].classList.toggle('text-white/30', i >= star)
                       }
                     }}
                   >
                    ★
                   </button>
                 ))}
               </div>
             </div>
           </div>

           <div className="space-y-2">
            <label className="block text-sm font-medium text-white/80">Ваш отзыв</label>
             <textarea
              placeholder="Напишите ваш отзыв..."
               rows="5"
               className="w-full px-4 py-3 bg-[#0f172a] border border-white/20 rounded-xl text-white placeholder-white/50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all resize-none"
               required
             ></textarea>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="space-y-2">
              <label className="block text-sm font-medium text-white/80">Игра (опционально)
               </label>
               <select className="w-full px-4 py-3 bg-[#0f172a] border border-white/20 rounded-xl text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all">
                <option value="">Выберите игру</option>
                 <option value="cs2">Counter-Strike 2</option>
                 <option value="dota2">Dota 2</option>
                 <option value="rust">Rust</option>
                 <option value="tf2">Team Fortress 2</option>
               </select>
             </div>

             <div className="space-y-2">
              <label className="block text-sm font-medium text-white/80">Бюджет (опционально)
               </label>
               <input
                 type="number"
                 placeholder="0.00"
                 min="0"
                 step="0.01"
                 className="w-full px-4 py-3 bg-[#0f172a] border border-white/20 rounded-xl text-white placeholder-white/50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
               />
             </div>
           </div>
           <div className="flex items-start gap-3">
             <input
               type="checkbox"
               id="review-consent"
               className="mt-1 w-4 h-4 text-blue-600 bg-[#0f172a] border-white/20 rounded focus:ring-blue-500 focus:ring-2"
               required
             />
             <label htmlFor="review-consent" className="text-sm text-white/70">
              Я соглашаюсь с <a href="#" className="text-blue-400 hover:text-blue-300">правилами публикации</a> и обработкой персональных данных
             </label>
           </div>

           <div className="text-center">
             <button
               type="submit"
               className="group relative px-8 py-4 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-500 hover:via-purple-500 hover:to-pink-500 rounded-xl font-bold text-white transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/25 min-w-[200px]"
             >
              <span className="relative z-10">Отправить отзыв</span>
               <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-pink-400 rounded-xl blur opacity-0 group-hover:opacity-30 transition-opacity duration-300"></div>
             </button>
           </div>
         </form>
       </div>

       {/* Инвентарь рулетки */}
       <div className="bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f172a] rounded-3xl p-8 border border-white/10">
         <h3 className="text-2xl font-bold mb-4">Инвентарь рулетки</h3>
         <InventorySection />
       </div>
     </section>
   )
}

// Компонент инвентаря
function InventorySection() {
  const [inventory, setInventory] = React.useState([])
  const [purchaseHistory, setPurchaseHistory] = React.useState([])
  const { formatPrice } = useLang()
  const navigate = useNavigate()
  
  // Проверка наличия покупок
  const checkPurchases = () => {
    try {
      const history = JSON.parse(localStorage.getItem('wallet-history') || '[]')
      return history.some(item => item.type === 'purchase' || item.type === 'buy')
    } catch {
      return false
    }
  }
  
  const [hasPurchases, setHasPurchases] = React.useState(checkPurchases)
  
  // Загрузка инвентаря
  React.useEffect(() => {
    const loadInventory = () => {
      try {
        const inv = JSON.parse(localStorage.getItem('roulette-inventory') || '[]')
        setInventory(inv)
      } catch {
        setInventory([])
      }
    }
    
    const updatePurchases = () => {
      setHasPurchases(checkPurchases())
    }
    
    loadInventory()
    updatePurchases()
    
    window.addEventListener('inventory-updated', loadInventory)
    window.addEventListener('purchase-completed', updatePurchases)
    return () => {
      window.removeEventListener('inventory-updated', loadInventory)
      window.removeEventListener('purchase-completed', updatePurchases)
    }
  }, [])
  
  // Получение предмета из инвентаря (после покупки)
  const obtainItem = (itemId) => {
    if (!hasPurchases) {
      alert('Для получения предмета необходимо совершить покупку на сайте!')
      navigate('/store')
      return
    }
    
    try {
      let inv = JSON.parse(localStorage.getItem('roulette-inventory') || '[]')
      inv = inv.map(item => 
        item.id === itemId ? { ...item, obtained: true, obtainedAt: Date.now() } : item
      )
      localStorage.setItem('roulette-inventory', JSON.stringify(inv))
      setInventory(inv)
      alert('Предмет получен!')
    } catch (e) {
      console.error('Error obtaining item:', e)
    }
  }
  
  const getRarityClasses = (rarity) => {
    switch (String(rarity || '').toLowerCase()) {
      case 'covert':
        return 'bg-red-600 text-white'
      case 'classified':
        return 'bg-pink-600 text-white'
      case 'restricted':
        return 'bg-purple-600 text-white'
      case 'mil-spec':
        return 'bg-blue-600 text-white'
      case 'consumer grade':
      case 'consumer':
        return 'bg-gray-600 text-white'
      default:
        return 'bg-[#0D1A2F] text-white/70 border border-white/10'
    }
  }
  
  if (inventory.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-white/60 mb-4">Инвентарь пуст</p>
        <div className="space-y-3">
          <p className="text-sm text-white/50">
            Предметы попадают в инвентарь из двух источников:
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <NavLink to="/roulette" className="inline-block px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors">
              🎰 Крутить рулетку
            </NavLink>
            <NavLink to="/store" className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
              🛒 Купить скины
            </NavLink>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-4">
      <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-4 mb-4">
        <p className="text-blue-300 text-sm mb-2">
          ℹ️ <strong>Откуда берутся предметы:</strong>
        </p>
        <ul className="text-sm text-white/80 space-y-1 ml-6 list-disc">
          <li>🎰 <strong>Рулетка</strong> - выигранные скины (требуют покупки для получения)</li>
          <li>🛒 <strong>Покупка</strong> - купленные скины сразу попадают в инвентарь</li>
        </ul>
      </div>
      
      {!hasPurchases && inventory.some(item => !item.obtained) && (
        <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4 mb-4">
          <p className="text-yellow-300 text-sm">
            ⚠️ Для получения выигранных предметов необходимо совершить покупку на сайте.
          </p>
          <NavLink to="/store" className="inline-block mt-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm transition-colors">
            Перейти в магазин
          </NavLink>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full max-w-full justify-items-center">
        {inventory.map(item => (
          <div 
            key={item.id} 
            className={`bg-[#161f38] rounded-lg overflow-hidden border transition-colors w-full max-w-full ${
              item.obtained 
                ? 'border-green-500/50' 
                : hasPurchases 
                  ? 'border-blue-500/50 hover:border-blue-500' 
                  : 'border-white/10 opacity-60'
            }`}
          >
            <div className="relative aspect-square">
              <LazyImage
                src={item.image}
                alt={item.name}
                className={computeProductImageClass(item, 'w-full h-full')}
                wrapperClassName={computeProductWrapperClass(item, 'absolute inset-0')}
              />
              {item.rarity && (
                <span className={`absolute top-2 left-2 px-2 py-1 rounded text-xs ${getRarityClasses(item.rarity)}`}>
                  {item.rarity}
                </span>
              )}
              {item.obtained && (
                <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
                  ✓ Получено
                </div>
              )}
            </div>
            <div className="p-3">
              <h4 className="text-sm font-medium text-white/90 truncate">{item.name}</h4>
              <p className="text-xs text-white/60 mt-1">{formatPrice(roundToSteamPrice(item.price))}</p>
              
              {/* Ключ активации для игр */}
              {item.obtained && item.activationKey && (
                <div className="mt-2 p-2 bg-blue-500/20 border border-blue-500/50 rounded text-xs">
                  <p className="text-blue-300 font-medium mb-1">🎮 Ключ активации:</p>
                  <div className="bg-[#0D1A2F] p-2 rounded font-mono text-center font-bold text-blue-400 border border-blue-500/30 break-all">
                    {item.activationKey}
                  </div>
                  <p className="text-white/60 text-xs mt-1">
                    Активируйте в Steam: Игры → Активировать продукт Steam
                  </p>
                </div>
              )}
              
              {/* Инструкции по доставке для скинов */}
              {item.obtained && item.deliveryMethod === 'steam_inventory' && (
                <div className="mt-2 p-2 bg-yellow-500/20 border border-yellow-500/50 rounded text-xs">
                  <p className="text-yellow-300 text-xs">
                    📦 Отправка в Steam инвентарь в течение 24 часов
                  </p>
                </div>
              )}
              
              {!item.obtained && (
                <button
                  onClick={() => obtainItem(item.id)}
                  disabled={!hasPurchases}
                  className={`w-full mt-2 px-3 py-1 rounded text-xs transition-colors ${
                    hasPurchases
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-gray-600 cursor-not-allowed'
                  }`}
                >
                  {hasPurchases ? 'Получить' : 'Требуется покупка'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
// 
function Checkout() {
  const { items, totalPrice, baseTotalPrice, discount, discountPercent, clear } = useCart()
  const { formatPrice, currency, toAmountInCurrency } = useLang()
  const [acquirerConnected, setAcquirerConnected] = React.useState(() => localStorage.getItem('acquirer') === '1')
  React.useEffect(() => { localStorage.setItem('acquirer', acquirerConnected ? '1' : '0') }, [acquirerConnected])
  const [orderId] = React.useState(() => `ORD-${Date.now()}`)
  const [status, setStatus] = React.useState('waiting')
  const [email, setEmail] = React.useState('')
  const [emailError, setEmailError] = React.useState('')
  const [showPaymentWidget, setShowPaymentWidget] = React.useState(false)
  const [agreedToOffer, setAgreedToOffer] = React.useState(false)
  const amountInCurr = toAmountInCurrency(totalPrice)
  
  // Логирование изменений состояния
  React.useEffect(() => {
    console.log('[Checkout] showPaymentWidget changed:', showPaymentWidget)
  }, [showPaymentWidget])
  const dataStr = `aigame://pay?order=${orderId}&amount=${amountInCurr.toFixed(2)}&currency=${currency}`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(dataStr)}`

  // Убрали автоматическую установку статуса 'paid' для ручного тестирования

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const submitOrderRecord = React.useCallback(async (payload) => {
    try {
      await fetch(buildAuthUrl('/api/orders'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      })
    } catch (error) {
      console.warn('[Checkout] submit order error', error?.message)
    }
  }, [])

  const handleEmailChange = (e) => {
    const value = e.target.value
    setEmail(value)
    if (value && !validateEmail(value)) {
      setEmailError('')
    } else {
      setEmailError('')
    }
  }

  const markPaid = async () => {
    if (!email || !validateEmail(email)) {
      setEmailError('')
      return
    }
    setStatus('paid')
    const userName = localStorage.getItem('profile-name') || ''
    const game = items && items.length > 0 ? (items[0].type || 'cs2') : 'cs2'
    // Собираем информацию о товарах с их типами и ключами активации
    const itemsWithDetails = items.map((item, index) => {
      const itemData = {
        name: item.name,
        price: item.price,
        quality: item.quality,
        category: item.category,
        type: item.type
      }
      
      // Если это игра, добавляем ключ активации (будет сгенерирован ниже)
      if (item.category === 'game') {
        itemData.deliveryMethod = 'activation_key'
        itemData.deliveryInstructions = 'Ключ активации будет отправлен в этом письме'
      } else if (item.category === 'skin') {
        itemData.deliveryMethod = 'steam_inventory'
        itemData.deliveryInstructions = 'Скин будет отправлен в ваш Steam инвентарь в течение 24 часов'
      }
      
      return itemData
    })
    
    const orderData = {
      userEmail: email,
      userName,
      items: itemsWithDetails,
      totalAmount: totalPrice,
      baseTotalAmount: baseTotalPrice,
      discount: discount,
      discountPercent: discountPercent,
      orderId,
      game,
      currency,
      paymentMethod: acquirerConnected ? 'qr' : 'manual',
      paymentStatus: 'paid',
      createdAt: new Date().toISOString()
    }
    // Сохранение покупки в историю для инвентаря
    try {
      let history = []
      try {
        history = JSON.parse(localStorage.getItem('wallet-history') || '[]')
      } catch {}
      
      const purchaseRecord = {
        id: `purchase-${Date.now()}`,
        type: 'purchase',
        orderId,
        amountUsd: totalPrice,
        baseAmount: baseTotalPrice,
        discount: discount,
        discountPercent: discountPercent,
        items: items.map(i => ({ name: i.name, price: i.price })),
        email,
        ts: Date.now()
      }
      
      history.push(purchaseRecord)
      localStorage.setItem('wallet-history', JSON.stringify(history))
      
      // Генерируем ключи активации для игр и добавляем товары в инвентарь
      const generateActivationKey = () => {
        // Генерация ключа в формате XXXX-XXXX-XXXX-XXXX
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
        const segments = []
        for (let i = 0; i < 4; i++) {
          let segment = ''
          for (let j = 0; j < 4; j++) {
            segment += chars.charAt(Math.floor(Math.random() * chars.length))
          }
          segments.push(segment)
        }
        return segments.join('-')
      }
      
      try {
        let inventory = []
        try {
          inventory = JSON.parse(localStorage.getItem('roulette-inventory') || '[]')
        } catch {}
        
        // Обрабатываем каждый купленный товар
        const itemsWithKeys = []
        
        items.forEach((item, index) => {
          if (item.category === 'skin') {
            // Для скинов - добавляем в инвентарь
            const inventoryItem = {
              id: `purchase-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
              productId: item.id || item.productId,
              name: item.name,
              image: item.image || '/images/skins/AWP-GUNGNIR.png',
              price: item.price,
              rarity: item.rarity,
              purchasedAt: Date.now(),
              obtained: true,
              requiresPurchase: false,
              source: 'purchase',
              orderId: orderId,
              deliveryMethod: 'steam_inventory',
              deliveryInstructions: 'Скин будет отправлен в ваш Steam инвентарь в течение 24 часов. Проверьте свою торговую площадку Steam.'
            }
            inventory.push(inventoryItem)
            itemsWithKeys.push({ ...item, activationKey: null })
          } else if (item.category === 'game') {
            // Для игр - генерируем ключ активации
            const activationKey = generateActivationKey()
            const inventoryItem = {
              id: `purchase-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
              productId: item.id || item.productId,
              name: item.name,
              image: item.image || item.introImage,
              price: item.price,
              type: item.type,
              purchasedAt: Date.now(),
              obtained: true,
              requiresPurchase: false,
              source: 'purchase',
              orderId: orderId,
              activationKey: activationKey,
              deliveryMethod: 'activation_key',
              deliveryInstructions: `Ключ активации: ${activationKey}\n\nАктивация ключа:\n1. Откройте Steam\n2. Перейдите в "Игры" → "Активировать продукт Steam"\n3. Введите ключ активации\n4. Следуйте инструкциям для завершения активации`
            }
            inventory.push(inventoryItem)
            itemsWithKeys.push({ ...item, activationKey: activationKey })
          }
        })
        
        // Обновляем orderData с ключами активации
        orderData.items = itemsWithKeys.map(i => ({
          name: i.name,
          price: i.price,
          quality: i.quality,
          category: i.category,
          type: i.type,
          activationKey: i.activationKey || null
        }))
        
        localStorage.setItem('roulette-inventory', JSON.stringify(inventory))
        window.dispatchEvent(new Event('inventory-updated'))
      } catch (e) {
        console.error('Error adding items to inventory:', e)
      }
      
      window.dispatchEvent(new Event('purchase-completed'))
    } catch (e) {
      console.error('Error saving purchase:', e)
    }
    
    try {
      await submitOrderRecord(orderData)
      const res = await sendPurchaseEmail(orderData)
      console.log('Email sent:', res)
      clear()
    } catch (err) {
      console.error('Email error:', err)
    }
  }

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold">Профиль</h2>
      
      <div className="p-4 rounded-lg border border-white/10 bg-[#0D1A2F]">
        <label className="block text-sm font-medium text-white/80 mb-2">Email</label>
        <input
          type="email"
          value={email}
          onChange={handleEmailChange}
          placeholder="example@email.com"
          className="w-full px-3 py-2 rounded-md bg-[#161f38] border border-white/10 text-white placeholder-white/50 focus:border-blue-400 focus:outline-none"
          required
        />
        {emailError && (
          <p className="mt-1 text-sm text-red-400">{emailError}</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {acquirerConnected ? (
          <div className="p-4 rounded-lg border border-white/10 bg-[#0D1A2F] flex flex-col items-center">
            <img src={qrUrl} alt="" className="w-[220px] h-[220px] rounded bg-[#161f38]" />

          </div>
        ) : (
          <div className="p-4 rounded-lg border border-white/10 bg-[#0D1A2F]">

          </div>
        )}
        <div className="p-4 rounded-lg border border-white/10 bg-[#0D1A2F]">
          <h3 className="text-lg font-semibold mb-4">Детали заказа</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-white/80">
              <span>Товаров:</span>
              <span>{items.length}</span>
            </div>
            {discount > 0 && (
              <>
                <div className="flex justify-between text-white/80">
                  <span>Сумма без скидки:</span>
                  <span>{formatPrice(baseTotalPrice)}</span>
                </div>
                <div className="flex justify-between text-green-400 font-semibold">
                  <span>Скидка {discountPercent}%:</span>
                  <span>-{formatPrice(discount)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between text-xl font-bold border-t border-white/10 pt-2 mt-2">
              <span>Итого:</span>
              <span className="text-green-400">{formatPrice(totalPrice)}</span>
            </div>
          </div>
        </div>
        <div className="p-4 rounded-lg border border-white/10 bg-[#0D1A2F]">
          <h3 className="text-lg font-semibold mb-4">Статус оплаты</h3>
          <div className="mt-2 text-white/70">
            {status === 'paid' ? (
              <div className="space-y-4">
                <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4">
                  <p className="text-green-400 font-semibold">✓ Оплата успешно завершена!</p>
                  <p className="text-sm text-white/70 mt-2">
                    Товары добавлены в ваш инвентарь. Проверьте раздел "Профиль" → "Инвентарь".
                  </p>
                  {email && (
                    <p className="text-sm text-white/70 mt-1">
                      Подробности отправлены на email: <span className="text-blue-400">{email}</span>
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4">
                  <p className="text-yellow-400 font-semibold">⏳ Ожидание оплаты</p>
                  <p className="text-sm text-white/70 mt-2">
                    После оплаты товары будут автоматически добавлены в ваш инвентарь.
                  </p>
                </div>
                
                {/* Кнопка для тестовой оплаты */}
                {!showPaymentWidget ? (
                  <>
                    <div className="mb-4">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={agreedToOffer}
                          onChange={(e) => setAgreedToOffer(e.target.checked)}
                          className="mt-1 w-4 h-4 rounded border-white/20 bg-[#161f38] text-blue-600 focus:ring-blue-500 focus:ring-2"
                        />
                        <span className="text-sm text-white/80">
                          Нажимая на кнопку, вы соглашаетесь с{' '}
                          <NavLink to="/privacy" target="_blank" className="text-blue-400 hover:text-blue-300 underline">
                            политикой конфиденциальности
                          </NavLink>
                          {' '}и{' '}
                          <NavLink to="/public-offer" target="_blank" className="text-blue-400 hover:text-blue-300 underline">
                            договором публичной оферты
                          </NavLink>
                        </span>
                      </label>
                    </div>
                    <button
                      onClick={() => {
                        console.log('[Checkout] Кнопка "Тестовая оплата" нажата')
                        console.log('[Checkout] Email:', email)
                        console.log('[Checkout] Email valid:', validateEmail(email))
                        console.log('[Checkout] Items length:', items.length)
                        console.log('[Checkout] Status:', status)
                        console.log('[Checkout] Agreed to offer:', agreedToOffer)
                        
                        if (!email || !validateEmail(email)) {
                          console.warn('[Checkout] Email не валиден')
                          setEmailError('Пожалуйста, введите корректный email')
                          return
                        }
                        
                        if (!agreedToOffer) {
                          console.warn('[Checkout] Не согласны с офертой')
                          return
                        }
                        
                        if (items.length === 0) {
                          console.warn('[Checkout] Корзина пуста')
                          return
                        }
                        
                        if (status === 'paid') {
                          console.warn('[Checkout] Заказ уже оплачен')
                          return
                        }
                        
                        console.log('[Checkout] Открываем PaymentWidget')
                        setShowPaymentWidget(true)
                      }}
                      disabled={!email || !validateEmail(email) || !agreedToOffer || items.length === 0 || status === 'paid'}
                      className={`w-full py-3 px-4 rounded-lg font-semibold transition-all duration-300 ${
                        !email || !validateEmail(email) || !agreedToOffer || items.length === 0 || status === 'paid'
                          ? 'bg-gray-600 cursor-not-allowed text-gray-400'
                          : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white transform hover:scale-105'
                      }`}
                    >
                      {status === 'paid' 
                        ? 'Оплата завершена' 
                        : items.length === 0
                        ? 'Корзина пуста'
                        : !email || !validateEmail(email)
                        ? 'Введите email для оплаты'
                        : !agreedToOffer
                        ? 'Согласитесь с условиями'
                        : '✅ Тестовая оплата'}
                    </button>
                    
                    <p className="text-xs text-white/50 text-center mt-2">
                      💡 Для тестирования: заполните email и нажмите кнопку выше
                    </p>
                  </>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Модальное окно PaymentWidget */}
      {showPaymentWidget && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-fadeIn"
          style={{ 
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            backgroundColor: 'rgba(0, 0, 0, 0.6)'
          }}
          onClick={(e) => {
            // Закрываем при клике вне виджета
            if (e.target === e.currentTarget) {
              console.log('[Checkout] Закрываем PaymentWidget (клик вне виджета)')
              setShowPaymentWidget(false)
            }
          }}
        >
          <div 
            className="bg-white rounded-lg shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto relative animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Кнопка закрытия */}
            <button
              onClick={() => {
                console.log('[Checkout] Закрываем PaymentWidget')
                setShowPaymentWidget(false)
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-10 bg-white rounded-full p-1 hover:bg-gray-100"
              aria-label="Закрыть"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            {console.log('[Checkout] Рендерим PaymentWidget, amount:', amountInCurr, 'currency:', currency, 'email:', email)}
            {amountInCurr > 0 ? (
              <PaymentWidget
                amount={amountInCurr}
                currency={currency}
                description={`Оплата заказа ${orderId}`}
                disableRedirect={true}
                defaultEmail={email}
                additionalData={{
                  orderId: orderId,
                  items: items.map(item => ({
                    name: item.name,
                    price: item.price,
                    category: item.category
                  }))
                }}
                onPaymentCreated={async (payment) => {
                  console.log('[Checkout] Payment created:', payment)
                  // После успешного создания платежа вызываем markPaid
                  // В реальном сценарии здесь будет проверка статуса платежа
                  try {
                    await markPaid()
                    setShowPaymentWidget(false)
                    // Можно показать сообщение об успехе
                    alert('Платеж создан! Заказ будет обработан после подтверждения оплаты.')
                  } catch (error) {
                    console.error('[Checkout] Error in markPaid:', error)
                  }
                }}
              />
            ) : (
              <div className="text-center p-4 text-red-600">
                Ошибка: Сумма платежа должна быть больше 0
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

// 
function GameCard({ product, addItem, fullSlider = false }) {
  const { formatPrice } = useLang()
  const previews = React.useMemo(() => getPreviewImages(product), [product])
  const coverImage = React.useMemo(() => getPrimaryImage(product), [product])
  const [idx, setIdx] = React.useState(0)
  const prev = () => setIdx(i => (i - 1 + previews.length) % previews.length)
  const next = () => setIdx(i => (i + 1) % previews.length)
  const navigate = useNavigate()

  return (
    <div onClick={() => navigate(`/product/${product.id}`)} className="group relative flex flex-col p-4 rounded-lg border border-white/10 bg-[#0D1A2F] hover:border-blue-400/50 transition cursor-pointer">
      <div className={`${fullSlider ? 'h-60 sm:h-64' : 'h-[200px] sm:h-[240px]'} rounded-lg bg-[#161f38] overflow-hidden relative w-full`}>
        {fullSlider ? (
          <>
            <LazyImage 
              src={previews[idx]} 
              alt={`${product.name}-preview-${idx+1}`} 
              className={computeProductImageClass(product, 'w-full h-full')}
              wrapperClassName={computeProductWrapperClass(product, 'absolute inset-0')}
            />

            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-2">
              {previews.map((_, i) => (
                <button key={i} onClick={(e) => { e.stopPropagation(); setIdx(i) }} aria-label={`go-${i}`} className={`h-2 w-2 rounded-full ${i===idx?'bg-[#4A90E2]':'bg-white/30'}`}></button>
              ))}
            </div>
          </>
        ) : (
          <>
            <LazyImage 
              src={coverImage}
              alt={product.name} 
              className={computeProductImageClass(product, 'w-full h-full')}
              wrapperClassName={computeProductWrapperClass(product, 'absolute inset-0')}
            />
            <div className="absolute bottom-2 left-2 right-2">
              <div className="flex items-center gap-2">
                <button onClick={(e) => { e.stopPropagation(); prev() }} className="px-2 py-1 rounded bg-[#161f38] hover:bg-[#7e2aa8]">&lsaquo;</button>
                <div className="flex-1 h-14 rounded border border-white/10 overflow-hidden bg-[#0D1A2F]">
                  <LazyImage
                    src={previews[idx]}
                    alt={`${product.name}-preview`}
                    className={computeProductImageClass(product, 'w-full h-full')}
                    wrapperClassName={computeProductWrapperClass(product, 'w-full h-full')}
                  />
                </div>
                <button onClick={(e) => { e.stopPropagation(); next() }} className="px-2 py-1 rounded bg-[#161f38] hover:bg-[#7e2aa8]">&rsaquo;</button>
              </div>
            </div>
          </>
        )}
      </div>
      <h3 className="mt-3 font-semibold">{product.name}</h3>
      <p className="text-white/60 text-sm">{formatPrice(getDisplayPrice(product))}</p>
      <div className="mt-auto flex items-center gap-2">

      </div>
    </div>
  )
}

// 
function GameCategory() {
  const { type } = useParams()
  const { addItem } = useCart()
  const games = DATA.products.filter(p => p.category === 'game' && p.type === type)
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold">Профиль</h2>
      {games.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full max-w-full justify-items-center">
          {games.map(p => (
            <GameCard key={p.id} product={p} addItem={addItem} fullSlider />
          ))}
        </div>
      ) : null}
    </section>
  )
}
// 
function SkinsCategory() {
  const { type } = useParams()
  const { addItem } = useCart()
  const { formatPrice } = useLang()
  const normalizedType = String(type || '').toLowerCase()
  const skins = DATA.products.filter(p => {
    if (!isSkinProduct(p)) return false
    if (!normalizedType) return true
    return String(p.type || '').toLowerCase() === normalizedType
  })
  const getRarityClasses = (rarity) => {
    switch (String(rarity || '').toLowerCase()) {
      case '':
      case 'covert':
        return 'bg-red-600 text-white'
      case 'classified':
        return 'bg-pink-600 text-white'
      case 'restricted':
        return 'bg-purple-600 text-white'
      case 'mil-spec':
        return 'bg-blue-600 text-white'
      case 'consumer grade':
        return 'bg-gray-600 text-white'
      case 'rare':
        return 'bg-green-600 text-white'
      case 'unusual':
        return 'bg-fuchsia-600 text-white'
      case 'immortal':
        return 'bg-amber-500 text-black'
      case 'souvenir':
        return 'bg-yellow-400 text-black'
      default:
        return 'bg-[#0D1A2F] text-white/70 border border-white/10'
    }
  }
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold">Профиль</h2>
      {skins.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 w-full max-w-full justify-items-center">
          {skins.map(product => {
            const discountPercent = getStableDiscountPercent(product, 12, 40)
            const originalPrice = getOriginalPrice(product, discountPercent)
            return (
            <NavLink key={product.id} to={`/product/${product.id}`} className="bg-[#161f38] rounded-lg overflow-hidden border border-white/10 hover:border-blue-500/50 transition-colors cursor-pointer w-full max-w-full">
                <div className="relative w-full overflow-hidden rounded-lg bg-[#0f172a] min-h-[220px] sm:min-h-[260px] flex items-center justify-center">
                  <LazyImage
                    src={getPrimaryImage(product)}
                    alt={product.name}
                    className={computeProductImageClass(product, 'w-full h-full object-contain')}
                    wrapperClassName={computeProductWrapperClass(product, 'w-full h-full')}
                  />
                </div>
              <div className="p-3">
                <div className="flex items-center justify-between mb-2 gap-2">
                  {product.rarity && (
                    <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium ${getRarityClasses(product.rarity)}`}>
                      {product.rarity}
                    </span>
                  )}
                  <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold bg-red-600 text-white">
                    -{discountPercent}%
                  </span>
                </div>
                <h3 className="text-sm font-medium text-white/90 truncate">{product.name}</h3>
                <div className="flex items-center justify-between mt-2">
                    <div className="flex flex-col">
                      {originalPrice && (
                        <span className="text-white/50 text-xs line-through">{formatPrice(originalPrice)}</span>
                      )}
                  <span className="text-blue-400 font-bold text-sm">{formatPrice(getDisplayPrice(product))}</span>
                    </div>
                  <CartQuantityControl product={product} />
                </div>
              </div>
            </NavLink>
            )
          })}
        </div>
      ) : (
        <div className="text-white/60 text-center py-8">Скины не найдены</div>
      )}
    </section>
  )
}

// 
function TermsOfService() {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold">Профиль</h2>
      <div className="prose prose-invert max-w-none">

      </div>
    </section>
  )
}

// 
function OfferAgreement() {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold">Профиль</h2>
      <div className="prose prose-invert max-w-none">

      </div>
    </section>
  )
}

function Help() {
  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">Помощь</h1>
      <p className="text-white/70">
        Мы готовим раздел помощи. Пока что вы можете воспользоваться разделами
        <NavLink to="/faq" className="text-blue-400 hover:text-blue-300 ml-1 underline">FAQ</NavLink>
        {' '}и{' '}
        <NavLink to="/support" className="text-blue-400 hover:text-blue-300 underline">Поддержка</NavLink>.
      </p>
    </section>
  )
}

function SupportAdmin() {
  const navigate = useNavigate()
  const [isAdmin, setIsAdmin] = React.useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return window.localStorage.getItem('role') === 'admin'
    } catch {
      return false
    }
  })
  const [sessions, setSessions] = React.useState([])
  const [selectedSessionId, setSelectedSessionId] = React.useState(null)
  const [messages, setMessages] = React.useState([])
  const [messageText, setMessageText] = React.useState('')
  const [loading, setLoading] = React.useState(true)
  const [sending, setSending] = React.useState(false)
  const [error, setError] = React.useState('')
  const [orders, setOrders] = React.useState([])
  const [ordersLoading, setOrdersLoading] = React.useState(true)
  const socketRef = React.useRef(null)
  const selectedSessionRef = React.useRef(null)
  const listRef = React.useRef(null)

  React.useEffect(() => {
    const syncRole = () => {
      try {
        setIsAdmin(window.localStorage.getItem('role') === 'admin')
      } catch {
        setIsAdmin(false)
      }
    }
    window.addEventListener('storage', syncRole)
    return () => window.removeEventListener('storage', syncRole)
  }, [])

  const adminHeaders = React.useMemo(() => {
    if (!SUPPORT_ADMIN_KEY) return {}
    return { 'x-admin-key': SUPPORT_ADMIN_KEY }
  }, [])

  const fetchOrders = React.useCallback(async () => {
    if (!isAdmin) {
      setOrdersLoading(false)
      return
    }
    setOrdersLoading(true)
    try {
      const response = await fetch(buildAuthUrl('/api/orders'), {
        credentials: 'include',
        headers: adminHeaders
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || 'load_failed')
      }
      setOrders(Array.isArray(data.orders) ? data.orders : [])
    } catch (err) {
      console.warn('[admin-orders] load error', err?.message)
      setError('Не удалось загрузить список заказов.')
    } finally {
      setOrdersLoading(false)
    }
  }, [adminHeaders, isAdmin])

  const fetchSessions = React.useCallback(async () => {
    if (!isAdmin) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const response = await fetch(buildAuthUrl('/api/chat/sessions'), {
        credentials: 'include',
        headers: adminHeaders
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || 'load_failed')
      }
      setSessions(Array.isArray(data.sessions) ? data.sessions : [])
      if (!selectedSessionRef.current && data.sessions && data.sessions.length > 0) {
        setSelectedSessionId(data.sessions[0].id)
        selectedSessionRef.current = data.sessions[0].id
      }
    } catch (err) {
      console.warn('[admin-chat] load sessions error', err?.message)
      setError('Не удалось загрузить список чатов.')
    } finally {
      setLoading(false)
    }
  }, [adminHeaders, isAdmin])

  const loadSessionDetails = React.useCallback(
    async (sessionId) => {
      if (!sessionId) return
      try {
        const response = await fetch(buildAuthUrl(`/api/chat/session/${sessionId}`), {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...adminHeaders }
        })
        const data = await response.json().catch(() => null)
        if (!response.ok || !data?.ok) {
          throw new Error(data?.error || 'load_failed')
        }
        setMessages(sortChatMessages(data.session?.messages || []))
        await fetch(buildAuthUrl(`/api/chat/session/${sessionId}/read`), {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...adminHeaders },
          body: JSON.stringify({ target: 'admin' })
        }).catch(() => {})
      } catch (err) {
        console.warn('[admin-chat] load session error', err?.message)
        setError('Не удалось загрузить переписку.')
      }
    },
    [adminHeaders]
  )

  React.useEffect(() => {
    if (!isAdmin) return
    fetchSessions()
    const interval = setInterval(fetchSessions, 30 * 1000)
    return () => clearInterval(interval)
  }, [fetchSessions, isAdmin])

  React.useEffect(() => {
    if (!isAdmin) return
    fetchOrders()
    const interval = setInterval(fetchOrders, 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchOrders, isAdmin])

  React.useEffect(() => {
    if (!isAdmin) return undefined
    const socket = socketIOClient(resolveSocketBaseUrl(), {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      auth: SUPPORT_ADMIN_KEY ? { adminKey: SUPPORT_ADMIN_KEY } : {}
    })
    socketRef.current = socket
    socket.on('chat:session-updated', (summary) => {
      if (!summary) return
      setSessions((prev) => {
        const existing = prev.find((item) => item.id === summary.id)
        const next = existing
          ? prev.map((item) => (item.id === summary.id ? { ...existing, ...summary } : item))
          : [summary, ...prev]
        return next.sort((a, b) => {
          const aTime = new Date(a.lastMessageAt || a.updatedAt || a.createdAt || 0).getTime()
          const bTime = new Date(b.lastMessageAt || b.updatedAt || b.createdAt || 0).getTime()
          return bTime - aTime
        })
      })
      if (selectedSessionRef.current === summary.id) {
        loadSessionDetails(summary.id)
      }
    })
    socket.on('chat:message', ({ sessionId, message }) => {
      if (!sessionId || !message) return
      if (selectedSessionRef.current === sessionId) {
        setMessages((prev) => {
          if (prev.find((m) => m.id === message.id)) return prev
          return sortChatMessages([...prev, message])
        })
      }
    })
    const mergeOrder = (summary) => {
      if (!summary) return
      setOrders((prev) => {
        const existingIndex = prev.findIndex((order) => order.id === summary.id)
        const next = existingIndex >= 0 ? [...prev] : [summary, ...prev]
        if (existingIndex >= 0) {
          next[existingIndex] = { ...next[existingIndex], ...summary }
        }
        return next.sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        )
      })
    }
    socket.on('orders:new', mergeOrder)
    socket.on('orders:updated', mergeOrder)
    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [isAdmin, loadSessionDetails])

  React.useEffect(() => {
    selectedSessionRef.current = selectedSessionId
    if (selectedSessionId && socketRef.current) {
      socketRef.current.emit('chat:join', {
        sessionId: selectedSessionId,
        adminKey: SUPPORT_ADMIN_KEY || undefined
      })
      loadSessionDetails(selectedSessionId)
    } else {
      setMessages([])
    }
  }, [selectedSessionId, loadSessionDetails])

  React.useEffect(() => {
    if (messages.length && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages])

  const sendAdminMessage = async () => {
    if (!selectedSessionId) {
      setError('Выберите диалог')
      return
    }
    const trimmed = messageText.trim()
    if (!trimmed) return
    setSending(true)
    const payload = {
      sessionId: selectedSessionId,
      body: trimmed,
      authorRole: 'admin',
      authorName: 'Оператор'
    }
    const handleFailure = () => {
      setSending(false)
      setError('Не удалось отправить сообщение.')
    }
    const finalize = () => {
      setSending(false)
      setMessageText('')
      setError('')
    }
    if (socketRef.current?.connected) {
      socketRef.current.emit('chat:message', payload, (ack) => {
        if (ack && ack.ok === false) {
          handleFailure()
        } else {
          finalize()
        }
      })
      return
    }
    try {
      const response = await fetch(buildAuthUrl(`/api/chat/session/${selectedSessionId}/message`), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...adminHeaders },
        body: JSON.stringify(payload)
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.ok) {
        handleFailure()
        return
      }
      finalize()
    } catch (err) {
      console.warn('[admin-chat] send error', err?.message)
      handleFailure()
    }
  }

  const updateOrderStatus = async (orderInternalId, nextStatus) => {
    if (!orderInternalId || !nextStatus) return
    try {
      const response = await fetch(buildAuthUrl(`/api/orders/${orderInternalId}/status`), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...adminHeaders },
        body: JSON.stringify({ status: nextStatus })
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || 'update_failed')
      }
      if (data.order) {
        setOrders((prev) =>
          prev.map((order) => (order.id === data.order.id ? { ...order, ...data.order } : order))
        )
      }
    } catch (err) {
      console.warn('[admin-orders] update status error', err?.message)
      setError('Не удалось обновить статус заказа.')
    }
  }

  if (!isAdmin) {
    return (
      <section className="space-y-6">
        <h1 className="text-2xl font-bold">Центр поддержки</h1>
        <p className="text-white/70">Доступ закрыт. Требуется учетная запись администратора.</p>
        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
        >
          Вернуться в профиль
        </button>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Центр поддержки</h1>
        <button
          type="button"
          onClick={fetchSessions}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm"
        >
          Обновить
        </button>
      </div>
      <div className="bg-[#101a33] border border-white/10 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <span className="text-sm font-semibold text-white">Новые заказы</span>
          <button
            type="button"
            onClick={fetchOrders}
            className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 rounded transition-colors"
          >
            Обновить
          </button>
        </div>
        <div className="max-h-72 overflow-y-auto divide-y divide-white/5">
          {ordersLoading ? (
            <div className="px-4 py-4 text-sm text-white/60">Загрузка...</div>
          ) : orders.length === 0 ? (
            <div className="px-4 py-4 text-sm text-white/60">Заказы пока не поступали.</div>
          ) : (
            orders.map((order) => (
              <div key={order.id} className="px-4 py-3 text-sm text-white/80 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-white">{order.orderId}</div>
                    <div className="text-xs text-white/50">
                      {order.userName || 'Клиент'} {order.userEmail ? `• ${order.userEmail}` : ''}
                    </div>
                  </div>
                  <div className="text-xs text-white/50">
                    {order.createdAt
                      ? new Date(order.createdAt).toLocaleString('ru-RU', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : ''}
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-white/60">
                  <span>Сумма: {order.totalAmount} {order.currency}</span>
                  <span>Позиции: {order.itemsCount}</span>
                  <span>Метод: {order.paymentMethod}</span>
                  <span>Статус: {order.status === 'processed' ? 'обработан' : 'новый'}</span>
                </div>
                {order.status !== 'processed' && (
                  <button
                    type="button"
                    onClick={() => updateOrderStatus(order.id, 'processed')}
                    className="mt-1 inline-flex items-center gap-2 px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-xs text-white transition-colors"
                  >
                    Отметить как обработано
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
      {error && <div className="p-3 bg-red-500/20 border border-red-500/40 rounded text-sm text-red-200">{error}</div>}
      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4">
        <div className="bg-[#101a33] border border-white/10 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 text-sm font-semibold">Диалоги</div>
          <div className="max-h-[420px] overflow-y-auto">
            {loading ? (
              <div className="px-4 py-6 text-sm text-white/60">Загрузка...</div>
            ) : sessions.length === 0 ? (
              <div className="px-4 py-6 text-sm text-white/60">Нет активных обращений</div>
            ) : (
              sessions.map((session) => {
                const isActive = selectedSessionId === session.id
                const time = session.lastMessageAt || session.updatedAt || session.createdAt
                return (
                  <button
                    type="button"
                    key={session.id}
                    onClick={() => setSelectedSessionId(session.id)}
                    className={`w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/5 transition ${
                      isActive ? 'bg-white/10' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-white">
                        {session.user?.name || session.user?.email || 'Клиент'}
                      </span>
                      {session.unreadForAdmin && (
                        <span className="px-2 py-0.5 bg-orange-500 text-xs rounded-full text-white">новое</span>
                      )}
                    </div>
                    <div className="text-xs text-white/60">
                      {time ? new Date(time).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                    </div>
                    {session.lastMessage?.body && (
                      <div className="text-xs text-white/60 mt-1 truncate">{session.lastMessage.body}</div>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
        <div className="bg-[#101a33] border border-white/10 rounded-lg flex flex-col">
          {selectedSessionId ? (
            <>
              <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-white">
                    {sessions.find((s) => s.id === selectedSessionId)?.user?.name ||
                      sessions.find((s) => s.id === selectedSessionId)?.user?.email ||
                      'Клиент'}
                  </div>
                  <div className="text-xs text-white/60">
                    {sessions.find((s) => s.id === selectedSessionId)?.user?.email || 'Email не указан'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    fetch(buildAuthUrl(`/api/chat/session/${selectedSessionId}/status`), {
                      method: 'POST',
                      credentials: 'include',
                      headers: { 'Content-Type': 'application/json', ...adminHeaders },
                      body: JSON.stringify({ status: 'closed' })
                    }).then(() => fetchSessions())
                  }
                  className="px-3 py-2 text-xs bg-white/10 hover:bg-white/20 rounded"
                >
                  Закрыть
                </button>
              </div>
              <div ref={listRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="text-sm text-white/60">Сообщения отсутствуют.</div>
                ) : (
                  messages.map((message) => {
                    const isAdminMessage = message.authorRole === 'admin'
                    return (
                      <div key={message.id} className={`flex ${isAdminMessage ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow ${
                            isAdminMessage ? 'bg-blue-600 text-white' : 'bg-white/10 text-white/90'
                          }`}
                        >
                          {!isAdminMessage && (
                            <div className="text-xs text-white/70 mb-1">
                              {sessions.find((s) => s.id === selectedSessionId)?.user?.name || 'Клиент'}
                            </div>
                          )}
                          <div>{message.body}</div>
                          <div className="text-[10px] text-white/50 mt-1 text-right">
                            {message.createdAt
                              ? new Date(message.createdAt).toLocaleTimeString('ru-RU', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                              : ''}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
              <div className="px-5 py-4 border-t border-white/10 space-y-2">
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      if (!sending) {
                        sendAdminMessage()
                      }
                    }
                  }}
                  placeholder="Ответ оператора..."
                  rows={3}
                  className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 focus:outline-none focus:border-blue-500 text-sm resize-none"
                />
                <button
                  type="button"
                  onClick={sendAdminMessage}
                  disabled={sending || messageText.trim().length === 0}
                  className={`px-4 py-2 rounded text-sm font-semibold transition-colors ${
                    sending || messageText.trim().length === 0
                      ? 'bg-blue-900/50 text-white/60 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {sending ? 'Отправка...' : 'Отправить'}
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-white/60 text-sm">
              Выберите диалог слева, чтобы просмотреть переписку.
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
// 
function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout><Home/></Layout>} />
      <Route path="/store" element={<Layout><Store/></Layout>} />
      <Route path="/skins" element={<Layout><Skins/></Layout>} />
      <Route path="/skins/:type" element={<Layout><SkinsCategory/></Layout>} />
      <Route path="/product/:id" element={<Layout><Product/></Layout>} />
      <Route path="/cart" element={<Layout><Cart/></Layout>} />
      <Route path="/profile" element={<Layout><Profile/></Layout>} />
      <Route path="/admin/support" element={<Layout><SupportAdmin/></Layout>} />
      <Route path="/admin/*" element={<Admin />} />
      <Route path="/deeplink/:id" element={<DeeplinkPage />} />
      <Route path="/checkout" element={<Layout><Checkout/></Layout>} />
      <Route path="/privacy" element={<Layout><Privacy/></Layout>} />
      <Route path="/terms" element={<Layout><Terms/></Layout>} />
      <Route path="/offer" element={<Layout><OfferAgreement/></Layout>} />
      <Route path="/copyright-agreement" element={<Layout><CopyrightAgreement/></Layout>} />
      <Route path="/public-offer" element={<Layout><PublicOffer/></Layout>} />
      <Route path="/blog" element={<Layout><BlogPage/></Layout>} />
      <Route path="/blog/:slug" element={<Layout><BlogPost/></Layout>} />
      <Route path="/help" element={<Layout><Help/></Layout>} />
      <Route path="/roulette" element={<Layout><SkinRoulette/></Layout>} />
      <Route path="/faq" element={<Layout><FAQ/></Layout>} />
      <Route path="/support" element={<Layout><Support/></Layout>} />
      <Route path="/about" element={<Layout><About/></Layout>} />
      <Route path="/contacts" element={<Layout><Contacts/></Layout>} />
      <Route path="/pay/:id" element={<PaymentPage />} />
      <Route path="/test-payment" element={<Layout><TestPayment/></Layout>} />
      <Route path="/steam-topup" element={<Layout><SteamTopUp/></Layout>} />
      <Route path="*" element={<Layout><Home/></Layout>} />
    </Routes>
  )
}

// 
function getPreviewImages(product) {
  const images = collectProductImages(product)
  if (images.length >= 5) return images.slice(0, 5)
  const result = [...images]
  while (result.length < 5) {
    result.push(PLACEHOLDER_IMAGE)
  }
  return result.slice(0, 5)
}
// 
function Store() {
  const [query, setQuery] = React.useState('')
  const [type, setType] = React.useState('')
  const [category, setCategory] = React.useState('game') // 'game' или 'skin'
  const [version, setVersion] = React.useState(0)
  const { addItem } = useCart()
  const { formatPrice } = useLang()
  
  // Реактивное обновление при загрузке новых продуктов
  React.useEffect(() => {
    const onProductsLoaded = () => setVersion(v => v + 1)
    window.addEventListener('products-loaded', onProductsLoaded)
    return () => window.removeEventListener('products-loaded', onProductsLoaded)
  }, [])
  
  const products = React.useMemo(() => 
    DATA.products.filter(p => p.category === category), 
    [category, version]
  )
  const filtered = products.filter(p => (p.name.toLowerCase().includes(query.toLowerCase())) && (!type || p.type === type))
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold">Каталог</h2>
      <div className="flex flex-wrap gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => setCategory('game')}
            className={`px-4 py-2 rounded transition-colors ${category === 'game' ? 'bg-blue-600 text-white' : 'bg-[#0D1A2F] text-white/70 hover:bg-white/10'}`}
          >
            Игры
          </button>
          <button
            onClick={() => setCategory('skin')}
            className={`px-4 py-2 rounded transition-colors ${category === 'skin' ? 'bg-blue-600 text-white' : 'bg-[#0D1A2F] text-white/70 hover:bg-white/10'}`}
          >
            Скины
          </button>
        </div>
        <input 
          value={query} 
          onChange={e => setQuery(e.target.value)} 
          placeholder="Поиск..." 
          className="px-3 py-2 rounded bg-[#0D1A2F] border border-white/10 flex-1 min-w-[200px]" 
        />
      </div>
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full max-w-full justify-items-center">
          {filtered.map(p => (
            <NavLink to={`/product/${p.id}`} key={p.id} className="flex flex-col p-4 rounded-lg border border-white/10 bg-[#0D1A2F] hover:border-blue-400/50 transition w-full max-w-full">
              <div className={`rounded-lg bg-[#161f38] overflow-hidden w-full relative ${isSkinProduct(p) ? 'min-h-[220px] sm:min-h-[260px]' : 'aspect-[4/3] min-h-[180px]'} flex items-center justify-center`}>
                <LazyImage 
                  src={getPrimaryImage(p)} 
                  alt={p.name} 
                  className={computeProductImageClass(p, isSkinProduct(p) ? 'max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105' : 'w-full h-full transition-transform duration-300 group-hover:scale-105')}
                  wrapperClassName={computeProductWrapperClass(p, isSkinProduct(p) ? 'w-full h-full flex items-center justify-center' : 'absolute inset-0')}
                />
              </div>
              <h3 className="mt-3 font-semibold">{p.name}</h3>
              <p className="text-white/60 text-sm mt-1">Цена: {formatPrice(p.price)}</p>
              {p.rarity && (
                <span className="text-xs text-purple-400 mt-1">{p.rarity}</span>
              )}
              <div className="mt-auto">
                <CartQuantityControl product={p} className="w-full" />
              </div>
            </NavLink>
          ))}
        </div>
      ) : (
        <div className="text-white/60 text-center py-8">Ничего не найдено</div>
      )}
    </section>
  )
}
// 
function Games() {
  const { addItem } = useCart()
  const { formatPrice } = useLang()
  const [version, setVersion] = React.useState(0)
  
  // Реактивное обновление при загрузке новых продуктов
  React.useEffect(() => {
    const onProductsLoaded = () => setVersion(v => v + 1)
    window.addEventListener('products-loaded', onProductsLoaded)
    return () => window.removeEventListener('products-loaded', onProductsLoaded)
  }, [])
  
  const games = React.useMemo(() => 
    DATA.products.filter(p => p.category === 'game'), 
    [version]
  )

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold">Профиль</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full max-w-full justify-items-center">
        {games.map(product => (
          <NavLink key={product.id} to={`/product/${product.id}`} className="group w-full max-w-full">
            <div className="bg-[#161f38] rounded-lg overflow-hidden border border-white/10 hover:border-blue-500/50 transition-colors w-full">
              <div className="relative h-40">
                <LazyImage
                  src={getPrimaryImage(product)}
                  alt={product.name}
                  className={computeProductImageClass(product, 'h-full w-full transition-transform duration-500 group-hover:scale-110')}
                  wrapperClassName={computeProductWrapperClass(product, 'h-full w-full')}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-2 left-2 right-2">
                  <h3 className="text-white font-medium text-sm">{product.name}</h3>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-blue-400 font-bold text-sm">{formatPrice(getDisplayPrice(product))}</span>
                    <span className="text-xs text-white/70">{product.type}</span>
                  </div>
                </div>
              </div>
            </div>
          </NavLink>
        ))}
      </div>
    </section>
  )
}
// 
function Skins() {
  const { addItem } = useCart()
  const { formatPrice } = useLang()
  const skins = DATA.products.filter(isSkinProduct)
  const getRarityClasses = (rarity) => {
    switch (String(rarity || '').toLowerCase()) {
      case '':
      case 'covert':
        return 'bg-red-600 text-white'
      case 'classified':
        return 'bg-pink-600 text-white'
      case 'restricted':
        return 'bg-purple-600 text-white'
      case 'mil-spec':
        return 'bg-blue-600 text-white'
      case 'consumer grade':
      case 'consumer':
        return 'bg-gray-600 text-white'
      case 'rare':
        return 'bg-green-600 text-white'
      default:
        return 'bg-[#0D1A2F] text-white/70 border border-white/10'
    }
  }

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold">Скины</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 w-full max-w-full justify-items-center">
        {skins.map(product => {
          const discountPercent = getStableDiscountPercent(product, 10, 38)
          const originalPrice = getOriginalPrice(product, discountPercent)
          return (
          <NavLink key={product.id} to={`/product/${product.id}`} className="bg-[#161f38] rounded-lg overflow-hidden border border-white/10 hover:border-blue-500/50 transition-colors cursor-pointer w-full max-w-full">
              <div className="w-full min-h-[220px] sm:min-h-[260px] flex items-center justify-center bg-[#0f172a]">
                <LazyImage
                  src={getPrimaryImage(product)}
                  alt={product.name}
                  className={computeProductImageClass(product, 'max-h-full max-w-full object-contain')}
                  wrapperClassName={computeProductWrapperClass(product, 'w-full h-full flex items-center justify-center')}
                />
              </div>
            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                {product.rarity && (
                  <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium ${getRarityClasses(product.rarity)}`}>
                    {product.rarity}
                  </span>
                )}
                <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold bg-red-600 text-white">
                  -{discountPercent}%
                </span>
              </div>
              <h3 className="text-sm font-medium text-white/90 truncate">{product.name}</h3>
              <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    {originalPrice && (
                      <span className="text-white/50 text-xs line-through">{formatPrice(originalPrice)}</span>
                    )}
                <span className="text-blue-400 font-bold text-sm">{formatPrice(product.price)}</span>
                  </div>
                <CartQuantityControl product={product} className="px-3 py-1" />
              </div>
            </div>
          </NavLink>
          )
        })}
      </div>
    </section>
  )
}
// 
function SkinRoulette() {
  const [isSpinning, setIsSpinning] = React.useState(false)
  const [result, setResult] = React.useState(null)
  const [spinOffset, setSpinOffset] = React.useState(0)
  const rouletteRef = React.useRef(null)
  const { formatPrice } = useLang()
  const navigate = useNavigate()
  const skins = DATA.products.filter(isSkinProduct).slice(0, 10)
  const itemWidth = 96 // w-24 = 96px
  const itemCount = skins.length
  
  // Сохранение выигранного предмета в инвентарь
  const saveToInventory = (skin) => {
    try {
      let inventory = []
      try {
        inventory = JSON.parse(localStorage.getItem('roulette-inventory') || '[]')
      } catch {}
      
      const inventoryItem = {
        id: `roulette-${Date.now()}`,
        productId: skin.id,
        name: skin.name,
        image: skin.image,
        price: skin.price,
        rarity: skin.rarity,
        wonAt: Date.now(),
        obtained: false, // получен только после операции
        requiresPurchase: true // требует покупки для получения
      }
      
      inventory.push(inventoryItem)
      localStorage.setItem('roulette-inventory', JSON.stringify(inventory))
      window.dispatchEvent(new Event('inventory-updated'))
    } catch (e) {
      console.error('Error saving to inventory:', e)
    }
  }
  
  const spin = () => {
    if (isSpinning) return
    
    setIsSpinning(true)
    setResult(null)
    
    // Случайный выбор приза
    const randomIndex = Math.floor(Math.random() * itemCount)
    const randomSkin = skins[randomIndex]
    
    // Вычисляем текущее смещение относительно одного полного цикла
    const cycleLength = itemCount * itemWidth
    const currentInCycle = spinOffset % cycleLength
    
    // Позиция целевого элемента в цикле
    const targetInCycle = randomIndex * itemWidth
    
    // Добавляем несколько полных оборотов для эффекта (3-5 оборотов)
    const fullRotations = 3 + Math.random() * 2
    const fullRotationsDistance = fullRotations * cycleLength
    
    // Вычисляем расстояние до целевого элемента
    let distanceToTarget = targetInCycle - currentInCycle
    if (distanceToTarget < 0) {
      distanceToTarget += cycleLength
    }
    
    // Общее расстояние = полные обороты + расстояние до цели
    const totalDistance = fullRotationsDistance + distanceToTarget
    
    // Устанавливаем новое смещение
    setSpinOffset(spinOffset + totalDistance)
    
    setTimeout(() => {
      setResult(randomSkin)
      saveToInventory(randomSkin)
      setIsSpinning(false)
    }, 3000)
  }

  return (
    <div className="bg-gradient-to-br from-[#161f38] to-[#1f2a4a] rounded-lg p-6 border border-white/10">
      <div className="text-center space-y-6">
        <h2 className="text-2xl font-bold">Рулетка скинов</h2>
        <p className="text-white/70">Выигранный предмет попадёт в ваш инвентарь. Для получения нужно совершить покупку на сайте.</p>
        
        <div className="relative h-32 bg-[#0D1A2F] rounded-lg overflow-hidden border border-white/20">
          <div 
            ref={rouletteRef}
            className="flex transition-transform duration-[3000ms] ease-out"
            style={{ 
              transform: `translateX(-${spinOffset}px)`,
              transitionTimingFunction: isSpinning ? 'cubic-bezier(0.25, 0.1, 0.25, 1)' : 'ease-out'
            }}
          >
            {[...skins, ...skins, ...skins, ...skins].map((skin, i) => (
              <div key={i} className="flex-shrink-0 w-24 h-32 p-2 border-r border-white/10 bg-[#0D1A2F]">
                <LazyImage
                  src={getPrimaryImage(skin)}
                  alt={skin.name}
                  className="w-full h-20 object-cover rounded"
                />
                <div className="text-xs mt-1 truncate text-white">{skin.name}</div>
              </div>
            ))}
          </div>
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-1 h-full bg-red-500 z-10 shadow-lg shadow-red-500/50"></div>
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-16 h-full bg-gradient-to-r from-transparent via-red-500/20 to-transparent z-5 pointer-events-none"></div>
        </div>

        {result && (
          <div className="bg-[#0D1A2F] rounded-lg p-4 border border-green-500/50">
            <div className="text-green-400 font-semibold mb-2">🎉 Вы выиграли!</div>
            <div className="flex items-center justify-center gap-4 mt-2">
              <LazyImage
                src={getPrimaryImage(result)}
                alt={result.name}
                className="w-16 h-16 object-cover rounded"
              />
              <div>
                <div className="font-medium">{result.name}</div>
                <div className="text-blue-400">{formatPrice(result.price)}</div>
              </div>
            </div>
            <p className="text-sm text-white/70 mt-2">Предмет добавлен в инвентарь. Совершите покупку, чтобы получить его!</p>
            <div className="flex gap-2 justify-center mt-4">
              <NavLink to="/profile" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors">
                Посмотреть инвентарь
              </NavLink>
              <NavLink to="/store" className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm transition-colors">
                Перейти в магазин
              </NavLink>
            </div>
          </div>
        )}

        <button 
          onClick={spin}
          disabled={isSpinning}
          className={`px-8 py-3 rounded-lg font-medium transition-all transform hover:scale-105 ${
            isSpinning 
              ? 'bg-gray-600 cursor-not-allowed' 
              : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'
          }`}
        >
          {isSpinning ? 'Крутится...' : 'Крутить рулетку'}
        </button>
      </div>
    </div>
  )
}
// 
function Cart() {
  const { items, removeItem, updateQty, clear, totalPrice, baseTotalPrice, discount, discountPercent } = useCart()
  const { formatPrice } = useLang()
  const navigate = useNavigate()

  if (items.length === 0) {
    return (
      <section className="space-y-6">
        <h2 className="text-2xl font-bold">Корзина</h2>
        <div className="text-center py-12">
          <p className="text-white/60 mb-6">Ваша корзина пуста</p>
          <button 
            onClick={() => navigate('/store')}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
          >
            Перейти в магазин
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Корзина</h2>
        <button 
          onClick={clear}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm transition-colors"
        >
          Очистить корзину
        </button>
      </div>

      <div className="space-y-4">
        {items.map(item => (
          <div key={item.id} className="flex items-center gap-4 p-4 bg-[#161f38] rounded-lg border border-white/10">
            <LazyImage 
              src={item.image} 
              alt={item.name} 
              className={computeProductImageClass(item, 'w-16 h-16')} 
              wrapperClassName={computeProductWrapperClass(item, 'w-16 h-16')}
            />
            <div className="flex-1">
              <h3 className="font-medium">{item.name}</h3>
              <p className="text-white/60 text-sm">{formatPrice(roundToSteamPrice(item.price))}</p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => updateQty(item.id, Math.max(0, item.qty - 1))}
                className="w-8 h-8 bg-[#0D1A2F] hover:bg-[#7e2aa8] rounded border border-white/10"
              >
                -
              </button>
              <span className="w-8 text-center">{item.qty}</span>
              <button 
                onClick={() => updateQty(item.id, item.qty + 1)}
                className="w-8 h-8 bg-[#0D1A2F] hover:bg-[#7e2aa8] rounded border border-white/10"
              >
                +
              </button>
            </div>
            <div className="text-right">
              <div className="font-medium">{formatPrice(roundToSteamPrice(item.price * item.qty))}</div>
              <button 
                onClick={() => removeItem(item.id)}
                className="text-red-400 hover:text-red-300 text-sm mt-1"
              >
                Удалить
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10 pt-4 space-y-2">
        {discount > 0 && (
          <>
            <div className="flex items-center justify-between text-sm text-white/70">
              <span>Сумма без скидки:</span>
              <span className="line-through">{formatPrice(baseTotalPrice)}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-green-400">
              <span>Скидка {discountPercent}%:</span>
              <span>-{formatPrice(discount)}</span>
            </div>
          </>
        )}
        <div className="flex items-center justify-between text-xl font-bold">
          <span>Итого:</span>
          <span className="text-green-400">{formatPrice(totalPrice)}</span>
        </div>
        <button 
          onClick={() => navigate('/checkout')}
          className="w-full mt-4 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-lg font-medium transition-colors transform hover:scale-105"
        >
          Оформить заказ
        </button>
      </div>
    </section>
  )
}

// 
function Blog() {
  const blogPosts = BLOG_POSTS

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold">Блог</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {blogPosts.map(post => (
          <NavLink key={post.id} to={`/blog/${post.slug}`} className="block group">
            <article className="bg-[#161f38] rounded-lg overflow-hidden border border-white/10 group-hover:border-blue-500/50 transition-colors">
              <div className="h-48 bg-[#0D1A2F]">
                <LazyImage 
                  src={post.image} 
                  alt={post.title} 
                  className="w-full h-full object-cover"
                  fallback="/vite.svg"
                />
              </div>
              <div className="p-4">
                <h3 className="font-semibold mb-2">{post.title}</h3>
                <p className="text-white/70 text-sm mb-3">{post.excerpt}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/50">{new Date(post.date).toLocaleDateString('ru-RU')}</span>

                </div>
              </div>
            </article>
          </NavLink>
        ))}
      </div>
    </section>
  )
}

// 
const BLOG_POSTS = [
  { id: 1, slug: 'best-games-2025', title: 'Лучшие игры 2025 года: Обзор самых ожидаемых релизов', excerpt: 'Подробный обзор самых ожидаемых игр 2025 года. От AAA-проектов до инди-хитов - все самое интересное для геймеров.', content: '2025 год обещает стать невероятным для игровой индустрии. Мы собрали подборку самых ожидаемых игр: грандиозные релизы, инди-хиты и проекты, которые уже получили признание игроков. От эпических RPG до захватывающих шутеров - каждый найдет что-то для себя.', date: '2025-01-15', image: '/images/blog/games-2024.jpg' },
  { id: 2, slug: 'choose-skins-cs2-2025', title: 'Как выбрать идеальные скины для CS2 в 2025 году', excerpt: 'Полное руководство по выбору скинов для Counter-Strike 2. Рекомендации экспертов и советы по инвестициям в игровые предметы.', content: 'Выбор скинов для CS2 - это не просто вопрос эстетики, но и инвестиция. В этом руководстве мы расскажем о самых популярных скинах, их стоимости и перспективах роста. Узнайте, какие предметы лучше покупать сейчас, а какие могут подорожать в будущем.', date: '2025-01-10', image: '/images/blog/cs2-skins.jpg' },
  { id: 3, slug: 'gaming-industry-news-2025', title: 'Новости игровой индустрии: Январь 2025', excerpt: 'Свежие новости из мира игр: анонсы, релизы, обновления и важные события января 2025 года.', content: 'Январь 2025 принес много интересных новостей: новые анонсы игр, успешные релизы и важные обновления популярных проектов. Мы собрали все самое важное, что произошло в игровой индустрии за этот месяц.', date: '2025-01-05', image: '/images/blog/gaming-news.jpg' },
  { id: 4, slug: 'top-skins-january-2025', title: 'Топ-10 самых популярных скинов января 2025', excerpt: 'Рейтинг самых востребованных и дорогих скинов, проданных в январе 2025 года на нашей платформе.', content: 'Январь показал невероятную активность на рынке скинов. Мы составили рейтинг самых популярных предметов, которые пользователи покупали и продавали чаще всего. Узнайте, какие скины в тренде.', date: '2025-01-20', image: '/images/blog/gaming-news.jpg' },
  { id: 5, slug: 'dota2-cosmetics-2025', title: 'Обновление косметики Dota 2: Новые предметы 2025', excerpt: 'Обзор новых косметических предметов для Dota 2, которые появились в начале 2025 года.', content: 'Dota 2 продолжает радовать игроков новыми косметическими предметами. В этом обзоре мы расскажем о самых интересных скинах для героев, которые появились в игре в начале 2025 года.', date: '2025-02-01', image: '/images/blog/gaming-news.jpg' },
  { id: 6, slug: 'rust-skins-feb-2025', title: 'Рынок скинов Rust: Тренды февраля 2025', excerpt: 'Анализ рынка скинов для Rust. Какие предметы растут в цене и почему.', content: 'Рынок скинов Rust продолжает развиваться. Мы проанализировали тренды февраля и готовы поделиться выводами о том, какие предметы становятся более ценными и почему.', date: '2025-02-10', image: '/images/blog/gaming-news.jpg' },
  { id: 7, slug: 'tf2-market-2025', title: 'Team Fortress 2: Состояние рынка в 2025 году', excerpt: 'Актуальная информация о рынке предметов Team Fortress 2 и перспективах инвестиций.', content: 'Team Fortress 2 остается одной из самых популярных игр для торговли предметами. Разбираем текущее состояние рынка и перспективы для инвесторов в 2025 году.', date: '2025-02-18', image: '/images/blog/gaming-news.jpg' },
  { id: 8, slug: 'pubg-skins-guide-2025', title: 'Гайд по скинам PUBG: Как выбрать и купить', excerpt: 'Подробное руководство по выбору и покупке скинов для PUBG. Советы для новичков и опытных игроков.', content: 'PUBG предлагает огромный выбор скинов для оружия и персонажей. В этом гайде мы расскажем, как правильно выбирать предметы, на что обращать внимание и как делать выгодные покупки.', date: '2025-03-01', image: '/images/blog/gaming-news.jpg' },
  { id: 9, slug: 'market-safety-2025', title: 'Безопасность на рынке игровых предметов: Советы 2025', excerpt: 'Как защитить себя от мошенников и безопасно покупать скины в 2025 году.', content: 'Безопасность - главный приоритет при покупке игровых предметов. Мы собрали все важные советы по защите от мошенников и безопасному проведению сделок на рынке скинов.', date: '2025-03-10', image: '/images/blog/gaming-news.jpg' },
  { id: 10, slug: 'spring-sale-2025', title: 'Весенняя распродажа игр: Март 2025', excerpt: 'Обзор весенней распродажи игр. Лучшие предложения и скидки на популярные игры.', content: 'Весенняя распродажа - отличная возможность пополнить коллекцию игр по выгодным ценам. Мы собрали все лучшие предложения и скидки, которые доступны в марте 2025 года.', date: '2025-03-20', image: '/images/blog/gaming-news.jpg' }
]

// 
function BlogPost() {
  const { slug } = useParams()
  const post = BLOG_POSTS.find(p => p.slug === slug)

  if (!post) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Статья не найдена</h2>
        <p className="text-white/70">Запрашиваемая статья не существует.</p>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <div className="h-56 bg-[#0D1A2F] rounded-lg overflow-hidden border border-white/10">
        <LazyImage 
          src={post.image}
          alt={post.title}
          className="w-full h-full object-cover"
          fallback="/vite.svg"
        />
      </div>
      <div>
        <h1 className="text-3xl font-bold mb-2">{post.title}</h1>
        <div className="text-sm text-white/60">{new Date(post.date).toLocaleDateString('ru-RU')}</div>
      </div>
      <div className="prose prose-invert max-w-none">
        <p className="text-sm leading-relaxed whitespace-pre-line">{post.content}</p>
      </div>
      <div>
        <NavLink to="/blog" className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
          ← Вернуться к списку статей
        </NavLink>
      </div>
    </section>
  )
}
// 
function PrivacyPolicy() {
  return (
    <section className="space-y-6">

      
      <div className="space-y-6 text-white/80">
        <div>

          <p className="text-sm leading-relaxed">

          </p>
        </div>

        <div>

          <p className="text-sm leading-relaxed mb-2">

          </p>
          <ul className="list-disc list-inside text-sm space-y-1 ml-4">

          </ul>
        </div>

        <div>

          <p className="text-sm leading-relaxed mb-2">

          </p>
          <ul className="list-disc list-inside text-sm space-y-1 ml-4">

          </ul>
        </div>

        <div>

          <p className="text-sm leading-relaxed">

          </p>
        </div>

        <div>

          <p className="text-sm leading-relaxed">

          </p>
        </div>

        <div>

          <p className="text-sm leading-relaxed mb-2">

          </p>
          <ul className="list-disc list-inside text-sm space-y-1 ml-4">

          </ul>
        </div>

        <div>

          <div className="text-sm leading-relaxed space-y-2">

            <div className="bg-[#161f38]/50 p-4 rounded-lg border border-white/10">
              <div className="space-y-1">

                <div>Email: <a href="mailto:privacy@aigamestore.ru" className="text-blue-400 hover:text-blue-300">privacy@aigamestore.ru</a></div>

              </div>
            </div>
          </div>
        </div>

        <div className="text-xs text-white/60 pt-4 border-t border-white/10">

        </div>
      </div>
    </section>
  )
}
// Компонент мобильной карусели со свайпом
function MobileSwipeCarousel({ items, addItem, formatPrice }) {
  const [currentIndex, setCurrentIndex] = React.useState(0)
  const [touchStart, setTouchStart] = React.useState(null)
  const [touchEnd, setTouchEnd] = React.useState(null)
  const [autoPlayPaused, setAutoPlayPaused] = React.useState(false)
  const carouselRef = React.useRef(null)
  const resumeTimeoutRef = React.useRef(null)
  
  const clearResumeTimeout = React.useCallback(() => {
    if (resumeTimeoutRef.current) {
      clearTimeout(resumeTimeoutRef.current)
      resumeTimeoutRef.current = null
    }
  }, [])
  
  const scheduleResume = React.useCallback(() => {
    clearResumeTimeout()
    resumeTimeoutRef.current = setTimeout(() => {
      setAutoPlayPaused(false)
      resumeTimeoutRef.current = null
    }, 6000)
  }, [clearResumeTimeout])
  
  const minSwipeDistance = 50
  
  const onTouchStart = (e) => {
    setAutoPlayPaused(true)
    clearResumeTimeout()
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }
  
  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }
  
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) {
      setTouchStart(null)
      setTouchEnd(null)
      scheduleResume()
      return
    }
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance
    
    if (isLeftSwipe && currentIndex < items.length - 1) {
      setCurrentIndex(i => i + 1)
    }
    if (isRightSwipe && currentIndex > 0) {
      setCurrentIndex(i => i - 1)
    }
    setTouchStart(null)
    setTouchEnd(null)
    scheduleResume()
  }
  
  React.useEffect(() => {
    if (carouselRef.current && items.length > 0) {
      const containerWidth = carouselRef.current.offsetWidth || carouselRef.current.clientWidth
      if (containerWidth > 0) {
        carouselRef.current.scrollTo({
          left: currentIndex * containerWidth,
          behavior: 'smooth'
        })
      }
    }
  }, [currentIndex, items.length])
  
  React.useEffect(() => {
    if (items.length <= 1 || autoPlayPaused) return undefined
    const id = setInterval(() => {
      setCurrentIndex((index) => (index + 1) % items.length)
    }, 5000)
    return () => clearInterval(id)
  }, [items.length, autoPlayPaused])
  
  React.useEffect(() => {
    if (currentIndex >= items.length && items.length > 0) {
      setCurrentIndex(0)
    }
  }, [currentIndex, items.length])
  
  React.useEffect(() => () => clearResumeTimeout(), [clearResumeTimeout])
  
  return (
    <div className="relative w-full">
      <div
        ref={carouselRef}
        className="flex overflow-x-auto scroll-smooth snap-x snap-mandatory scrollbar-hide w-full"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ 
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {items.map((p, index) => (
          <NavLink
            key={p.id}
            to={`/product/${p.id}`}
            className="min-w-full snap-center px-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 group"
            onFocus={() => {
              setAutoPlayPaused(true)
              setCurrentIndex(index)
              clearResumeTimeout()
            }}
            onBlur={() => scheduleResume()}
          >
            <div
              className={`bg-[#161f38] rounded-lg overflow-hidden transition-colors duration-300 ${
                index === currentIndex
                  ? 'border border-blue-500/70 shadow-lg shadow-blue-500/20'
                  : 'border border-white/10 hover:border-blue-500/50'
              }`}
              onMouseEnter={() => {
                setAutoPlayPaused(true)
                setCurrentIndex(index)
                clearResumeTimeout()
              }}
              onMouseLeave={() => scheduleResume()}
            >
              <div className="relative w-full overflow-hidden aspect-[16/9] bg-[#161f38] flex items-center justify-center">
                <LazyImage
                  src={getPrimaryImage(p)}
                  alt={p.name}
                  className={computeProductImageClass(p, 'w-full h-full group-hover:scale-105 transition-transform duration-300')}
                  wrapperClassName={computeProductWrapperClass(p, 'w-full h-full')}
                />
              </div>
              <div className="p-4 space-y-3">
                <h3 className="text-base font-extrabold text-white/90 font-display">{p.name}</h3>
                <span className="text-blue-400 font-bold">{formatPrice(p.price)}</span>
                <button 
                  onClick={(e) => { e.preventDefault(); addItem(p, 1) }}
                  className="self-start px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm transition-colors shadow-lg"
                >
                  Купить
                </button>
              </div>
          </div>
          </NavLink>
        ))}
      </div>
      
      {/* Индикаторы */}
      {items.length > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {items.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                setCurrentIndex(index)
                setAutoPlayPaused(true)
                scheduleResume()
              }}
              className={`h-2 rounded-full transition-all ${
                index === currentIndex ? 'bg-blue-500 w-8' : 'bg-white/30 w-2'
              }`}
              aria-label={`Перейти к слайду ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
// 
function Product() {
  const { id } = useParams()
  const { addItem } = useCart()
  const { formatPrice } = useLang()
  const [version, setVersion] = React.useState(0)
  
  React.useEffect(() => {
    const onProductsLoaded = () => setVersion(v => v + 1)
    window.addEventListener('products-loaded', onProductsLoaded)
    return () => window.removeEventListener('products-loaded', onProductsLoaded)
  }, [])
  
  const product = React.useMemo(() => {
    const byId = DATA.products.find(p => p.id === id)
    if (byId) return byId
    return DATA.products.find(p => String(p.id) === String(id)) || null
  }, [id, version])

  const images = React.useMemo(() => collectProductImages(product), [product])
  
  const [idx, setIdx] = React.useState(0)
  const [touchStart, setTouchStart] = React.useState(null)
  const [touchEnd, setTouchEnd] = React.useState(null)
  const [autoPlayPaused, setAutoPlayPaused] = React.useState(false)
  const go = (d) => {
    if (images.length === 0) return
    setIdx(i => (i + d + images.length) % images.length)
    setAutoPlayPaused(true)
    // Возобновляем автоплей через 10 секунд после взаимодействия
    setTimeout(() => setAutoPlayPaused(false), 10000)
  }
  
  // Автоматическая карусель - смена фото каждые 5 секунд
  React.useEffect(() => {
    if (images.length <= 1 || autoPlayPaused) return
    const interval = setInterval(() => {
      setIdx(i => (i + 1) % images.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [images.length, images, autoPlayPaused])
  
  // Сброс индекса при смене продукта
  React.useEffect(() => {
    setIdx(0)
    setAutoPlayPaused(false)
  }, [id])
  
  // Состояние для комментариев
  const [reviews, setReviews] = React.useState([])
  const [showReviewForm, setShowReviewForm] = React.useState(false)
  const [newReview, setNewReview] = React.useState({ author: '', rating: 5, text: '' })
  
  // Обновление имени при открытии формы
  React.useEffect(() => {
    if (showReviewForm) {
      const savedName = localStorage.getItem('profile-name') || ''
      if (savedName && !newReview.author) {
        setNewReview(prev => ({ ...prev, author: savedName }))
      }
    }
  }, [showReviewForm])
  
  // Загрузка комментариев из localStorage
  React.useEffect(() => {
    if (!product) return
    const key = `product-reviews-${product.id}`
    const versionKey = `${key}-version`
    try {
      const saved = localStorage.getItem(key)
      const savedVersion = localStorage.getItem(versionKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && savedVersion === REVIEW_STORAGE_USER_TAG) {
          setReviews(parsed)
          return
        }
        if (Array.isArray(parsed) && savedVersion === REVIEW_STORAGE_AUTO_TAG) {
          setReviews(parsed)
          return
        }
      }

      const defaultReviews = createDefaultReviews(product)
      setReviews(defaultReviews)
      localStorage.setItem(key, JSON.stringify(defaultReviews))
      localStorage.setItem(versionKey, REVIEW_STORAGE_AUTO_TAG)
    } catch (e) {
      console.error('Error loading reviews:', e)
      setReviews([])
      try {
        localStorage.removeItem(key)
        localStorage.removeItem(versionKey)
      } catch {}
    }
  }, [product])
  
  // Сохранение комментариев
  const saveReviews = (newReviews) => {
    if (!product) return
    const key = `product-reviews-${product.id}`
    const versionKey = `${key}-version`
    try {
      localStorage.setItem(key, JSON.stringify(newReviews))
      localStorage.setItem(versionKey, REVIEW_STORAGE_USER_TAG)
      setReviews(newReviews)
    } catch (e) {
      console.error('Error saving reviews:', e)
    }
  }
  
  // Добавление нового комментария
  const handleAddReview = (e) => {
    e.preventDefault()
    if (!newReview.author.trim() || !newReview.text.trim()) return
    
    const userName = localStorage.getItem('profile-name') || newReview.author
    const date = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    
    const review = {
      author: userName,
      rating: newReview.rating,
      text: newReview.text,
      date: date
    }
    
    const updated = [review, ...reviews]
    saveReviews(updated)
    const savedName = localStorage.getItem('profile-name') || ''
    setNewReview({ author: savedName, rating: 5, text: '' })
    setShowReviewForm(false)
  }
  
  // Swipe handlers
  const minSwipeDistance = 50
  const onTouchStart = (e) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }
  const onTouchMove = (e) => setTouchEnd(e.targetTouches[0].clientX)
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance
    if (isLeftSwipe) go(1)
    if (isRightSwipe) go(-1)
  }

  const recommendations = React.useMemo(() => {
    const list = DATA.products.filter(p => p.id !== (product?.id || ''))
    const arr = [...list]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr.slice(0, 4)
  }, [product])
  const [activeRecommendation, setActiveRecommendation] = React.useState(0)
  const [recommendationsPaused, setRecommendationsPaused] = React.useState(false)
  const recommendationsResumeRef = React.useRef(null)

  const pauseRecommendations = React.useCallback((index = null) => {
    if (recommendationsResumeRef.current) {
      clearTimeout(recommendationsResumeRef.current)
      recommendationsResumeRef.current = null
    }
    setRecommendationsPaused(true)
    if (typeof index === 'number' && !Number.isNaN(index)) {
      setActiveRecommendation(index % Math.max(recommendations.length, 1))
    }
  }, [recommendations.length])

  const resumeRecommendations = React.useCallback(() => {
    if (recommendationsResumeRef.current) {
      clearTimeout(recommendationsResumeRef.current)
    }
    recommendationsResumeRef.current = setTimeout(() => {
      setRecommendationsPaused(false)
      recommendationsResumeRef.current = null
    }, 5000)
  }, [])

  React.useEffect(() => {
    if (activeRecommendation >= recommendations.length) {
      setActiveRecommendation(0)
    }
  }, [activeRecommendation, recommendations.length])

  React.useEffect(() => {
    setActiveRecommendation(0)
    setRecommendationsPaused(false)
    if (recommendationsResumeRef.current) {
      clearTimeout(recommendationsResumeRef.current)
      recommendationsResumeRef.current = null
    }
  }, [product?.id, recommendations.length])

  React.useEffect(() => {
    if (recommendations.length <= 1 || recommendationsPaused) return undefined
    const id = setInterval(() => {
      setActiveRecommendation((idx) => (idx + 1) % recommendations.length)
    }, 6000)
    return () => clearInterval(id)
  }, [recommendations.length, recommendationsPaused])

  React.useEffect(
    () => () => {
      if (recommendationsResumeRef.current) {
        clearTimeout(recommendationsResumeRef.current)
      }
    },
    []
  )

  const getRarityClasses = (rarity) => {
    switch (String(rarity || '').toLowerCase()) {
      case '':
      case 'covert':
        return 'bg-red-600 text-white'
      case 'classified':
        return 'bg-pink-600 text-white'
      case 'restricted':
        return 'bg-purple-600 text-white'
      case 'mil-spec':
        return 'bg-blue-600 text-white'
      case 'consumer grade':
        return 'bg-gray-600 text-white'
      case 'rare':
        return 'bg-green-600 text-white'
      case 'unusual':
        return 'bg-fuchsia-600 text-white'
      case 'immortal':
        return 'bg-amber-500 text-black'
      case 'souvenir':
        return 'bg-yellow-400 text-black'
      default:
        return 'bg-[#0D1A2F] text-white/70 border border-white/10'
    }
  }
  if (!product) {
    return (
      <section className="space-y-6">
        <h2 className="text-2xl font-bold">Товар не найден</h2>
        <p className="text-white/70">Запрашиваемый товар не существует.</p>
        <NavLink to="/store" className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
          Вернуться в каталог
        </NavLink>
      </section>
    )
  }
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold">{product.name}</h2>
      <div className="space-y-6">
        <div className="p-3 sm:p-4 rounded-lg border border-white/10 bg-[#0D1A2F]">
          <div
            className="relative w-full rounded-lg bg-[#161f38] overflow-hidden group aspect-[16/9] min-h-[200px] sm:min-h-[280px]"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
              <LazyImage 
              src={images.length > 0 ? images[idx] : PLACEHOLDER_IMAGE}
              alt={`${product.name}-${idx + 1}`}
              className={computeProductImageClass(product, 'w-full h-full transition-opacity duration-500')}
              wrapperClassName={computeProductWrapperClass(product, 'absolute inset-0 p-4 sm:p-6 md:p-8')}
            />
            {images.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); go(-1) }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20"
                  aria-label="Предыдущее изображение"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); go(1) }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20"
                  aria-label="Следующее изображение"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex justify-center gap-2 mt-4">
                  {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  aria-label={`go-${i}`}
                  className={`h-2.5 w-2.5 rounded-full transition-all ${i === idx ? 'bg-[#4A90E2] w-6' : 'bg-white/30 hover:bg-white/50'}`}
                ></button>
                  ))}
                </div>
            )}
          </div>
        <div className="p-4 rounded-lg border border-white/10 bg-[#0D1A2F] flex flex-col pt-8 sm:pt-10">
          <h1 className="text-3xl font-bold">{product.name}</h1>
          {product.category === 'skin' && product.rarity && (
            <div className="mt-2">
              <span className={`inline-block px-2 py-0.5 rounded text-xs ${getRarityClasses(product.rarity)}`}>
                {product.rarity}
              </span>
            </div>
          )}
          <div className="mt-4 flex items-center gap-4 flex-wrap">
            <span className="text-2xl font-bold text-green-400">{formatPrice(getDisplayPrice(product))}</span>
            <CartQuantityControl product={product} className="px-4" />
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-3">Описание</h3>
            <p className="text-white/70 text-base leading-relaxed whitespace-pre-line">{product.fullDescription || product.description || 'Описание отсутствует.'}</p>
          </div>

          {/* Отзывы */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Отзывы покупателей</h3>
              <button
                onClick={() => setShowReviewForm(!showReviewForm)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
              >
                {showReviewForm ? 'Отмена' : 'Добавить отзыв'}
              </button>
                        </div>
            
            {/* Форма добавления отзыва */}
            {showReviewForm && (
              <form onSubmit={handleAddReview} className="mb-6 bg-[#161f38] rounded-lg p-4 border border-white/10">
                <div className="space-y-4">
                        <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">Ваше имя</label>
                    <input
                      type="text"
                      value={newReview.author}
                      onChange={(e) => setNewReview({...newReview, author: e.target.value})}
                      placeholder="Введите ваше имя"
                      className="w-full px-4 py-2 bg-[#0f172a] border border-white/20 rounded-lg text-white placeholder-white/50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      required
                    />
                        </div>
                  
                        <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">Оценка</label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setNewReview({...newReview, rating: star})}
                          className={`text-xl sm:text-2xl leading-none transition-colors ${
                            star <= newReview.rating ? 'text-yellow-400' : 'text-white/30'
                          } hover:text-yellow-400`}
                        >
                          ★
                        </button>
                        ))}
                      </div>
                    </div>
                  
                        <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">Ваш отзыв</label>
                    <textarea
                      value={newReview.text}
                      onChange={(e) => setNewReview({...newReview, text: e.target.value})}
                      placeholder="Напишите ваш отзыв..."
                      rows="4"
                      className="w-full px-4 py-2 bg-[#0f172a] border border-white/20 rounded-lg text-white placeholder-white/50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none"
                      required
                    />
                        </div>
                  
                  <button
                    type="submit"
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
                  >
                    Отправить отзыв
                  </button>
                      </div>
              </form>
            )}
            
            <div className="space-y-4">
              {reviews.length > 0 ? (
                reviews.map((review, idx) => {
                  const colors = [
                    'from-blue-500 to-purple-500',
                    'from-green-500 to-teal-500',
                    'from-purple-500 to-pink-500',
                    'from-orange-500 to-red-500',
                    'from-cyan-500 to-blue-500',
                    'from-yellow-500 to-orange-500',
                    'from-pink-500 to-rose-500',
                    'from-indigo-500 to-purple-500'
                  ]
                  const colorClass = colors[idx % colors.length]
                  return (
                  <div key={idx} className="bg-[#161f38] rounded-lg p-4 border border-white/10">
                    <div className="flex flex-col gap-2 mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${colorClass} flex items-center justify-center text-white font-bold flex-shrink-0`}>
                          {review.author.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-white whitespace-nowrap">{review.author} <span className="text-xs text-white/60 font-normal">{review.date}</span></div>
                        </div>
                      </div>
                      {renderRatingStars(review.rating, 'text-sm sm:text-base')}
                    </div>
                    <p className="text-white/80 text-sm leading-relaxed">{review.text}</p>
                  </div>
                  );
                })
              ) : (
                <div className="text-white/60 text-sm">Пока нет отзывов. Станьте первым!</div>
              )}
            </div>
          </div>
          {product.category === 'game' && (
            <div className="mt-6">
              <ul className="mt-2 text-white/70 text-sm space-y-1">
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Рекомендации - десктоп версия */}
      {recommendations.length > 0 && (
        <div className="space-y-3 hidden md:block">
          <h3 className="text-xl font-bold">Рекомендуем также</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full max-w-full justify-items-center">
            {recommendations.map((p, index) => (
              <NavLink
                key={p.id}
                to={`/product/${p.id}`}
                className={`rounded-lg overflow-hidden transition-all w-full max-w-full group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  index === activeRecommendation
                    ? 'bg-[#1a2646] border border-blue-500/60 shadow-lg shadow-blue-500/20'
                    : 'bg-[#161f38] border border-white/10 hover:border-blue-500/50'
                }`}
                onMouseEnter={() => pauseRecommendations(index)}
                onFocus={() => pauseRecommendations(index)}
                onMouseLeave={resumeRecommendations}
                onBlur={resumeRecommendations}
              >
                <div className="relative bg-[#0f172a] min-h-[200px] flex items-center justify-center">
                  <LazyImage
                    src={getPrimaryImage(p)}
                    alt={p.name}
                    className={computeProductImageClass(p, 'max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105')}
                    wrapperClassName={computeProductWrapperClass(p, 'w-full h-full flex items-center justify-center')}
                  />
                </div>
                <div className="p-3 space-y-2">
                  <h3 className="text-sm font-extrabold text-white/90 truncate font-display">{p.name}</h3>
                  <span className="text-blue-400 font-bold text-sm">{formatPrice(p.price)}</span>
                  <button 
                    onClick={(e) => { e.preventDefault(); addItem(p, 1) }}
                    className="self-start px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs transition-colors shadow-lg"
                  >
                    Купить
                  </button>
                </div>
              </NavLink>
            ))}
          </div>
        </div>
      )}
      
      {/* Мобильная версия - свайп карусель */}
      {recommendations.length > 0 && (
        <div className="space-y-3 md:hidden mt-8">
          <h3 className="text-xl font-bold">Рекомендуем также</h3>
          <MobileSwipeCarousel items={recommendations} addItem={addItem} formatPrice={formatPrice} />
        </div>
      )}
    </section>
  )
}
// 
function Home() {
  const { formatPrice } = useLang()
  const { cmsContent } = useCMS()
  const [version, setVersion] = React.useState(0)
  
  React.useEffect(() => {
    const onProductsLoaded = () => setVersion(v => v + 1)
    window.addEventListener('products-loaded', onProductsLoaded)
    return () => window.removeEventListener('products-loaded', onProductsLoaded)
  }, [])

  const [remaining, setRemaining] = React.useState('')
  const endsAtRef = React.useRef(Date.now() + 24 * 60 * 60 * 1000) // 
  React.useEffect(() => {
    const update = () => {
      const diff = endsAtRef.current - Date.now()
      if (diff <= 0) { setRemaining('00:00:00'); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setRemaining(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`)
    }
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [])

  const { addItem } = useCart()
  const addToCart = (product) => {
    const qtyStr = window.prompt('', '1')
    const qty = parseInt(qtyStr || '0', 10)
    if (!Number.isNaN(qty) && qty > 0) {
      addItem(product, qty)
    }
  }

  // 
  const promoRef = React.useRef(null)
  const promoTimerRef = React.useRef(null)
  const promoStep = () => {
    const el = promoRef.current
    if (!el) return
    const first = el.firstElementChild
    const step = first ? first.getBoundingClientRect().width + 24 : 320
    const nearEnd = el.scrollLeft + el.clientWidth + step >= el.scrollWidth - 4
    if (nearEnd) {
      el.scrollTo({ left: 0, behavior: 'smooth' })
    } else {
      el.scrollBy({ left: step, behavior: 'smooth' })
    }
  }
  const startPromo = () => { if (!promoTimerRef.current) promoTimerRef.current = setInterval(promoStep, 2500) }
  const stopPromo = () => { if (promoTimerRef.current) { clearInterval(promoTimerRef.current); promoTimerRef.current = null } }
  React.useEffect(() => {
    const el = promoRef.current
    if (!el) return
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => { entry.isIntersecting ? startPromo() : stopPromo() })
    }, { root: null, threshold: 0.1 })
    observer.observe(el)
    const onEnter = () => stopPromo()
    const onLeave = () => startPromo()
    el.addEventListener('mouseenter', onEnter)
    el.addEventListener('mouseleave', onLeave)
    startPromo()
    return () => { observer.disconnect(); el.removeEventListener('mouseenter', onEnter); el.removeEventListener('mouseleave', onLeave); stopPromo() }
  }, [])

  const promoItems = React.useMemo(() => {
    const items = DATA.products.filter((p) => {
      const src = getPrimaryImage(p)
      return src && !String(src).includes('/images/logo/logo.png')
    })
    const arr = [...items]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr.slice(0, 10).map((p) => {
      const discountPercent = getStableDiscountPercent(p, 18, 45)
      const originalPrice = getOriginalPrice(p, discountPercent)
      return {
        product: p,
        src: getPrimaryImage(p),
        to: `/product/${p.id}`,
        name: p.name,
        price: p.price,
        discountPercent,
        originalPrice,
        isSkin: p.category === 'skin'
      }
    })
  }, [version])
  
  // 
  const gamesShuffled = React.useMemo(() => {
    const list = DATA.products.filter(p => p.category === 'game')
    const arr = [...list]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }, [version])
  
  // Выбираем 4 или 8 игр случайным образом
  const gamesCount = React.useMemo(() => {
    return Math.random() > 0.5 ? 4 : 8
  }, [version])
  const gamesRow1 = React.useMemo(() => gamesShuffled.slice(0, gamesCount), [gamesShuffled, gamesCount])
  
  // Скины для главной страницы
  const skinsShuffled = React.useMemo(() => {
    const list = DATA.products.filter(isSkinProduct)
    const arr = [...list]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr.slice(0, 4) // 4 скина
  }, [version])
  
  // Динамический баннер - случайная игра
  const bannerGame = React.useMemo(() => {
    const games = DATA.products.filter(p => p.category === 'game')
    if (games.length === 0) return null
    const randomIndex = Math.floor(Math.random() * games.length)
    return games[randomIndex]
  }, [version])
  
  // Обновляем баннер каждые 30 секунд
  React.useEffect(() => {
    const interval = setInterval(() => {
      setVersion(v => v + 1)
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  const scrollToRoulette = React.useCallback(() => {
    const el = document.getElementById('roulette-anchor')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])
  return (
    <section className="space-y-6 sm:space-y-8 w-full max-w-full overflow-x-hidden">

      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#0a0f1c] via-[#1a1f3a] to-[#2d1b69] min-h-[300px] sm:min-h-[400px] md:min-h-[500px] flex items-center">

        <div className="absolute inset-0">

          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"></div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1 sm:gap-2 w-full h-full p-2 sm:p-4 opacity-20" style={{ gridAutoRows: 'minmax(60px, 100px)' }}>
              {DATA.products.slice(0, 25).map((p) => (
                <div key={p.id} className="relative rounded-lg overflow-hidden" style={{ aspectRatio: '1 / 1' }}>
                  <LazyImage
                    src={getPrimaryImage(p)}
                    alt={p.name}
                    className={computeProductImageClass(p, 'w-full h-full')}
                    wrapperClassName={computeProductWrapperClass(p, 'w-full h-full')}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="absolute top-0 left-0 w-48 h-48 sm:w-64 sm:h-64 md:w-96 md:h-96 bg-blue-500/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 right-0 w-48 h-48 sm:w-64 sm:h-64 md:w-96 md:h-96 bg-purple-500/20 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>
          <div className="absolute top-1/2 left-1/2 w-32 h-32 sm:w-48 sm:h-48 md:w-64 md:h-64 bg-cyan-400/10 rounded-full blur-2xl -translate-x-1/2 -translate-y-1/2"></div>
        </div>
        

        <div className="relative z-10 w-full px-4 sm:px-6 md:px-8 py-6 sm:py-8 md:py-12">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full border border-blue-400/30 mb-4 sm:mb-6">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-400 rounded-full animate-pulse"></span>
              <span className="text-xs sm:text-sm font-medium">Акция</span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-black bg-gradient-to-r from-white via-blue-100 to-purple-200 bg-clip-text text-transparent mb-4 sm:mb-6 leading-tight px-2">
              {bannerGame ? `-30% на ${bannerGame.name}` : cmsContent.bannerTitle}
            </h1>
            
            <p className="text-sm sm:text-base md:text-lg lg:text-xl text-white/80 mb-6 sm:mb-8 max-w-2xl mx-auto leading-relaxed px-4">
              {bannerGame ? `Спешите купить ${bannerGame.name} по акции! Ограниченное предложение.` : cmsContent.bannerDescription}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center px-4">
              {bannerGame ? (
                <NavLink 
                  to={`/product/${bannerGame.id}`}
                  className="group relative w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-lg sm:rounded-xl font-bold text-sm sm:text-base text-white transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/25 sm:min-w-[200px] text-center"
                >
                  Купить {bannerGame.name}
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-400 rounded-lg sm:rounded-xl blur opacity-0 group-hover:opacity-30 transition-opacity duration-300"></div>
                </NavLink>
              ) : (
                <NavLink 
                  to="/store" 
                  className="group relative w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-lg sm:rounded-xl font-bold text-sm sm:text-base text-white transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/25 sm:min-w-[200px] text-center"
                >
                  {cmsContent.bannerButton1 || 'Купить со скидкой'}
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-400 rounded-lg sm:rounded-xl blur opacity-0 group-hover:opacity-30 transition-opacity duration-300"></div>
                </NavLink>
              )}
              
              <NavLink 
                to="/store" 
                className="group w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 hover:border-white/40 rounded-lg sm:rounded-xl font-bold text-sm sm:text-base text-white transition-all duration-300 transform hover:scale-105 sm:min-w-[200px] text-center"
              >
                {cmsContent.bannerButton2 || 'Посмотреть каталог'}
              </NavLink>
            </div>

          </div>
        </div>
        

        <div className="absolute top-2 right-2 sm:top-4 sm:right-4 w-16 h-16 sm:w-24 sm:h-24 md:w-32 md:h-32 border border-white/10 rounded-full animate-spin" style={{animationDuration: '20s'}}></div>
        <div className="absolute bottom-2 left-2 sm:bottom-4 sm:left-4 w-12 h-12 sm:w-16 sm:h-16 md:w-24 md:h-24 border border-blue-400/20 rounded-full animate-pulse"></div>
      </div>
      {/* Промо слайдшоу */}
      <div className="space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between px-2 sm:px-0">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
            Акции
          </h2>
        </div>
        
        <div className="relative">
          <div ref={promoRef} className="flex gap-3 sm:gap-4 md:gap-6 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-4 scrollbar-hide px-2 sm:px-0">
            {promoItems.map((item, i) => (
              <NavLink to={item.to} key={i} className="group snap-start shrink-0 w-[280px] sm:w-[320px] md:w-[380px]">
                <div className="relative h-48 w-full rounded-2xl overflow-hidden bg-gradient-to-br from-[#161f38] to-[#1f2a4a] border border-white/10 hover:border-blue-400/50 transition-all duration-300 transform hover:scale-[1.02] hover:shadow-2xl hover:shadow-blue-500/20">
                  <LazyImage
                    src={item.src}
                    alt={item.product.name}
                    className={computeProductImageClass(item.product, 'h-full w-full transition-transform duration-500')}
                    wrapperClassName={computeProductWrapperClass(item.product, 'h-full w-full')}
                  />
                  
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                  
                  <div className="absolute top-4 left-4 px-3 py-1 bg-gradient-to-r from-red-500 to-pink-500 text-white text-sm font-bold rounded-full shadow-lg">
                    -{item.discountPercent}%
                  </div>
                  
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <h3 className="text-white font-bold text-lg mb-2 truncate">{item.product.name}</h3>
                    <div className="flex items-center justify-between">
                      <div className="flex items-baseline gap-2">
                        {item.originalPrice ? (
                          <span className="text-white/60 line-through text-sm">{formatPrice(item.originalPrice)}</span>
                        ) : (
                          <span className="text-white/60 line-through text-sm">{formatPrice(item.product.price * 1.35)}</span>
                        )}
                        <span className="text-blue-400 font-bold text-xl">{formatPrice(item.product.price)}</span>
                      </div>
                      <button 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); addItem(item.product, 1) }}
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-lg text-white font-medium transition-all duration-300 transform hover:scale-105"
                      >
                        Купить
                      </button>
                    </div>
                  </div>
                  
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/10 to-purple-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </div>
              </NavLink>
            ))}
          </div>
          
          <div className="flex justify-center mt-4 gap-2">
            {promoItems.slice(0, 5).map((_, i) => (
              <div key={i} className="w-2 h-2 rounded-full bg-white/20"></div>
            ))}
          </div>
        </div>
      </div>

      {/* 1. Игры */}
      <div className="space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between px-2 sm:px-0">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-green-200 bg-clip-text text-transparent">
            Игры
          </h2>
          <NavLink to="/games" className="group flex items-center gap-1 sm:gap-2 text-blue-400 hover:text-blue-300 transition-colors text-sm sm:text-base">
            <span className="hidden sm:inline">Все игры</span>
            <span className="sm:hidden">Все</span>
            <svg className="w-3 h-3 sm:w-4 sm:h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </NavLink>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4 sm:gap-5 md:gap-6 w-full max-w-full justify-items-center">
          {gamesRow1.map((product) => {
            const ratingValue = getStableRating(product)
            const ratingDisplay = ratingValue.toFixed(1)
            return (
              <NavLink
                key={product.id}
                to={`/product/${product.id}`}
                className="group w-full max-w-full"
              >
              <div className="relative bg-gradient-to-br from-[#161f38] to-[#1f2a4a] rounded-2xl overflow-hidden border border-white/10 hover:border-green-400/50 transition-all duration-300 transform hover:scale-[1.02] hover:shadow-2xl hover:shadow-green-500/20 w-full">
                <div className="relative h-48 overflow-hidden">
                    <LazyImage
                      src={getPrimaryImage(product)}
                      alt={product.name}
                      className={computeProductImageClass(product, 'h-full w-full transition-transform duration-500 group-hover:scale-110')}
                      wrapperClassName={computeProductWrapperClass(product, 'h-full w-full')}
                    />

                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>

                  <div className="absolute top-3 right-3 px-3 py-1 bg-black/50 backdrop-blur-sm rounded-full">
                    <span className="text-xs text-white/90 font-medium uppercase tracking-wide">{product.type}</span>
                  </div>

                  <div className="absolute top-3 left-3 flex items-center gap-1 px-2 py-1 bg-black/50 backdrop-blur-sm rounded-full">
                    <svg className="w-3 h-3 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                      <span className="text-xs text-white font-medium">{ratingDisplay}</span>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="text-white font-bold text-lg mb-2">{product.name}</h3>
                    <div className="flex items-center justify-between">
                      <span className="text-green-400 font-bold text-xl">{formatPrice(getDisplayPrice(product))}</span>
                      <button 
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            addItem(product, 1)
                          }}
                        className="px-4 py-2 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-500 hover:to-blue-500 rounded-lg text-white font-medium transition-all duration-300 transform hover:scale-105"
                      >
                        Купить
                      </button>
                    </div>
                  </div>
                </div>

                <div className="absolute inset-0 bg-gradient-to-r from-green-500/0 via-green-500/5 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
              </div>
            </NavLink>
            )
          })}
        </div>
      </div>

      {/* 2. Скины */}
      <div className="space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between px-2 sm:px-0">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
            Скины
          </h2>
          <NavLink to="/skins" className="group flex items-center gap-1 sm:gap-2 text-purple-400 hover:text-purple-300 transition-colors text-sm sm:text-base">
            <span className="hidden sm:inline">Все скины</span>
            <span className="sm:hidden">Все</span>
            <svg className="w-3 h-3 sm:w-4 sm:h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </NavLink>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4 sm:gap-5 md:gap-6 w-full max-w-full justify-items-center">
          {skinsShuffled.map(product => (
            <NavLink key={product.id} to={`/product/${product.id}`} className="group w-full max-w-full">
              <div className="relative bg-gradient-to-br from-[#161f38] to-[#1f2a4a] rounded-2xl overflow-hidden border border-white/10 hover:border-purple-400/50 transition-all duration-300 transform hover:scale-[1.02] hover:shadow-2xl hover:shadow-purple-500/20 w-full">
                <div className="relative h-48 overflow-hidden">
                  <LazyImage
                    src={getPrimaryImage(product)}
                    alt={product.name}
                    className={computeProductImageClass(product, 'h-full w-full transition-transform duration-500 group-hover:scale-110')}
                    wrapperClassName={computeProductWrapperClass(product, 'h-full w-full')}
                  />
                  
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                  
                  <div className="absolute top-3 right-3 px-3 py-1 bg-black/50 backdrop-blur-sm rounded-full">
                    <span className="text-xs text-white/90 font-medium uppercase tracking-wide">{product.rarity || 'Rare'}</span>
                  </div>
                  
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="text-white font-bold text-lg mb-2">{product.name}</h3>
                    <div className="flex items-center justify-between">
                      <span className="text-purple-400 font-bold text-xl">{formatPrice(getDisplayPrice(product))}</span>
                      <button 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); addItem(product, 1) }}
                        className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-lg text-white font-medium transition-all duration-300 transform hover:scale-105"
                      >
                        Купить
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-purple-500/5 to-pink-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
              </div>
            </NavLink>
          ))}
        </div>
      </div>

      {/* 3. Рулетка */}
      <div id="roulette-anchor" className="space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between px-2 sm:px-0">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-yellow-200 bg-clip-text text-transparent">
            🎰 Рулетка
          </h2>
          <NavLink to="/roulette" className="group flex items-center gap-1 sm:gap-2 text-yellow-400 hover:text-yellow-300 transition-colors text-sm sm:text-base">
            <span className="hidden sm:inline">Попробовать</span>
            <span className="sm:hidden">Попробовать</span>
            <svg className="w-3 h-3 sm:w-4 sm:h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </NavLink>
        </div>
        
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#1a0f2e] via-[#2d1b69] to-[#4c1d95] p-4 sm:p-6 md:p-8 border border-purple-500/30 mx-2 sm:mx-0">

          <div className="absolute inset-0">
            <div className="absolute top-0 left-0 w-64 h-64 bg-yellow-500/10 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
            <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-pink-500/10 rounded-full blur-2xl animate-pulse" style={{animationDelay: '0.5s'}}></div>
          </div>
          
          <div className="relative z-10 text-center space-y-6">
            {/* Анимация вращения */}
            <div className="relative inline-block">
              <div className="text-6xl animate-spin" style={{animationDuration: '3s'}}>🎁</div>
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/20 to-purple-400/20 rounded-full blur opacity-0 group-hover:opacity-30 transition-opacity duration-300"></div>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                Поздравляем с победой!
              </h3>
              <p className="text-lg text-white/80 max-w-md mx-auto">
                Вы выиграли приз! Теперь вы можете выбрать игру или скин из нашего каталога. Спасибо за участие - мы ценим каждого клиента и готовы предложить лучшие цены!
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <NavLink 
                to="/roulette" 
                className="group relative px-8 py-4 bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 hover:from-yellow-400 hover:via-orange-400 hover:to-red-400 rounded-xl font-bold text-white transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-orange-500/25 min-w-[200px]"
              >
                <span className="relative z-10">Попробуй удачу снова</span>
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-300 to-red-300 rounded-xl blur opacity-0 group-hover:opacity-30 transition-opacity duration-300"></div>
              </NavLink>
              
              <div className="text-center">
                <div className="text-sm text-white/60">Ваш выигрыш сохранён</div>
                <div className="text-xl font-bold text-yellow-400">$1.00</div>
              </div>
            </div>
            
            {/* Статистика */}
            <div className="grid grid-cols-3 gap-4 max-w-md mx-auto pt-4 border-t border-white/10">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">87%</div>
                <div className="text-xs text-white/60">После входа через Steam ваш профиль будет сохранён на устройстве.</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-400">2.5x</div>
                <div className="text-xs text-white/60">Бонусы. Призы и выигрыши</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-400">1,247</div>
                <div className="text-xs text-white/60">Довольных клиентов</div>
              </div>
            </div>
          </div>
          
          {/* Декоративные элементы */}
          <div className="absolute top-4 right-4 w-16 h-16 border-2 border-yellow-400/30 rounded-full animate-spin" style={{animationDuration: '8s'}}></div>
          <div className="absolute bottom-4 left-4 w-12 h-12 border-2 border-purple-400/30 rounded-full animate-ping"></div>
        </div>
      </div>
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <h2 className="text-4xl font-bold bg-gradient-to-r from-white via-blue-200 to-purple-200 bg-clip-text text-transparent">

          </h2>
          <p className="text-lg text-white/70 max-w-2xl mx-auto">
            Узнайте, что говорят наши клиенты о наших услугах и сервисе. Мы гордимся своей репутацией и стремимся предоставить лучший сервис для каждого клиента.
          </p>
        </div>

        {/* Карусель отзывов */}
        <div className="relative overflow-hidden">
          <div className="flex gap-6 animate-scroll-x">
            {/* Отзыв 1 */}
            <div className="min-w-[350px] bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f172a] rounded-2xl p-6 border border-white/10 hover:border-blue-500/30 transition-all duration-300 hover:transform hover:scale-105">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                  А
                </div>
                <div>
                  <div className="font-semibold text-white">Алексей_Pro</div>
                  <StarsRow className="text-xs sm:text-sm mt-1" />
                </div>
              </div>
              <p className="text-white/80 leading-relaxed">
                Отличный магазин! Купил несколько игр, все работает идеально. Быстрая доставка, хорошие цены. Рекомендую всем геймерам!
              </p>
              <div className="mt-4 text-xs text-white/50">
                2 дня назад
              </div>
            </div>

            <div className="min-w-[350px] bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f172a] rounded-2xl p-6 border border-white/10 hover:border-green-500/30 transition-all duration-300 hover:transform hover:scale-105">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-teal-500 rounded-full flex items-center justify-center text-white font-bold">
                  М
                </div>
                <div>
                  <div className="font-semibold text-white">MaxGamer2024</div>
                  <StarsRow className="text-xs sm:text-sm mt-1" />
                </div>
              </div>
              <p className="text-white/80 leading-relaxed">
                Покупал скины для CS2. Огромный выбор, все легально. Поддержка отвечает быстро, помогли с выбором. Очень доволен!
              </p>
              <div className="mt-4 text-xs text-white/50">
                5 дней назад
              </div>
            </div>

            <div className="min-w-[350px] bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f172a] rounded-2xl p-6 border border-white/10 hover:border-purple-500/30 transition-all duration-300 hover:transform hover:scale-105">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold">
                  Д
                </div>
                <div>
                  <div className="font-semibold text-white">DarkKnight</div>
                  <StarsRow className="text-xs sm:text-sm mt-1" />
                </div>
              </div>
              <p className="text-white/80 leading-relaxed">
                Лучший магазин игр! Всегда актуальные цены, регулярные скидки. Заказал Cyberpunk 2077, получил ключ моментально. Надежный сервис!
              </p>
              <div className="mt-4 text-xs text-white/50">
                1 неделю назад
              </div>
            </div>

            <div className="min-w-[350px] bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f172a] rounded-2xl p-6 border border-white/10 hover:border-orange-500/30 transition-all duration-300 hover:transform hover:scale-105">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center text-white font-bold">
                  С
                </div>
                <div>
                  <div className="font-semibold text-white">SteamLegend</div>
                  <StarsRow className="text-xs sm:text-sm mt-1" />
                </div>
              </div>
              <p className="text-white/80 leading-relaxed">
                Продал здесь свои скины, получил деньги быстро. Удобный интерфейс, честные цены. Теперь это мой основной магазин для игр и скинов!
              </p>
              <div className="mt-4 text-xs text-white/50">
                2 недели назад
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
          <div className="text-center p-4 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl border border-white/10">
            <div className="text-3xl font-bold text-green-400">4.9</div>
            <div className="text-sm text-white/70 mt-1">Средняя оценка</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl border border-white/10">
            <div className="text-3xl font-bold text-blue-400">15,247</div>
            <div className="text-sm text-white/70 mt-1">Довольных клиентов</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl border border-white/10">
            <div className="text-3xl font-bold text-purple-400">98%</div>
            <div className="text-sm text-white/70 mt-1">Положительных отзывов</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-xl border border-white/10">
            <div className="text-3xl font-bold text-yellow-400">24/7</div>
            <div className="text-sm text-white/70 mt-1">Поддержка</div>
          </div>
        </div>
      </div>
    </section>
  )
}
// 
function Layout({ children }) {
  const { lang, setLang, formatPrice } = useLang()
  const company = getCompanyInfo()
  const [isAuthorized, setAuthorized] = React.useState(() => hasValidAuthSession())
  const [showLogin, setShowLogin] = React.useState(false)
  const [cookieConsent, setCookieConsent] = React.useState(() => typeof document !== 'undefined' && document.cookie.includes('cookie_consent=accepted'))
  const [walletUsd, setWalletUsd] = React.useState(() => {
    try { return parseFloat(localStorage.getItem('wallet-usd') || '0') } catch { return 0 }
  })
  // 
  const [name, setName] = React.useState(() => localStorage.getItem('profile-name') || '')
  const [avatar, setAvatar] = React.useState(() => localStorage.getItem('profile-avatar') || '')
  const [userRole, setUserRole] = React.useState(() => localStorage.getItem('role') || 'user')
  const isAdmin = userRole === 'admin'
  
  React.useEffect(() => {
    const syncWallet = () => setWalletUsd(parseFloat(localStorage.getItem('wallet-usd') || '0'))
    window.addEventListener('wallet-updated', syncWallet)
    window.addEventListener('storage', syncWallet)
    return () => { window.removeEventListener('wallet-updated', syncWallet); window.removeEventListener('storage', syncWallet) }
  }, [])
  
  // 
  React.useEffect(() => {
    let aborted = false
    const load = async () => {
      try {
        const res = await fetch('/products')
        const json = await res.json().catch(() => ({ ok: false }))
        const list = Array.isArray(json?.data) ? json.data : []
        if (!aborted && list.length > 0) {
          const incoming = prepareProducts(list.filter(Boolean))
          if (incoming.length > 0) {
            DATA.products = prepareProducts([...incoming, ...DATA.products])
            window.dispatchEvent(new Event('products-loaded'))
          }
        }
      } catch (e) {
        // ignore
      }
    }
    load()
    const interval = setInterval(load, 5 * 60 * 1000) // 
    return () => { aborted = true; clearInterval(interval) }
  }, [])
  
  const navigate = useNavigate()
  const steamRedirectRef = React.useRef(false)
  React.useEffect(() => {
    const sync = () => {
      setAuthorized(hasValidAuthSession())
      setName(localStorage.getItem('profile-name') || '')
      setAvatar(localStorage.getItem('profile-avatar') || '')
      setUserRole(localStorage.getItem('role') || 'user')
    }
    const onOpenLogin = () => setShowLogin(true)
    window.addEventListener('storage', sync)
    window.addEventListener('open-login', onOpenLogin)
    return () => { window.removeEventListener('storage', sync); window.removeEventListener('open-login', onOpenLogin) }
  }, [])
  
  const syncSteamSession = React.useCallback((payload = {}) => {
    const provider = payload.provider || (payload.steamId ? 'steam' : payload.email ? 'local' : 'steam')
    const displayName = payload.displayName || payload.personaname || payload.email || ''
    const avatarUrl = payload.photo || payload.avatar || payload.personaavatar || ''
    const steamIdValue = provider === 'steam' ? (payload.steamId || payload.id || '') : ''
    try {
      if (provider === 'steam') {
        localStorage.setItem('steam-connected', 'true')
      } else {
        localStorage.removeItem('steam-connected')
      }
      localStorage.setItem(AUTH_FLAG_KEY, '1')
      localStorage.setItem('auth-method', provider)
      const roleValue = payload.role || 'user'
      localStorage.setItem('role', roleValue)
      const expiresAt = Date.now() + AUTH_SESSION_MS
      localStorage.setItem(AUTH_EXPIRY_KEY, String(expiresAt))
      if (displayName) {
        localStorage.setItem('profile-name', displayName)
        setName(displayName)
      }
      if (avatarUrl) {
        localStorage.setItem('profile-avatar', avatarUrl)
      } else if (provider === 'local' && !localStorage.getItem('profile-avatar')) {
        localStorage.setItem('profile-avatar', '😄')
      }
      if (payload.email) {
        localStorage.setItem('profile-email', payload.email)
      } else {
        localStorage.removeItem('profile-email')
      }
      if (steamIdValue) {
        localStorage.setItem('steamid', steamIdValue)
      } else {
        localStorage.removeItem('steamid')
      }
    } catch {
      // ignore storage issues
    }
    const avatarValue = avatarUrl || localStorage.getItem('profile-avatar') || ''
    setAvatar(avatarValue)
    const roleValue = payload.role || localStorage.getItem('role') || 'user'
    setUserRole(roleValue)
    extendAuthSession()
    setAuthorized(true)
    window.dispatchEvent(new Event('storage'))
  }, [])

  const fetchAuthStatus = React.useCallback(async () => {
    try {
      const response = await fetch(buildAuthUrl('/auth/status'), { credentials: 'include' })
      if (!response.ok) {
        throw new Error(`Status ${response.status}`)
      }
      const data = await response.json()
      if (data?.ok) {
        syncSteamSession(data)
        return data
      }
    } catch (error) {
      console.warn('[Layout] auth status error', error?.message)
    }
    return null
  }, [syncSteamSession])

  const completeSteamRedirect = React.useCallback(() => {
    let target = '/profile'
    try {
      const stored = localStorage.getItem('steam-auth-redirect')
      if (stored && stored.startsWith('/')) {
        target = stored
      }
      localStorage.removeItem('steam-auth-redirect')
    } catch {
      // ignore storage issues
    }
    if (!steamRedirectRef.current) {
      steamRedirectRef.current = true
      navigate(target, { replace: true })
      window.history.replaceState({}, document.title, target)
    }
  }, [navigate])

  const startSteamLogin = React.useCallback(() => {
    steamRedirectRef.current = false
    const currentPath = window.location.pathname + window.location.search + window.location.hash
    const redirectTarget = currentPath && currentPath.startsWith('/') ? currentPath : '/profile'
    try {
      localStorage.setItem('steam-auth-redirect', redirectTarget)
    } catch {
      // ignore storage issues
    }
    const authUrl = buildAuthUrl(
      `/auth/steam?origin=${encodeURIComponent(window.location.origin)}&redirect=${encodeURIComponent(redirectTarget)}`
    )
    const popup = window.open(authUrl, 'steam-login', 'width=800,height=650')
    if (!popup) {
      window.location.href = authUrl
      return
    }
    const timer = setInterval(() => {
      if (popup.closed) {
        clearInterval(timer)
        fetchAuthStatus().then((data) => {
          if (data?.ok) {
            completeSteamRedirect()
          }
        })
      }
    }, 800)
  }, [fetchAuthStatus, completeSteamRedirect])

  React.useEffect(() => {
    fetchAuthStatus()
  }, [fetchAuthStatus])

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('login') === 'steam') {
      fetchAuthStatus().then((data) => {
        if (data?.ok) {
          if (closeSteamPopupIfNeeded()) {
            return
          }
          completeSteamRedirect()
        } else {
          window.history.replaceState({}, document.title, window.location.pathname + window.location.hash)
        }
      })
    }
  }, [fetchAuthStatus, completeSteamRedirect])

  const [authMode, setAuthMode] = React.useState('login')
  const [regularEmail, setRegularEmail] = React.useState(() => localStorage.getItem('profile-email') || '')
  const [regularDisplayName, setRegularDisplayName] = React.useState('')
  const [regularPassword, setRegularPassword] = React.useState('')
  const [authSubmitting, setAuthSubmitting] = React.useState(false)
  const [loginError, setLoginError] = React.useState('')
  const emailPattern = React.useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/, [])
  const toggleAuthMode = React.useCallback(() => {
    setAuthMode(mode => (mode === 'login' ? 'register' : 'login'))
    setLoginError('')
    setRegularPassword('')
  }, [])
  const submitAuth = React.useCallback(async () => {
    const emailValue = regularEmail.trim().toLowerCase()
    const passwordValue = regularPassword.trim()
    setLoginError('')
    if (!emailValue) {
      setLoginError('Введите email')
      return
    }
    if (!emailPattern.test(emailValue)) {
      setLoginError('Некорректный email')
      return
    }
    if (!passwordValue) {
      setLoginError('Введите пароль')
      return
    }
    setAuthSubmitting(true)
    try {
      const endpoint = authMode === 'register' ? '/auth/register' : '/auth/login'
      const body = {
        email: emailValue,
        password: passwordValue
      }
      if (authMode === 'register') {
        body.name = regularDisplayName.trim()
      }
      const response = await fetch(buildAuthUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.ok) {
        const code = data?.error
        if (code === 'email_taken') setLoginError('Email уже зарегистрирован')
        else if (code === 'invalid_credentials') setLoginError('Неверный email или пароль')
        else if (code === 'weak_password') setLoginError('Пароль должен содержать минимум 6 символов')
        else setLoginError('Не удалось выполнить запрос. Попробуйте позже.')
        return
      }
      syncSteamSession(data)
      setShowLogin(false)
      setRegularPassword('')
      if (authMode === 'register') {
        setAuthMode('login')
      }
      navigate('/profile')
    } catch (error) {
      console.warn('[Layout] auth submit error', error)
      setLoginError('Ошибка соединения. Попробуйте позже.')
    } finally {
      setAuthSubmitting(false)
    }
  }, [regularEmail, regularPassword, regularDisplayName, authMode, emailPattern, syncSteamSession, navigate])
  
  const openSupportChat = React.useCallback(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('support-chat-open'))
    }
  }, [])

  // 
  const { cmsContent, updateCmsContent } = useCMS()
  const [showCmsPanel, setShowCmsPanel] = React.useState(false)
  
  const acceptCookies = () => {
    const d = new Date()
    d.setTime(d.getTime() + (365 * 24 * 60 * 60 * 1000))
    document.cookie = `cookie_consent=accepted; expires=${d.toUTCString()}; path=/`
    setCookieConsent(true)
  }
  
  // State for mobile menu
  const [showMobileMenu, setShowMobileMenu] = React.useState(false)
  return (
    <div className="min-h-screen bg-[#0D1A2F] text-white flex flex-col overflow-x-hidden max-w-[100vw]">

      <header className="mobile-header fixed top-0 left-0 right-0 w-full z-50 bg-[#0D1A2F]/95 backdrop-blur border-b border-white/10">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-3 py-2">

          <NavLink to="/" className="flex items-center gap-2">
            <LazyImage src="/images/logo/logo.png" alt="Game Sale" className="h-20 w-auto object-contain sm:h-18" />
          </NavLink>
          
          <div className="flex items-center gap-3">
            {isAuthorized ? (
              <NavLink to="/profile" className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/10 transition-colors">
                {String(avatar || '').startsWith('http') ? (
                  <LazyImage src={avatar} alt={name || ''} className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-lg">{avatar || ''}</div>
                )}
                <span className="text-sm font-semibold truncate max-w-[120px]">{name || ''}</span>
              </NavLink>
            ) : null}
            <button
              type="button"
              onClick={() => { openSupportChat(); setShowMobileMenu(false) }}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Открыть чат поддержки"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M7 8h10M7 12h6m-7 8l-3 3V5a2 2 0 012-2h12a2 2 0 012 2v11M17 16l4 4" />
              </svg>
            </button>
            <button 
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {showMobileMenu ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
        {/* Mobile Menu Dropdown */}
        {showMobileMenu && (
          <div className="absolute top-full left-0 right-0 bg-[#0D1A2F]/95 backdrop-blur border-b border-white/10 shadow-lg">
            <nav className="max-w-6xl mx-auto px-4 py-4 space-y-2">
              <NavLink 
                to="/store?category=game" 
                className={({isActive}) => `block px-3 py-2 rounded ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}`}
                onClick={() => setShowMobileMenu(false)}
              >
                Игры
              </NavLink>
              <NavLink 
                to="/skins" 
                className={({isActive}) => `block px-3 py-2 rounded ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}`}
                onClick={() => setShowMobileMenu(false)}
              >
                Скины
              </NavLink>
              <NavLink 
                to="/steam-topup" 
                className={({isActive}) => `block px-3 py-2 rounded ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}`}
                onClick={() => setShowMobileMenu(false)}
              >
                Пополнить Steam
              </NavLink>
              <NavLink 
                to="/store" 
                className={({isActive}) => `block px-3 py-2 rounded ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}`}
                onClick={() => setShowMobileMenu(false)}
              >
                Каталог
              </NavLink>
              <NavLink 
                to="/blog" 
                className={({isActive}) => `block px-3 py-2 rounded ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}`}
                onClick={() => setShowMobileMenu(false)}
              >
                Блог
              </NavLink>
              <button
                type="button"
                onClick={() => { openSupportChat(); setShowMobileMenu(false) }}
                className="block w-full text-left px-3 py-2 rounded hover:bg-white/5"
              >
                Чат поддержки
              </button>
              {isAdmin && (
                <>
                  <NavLink 
                    to="/admin" 
                    className={({isActive}) => `block px-3 py-2 rounded ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}`}
                    onClick={() => setShowMobileMenu(false)}
                  >
                    Админка
                  </NavLink>
                <NavLink 
                  to="/admin/support" 
                  className={({isActive}) => `block px-3 py-2 rounded ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}`}
                  onClick={() => setShowMobileMenu(false)}
                >
                  Поддержка
                </NavLink>
                </>
              )}
              {isAuthorized && (
                <>
                  <NavLink 
                    to="/cart" 
                    className={({isActive}) => `block px-3 py-2 rounded ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}`}
                    onClick={() => setShowMobileMenu(false)}
                  >
                    Корзина
                  </NavLink>
                  <NavLink 
                    to="/profile" 
                    className={({isActive}) => `block px-3 py-2 rounded ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}`}
                    onClick={() => setShowMobileMenu(false)}
                  >
                    Профиль
                  </NavLink>
                </>
              )}
              {!isAuthorized && (
                <button 
                  onClick={() => { setShowLogin(true); setShowMobileMenu(false) }}
                  className="block w-full text-left px-3 py-2 rounded hover:bg-white/5"
                >
                  Войти
                </button>
              )}
            </nav>
          </div>
        )}
      </header>
      <div className="flex flex-1">

        <header className="desktop-header fixed top-0 left-0 right-0 z-50 bg-[#0D1A2F]/95 backdrop-blur border-b border-white/10">
          <div className="max-w-6xl mx-auto px-6 py-2 relative flex items-center justify-between gap-4">

            <NavLink to="/" className="flex items-center gap-3 shrink-0 z-10">
                <LazyImage src="/images/logo/logo.png" alt="Game Sale logo" className="h-18 w-auto object-contain" />
            </NavLink>
            
            <nav className="hidden lg:flex items-center gap-2 xl:gap-4 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap z-0">
              <NavLink className={({isActive}) => `px-2 xl:px-3 py-2 rounded transition-colors text-sm xl:text-base ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}`} to="/store?category=game">
                Игры
              </NavLink>
              
              <NavLink className={({isActive}) => `px-2 xl:px-3 py-2 rounded transition-colors text-sm xl:text-base ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}`} to="/skins">
                Скины
              </NavLink>
              
              <NavLink className={({isActive}) => `px-2 xl:px-3 py-2 rounded transition-colors text-sm xl:text-base ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}`} to="/steam-topup">
                Пополнить Steam
              </NavLink>
              
              <NavLink className={({isActive}) => `px-2 xl:px-3 py-2 rounded transition-colors text-sm xl:text-base ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}`} to="/store">
                Каталог
              </NavLink>
              
              <NavLink className={({isActive}) => `px-2 xl:px-3 py-2 rounded transition-colors text-sm xl:text-base ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}`} to="/blog">
                Блог
              </NavLink>
              
              {isAdmin && (
                <>
                  <NavLink className={({isActive}) => `px-2 xl:px-3 py-2 rounded transition-colors text-sm xl:text-base ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}`} to="/admin">
                    Админка
                  </NavLink>
                  <NavLink className={({isActive}) => `px-2 xl:px-3 py-2 rounded transition-colors text-sm xl:text-base ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}`} to="/admin/support">
                  Поддержка
                </NavLink>
                </>
              )}
            </nav>
            
            <div className="hidden lg:flex items-center gap-2 xl:gap-3 shrink-0 z-10">
              {isAuthorized ? (
                <>
                  <NavLink to="/cart" className="relative flex items-center gap-2 px-3 py-2 rounded hover:bg-white/5 transition-colors">
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 6M7 13l-1.5-6m0 0h15M17 21a2 2 0 100-4 2 2 0 000 4zM9 21a2 2 0 100-4 2 2 0 000 4z" />
  </svg>
  <CartBadge />
</NavLink>
                  <NavLink to="/profile" className="flex items-center gap-3 px-3 py-2 rounded hover:bg-white/5 transition-colors">
                    {String(avatar || '').startsWith('http') ? (
                      <LazyImage src={avatar} alt={name || ''} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-lg">{avatar || ''}</div>
                    )}
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold truncate max-w-[160px]">{name || ''}</span>

                    </div>
                  </NavLink>
                </>
              ) : (
                <button 
                  onClick={() => setShowLogin(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013 3v1" />
                  </svg>
                  Войти
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1">
          <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>

      {showLogin && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 py-6 overflow-y-auto">
          <div className="bg-[#0D1A2F] border border-white/10 rounded-lg p-6 w-full max-w-md mx-auto shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Вход в аккаунт</h2>
              <button onClick={() => setShowLogin(false)} className="text-gray-400 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {loginError && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded text-red-300 text-sm">
                {loginError}
              </div>
            )}
            <div className="space-y-4">
              <button 
                onClick={startSteamLogin}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-[#1B2838] hover:bg-[#2A475E] rounded transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                </svg>
                Войти через Steam
              </button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-[#0D1A2F] px-2 text-white/60">или</span>
                </div>
              </div>
              
              <div className="space-y-3">
                <input
                  type="email"
                  placeholder="Введите email"
                  value={regularEmail}
                  onChange={(e) => setRegularEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded focus:outline-none focus:border-blue-500"
                />
                {authMode === 'register' && (
                  <input
                    type="text"
                    placeholder="Имя (необязательно)"
                    value={regularDisplayName}
                    onChange={(e) => setRegularDisplayName(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded focus:outline-none focus:border-blue-500"
                  />
                )}
                <input
                  type="password"
                  placeholder="Введите пароль"
                  value={regularPassword}
                  onChange={(e) => setRegularPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      submitAuth()
                    }
                  }}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded focus:outline-none focus:border-blue-500"
                />
                {loginError && (
                  <div className="w-full px-3 py-2 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-300">
                    {loginError}
                  </div>
                )}
                <button 
                  onClick={submitAuth}
                  disabled={authSubmitting}
                  className={`w-full px-4 py-2 rounded transition-colors ${authSubmitting ? 'bg-blue-900 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  {authMode === 'register' ? 'Создать аккаунт' : 'Войти'}
                </button>
                <button
                  type="button"
                  onClick={toggleAuthMode}
                  className="w-full text-sm text-white/60 hover:text-white transition-colors"
                >
                  {authMode === 'register' ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cookie consent */}
      {!cookieConsent && (
        <div className="fixed bottom-4 left-4 right-4 z-50 bg-[#0D1A2F] border border-white/10 rounded-lg p-4 shadow-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <p className="text-sm text-gray-300 leading-relaxed">
              Мы используем cookie-файлы, чтобы запомнить ваши настройки, анализировать трафик и улучшать сервис.
              Продолжая пользоваться сайтом, вы соглашаетесь на их использование. Подробнее читайте в&nbsp;
              <NavLink to="/privacy" className="text-blue-400 underline hover:text-blue-300">
                политике конфиденциальности
              </NavLink>.
            </p>
            <button 
              onClick={acceptCookies}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors text-sm font-semibold whitespace-nowrap"
            >
              Принимаю
            </button>
          </div>
        </div>
      )}

      <footer className="bg-gradient-to-br from-[#0a0f1c] via-[#0d1a2f] to-[#1a1a2e] border-t border-white/10 mt-auto">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex flex-nowrap items-start justify-between gap-6 lg:gap-8">

            <div className="space-y-4 flex-shrink-0 min-w-[200px]">
              <div className="flex items-center gap-3">
                <LazyImage src="/images/logo/logo.png" alt="Game Sale logo" className="h-9 w-auto object-contain" />
                <span className="text-xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
                  Game Sale
                </span>
              </div>
              <p className="text-white/70 text-sm leading-relaxed">
                {cmsContent.footerDescription}
              </p>

            </div>

            <div className="space-y-4 flex-shrink-0 min-w-[150px]">
              <h3 className="text-white font-semibold">Магазин</h3>
              <nav className="space-y-2">
                <NavLink to="/store" className="block text-white/70 hover:text-white transition-colors text-sm">
                  Все игры
                </NavLink>
                <NavLink to="/store?type=rpg" className="block text-white/70 hover:text-white transition-colors text-sm">
                  RPG
                </NavLink>
                <NavLink to="/store?type=shooter" className="block text-white/70 hover:text-white transition-colors text-sm">
                  Шутеры
                </NavLink>
                <NavLink to="/store?type=strategy" className="block text-white/70 hover:text-white transition-colors text-sm">
                  Стратегии
                </NavLink>
                <NavLink to="/store?type=indie" className="block text-white/70 hover:text-white transition-colors text-sm">
                  Инди-игры
                </NavLink>
              </nav>
            </div>

            <div className="space-y-4 flex-shrink-0 min-w-[150px]">
              <h3 className="text-white font-semibold">Скины</h3>
              <nav className="space-y-2">
                <NavLink to="/skins" className="block text-white/70 hover:text-white transition-colors text-sm">
                  Все скины
                </NavLink>
                <NavLink to="/skins?type=weapon" className="block text-white/70 hover:text-white transition-colors text-sm">
                  Оружие
                </NavLink>
                <NavLink to="/skins?type=armor" className="block text-white/70 hover:text-white transition-colors text-sm">
                  Броня
                </NavLink>
                <NavLink to="/skins?type=gloves" className="block text-white/70 hover:text-white transition-colors text-sm">
                  Перчатки
                </NavLink>
                <NavLink to="/roulette" className="block text-white/70 hover:text-white transition-colors text-sm">
                  Рулетка
                </NavLink>
              </nav>
            </div>

            <div className="space-y-4 flex-shrink-0 min-w-[150px]">
              <h3 className="text-white font-semibold">Помощь</h3>
              <nav className="space-y-2">
                <NavLink to="/faq" className="block text-white/70 hover:text-white transition-colors text-sm">
                  Частые вопросы
                </NavLink>
                <NavLink to="/support" className="block text-white/70 hover:text-white transition-colors text-sm">
                  Поддержка
                </NavLink>
                <NavLink to="/about" className="block text-white/70 hover:text-white transition-colors text-sm">
                  О нас
                </NavLink>
                <NavLink to="/contacts" className="block text-white/70 hover:text-white transition-colors text-sm">
                  Контакты
                </NavLink>
              </nav>
            </div>
            <div className="space-y-4 flex-shrink-0 min-w-[150px]">
              <h3 className="text-white font-semibold">Информация</h3>
              <nav className="space-y-2">
                <NavLink to="/blog" className="block text-white/70 hover:text-white transition-colors text-sm">
                  Блог
                </NavLink>
                <NavLink to="/terms" className="block text-white/70 hover:text-white transition-colors text-sm">
                  Условия использования
                </NavLink>
                <NavLink to="/privacy" className="block text-white/70 hover:text-white transition-colors text-sm">
                  Политика конфиденциальности
                </NavLink>
                <NavLink to="/public-offer" className="block text-white/70 hover:text-white transition-colors text-sm">
                  Публичная оферта
                </NavLink>
                <NavLink to="/copyright-agreement" className="block text-white/70 hover:text-white transition-colors text-sm">
                  Договор с правообладателем
                </NavLink>
              </nav>
            </div>
          </div>

          <div className="border-t border-white/10 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-white/60 text-sm">
              <div>© {new Date().getFullYear()} Game Sale. Все права защищены.</div>
              <div className="mt-2 text-xs">
                {company.fullNameRu} | ИНН: {company.inn}
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm text-white/60">
              <span>Принимаем: Visa, Mastercard, PayPal</span>
            </div>
          </div>
        </div>
      </footer>
      <SupportChatWidget defaultName={name} defaultEmail={regularEmail} />
    </div>
  )
}
// Cart context
const CartContext = React.createContext(null)
// CMS Context
const CMSContext = React.createContext(null)
const useCMS = () => React.useContext(CMSContext)

// Mojibake auto-fix helpers
function looksLikeMojibake(text){return typeof text==='string' && /[РЎРѓРІР‚]/.test(text)}
function reencodeLatin1ToUtf8(str){try{const bytes=new Uint8Array(str.length);for(let i=0;i<str.length;i++)bytes[i]=str.charCodeAt(i)&255;return new (globalThis.TextDecoder||require('util').TextDecoder)('utf-8').decode(bytes)}catch{return str}}
function sanitizeCmsContent(obj){if(!obj||typeof obj!=='object')return obj;const out={...obj};for(const k in out){const v=out[k];if(typeof v==='string'&&looksLikeMojibake(v)){out[k]=reencodeLatin1ToUtf8(v)}}return out}

function CMSProvider({ children }) {
  const DEFAULT_CMS = {
    bannerTitle: '-30% на Cyberpunk 2077',
    bannerDescription: 'Спешите купить по акции! До окончания:',
    bannerButton1: 'Купить со скидкой',
    bannerButton2: 'Посмотреть каталог',
    rouletteButton: 'Попробуй свою удачу',
    footerDescription: 'Современный магазин видеоигр и цифрового контента.'
  }

  const [cmsContent, setCmsContent] = React.useState(() => {
    // Принудительно используем DEFAULT_CMS, чтобы избежать иероглифов
    const initial = { ...DEFAULT_CMS }
    try { 
      localStorage.setItem('cms-content', JSON.stringify(initial)) 
    } catch {}
    return initial
  })
  
  const updateCmsContent = (key, value) => {
    const newContent = { ...cmsContent, [key]: value }
    setCmsContent(newContent)
    try { localStorage.setItem('cms-content', JSON.stringify(newContent)) } catch {}
  }
  
  return (
    <CMSContext.Provider value={{ cmsContent, updateCmsContent }}>
      {children}
    </CMSContext.Provider>
  )
}
function CartProvider({ children }) {
  const [items, setItems] = React.useState(() => {
    try {
      const saved = localStorage.getItem('cart-items')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  React.useEffect(() => {
    localStorage.setItem('cart-items', JSON.stringify(items))
  }, [items])
  
  // Очистка корзины при выходе пользователя
  React.useEffect(() => {
    const handleCartCleared = () => {
      setItems([])
      localStorage.removeItem('cart-items')
    }
    window.addEventListener('cart-cleared', handleCartCleared)
    return () => window.removeEventListener('cart-cleared', handleCartCleared)
  }, [])
  const addItem = (product, qty = 1) => {
    // 
    const authorized = hasValidAuthSession()
    
    if (!authorized) {
      window.dispatchEvent(new Event('open-login'))
      return
    }
    setItems(prev => {
      const exists = prev.find(i => i.id === product.id)
      const roundedPrice = roundToSteamPrice(product.price)
      if (exists) {
        return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + qty, price: roundedPrice } : i)
      }
      return [...prev, { ...product, image: getPrimaryImage(product), qty, price: roundedPrice }]
    })
  }
  const removeItem = (id) => setItems(prev => prev.filter(i => i.id !== id))
  const updateQty = (id, qty) => setItems(prev => prev.map(i => i.id === id ? { ...i, qty: Math.max(1, qty) } : i))
  const clear = () => setItems([])
  const totalQuantity = items.reduce((sum, i) => sum + i.qty, 0)
  // Расчет базовой суммы без скидки (с округлением до Steam-формата)
  const baseTotalPrice = roundToSteamPrice(items.reduce((sum, i) => sum + i.price * i.qty, 0))
  
  // Проверяем, что это gamesale.shop (не oneshotgame.shop)
  const isGameSale = typeof window !== 'undefined' && 
    (window.location.hostname.includes('gamesale.shop') || 
     window.location.hostname === 'localhost' || 
     !window.location.hostname.includes('oneshotgame'))
  
  // Скидка 10% при сумме >= 30000 ₽ (только для gamesale.shop)
  const DISCOUNT_THRESHOLD = 30000
  const DISCOUNT_PERCENT = 10
  
  const discount = isGameSale && baseTotalPrice >= DISCOUNT_THRESHOLD 
    ? Math.round(baseTotalPrice * DISCOUNT_PERCENT / 100)
    : 0
  
  const totalPrice = roundToSteamPrice(baseTotalPrice - discount)
  
  const value = { 
    items, 
    addItem, 
    removeItem, 
    updateQty, 
    clear, 
    totalQuantity, 
    totalPrice,
    baseTotalPrice,
    discount,
    discountPercent: discount > 0 ? DISCOUNT_PERCENT : 0
  }
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

function useCart() { const ctx = React.useContext(CartContext); if (!ctx) throw new Error('useCart must be used within CartProvider'); return ctx }

// Компонент контрола количества товара в корзине
function CartQuantityControl({ product, className = '' }) {
  const { items, addItem, updateQty, removeItem } = useCart()
  const cartItem = items.find(item => item.id === product.id)
  const quantity = cartItem?.qty || 0
  
  if (quantity === 0) {
    return (
      <button 
        onClick={(e) => { 
          e.preventDefault(); 
          e.stopPropagation(); 
          addItem(product, 1) 
        }}
        className={`px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs font-semibold text-white transition-colors ${className}`}
      >
        В корзину
      </button>
    )
  }
  
  const isLarge = className.includes('px-4') || className.includes('px-6')
  const buttonSize = isLarge ? 'w-8 h-8 text-sm' : 'w-6 h-6 text-xs'
  const textSize = isLarge ? 'text-sm min-w-[32px]' : 'text-xs min-w-[24px]'
  
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <button
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (quantity > 1) {
            updateQty(product.id, quantity - 1)
          } else {
            removeItem(product.id)
          }
        }}
        className={`${buttonSize} flex items-center justify-center bg-blue-600 hover:bg-blue-700 rounded text-white font-bold transition-colors`}
        aria-label="Уменьшить количество"
      >
        -
      </button>
      <span className={`${textSize} text-center font-medium text-white px-1`}>
        {quantity}
      </span>
      <button
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          updateQty(product.id, quantity + 1)
        }}
        className={`${buttonSize} flex items-center justify-center bg-blue-600 hover:bg-blue-700 rounded text-white font-bold transition-colors`}
        aria-label="Увеличить количество"
      >
        +
      </button>
    </div>
  )
}

function CartBadge() {
  const { totalQuantity } = useCart()
  const authorized = hasValidAuthSession()
  if (!authorized || totalQuantity <= 0) return null
  return (
    <span className="absolute -top-1 -right-2 min-w-[18px] h-5 px-1 rounded-full bg-[#7e2aa8] text-xs flex items-center justify-center">
      {totalQuantity}
    </span>
  )
}
const LangContext = React.createContext(null)

function LangProvider({ children }) {
  const [lang, setLang] = React.useState(() => {
    try {
      return localStorage.getItem('lang') || 'ru'
    } catch {
      return 'ru'
    }
  })

  React.useEffect(() => {
    try {
      localStorage.setItem('lang', lang)
    } catch {
      // ignore storage issues
    }
  }, [lang])

  const RATE = 90
  const currency = lang === 'ru' || lang === 'ky' ? 'RUB' : 'USD'

  const formatPrice = React.useCallback(
    (amount) => {
      if (typeof amount !== 'number' || Number.isNaN(amount)) {
        if (lang === 'ru') return '0 ₽'
        if (lang === 'ky') return '0 сом'
        return '$0.00'
      }
      try {
        // Если цена больше 100, считаем что она уже в рублях
        // Если меньше 100, считаем что в USD и конвертируем
        const amountInRub = amount >= 100 ? amount : amount * RATE
        
        if (lang === 'ru') {
          return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(amountInRub)
        }
        if (lang === 'ky') {
          return new Intl.NumberFormat('ky-KG', { style: 'currency', currency: 'KGS' }).format(amountInRub)
        }
        // Для английского конвертируем рубли обратно в USD
        const amountInUsd = amount >= 100 ? amount / RATE : amount
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amountInUsd)
      } catch {
        const amountInRub = amount >= 100 ? amount : amount * RATE
        if (lang === 'ru') return `${Math.round(amountInRub)} ₽`
        if (lang === 'ky') return `${Math.round(amountInRub)} сом`
        const amountInUsd = amount >= 100 ? amount / RATE : amount
        return `$${amountInUsd.toFixed(2)}`
      }
    },
    [lang]
  )

  const toAmountInCurrency = React.useCallback(
    (amount) => {
      // Если цена больше 100, считаем что она уже в рублях
      if (amount >= 100) {
        return lang === 'ru' || lang === 'ky' ? amount : amount / RATE
      }
      // Если меньше 100, считаем что в USD
      return lang === 'ru' || lang === 'ky' ? amount * RATE : amount
    },
    [lang]
  )

  const DICTIONARY = React.useMemo(
    () => ({
      ru: {
        'skins.title': 'Скины CS2'
      },
      en: {
        'skins.title': 'CS2 Skins'
      },
      ky: {
        'skins.title': 'CS2 Скиндер'
      }
    }),
    []
  )

  const t = React.useCallback(
    (key) => {
      const dict = DICTIONARY[lang]
      return (dict && dict[key]) || key
    },
    [DICTIONARY, lang]
  )

  const value = React.useMemo(
    () => ({
      lang,
      setLang,
      currency,
      rate: RATE,
      formatPrice,
      toAmountInCurrency,
      t
    }),
    [currency, formatPrice, lang, toAmountInCurrency, t]
  )

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

export function useLang() {
  const ctx = React.useContext(LangContext)
  if (!ctx) {
    throw new Error('useLang must be used within LangProvider')
  }
  return ctx
}

const rootElement = document.getElementById('app')
if (!rootElement) {
  throw new Error('Root element with id "app" was not found')
}

// Обработка ошибок рендеринга
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', textAlign: 'center', color: '#fff', background: '#1a2540', minHeight: '100vh' }}>
          <h1>Произошла ошибка</h1>
          <p>{this.state.error?.message || 'Неизвестная ошибка'}</p>
          <button onClick={() => window.location.reload()} style={{ padding: '10px 20px', marginTop: '20px', cursor: 'pointer' }}>
            Перезагрузить страницу
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

// Глобальный обработчик ошибок для предотвращения ошибок removeChild
if (typeof window !== 'undefined') {
  // Перехватываем ошибки removeChild, которые могут возникать при работе с Яндекс Капчей
  const originalRemoveChild = Node.prototype.removeChild
  Node.prototype.removeChild = function(child) {
    try {
      // Проверяем, что child действительно является дочерним элементом
      if (child && this.contains && this.contains(child)) {
        return originalRemoveChild.call(this, child)
      } else {
        // Если элемент уже удален или не является дочерним, просто игнорируем
        console.warn('[DOM] Попытка удалить элемент, который не является дочерним (игнорируется)')
        return child
      }
    } catch (error) {
      // Игнорируем ошибки removeChild - они не критичны
      console.warn('[DOM] Ошибка при удалении элемента (игнорируется):', error?.message)
      return child
    }
  }
  
  // Также перехватываем глобальные ошибки
  window.addEventListener('error', (event) => {
    if (event.message && event.message.includes('removeChild')) {
      console.warn('[DOM] Ошибка removeChild перехвачена и проигнорирована')
      event.preventDefault()
      event.stopPropagation()
      return false
    }
  }, true)
  
  // Перехватываем необработанные промисы с ошибками
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && event.reason.message && event.reason.message.includes('removeChild')) {
      console.warn('[DOM] Ошибка removeChild в промисах перехвачена и проигнорирована')
      event.preventDefault()
    }
  })
}

createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <LangProvider>
        <CartProvider>
          <CMSProvider>
            <BrowserRouter>
              <ScrollToTop />
              <App />
            </BrowserRouter>
          </CMSProvider>
        </CartProvider>
      </LangProvider>
    </ErrorBoundary>
  </React.StrictMode>
)