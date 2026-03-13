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
            language_code?: string
          }
          query_id?: string
          auth_date?: number
          hash?: string
        }
        version: string
        platform: string
        colorScheme: 'light' | 'dark'
        themeParams: {
          bg_color?: string
          text_color?: string
          hint_color?: string
          link_color?: string
          button_color?: string
          button_text_color?: string
          secondary_bg_color?: string
        }
        isExpanded: boolean
        viewportHeight: number
        viewportStableHeight: number
        headerColor: string
        backgroundColor: string
        isClosingConfirmationEnabled: boolean
        BackButton: {
          isVisible: boolean
          show: () => void
          hide: () => void
          onClick: (callback: () => void) => void
          offClick: (callback: () => void) => void
        }
        MainButton: {
          text: string
          color: string
          textColor: string
          isVisible: boolean
          isActive: boolean
          isProgressVisible: boolean
          setText: (text: string) => void
          show: () => void
          hide: () => void
          enable: () => void
          disable: () => void
          showProgress: (leaveActive?: boolean) => void
          hideProgress: () => void
          onClick: (callback: () => void) => void
          offClick: (callback: () => void) => void
        }
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void
          selectionChanged: () => void
        }
        close: () => void
        expand: () => void
        ready: () => void
        setHeaderColor: (color: string) => void
        setBackgroundColor: (color: string) => void
        enableClosingConfirmation: () => void
        disableClosingConfirmation: () => void
        showPopup: (params: {
          title?: string
          message: string
          buttons?: Array<{
            id?: string
            type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive'
            text?: string
          }>
        }, callback?: (buttonId: string) => void) => void
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
  user: {
    username: string | null
    firstName: string | null
  }
  photos?: { fileId: string }[]
}

interface RSSItem {
  title: string
  link: string
  pubDate: string
  source: string
  imageUrl?: string
}

interface AdminStats {
  totalUsers: number
  totalPlaces: number
  totalReviews: number
  pendingReviews: number
}

// Category data
const CATEGORIES: { key: Category; name: string; icon: string }[] = [
  { key: 'RESTAURANT', name: 'Рестораны', icon: '🍽️' },
  { key: 'CAFE', name: 'Кофейни', icon: '☕' },
  { key: 'SHOP', name: 'Магазины', icon: '🛍️' },
  { key: 'BEAUTY', name: 'Бьюти', icon: '💅' },
  { key: 'MALL', name: 'ТЦ', icon: '🏬' },
  { key: 'SERVICE', name: 'Сервис', icon: '🚗' },
  { key: 'OTHER', name: 'Другое', icon: '📦' },
]

// Admin IDs
const ADMIN_IDS = ['1892592914']

// Navigation screens
type Screen = 
  | 'home' 
  | 'category' 
  | 'place' 
  | 'review' 
  | 'profile' 
  | 'rankings' 
  | 'news'
  | 'admin'
  | 'admin_reviews'
  | 'admin_places'
  | 'admin_rss'

