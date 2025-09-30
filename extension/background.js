// background.js
chrome.runtime.onInstalled.addListener(() => {
  console.log('AniTracker установлен');
  
  // Инициализация хранилища если нужно
  chrome.storage.local.get(['watchHistory', 'trackingList', 'settings'], (result) => {
    if (!result.watchHistory) {
      chrome.storage.local.set({ watchHistory: [] });
    }
    if (!result.trackingList) {
      chrome.storage.local.set({ trackingList: [] });
    }
    if (!result.settings) {
      chrome.storage.local.set({ 
        settings: {
          autoUpdateProgress: true,
          showNotifications: true,
          maxHistoryItems: 1000
        }
      });
    }
  });
});

// Функция для обновления прогресса в списке отслеживания
function updateTrackingProgress(data) {
  chrome.storage.local.get(['trackingList', 'settings'], (result) => {
    const trackingList = result.trackingList || [];
    const settings = result.settings || {};
    
    // Проверяем, включено ли автообновление в настройках
    if (!settings.autoUpdateProgress) {
      return;
    }
    
    let updated = false;
    const currentEpisode = parseInt(data.episode);
    
    if (isNaN(currentEpisode)) {
      console.log('[AniTracker] Не удалось распознать номер эпизода:', data.episode);
      return;
    }
    
    console.log(`[AniTracker] Проверка обновления прогресса для: "${data.title}", эпизод ${currentEpisode}`);
    
    trackingList.forEach(item => {
      // Улучшенное сравнение названий с учетом нормализации
      if (isMatchingAnime(item, data)) {
        const trackedEpisode = parseInt(item.currentEpisode) || 0;
        
        console.log(`[AniTracker] Найдено совпадение: "${item.rawTitle || item.title}", текущий эпизод: ${trackedEpisode}, новый: ${currentEpisode}`);
        
        // Обновляем только если новый эпизод больше текущего
        if (currentEpisode > trackedEpisode) {
          console.log(`[AniTracker] Авто-обновление: "${item.rawTitle || item.title}" с ${trackedEpisode} на ${currentEpisode}`);
          item.currentEpisode = currentEpisode.toString();
          item.lastUpdated = Date.now();
          updated = true;
          
          // Если достигли общего количества эпизодов, отмечаем как завершенное
          if (item.totalEpisodes !== '?' && currentEpisode >= parseInt(item.totalEpisodes)) {
            item.status = 'completed';
            console.log(`[AniTracker] Аниме "${item.rawTitle || item.title}" отмечено как завершенное`);
          }
        } else if (currentEpisode === trackedEpisode) {
          console.log(`[AniTracker] Эпизод ${currentEpisode} уже актуален для "${item.rawTitle || item.title}"`);
        } else {
          console.log(`[AniTracker] Новый эпизод ${currentEpisode} меньше текущего ${trackedEpisode} для "${item.rawTitle || item.title}"`);
        }
      }
    });
    
    if (updated) {
      chrome.storage.local.set({ trackingList }, () => {
        console.log('[AniTracker] Список отслеживания обновлен');
        
        // Показываем уведомление только для значительных обновлений
        const updatedItems = trackingList.filter(item => 
          isMatchingAnime(item, data) && parseInt(item.currentEpisode) === currentEpisode
        );
        
        if (updatedItems.length > 0 && settings.showNotifications) {
          sendProgressNotification(updatedItems[0], currentEpisode);
        }
      });
    }
  });
}

// Вспомогательная функция для сравнения аниме
function isMatchingAnime(trackingItem, currentData) {
  // Прямое сравнение нормализованных названий и сезонов
  if (trackingItem.title === currentData.title && trackingItem.season === currentData.season) {
    return true;
  }
  
  // Дополнительная проверка по rawTitle (оригинальному названию)
  if (trackingItem.rawTitle && currentData.rawTitle) {
    const normalizedTracking = normalizeTitleForMatching(trackingItem.rawTitle);
    const normalizedCurrent = normalizeTitleForMatching(currentData.rawTitle);
    
    if (normalizedTracking === normalizedCurrent && trackingItem.season === currentData.season) {
      return true;
    }
  }
  
  // Резервная проверка: сравнение только по нормализованным названиям (без сезона)
  const normalizedTrackingTitle = normalizeTitleForMatching(trackingItem.title);
  const normalizedCurrentTitle = normalizeTitleForMatching(currentData.title);
  
  if (normalizedTrackingTitle === normalizedCurrentTitle) {
    console.log(`[AniTracker] Совпадение по названию (без сезона): "${trackingItem.title}" и "${currentData.title}"`);
    return true;
  }
  
  return false;
}

// Функция для нормализации названий при сравнении
function normalizeTitleForMatching(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\sа-яё]/gi, '') // Удаляем специальные символы
    .replace(/\s+/g, ' ')
    .trim();
}

