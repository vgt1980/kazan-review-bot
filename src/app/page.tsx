'use client'

import { useEffect, useState, useCallback } from 'react'
import { Category } from '@prisma/client'

// Telegram Web App types
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string
        initDataUnsafe: {
          user?: {
            id: number
            first_name: string
            last_name?: string
            username?: string
          }
        }
        themeParams: {
          bg_color?: string
          text_color?: string
          hint_color?: string
          button_color?: string
          button_text_color?: string
          secondary_bg_color?: string
        }
        BackButton: {
          isVisible: boolean
          show: () => void
          hide: () => void
          onClick: (callback: () => void) => void
          offClick: (callback: () => void) => void
        }
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy') => void
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void
        }
        close: () => void
        expand: () => void
        ready: () => void
        showAlert: (message: string, callback?: () => void) => void
        showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void
      }
    }
  }
}

// Types
interface Place {
  id: string
  name: string
  category: Category
  district: string | null
  address: string | null
  rating: number
  reviewCount: number
  avgFood?: number
  avgService?: number
  avgAtmosphere?: number
  avgValue?: number
}

interface Review {
  id: string
  overallRating: number
  foodRating: number | null
  serviceRating: number | null
  atmosphereRating: number | null
  valueRating: number | null
  text: string
  status: string
  createdAt: string
  user: { username: string | null; firstName: string | null }
}

interface RSSItem {
  title: string
  link: string
  description: string
  pubDate: string
  source: string
  imageUrl?: string
}

// Extended categories - matching Prisma schema
const CATEGORIES: { key: Category; name: string; icon: string }[] = [
  { key: 'RESTAURANT', name: 'Рестораны', icon: '🍽️' },
  { key: 'CAFE', name: 'Кофейни', icon: '☕' },
  { key: 'BAR', name: 'Бары', icon: '🍺' },
  { key: 'FAST_FOOD', name: 'Фастфуд', icon: '🍔' },
  { key: 'HOTEL', name: 'Отели', icon: '🏨' },
  { key: 'SHOP', name: 'Магазины', icon: '🛍️' },
  { key: 'MALL', name: 'ТЦ', icon: '🏬' },
  { key: 'BEAUTY', name: 'Салоны', icon: '💅' },
  { key: 'FITNESS', name: 'Фитнес', icon: '💪' },
  { key: 'ENTERTAINMENT', name: 'Развлечения', icon: '🎮' },
  { key: 'SERVICE', name: 'Услуги', icon: '🔧' },
  { key: 'HEALTH', name: 'Здоровье', icon: '🏥' },
  { key: 'EDUCATION', name: 'Образование', icon: '📚' },
  { key: 'TRANSPORT', name: 'Транспорт', icon: '🚗' },
  { key: 'OTHER', name: 'Другое', icon: '📦' },
]

const ADMIN_IDS = ['1892592914']

type Screen = 
  | 'home' | 'category' | 'place' | 'review' | 'profile' | 'rankings' 
  | 'admin' | 'admin_places' | 'admin_add_place' | 'admin_edit_place' | 'admin_rss' | 'admin_rss_list'

