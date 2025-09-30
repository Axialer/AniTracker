// popup.js - полный код с нормализацией названий и вкладкой отслеживания
let currentTab = 'current';

function formatTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) return 'только что';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} мин назад`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч назад`;

    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
        return `сегодня в ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
        return `вчера в ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
    } else {
        return date.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

function updateCurrentTab(data) {
    const container = document.getElementById('animeInfo');

    if (!data || (Date.now() - data.timestamp) > 600000) {
        container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📺</div>
        <div class="empty-title">Аниме не найдено</div>
        <div class="empty-description">
          Перейдите на страницу просмотра аниме на поддерживаемом сайте
        </div>
        <div style="margin-top: 12px; font-size: 11px; color: var(--text-secondary);">
          Поддерживаемые сайты: animego.me, jut.su, anilibria.tv и другие
        </div>
      </div>
    `;
        return;
    }

    const timeAgo = formatTime(data.timestamp);
    const domain = getDomain(data.url);

    // Используем rawTitle если есть, иначе обычный title
    const displayTitle = data.rawTitle || data.title;

    const coverHtml = data.cover ?
        `<div class="cover-container">
      <img class="anime-cover" src="${data.cover}" alt="Обложка ${escapeHtml(displayTitle)}" 
          loading="lazy"
          onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
      <div class="anime-cover empty" style="display: none;">
        <div class="cover-placeholder">🎬</div>
      </div>
    </div>` :
        `<div class="anime-cover empty">
      <div class="cover-placeholder">🎬</div>
    </div>`;

    container.innerHTML = `
    <div class="anime-card">
      <div class="anime-header">
        ${coverHtml}
        <div class="anime-info">
          <div class="anime-title" title="${escapeHtml(displayTitle)}">${escapeHtml(displayTitle)}</div>
          
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Сезон</div>
              <div class="info-value">${data.season}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Эпизод</div>
              <div class="episode-badge">${data.episode}</div>
            </div>
          </div>
          
          <div class="additional-info">
            <div class="info-row">
              <span class="info-label">Сайт:</span>
              <span class="info-value">${domain}</span>
            </div>
          </div>
          
          <div class="status">
            <div class="status-dot"></div>
            <span class="status-text">Обновлено: ${timeAgo}</span>
          </div>
        </div>
      </div>
      
      <div class="action-buttons">
        <button class="btn btn-secondary" id="openSite">
          <span class="btn-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
</svg></span>
          <span class="btn-text">Открыть сайт</span>
        </button>
        <button class="btn btn-primary" id="addToTracking">
          <span class="btn-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <line x1="12" y1="5" x2="12" y2="19"/>
  <line x1="5" y1="12" x2="19" y2="12"/>
</svg></span>
          <span class="btn-text">В список</span>
        </button>
      </div>
      
      <div class="quick-actions">
        <button class="quick-btn" id="refreshData" title="Обновить данные">
          <span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M23 4v6h-6"/>
  <path d="M1 20v-6h6"/>
  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
</svg></span>
        </button>
        <button class="quick-btn" id="copyInfo" title="Скопировать информацию">
          <span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
</svg></span>
        </button>
      </div>
    </div>
  `;

    // Обработчики для текущего аниме
    document.getElementById('openSite').addEventListener('click', () => {
        chrome.tabs.create({ url: data.url });
    });

    document.getElementById('addToTracking').addEventListener('click', () => {
        addToTrackingList(data);
    });

    document.getElementById('refreshData').addEventListener('click', () => {
        refreshCurrentTab();
    });

    document.getElementById('copyInfo').addEventListener('click', () => {
        copyAnimeInfo(data);
    });
}

function updateHistoryTab() {
    chrome.storage.local.get(['watchHistory'], (result) => {
        const history = result.watchHistory || [];
        const container = document.getElementById('historyList');

        if (history.length === 0) {
            container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📚</div>
          <div class="empty-title">История пуста</div>
          <div class="empty-description">
            История ваших просмотров будет отображаться здесь<br>
            Начните смотреть аниме на поддерживаемых сайтах
          </div>
        </div>
      `;
            return;
        }

        // Группируем по названиям для статистики
        const stats = calculateHistoryStats(history);

        container.innerHTML = `
      <div class="history-stats">
        <div class="stat-item">
          <div class="stat-number">${stats.totalWatched}</div>
          <div class="stat-label">Всего просмотров</div>
        </div>
        <div class="stat-item">
          <div class="stat-number">${stats.uniqueTitles}</div>
          <div class="stat-label">Уникальных тайтлов</div>
        </div>
        <div class="stat-item">
          <div class="stat-number">${stats.totalEpisodes}</div>
          <div class="stat-label">Эпизодов</div>
        </div>
      </div>
      <div class="history-items" id="historyItems">
        ${history.slice(0, 50).map(item => createHistoryItem(item)).join('')}
      </div>
    `;

        // Добавляем обработчики для элементов истории
        addHistoryEventListeners(history);
    });
}