// Функция для отправки уведомлений
function sendProgressNotification(item, newEpisode) {
  try {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Прогресс обновлен 📈',
      message: `${item.rawTitle || item.title}: эпизод ${newEpisode}`,
      priority: 1
    });
    
    console.log(`[AniTracker] Уведомление отправлено: ${item.rawTitle || item.title} - эпизод ${newEpisode}`);
  } catch (error) {
    console.log('[AniTracker] Ошибка при отправке уведомления:', error);
  }
}

// Основной обработчик сообщений
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[AniTracker] Получено сообщение:', message.type);
  
  if (message.type === 'dom_detected') {
    const data = {
      ...message.data,
      timestamp: Date.now(),
      url: sender.tab?.url || 'unknown',
      tabId: sender.tab?.id
    };
    
    console.log('[AniTracker] Получены данные аниме:', data);
    
    // Сохраняем текущее аниме
    chrome.storage.local.set({ currentAnime: data });
    
    // Добавляем в историю просмотров
    chrome.storage.local.get(['watchHistory'], (result) => {
      const history = result.watchHistory || [];
      
      // Создаем уникальный ID для записи истории
      const historyItem = {
        ...data,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
      };
      
      // Добавляем в начало массива (новые записи сначала)
      history.unshift(historyItem);
      
      // Ограничиваем историю
      if (history.length > 1000) {
        history.length = 1000;
      }
      
      chrome.storage.local.set({ watchHistory: history }, () => {
        console.log('[AniTracker] Данные сохранены в историю, всего записей:', history.length);
      });
    });
    
    // ОБНОВЛЕННЫЙ КОД: Обновляем прогресс в списке отслеживания
    updateTrackingProgress(data);
    
    sendResponse({ status: 'success', message: 'Данные обработаны' });
  }
  
  // Обработка сообщений от popup
  if (message.type === 'get_data') {
    chrome.storage.local.get(['currentAnime', 'watchHistory', 'trackingList'], (result) => {
      sendResponse(result);
    });
    return true; // Сообщаем, что ответ будет асинхронным
  }
  
  if (message.type === 'clear_history') {
    chrome.storage.local.set({ watchHistory: [] }, () => {
      sendResponse({ status: 'success' });
    });
    return true;
  }
  
  if (message.type === 'clear_tracking') {
    chrome.storage.local.set({ trackingList: [] }, () => {
      sendResponse({ status: 'success' });
    });
    return true;
  }
  
  if (message.type === 'update_settings') {
    chrome.storage.local.set({ settings: message.settings }, () => {
      sendResponse({ status: 'success' });
    });
    return true;
  }
  
  return true; // Сообщаем, что ответ будет асинхронным
});

// Обработчик обновления вкладок (для отслеживания навигации)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Если страница полностью загрузилась
  if (changeInfo.status === 'complete' && tab.url) {
    // Проверяем, является ли URL страницей просмотра аниме
    const isAnimeSite = isAnimeStreamingSite(tab.url);
    
    if (isAnimeSite) {
      console.log('[AniTracker] Обнаружена страница аниме:', tab.url);
      
      // Ждем немного чтобы страница успела инициализироваться
      setTimeout(() => {
        // Запускаем content script для сбора данных
        chrome.tabs.sendMessage(tabId, { type: 'page_loaded' }, (response) => {
          if (chrome.runtime.lastError) {
            // Content script может быть не загружен, игнорируем ошибку
            console.log('[AniTracker] Content script не отвечает, возможно страница не поддерживается');
          }
        });
      }, 2000);
    }
  }
});

// Функция для определения аниме-сайтов
function isAnimeStreamingSite(url) {
  const animeDomains = [
    'animego.org', 'animego.me', 'jut.su', 'anilibria.tv', 
    'shikimori.one', 'shikimori.ani', 'aniwatch.tv', 'anime365.org',
    'smotret-anime.online', 'yummyanime.club', 'animevost.org'
  ];
  
  try {
    const domain = new URL(url).hostname.toLowerCase();
    return animeDomains.some(animeDomain => domain.includes(animeDomain));
  } catch {
    return false;
  }
}

// Периодическая очистка истории (раз в день)
chrome.alarms.create('cleanupHistory', { periodInMinutes: 1440 }); // 24 часа

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cleanupHistory') {
    cleanupOldHistory();
  }
});

// Очистка старых записей истории
function cleanupOldHistory() {
  chrome.storage.local.get(['watchHistory', 'settings'], (result) => {
    const history = result.watchHistory || [];
    const settings = result.settings || {};
    const maxItems = settings.maxHistoryItems || 1000;
    
    if (history.length > maxItems) {
      const cleanedHistory = history.slice(0, maxItems);
      chrome.storage.local.set({ watchHistory: cleanedHistory }, () => {
        console.log(`[AniTracker] История очищена, оставлено ${cleanedHistory.length} записей`);
      });
    }
  });
}

// Обработчик установки расширения
chrome.runtime.onStartup.addListener(() => {
  console.log('[AniTracker] Расширение запущено');
});