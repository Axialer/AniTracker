// content.js
let lastReportedKey = null;
let currentUrl = window.location.href;
let retryCount = 0;
const MAX_RETRIES = 10;

// Основная функция сбора данных
function extractAnimeData() {
    const rawTitle = extractTitle();
    const normalizedTitle = normalizeTitle(rawTitle);
    
    // Сначала получаем эпизод, потом сезон (чтобы использовать эпизод в логике сезона)
    const episode = extractEpisode();
    const season = extractSeason(rawTitle, episode);
    
    return {
        title: normalizedTitle,
        rawTitle: rawTitle,
        episode: episode,
        season: season,
        cover: extractCover()
    };
}

// Улучшенная нормализация названий - убираем серии, оставляем сезоны
function normalizeTitle(title) {
    if (!title || title === 'Неизвестное аниме') return title;
    
    let normalized = title;
    
    // Удаляем упоминания СЕРИЙ/ЭПИЗОДОВ из названия (но оставляем сезоны!)
    const episodePatterns = [
        // Русские паттерны для серий
        /\s*\(\s*\d+\s*серия\s*\)/gi,
        /\s*\[\s*\d+\s*серия\s*\]/gi,
        /\s*-\s*\d+\s*серия\s*$/gi,
        /\s*серия\s*\d+\s*$/gi,
        /\s*эпизод\s*\d+\s*$/gi,
        /\s*серия\s*\d+/gi,
        /\s*эпизод\s*\d+/gi,
        /\s*#\d+\s*$/,
        
        // Английские паттерны для серий
        /\s*\(\s*episode\s*\d+\s*\)/gi,
        /\s*\[\s*episode\s*\d+\s*\]/gi,
        /\s*-\s*episode\s*\d+\s*$/gi,
        /\s*episode\s*\d+\s*$/gi,
        /\s*ep\s*\d+\s*$/gi,
        /\s*ep\.\s*\d+\s*$/gi,
        
        // Общие паттерны для серий
        /\s*\(\s*\d+\s*\)\s*$/,
        /\s*\[\s*\d+\s*\]\s*$/,
        /\s*-\s*\d+\s*$/,
        /\s*\.\s*\d+\s*$/,
        /\s*~\s*\d+\s*$/,
        
        // Паттерны с сериями (но сохраняем сезоны!)
        /\s*\(\s*сезон\s*\d+\s*серия\s*\d+\s*\)/gi,
        /\s*\(\s*season\s*\d+\s*episode\s*\d+\s*\)/gi,
        /\s*s\d+\s*e\d+\s*$/gi,
        /\s*season\s*\d+\s*episode\s*\d+\s*$/gi
    ];
    
    // Применяем все паттерны для очистки СЕРИЙ
    episodePatterns.forEach(pattern => {
        normalized = normalized.replace(pattern, '');
    });

    // Удаляем домены источников и служебную информацию
    const sourcePatterns = [
        // Домены источников (applers.org, shikimori.one и т.д.)
        /\s*эп\.\s*[a-zA-Z0-9.-]+\.[a-z]+/gi,
        /\s*ep\.\s*[a-zA-Z0-9.-]+\.[a-z]+/gi,
        
        // Временные метки
        /\s*только что$/gi,
        /\s*(\d+)\s*(мин|минут|minutes?)\s*назад$/gi,
        /\s*(\d+)\s*(ч|час|часов|hours?)\s*назад$/gi,
        /\s*(\d+)\s*(д|день|дней|days?)\s*назад$/gi,
        
        // Многоточия и обрезки в конце
        /\s*\.{3,}$/,
        /\s*…$/,
        /\s*k\s*\.\s*\.\s*\.$/i,
        /\s*c\s*\.\s*\.\s*\.$/i
    ];
    
    // Применяем паттерны источников
    sourcePatterns.forEach(pattern => {
        normalized = normalized.replace(pattern, '');
    });
    
    // Удаляем лишние пробелы и знаки препинания
    normalized = normalized
        .replace(/\s+/g, ' ')
        .replace(/\s*[.,;:!?\-~]\s*$/g, '')
        .trim();
    
    // Если после очистки осталась пустая строка, возвращаем оригинал
    if (!normalized || normalized.length < 2) {
        return title;
    }
    
    return normalized;
}

