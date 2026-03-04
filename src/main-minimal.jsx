import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import SkinRoulette from './SkinRoulette.jsx'
import FAQ from './pages/FAQ.jsx'
import About from './pages/About.jsx'
import Contacts from './pages/Contacts.jsx'
import './style.css'

function Home() {
  return (
    <div style={{ padding: '24px', background: '#0D1A2F', minHeight: '100vh', color: '#fff' }}>
      <h1 style={{ margin: 0 }}>Сайт восстановлен</h1>
      <p>Это чистая версия интерфейса без «кракозябр».</p>
      <p>
        Перейти к странице рулетки: <Link className="neon-hover" to="/roulette">/roulette</Link>
      </p>
      <p>
        Каталог товаров: <Link className="neon-hover" to="/products">/products</Link>
      </p>
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <Link className="neon-hover" to="/about">О нас</Link>
        <Link className="neon-hover" to="/contacts">Контакты</Link>
        <Link className="neon-hover" to="/faq">FAQ</Link>
      </div>
    </div>
  )
}

function Products() {
  const [items, setItems] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [filter, setFilter] = React.useState('all') // all | game | skin

  React.useEffect(() => {
    let aborted = false
    const load = async () => {
      try {
        const res = await fetch('/products')
        const js = await res.json().catch(() => ({}))
        const data = Array.isArray(js?.data) ? js.data : []
        if (!aborted) { setItems(data); setLoading(false) }
      } catch {
        if (!aborted) setLoading(false)
      }
    }
    load()
    return () => { aborted = true }
  }, [])

  const filtered = React.useMemo(() => {
    if (filter === 'all') return items
    return items.filter(p => (p?.category || '').toLowerCase() === filter)
  }, [items, filter])

  return (
    <div style={{ padding: '24px', background: '#0D1A2F', minHeight: '100vh', color: '#fff' }}>
      <h1 style={{ marginTop: 0 }}>Каталог</h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={() => setFilter('all')}>Все</button>
        <button onClick={() => setFilter('game')}>Игры</button>
        <button onClick={() => setFilter('skin')}>Скины</button>
        <Link className="neon-hover" to="/">На главную</Link>
      </div>

      {loading ? (
        <div>Загрузка…</div>
      ) : filtered.length === 0 ? (
        <div>Нет товаров</div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 16
        }}>
          {filtered.map(p => (
            <div key={p.id} className="product-card" style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              padding: 12
            }}>
              <div style={{
                width: '100%', height: 120, overflow: 'hidden',
                borderRadius: 8, marginBottom: 8, background: '#111'
              }}>
                {p.image && (
                  <img src={p.image} alt={p.name}
                       style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
              </div>
              <h3 style={{ margin: '4px 0 8px 0', fontSize: 16 }}>{p.name}</h3>
              <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                <span>Категория: {p.category === 'skin' ? 'Скин' : 'Игра'}</span>
                {p.category === 'skin' && p.rarity && (
                  <span style={{
                    padding: '2px 6px',
                    borderRadius: 6,
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(156,39,176,0.15)',
                    fontSize: 11
                  }}>
                    Редкость: {p.rarity}
                  </span>
                )}
              </div>
              {p.description && (
                <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 8, minHeight: 32 }}>
                  {p.description}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 700 }}>
                  {typeof p.price === 'number' ? `${p.price.toFixed(2)} $` : '—'}
                </div>
                <button>В корзину</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/roulette" element={<SkinRoulette />} />
        <Route path="/products" element={<Products />} />
        <Route path="/about" element={<About />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/faq" element={<FAQ />} />
      </Routes>
    </BrowserRouter>
  )
}

const root = createRoot(document.getElementById('app'))
root.render(<App />)