function createHistoryItem(item) {
    const timeAgo = formatTime(item.timestamp);
    const domain = getDomain(item.url);

    // Используем rawTitle для отображения, если есть
    const displayTitle = item.rawTitle || item.title;

    const coverHtml = item.cover ?
        `<div class="cover-container">
      <img class="history-cover" src="${item.cover}" alt="Обложка ${escapeHtml(displayTitle)}" 
          loading="lazy"
          onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
      <div class="history-cover empty" style="display: none;">
        <div class="cover-placeholder">🎬</div>
      </div>
    </div>` :
        `<div class="history-cover empty">
      <div class="cover-placeholder">🎬</div>
    </div>`;

    return `
    <div class="history-item" data-id="${item.id}">
      ${coverHtml}
      <div class="history-content-inner">
        <div class="history-details">
          <div class="history-title" title="${escapeHtml(displayTitle)}">${escapeHtml(displayTitle)}</div>
          <div class="history-meta">
            <span class="history-episode">S${item.season} E${item.episode}</span>
            <span class="history-domain">${domain}</span>
          </div>
          <div class="history-time">${timeAgo}</div>
        </div>
        <div class="history-actions">
          <button class="btn-small open" data-url="${item.url}" title="Открыть на сайте">
            <span class="btn-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
</svg></span>
          </button>
          <button class="btn-small delete" data-id="${item.id}" title="Удалить из истории">
            <span class="btn-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="3 6 5 6 21 6"/>
  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
</svg></span>
          </button>
        </div>
      </div>
    </div>
  `;
}

function addHistoryEventListeners(history) {
    const container = document.getElementById('historyItems');

    // Обработчики для кнопки "Открыть"
    container.querySelectorAll('.btn-small.open').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const url = btn.getAttribute('data-url');
            chrome.tabs.create({ url });
        });
    });

    // Обработчики для кнопки "Удалить"
    container.querySelectorAll('.btn-small.delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.getAttribute('data-id');
            removeFromHistory(id);
        });
    });

    // Клик на элементе истории (открывает сайт)
    container.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', (e) => {
            // Открываем только если кликнули не на кнопку
            if (!e.target.closest('.btn-small')) {
                const id = item.getAttribute('data-id');
                const historyItem = history.find(h => h.id === id);
                if (historyItem) {
                    chrome.tabs.create({ url: historyItem.url });
                }
            }
        });
    });
}