// ПОЛНОСТЬЮ ПЕРЕПИСАННАЯ логика определения сезона
function extractSeason(rawTitle, episode) {
    console.log('[AniTracker] Начинаем определение сезона для:', rawTitle);
    
    // Шаг 1: Агрессивный поиск сезона в названии (абсолютный приоритет)
    const seasonFromTitle = extractSeasonFromTitleAggressive(rawTitle);
    if (seasonFromTitle) {
        console.log(`[AniTracker] Сезон найден в названии: ${seasonFromTitle}`);
        return seasonFromTitle;
    }
    
    // Шаг 2: Если в названии не нашли, проверяем другие источники
    const otherSources = [
        extractSeasonFromUrl,
        extractSeasonFromActive,
        extractSeasonFromPlayer
    ];
    
    for (const source of otherSources) {
        const season = source();
        if (season && season !== episode) { // Игнорируем если сезон равен эпизоду
            console.log(`[AniTracker] Сезон найден через ${source.name}: ${season}`);
            return season;
        }
    }
    
    // Шаг 3: Умный фолбэк на основе анализа эпизода и названия
    const smartFallback = extractSeasonSmartFallback(rawTitle, episode);
    console.log(`[AniTracker] Используем умный фолбэк: ${smartFallback}`);
    return smartFallback;
}

// АГРЕССИВНЫЙ поиск сезона в названии
function extractSeasonFromTitleAggressive(rawTitle) {
    // Собираем все возможные текстовые источники
    const searchText = [
        rawTitle,
        document.title,
        document.querySelector('h1')?.textContent || '',
        document.querySelector('h2')?.textContent || '',
        document.querySelector('.anime-title')?.textContent || '',
        document.querySelector('.video-title')?.textContent || '',
        document.querySelector('.player-title')?.textContent || ''
    ].join(' ').toLowerCase();
    
    console.log('[AniTracker] Анализируем текст для поиска сезона:', searchText);
    
    // Расширенные паттерны для поиска сезона
    const seasonPatterns = [
        // Русские паттерны
        /(\d+)\s*сезон/,
        /сезон\s*(\d+)/,
        /(\d+)\s*сзн/,
        /сзн\s*(\d+)/,
        
        // Английские паттерны  
        /season\s*(\d+)/,
        /(\d+)\s*season/,
        /s(\d+)(?!\d)/, // s4, но не s404
        /s\s*(\d+)/,
        
        // Части
        /часть\s*(\d+)/,
        /part\s*(\d+)/,
        /(\d+)\s*часть/,
        /(\d+)\s*part/,
        
        // Римские цифры (конвертируем в арабские)
        /сезон\s*(i{1,3}v?i{0,3})/,
        /season\s*(i{1,3}v?i{0,3})/,
        /(i{1,3}v?i{0,3})\s*сезон/,
        /(i{1,3}v?i{0,3})\s*season/,
        
        // Специфичные для аниме паттерны
        /(\d+)\s*st season/,
        /(\d+)\s*nd season/,
        /(\d+)\s*rd season/,
        /(\d+)\s*th season/
    ];
    
    for (const pattern of seasonPatterns) {
        const match = searchText.match(pattern);
        if (match && match[1]) {
            let foundSeason = match[1];
            
            // Конвертируем римские цифры в арабские
            if (/^[ivx]+$/i.test(foundSeason)) {
                foundSeason = romanToArabic(foundSeason.toUpperCase());
            }
            
            // Проверяем что найденный сезон разумен (1-20)
            const seasonNum = parseInt(foundSeason);
            if (seasonNum >= 1 && seasonNum <= 20) {
                console.log(`[AniTracker] Найден сезон по паттерну ${pattern}: ${foundSeason}`);
                return foundSeason;
            }
        }
    }
    
    return null;
}

// Функция конвертации римских цифр в арабские
function romanToArabic(roman) {
    const romanMap = {
        'I': 1, 'V': 5, 'X': 10, 'L': 50,
        'C': 100, 'D': 500, 'M': 1000
    };
    
    let result = 0;
    for (let i = 0; i < roman.length; i++) {
        const current = romanMap[roman[i]];
        const next = romanMap[roman[i + 1]];
        
        if (next && current < next) {
            result -= current;
        } else {
            result += current;
        }
    }
    return result.toString();
}

