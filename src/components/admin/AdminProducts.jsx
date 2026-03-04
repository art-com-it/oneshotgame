import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function AdminProducts() {
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [type, setType] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    image: '',
    introImage: '',
    category: 'game',
    type: 'indie',
    description: '',
    hidden: false
  })

  useEffect(() => {
    fetchProducts()
  }, [search, category, type, page])

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50'
      })
      if (search) params.append('search', search)
      if (category) params.append('category', category)
      if (type) params.append('type', type)

      const response = await fetch(`/api/admin/products?${params}`, {
        credentials: 'include'
      })
      const data = await response.json()
      if (data.ok) {
        setProducts(data.products)
        setTotal(data.total)
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Вы уверены, что хотите удалить этот товар?')) return

    try {
      const response = await fetch(`/api/admin/products/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      const data = await response.json()
      if (data.ok) {
        fetchProducts()
      }
    } catch (error) {
      console.error('Error deleting product:', error)
      alert('Ошибка при удалении товара')
    }
  }

  const handleEdit = (product) => {
    setEditingProduct(product)
    setFormData({
      name: product.name || '',
      price: product.price || '',
      image: product.image || '',
      introImage: product.introImage || product.image || '',
      category: product.category || 'game',
      type: product.type || 'indie',
      description: product.description || '',
      hidden: product.hidden || false
    })
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const url = editingProduct
        ? `/api/admin/products/${editingProduct.id}`
        : '/api/admin/products'
      const method = editingProduct ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          price: parseFloat(formData.price) || 0
        })
      })

      const data = await response.json()
      if (data.ok) {
        setShowModal(false)
        setEditingProduct(null)
        setFormData({
          name: '',
          price: '',
          image: '',
          introImage: '',
          category: 'game',
          type: 'indie',
          description: '',
          hidden: false
        })
        fetchProducts()
      } else {
        alert('Ошибка: ' + (data.error || 'Неизвестная ошибка'))
      }
    } catch (error) {
      console.error('Error saving product:', error)
      alert('Ошибка при сохранении товара')
    }
  }

  const handleExport = async () => {
    try {
      const response = await fetch('/api/admin/export/products?format=csv', {
        credentials: 'include'
      })
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `products_${Date.now()}.csv`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting products:', error)
      alert('Ошибка при экспорте')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-white">Управление товарами</h1>
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            Экспорт CSV
          </button>
          <button
            onClick={() => {
              setEditingProduct(null)
              setFormData({
                name: '',
                price: '',
                image: '',
                introImage: '',
                category: 'game',
                type: 'indie',
                description: '',
                hidden: false
              })
              setShowModal(true)
            }}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors"
          >
            + Добавить товар
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#1a1a1a] border border-[#333333] rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="Поиск..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="px-4 py-2 bg-[#0C0C0C] border border-[#333333] rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-cyan-500"
          />
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value)
              setPage(1)
            }}
            className="px-4 py-2 bg-[#0C0C0C] border border-[#333333] rounded-lg text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="">Все категории</option>
            <option value="game">Игры</option>
            <option value="skin">Скины</option>
          </select>
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value)
              setPage(1)
            }}
            className="px-4 py-2 bg-[#0C0C0C] border border-[#333333] rounded-lg text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="">Все типы</option>
            <option value="action">Action</option>
            <option value="indie">Indie</option>
            <option value="shooter">Shooter</option>
          </select>
          <div className="text-white/60 text-sm flex items-center">
            Всего: {total}
          </div>
        </div>
      </div>

      {/* Products Table */}
      {loading ? (
        <div className="text-white/80">Загрузка...</div>
      ) : (
        <div className="bg-[#1a1a1a] border border-[#333333] rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-[#0C0C0C]">
              <tr>
                <th className="px-4 py-3 text-left text-white/80 text-sm font-semibold">ID</th>
                <th className="px-4 py-3 text-left text-white/80 text-sm font-semibold">Название</th>
                <th className="px-4 py-3 text-left text-white/80 text-sm font-semibold">Цена</th>
                <th className="px-4 py-3 text-left text-white/80 text-sm font-semibold">Категория</th>
                <th className="px-4 py-3 text-left text-white/80 text-sm font-semibold">Тип</th>
                <th className="px-4 py-3 text-left text-white/80 text-sm font-semibold">Статус</th>
                <th className="px-4 py-3 text-left text-white/80 text-sm font-semibold">Действия</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-t border-[#333333] hover:bg-[#0C0C0C]">
                  <td className="px-4 py-3 text-white/60 text-sm">{product.id}</td>
                  <td className="px-4 py-3 text-white">{product.name}</td>
                  <td className="px-4 py-3 text-cyan-400">{product.price} ₽</td>
                  <td className="px-4 py-3 text-white/60 text-sm">{product.category}</td>
                  <td className="px-4 py-3 text-white/60 text-sm">{product.type}</td>
                  <td className="px-4 py-3">
                    {product.hidden ? (
                      <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs">Скрыт</span>
                    ) : (
                      <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">Активен</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(product)}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
                      >
                        Редактировать
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
                      >
                        Удалить
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > 50 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-[#1a1a1a] border border-[#333333] text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#0C0C0C]"
          >
            Назад
          </button>
          <span className="text-white/60">
            Страница {page} из {Math.ceil(total / 50)}
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= Math.ceil(total / 50)}
            className="px-4 py-2 bg-[#1a1a1a] border border-[#333333] text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#0C0C0C]"
          >
            Вперед
          </button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] border border-[#333333] rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-white mb-4">
              {editingProduct ? 'Редактировать товар' : 'Добавить товар'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-white/80 text-sm mb-2">Название</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-4 py-2 bg-[#0C0C0C] border border-[#333333] rounded-lg text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/80 text-sm mb-2">Цена</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    required
                    className="w-full px-4 py-2 bg-[#0C0C0C] border border-[#333333] rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-white/80 text-sm mb-2">Категория</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2 bg-[#0C0C0C] border border-[#333333] rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="game">Игра</option>
                    <option value="skin">Скин</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-white/80 text-sm mb-2">Изображение</label>
                <input
                  type="text"
                  value={formData.image}
                  onChange={(e) => setFormData({ ...formData, image: e.target.value, introImage: e.target.value })}
                  className="w-full px-4 py-2 bg-[#0C0C0C] border border-[#333333] rounded-lg text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-white/80 text-sm mb-2">Описание</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2 bg-[#0C0C0C] border border-[#333333] rounded-lg text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="hidden"
                  checked={formData.hidden}
                  onChange={(e) => setFormData({ ...formData, hidden: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="hidden" className="text-white/80 text-sm">Скрыть товар</label>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="px-6 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors"
                >
                  Сохранить
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setEditingProduct(null)
                  }}
                  className="px-6 py-2 bg-[#333333] hover:bg-[#444444] text-white rounded-lg transition-colors"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

