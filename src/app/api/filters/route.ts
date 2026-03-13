import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Get filter options for places
export async function GET() {
  try {
    // Get unique categories from places
    const places = await db.place.findMany({
      select: { category: true, district: true }
    });

    // Count by category
    const categoryCount: Record<string, number> = {};
    const districtCount: Record<string, number> = {};

    places.forEach(place => {
      if (place.category) {
        categoryCount[place.category] = (categoryCount[place.category] || 0) + 1;
      }
      if (place.district) {
        districtCount[place.district] = (districtCount[place.district] || 0) + 1;
      }
    });

    // Category labels in Russian
    const categoryLabels: Record<string, string> = {
      RESTAURANT: '🍽️ Рестораны',
      CAFE: '☕ Кофейни',
      SHOP: '🛍️ Магазины',
      BEAUTY: '💅 Бьюти',
      MALL: '🏬 ТЦ',
      SERVICE: '🚗 Сервис',
      OTHER: '📦 Другое',
    };

    const categories = Object.entries(categoryCount)
      .map(([category, count]) => ({
        value: category,
        label: categoryLabels[category] || category,
        count
      }))
      .sort((a, b) => b.count - a.count);

    const districts = Object.entries(districtCount)
      .map(([district, count]) => ({
        value: district,
        label: district,
        count
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'ru'));

    return NextResponse.json({
      categories,
      districts,
      totalPlaces: places.length
    });
  } catch (error) {
    console.error('Error fetching filters:', error);
    return NextResponse.json(
      { error: 'Failed to fetch filters' },
      { status: 500 }
    );
  }
}