function updateTrackingTab() {
    chrome.storage.local.get(['trackingList'], (result) => {
        const trackingList = result.trackingList || [];
        const container = document.getElementById('trackingList');

        if (trackingList.length === 0) {
            container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
</svg></div>
          <div class="empty-title">Список отслеживания пуст</div>
          <div class="empty-description">
            Добавьте аниме для отслеживания прогресса просмотра<br>
            Используйте кнопку "Добавить текущее" или "В список" в текущем аниме
          </div>
        </div>
      `;
            return;
        }

        container.innerHTML = trackingList.map(item => createTrackingItem(item)).join('');

        addTrackingEventListeners(trackingList);
    });
}

function createTrackingItem(item) {
    const progress = calculateProgress(item);
    const addedTime = formatTime(item.addedAt);
    const isCompleted = item.status === 'completed';

    const displayTitle = item.rawTitle || item.title;

    const coverHtml = item.cover ?
        `<div class="cover-container">
      <img class="tracking-cover" src="${item.cover}" alt="Обложка ${escapeHtml(displayTitle)}" 
          loading="lazy"
          onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
      <div class="tracking-cover empty" style="display: none;">
        <div class="cover-placeholder">🎬</div>
      </div>
    </div>` :
        `<div class="tracking-cover empty">
      <div class="cover-placeholder">🎬</div>
    </div>`;

    return `
    <div class="tracking-item ${isCompleted ? 'completed' : ''}" data-id="${item.id}">
      ${isCompleted ? '<div class="completed-badge">✔️ Завершено</div>' : ''}
      ${coverHtml}
      <div class="tracking-info">
        <div class="tracking-title" title="${escapeHtml(displayTitle)}">${escapeHtml(displayTitle)}</div>
        
        <div class="tracking-progress">
          <div class="progress-info">
            <span>Прогресс:</span>
            <span>${item.currentEpisode} / ${item.totalEpisodes}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progress}%"></div>
          </div>
        </div>
        
        <div class="tracking-meta">
          <span>Сезон ${item.season}</span>
          <span>Добавлено: ${addedTime}</span>
        </div>
        
        <div class="tracking-actions">
          <button class="btn-small primary" data-id="${item.id}" data-action="increment" title="Увеличить эпизод" ${isCompleted ? 'disabled' : ''}>
            <span class="btn-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <line x1="12" y1="5" x2="12" y2="19"/>
  <line x1="5" y1="12" x2="19" y2="12"/>
</svg></span>
          </button>
          <button class="btn-small warning" data-id="${item.id}" data-action="decrement" title="Уменьшить эпизод" ${isCompleted ? 'disabled' : ''}>
            <span class="btn-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <line x1="5" y1="12" x2="19" y2="12"/>
</svg></span>
          </button>
          <button class="btn-small" data-id="${item.id}" data-action="edit" title="Редактировать">
            <span class="btn-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
</svg></span>
          </button>
          <button class="btn-small delete" data-id="${item.id}" data-action="delete" title="Удалить из отслеживания">
            <span class="btn-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="3 6 5 6 21 6"/>
  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
</svg></span>
          </button>
        </div>
      </div>
    </div>
  `;
}

function calculateProgress(item) {
    const current = parseInt(item.currentEpisode) || 0;
    const total = parseInt(item.totalEpisodes) || 1;
    if (total === 0 || total === '?') return 0;
    return Math.min(100, Math.round((current / total) * 100));
}

function addTrackingEventListeners(trackingList) {
    const container = document.getElementById('trackingList');

    container.querySelectorAll('.btn-small').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.getAttribute('data-id');
            const action = btn.getAttribute('data-action');

            switch (action) {
                case 'increment':
                    incrementEpisode(id);
                    break;
                case 'decrement':
                    decrementEpisode(id);
                    break;
                case 'edit':
                    editTrackingItem(id);
                    break;
                case 'delete':
                    removeFromTracking(id);
                    break;
            }
        });
    });

    container.querySelectorAll('.tracking-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (!e.target.closest('.btn-small')) {
                const id = item.getAttribute('data-id');
                const trackingItem = trackingList.find(t => t.id === id);
                if (trackingItem) {
                    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(trackingItem.title + ' аниме')}`;
                    chrome.tabs.create({ url: searchUrl });
                }
            }
        });
    });
}

function incrementEpisode(id) {
    chrome.storage.local.get(['trackingList'], (result) => {
        const trackingList = result.trackingList || [];
        const itemIndex = trackingList.findIndex(item => item.id === id);
        if (itemIndex !== -1) {
            const currentEpisode = parseInt(trackingList[itemIndex].currentEpisode) || 0;
            trackingList[itemIndex].currentEpisode = (currentEpisode + 1).toString();
            chrome.storage.local.set({ trackingList }, () => {
                updateTrackingTab();
                showNotification('Эпизод увеличен');
            });
        }
    });
}

