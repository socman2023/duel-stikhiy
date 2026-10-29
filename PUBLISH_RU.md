# Как опубликовать отдельный репозиторий «Дуэль стихий»

## 1. Создание нового репозитория

Откройте https://github.com/new в аккаунте `socman2023`.

- Repository name: `duel-stikhiy`
- Visibility: **Public** (для GitHub Pages на стандартном бесплатном тарифе).
- Не выбирайте начальную генерацию README, `.gitignore` или License: они уже включены в проект.
- Нажмите **Create repository**.

## 2. Загрузка исходников из подготовленного ZIP

Распакуйте `Duel_Stikhiy_GitHub_Ready_v0_5_2.zip` в отдельную папку. Откройте терминал в папке, где лежит `package.json`.

Если Git установлен, выполните:

```sh
git init -b main
git add .
git commit -m "Дуэль стихий: стартовый прототип v0.5.2"
git remote add origin https://github.com/socman2023/duel-stikhiy.git
git push -u origin main
```

Альтернатива без терминала: GitHub Desktop → File → Add local repository → Create a Repository Here → Publish repository. Убедитесь, что публикуется новый `duel-stikhiy`, а не другой проект.

## 3. GitHub Pages

Откройте новый репозиторий → **Settings → Pages** → **Build and deployment → Source: GitHub Actions**.

Workflow `.github/workflows/pages.yml` публикует проверенную автономную браузерную версию из каталога `docs/`. Возможно, потребуется открыть вкладку Actions и разрешить выполнение workflows.

После успешной публикации ожидаемый адрес:

`https://socman2023.github.io/duel-stikhiy/`

До создания репозитория и первого успешного workflow этот адрес не активен.

## 4. Важные замечания

- Никакие секреты, токены или данные VK ID в репозиторий добавлять не нужно.
- Правки в `src/` **не изменяют автоматически** готовый сайт `docs/`. Чтобы обновить опубликованную версию, после установки npm-зависимостей выполните `npm run publish:pages` и отправьте новый коммит.
- `ci.yml` проверяет исходники; `pages.yml` публикует готовую автономную сборку отдельно от проверки исходников.
- На этой стадии VK Bridge ещё не внедрён; GitHub Pages нужен для браузерной проверки перед мини-приложением ВКонтакте.
