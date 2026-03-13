/**
 * 2GIS API Integration for Kazan places
 * API Docs: https://docs.2gis.com/en/api/search/places/overview
 */

export interface TwoGISPlace {
  id: string;
  name: string;
  type: string;
  description?: string;
  address?: string;
  addressName?: string;
  location?: {
    lat: number;
    lon: number;
  };
  contacts?: {
    phones?: { number: string; type?: string }[];
    websites?: { url: string }[];
  };
  schedule?: any;
  rating?: {
    score: number;
    reviewsCount: number;
  };
  photos?: { url: string }[];
  categories?: string[];
  rubrics?: string[];
}

// 2GIS API configuration
const TWOGIS_API_KEY = process.env.TWOGIS_API_KEY || '629f0d11-ac03-44b8-893b-c772f057c68f';
const TWOGIS_API_URL = 'https://catalog.api.2gis.ru';

// Kazan city name for search queries
const KAZAN_CITY = 'Казань';

// Search categories for 2GIS
export const SEARCH_QUERIES = {
  RESTAURANT: [
    'ресторан',
    'кафе',
    'бар',
    'паб',
    'кофейня',
    'стейкхаус',
    'итальянский ресторан',
    'японский ресторан',
    'грузинский ресторан',
  ],
  CAFE: [
    'кафе',
    'кофейня',
    'пекарня',
    'кондитерская',
    'чайная',
  ],
  BAR: [
    'бар',
    'паб',
    'винотека',
    'спикизи',
    'крафт бар',
  ],
  FAST_FOOD: [
    'фастфуд',
    'бургерная',
    'пиццерия',
    'суши',
    'шаурма',
    'шаверма',
  ],
  BEAUTY: [
    'салон красоты',
    'парикмахерская',
    'барбершоп',
    'ногтевая студия',
    'визажист',
    'косметолог',
    'перманентный макияж',
    'бровист',
  ],
  SPA: [
    'спа салон',
    'массаж',
    'массажный салон',
  ],
  VET: [
    'ветеринарная клиника',
    'ветклиника',
    'зооклиника',
    'зоосалон',
    'груминг',
    'ветеринарная станция',
  ],
  FITNESS: [
    'фитнес клуб',
    'спортзал',
    'тренажерный зал',
    'бассейн',
    'йога студия',
    'пилатес',
    'кроссфит',
  ],
  HOTEL: [
    'отель',
    'гостиница',
    'хостел',
    'мини-отель',
    'апарт-отель',
  ],
  SHOP: [
    'магазин продуктов',
    'супермаркет',
    'продуктовый магазин',
  ],
  MALL: [
    'торговый центр',
    'тц ',
    'молл',
    'shopping center',
  ],
  AUTO_SERVICE: [
    'автосервис',
    'сто',
    'автомастерская',
    'авторемонт',
    'шиномонтаж',
    'автоэлектрик',
  ],
  CAR_WASH: [
    'автомойка',
    'мойка самообслуживания',
    'детейлинг',
  ],
  PHARMACY: [
    'аптека',
    'аптечный пункт',
  ],
  HEALTH: [
    'поликлиника',
    'больница',
    'медцентр',
    'медицинский центр',
    'стоматология',
    'зубная клиника',
  ],
};

/**
 * Search places in 2GIS API
 */
export async function search2GIS(
  query: string,
  page: number = 1,
  pageSize: number = 50
): Promise<{ places: TwoGISPlace[]; total: number; hasMore: boolean }> {
  try {
    // Add Kazan to query if not present
    const searchQuery = query.toLowerCase().includes('казань') ? query : `${query} ${KAZAN_CITY}`;
    
    const params = new URLSearchParams({
      q: searchQuery,
      page_size: '10',
      page: String(page),
      key: TWOGIS_API_KEY,
      fields: 'items.point,items.address,items.contacts,items.schedule,items.rating,items.photos,items.rubrics',
      sort: 'rating',
    });

    const response = await fetch(`${TWOGIS_API_URL}/3.0/items?${params}`, {
      headers: {
        'User-Agent': 'KazanPlacesBot/1.0',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`2GIS API error ${response.status}:`, errorText);
      return { places: [], total: 0, hasMore: false };
    }

    const data = await response.json();

    if (data.meta?.code !== 200) {
      console.error('2GIS API error:', data.meta?.error);
      return { places: [], total: 0, hasMore: false };
    }

    const items = data.result?.items || [];
    
    const places: TwoGISPlace[] = items.map((item: any) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      description: item.description,
      address: item.address_name,
      addressName: item.address_name,
      location: item.point ? {
        lat: item.point.lat,
        lon: item.point.lon,
      } : undefined,
      contacts: {
        phones: item.contacts?.phones || [],
        websites: item.contacts?.websites || [],
      },
      schedule: item.schedule,
      rating: item.rating ? {
        score: item.rating.score || item.rating.value,
        reviewsCount: item.rating.reviews_count || 0,
      } : undefined,
      photos: item.photos?.map((p: any) => ({ url: p.url || p })) || [],
      categories: [],
      rubrics: item.rubrics?.map((r: any) => r.name) || [],
    }));

    const total = data.result?.total || 0;
    const hasMore = page * pageSize < total;

    console.log(`2GIS search "${query}": ${places.length} items (page ${page}, total: ${total})`);

    return { places, total, hasMore };
  } catch (error) {
    console.error('2GIS search error:', error);
    return { places: [], total: 0, hasMore: false };
  }
}

