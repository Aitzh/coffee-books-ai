// 1. Инициализация элементов
const searchBtn = document.getElementById("searchBtn");
const resultsDiv = document.getElementById("results");
const loading = document.getElementById("loading");
const themeBtn = document.getElementById("themeBtn");
const coffeeItems = document.querySelectorAll(".coffee-item");
const langBtns = document.querySelectorAll(".lang-btn");
const contentTypeBtns = document.querySelectorAll(".content-type-btn");
const booksMoviesForm = document.getElementById("booksMoviesForm");
const musicForm = document.getElementById("musicForm");

// 2. Состояние приложения
let selectedCoffee = coffeeItems.length > 0 ? coffeeItems[0].getAttribute("data-value") : "espresso";
let selectedContentType = "books";
let selectedGenre = "indie";
let selectedPeriod = "2020-now";
let selectedContext = "chill";

// ===== GATEKEEPER: Управление ключом доступа =====

// Функция для получения ключа из localStorage
function getAccessKey() {
    return localStorage.getItem('gatekeeper_key');
}

// Функция для сохранения ключа
function saveAccessKey(key) {
    if (!key) return;
    localStorage.setItem('gatekeeper_key', key.trim());
    updateAccessUI();
    refreshRemainingCount(); // Сразу обновляем счетчик с сервера
}

// Функция для получения остатка попыток с сервера
async function refreshRemainingCount() {
    const key = getAccessKey();
    const counterElement = document.getElementById('remaining-count');
    
    if (!key || !counterElement) return;
    
    try {
        const response = await fetch('/access/status', {
            method: 'GET',
            headers: {
                'x-access-key': key
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            updateRemainingCounter(data.remaining);
        } else {
            counterElement.innerText = "--";
            counterElement.style.color = '#999';
        }
    } catch (err) {
        console.error("Ошибка при получении статуса билета:", err);
        counterElement.innerText = "--";
    }
}

// Функция обновления визуального отображения счетчика
function updateRemainingCounter(count) {
    const counterEl = document.getElementById('remaining-count');
    if (counterEl) {
        counterEl.innerText = count;
        
        // Сохраняем последнее известное значение
        localStorage.setItem('last_remaining', count);
        
        // Визуальная индикация
        if (count <= 1) {
            counterEl.style.color = '#e74c3c';
            counterEl.style.fontWeight = 'bold';
        } else if (count <= 5) {
            counterEl.style.color = '#f39c12';
            counterEl.style.fontWeight = 'bold';
        } else {
            counterEl.style.color = '#2ecc71';
            counterEl.style.fontWeight = 'normal';
        }
    }
}

// Функция обновления UI (показать/скрыть поля)
function updateAccessUI() {
    const key = getAccessKey();
    const accessInfo = document.getElementById('access-info');
    const keyInput = document.getElementById('key-input-field');
    
    if (key) {
        accessInfo?.classList.remove('hidden');
        keyInput?.classList.add('hidden');
        
        // Показываем последнее известное значение из localStorage
        const lastRemaining = localStorage.getItem('last_remaining');
        if (lastRemaining) {
            updateRemainingCounter(parseInt(lastRemaining));
        }
    } else {
        accessInfo?.classList.add('hidden');
        keyInput?.classList.remove('hidden');
    }
}

// Функция показа модального окна при отказе в доступе
function showAccessDeniedModal(reason) {
    const messages = {
        ru: `⛔ Доступ ограничен\n\n${reason}\n\nПожалуйста, пополните баланс или введите новый код доступа.`,
        en: `⛔ Access Denied\n\n${reason}\n\nPlease top up your balance or enter a new access code.`,
        kz: `⛔ Қол жеткізу шектелген\n\n${reason}\n\nБалансты толтырыңыз немесе жаңа код енгізіңіз.`
    };
    
    alert(messages[currentLang] || messages.ru);
    
    // Очищаем ключ и показываем поле ввода
    localStorage.removeItem('gatekeeper_key');
    localStorage.removeItem('last_remaining');
    updateAccessUI();
}

// Обработчик ввода ключа
function setupKeyInput() {
    const keySubmitBtn = document.getElementById('key-submit-btn');
    const keyInputBox = document.getElementById('access-key-input');
    
    if (keySubmitBtn && keyInputBox) {
        keySubmitBtn.addEventListener('click', () => {
            const key = keyInputBox.value.trim();
            if (key.length > 0) {
                saveAccessKey(key);
                keyInputBox.value = '';
            } else {
                alert('Введите код доступа');
            }
        });
        
        // Enter для отправки
        keyInputBox.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                keySubmitBtn.click();
            }
        });
    }
}