export default function MiniApp() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home')
  const [screenHistory, setScreenHistory] = useState<Screen[]>(['home'])
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null)
  const [places, setPlaces] = useState<Place[]>([])
  const [allPlaces, setAllPlaces] = useState<Place[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Place[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [rssItems, setRssItems] = useState<RSSItem[]>([])
  const [loading, setLoading] = useState(false)
  const [tgUser, setTgUser] = useState<{ id: number; first_name: string; username?: string } | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  // New place form
  const [newPlace, setNewPlace] = useState({
    name: '',
    category: 'RESTAURANT' as Category,
    district: '',
    address: '',
    description: '',
  })

  // Review form
  const [reviewForm, setReviewForm] = useState({
    overallRating: 5,
    foodRating: 5,
    serviceRating: 5,
    atmosphereRating: 5,
    valueRating: 5,
    text: '',
  })

  // Theme
  const getThemeColors = useCallback(() => {
    if (typeof window === 'undefined' || !window.Telegram?.WebApp) {
      return { bgColor: '#ffffff', textColor: '#000000', buttonColor: '#3390ec', buttonTextColor: '#ffffff', secondaryBg: '#f0f0f0', hintColor: '#999999' }
    }
    const t = window.Telegram.WebApp.themeParams
    return {
      bgColor: t?.bg_color || '#ffffff',
      textColor: t?.text_color || '#000000',
      buttonColor: t?.button_color || '#3390ec',
      buttonTextColor: t?.button_text_color || '#ffffff',
      secondaryBg: t?.secondary_bg_color || '#f0f0f0',
      hintColor: t?.hint_color || '#999999',
    }
  }, [])

  const [themeColors, setThemeColors] = useState(getThemeColors())
  const { bgColor, textColor, buttonColor, buttonTextColor, secondaryBg, hintColor } = themeColors

  // Init
  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp
      tg.ready()
      tg.expand()
      setThemeColors(getThemeColors())
      if (tg.initDataUnsafe.user) {
        setTgUser(tg.initDataUnsafe.user)
        setIsAdmin(ADMIN_IDS.includes(String(tg.initDataUnsafe.user.id)))
      }
    }
  }, [getThemeColors])

  // Load all places
  useEffect(() => {
    fetch('/api/places?limit=500')
      .then(r => r.json())
      .then(data => setAllPlaces(data.places || []))
      .catch(console.error)
  }, [])

  // Navigation
  const navigateTo = useCallback((screen: Screen) => {
    setScreenHistory(prev => [...prev, screen])
    setCurrentScreen(screen)
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      if (screen !== 'home') {
        window.Telegram.WebApp.BackButton.show()
      } else {
        window.Telegram.WebApp.BackButton.hide()
      }
      window.Telegram.WebApp.HapticFeedback.impactOccurred('light')
    }
  }, [])

  const goBack = useCallback(() => {
    if (screenHistory.length > 1) {
      const newHistory = screenHistory.slice(0, -1)
      setScreenHistory(newHistory)
      const prev = newHistory[newHistory.length - 1]
      setCurrentScreen(prev)
      if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
        if (prev === 'home') window.Telegram.WebApp.BackButton.hide()
      }
    }
  }, [screenHistory])

  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      window.Telegram.WebApp.BackButton.onClick(goBack)
      return () => window.Telegram.WebApp.BackButton.offClick(goBack)
    }
  }, [goBack])

  // Search
  useEffect(() => {
    if (searchQuery.length >= 2) {
      const results = allPlaces.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.address && p.address.toLowerCase().includes(searchQuery.toLowerCase()))
      ).slice(0, 20)
      setSearchResults(results)
    } else {
      setSearchResults([])
    }
  }, [searchQuery, allPlaces])

  // Fetch places by category
  const fetchPlaces = useCallback(async (category: Category) => {
    setLoading(true)
    try {
      const r = await fetch(`/api/places?category=${category}&limit=100`)
      const data = await r.json()
      setPlaces(data.places || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  // Fetch reviews
  const fetchReviews = useCallback(async (placeId: string) => {
    setLoading(true)
    try {
      const r = await fetch(`/api/reviews?placeId=${placeId}`)
      const data = await r.json()
      setReviews(data.reviews || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  // Fetch RSS
  const fetchRSS = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/rss')
      const data = await r.json()
      setRssItems(data.items || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  // Handlers
  const openCategory = (cat: Category) => {
    setSelectedCategory(cat)
    fetchPlaces(cat)
    navigateTo('category')
  }

  const openPlace = (place: Place) => {
    setSelectedPlace(place)
    fetchReviews(place.id)
    navigateTo('place')
  }

  const startReview = () => {
    navigateTo('review')
    setReviewForm({ overallRating: 5, foodRating: 5, serviceRating: 5, atmosphereRating: 5, valueRating: 5, text: '' })
  }

  const submitReview = async () => {
    if (!selectedPlace || reviewForm.text.length < 20) {
      window.Telegram?.WebApp?.showAlert('Минимум 20 символов в тексте отзыва')
      return
    }
    setLoading(true)
    try {
      const r = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeId: selectedPlace.id, telegramId: tgUser?.id, ...reviewForm }),
      })
      if (r.ok) {
        window.Telegram?.WebApp?.showAlert('Спасибо! Отзыв отправлен на модерацию.', () => goBack())
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  // Admin: Add place
  const addPlace = async () => {
    if (!newPlace.name) {
      window.Telegram?.WebApp?.showAlert('Введите название заведения')
      return
    }
    setLoading(true)
    try {
      const r = await fetch('/api/admin/places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId: tgUser?.id, place: newPlace }),
      })
      const data = await r.json()
      if (data.success) {
        window.Telegram?.WebApp?.showAlert('Заведение добавлено!', () => {
          setNewPlace({ name: '', category: 'RESTAURANT', district: '', address: '', description: '' })
          goBack()
        })
        // Refresh places
        const r2 = await fetch('/api/places?limit=500')
        const d2 = await r2.json()
        setAllPlaces(d2.places || [])
      } else {
        window.Telegram?.WebApp?.showAlert(data.error || 'Ошибка добавления')
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  // Admin: Publish to channel
  const publishToChannel = async (action: string, item?: any) => {
    window.Telegram?.WebApp?.showConfirm('Опубликовать в канал?', async (confirmed) => {
      if (!confirmed) return
      setLoading(true)
      try {
        const r = await fetch('/api/auto-post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, telegramId: tgUser?.id, item }),
        })
        const data = await r.json()
        window.Telegram?.WebApp?.showAlert(data.success ? '✅ Опубликовано!' : `❌ ${data.message || data.error}`)
      } catch (e) { 
        window.Telegram?.WebApp?.showAlert('❌ Ошибка отправки') 
      }
      finally { setLoading(false) }
    })
  }

  // Admin: Publish RSS item
  const publishRSSItem = async (item: RSSItem) => {
    window.Telegram?.WebApp?.showConfirm(`Опубликовать "${item.title}"?`, async (confirmed) => {
      if (!confirmed) return
      setLoading(true)
      try {
        const r = await fetch('/api/rss', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'publish', item, telegramId: tgUser?.id, generateImage: true }),
        })
        const data = await r.json()
        window.Telegram?.WebApp?.showAlert(data.success ? '✅ Опубликовано!' : '❌ Ошибка')
      } catch (e) {
        window.Telegram?.WebApp?.showAlert('❌ Ошибка')
      }
      finally { setLoading(false) }
    })
  }

  // ==================== RENDER ====================

  // Home
  const renderHome = () => (
    <div className="min-h-screen pb-20" style={{ backgroundColor: bgColor }}>
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 py-3" style={{ backgroundColor: bgColor }}>
        <h1 className="text-xl font-bold" style={{ color: textColor }}>Честные отзывы Казани</h1>
        <p className="text-sm" style={{ color: hintColor }}>{allPlaces.length} заведений</p>
      </div>

      {/* Search */}
      <div className="px-4 py-2">
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="🔍 Поиск заведений..."
          className="w-full p-3 rounded-xl text-base"
          style={{ backgroundColor: secondaryBg, color: textColor }}
        />
        {searchResults.length > 0 && (
          <div className="mt-2 space-y-1 rounded-xl overflow-hidden" style={{ backgroundColor: secondaryBg }}>
            {searchResults.map(p => (
              <button
                key={p.id}
                onClick={() => { setSearchQuery(''); setSearchResults([]); openPlace(p) }}
                className="w-full p-3 text-left border-b flex justify-between items-center"
                style={{ borderColor: bgColor }}
              >
                <div>
                  <div className="font-medium" style={{ color: textColor }}>{p.name}</div>
                  <div className="text-xs" style={{ color: hintColor }}>
                    {CATEGORIES.find(c => c.key === p.category)?.name} {p.address && `• ${p.address}`}
                  </div>
                </div>
                {p.reviewCount > 0 && (
                  <div className="flex items-center gap-1">
                    <span>⭐</span>
                    <span className="font-bold">{p.rating.toFixed(1)}</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Categories */}
      <div className="px-4 py-2">
        <h2 className="text-sm font-semibold mb-3" style={{ color: hintColor }}>КАТЕГОРИИ</h2>
        <div className="grid grid-cols-2 gap-2">
          {CATEGORIES.map(cat => {
            const count = allPlaces.filter(p => p.category === cat.key).length
            return (
              <button
                key={cat.key}
                onClick={() => openCategory(cat.key)}
                className="flex items-center gap-2 p-3 rounded-xl active:scale-95"
                style={{ backgroundColor: secondaryBg }}
              >
                <span className="text-xl">{cat.icon}</span>
                <div className="text-left flex-1">
                  <div className="font-medium text-sm" style={{ color: textColor }}>{cat.name}</div>
                  <div className="text-xs" style={{ color: hintColor }}>{count}</div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 py-4">
        <h2 className="text-sm font-semibold mb-3" style={{ color: hintColor }}>БЫСТРЫЙ ДОСТУП</h2>
        <div className="space-y-2">
          <button
            onClick={() => navigateTo('rankings')}
            className="w-full flex items-center gap-3 p-4 rounded-xl active:scale-98"
            style={{ backgroundColor: secondaryBg }}
          >
            <span className="text-xl">🏆</span>
            <div className="text-left">
              <div className="font-medium" style={{ color: textColor }}>Рейтинг заведений</div>
              <div className="text-xs" style={{ color: hintColor }}>Лучшие места Казани</div>
            </div>
          </button>
          
          <button
            onClick={() => navigateTo('profile')}
            className="w-full flex items-center gap-3 p-4 rounded-xl active:scale-98"
            style={{ backgroundColor: secondaryBg }}
          >
            <span className="text-xl">👤</span>
            <div className="text-left">
              <div className="font-medium" style={{ color: textColor }}>Мой профиль</div>
              <div className="text-xs" style={{ color: hintColor }}>Статистика и отзывы</div>
            </div>
          </button>

          {isAdmin && (
            <button
              onClick={() => navigateTo('admin')}
              className="w-full flex items-center gap-3 p-4 rounded-xl active:scale-98 border-2"
              style={{ backgroundColor: secondaryBg, borderColor: buttonColor }}
            >
              <span className="text-xl">⚙️</span>
              <div className="text-left">
                <div className="font-medium" style={{ color: buttonColor }}>Админ панель</div>
                <div className="text-xs" style={{ color: hintColor }}>Управление и модерация</div>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 flex justify-around py-3 border-t" style={{ backgroundColor: bgColor, borderColor: secondaryBg }}>
        <button className="flex flex-col items-center gap-1" style={{ color: buttonColor }}>
          <span className="text-xl">🏠</span>
          <span className="text-xs">Главная</span>
        </button>
        <button className="flex flex-col items-center gap-1" style={{ color: hintColor }} onClick={() => navigateTo('rankings')}>
          <span className="text-xl">🏆</span>
          <span className="text-xs">Рейтинг</span>
        </button>
        <button className="flex flex-col items-center gap-1" style={{ color: hintColor }} onClick={() => navigateTo('profile')}>
          <span className="text-xl">👤</span>
          <span className="text-xs">Профиль</span>
        </button>
      </div>
    </div>
  )

  // Category
  const renderCategory = () => (
    <div className="min-h-screen pb-4" style={{ backgroundColor: bgColor }}>
      <div className="sticky top-0 z-10 px-4 py-3" style={{ backgroundColor: bgColor }}>
        <h1 className="text-xl font-bold" style={{ color: textColor }}>
          {CATEGORIES.find(c => c.key === selectedCategory)?.icon} {CATEGORIES.find(c => c.key === selectedCategory)?.name}
        </h1>
        <p className="text-sm" style={{ color: hintColor }}>{places.length} заведений</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-blue-500" /></div>
      ) : (
        <div className="px-4 space-y-2">
          {places.map(place => (
            <button
              key={place.id}
              onClick={() => openPlace(place)}
              className="w-full flex items-center justify-between p-4 rounded-xl"
              style={{ backgroundColor: secondaryBg }}
            >
              <div className="text-left flex-1">
                <div className="font-medium" style={{ color: textColor }}>{place.name}</div>
                {place.address && <div className="text-xs" style={{ color: hintColor }}>📍 {place.address}</div>}
              </div>
              {place.reviewCount > 0 && (
                <div className="flex items-center gap-1">
                  <span>⭐</span>
                  <span className="font-bold" style={{ color: textColor }}>{place.rating.toFixed(1)}</span>
                </div>
              )}
            </button>
          ))}
          {places.length === 0 && (
            <div className="text-center py-8" style={{ color: hintColor }}>
              <div className="text-4xl mb-2">🔍</div>
              <div>Заведений пока нет</div>
            </div>
          )}
        </div>
      )}
    </div>
  )

  // Place
  const renderPlace = () => (
    <div className="min-h-screen pb-24" style={{ backgroundColor: bgColor }}>
      <div className="px-4 py-3" style={{ backgroundColor: secondaryBg }}>
        <h1 className="text-xl font-bold" style={{ color: textColor }}>{selectedPlace?.name}</h1>
        <div className="flex items-center gap-2 mt-1">
          <span style={{ color: hintColor }}>{CATEGORIES.find(c => c.key === selectedPlace?.category)?.name}</span>
          {selectedPlace?.address && <span style={{ color: hintColor }}>• 📍 {selectedPlace.address}</span>}
        </div>
        {selectedPlace && selectedPlace.reviewCount > 0 && (
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1">
              <span className="text-2xl">⭐</span>
              <span className="text-2xl font-bold" style={{ color: textColor }}>{selectedPlace.rating.toFixed(1)}</span>
            </div>
            <div style={{ color: hintColor }}>{selectedPlace.reviewCount} отзывов</div>
          </div>
        )}
      </div>

      <div className="px-4 py-3">
        <h2 className="font-semibold mb-3" style={{ color: textColor }}>Отзывы</h2>
        {loading ? (
          <div className="flex justify-center py-4"><div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-blue-500" /></div>
        ) : (
          <div className="space-y-3">
            {reviews.filter(r => r.status === 'approved').map(review => (
              <div key={review.id} className="p-4 rounded-xl" style={{ backgroundColor: secondaryBg }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: buttonColor }}>
                      <span className="text-white text-sm">{(review.user.username || review.user.firstName || 'А')[0].toUpperCase()}</span>
                    </div>
                    <span className="font-medium" style={{ color: textColor }}>{review.user.username ? `@${review.user.username}` : review.user.firstName || 'Аноним'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span>⭐</span>
                    <span className="font-bold" style={{ color: textColor }}>{review.overallRating}</span>
                  </div>
                </div>
                <p className="text-sm" style={{ color: textColor }}>{review.text}</p>
              </div>
            ))}
            {reviews.filter(r => r.status === 'approved').length === 0 && (
              <div className="text-center py-6" style={{ color: hintColor }}>
                <div className="text-3xl mb-2">📝</div>
                <div>Отзывов пока нет</div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="fixed bottom-4 left-4 right-4">
        <button
          onClick={startReview}
          className="w-full py-4 rounded-xl font-semibold"
          style={{ backgroundColor: buttonColor, color: buttonTextColor }}
        >
          ✍️ Написать отзыв
        </button>
      </div>
    </div>
  )

  // Review Form
  const renderReviewForm = () => (
    <div className="min-h-screen pb-24" style={{ backgroundColor: bgColor }}>
      <div className="sticky top-0 z-10 px-4 py-3" style={{ backgroundColor: bgColor }}>
        <h1 className="text-xl font-bold" style={{ color: textColor }}>Новый отзыв</h1>
        <p className="text-sm" style={{ color: hintColor }}>{selectedPlace?.name}</p>
      </div>

      <div className="px-4 space-y-3 py-2">
        {[
          { label: '⭐ Общая оценка', key: 'overallRating', value: reviewForm.overallRating },
          { label: '🍽 Еда', key: 'foodRating', value: reviewForm.foodRating },
          { label: '🤝 Сервис', key: 'serviceRating', value: reviewForm.serviceRating },
          { label: '🏠 Атмосфера', key: 'atmosphereRating', value: reviewForm.atmosphereRating },
          { label: '💰 Цена/качество', key: 'valueRating', value: reviewForm.valueRating },
        ].map(item => (
          <div key={item.key} className="p-3 rounded-xl" style={{ backgroundColor: secondaryBg }}>
            <label className="block font-medium mb-2" style={{ color: textColor }}>{item.label}: {item.value}/10</label>
            <input
              type="range"
              min="1"
              max="10"
              value={item.value}
              onChange={e => setReviewForm({ ...reviewForm, [item.key]: parseInt(e.target.value) })}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer"
              style={{ backgroundColor: buttonColor }}
            />
          </div>
        ))}

        <div className="p-3 rounded-xl" style={{ backgroundColor: secondaryBg }}>
          <label className="block font-medium mb-2" style={{ color: textColor }}>💬 Текст отзыва</label>
          <textarea
            value={reviewForm.text}
            onChange={e => setReviewForm({ ...reviewForm, text: e.target.value })}
            placeholder="Минимум 20 символов"
            className="w-full p-3 rounded-lg resize-none h-32"
            style={{ backgroundColor: bgColor, color: textColor }}
          />
          <div className="text-xs mt-1" style={{ color: hintColor }}>{reviewForm.text.length}/20</div>
        </div>
      </div>

      <div className="fixed bottom-4 left-4 right-4">
        <button
          onClick={submitReview}
          disabled={loading || reviewForm.text.length < 20}
          className="w-full py-4 rounded-xl font-semibold disabled:opacity-50"
          style={{ backgroundColor: buttonColor, color: buttonTextColor }}
        >
          {loading ? 'Отправка...' : '✅ Отправить'}
        </button>
      </div>
    </div>
  )

  // Rankings
  const renderRankings = () => {
    const topPlaces = allPlaces.filter(p => p.reviewCount >= 1).sort((a, b) => b.rating - a.rating).slice(0, 20)
    return (
      <div className="min-h-screen pb-4" style={{ backgroundColor: bgColor }}>
        <div className="sticky top-0 z-10 px-4 py-3" style={{ backgroundColor: bgColor }}>
          <h1 className="text-xl font-bold" style={{ color: textColor }}>🏆 Рейтинг заведений</h1>
        </div>
        <div className="px-4 space-y-2">
          {topPlaces.map((place, i) => (
            <button
              key={place.id}
              onClick={() => openPlace(place)}
              className="w-full flex items-center gap-3 p-3 rounded-xl"
              style={{ backgroundColor: secondaryBg }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white"
                style={{ backgroundColor: i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : buttonColor }}
              >
                {i + 1}
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium" style={{ color: textColor }}>{place.name}</div>
                <div className="text-xs" style={{ color: hintColor }}>{CATEGORIES.find(c => c.key === place.category)?.name} • {place.reviewCount} отзывов</div>
              </div>
              <div className="flex items-center gap-1">
                <span>⭐</span>
                <span className="font-bold" style={{ color: textColor }}>{place.rating.toFixed(1)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Profile
  const renderProfile = () => (
    <div className="min-h-screen pb-4" style={{ backgroundColor: bgColor }}>
      <div className="px-4 py-3" style={{ backgroundColor: secondaryBg }}>
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl" style={{ backgroundColor: buttonColor, color: buttonTextColor }}>
            {(tgUser?.first_name || 'U')[0]}
          </div>
          <div>
            <div className="font-bold text-lg" style={{ color: textColor }}>{tgUser?.first_name || 'Пользователь'}</div>
            {tgUser?.username && <div style={{ color: hintColor }}>@{tgUser.username}</div>}
          </div>
        </div>
      </div>
      <div className="px-4 py-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-xl text-center" style={{ backgroundColor: secondaryBg }}>
            <div className="text-2xl font-bold" style={{ color: buttonColor }}>0</div>
            <div className="text-xs" style={{ color: hintColor }}>Отзывов</div>
          </div>
          <div className="p-4 rounded-xl text-center" style={{ backgroundColor: secondaryBg }}>
            <div className="text-2xl font-bold" style={{ color: buttonColor }}>🌱</div>
            <div className="text-xs" style={{ color: hintColor }}>Новичок</div>
          </div>
        </div>
      </div>
    </div>
  )

  // Admin
  const renderAdmin = () => (
    <div className="min-h-screen pb-4" style={{ backgroundColor: bgColor }}>
      <div className="sticky top-0 z-10 px-4 py-3" style={{ backgroundColor: bgColor }}>
        <h1 className="text-xl font-bold" style={{ color: textColor }}>⚙️ Админ панель</h1>
      </div>

      <div className="px-4 py-2">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-4 rounded-xl text-center" style={{ backgroundColor: secondaryBg }}>
            <div className="text-2xl font-bold" style={{ color: buttonColor }}>{allPlaces.length}</div>
            <div className="text-xs" style={{ color: hintColor }}>Заведений</div>
          </div>
          <div className="p-4 rounded-xl text-center" style={{ backgroundColor: secondaryBg }}>
            <div className="text-2xl font-bold" style={{ color: buttonColor }}>0</div>
            <div className="text-xs" style={{ color: hintColor }}>На модерации</div>
          </div>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => navigateTo('admin_places')}
            className="w-full flex items-center gap-3 p-4 rounded-xl"
            style={{ backgroundColor: secondaryBg }}
          >
            <span className="text-xl">🏪</span>
            <div className="flex-1 text-left">
              <div className="font-medium" style={{ color: textColor }}>Заведения</div>
              <div className="text-xs" style={{ color: hintColor }}>Добавление и редактирование</div>
            </div>
            <span style={{ color: hintColor }}>→</span>
          </button>

          <button
            onClick={() => { fetchRSS(); navigateTo('admin_rss') }}
            className="w-full flex items-center gap-3 p-4 rounded-xl"
            style={{ backgroundColor: secondaryBg }}
          >
            <span className="text-xl">📰</span>
            <div className="flex-1 text-left">
              <div className="font-medium" style={{ color: textColor }}>RSS новости</div>
              <div className="text-xs" style={{ color: hintColor }}>Публикация в канал</div>
            </div>
            <span style={{ color: hintColor }}>→</span>
          </button>

          <button
            onClick={() => publishToChannel('random')}
            className="w-full flex items-center gap-3 p-4 rounded-xl"
            style={{ backgroundColor: buttonColor }}
          >
            <span className="text-xl">📤</span>
            <div className="flex-1 text-left">
              <div className="font-medium" style={{ color: buttonTextColor }}>Опубликовать в канал</div>
              <div className="text-xs" style={{ color: buttonTextColor, opacity: 0.8 }}>Случайное заведение</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  )

  // Admin Places
  const renderAdminPlaces = () => (
    <div className="min-h-screen pb-4" style={{ backgroundColor: bgColor }}>
      <div className="sticky top-0 z-10 px-4 py-3" style={{ backgroundColor: bgColor }}>
        <h1 className="text-xl font-bold" style={{ color: textColor }}>🏪 Заведения</h1>
        <p className="text-sm" style={{ color: hintColor }}>{allPlaces.length} заведений</p>
      </div>

      <div className="px-4 mb-4">
        <button
          onClick={() => navigateTo('admin_add_place')}
          className="w-full p-4 rounded-xl flex items-center gap-3"
          style={{ backgroundColor: buttonColor }}
        >
          <span className="text-xl">➕</span>
          <span className="font-medium" style={{ color: buttonTextColor }}>Добавить заведение</span>
        </button>
      </div>

      <div className="px-4 space-y-2">
        {allPlaces.slice(0, 30).map(place => (
          <div key={place.id} className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: secondaryBg }}>
            <div>
              <div className="font-medium" style={{ color: textColor }}>{place.name}</div>
              <div className="text-xs" style={{ color: hintColor }}>
                {CATEGORIES.find(c => c.key === place.category)?.name}
                {place.reviewCount > 0 && ` • ⭐ ${place.rating.toFixed(1)}`}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  // Admin Add Place
  const renderAdminAddPlace = () => (
    <div className="min-h-screen pb-24" style={{ backgroundColor: bgColor }}>
      <div className="sticky top-0 z-10 px-4 py-3" style={{ backgroundColor: bgColor }}>
        <h1 className="text-xl font-bold" style={{ color: textColor }}>➕ Добавить заведение</h1>
      </div>

      <div className="px-4 space-y-3">
        <div className="p-3 rounded-xl" style={{ backgroundColor: secondaryBg }}>
          <label className="block font-medium mb-2" style={{ color: textColor }}>Название *</label>
          <input
            type="text"
            value={newPlace.name}
            onChange={e => setNewPlace({ ...newPlace, name: e.target.value })}
            placeholder="Название заведения"
            className="w-full p-3 rounded-lg"
            style={{ backgroundColor: bgColor, color: textColor }}
          />
        </div>

        <div className="p-3 rounded-xl" style={{ backgroundColor: secondaryBg }}>
          <label className="block font-medium mb-2" style={{ color: textColor }}>Категория</label>
          <select
            value={newPlace.category}
            onChange={e => setNewPlace({ ...newPlace, category: e.target.value as Category })}
            className="w-full p-3 rounded-lg"
            style={{ backgroundColor: bgColor, color: textColor }}
          >
            {CATEGORIES.map(c => (
              <option key={c.key} value={c.key}>{c.icon} {c.name}</option>
            ))}
          </select>
        </div>

        <div className="p-3 rounded-xl" style={{ backgroundColor: secondaryBg }}>
          <label className="block font-medium mb-2" style={{ color: textColor }}>Район</label>
          <input
            type="text"
            value={newPlace.district}
            onChange={e => setNewPlace({ ...newPlace, district: e.target.value })}
            placeholder="Вахитовский, Приволжский..."
            className="w-full p-3 rounded-lg"
            style={{ backgroundColor: bgColor, color: textColor }}
          />
        </div>

        <div className="p-3 rounded-xl" style={{ backgroundColor: secondaryBg }}>
          <label className="block font-medium mb-2" style={{ color: textColor }}>Адрес</label>
          <input
            type="text"
            value={newPlace.address}
            onChange={e => setNewPlace({ ...newPlace, address: e.target.value })}
            placeholder="ул. Баумана, 1"
            className="w-full p-3 rounded-lg"
            style={{ backgroundColor: bgColor, color: textColor }}
          />
        </div>
      </div>

      <div className="fixed bottom-4 left-4 right-4">
        <button
          onClick={addPlace}
          disabled={loading || !newPlace.name}
          className="w-full py-4 rounded-xl font-semibold disabled:opacity-50"
          style={{ backgroundColor: buttonColor, color: buttonTextColor }}
        >
          {loading ? 'Сохранение...' : '✅ Добавить'}
        </button>
      </div>
    </div>
  )

  // Admin RSS
  const renderAdminRSS = () => (
    <div className="min-h-screen pb-4" style={{ backgroundColor: bgColor }}>
      <div className="sticky top-0 z-10 px-4 py-3" style={{ backgroundColor: bgColor }}>
        <h1 className="text-xl font-bold" style={{ color: textColor }}>📰 RSS Новости</h1>
        <p className="text-sm" style={{ color: hintColor }}>Выберите для публикации в канал</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-blue-500" /></div>
      ) : (
        <div className="px-4 space-y-3">
          {rssItems.map((item, i) => (
            <div
              key={i}
              className="p-4 rounded-xl"
              style={{ backgroundColor: secondaryBg }}
            >
              {item.imageUrl && (
                <img src={item.imageUrl} alt="" className="w-full h-32 object-cover rounded-lg mb-2" />
              )}
              <div className="font-medium" style={{ color: textColor }}>{item.title}</div>
              <div className="text-xs mt-1 mb-2" style={{ color: hintColor }}>
                {item.source} • {new Date(item.pubDate).toLocaleDateString('ru-RU')}
              </div>
              <button
                onClick={() => publishRSSItem(item)}
                className="w-full py-2 rounded-lg text-sm font-medium"
                style={{ backgroundColor: buttonColor, color: buttonTextColor }}
              >
                📤 Опубликовать в канал
              </button>
            </div>
          ))}
          {rssItems.length === 0 && (
            <div className="text-center py-8" style={{ color: hintColor }}>
              <div className="text-4xl mb-2">📰</div>
              <div>Загрузите новости кнопкой ниже</div>
            </div>
          )}
        </div>
      )}

      <div className="fixed bottom-4 left-4 right-4 flex gap-2">
        <button
          onClick={fetchRSS}
          disabled={loading}
          className="flex-1 py-3 rounded-xl font-medium"
          style={{ backgroundColor: secondaryBg, color: textColor }}
        >
          🔄 Обновить
        </button>
      </div>
    </div>
  )

  return (
    <>
      <script src="https://telegram.org/js/telegram-web-app.js" async></script>
      {currentScreen === 'home' && renderHome()}
      {currentScreen === 'category' && renderCategory()}
      {currentScreen === 'place' && renderPlace()}
      {currentScreen === 'review' && renderReviewForm()}
      {currentScreen === 'rankings' && renderRankings()}
      {currentScreen === 'profile' && renderProfile()}
      {currentScreen === 'admin' && renderAdmin()}
      {currentScreen === 'admin_places' && renderAdminPlaces()}
      {currentScreen === 'admin_add_place' && renderAdminAddPlace()}
      {currentScreen === 'admin_rss' && renderAdminRSS()}
    </>
  )
}
