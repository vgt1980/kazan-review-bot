/**
 * Auto-poster for Telegram channel
 * Generates and publishes posts about places in Kazan
 */

import ZAI from 'z-ai-web-dev-sdk';

export interface GeneratedPost {
  title: string;
  content: string;
  imageUrl?: string;
  placeName: string;
  category: string;
}

interface PlaceInfo {
  name: string;
  category: string;
  district?: string | null;
  address?: string | null;
  rating?: number;
  reviewCount?: number;
}

const CHANNEL_ID = (process.env.CHANNEL_ID || '-1003809470742').trim();
const BOT_TOKEN = process.env.BOT_TOKEN;

/**
 * Generate an image for the post using AI
 */
export async function generatePlaceImage(
  placeName: string,
  category: string
): Promise<string | null> {
  try {
    const zai = await ZAI.create();

    const categoryEmojis: Record<string, string> = {
      RESTAURANT: 'restaurant interior, delicious food, elegant dining',
      CAFE: 'cozy coffee shop, pastries, warm atmosphere',
      SHOP: 'modern store interior, shopping',
      BEAUTY: 'beauty salon, spa, relaxation',
      MALL: 'shopping mall, modern architecture',
      SERVICE: 'professional service center',
      OTHER: 'modern establishment',
    };

    const description = categoryEmojis[category] || categoryEmojis.OTHER;

    const prompt = `Professional photo of ${placeName} in Kazan, Russia. ${description}. Modern, inviting atmosphere, high quality, warm lighting, photorealistic, 4k`;

    const response = await zai.images.generations.create({
      prompt,
      size: '1344x768', // Landscape for Telegram
    });

    if (response.data?.[0]?.base64) {
      return response.data[0].base64;
    }

    return null;
  } catch (error) {
    console.error('Error generating image:', error);
    return null;
  }
}

/**
 * Generate post content using AI
 */
export async function generatePostContent(
  place: PlaceInfo
): Promise<GeneratedPost> {
  try {
    const zai = await ZAI.create();

    const categoryNames: Record<string, string> = {
      RESTAURANT: 'ресторан',
      CAFE: 'кофейня',
      SHOP: 'магазин',
      BEAUTY: 'бьюти-салон',
      MALL: 'торговый центр',
      SERVICE: 'сервис',
      OTHER: 'заведение',
    };

    const categoryName = categoryNames[place.category] || 'заведение';

    const prompt = `Ты - контент-менеджер Telegram канала "Честные отзывы Казани".
Напиши интересный пост для Telegram канала о заведении.

Информация о заведении:
- Название: ${place.name}
- Тип: ${categoryName}
- Район: ${place.district || 'Казань'}
- Адрес: ${place.address || 'Не указан'}
${place.rating ? `- Рейтинг: ${place.rating}/10` : ''}
${place.reviewCount ? `- Отзывов: ${place.reviewCount}` : ''}

Требования:
1. Заголовок - короткий и привлекательный (до 50 символов)
2. Текст - живой, интересный, на русском языке (до 500 символов)
3. Добавь 2-3 эмодзи
4. Призыв к действию - оставить отзыв в боте
5. Хештеги: #Казань #${categoryName.toLowerCase().replace(' ', '_')} #отзывы

Формат ответа (JSON):
{
  "title": "Заголовок",
  "content": "Текст поста..."
}`;

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'Ты - профессиональный SMM-специалист. Отвечай только в формате JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const responseText = completion.choices?.[0]?.message?.content || '';

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        title: parsed.title || place.name,
        content: parsed.content || '',
        placeName: place.name,
        category: place.category,
      };
    }

    // Fallback
    return {
      title: `📍 ${place.name}`,
      content: `Новое заведение в Казани!\n\n${place.name} - ${categoryName} в районе ${place.district || 'города'}\n\n📝 Оставьте свой отзыв в нашем боте!`,
      placeName: place.name,
      category: place.category,
    };
  } catch (error) {
    console.error('Error generating content:', error);
    return {
      title: `📍 ${place.name}`,
      content: `${place.name} - заведение в Казани.\n\n📝 Оставьте отзыв в боте!`,
      placeName: place.name,
      category: place.category,
    };
  }
}