function decrementEpisode(id) {
    chrome.storage.local.get(['trackingList'], (result) => {
        const trackingList = result.trackingList || [];
        const itemIndex = trackingList.findIndex(item => item.id === id);
        if (itemIndex !== -1) {
            const currentEpisode = parseInt(trackingList[itemIndex].currentEpisode) || 0;
            if (currentEpisode > 0) {
                trackingList[itemIndex].currentEpisode = (currentEpisode - 1).toString();
                chrome.storage.local.set({ trackingList }, () => {
                    updateTrackingTab();
                    showNotification('Эпизод уменьшен');
                });
            }
        }
    });
}

function editTrackingItem(id) {
    chrome.storage.local.get(['trackingList'], (result) => {
        const trackingList = result.trackingList || [];
        const itemIndex = trackingList.findIndex(item => item.id === id);
        if (itemIndex !== -1) {
            const item = trackingList[itemIndex];
            const newTotal = prompt(`Введите общее количество эпизодов для "${item.rawTitle || item.title}":`, item.totalEpisodes);
            if (newTotal !== null) {
                trackingList[itemIndex].totalEpisodes = newTotal;
                chrome.storage.local.set({ trackingList }, () => {
                    updateTrackingTab();
                    showNotification('Обновлено');
                });
            }
        }
    });
}

function removeFromTracking(id) {
    if (confirm('Удалить аниме из списка отслеживания?')) {
        chrome.storage.local.get(['trackingList'], (result) => {
            const trackingList = result.trackingList || [];
            const updatedList = trackingList.filter(item => item.id !== id);
            chrome.storage.local.set({ trackingList: updatedList }, () => {
                updateTrackingTab();
                showNotification('Удалено из отслеживания');
            });
        });
    }
}

function calculateHistoryStats(history) {
    const totalWatched = history.length;

    // Улучшенный подсчет уникальных тайтлов с дополнительной нормализацией
    const titleMap = new Map();

    history.forEach(item => {
        // Дополнительная нормализация для группировки
        const key = normalizeTitleForGrouping(item.title);
        if (!titleMap.has(key)) {
            titleMap.set(key, {
                count: 0,
                rawTitle: item.rawTitle || item.title // Сохраняем оригинальное название для отображения
            });
        }
        titleMap.get(key).count++;
    });

    const uniqueTitles = titleMap.size;
    const totalEpisodes = history.reduce((sum, item) => sum + 1, 0);

    return {
        totalWatched,
        uniqueTitles,
        totalEpisodes,
        titleMap // Можете использовать для отладки
    };
}

// Вспомогательная функция для нормализации при группировке
function normalizeTitleForGrouping(title) {
    if (!title) return '';

    return title
        .toLowerCase()
        .replace(/[^\w\sа-яё]/gi, '') // Удаляем специальные символы
        .replace(/\s+/g, ' ')
        .trim();
}

function removeFromHistory(id) {
    chrome.storage.local.get(['watchHistory'], (result) => {
        const history = result.watchHistory || [];
        const updatedHistory = history.filter(item => item.id !== id);
        chrome.storage.local.set({ watchHistory: updatedHistory }, () => {
            updateHistoryTab();
            showNotification('Запись удалена из истории');
        });
    });
}

function addToTrackingList(data) {
    chrome.storage.local.get(['trackingList'], (result) => {
        const trackingList = result.trackingList || [];

        // Используем нормализованное название для проверки дубликатов
        const existingIndex = trackingList.findIndex(item =>
            item.title === data.title && item.season === data.season
        );

        if (existingIndex === -1) {
            const trackItem = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                title: data.title, // Нормализованное название для группировки
                rawTitle: data.rawTitle || data.title, // Оригинальное название для отображения
                season: data.season,
                currentEpisode: data.episode,
                totalEpisodes: '?',
                cover: data.cover,
                addedAt: Date.now(),
                status: 'watching'
            };

            trackingList.unshift(trackItem);
            chrome.storage.local.set({ trackingList }, () => {
                showNotification(`"${data.rawTitle || data.title}" добавлено в список отслеживания`);
                // Переключаемся на вкладку отслеживания
                switchToTab('tracking');
            });
        } else {
            showNotification('Это аниме уже в списке отслеживания');
        }
    });
}

