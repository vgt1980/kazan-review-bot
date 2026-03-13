/**
 * Data sources for Kazan places
 * Integrates multiple APIs to get comprehensive place data
 */

import { fetchPlacesFromOSM, OSMPlace, mapOSMToCategory, formatOSMAddress } from './openstreetmap';

export interface PlaceData {
  name: string;
  category: string;
  address?: string;
  district?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  website?: string;
  source: string;
  externalId?: string;
}

// Districts of Kazan for address parsing
const KAZAN_DISTRICTS = [
  'Авиастроительный',
  'Вахитовский',
  'Кировский',
  'Московский',
  'Ново-Савиновский',
  'Приволжский',
  'Советский',
];

/**
 * Try to extract district from address
 */
function extractDistrict(address: string): string | undefined {
  for (const district of KAZAN_DISTRICTS) {
    if (address.toLowerCase().includes(district.toLowerCase())) {
      return district;
    }
  }
  return undefined;
}

/**
 * Import all places from OpenStreetMap for Kazan
 */
export async function importAllFromOSM(): Promise<PlaceData[]> {
  const places: PlaceData[] = [];

  // Fetch all amenity types we care about
  const amenityTypes = [
    'restaurant',
    'fast_food',
    'cafe',
    'pub',
    'bar',
    'shop',
    'supermarket',
    'convenience',
    'clothes',
    'beauty',
    'hairdresser',
    'spa',
    'bank',
    'pharmacy',
    'car_repair',
    'car_wash',
    'fuel',
  ];

  console.log('Fetching places from OpenStreetMap for Kazan...');

  for (const amenity of amenityTypes) {
    try {
      const osmPlaces = await fetchPlacesFromOSM(amenity, 1000);

      for (const place of osmPlaces) {
        if (!place.name) continue;

        const address = formatOSMAddress(place);
        const district = address ? extractDistrict(address) : undefined;

        places.push({
          name: place.name,
          category: mapOSMToCategory(place),
          address: address || undefined,
          district,
          latitude: place.lat,
          longitude: place.lon,
          phone: place.phone,
          website: place.website,
          source: 'OpenStreetMap',
          externalId: `osm_${place.id}`,
        });
      }

      console.log(`Fetched ${osmPlaces.length} ${amenity} places`);

      // Rate limiting - wait between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Error fetching ${amenity}:`, error);
    }
  }

  // Remove duplicates by name + category
  const seen = new Set<string>();
  const uniquePlaces = places.filter(place => {
    const key = `${place.name.toLowerCase()}_${place.category}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`Total unique places: ${uniquePlaces.length}`);
  return uniquePlaces;
}

/**
 * Import places by category from OSM
 */
export async function importByCategory(category: string): Promise<PlaceData[]> {
  const places: PlaceData[] = [];

  const categoryToAmenity: Record<string, string[]> = {
    RESTAURANT: ['restaurant', 'fast_food', 'pub', 'bar'],
    CAFE: ['cafe'],
    SHOP: ['shop', 'supermarket', 'convenience', 'clothes'],
    BEAUTY: ['beauty', 'hairdresser', 'spa'],
    SERVICE: ['bank', 'pharmacy', 'car_repair', 'car_wash', 'fuel'],
    MALL: ['mall'],
  };

  const amenities = categoryToAmenity[category] || [];

  for (const amenity of amenities) {
    try {
      const osmPlaces = await fetchPlacesFromOSM(amenity, 500);

      for (const place of osmPlaces) {
        if (!place.name) continue;

        const address = formatOSMAddress(place);
        const district = address ? extractDistrict(address) : undefined;

        places.push({
          name: place.name,
          category,
          address: address || undefined,
          district,
          latitude: place.lat,
          longitude: place.lon,
          phone: place.phone,
          website: place.website,
          source: 'OpenStreetMap',
          externalId: `osm_${place.id}`,
        });
      }

      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.error(`Error fetching ${amenity}:`, error);
    }
  }

  return places;
}

/**
 * Get stats about available places in OSM for Kazan
 */
export async function getOSMStats(): Promise<{
  total: number;
  byCategory: Record<string, number>;
}> {
  const stats = {
    total: 0,
    byCategory: {} as Record<string, number>,
  };

  const amenityTypes = [
    'restaurant',
    'fast_food',
    'cafe',
    'pub',
    'bar',
    'shop',
    'supermarket',
    'beauty',
    'hairdresser',
    'bank',
    'pharmacy',
  ];

  for (const amenity of amenityTypes) {
    try {
      const places = await fetchPlacesFromOSM(amenity, 1000);
      stats.byCategory[amenity] = places.length;
      stats.total += places.length;
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.error(`Error fetching ${amenity}:`, error);
    }
  }

  return stats;
}

/**
 * Web scraping for 2GIS (without API key)
 * Note: This is a basic implementation. For production, use official API
 */
export async function scrape2GIS(category: string, limit: number = 100): Promise<PlaceData[]> {
  // 2GIS has an unofficial API endpoint
  // Note: For production use, get an API key from https://docs.2gis.com/

  const categoryMap: Record<string, string> = {
    RESTAURANT: 'ресторан',
    CAFE: 'кафе',
    SHOP: 'магазин',
    BEAUTY: 'салон красоты',
  };

  const searchTerm = categoryMap[category] || 'заведение';

  // Using web reader to get content from 2GIS
  // This is a placeholder - in production, use official 2GIS API
  console.log(`Scraping 2GIS for: ${searchTerm}`);

  return [];
}