// Инициализация при загрузке страницы
window.addEventListener('DOMContentLoaded', () => {
    updateAccessUI();
    setupKeyInput();
    refreshRemainingCount(); // Получаем актуальный остаток с сервера
});

// 3. Словарь переводов (i18n)
const i18n = {
    ru: {
        title: "Coffee & AI",
        subtitle: "ИИ подберет контент под твой кофе",
        books_label: "Книги",
        movies_label: "Фильмы",
        music_label: "Музыка",
        coffee_label: "Какой кофе сегодня?",
        espresso: "Эспрессо",
        latte: "Латте",
        cappuccino: "Капучино",
        americano: "Американо",
        mood_label: "Твое настроение",
        mood_1: "⚡ Приключения",
        mood_2: "😴 Уют и покой",
        mood_3: "🚀 Мотивация",
        mood_4: "🌊 Расслабление",
        mood_5: "🕵️ Загадки",
        user_label: "Кто вы?",
        user_1: "Подросток",
        user_2: "Студент",
        user_3: "Взрослый",
        search_btn: "Подобрать контент",
        loading_text: "AI ищет лучший контент...",
        author_label: "Автор",
        details_btn: "Подробнее",
        rating_label: "Рейтинг",
        genre_label: "Жанр",
        genre_indie: "Indie",
        genre_pop: "Pop",
        genre_rock: "Rock",
        genre_electronic: "Electronic",
        genre_jazz: "Jazz",
        genre_hiphop: "Hip-Hop",
        period_label: "Эпоха",
        period_new: "2020-сейчас",
        period_2010: "2010-2020",
        period_90s: "1995-2010",
        period_80s: "1980-1995",
        context_label: "Контекст",
        context_chill: "Отдых",
        context_focus: "Фокус",
        context_party: "Вечеринка",
        context_night: "Поздний вечер",
        remaining_label: "Осталось попыток:",
        enter_key: "Введите код доступа"
    },
    en: {
        title: "Coffee & AI",
        subtitle: "AI will find content for your coffee",
        books_label: "Books",
        movies_label: "Movies",
        music_label: "Music",
        coffee_label: "Which coffee today?",
        espresso: "Espresso",
        latte: "Latte",
        cappuccino: "Cappuccino",
        americano: "Americano",
        mood_label: "Your mood",
        mood_1: "⚡ Adventure",
        mood_2: "😴 Cozy",
        mood_3: "🚀 Motivation",
        mood_4: "🌊 Relaxation",
        mood_5: "🕵️ Mystery",
        user_label: "Who are you?",
        user_1: "Teenager",
        user_2: "Student",
        user_3: "Adult",
        search_btn: "Find Content",
        loading_text: "AI is searching...",
        author_label: "Author",
        details_btn: "Details",
        rating_label: "Rating",
        genre_label: "Genre",
        genre_indie: "Indie",
        genre_pop: "Pop",
        genre_rock: "Rock",
        genre_electronic: "Electronic",
        genre_jazz: "Jazz",
        genre_hiphop: "Hip-Hop",
        period_label: "Period",
        period_new: "2020-now",
        period_2010: "2010-2020",
        period_90s: "1995-2010",
        period_80s: "1980-1995",
        context_label: "Context",
        context_chill: "Chill",
        context_focus: "Focus",
        context_party: "Party",
        context_night: "Late Night",
        remaining_label: "Attempts left:",
        enter_key: "Enter access code"
    },
    kz: {
        title: "Coffee & AI",
        subtitle: "ЖИ сіздің кофеңізге контент таңдайды",
        books_label: "Кітаптар",
        movies_label: "Фильмдер",
        music_label: "Музыка",
        coffee_label: "Бүгін қандай кофе?",
        espresso: "Эспрессо",
        latte: "Латте",
        cappuccino: "Капучино",
        americano: "Американо",
        mood_label: "Көңіл-күйіңіз",
        mood_1: "⚡ Шытырман оқиға",
        mood_2: "😴 Жайлылық",
        mood_3: "🚀 Мотивация",
        mood_4: "🌊 Тыныштық",
        mood_5: "🕵️ Жұмбақ",
        user_label: "Сіз кімсіз?",
        user_1: "Жасөспірім",
        user_2: "Студент",
        user_3: "Ересек",
        search_btn: "Контент таңдау",
        loading_text: "ЖИ контентті іздеуде...",
        author_label: "Автор",
        details_btn: "Толығырақ",
        rating_label: "Рейтинг",
        genre_label: "Жанр",
        genre_indie: "Indie",
        genre_pop: "Pop",
        genre_rock: "Rock",
        genre_electronic: "Electronic",
        genre_jazz: "Jazz",
        genre_hiphop: "Hip-Hop",
        period_label: "Кезең",
        period_new: "2020-қазір",
        period_2010: "2010-2020",
        period_90s: "1995-2010",
        period_80s: "1980-1995",
        context_label: "Контекст",
        context_chill: "Демалыс",
        context_focus: "Фокус",
        context_party: "Кеш",
        context_night: "Кеш түн",
        remaining_label: "Қалған әрекеттер:",
        enter_key: "Кіру кодын енгізіңіз"
    }
};