// Стратегия: Из URL
function extractSeasonFromUrl() {
    const url = window.location.href.toLowerCase();
    const patterns = [
        /season=(\d+)/,
        /s(\d+)(?!\d)/, // s3, но не s300
        /season-(\d+)/,
        /[?&]s=(\d+)/,
        /-s(\d+)-/,
        /_s(\d+)_/
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            const season = match[1];
            // Проверяем что сезон из URL разумен
            const seasonNum = parseInt(season);
            if (seasonNum >= 1 && seasonNum <= 20) {
                console.log(`[AniTracker] Найден сезон в URL: ${season} по паттерну: ${pattern}`);
                return season;
            }
        }
    }
    return null;
}

// Стратегия: Из активных элементов
function extractSeasonFromActive() {
    const activeSelectors = [
        '.season-item.active',
        '.active [data-season]',
        '[class*="active"][class*="season"]',
        '.season-selector .active',
        '.season-tab.active'
    ];

    for (const selector of activeSelectors) {
        const element = document.querySelector(selector);
        if (element) {
            const dataSeason = element.getAttribute('data-season');
            if (dataSeason) {
                console.log(`[AniTracker] Найден сезон в активном элементе: ${dataSeason}`);
                return dataSeason;
            }

            const textSeason = extractNumberFromText(element.textContent, [
                /(?:сезон|season)\s*(\d+)/i,
                /(\d+)/
            ]);
            if (textSeason) {
                console.log(`[AniTracker] Найден сезон в тексте активного элемента: ${textSeason}`);
                return textSeason;
            }
        }
    }
    return null;
}

// Стратегия: Из элементов плеера
function extractSeasonFromPlayer() {
    const playerSelectors = [
        '[data-season]',
        '.season-number',
        '.video-season',
        '.player-season',
        '.current-season',
        '.season-info'
    ];

    for (const selector of playerSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
            const dataSeason = element.getAttribute('data-season');
            if (dataSeason) {
                console.log(`[AniTracker] Найден сезон в плеере: ${dataSeason}`);
                return dataSeason;
            }

            const text = element.textContent || '';
            const seasonMatch = text.match(/(?:сезон|season)\s*[:\-]?\s*(\d+)/i);
            if (seasonMatch) {
                console.log(`[AniTracker] Найден сезон в тексте плеера: ${seasonMatch[1]}`);
                return seasonMatch[1];
            }
        }
    }
    return null;
}

// УМНЫЙ фолбэк для определения сезона
function extractSeasonSmartFallback(rawTitle, episode) {
    console.log('[AniTracker] Используем умный фолбэк для определения сезона');
    
    const title = rawTitle.toLowerCase();
    const episodeNum = parseInt(episode);
    
    // Анализируем название на наличие признаков конкретных сезонов
    if (title.includes('первый') || title.includes('первая') || title.includes('first') || title.includes('1')) {
        return '1';
    }
    if (title.includes('второй') || title.includes('вторая') || title.includes('second') || title.includes('2')) {
        return '2';
    }
    if (title.includes('третий') || title.includes('третья') || title.includes('third') || title.includes('3')) {
        return '3';
    }
    if (title.includes('четвертый') || title.includes('четвертая') || title.includes('fourth') || title.includes('4')) {
        return '4';
    }
    if (title.includes('пятый') || title.includes('пятая') || title.includes('fifth') || title.includes('5')) {
        return '5';
    }
    
    // Анализируем номер эпизода
    if (!isNaN(episodeNum)) {
        if (episodeNum <= 12) return '1';        // Короткие сезоны
        if (episodeNum <= 24) return '1';        // Стандартные сезоны
        if (episodeNum <= 50) return '1';        // Длинные сезоны
        if (episodeNum <= 75) return '2';        // Второй сезон
        if (episodeNum <= 100) return '3';       // Третий сезон
        if (episodeNum <= 125) return '4';       // Четвертый сезон
        if (episodeNum <= 150) return '5';       // Пятый сезон
        return '1'; // По умолчанию
    }
    
    return '1'; // Финальный фолбэк
}

// Остальные функции остаются без изменений...
function extractTitle() {
    const titleSelectors = [
        'h1', '.anime-title', '.video-title', '.player-title',
        '[class*="title"]', '[class*="name"]', '.all_anime_title',
        '.aat_ep', '[class*="anime-name"]', 'title'
    ];

    for (const selector of titleSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
            const text = cleanText(element.textContent);
            const title = extractCleanTitle(text);
            if (title && title.length > 2 && !isNavigationText(title)) {
                return title;
            }
        }
    }

    const metaTitle = document.querySelector('meta[property="og:title"]');
    if (metaTitle) {
        const title = extractCleanTitle(metaTitle.getAttribute('content'));
        if (title && !isNavigationText(title)) return title;
    }

    return 'Неизвестное аниме';
}

