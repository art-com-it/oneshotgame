import React, { useState } from 'react'

export default function Blog() {
  const [selectedCategory, setSelectedCategory] = useState('all')
  
  const categories = [
    { id: 'all', name: 'Все статьи' },
    { id: 'news', name: 'Новости' },
    { id: 'guides', name: 'Гайды' },
    { id: 'market', name: 'Рынок' },
    { id: 'updates', name: 'Обновления' }
  ]

  const articles = [
    {
      id: 1,
      title: "CS2 Major Copenhagen 2024: Лучшие скины турнира",
      excerpt: "Обзор самых популярных скинов, которые использовали профессиональные игроки на мейджоре в Копенгагене.",
      category: "news",
      date: "15 декабря 2024",
      readTime: "5 мин",
      image: "/images/blog/cs2-major.jpg",
      author: "Дмитрий Козлов"
    },
    {
      id: 2,
      title: "Как правильно оценить стоимость скина: Полный гайд",
      excerpt: "Подробное руководство по оценке скинов с учетом качества, редкости, популярности и рыночных трендов.",
      category: "guides",
      date: "12 декабря 2024",
      readTime: "8 мин",
      image: "/images/blog/skin-valuation.jpg",
      author: "Алексей Иванов"
    },
    {
      id: 3,
      title: "Топ-10 самых дорогих скинов 2024 года",
      excerpt: "Рейтинг самых дорогих скинов, проданных на нашей платформе в этом году. Рекордные цены и уникальные предметы.",
      category: "market",
      date: "10 декабря 2024",
      readTime: "6 мин",
      image: "/images/blog/expensive-skins.jpg",
      author: "Мария Петрова"
    },
    {
      id: 4,
      title: "Обновление платформы: Новые функции декабря",
      excerpt: "Представляем новые возможности: улучшенный поиск, мобильное приложение и систему автоматических торгов.",
      category: "updates",
      date: "8 декабря 2024",
      readTime: "4 мин",
      image: "/images/blog/platform-update.jpg",
      author: "Команда разработки"
    },
    {
      id: 5,
      title: "Безопасность торговли: Как избежать мошенников",
      excerpt: "Практические советы по безопасной торговле скинами. Признаки мошенничества и способы защиты.",
      category: "guides",
      date: "5 декабря 2024",
      readTime: "7 мин",
      image: "/images/blog/security-guide.jpg",
      author: "Мария Петрова"
    },
    {
      id: 6,
      title: "Анализ рынка: Тренды скинов в ноябре 2024",
      excerpt: "Подробный анализ рыночных трендов, изменения цен и прогнозы на следующий месяц.",
      category: "market",
      date: "1 декабря 2024",
      readTime: "10 мин",
      image: "/images/blog/market-analysis.jpg",
      author: "Аналитический отдел"
    }
  ]

  const filteredArticles = selectedCategory === 'all' 
    ? articles 
    : articles.filter(article => article.category === selectedCategory)

  return (
    <div className="min-h-screen bg-[#0D1A2F] text-white py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
            Блог Game Sale
          </h1>
          <p className="text-white/70 text-lg">
            Новости, гайды и аналитика мира игровых скинов
          </p>
        </div>

        {/* Категории */}
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          {categories.map(category => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                selectedCategory === category.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/5 border border-white/10 text-white/70 hover:bg-white/10'
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>

        {/* Главная статья */}
        {filteredArticles.length > 0 && (
          <div className="mb-12">
            <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
              <div className="aspect-video bg-gray-800 flex items-center justify-center">
                <span className="text-6xl">📰</span>
              </div>
              <div className="p-8">
                <div className="flex items-center gap-4 text-sm text-white/60 mb-4">
                  <span className="bg-blue-600 px-3 py-1 rounded-full text-white text-xs font-semibold">
                    {categories.find(cat => cat.id === filteredArticles[0].category)?.name}
                  </span>
                  <span>{filteredArticles[0].date}</span>
                  <span>•</span>
                  <span>{filteredArticles[0].readTime}</span>
                  <span>•</span>
                  <span>{filteredArticles[0].author}</span>
                </div>
                <h2 className="text-3xl font-bold mb-4">{filteredArticles[0].title}</h2>
                <p className="text-white/80 text-lg leading-relaxed mb-6">
                  {filteredArticles[0].excerpt}
                </p>
                <button className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold transition-colors">
                  Читать полностью
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Остальные статьи */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredArticles.slice(1).map(article => (
            <article key={article.id} className="bg-white/5 border border-white/10 rounded-lg overflow-hidden hover:bg-white/10 transition-colors group cursor-pointer">
              <div className="aspect-video bg-gray-800 flex items-center justify-center">
                <span className="text-4xl">📄</span>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-3 text-xs text-white/60 mb-3">
                  <span className={`px-2 py-1 rounded-full text-white text-xs font-semibold ${
                    article.category === 'news' ? 'bg-red-600' :
                    article.category === 'guides' ? 'bg-green-600' :
                    article.category === 'market' ? 'bg-yellow-600' :
                    'bg-purple-600'
                  }`}>
                    {categories.find(cat => cat.id === article.category)?.name}
                  </span>
                  <span>{article.date}</span>
                </div>
                <h3 className="text-lg font-bold mb-3 group-hover:text-blue-200 transition-colors">
                  {article.title}
                </h3>
                <p className="text-white/70 text-sm leading-relaxed mb-4">
                  {article.excerpt}
                </p>
                <div className="flex justify-between items-center text-xs text-white/60">
                  <span>{article.author}</span>
                  <span>{article.readTime}</span>
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* Подписка на новости */}
        <div className="mt-16 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-lg p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Подпишитесь на наши новости</h2>
          <p className="text-white/70 mb-6 max-w-2xl mx-auto">
            Получайте самые свежие новости, гайды и аналитику рынка скинов прямо на вашу почту
          </p>
          <div className="flex max-w-md mx-auto gap-4">
            <input
              type="email"
              placeholder="Ваш email"
              className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/50 focus:border-blue-500 focus:outline-none"
            />
            <button className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap">
              Подписаться
            </button>
          </div>
          <p className="text-white/50 text-xs mt-3">
            Мы не спамим и не передаем ваши данные третьим лицам
          </p>
        </div>

        {/* Популярные теги */}
        <div className="mt-12">
          <h3 className="text-xl font-bold mb-6 text-center">Популярные теги</h3>
          <div className="flex flex-wrap justify-center gap-3">
            {['CS2', 'Dota 2', 'Инвестиции', 'Трейдинг', 'Редкие скины', 'Мейджоры', 'Обновления', 'Безопасность'].map(tag => (
              <span key={tag} className="bg-white/5 border border-white/10 px-4 py-2 rounded-full text-sm text-white/70 hover:bg-white/10 cursor-pointer transition-colors">
                #{tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