export default function MiniApp() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home')
  const [screenHistory, setScreenHistory] = useState<Screen[]>(['home'])
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null)
  const [places, setPlaces] = useState<Place[]>([])
  const [allPlaces, setAllPlaces] = useState<Place[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [rssItems, setRssItems] = useState<RSSItem[]>([])
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [tgUser, setTgUser] = useState<{
    id: number
    first_name: string
    username?: string
  } | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  // Review form state
  const [reviewForm, setReviewForm] = useState({
    overallRating: 5,
    foodRating: 5,
    serviceRating: 5,
    atmosphereRating: 5,
    valueRating: 5,
    text: '',
  })

  // Initialize Telegram Web App
  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp
      tg.ready()
      tg.expand()
      
      // Set theme colors
      if (tg.themeParams.bg_color) {
        document.body.style.backgroundColor = tg.themeParams.bg_color
      }
      
      // Get user data
      if (tg.initDataUnsafe.user) {
        setTgUser(tg.initDataUnsafe.user)
        // Check if admin
        setIsAdmin(ADMIN_IDS.includes(String(tg.initDataUnsafe.user.id)))
      }
      
      console.log('Telegram Web App initialized:', tg.version)
    }
  }, [])

  // Navigate with history
  const navigateTo = useCallback((screen: Screen) => {
    setScreenHistory(prev => [...prev, screen])
    setCurrentScreen(screen)
    
    // Show back button for non-home screens
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      if (screen !== 'home') {
        window.Telegram.WebApp.BackButton.show()
      } else {
        window.Telegram.WebApp.BackButton.hide()
      }
      window.Telegram.WebApp.HapticFeedback.impactOccurred('light')
    }
  }, [])

  // Go back
  const goBack = useCallback(() => {
    if (screenHistory.length > 1) {
      const newHistory = screenHistory.slice(0, -1)
      setScreenHistory(newHistory)
      const prevScreen = newHistory[newHistory.length - 1]
      setCurrentScreen(prevScreen)
      
      if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
        if (prevScreen === 'home') {
          window.Telegram.WebApp.BackButton.hide()
        }
        window.Telegram.WebApp.HapticFeedback.impactOccurred('medium')
      }
    }
  }, [screenHistory])

  // Handle back button
  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp
      tg.BackButton.onClick(goBack)
      
      return () => {
        tg.BackButton.offClick(goBack)
      }
    }
  }, [goBack])

  // Fetch all places on mount
  useEffect(() => {
    const fetchAllPlaces = async () => {
      try {
        const response = await fetch('/api/places')
        const data = await response.json()
        setAllPlaces(data.places || [])
      } catch (error) {
        console.error('Error fetching places:', error)
      }
    }
    fetchAllPlaces()
  }, [])

  // Fetch places by category
  const fetchPlaces = useCallback(async (category: Category) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/places?category=${category}`)
      const data = await response.json()
      setPlaces(data.places || [])
    } catch (error) {
      console.error('Error fetching places:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch reviews for a place
  const fetchReviews = useCallback(async (placeId: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/reviews?placeId=${placeId}`)
      const data = await response.json()
      setReviews(data.reviews || [])
    } catch (error) {
      console.error('Error fetching reviews:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch RSS news
  const fetchRSS = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/rss')
      const data = await response.json()
      setRssItems(data.items || [])
    } catch (error) {
      console.error('Error fetching RSS:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch admin stats
  const fetchAdminStats = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/stats')
      const data = await response.json()
      setAdminStats(data)
    } catch (error) {
      console.error('Error fetching admin stats:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Navigate to category
  const openCategory = (category: Category) => {
    setSelectedCategory(category)
    fetchPlaces(category)
    navigateTo('category')
  }

  // Navigate to place
  const openPlace = (place: Place) => {
    setSelectedPlace(place)
    fetchReviews(place.id)
    navigateTo('place')
  }

  // Start review form
  const startReview = () => {
    navigateTo('review')
    setReviewForm({
      overallRating: 5,
      foodRating: 5,
      serviceRating: 5,
      atmosphereRating: 5,
      valueRating: 5,
      text: '',
    })
  }

  // Submit review
  const submitReview = async () => {
    if (!selectedPlace || reviewForm.text.length < 20) {
      if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert('Минимум 20 символов в тексте отзыва')
      }
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          placeId: selectedPlace.id,
          telegramId: tgUser?.id,
          ...reviewForm,
        }),
      })

      if (response.ok) {
        if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
          window.Telegram.WebApp.showAlert('Спасибо! Ваш отзыв отправлен на модерацию.', () => {
            goBack()
          })
        }
      }
    } catch (error) {
      console.error('Error submitting review:', error)
    } finally {
      setLoading(false)
    }
  }

  // Get theme colors (safe for SSR)
  const getThemeColors = useCallback(() => {
    if (typeof window === 'undefined' || !window.Telegram?.WebApp) {
      return {
        bgColor: '#ffffff',
        textColor: '#000000',
        buttonColor: '#3390ec',
        buttonTextColor: '#ffffff',
        secondaryBg: '#f0f0f0',
        hintColor: '#999999',
      };
    }
    const theme = window.Telegram.WebApp.themeParams;
    return {
      bgColor: theme?.bg_color || '#ffffff',
      textColor: theme?.text_color || '#000000',
      buttonColor: theme?.button_color || '#3390ec',
      buttonTextColor: theme?.button_text_color || '#ffffff',
      secondaryBg: theme?.secondary_bg_color || '#f0f0f0',
      hintColor: theme?.hint_color || '#999999',
    };
  }, []);

  const [themeColors, setThemeColors] = useState(getThemeColors());
  const { bgColor, textColor, buttonColor, buttonTextColor, secondaryBg, hintColor } = themeColors;

  // Update theme colors on mount
  useEffect(() => {
    setThemeColors(getThemeColors());
  }, [getThemeColors]);

  // Get top places
  const topPlaces = allPlaces
    .filter(p => p.reviewCount >= 1)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 10)

  // ==================== RENDER SCREENS ====================

  // Home Screen
  const renderHome = () => (
    <div className="min-h-screen pb-20" style={{ backgroundColor: bgColor }}>
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 py-3" style={{ backgroundColor: bgColor }}>
        <h1 className="text-xl font-bold" style={{ color: textColor }}>
          Честные отзывы Казани
        </h1>
        <p className="text-sm" style={{ color: hintColor }}>
          {allPlaces.length} заведений • Выберите категорию
        </p>
      </div>

      {/* Categories Grid */}
      <div className="px-4 py-2">
        <h2 className="text-sm font-semibold mb-3" style={{ color: hintColor }}>
          КАТЕГОРИИ
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {CATEGORIES.map((cat) => {
            const count = allPlaces.filter(p => p.category === cat.key).length
            return (
              <button
                key={cat.key}
                onClick={() => openCategory(cat.key)}
                className="flex items-center gap-3 p-4 rounded-xl transition-all active:scale-95"
                style={{ backgroundColor: secondaryBg }}
              >
                <span className="text-2xl">{cat.icon}</span>
                <div className="text-left">
                  <span className="font-medium block" style={{ color: textColor }}>
                    {cat.name}
                  </span>
                  <span className="text-xs" style={{ color: hintColor }}>
                    {count} мест
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 py-4">
        <h2 className="text-sm font-semibold mb-3" style={{ color: hintColor }}>
          БЫСТРЫЙ ДОСТУП
        </h2>
        <div className="space-y-2">
          <button
            onClick={() => { fetchRSS(); navigateTo('news') }}
            className="w-full flex items-center gap-3 p-4 rounded-xl transition-all active:scale-98"
            style={{ backgroundColor: secondaryBg }}
          >
            <span className="text-xl">📰</span>
            <div className="text-left">
              <div className="font-medium" style={{ color: textColor }}>
                Новости Казани
              </div>
              <div className="text-xs" style={{ color: hintColor }}>
                RSS лента
              </div>
            </div>
          </button>

          <button
            onClick={() => navigateTo('rankings')}
            className="w-full flex items-center gap-3 p-4 rounded-xl transition-all active:scale-98"
            style={{ backgroundColor: secondaryBg }}
          >
            <span className="text-xl">🏆</span>
            <div className="text-left">
              <div className="font-medium" style={{ color: textColor }}>
                Рейтинг заведений
              </div>
              <div className="text-xs" style={{ color: hintColor }}>
                ТОП и лучшие места
              </div>
            </div>
          </button>
          
          <button
            onClick={() => navigateTo('profile')}
            className="w-full flex items-center gap-3 p-4 rounded-xl transition-all active:scale-98"
            style={{ backgroundColor: secondaryBg }}
          >
            <span className="text-xl">👤</span>
            <div className="text-left">
              <div className="font-medium" style={{ color: textColor }}>
                Мой профиль
              </div>
              <div className="text-xs" style={{ color: hintColor }}>
                Статистика и отзывы
              </div>
            </div>
          </button>

          {isAdmin && (
            <button
              onClick={() => { fetchAdminStats(); navigateTo('admin') }}
              className="w-full flex items-center gap-3 p-4 rounded-xl transition-all active:scale-98 border-2"
              style={{ backgroundColor: secondaryBg, borderColor: buttonColor }}
            >
              <span className="text-xl">⚙️</span>
              <div className="text-left">
                <div className="font-medium" style={{ color: buttonColor }}>
                  Админ панель
                </div>
                <div className="text-xs" style={{ color: hintColor }}>
                  Управление и модерация
                </div>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div 
        className="fixed bottom-0 left-0 right-0 flex justify-around py-3 border-t"
        style={{ backgroundColor: bgColor, borderColor: secondaryBg }}
      >
        <button className="flex flex-col items-center gap-1" style={{ color: buttonColor }}>
          <span className="text-xl">🏠</span>
          <span className="text-xs">Главная</span>
        </button>
        <button 
          className="flex flex-col items-center gap-1" 
          style={{ color: hintColor }}
          onClick={() => navigateTo('rankings')}
        >
          <span className="text-xl">🏆</span>
          <span className="text-xs">Рейтинг</span>
        </button>
        <button 
          className="flex flex-col items-center gap-1"
          style={{ color: hintColor }}
          onClick={() => { fetchRSS(); navigateTo('news') }}
        >
          <span className="text-xl">📰</span>
          <span className="text-xs">Новости</span>
        </button>
        <button 
          className="flex flex-col items-center gap-1"
          style={{ color: hintColor }}
          onClick={() => navigateTo('profile')}
        >
          <span className="text-xl">👤</span>
          <span className="text-xs">Профиль</span>
        </button>
      </div>
    </div>
  )

  // Category Screen - List of places
  const renderCategory = () => (
    <div className="min-h-screen pb-4" style={{ backgroundColor: bgColor }}>
      <div className="sticky top-0 z-10 px-4 py-3" style={{ backgroundColor: bgColor }}>
        <h1 className="text-xl font-bold" style={{ color: textColor }}>
          {CATEGORIES.find(c => c.key === selectedCategory)?.icon}{' '}
          {CATEGORIES.find(c => c.key === selectedCategory)?.name}
        </h1>
        <p className="text-sm" style={{ color: hintColor }}>
          {places.length} заведений
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-blue-500" />
        </div>
      ) : (
        <div className="px-4 space-y-2">
          {places.map((place) => (
            <button
              key={place.id}
              onClick={() => openPlace(place)}
              className="w-full flex items-center justify-between p-4 rounded-xl transition-all active:scale-98"
              style={{ backgroundColor: secondaryBg }}
            >
              <div className="text-left flex-1">
                <div className="font-medium" style={{ color: textColor }}>
                  {place.name}
                </div>
                {place.address && (
                  <div className="text-xs" style={{ color: hintColor }}>
                    📍 {place.address}
                  </div>
                )}
              </div>
              {place.reviewCount > 0 && (
                <div className="text-right ml-2">
                  <div className="flex items-center gap-1">
                    <span className="text-yellow-500">⭐</span>
                    <span className="font-bold" style={{ color: textColor }}>
                      {place.rating.toFixed(1)}
                    </span>
                  </div>
                  <div className="text-xs" style={{ color: hintColor }}>
                    {place.reviewCount} отзывов
                  </div>
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

  // Place Screen - Place details and reviews
  const renderPlace = () => (
    <div className="min-h-screen pb-24" style={{ backgroundColor: bgColor }}>
      {/* Place Header */}
      <div className="px-4 py-3" style={{ backgroundColor: secondaryBg }}>
        <h1 className="text-xl font-bold" style={{ color: textColor }}>
          {selectedPlace?.name}
        </h1>
        <div className="flex items-center gap-2 mt-1">
          <span style={{ color: hintColor }}>
            {CATEGORIES.find(c => c.key === selectedPlace?.category)?.name}
          </span>
          {selectedPlace?.address && (
            <>
              <span style={{ color: hintColor }}>•</span>
              <span style={{ color: hintColor }}>📍 {selectedPlace.address}</span>
            </>
          )}
        </div>
        
        {selectedPlace && selectedPlace.reviewCount > 0 && (
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1">
              <span className="text-2xl">⭐</span>
              <span className="text-2xl font-bold" style={{ color: textColor }}>
                {selectedPlace.rating.toFixed(1)}
              </span>
              <span style={{ color: hintColor }}>/10</span>
            </div>
            <div style={{ color: hintColor }}>
              {selectedPlace.reviewCount} отзывов
            </div>
          </div>
        )}

        {/* Detailed ratings */}
        {selectedPlace && selectedPlace.reviewCount > 0 && (
          <div className="grid grid-cols-4 gap-2 mt-3">
            {selectedPlace.avgFood && selectedPlace.avgFood > 0 && (
              <div className="text-center p-2 rounded-lg" style={{ backgroundColor: bgColor }}>
                <div className="text-xs" style={{ color: hintColor }}>🍽 Еда</div>
                <div className="font-bold" style={{ color: textColor }}>{selectedPlace.avgFood.toFixed(1)}</div>
              </div>
            )}
            {selectedPlace.avgService && selectedPlace.avgService > 0 && (
              <div className="text-center p-2 rounded-lg" style={{ backgroundColor: bgColor }}>
                <div className="text-xs" style={{ color: hintColor }}>🤝 Сервис</div>
                <div className="font-bold" style={{ color: textColor }}>{selectedPlace.avgService.toFixed(1)}</div>
              </div>
            )}
            {selectedPlace.avgAtmosphere && selectedPlace.avgAtmosphere > 0 && (
              <div className="text-center p-2 rounded-lg" style={{ backgroundColor: bgColor }}>
                <div className="text-xs" style={{ color: hintColor }}>🏠 Атм.</div>
                <div className="font-bold" style={{ color: textColor }}>{selectedPlace.avgAtmosphere.toFixed(1)}</div>
              </div>
            )}
            {selectedPlace.avgValue && selectedPlace.avgValue > 0 && (
              <div className="text-center p-2 rounded-lg" style={{ backgroundColor: bgColor }}>
                <div className="text-xs" style={{ color: hintColor }}>💰 Ц/К</div>
                <div className="font-bold" style={{ color: textColor }}>{selectedPlace.avgValue.toFixed(1)}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reviews */}
      <div className="px-4 py-3">
        <h2 className="font-semibold mb-3" style={{ color: textColor }}>
          Отзывы
        </h2>

        {loading ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-blue-500" />
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.filter(r => r.status === 'approved').map((review) => (
              <div
                key={review.id}
                className="p-4 rounded-xl"
                style={{ backgroundColor: secondaryBg }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: buttonColor }}
                    >
                      <span className="text-white text-sm">
                        {(review.user.username || review.user.firstName || 'А')[0].toUpperCase()}
                      </span>
                    </div>
                    <span className="font-medium" style={{ color: textColor }}>
                      {review.user.username ? `@${review.user.username}` : review.user.firstName || 'Аноним'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-yellow-500">⭐</span>
                    <span className="font-bold" style={{ color: textColor }}>
                      {review.overallRating}
                    </span>
                  </div>
                </div>

                <p className="text-sm mb-3" style={{ color: textColor }}>
                  {review.text}
                </p>

                <div className="text-xs" style={{ color: hintColor }}>
                  {new Date(review.createdAt).toLocaleDateString('ru-RU')}
                </div>
              </div>
            ))}

            {reviews.filter(r => r.status === 'approved').length === 0 && (
              <div className="text-center py-6" style={{ color: hintColor }}>
                <div className="text-3xl mb-2">📝</div>
                <div>Отзывов пока нет</div>
                <div className="text-sm">Станьте первым!</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Write Review Button */}
      <div className="fixed bottom-4 left-4 right-4">
        <button
          onClick={startReview}
          className="w-full py-4 rounded-xl font-semibold transition-all active:scale-98"
          style={{ backgroundColor: buttonColor, color: buttonTextColor }}
        >
          ✍️ Написать отзыв
        </button>
      </div>
    </div>
  )

  // Review Form Screen
  const renderReviewForm = () => (
    <div className="min-h-screen pb-24" style={{ backgroundColor: bgColor }}>
      <div className="sticky top-0 z-10 px-4 py-3" style={{ backgroundColor: bgColor }}>
        <h1 className="text-xl font-bold" style={{ color: textColor }}>
          Новый отзыв
        </h1>
        <p className="text-sm" style={{ color: hintColor }}>
          {selectedPlace?.name}
        </p>
      </div>

      <div className="px-4 space-y-4 py-2">
        {/* Overall Rating */}
        <div className="p-4 rounded-xl" style={{ backgroundColor: secondaryBg }}>
          <label className="block font-medium mb-3" style={{ color: textColor }}>
            ⭐ Общая оценка: {reviewForm.overallRating}/10
          </label>
          <input
            type="range"
            min="1"
            max="10"
            value={reviewForm.overallRating}
            onChange={(e) => setReviewForm({ ...reviewForm, overallRating: parseInt(e.target.value) })}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer"
            style={{ backgroundColor: buttonColor }}
          />
        </div>

        {/* Food Rating */}
        <div className="p-4 rounded-xl" style={{ backgroundColor: secondaryBg }}>
          <label className="block font-medium mb-3" style={{ color: textColor }}>
            🍽 Еда: {reviewForm.foodRating}/10
          </label>
          <input
            type="range"
            min="1"
            max="10"
            value={reviewForm.foodRating}
            onChange={(e) => setReviewForm({ ...reviewForm, foodRating: parseInt(e.target.value) })}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer"
            style={{ backgroundColor: buttonColor }}
          />
        </div>

        {/* Service Rating */}
        <div className="p-4 rounded-xl" style={{ backgroundColor: secondaryBg }}>
          <label className="block font-medium mb-3" style={{ color: textColor }}>
            🤝 Сервис: {reviewForm.serviceRating}/10
          </label>
          <input
            type="range"
            min="1"
            max="10"
            value={reviewForm.serviceRating}
            onChange={(e) => setReviewForm({ ...reviewForm, serviceRating: parseInt(e.target.value) })}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer"
            style={{ backgroundColor: buttonColor }}
          />
        </div>

        {/* Atmosphere Rating */}
        <div className="p-4 rounded-xl" style={{ backgroundColor: secondaryBg }}>
          <label className="block font-medium mb-3" style={{ color: textColor }}>
            🏠 Атмосфера: {reviewForm.atmosphereRating}/10
          </label>
          <input
            type="range"
            min="1"
            max="10"
            value={reviewForm.atmosphereRating}
            onChange={(e) => setReviewForm({ ...reviewForm, atmosphereRating: parseInt(e.target.value) })}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer"
            style={{ backgroundColor: buttonColor }}
          />
        </div>

        {/* Value Rating */}
        <div className="p-4 rounded-xl" style={{ backgroundColor: secondaryBg }}>
          <label className="block font-medium mb-3" style={{ color: textColor }}>
            💰 Цена/качество: {reviewForm.valueRating}/10
          </label>
          <input
            type="range"
            min="1"
            max="10"
            value={reviewForm.valueRating}
            onChange={(e) => setReviewForm({ ...reviewForm, valueRating: parseInt(e.target.value) })}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer"
            style={{ backgroundColor: buttonColor }}
          />
        </div>

        {/* Review Text */}
        <div className="p-4 rounded-xl" style={{ backgroundColor: secondaryBg }}>
          <label className="block font-medium mb-3" style={{ color: textColor }}>
            💬 Текст отзыва
          </label>
          <textarea
            value={reviewForm.text}
            onChange={(e) => setReviewForm({ ...reviewForm, text: e.target.value })}
            placeholder="Расскажите о вашем опыте (минимум 20 символов)"
            className="w-full p-3 rounded-lg resize-none h-32"
            style={{ 
              backgroundColor: bgColor, 
              color: textColor,
              borderColor: hintColor 
            }}
          />
          <div className="text-xs mt-1" style={{ color: hintColor }}>
            {reviewForm.text.length}/20 символов
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <div className="fixed bottom-4 left-4 right-4">
        <button
          onClick={submitReview}
          disabled={loading || reviewForm.text.length < 20}
          className="w-full py-4 rounded-xl font-semibold transition-all active:scale-98 disabled:opacity-50"
          style={{ backgroundColor: buttonColor, color: buttonTextColor }}
        >
          {loading ? 'Отправка...' : '✅ Отправить на модерацию'}
        </button>
      </div>
    </div>
  )

  // Rankings Screen
  const renderRankings = () => (
    <div className="min-h-screen pb-4" style={{ backgroundColor: bgColor }}>
      <div className="sticky top-0 z-10 px-4 py-3" style={{ backgroundColor: bgColor }}>
        <h1 className="text-xl font-bold" style={{ color: textColor }}>
          🏆 Рейтинг заведений
        </h1>
        <p className="text-sm" style={{ color: hintColor }}>
          Лучшие места по отзывам
        </p>
      </div>

      <div className="px-4 space-y-2">
        {topPlaces.map((place, index) => (
          <button
            key={place.id}
            onClick={() => openPlace(place)}
            className="w-full flex items-center gap-3 p-4 rounded-xl transition-all active:scale-98"
            style={{ backgroundColor: secondaryBg }}
          >
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center font-bold"
              style={{ 
                backgroundColor: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : buttonColor,
                color: '#fff'
              }}
            >
              {index + 1}
            </div>
            <div className="flex-1 text-left">
              <div className="font-medium" style={{ color: textColor }}>
                {place.name}
              </div>
              <div className="text-xs" style={{ color: hintColor }}>
                {CATEGORIES.find(c => c.key === place.category)?.name} • {place.reviewCount} отзывов
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-yellow-500">⭐</span>
              <span className="font-bold" style={{ color: textColor }}>
                {place.rating.toFixed(1)}
              </span>
            </div>
          </button>
        ))}

        {topPlaces.length === 0 && (
          <div className="text-center py-8" style={{ color: hintColor }}>
            <div className="text-4xl mb-2">🏆</div>
            <div>Рейтинг формируется на основе отзывов</div>
          </div>
        )}
      </div>
    </div>
  )

  // News Screen
  const renderNews = () => (
    <div className="min-h-screen pb-4" style={{ backgroundColor: bgColor }}>
      <div className="sticky top-0 z-10 px-4 py-3" style={{ backgroundColor: bgColor }}>
        <h1 className="text-xl font-bold" style={{ color: textColor }}>
          📰 Новости Казани
        </h1>
        <p className="text-sm" style={{ color: hintColor }}>
          Актуальные события города
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-blue-500" />
        </div>
      ) : (
        <div className="px-4 space-y-3">
          {rssItems.map((item, index) => (
            <a
              key={index}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-4 rounded-xl transition-all active:scale-98"
              style={{ backgroundColor: secondaryBg }}
            >
              {item.imageUrl && (
                <img 
                  src={item.imageUrl} 
                  alt=""
                  className="w-full h-32 object-cover rounded-lg mb-2"
                />
              )}
              <div className="font-medium" style={{ color: textColor }}>
                {item.title}
              </div>
              <div className="text-xs mt-1" style={{ color: hintColor }}>
                {item.source} • {new Date(item.pubDate).toLocaleDateString('ru-RU')}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )

  // Profile Screen
  const renderProfile = () => (
    <div className="min-h-screen pb-4" style={{ backgroundColor: bgColor }}>
      <div className="px-4 py-3" style={{ backgroundColor: secondaryBg }}>
        <div className="flex items-center gap-3">
          <div 
            className="w-16 h-16 rounded-full flex items-center justify-center text-2xl"
            style={{ backgroundColor: buttonColor, color: buttonTextColor }}
          >
            {(tgUser?.first_name || 'U')[0]}
          </div>
          <div>
            <div className="font-bold text-lg" style={{ color: textColor }}>
              {tgUser?.first_name || 'Пользователь'}
            </div>
            {tgUser?.username && (
              <div style={{ color: hintColor }}>@{tgUser.username}</div>
            )}
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

        <div className="mt-6 p-4 rounded-xl" style={{ backgroundColor: secondaryBg }}>
          <h3 className="font-semibold mb-3" style={{ color: textColor }}>
            Прогресс до следующего статуса
          </h3>
          <div className="w-full h-2 rounded-full" style={{ backgroundColor: bgColor }}>
            <div 
              className="h-2 rounded-full transition-all"
              style={{ backgroundColor: buttonColor, width: '0%' }}
            />
          </div>
          <div className="text-xs mt-1" style={{ color: hintColor }}>
            0/5 отзывов до «Активный»
          </div>
        </div>
      </div>
    </div>
  )

  // Admin Screen
  const renderAdmin = () => (
    <div className="min-h-screen pb-4" style={{ backgroundColor: bgColor }}>
      <div className="sticky top-0 z-10 px-4 py-3" style={{ backgroundColor: bgColor }}>
        <h1 className="text-xl font-bold" style={{ color: textColor }}>
          ⚙️ Админ панель
        </h1>
        <p className="text-sm" style={{ color: hintColor }}>
          Управление сервисом
        </p>
      </div>

      {/* Stats */}
      {adminStats && (
        <div className="px-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-xl text-center" style={{ backgroundColor: secondaryBg }}>
              <div className="text-2xl font-bold" style={{ color: buttonColor }}>{adminStats.totalUsers}</div>
              <div className="text-xs" style={{ color: hintColor }}>Пользователей</div>
            </div>
            <div className="p-4 rounded-xl text-center" style={{ backgroundColor: secondaryBg }}>
              <div className="text-2xl font-bold" style={{ color: buttonColor }}>{adminStats.totalPlaces}</div>
              <div className="text-xs" style={{ color: hintColor }}>Заведений</div>
            </div>
            <div className="p-4 rounded-xl text-center" style={{ backgroundColor: secondaryBg }}>
              <div className="text-2xl font-bold" style={{ color: buttonColor }}>{adminStats.totalReviews}</div>
              <div className="text-xs" style={{ color: hintColor }}>Отзывов</div>
            </div>
            <div className="p-4 rounded-xl text-center" style={{ backgroundColor: secondaryBg }}>
              <div className="text-2xl font-bold" style={{ color: '#FF6B6B' }}>{adminStats.pendingReviews}</div>
              <div className="text-xs" style={{ color: hintColor }}>На модерации</div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Actions */}
      <div className="px-4 py-4 space-y-2">
        <h2 className="text-sm font-semibold mb-2" style={{ color: hintColor }}>
          ДЕЙСТВИЯ
        </h2>

        <button
          onClick={() => navigateTo('admin_reviews')}
          className="w-full flex items-center gap-3 p-4 rounded-xl transition-all active:scale-98"
          style={{ backgroundColor: secondaryBg }}
        >
          <span className="text-xl">📝</span>
          <div className="text-left flex-1">
            <div className="font-medium" style={{ color: textColor }}>
              Модерация отзывов
            </div>
            <div className="text-xs" style={{ color: hintColor }}>
              {adminStats?.pendingReviews || 0} ожидают проверки
            </div>
          </div>
          <span style={{ color: hintColor }}>→</span>
        </button>

        <button
          onClick={() => navigateTo('admin_places')}
          className="w-full flex items-center gap-3 p-4 rounded-xl transition-all active:scale-98"
          style={{ backgroundColor: secondaryBg }}
        >
          <span className="text-xl">🏪</span>
          <div className="text-left flex-1">
            <div className="font-medium" style={{ color: textColor }}>
              Управление заведениями
            </div>
            <div className="text-xs" style={{ color: hintColor }}>
              Добавление и редактирование
            </div>
          </div>
          <span style={{ color: hintColor }}>→</span>
        </button>

        <button
          onClick={() => navigateTo('admin_rss')}
          className="w-full flex items-center gap-3 p-4 rounded-xl transition-all active:scale-98"
          style={{ backgroundColor: secondaryBg }}
        >
          <span className="text-xl">📰</span>
          <div className="text-left flex-1">
            <div className="font-medium" style={{ color: textColor }}>
              RSS автопостинг
            </div>
            <div className="text-xs" style={{ color: hintColor }}>
              Новости в канал
            </div>
          </div>
          <span style={{ color: hintColor }}>→</span>
        </button>

        <button
          onClick={async () => {
            if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
              window.Telegram.WebApp.showConfirm('Опубликовать случайный отзыв в канал?', async (confirmed) => {
                if (confirmed) {
                  try {
                    const response = await fetch('/api/auto-post', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'random' })
                    })
                    const data = await response.json()
                    window.Telegram.WebApp.showAlert(data.success ? '✅ Опубликовано!' : '❌ Ошибка')
                  } catch (e) {
                    window.Telegram.WebApp.showAlert('❌ Ошибка отправки')
                  }
                }
              })
            }
          }}
          className="w-full flex items-center gap-3 p-4 rounded-xl transition-all active:scale-98"
          style={{ backgroundColor: buttonColor }}
        >
          <span className="text-xl">📤</span>
          <div className="text-left flex-1">
            <div className="font-medium" style={{ color: buttonTextColor }}>
              Опубликовать в канал
            </div>
            <div className="text-xs" style={{ color: buttonTextColor, opacity: 0.8 }}>
              Случайный отзыв
            </div>
          </div>
        </button>
      </div>
    </div>
  )

  // Admin Reviews Screen
  const renderAdminReviews = () => (
    <div className="min-h-screen pb-4" style={{ backgroundColor: bgColor }}>
      <div className="sticky top-0 z-10 px-4 py-3" style={{ backgroundColor: bgColor }}>
        <h1 className="text-xl font-bold" style={{ color: textColor }}>
          📝 Модерация отзывов
        </h1>
      </div>

      <div className="px-4 text-center py-8" style={{ color: hintColor }}>
        <div className="text-4xl mb-2">✅</div>
        <div>Нет отзывов на модерации</div>
      </div>
    </div>
  )

  // Admin Places Screen
  const renderAdminPlaces = () => (
    <div className="min-h-screen pb-4" style={{ backgroundColor: bgColor }}>
      <div className="sticky top-0 z-10 px-4 py-3" style={{ backgroundColor: bgColor }}>
        <h1 className="text-xl font-bold" style={{ color: textColor }}>
          🏪 Заведения
        </h1>
        <p className="text-sm" style={{ color: hintColor }}>
          {allPlaces.length} заведений
        </p>
      </div>

      <div className="px-4 space-y-2">
        {allPlaces.slice(0, 20).map((place) => (
          <div
            key={place.id}
            className="flex items-center justify-between p-3 rounded-xl"
            style={{ backgroundColor: secondaryBg }}
          >
            <div>
              <div className="font-medium" style={{ color: textColor }}>{place.name}</div>
              <div className="text-xs" style={{ color: hintColor }}>
                {CATEGORIES.find(c => c.key === place.category)?.name}
              </div>
            </div>
            {place.reviewCount > 0 && (
              <div className="text-xs" style={{ color: hintColor }}>
                ⭐ {place.rating.toFixed(1)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )

  // Admin RSS Screen
  const renderAdminRSS = () => (
    <div className="min-h-screen pb-4" style={{ backgroundColor: bgColor }}>
      <div className="sticky top-0 z-10 px-4 py-3" style={{ backgroundColor: bgColor }}>
        <h1 className="text-xl font-bold" style={{ color: textColor }}>
          📰 RSS автопостинг
        </h1>
      </div>

      <div className="px-4 space-y-3">
        <button
          onClick={async () => {
            setLoading(true)
            await fetchRSS()
            setLoading(false)
          }}
          className="w-full p-4 rounded-xl text-left"
          style={{ backgroundColor: secondaryBg }}
        >
          <div className="font-medium" style={{ color: textColor }}>
            🔄 Обновить новости
          </div>
          <div className="text-xs" style={{ color: hintColor }}>
            Загрузить свежие RSS новости
          </div>
        </button>

        <button
          onClick={async () => {
            if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
              window.Telegram.WebApp.showConfirm('Опубликовать последнюю новость в канал?', async (confirmed) => {
                if (confirmed) {
                  try {
                    const response = await fetch('/api/rss', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'publish_latest' })
                    })
                    const data = await response.json()
                    window.Telegram.WebApp.showAlert(data.success ? '✅ Опубликовано!' : '❌ Ошибка')
                  } catch (e) {
                    window.Telegram.WebApp.showAlert('❌ Ошибка отправки')
                  }
                }
              })
            }
          }}
          className="w-full p-4 rounded-xl text-left"
          style={{ backgroundColor: buttonColor }}
        >
          <div className="font-medium" style={{ color: buttonTextColor }}>
            📤 Опубликовать в канал
          </div>
          <div className="text-xs" style={{ color: buttonTextColor, opacity: 0.8 }}>
            Последняя новость из RSS
          </div>
        </button>
      </div>

      {/* RSS Items preview */}
      {rssItems.length > 0 && (
        <div className="px-4 mt-4">
          <h2 className="text-sm font-semibold mb-2" style={{ color: hintColor }}>
            Последние новости
          </h2>
          <div className="space-y-2">
            {rssItems.slice(0, 5).map((item, index) => (
              <div
                key={index}
                className="p-3 rounded-xl"
                style={{ backgroundColor: secondaryBg }}
              >
                <div className="text-sm" style={{ color: textColor }}>{item.title}</div>
                <div className="text-xs mt-1" style={{ color: hintColor }}>
                  {item.source}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  // Main render
  return (
    <>
      <script src="https://telegram.org/js/telegram-web-app.js" async></script>
      
      {currentScreen === 'home' && renderHome()}
      {currentScreen === 'category' && renderCategory()}
      {currentScreen === 'place' && renderPlace()}
      {currentScreen === 'review' && renderReviewForm()}
      {currentScreen === 'rankings' && renderRankings()}
      {currentScreen === 'news' && renderNews()}
      {currentScreen === 'profile' && renderProfile()}
      {currentScreen === 'admin' && renderAdmin()}
      {currentScreen === 'admin_reviews' && renderAdminReviews()}
      {currentScreen === 'admin_places' && renderAdminPlaces()}
      {currentScreen === 'admin_rss' && renderAdminRSS()}
    </>
  )
}