function refreshCurrentTab() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                files: ['content.js']
            }).then(() => {
                showNotification('Данные обновляются...');
                setTimeout(() => {
                    chrome.storage.local.get(['currentAnime'], (result) => {
                        updateCurrentTab(result.currentAnime);
                    });
                }, 2000);
            }).catch(() => {
                showNotification('Ошибка обновления данных');
            });
        }
    });
}

function copyAnimeInfo(data) {
    const displayTitle = data.rawTitle || data.title;
    const text = `Аниме: ${displayTitle}\nСезон: ${data.season}\nЭпизод: ${data.episode}\nСсылка: ${data.url}`;

    navigator.clipboard.writeText(text).then(() => {
        showNotification('Информация скопирована в буфер');
    }).catch(() => {
        // Fallback для браузеров без clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showNotification('Информация скопирована в буфер');
    });
}

function clearHistory() {
    if (confirm('Вы уверены, что хотите очистить всю историю просмотров? Это действие нельзя отменить.')) {
        chrome.storage.local.set({ watchHistory: [] }, () => {
            updateHistoryTab();
            showNotification('История очищена');
        });
    }
}

function clearTracking() {
    if (confirm('Вы уверены, что хотите очистить весь список отслеживания? Это действие нельзя отменить.')) {
        chrome.storage.local.set({ trackingList: [] }, () => {
            updateTrackingTab();
            showNotification('Список отслеживания очищен');
        });
    }
}

function switchToTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(tabName + 'Tab').classList.add('active');
    currentTab = tabName;

    if (tabName === 'history') {
        updateHistoryTab();
    } else if (tabName === 'tracking') {
        updateTrackingTab();
    }
}

function getDomain(url) {
    try {
        const domain = new URL(url).hostname.replace('www.', '');
        return domain.length > 20 ? domain.substring(0, 17) + '...' : domain;
    } catch {
        return 'unknown';
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showNotification(message) {
    // Создаем элемент уведомления
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    notification.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: var(--success);
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12px;
    z-index: 10000;
    max-width: 200px;
    word-wrap: break-word;
  `;

    document.body.appendChild(notification);

    // Автоматически скрываем через 3 секунды
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

// Инициализация popup
document.addEventListener('DOMContentLoaded', () => {
    // Загружаем текущие данные
    chrome.storage.local.get(['currentAnime'], (result) => {
        updateCurrentTab(result.currentAnime);
    });

    // Загружаем историю и отслеживание
    updateHistoryTab();
    updateTrackingTab();

    // Обработчики вкладок
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.getAttribute('data-tab');
            switchToTab(tabName);
        });
    });

    // Обработчики кнопок в истории
    document.getElementById('clearHistory').addEventListener('click', clearHistory);
    document.getElementById('refreshHistory').addEventListener('click', updateHistoryTab);

    // Обработчики кнопок в отслеживании
    document.getElementById('addCurrentToTracking').addEventListener('click', () => {
        chrome.storage.local.get(['currentAnime'], (result) => {
            if (result.currentAnime) {
                addToTrackingList(result.currentAnime);
            } else {
                showNotification('Нет текущего аниме для добавления');
            }
        });
    });
    document.getElementById('clearTracking').addEventListener('click', clearTracking);
});

// Слушаем обновления данных из background script
chrome.storage.onChanged.addListener((changes) => {
    if (changes.currentAnime && currentTab === 'current') {
        updateCurrentTab(changes.currentAnime.newValue);
    }
    if (changes.watchHistory && currentTab === 'history') {
        updateHistoryTab();
    }
    if (changes.trackingList && currentTab === 'tracking') {
        updateTrackingTab();
    }
});