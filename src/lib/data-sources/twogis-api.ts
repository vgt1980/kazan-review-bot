/**
 * 2GIS API Integration for Kazan places
 * Fetches places data from 2GIS directories
 * 
 * API Docs: https://docs.2gis.com/en/api/search/places/overview
 * To get API key: https://dev.2gis.com/api
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
  schedule?: {
    days: { day: string; hours: string }[];
  };
  rating?: {
    score: number;
    reviewsCount: number;
  };
  photos?: { url: string }[];
  categories?: string[];
}

export interface TwoGISSearchResult {
  places: TwoGISPlace[];
  total: number;
  hasMore: boolean;
}

// 2GIS API configuration
const TWOGIS_API_URL = 'https://catalog.api.2gis.ru';
const TWOGIS_API_KEY = process.env.TWOGIS_API_KEY || '';

// Kazan city ID in 2GIS
const KAZAN_REGION_ID = 32;

// Category mapping for 2GIS search
export const TWOGIS_CATEGORIES = {
  RESTAURANT: {
    name: 'Рестораны',
    searchTerms: ['ресторан', 'кафе', 'бар', 'паб', 'кофейня'],
    codes: ['restaurant', 'cafe', 'bar', 'pub', 'coffee_shop'],
  },
  CAFE: {
    name: 'Кафе и кофейни',
    searchTerms: ['кафе', 'кофейня', 'пекарня', 'кондитерская'],
    codes: ['cafe', 'coffee_shop', 'bakery', 'confectionery'],
  },
  FAST_FOOD: {
    name: 'Быстрое питание',
    searchTerms: ['фастфуд', 'бургер', 'пицца', 'суши'],
    codes: ['fast_food', 'pizza', 'sushi'],
  },
  BEAUTY: {
    name: 'Салоны красоты',
    searchTerms: ['салон красоты', 'парикмахерская', 'барбершоп'],
    codes: ['beauty_salon', 'hairdresser', 'barbershop'],
  },
  SPA: {
    name: 'СПА и массаж',
    searchTerms: ['спа', 'массаж', 'салон красоты'],
    codes: ['spa', 'massage', 'beauty_salon'],
  },
  VET: {
    name: 'Ветклиники и зоосалоны',
    searchTerms: ['ветклиника', 'зооклиника', 'зоосалон', 'груминг'],
    codes: ['veterinary_clinic', 'pet_grooming', 'pet_services'],
  },
  FITNESS: {
    name: 'Фитнес и спорт',
    searchTerms: ['фитнес', 'спортзал', 'тренажерный зал', 'бассейн'],
    codes: ['fitness_center', 'gym', 'swimming_pool', 'sports_complex'],
  },
  HOTEL: {
    name: 'Отели',
    searchTerms: ['отель', 'гостиница', 'хостел'],
    codes: ['hotel', 'hostel', 'guest_house'],
  },
  SHOP: {
    name: 'Магазины',
    searchTerms: ['магазин', 'супермаркет', 'торговый центр'],
    codes: ['shop', 'supermarket', 'mall', 'shopping_center'],
  },
  MALL: {
    name: 'Торговые центры',
    searchTerms: ['тц', 'торговый центр', 'молл'],
    codes: ['mall', 'shopping_center'],
  },
  AUTO: {
    name: 'Автоуслуги',
    searchTerms: ['автосервис', 'автомойка', 'шиномонтаж', 'сто'],
    codes: ['car_service', 'car_wash', 'tire_service'],
  },
  PHARMACY: {
    name: 'Аптеки',
    searchTerms: ['аптека'],
    codes: ['pharmacy'],
  },
  BANK: {
    name: 'Банки',
    searchTerms: ['банк', 'банкомат', 'отделение банка'],
    codes: ['bank', 'atm'],
  },
};

/**
 * Search places in 2GIS
 */