function extractCleanTitle(text) {
    if (!text) return null;
    
    let clean = text
        .replace(/(смотреть|онлайн|hd|1080p|720p|аниме|сериал|anime|serial|скачать|download).*$/gi, '')
        .replace(/[—•·|•·\s]{2,}/g, ' ')
        .replace(/^\s+|\s+$/g, '')
        .trim();

    const cleanupPatterns = [
        /эп\.[^.]*\.[a-z]+.*$/i,
        /ep\.[^.]*\.[a-z]+.*$/i,
        /только что.*$/i,
        /\d+\s*(мин|минут|minutes?)\s*назад.*$/i,
        /\d+\s*(ч|час|часов|hours?)\s*назад.*$/i
    ];
    
    cleanupPatterns.forEach(pattern => {
        clean = clean.replace(pattern, '');
    });

    const badTitles = ['anime', 'аниме', 'главная', 'home', 'каталог', 'catalog', ''];
    if (badTitles.includes(clean.toLowerCase()) || clean.length < 3) return null;
    
    return clean;
}

function isNavigationText(text) {
    const navigationKeywords = [
        'навигация', 'navigation', 'меню', 'menu', 
        'каталог', 'catalog', 'поиск', 'search',
        'войти', 'login', 'регистрация', 'register'
    ];
    const lowerText = text.toLowerCase();
    return navigationKeywords.some(keyword => lowerText.includes(keyword));
}

function extractEpisode() {
    const strategies = [
        extractFromPlayerControls,
        extractFromActiveEpisode,
        extractFromUrl,
        extractFromPageTitle,
        extractFromBreadcrumbs,
        extractFromVideoSource
    ];

    for (const strategy of strategies) {
        const episode = strategy();
        if (episode) {
            console.log(`[AniTracker] Эпизод найден стратегией ${strategy.name}:`, episode);
            return episode;
        }
    }

    console.log('[AniTracker] Эпизод не найден, используем по умолчанию: 1');
    return '1';
}

function extractFromPlayerControls() {
    const playerSelectors = [
        '[data-episode]',
        '.current-episode',
        '.episode-number',
        '.video-episode',
        '.player-episode',
        '.video-player',
        '.player',
        '.plyr',
        '.jwplayer',
        '.video-js',
        '.video-info',
        '.player-info',
        '.episode-info'
    ];

    for (const selector of playerSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
            const dataEpisode = element.getAttribute('data-episode');
            if (dataEpisode) return dataEpisode;

            const text = element.textContent || '';
            const episodeMatch = text.match(/(?:эпизод|серия|episode|ep)\s*[:\-]?\s*(\d+)/i);
            if (episodeMatch) return episodeMatch[1];

            if (text.length < 50) {
                const numberMatch = text.match(/\b(\d{1,3})\b/);
                if (numberMatch) return numberMatch[1];
            }
        }
    }
    return null;
}

function extractFromActiveEpisode() {
    const activeSelectors = [
        '.episode-item.active',
        '.series-item.active', 
        '.episode.active',
        '.active [data-episode]',
        '.current-episode',
        '.episode-current',
        '[class*="active"][class*="episode"]',
        '[class*="active"][class*="series"]',
        '.btn-series.active',
        '.b-seria__link.active'
    ];

    for (const selector of activeSelectors) {
        const element = document.querySelector(selector);
        if (element) {
            const dataEpisode = element.getAttribute('data-episode');
            if (dataEpisode) return dataEpisode;

            const textEpisode = extractNumberFromText(element.textContent, [
                /(?:эпизод|серия|episode)\s*(\d+)/i,
                /#?(\d+)/,
                /\b(\d{1,3})\b/
            ]);
            if (textEpisode) return textEpisode;
        }
    }
    return null;
}

