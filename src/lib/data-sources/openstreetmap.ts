/**
 * OpenStreetMap Overpass API Client
 * Free API for getting places data without API keys
 */

export interface OSMPlace {
  id: number;
  name: string;
  type: string;
  lat: number;
  lon: number;
  amenity?: string;
  cuisine?: string;
  addr_street?: string;
  addr_housenumber?: string;
  addr_city?: string;
  phone?: string;
  website?: string;
  opening_hours?: string;
  brand?: string;
}

const OVERPASS_API = 'https://overpass-api.de/api/interpreter';

// Kazan bounding box (approximate)
const KAZAN_BBOX = {
  south: 55.65,
  west: 49.00,
  north: 55.90,
  east: 49.35,
};

// Map OSM amenity types to our categories
const AMENITY_TO_CATEGORY: Record<string, string> = {
  restaurant: 'RESTAURANT',
  fast_food: 'RESTAURANT',
  cafe: 'CAFE',
  coffee_shop: 'CAFE',
  shop: 'SHOP',
  supermarket: 'SHOP',
  convenience: 'SHOP',
  clothes: 'SHOP',
  beauty: 'BEAUTY',
  hairdresser: 'BEAUTY',
  spa: 'BEAUTY',
  mall: 'MALL',
  car_repair: 'SERVICE',
  car_wash: 'SERVICE',
  fuel: 'SERVICE',
  bank: 'SERVICE',
  pharmacy: 'SERVICE',
};

export async function fetchPlacesFromOSM(
  amenityType?: string,
  limit: number = 500
): Promise<OSMPlace[]> {
  const amenityFilter = amenityType
    ? `["amenity"="${amenityType}"]`
    : `["amenity"]`;

  const query = `
    [out:json][timeout:60];
    (
      node${amenityFilter}(${KAZAN_BBOX.south},${KAZAN_BBOX.west},${KAZAN_BBOX.north},${KAZAN_BBOX.east});
      way${amenityFilter}(${KAZAN_BBOX.south},${KAZAN_BBOX.west},${KAZAN_BBOX.north},${KAZAN_BBOX.east});
    );
    out center ${limit};
  `;

  try {
    const response = await fetch(OVERPASS_API, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status}`);
    }

    const data = await response.json();

    return data.elements
      .filter((el: any) => el.tags?.name)
      .map((el: any): OSMPlace => ({
        id: el.id,
        name: el.tags.name,
        type: el.type,
        lat: el.lat || el.center?.lat,
        lon: el.lon || el.center?.lon,
        amenity: el.tags.amenity,
        cuisine: el.tags.cuisine,
        addr_street: el.tags['addr:street'],
        addr_housenumber: el.tags['addr:housenumber'],
        addr_city: el.tags['addr:city'] || 'Казань',
        phone: el.tags.phone,
        website: el.tags.website,
        opening_hours: el.tags.opening_hours,
        brand: el.tags.brand,
      }));
  } catch (error) {
    console.error('Error fetching from OSM:', error);
    return [];
  }
}

export async function fetchRestaurantsFromOSM(): Promise<OSMPlace[]> {
  const restaurants = await fetchPlacesFromOSM('restaurant');
  const fastFood = await fetchPlacesFromOSM('fast_food');
  return [...restaurants, ...fastFood];
}

export async function fetchCafesFromOSM(): Promise<OSMPlace[]> {
  return fetchPlacesFromOSM('cafe');
}

export async function fetchShopsFromOSM(): Promise<OSMPlace[]> {
  const shops = await fetchPlacesFromOSM('shop');
  const supermarkets = await fetchPlacesFromOSM('supermarket');
  return [...shops, ...supermarkets];
}

export async function fetchBeautyFromOSM(): Promise<OSMPlace[]> {
  const beauty = await fetchPlacesFromOSM('beauty');
  const hairdresser = await fetchPlacesFromOSM('hairdresser');
  return [...beauty, ...hairdresser];
}

export async function fetchServicesFromOSM(): Promise<OSMPlace[]> {
  const carRepair = await fetchPlacesFromOSM('car_repair');
  const carWash = await fetchPlacesFromOSM('car_wash');
  const bank = await fetchPlacesFromOSM('bank');
  const pharmacy = await fetchPlacesFromOSM('pharmacy');
  return [...carRepair, ...carWash, ...bank, ...pharmacy];
}

export function mapOSMToCategory(place: OSMPlace): string {
  if (!place.amenity) return 'OTHER';
  return AMENITY_TO_CATEGORY[place.amenity] || 'OTHER';
}

export function formatOSMAddress(place: OSMPlace): string | null {
  const parts = [];
  if (place.addr_city) parts.push(place.addr_city);
  if (place.addr_street) parts.push(place.addr_street);
  if (place.addr_housenumber) parts.push(place.addr_housenumber);
  return parts.length > 0 ? parts.join(', ') : null;
}