/**
 * Send photo with caption to Telegram channel
 */
export async function sendPhotoToChannel(
  imageBase64: string,
  caption: string
): Promise<boolean> {
  if (!BOT_TOKEN) {
    console.error('BOT_TOKEN not set');
    return false;
  }

  try {
    // Convert base64 to buffer
    const imageBuffer = Buffer.from(imageBase64, 'base64');

    const formData = new FormData();
    formData.append('chat_id', CHANNEL_ID);
    formData.append('photo', new Blob([imageBuffer]), 'photo.jpg');
    formData.append('caption', caption);
    formData.append('parse_mode', 'HTML');

    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`,
      {
        method: 'POST',
        body: formData,
      }
    );

    const data = await response.json();

    if (!data.ok) {
      console.error('Telegram API error:', data.description);
      return false;
    }

    console.log('Photo sent successfully to channel');
    return true;
  } catch (error) {
    console.error('Error sending photo:', error);
    return false;
  }
}

/**
 * Send text message to Telegram channel
 */
export async function sendMessageToChannel(text: string): Promise<boolean> {
  if (!BOT_TOKEN) {
    console.error('BOT_TOKEN not set');
    return false;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: CHANNEL_ID,
          text,
          parse_mode: 'HTML',
        }),
      }
    );

    const data = await response.json();

    if (!data.ok) {
      console.error('Telegram API error:', data.description);
      return false;
    }

    console.log('Message sent successfully to channel');
    return true;
  } catch (error) {
    console.error('Error sending message:', error);
    return false;
  }
}

/**
 * Publish a post about a place
 */
export async function publishPlacePost(
  place: PlaceInfo
): Promise<{ success: boolean; message: string }> {
  try {
    // Generate content
    const post = await generatePostContent(place);

    // Generate image
    const imageBase64 = await generatePlaceImage(place.name, place.category);

    // Format caption
    const caption = `<b>${post.title}</b>\n\n${post.content}\n\n🤖 @Chest_Kazan_bot`;

    let success = false;

    if (imageBase64) {
      // Send with photo
      success = await sendPhotoToChannel(imageBase64, caption);
    }

    if (!success) {
      // Fallback to text-only message
      success = await sendMessageToChannel(caption);
    }

    return {
      success,
      message: success
        ? `Пост о "${place.name}" опубликован!`
        : 'Ошибка при публикации',
    };
  } catch (error) {
    console.error('Error publishing post:', error);
    return {
      success: false,
      message: `Ошибка: ${error}`,
    };
  }
}

/**
 * Publish a digest of top places
 */
export async function publishTopPlacesDigest(
  places: PlaceInfo[],
  categoryName: string
): Promise<{ success: boolean; message: string }> {
  try {
    const zai = await ZAI.create();

    const placesList = places
      .slice(0, 10)
      .map(
        (p, i) =>
          `${i + 1}. ${p.name}${p.rating ? ` (${p.rating}/10)` : ''}${p.district ? ` - ${p.district}` : ''}`
      )
      .join('\n');

    const prompt = `Создай пост-подборку для Telegram канала "Честные отзывы Казани".

Категория: ${categoryName}
ТОП мест:
${placesList}

Требования:
1. Привлекательный заголовок
2. Короткое вступление
3. Список мест (до 10)
4. Призыв оставить отзыв
5. Хештеги

Максимум 900 символов.`;

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = completion.choices?.[0]?.message?.content || '';

    // Generate image for digest
    const imageBase64 = await generatePlaceImage(
      `ТОП ${categoryName} Казань`,
      'RESTAURANT'
    );

    let success = false;

    if (imageBase64) {
      success = await sendPhotoToChannel(
        imageBase64,
        `<b>🏆 ТОП ${categoryName} Казани</b>\n\n${content}\n\n🤖 @Chest_Kazan_bot`
      );
    }

    if (!success) {
      success = await sendMessageToChannel(content);
    }

    return {
      success,
      message: success ? 'Дайджест опубликован!' : 'Ошибка при публикации',
    };
  } catch (error) {
    console.error('Error publishing digest:', error);
    return {
      success: false,
      message: `Ошибка: ${error}`,
    };
  }
}