function extractFromUrl() {
    const url = window.location.href;
    
    const patterns = [
        /animego\.me\/.*\/(\d+)(?:\?|$|#)/,
        /[?&]episode=(\d+)/,
        /[?&]ep=(\d+)/,
        /episode-(\d+)/,
        /series-(\d+)/,
        /episode(\d+)/,
        /episode-(\d+)/i,
        /ep-(\d+)/i,
        /seria-(\d+)/i,
        /\/(\d+)(?:\?|$|#)/,
        /[?&]episode=(\d+)/i,
        /[?&]ep=(\d+)/i,
        /[?&]e=(\d+)/i
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    return null;
}

function extractFromPageTitle() {
    const title = document.title;
    const patterns = [
        /(?:эпизод|серия|episode|ep)\s*[:\-]?\s*(\d+)/i,
        /\b(?:серия|эпизод)\s*(\d+)/i,
        /\bep?\s*(\d+)\b/i,
        /#(\d+)\s*[-—]/
    ];

    for (const pattern of patterns) {
        const match = title.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    return null;
}

function extractFromBreadcrumbs() {
    const breadcrumbSelectors = [
        '.breadcrumbs',
        '.breadcrumb',
        '[class*="breadcrumb"]',
        '.path',
        '.navigation'
    ];

    for (const selector of breadcrumbSelectors) {
        const element = document.querySelector(selector);
        if (element) {
            const text = element.textContent;
            const episodeMatch = text.match(/(?:эпизод|серия|episode)\s*(\d+)/i);
            if (episodeMatch) return episodeMatch[1];
        }
    }
    return null;
}

function extractFromVideoSource() {
    const videos = document.querySelectorAll('video');
    for (const video of videos) {
        const src = video.src || video.currentSrc;
        if (src) {
            const episodeMatch = src.match(/(\d+)\.(mp4|m3u8|webm|mkv)/i);
            if (episodeMatch) return episodeMatch[1];
        }
    }

    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
        try {
            const src = iframe.src;
            if (src) {
                const episodeMatch = src.match(/(\d+)/);
                if (episodeMatch) return episodeMatch[1];
            }
        } catch (e) {
            // Игнорируем ошибки доступа к iframe
        }
    }
    return null;
}

function extractCover() {
    const strategies = [
        extractCoverFromMeta,
        extractCoverFromImages,
        extractCoverFromBackground,
        extractCoverFromPoster,
        extractCoverFromAnimeElements
    ];

    for (const strategy of strategies) {
        const cover = strategy();
        if (cover) {
            console.log(`[AniTracker] Обложка найдена стратегией ${strategy.name}:`, cover);
            return cover;
        }
    }

    return null;
}

function extractCoverFromMeta() {
    const metaSelectors = [
        'meta[property="og:image"]',
        'meta[name="twitter:image"]',
        'meta[property="twitter:image"]',
        'link[rel="image_src"]'
    ];

    for (const selector of metaSelectors) {
        const element = document.querySelector(selector);
        if (element) {
            const url = element.getAttribute('content') || element.getAttribute('href');
            if (url && isValidImageUrl(url)) return makeAbsoluteUrl(url);
        }
    }
    return null;
}

function extractCoverFromImages() {
    const imageSelectors = [
        '.anime-poster img',
        '.poster img',
        '.cover img',
        '.anime-cover img',
        '.video-cover img',
        '.all_anime_title img',
        '.aat_ep img',
        '[class*="poster"] img',
        '[class*="cover"] img',
        '.thumbnail img',
        '.anime-thumbnail img'
    ];

    for (const selector of imageSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
            const url = getImageUrlFromElement(element);
            if (url) return url;
        }
    }
    return null;
}

function extractCoverFromBackground() {
    const backgroundSelectors = [
        '.anime-poster',
        '.poster',
        '.cover',
        '.anime-cover',
        '.all_anime_title',
        '.aat_ep',
        '[class*="poster"]',
        '[class*="cover"]',
        '.thumbnail',
        '.anime-thumbnail'
    ];

    for (const selector of backgroundSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
            const url = extractBackgroundImageUrl(element);
            if (url) return url;
        }
    }
    return null;
}

function extractCoverFromPoster() {
    const video = document.querySelector('video');
    if (video && video.poster) {
        return makeAbsoluteUrl(video.poster);
    }
    return null;
}

function extractCoverFromAnimeElements() {
    const animeElements = document.querySelectorAll('[class*="anime"], [class*="title"]');
    for (const element of animeElements) {
        const bgUrl = extractBackgroundImageUrl(element);
        if (bgUrl) return bgUrl;

        const img = element.querySelector('img');
        if (img) {
            const url = getImageUrlFromElement(img);
            if (url) return url;
        }
    }
    return null;
}

function extractBackgroundImageUrl(element) {
    const style = window.getComputedStyle(element);
    const backgroundImage = style.backgroundImage;
    if (backgroundImage && backgroundImage !== 'none') {
        const urlMatch = backgroundImage.match(/url\(['"]?(.*?)['"]?\)/);
        if (urlMatch && urlMatch[1]) {
            return makeAbsoluteUrl(urlMatch[1]);
        }
    }
    return null;
}

function getImageUrlFromElement(element) {
    const src = element.src || element.getAttribute('data-src') || 
                element.getAttribute('data-original') || element.getAttribute('data-lazy-src');
    if (src && isValidImageUrl(src)) {
        return makeAbsoluteUrl(src);
    }
    return null;
}

function makeAbsoluteUrl(url) {
    if (url.startsWith('//')) {
        return 'https:' + url;
    }
    if (url.startsWith('/')) {
        return window.location.origin + url;
    }
    if (!url.startsWith('http')) {
        return window.location.origin + '/' + url;
    }
    return url;
}

function isValidImageUrl(url) {
    return /\.(jpg|jpeg|png|webp|gif|bmp)(?:\?.*)?$/i.test(url) && 
           !url.includes('icon') && 
           !url.includes('logo') &&
           !url.includes('avatar');
}

function extractNumberFromText(text, patterns) {
    if (!text) return null;
    
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    return null;
}

function cleanText(text) {
    return (text || '').replace(/\s+/g, ' ').trim();
}

function report() {
    const data = extractAnimeData();
    
    // Проверка: если сезон все еще равен эпизоду, выводим предупреждение
    if (data.season === data.episode && data.episode !== '1') {
        console.warn('[AniTracker] ВНИМАНИЕ: Сезон все еще равен эпизоду после всех коррекций!', data);
    }
    
    if (!data.title || data.title === 'Неизвестное аниме' || isNavigationText(data.title)) {
        if (retryCount < MAX_RETRIES) {
            retryCount++;
            setTimeout(report, 1000 * retryCount);
        }
        return;
    }

    const key = `${data.title}|${data.episode}|${data.season}|${window.location.href}`;
    if (key !== lastReportedKey) {
        lastReportedKey = key;
        console.log('[AniTracker] Отправляем данные:', data);
        chrome.runtime.sendMessage({ 
            type: 'dom_detected', 
            data 
        });
    }
}

// Мониторинг изменений (без изменений)
function initialize() {
    console.log('[AniTracker] Инициализация на:', window.location.hostname);
    
    setTimeout(() => {
        report();
    }, 2000);

    const observer = new MutationObserver((mutations) => {
        let shouldReport = false;
        
        for (const mutation of mutations) {
            if (mutation.type === 'attributes') {
                const target = mutation.target;
                const attrName = mutation.attributeName;
                
                if (attrName === 'class' || attrName === 'src' || 
                    attrName === 'data-episode' || attrName === 'data-season' ||
                    target.classList.contains('active') ||
                    target.hasAttribute('data-episode')) {
                    shouldReport = true;
                    break;
                }
            }
            
            if (mutation.addedNodes.length > 0) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === 1) {
                        const element = node;
                        if (element.classList && (
                            element.classList.contains('episode') ||
                            element.classList.contains('series') ||
                            element.classList.contains('video') ||
                            element.classList.contains('player') ||
                            element.hasAttribute('data-episode')
                        )) {
                            shouldReport = true;
                            break;
                        }
                    }
                }
            }
        }
        
        if (shouldReport) {
            setTimeout(report, 1000);
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'data-episode', 'data-season', 'src', 'style']
    });

    document.addEventListener('click', (e) => {
        const target = e.target;
        if (target.closest('.episode, .series, [data-episode], .video-player, .player, .btn-series')) {
            setTimeout(report, 1500);
        }
    });

    let lastPath = window.location.pathname + window.location.search;
    setInterval(() => {
        const currentPath = window.location.pathname + window.location.search;
        if (currentPath !== lastPath) {
            lastPath = currentPath;
            lastReportedKey = null;
            retryCount = 0;
            setTimeout(report, 2000);
        }
    }, 500);

    window.addEventListener('load', () => {
        setTimeout(report, 3000);
    });

    setInterval(() => {
        if (retryCount < 3) {
            report();
        }
    }, 10000);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}