export async function search2GIS(
  query: string,
  options: {
    limit?: number;
    offset?: number;
    category?: string;
    regionId?: number;
  } = {}
): Promise<TwoGISSearchResult> {
  const { limit = 20, offset = 0, regionId = KAZAN_REGION_ID } = options;

  // If no API key, return mock data or use alternative method
  if (!TWOGIS_API_KEY) {
    console.log('2GIS API key not configured, using alternative method');
    return search2GISAlternative(query, limit);
  }

  try {
    const params = new URLSearchParams({
      q: query,
      region_id: String(regionId),
      page_size: String(limit),
      page: String(Math.floor(offset / limit) + 1),
      key: TWOGIS_API_KEY,
      fields: 'items.point,items.address,items.contacts,items.schedule,items.rating,items.photos',
    });

    const response = await fetch(`${TWOGIS_API_URL}/3.0/items?${params}`);

    if (!response.ok) {
      throw new Error(`2GIS API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.meta?.code !== 200) {
      throw new Error(`2GIS API error: ${data.meta?.error?.message || 'Unknown error'}`);
    }

    const places: TwoGISPlace[] = (data.result?.items || []).map((item: any) => ({
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
        score: item.rating.score,
        reviewsCount: item.rating.reviews_count,
      } : undefined,
      photos: item.photos || [],
      categories: item Rubrics || [],
    }));

    return {
      places,
      total: data.result?.total || 0,
      hasMore: data.result?.total > offset + limit,
    };
  } catch (error) {
    console.error('2GIS search error:', error);
    return { places: [], total: 0, hasMore: false };
  }
}

/**
 * Alternative search using 2GIS web scraping (when no API key)
 */
async function search2GISAlternative(
  query: string,
  limit: number = 20
): Promise<TwoGISSearchResult> {
  try {
    const searchUrl = `https://2gis.ru/kazan/search/${encodeURIComponent(query)}`;
    
    // Use web reader to get content
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();
    
    const result = await zai.functions.invoke('page_reader', {
      url: searchUrl,
    });

    if (!result?.data?.html) {
      return { places: [], total: 0, hasMore: false };
    }

    // Parse places from HTML
    const places = parse2GISHTML(result.data.html, query);

    return {
      places: places.slice(0, limit),
      total: places.length,
      hasMore: false,
    };
  } catch (error) {
    console.error('2GIS alternative search error:', error);
    return { places: [], total: 0, hasMore: false };
  }
}

/**
 * Parse 2GIS HTML content
 */
function parse2GISHTML(html: string, query: string): TwoGISPlace[] {
  const places: TwoGISPlace[] = [];
  
  // Extract place data from HTML
  // This is a basic parser - real implementation would need more robust parsing
  
  // Look for JSON data embedded in the page
  const jsonDataMatch = html.match(/<script[^>]*>window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?})<\/script>/);
  
  if (jsonDataMatch) {
    try {
      // Would need to parse the actual JSON structure
      // For now, return empty array
    } catch (e) {
      // Ignore parse errors
    }
  }
  
  // Extract from meta tags or visible elements
  const nameRegex = /<div[^>]*class="[^"]*firmName[^"]*"[^>]*>([^<]+)<\/div>/gi;
  const addressRegex = /<div[^>]*class="[^"]*address[^"]*"[^>]*>([^<]+)<\/div>/gi;
  
  let nameMatch;
  let addressMatch;
  
  const names: string[] = [];
  const addresses: string[] = [];
  
  while ((nameMatch = nameRegex.exec(html)) !== null) {
    names.push(nameMatch[1].trim());
  }
  
  while ((addressMatch = addressRegex.exec(html)) !== null) {
    addresses.push(addressMatch[1].trim());
  }
  
  // Combine into places
  const minLen = Math.min(names.length, addresses.length);
  for (let i = 0; i < minLen; i++) {
    if (names[i] && names[i].length > 2) {
      places.push({
        id: `twogis_${i}_${Date.now()}`,
        name: names[i],
        type: 'unknown',
        address: addresses[i],
      });
    }
  }
  
  return places;
}

/**
 * Search places by category
 */
export async function searchByCategory(
  category: keyof typeof TWOGIS_CATEGORIES,
  limit: number = 50
): Promise<TwoGISPlace[]> {
  const categoryData = TWOGIS_CATEGORIES[category];
  if (!categoryData) {
    throw new Error(`Unknown category: ${category}`);
  }

  const allPlaces: TwoGISPlace[] = [];
  const seen = new Set<string>();

  for (const term of categoryData.searchTerms) {
    const query = `${term} Казань`;
    const result = await search2GIS(query, { limit: Math.ceil(limit / categoryData.searchTerms.length) });
    
    for (const place of result.places) {
      if (!seen.has(place.id)) {
        seen.add(place.id);
        allPlaces.push({
          ...place,
          categories: [categoryData.name, ...(place.categories || [])],
        });
      }
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  return allPlaces.slice(0, limit);
}

/**
 * Import all places from all categories
 */
export async function importAllFrom2GIS(
  placesPerCategory: number = 30
): Promise<TwoGISPlace[]> {
  const allPlaces: TwoGISPlace[] = [];
  const seen = new Set<string>();

  for (const [categoryKey] of Object.entries(TWOGIS_CATEGORIES)) {
    console.log(`Importing ${categoryKey}...`);
    
    const places = await searchByCategory(categoryKey as keyof typeof TWOGIS_CATEGORIES, placesPerCategory);
    
    for (const place of places) {
      const key = `${place.name}_${place.address}`;
      if (!seen.has(key)) {
        seen.add(key);
        allPlaces.push(place);
      }
    }
  }

  console.log(`Total places imported: ${allPlaces.length}`);
  return allPlaces;
}

/**
 * Get available categories
 */
export function get2GISCategories() {
  return Object.entries(TWOGIS_CATEGORIES).map(([key, data]) => ({
    id: key,
    name: data.name,
    searchTerms: data.searchTerms,
  }));
}

/**
 * Check if 2GIS API is configured
 */
export function is2GISConfigured(): boolean {
  return !!TWOGIS_API_KEY;
}