// 4. Логика языка
let currentLang = localStorage.getItem("lang") || "ru";

function updateLanguage(lang) {
    if (!i18n[lang]) lang = "ru"; 
    currentLang = lang;
    localStorage.setItem("lang", lang);

    document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.getAttribute("data-i18n");
        if (i18n[lang] && i18n[lang][key]) {
            el.textContent = i18n[lang][key];
        }
    });

    langBtns.forEach(btn => {
        btn.classList.toggle("active", btn.getAttribute("data-lang") === lang);
    });

    if (searchBtn) searchBtn.textContent = i18n[lang].search_btn;
}

langBtns.forEach(btn => {
    btn.addEventListener("click", () => updateLanguage(btn.getAttribute("data-lang")));
});

updateLanguage(currentLang);

// 5. Логика темы
if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark-mode");
}

if (themeBtn) {
    themeBtn.addEventListener("click", () => {
        document.body.classList.toggle("dark-mode");
        const isDark = document.body.classList.contains("dark-mode");
        localStorage.setItem("theme", isDark ? "dark" : "light");
    });
}

// 6. Логика выбора кофе
coffeeItems.forEach(item => {
    item.addEventListener("click", () => {
        coffeeItems.forEach(i => i.classList.remove("active"));
        item.classList.add("active");
        selectedCoffee = item.getAttribute("data-value");
    });
});

// 7. Логика музыкальных фильтров
function setupMusicFilters() {
    // Жанр
    document.querySelectorAll("#musicForm .music-grid:nth-of-type(1) .music-item").forEach(item => {
        item.addEventListener("click", () => {
            document.querySelectorAll("#musicForm .music-grid:nth-of-type(1) .music-item").forEach(i => i.classList.remove("active"));
            item.classList.add("active");
            selectedGenre = item.getAttribute("data-value");
        });
    });

    // Эпоха
    document.querySelectorAll("#musicForm .music-grid:nth-of-type(2) .music-item").forEach(item => {
        item.addEventListener("click", () => {
            document.querySelectorAll("#musicForm .music-grid:nth-of-type(2) .music-item").forEach(i => i.classList.remove("active"));
            item.classList.add("active");
            selectedPeriod = item.getAttribute("data-value");
        });
    });

    // Контекст
    document.querySelectorAll("#musicForm .music-grid:nth-of-type(3) .music-item").forEach(item => {
        item.addEventListener("click", () => {
            document.querySelectorAll("#musicForm .music-grid:nth-of-type(3) .music-item").forEach(i => i.classList.remove("active"));
            item.classList.add("active");
            selectedContext = item.getAttribute("data-value");
        });
    });
}

setupMusicFilters();

// 8. Логика переключения типа контента
contentTypeBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        contentTypeBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        selectedContentType = btn.getAttribute("data-type");

        // Переключаем формы
        if (selectedContentType === "music") {
            booksMoviesForm.classList.add("hidden");
            musicForm.classList.remove("hidden");
        } else {
            booksMoviesForm.classList.remove("hidden");
            musicForm.classList.add("hidden");
        }

        resultsDiv.innerHTML = "";
        const oldVibe = document.getElementById("vibe-logic");
        if (oldVibe) oldVibe.remove();
    });
});

