// Роуты для получения скинов из Steam Inventory
import express from 'express'
import { findUserById } from '../models/user.js'

const router = express.Router()

// Middleware для проверки авторизации
function requireAuth(req, res, next) {
  if (!req.session || !req.session.user || !req.session.user.id) {
    return res.status(401).json({ ok: false, error: 'unauthorized' })
  }
  next()
}

// Middleware для проверки Steam ID
function requireSteamId(req, res, next) {
  if (!req.session || !req.session.user || !req.session.user.id) {
    return res.status(401).json({ ok: false, error: 'unauthorized' })
  }
  const user = findUserById(req.session.user.id)
  if (!user || !user.steamId) {
    return res.status(403).json({ ok: false, error: 'steam_id_required' })
  }
  req.userSteamId = user.steamId
  next()
}

/**
 * GET /api/steam/inventory/:steamId? - Получить инвентарь скинов из Steam
 */
router.get('/inventory/:steamId?', requireAuth, requireSteamId, async (req, res) => {
  try {
    const steamId = req.params.steamId || req.userSteamId
    const { appId = '730', contextId = '2', language = 'english' } = req.query

    // Проверяем, что пользователь запрашивает свой инвентарь или имеет права
    const user = findUserById(req.session.user.id)
    if (steamId !== user.steamId && user.role !== 'admin') {
      return res.status(403).json({ ok: false, error: 'forbidden' })
    }

    // Получаем инвентарь через Steam Community API
    // Используем парсинг страницы инвентаря Steam
    const inventoryUrl = `https://steamcommunity.com/inventory/${steamId}/${appId}/${contextId}?l=${language}&count=5000`

    try {
      const response = await fetch(inventoryUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      })

      if (!response.ok) {
        if (response.status === 403) {
          return res.status(403).json({ 
            ok: false, 
            error: 'inventory_private',
            message: 'Инвентарь пользователя закрыт для просмотра'
          })
        }
        throw new Error(`Steam API returned ${response.status}`)
      }

      const data = await response.json()

      if (!data || !data.success) {
        return res.status(500).json({ 
          ok: false, 
          error: 'inventory_fetch_failed',
          message: 'Не удалось получить инвентарь'
        })
      }

      // Парсим предметы из инвентаря
      const items = []
      const descriptions = data.descriptions || []
      const assets = data.assets || []

      const descriptionMap = new Map()
      descriptions.forEach(desc => {
        if (desc.classid && desc.instanceid) {
          const key = `${desc.classid}_${desc.instanceid}`
          descriptionMap.set(key, desc)
        }
      })

      assets.forEach(asset => {
        const key = `${asset.classid}_${asset.instanceid || '0'}`
        const description = descriptionMap.get(key)

        if (description) {
          items.push({
            assetId: asset.assetid,
            classId: asset.classid,
            instanceId: asset.instanceid || '0',
            amount: asset.amount || '1',
            name: description.market_name || description.name || 'Unknown Item',
            type: description.type || 'Unknown',
            tradable: description.tradable === 1,
            marketable: description.marketable === 1,
            commodity: description.commodity === 1,
            marketHashName: description.market_hash_name || description.name || '',
            iconUrl: description.icon_url || '',
            iconUrlLarge: description.icon_url_large || description.icon_url || '',
            descriptions: description.descriptions || [],
            tags: description.tags || [],
            appId: description.appid || appId,
            contextId: description.contextid || contextId
          })
        }
      })

      return res.json({
        ok: true,
        steamId,
        appId,
        contextId,
        totalItems: items.length,
        items: items,
        moreItems: data.more_items || false,
        lastAssetId: data.last_assetid || null
      })
    } catch (error) {
      console.error('[steam/inventory] Fetch error:', error?.message)
      
      // Альтернативный метод через Steam Trade API (если доступен API ключ)
      if (process.env.STEAM_API_KEY) {
        try {
          const tradeUrl = `https://api.steampowered.com/IEconService/GetTradeOffers/v1/?key=${process.env.STEAM_API_KEY}&get_sent_offers=0&get_received_offers=0&get_descriptions=1&language=${language}&active_only=0`
          
          // Этот метод не дает прямой доступ к инвентарю, но можно использовать
          // Для полноценной работы нужна интеграция с Steam Trade API через OAuth
          return res.status(501).json({
            ok: false,
            error: 'inventory_api_not_available',
            message: 'Прямой доступ к инвентарю через API недоступен. Используйте страницу инвентаря Steam.'
          })
        } catch (apiError) {
          console.error('[steam/inventory] API error:', apiError?.message)
        }
      }

      return res.status(500).json({
        ok: false,
        error: 'inventory_fetch_failed',
        message: error.message || 'Ошибка при получении инвентаря'
      })
    }
  } catch (error) {
    console.error('[steam/inventory] Request error:', error?.message)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})

/**
 * GET /api/steam/inventory/games - Получить список игр с инвентарями
 */
router.get('/inventory/games', requireAuth, requireSteamId, async (req, res) => {
  try {
    const steamId = req.userSteamId

    // Популярные игры со скинами
    const games = [
      { appId: '730', name: 'Counter-Strike 2', contextId: '2' },
      { appId: '570', name: 'Dota 2', contextId: '2' },
      { appId: '440', name: 'Team Fortress 2', contextId: '2' },
      { appId: '252490', name: 'Rust', contextId: '2' },
      { appId: '304930', name: 'Unturned', contextId: '2' }
    ]

    const gamesWithInventory = []

    for (const game of games) {
      try {
        const inventoryUrl = `https://steamcommunity.com/inventory/${steamId}/${game.appId}/${game.contextId}?l=english&count=1`
        
        const response = await fetch(inventoryUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        })

        if (response.ok) {
          const data = await response.json()
          if (data && data.success && data.total_inventory_count > 0) {
            gamesWithInventory.push({
              ...game,
              itemCount: data.total_inventory_count
            })
          }
        }
      } catch (error) {
        console.warn(`[steam/inventory] Failed to check game ${game.name}:`, error?.message)
      }
    }

    return res.json({
      ok: true,
      games: gamesWithInventory
    })
  } catch (error) {
    console.error('[steam/inventory/games] Request error:', error?.message)
    return res.status(500).json({ ok: false, error: 'server_error' })
  }
})

export default router