/**
 * Search all pages for a query
 */
export async function searchAllPages(
  query: string,
  maxPages: number = 10
): Promise<TwoGISPlace[]> {
  const allPlaces: TwoGISPlace[] = [];
  let page = 1;
  
  while (page <= maxPages) {
    const { places, total, hasMore } = await search2GIS(query, page, 50);
    
    if (places.length === 0) break;
    
    allPlaces.push(...places);
    
    if (!hasMore) break;
    
    page++;
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  return allPlaces;
}

/**
 * Map rubric to our category
 */
export function mapRubricToCategory(rubrics: string[], query: string): string {
  const rubricText = (rubrics || []).join(' ').toLowerCase();
  const queryLower = query.toLowerCase();
  
  // Direct mappings
  if (rubricText.includes('ресторан') || queryLower.includes('ресторан')) return 'RESTAURANT';
  if (rubricText.includes('кафе') || queryLower.includes('кафе')) return 'CAFE';
  if (rubricText.includes('бар') || rubricText.includes('паб') || queryLower.includes('бар')) return 'BAR';
  if (rubricText.includes('кофейня') || rubricText.includes('пекарня')) return 'CAFE';
  if (rubricText.includes('фастфуд') || rubricText.includes('бургер') || rubricText.includes('пицца')) return 'FAST_FOOD';
  if (rubricText.includes('суши') || rubricText.includes('япон')) return 'FAST_FOOD';
  if (rubricText.includes('салон красоты') || rubricText.includes('парикмахерская')) return 'BEAUTY';
  if (rubricText.includes('барбершоп')) return 'BEAUTY';
  if (rubricText.includes('ногтевая') || rubricText.includes('маникюр')) return 'BEAUTY';
  if (rubricText.includes('массаж') || rubricText.includes('спа')) return 'BEAUTY';
  if (rubricText.includes('косметолог') || rubricText.includes('визаж')) return 'BEAUTY';
  if (rubricText.includes('ветеринар') || rubricText.includes('зоо')) return 'SERVICE';
  if (rubricText.includes('фитнес') || rubricText.includes('спортзал') || rubricText.includes('тренажер')) return 'FITNESS';
  if (rubricText.includes('бассейн')) return 'FITNESS';
  if (rubricText.includes('йога') || rubricText.includes('пилатес')) return 'FITNESS';
  if (rubricText.includes('отель') || rubricText.includes('гостиница') || rubricText.includes('хостел')) return 'HOTEL';
  if (rubricText.includes('торговый центр') || rubricText.includes('тц') || rubricText.includes('молл')) return 'MALL';
  if (rubricText.includes('аптек')) return 'HEALTH';
  if (rubricText.includes('стоматолог') || rubricText.includes('зубн')) return 'HEALTH';
  if (rubricText.includes('медцентр') || rubricText.includes('поликлиник') || rubricText.includes('больниц')) return 'HEALTH';
  if (rubricText.includes('автосервис') || rubricText.includes('сто') || rubricText.includes('автомастерск')) return 'SERVICE';
  if (rubricText.includes('автомойка') || rubricText.includes('мойка')) return 'SERVICE';
  if (rubricText.includes('шиномонтаж')) return 'SERVICE';
  if (rubricText.includes('супермаркет') || rubricText.includes('магазин продукт')) return 'SHOP';
  
  // Default based on query
  if (queryLower.includes('ресторан')) return 'RESTAURANT';
  if (queryLower.includes('кафе')) return 'CAFE';
  if (queryLower.includes('бар')) return 'BAR';
  if (queryLower.includes('бьюти') || queryLower.includes('салон')) return 'BEAUTY';
  if (queryLower.includes('мойк')) return 'SERVICE';
  if (queryLower.includes('авто')) return 'SERVICE';
  
  return 'OTHER';
}

/**
 * Extract district from address
 */
export function extractDistrictFromAddress(address: string): string | null {
  const districts = [
    'Авиастроительный', 'Вахитовский', 'Кировский',
    'Московский', 'Ново-Савиновский', 'Приволжский', 'Советский',
  ];
  
  if (!address) return null;
  
  const addressLower = address.toLowerCase();
  
  for (const district of districts) {
    if (addressLower.includes(district.toLowerCase())) {
      return district;
    }
  }
  
  // Try to infer from street/area names
  if (addressLower.includes('баумана') || addressLower.includes('университетска')) return 'Вахитовский';
  if (addressLower.includes('проспект победы')) return 'Приволжский';
  if (addressLower.includes('ямашева')) return 'Московский';
  if (addressLower.includes('чуйкова') || addressLower.includes('линдора')) return 'Ново-Савиновский';
  
  return null;
}

/**
 * Get API key status
 */
export function getAPIKeyStatus(): { configured: boolean; keyPreview: string } {
  return {
    configured: !!TWOGIS_API_KEY,
    keyPreview: TWOGIS_API_KEY ? `${TWOGIS_API_KEY.slice(0, 8)}...${TWOGIS_API_KEY.slice(-4)}` : 'not set',
  };
}