// 9. Универсальная функция рендеринга результатов
function displayResults(data) {
    resultsDiv.innerHTML = "";
    const oldVibe = document.getElementById("vibe-logic");
    if (oldVibe) oldVibe.remove();

    // Vibe-логика
    const vibe = data.meta?.vibe_logic || data.vibe || "";
    if (vibe) {
        const vibeBox = document.createElement("p");
        vibeBox.id = "vibe-logic";
        vibeBox.className = "vibe-logic";
        vibeBox.textContent = `✨ ${vibe}`;
        resultsDiv.parentNode.insertBefore(vibeBox, resultsDiv);
    }

    // Обновляем счетчик попыток если есть в meta
    if (data.meta?.remaining !== undefined) {
        updateRemainingCounter(data.meta.remaining);
    }

    let items = [];
    if (selectedContentType === "books" && data.books) items = data.books;
    else if (selectedContentType === "movies" && data.movies) items = data.movies;
    else if (selectedContentType === "music" && data.tracks) items = data.tracks;

    if (!items || items.length === 0) {
        const noResults = {
            ru: "😕 Ничего не нашлось. Попробуйте изменить параметры.",
            en: "😕 Nothing found. Try different parameters.",
            kz: "😕 Ештеңе табылмады. Параметрлерді өзгертіңіз."
        };
        resultsDiv.innerHTML = `<p class="no-results">${noResults[currentLang] || noResults.ru}</p>`;
        return;
    }

    items.forEach(item => {
        const card = document.createElement("div");
        card.className = "result-card";

        if (selectedContentType === "books") {
            card.className += " book-card";
            card.innerHTML = `
                <img src="${item.thumbnail || 'https://via.placeholder.com/150'}" alt="Обложка">
                <div class="info">
                    <h3>${item.title || "Без названия"}</h3>
                    <p class="author">${i18n[currentLang].author_label}: ${Array.isArray(item.authors) ? item.authors.join(", ") : item.authors || "Неизвестно"}</p>
                    <p class="desc">${item.description || "Описание отсутствует"}</p>
                    <a href="${item.infoLink || '#'}" target="_blank" class="btn">${i18n[currentLang].details_btn}</a>
                </div>
            `;
        } else if (selectedContentType === "movies") {
            const rating = parseFloat(item.rating) || 0;
            card.className += " movie-card";
            card.innerHTML = `
                <img src="${item.poster || 'https://via.placeholder.com/300x450'}" alt="Постер">
                <div class="info">
                    <h3>${item.title || "Без названия"}</h3>
                    <p class="meta">${item.releaseDate || "Год неизвестен"}</p>
                    <p class="desc">${item.overview || "Описание отсутствует"}</p>
                    <div class="rating">⭐ ${rating.toFixed(1)}/10</div>
                </div>
            `;
        } else if (selectedContentType === "music") {
            const minutes = Math.floor(item.duration_ms / 60000);
            const seconds = String(Math.floor((item.duration_ms % 60000) / 1000)).padStart(2, '0');
            const duration = `${minutes}:${seconds}`;

            card.className += " music-card";
            card.innerHTML = `
                <img src="${item.cover || 'https://via.placeholder.com/300'}" alt="${item.album}">
                <div class="music-info">
                    <h3>${item.title || "Без названия"}</h3>
                    <p class="artist">${item.artist || "Неизвестный артист"}</p>
                    <p class="album">${item.album || ""}</p>
                    <div class="music-meta">
                        <span class="duration">⏱ ${duration}</span>
                        ${item.explicit ? '<span class="explicit">🅴</span>' : ''}
                    </div>
                    <a href="${item.spotify_url}" target="_blank" class="buy-link">🎧 Spotify</a>
                </div>
            `;
        }

        resultsDiv.appendChild(card);
    });
}

// 10. Основная логика поиска с Gatekeeper
if (searchBtn) {
    searchBtn.addEventListener("click", async () => {
        const key = getAccessKey();
        
        if (!key) {
            alert(i18n[currentLang].enter_key || "Введите код доступа!");
            return;
        }

        searchBtn.disabled = true;
        loading.classList.remove("hidden");
        resultsDiv.innerHTML = "";

        try {
            let endpoint, body;

            if (selectedContentType === "music") {
                endpoint = "/recommend/music";
                body = { 
                    genre: selectedGenre, 
                    period: selectedPeriod, 
                    context: selectedContext, 
                    lang: currentLang 
                };
            } else {
                const mood = document.getElementById("mood")?.value;
                const userType = document.getElementById("userType")?.value;
                
                if (!mood || !userType) {
                    throw new Error("Не выбрано настроение или тип пользователя");
                }

                endpoint = selectedContentType === "books" ? "/recommend/books" : "/recommend/movies";
                body = { 
                    coffee: selectedCoffee, 
                    mood, 
                    userType, 
                    lang: currentLang 
                };
            }

            const response = await fetch(endpoint, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "x-access-key": key  // ПЕРЕДАЕМ КЛЮЧ
                },
                body: JSON.stringify(body)
            });

            // Обработка ошибок доступа
            if (response.status === 403 || response.status === 401) {
                const errorData = await response.json();
                showAccessDeniedModal(errorData.error || "Доступ запрещен");
                return;
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            displayResults(data);

        } catch (error) {
            console.error("Ошибка:", error);
            resultsDiv.innerHTML = `<p class="error">Ошибка сервера. Попробуйте позже.</p>`;
        } finally {
            searchBtn.disabled = false;
            loading.classList.add("hidden");
        }
    });
}