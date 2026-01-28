# Как настроить GitHub репозиторий для 3D моделей

## 1. Создайте GitHub репозиторий

Создайте новый публичный репозиторий на GitHub со следующей структурой:

```
your-3d-models-repo/
├── models/
│   ├── models.json          # Каталог всех моделей
│   ├── thumbnails/
│   │   ├── cube.jpg
│   │   ├── sphere.jpg
│   │   └── ...
│   └── files/
│       ├── cube.glb
│       ├── sphere.glb
│       └── ...
```

## 2. Создайте файл models.json

Создайте файл `models/models.json` с таким содержимым:

```json
{
  "models": [
    {
      "id": "cube-01",
      "name": "Simple Cube",
      "description": "Basic cube model",
      "author": "Your Name",
      "category": "Basic Shapes",
      "tags": ["cube", "basic", "geometry"],
      "thumbnail": "/models/thumbnails/cube.jpg",
      "glbUrl": "/models/files/cube.glb"
    },
    {
      "id": "sphere-01",
      "name": "Sphere",
      "description": "Basic sphere model",
      "author": "Your Name",
      "category": "Basic Shapes",
      "tags": ["sphere", "ball", "basic"],
      "thumbnail": "/models/thumbnails/sphere.jpg",
      "glbUrl": "/models/files/sphere.glb"
    }
  ]
}
```

## 3. Загрузите модели

1. Поместите GLB файлы в папку `models/files/`
2. Поместите изображения превью (JPG/PNG) в папку `models/thumbnails/`
3. Убедитесь что пути в models.json соответствуют реальным файлам

## 4. Настройте переменную окружения

В v0.dev добавьте переменную окружения:

**Имя:** `NEXT_PUBLIC_MODELS_REPO_URL`
**Значение:** `https://raw.githubusercontent.com/USERNAME/REPO/main`

Замените `USERNAME` и `REPO` на ваши реальные значения.

Например: `https://raw.githubusercontent.com/john/3d-models/main`

## 5. Готово!

После настройки переменной окружения, модели из вашего репозитория будут автоматически подгружаться в поиск "Browse Built-in 3D Models".

## Советы

- Используйте описательные имена файлов
- Добавляйте подробные теги для лучшего поиска
- Оптимизируйте GLB файлы (желательно < 5MB каждый)
- Используйте JPG для превью (400x400px рекомендуется)
- Пути в models.json должны начинаться с `/models/`
