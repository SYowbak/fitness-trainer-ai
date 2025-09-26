# Фітнес Тренер AI

Персоналізований веб-додаток для тренувань з використанням штучного інтелекту. Система генерує індивідуальні плани тренувань, адаптується до самопочуття користувача та надає рекомендації через AI тренера.

## Можливості

- 🔐 **Безпечна автентифікація** через Firebase
- 👤 **Персональний профіль** з детальними фітнес-параметрами
- 🤖 **AI генерація планів** тренувань через Google Gemini
- 📱 **Виконання тренувань** з відстеженням в реальному часі
- 💚 **Wellness моніторинг** та адаптивні тренування
- 💬 **AI тренер чат** для порад та мотивації
- 📊 **Аналітика прогресу** з розумними рекомендаціями

## Технологічний стек

- **Frontend:** React 18, TypeScript, Tailwind CSS
- **Backend:** Firebase (Authentication, Firestore, Realtime Database)
- **AI:** Google Gemini API
- **Build:** Vite
- **Hosting:** Vercel
- **CDN:** Vercel Edge Network
- **CI/CD:** GitHub + Vercel автодеплой

## Встановлення

1. Клонування репозиторію:
```bash
git clone https://github.com/SYowbak/fitness-trainer-ai.git
cd fitness-trainer-ai
```

2. Встановлення залежностей:
```bash
npm install
```

3. Налаштування змінних середовища:
```bash
# Створіть .env файл з наступними змінними:
VITE_API_KEY=your_gemini_api_key
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

4. Запуск в режимі розробки:
```bash
npm run dev
```

## Структура проекту

```
├── components/          # React компоненти
├── hooks/              # Користувацькі хуки
├── services/           # Бізнес-логіка та API
├── config/             # Конфігурація Firebase
├── types/              # TypeScript типи
├── utils/              # Допоміжні функції
├── styles/             # CSS стилі
└── requirements/       # Документація вимог
```

## Вимоги

Детальну документацію вимог можна знайти в папці `/requirements`:

### Функціональні вимоги
- [FR-01 до FR-05](./requirements/functional_requirements.md) - Основні функції системи

### Нефункціональні вимоги
- [NFR-01 до NFR-05](./requirements/non_functional_requirements.md) - Характеристики продуктивності, безпеки та UX

### User Stories
- [6 основних користувацьких історій](./requirements/user_stories.md) - Від реєстрації до аналізу прогресу

### Use Case Diagram
- [Діаграма сценаріїв використання](./requirements/use_case_diagram.md) - Візуальне представлення взаємодій

### Документація
- [SRS v1.0](./requirements/SRS_v1.md) - Повна специфікація вимог
- [Product Backlog](./requirements/backlog.md) - План розробки з пріоритизацією

## Ключові особливості архітектури

### Компонентна структура
- **App.tsx** - головний оркестратор додатку
- **Модульні компоненти** для кожної функції
- **Користувацькі хуки** для управління станом
- **Сервісні модулі** для зовнішніх інтеграцій

### Інтеграції
- **Firebase Authentication** - безпечна автентифікація
- **Firestore** - збереження профілів та аналітики
- **Realtime Database** - синхронізація тренувань
- **Google Gemini** - AI генерація та аналіз

### Особливості UX
- Адаптивний дизайн для всіх пристроїв
- Real-time синхронізація прогресу
- Інтуїтивний інтерфейс з wizard-подібним flow
- Темна/світла тема

## Розробка

### Команди
```bash
npm run dev      # Запуск в режимі розробки
npm run build    # Збірка для продакшену
npm run preview  # Попередній перегляд збірки
```

### Стандарти коду
- TypeScript для type safety
- ESLint для якості коду
- Prettier для форматування
- Компонентна архітектура

## Деплоймент

### Production Хостинг
**Vercel** - сучасна платформа для розгортання React додатків

**Переваги:**
- Автоматичний деплой при push в Git
- Global CDN для швидкої доставки
- Автоматичні SSL сертифікати
- Масштабування під навантаженням
- Моніторинг та аналітика

**Конфігурація:**
- `vercel.json` - налаштування маршрутів SPA
- Environment variables для API ключів
- Автоматична оптимізація збірки

## Контрибуція

1. Fork проекту
2. Створення feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit змін (`git commit -m 'Add some AmazingFeature'`)
4. Push в branch (`git push origin feature/AmazingFeature`)
5. Створення Pull Request

## Ліцензія

Цей проект використовується для навчальних цілей у рамках курсу "Моделі життєвого циклу, принципи і методології розробки".

## Автор

Проект розроблено як приклад сучасного веб-додатку з AI інтеграцією для курсу з методологій розробки ПЗ.