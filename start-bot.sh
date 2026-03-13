#!/bin/bash

echo "🤖 Запуск Telegram бота..."
echo ""
echo "📝 Проверка настроек..."

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "❌ Файл .env.local не найден!"
    echo "   Создайте файл .env.local с настройками"
    exit 1
fi

# Check for BOT_TOKEN
if grep -q "ВАШ_ТОКЕН_ЗДЕСЬ" .env.local; then
    echo "❌ BOT_TOKEN не настроен!"
    echo "   1. Откройте .env.local"
    echo "   2. Получите токен у @BotFather в Telegram"
    echo "   3. Вставьте токен вместо ВАШ_ТОКЕН_ЗДЕСЬ"
    exit 1
fi

echo "✅ Настройки найдены"
echo ""
echo "🚀 Запуск бота..."
echo ""

# Run bot
bun run bot
