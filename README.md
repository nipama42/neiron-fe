# neiron-fe — Frontend

React SPA (Vite) для платформы Neiron. Telegram Web App, работающий внутри мессенджера, а также как самостоятельный сайт.

---

## Содержание

- [Технологический стек](#технологический-стек)
- [Быстрый старт (разработка)](#быстрый-старт-разработка)
- [Переменные окружения](#переменные-окружения)
- [Сборка и деплой](#сборка-и-деплой)
- [Аутентификация](#аутентификация)
- [Структура проекта](#структура-проекта)
- [Docker](#docker)

---

## Технологический стек

| Слой | Технология |
|------|-----------|
| Фреймворк | React 18 + TypeScript |
| Сборщик | Vite 5 |
| Стили | Tailwind CSS |
| Состояние | React Context (authStore) |
| HTTP-клиент | Fetch API |
| Telegram SDK | `@twa-dev/sdk` (Telegram Web App) |
| Контейнеризация | Docker (multi-stage: builder → nginx) |

---

## Быстрый старт (разработка)

### Требования

- Node.js 20+
- npm

### Установка

```bash
git clone https://github.com/your-org/neiron-fe.git
cd neiron-fe

npm install

cp .env.example .env   # или создайте .env вручную
```

### `.env` для разработки

```env
VITE_API_URL=http://localhost:3000
VITE_TELEGRAM_BOT_USERNAME=NeironBot
VITE_TELEGRAM_WEBAPP_SHORT_NAME=app
```

### Запуск dev-сервера

```bash
npm run dev
```

Приложение откроется на `http://localhost:5173`.

> **Совет**: для тестирования Telegram Web App используйте [BotFather → Edit Bot → Edit Web App URL] и ngrok для проксирования localhost.

---

## Переменные окружения

Все переменные начинаются с `VITE_` и встраиваются в бандл **во время сборки**. Не помещайте сюда секреты.

| Переменная | Обязательная | Описание |
|-----------|:---:|---------|
| `VITE_API_URL` | ✓ | Базовый URL бэкенда (без слеша в конце). Напр. `https://api.neiron.space` |
| `VITE_TELEGRAM_BOT_USERNAME` | ✓ | Юзернейм Telegram-бота без `@`. Используется для формирования deep links |
| `VITE_TELEGRAM_WEBAPP_SHORT_NAME` | — | Короткое имя Web App (для t.me ссылок) |

---

## Сборка и деплой

### Production-сборка локально

```bash
VITE_API_URL=https://api.neiron.space \
VITE_TELEGRAM_BOT_USERNAME=NeironBot \
npm run build
# Артефакты в ./dist/
```

### Предпросмотр production-сборки

```bash
npm run preview
```

---

## Аутентификация

Приложение поддерживает два способа входа:

### 1. Telegram Web App (`initData`)

При открытии внутри Telegram, `window.Telegram.WebApp.initData` автоматически содержит подписанные данные пользователя. Фронтенд отправляет их на `POST /auth/telegram`, получает `token` и `refreshToken`.

### 2. Bot-Login Flow

Для входа через браузер (не внутри Telegram):
1. Фронтенд запрашивает `GET /auth/telegram/bot-login-url` → получает ссылку на бота с одноразовым токеном.
2. Пользователь переходит в бот, нажимает START.
3. Фронтенд делает polling `GET /auth/telegram/bot-login-poll?token=…` каждые 2 секунды.
4. Когда бот авторизует пользователя, polling возвращает токены.

### Хранение токенов

| Ключ в localStorage | Содержимое |
|--------------------|-----------|
| `token` | JWT access token |
| `refreshToken` | JWT refresh token |

Access token автоматически обновляется при получении `401` через `POST /auth/token/refresh`. Токены также синхронизируются с Telegram CloudStorage (`CloudStorageKeys`).

---

## Структура проекта

```
neiron-fe/
├── public/               # Статические файлы (favicon, og-image и т.д.)
├── src/
│   ├── api/              # Функции-обёртки над fetch
│   │   └── auth.ts       # login, refreshTokensApi, getMe
│   ├── components/       # Переиспользуемые UI-компоненты
│   ├── pages/            # Страницы (роуты)
│   ├── store/
│   │   └── authStore.tsx # Контекст аутентификации, авто-refresh
│   ├── lib/
│   │   └── telegramCloudAuth.ts  # Синхронизация сессии с Telegram Cloud
│   └── main.tsx
├── Dockerfile            # Multi-stage: builder + nginx
├── nginx-static.conf     # Конфиг nginx для раздачи SPA
├── vite.config.ts
└── .env.example
```

---

## Docker

### Локальная сборка и запуск

```bash
docker build \
  --build-arg VITE_API_URL=https://api.neiron.space \
  --build-arg VITE_TELEGRAM_BOT_USERNAME=NeironBot \
  -t neiron-fe .

docker run -p 8080:80 neiron-fe
# Откройте http://localhost:8080
```

### В составе стека

Используйте `general-deploy/docker-compose.yml`. Сервис `neiron-fe` слушает порт `80` внутри Docker-сети и доступен по имени хоста `neiron-fe:80`.

`neiron-proxy` проксирует запросы на `neiron.space` → `http://neiron-fe:80`.

### Примечание о переменных окружения

Переменные `VITE_*` **встраиваются в бандл при сборке образа**. Чтобы изменить API URL, нужно пересобрать образ. Это стандартное поведение для Vite.
