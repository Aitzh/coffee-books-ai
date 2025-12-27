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
let selectedContentType = "books"; // books, movies, music
let selectedGenre = "indie";
let selectedPeriod = "2020-now";
let selectedContext = "chill";

// 3. Словарь переводов (i18n) — уже правильный, оставляем как есть
const i18n = { /* твой объект i18n без изменений */ 
    ru: { /* ... */ },
    en: { /* ... */ },
    kz: { /* ... */ }
};

// 4. Логика языка
let currentLang = localStorage.getItem("lang") || "ru";

function updateLanguage(lang) {
    if (!i18n[lang]) lang = "ru";
    currentLang = lang;
    localStorage.setItem("lang", lang);

    // Обновляем все элементы с data-i18n
    document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.getAttribute("data-i18n");
        if (i18n[lang]?.[key]) {
            el.textContent = i18n[lang][key];
        }
    });

    // Особое внимание кнопке поиска
    const searchBtn = document.getElementById("searchBtn");
    if (searchBtn && i18n[lang]?.search_btn) {
        searchBtn.textContent = i18n[lang].search_btn;
    }

    // Обновляем выбранный язык в кнопках
    langBtns.forEach(btn => {
        btn.classList.toggle("active", btn.getAttribute("data-lang") === lang);
    });

    // Обновляем placeholder в селектах (если нужно)
    const selects = document.querySelectorAll("select");
    selects.forEach(select => {
        const options = select.querySelectorAll("option");
        options.forEach(option => {
            const key = option.getAttribute("data-i18n");
            if (key && i18n[lang]?.[key]) {
                option.textContent = i18n[lang][key];
            }
        });
    });

    console.log(`🌐 Язык изменен на: ${lang}`);
}

// Добавляем обработчики для кнопок языка
langBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        const lang = btn.getAttribute("data-lang");
        updateLanguage(lang);
    });
});

// Инициализация при загрузке
document.addEventListener("DOMContentLoaded", () => {
    updateLanguage(currentLang);
});
// 5. Логика темы
if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark-mode");
}
if (themeBtn) {
    themeBtn.addEventListener("click", () => {
        document.body.classList.toggle("dark-mode");
        localStorage.setItem("theme", document.body.classList.contains("dark-mode") ? "dark" : "light");
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

// Установка активного кофе по умолчанию
const defaultCoffee = Array.from(coffeeItems).find(item => item.getAttribute("data-value") === selectedCoffee);
if (defaultCoffee) defaultCoffee.classList.add("active");

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

    // Установка активных по умолчанию
    document.querySelector(`#musicForm .music-item[data-value="${selectedGenre}"]`)?.classList.add("active");
    document.querySelector(`#musicForm .music-item[data-value="${selectedPeriod}"]`)?.classList.add("active");
    document.querySelector(`#musicForm .music-item[data-value="${selectedContext}"]`)?.classList.add("active");
}

setupMusicFilters();

// 8. Переключение типа контента (книги/фильмы ↔ музыка)
contentTypeBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        contentTypeBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        selectedContentType = btn.getAttribute("data-type");

        // Показ/скрытие форм
        if (selectedContentType === "music") {
            booksMoviesForm?.classList.add("hidden");
            musicForm?.classList.remove("hidden");
        } else {
            booksMoviesForm?.classList.remove("hidden");
            musicForm?.classList.add("hidden");
        }

        // Очистка результатов
        resultsDiv.innerHTML = "";
        const oldVibe = document.getElementById("vibe-logic");
        if (oldVibe) oldVibe.remove();
    });
});

// Активная кнопка типа контента по умолчанию
document.querySelector(`.content-type-btn[data-type="${selectedContentType}"]`)?.classList.add("active");
if (selectedContentType === "music") {
    booksMoviesForm?.classList.add("hidden");
    musicForm?.classList.remove("hidden");
}

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
                <img src="${item.thumbnail || 'https://via.placeholder.com/150'}" alt="Обложка" onerror="this.src='https://via.placeholder.com/150'">
                <div class="info">
                    <h3>${item.title || "Без названия"}</h3>
                    <p class="author">${i18n[currentLang].author_label}: ${Array.isArray(item.authors) ? item.authors.join(", ") : item.authors || "Неизвестно"}</p>
                    <p class="desc">${item.description || "Описание отсутствует"}</p>
                    <a href="${item.infoLink || '#'}" target="_blank" rel="noopener" class="btn">${i18n[currentLang].details_btn}</a>
                </div>
            `;

        } else if (selectedContentType === "movies") {
            const rating = parseFloat(item.rating) || 0;
            const ratingClass = rating >= 7.5 ? "good" : rating >= 6 ? "medium" : "low";
            card.className += " movie-card";
            card.innerHTML = `
                <img src="${item.poster || 'https://via.placeholder.com/300x450'}" alt="Постер" onerror="this.src='https://via.placeholder.com/300x450'">
                <div class="info">
                    <h3>${item.title || "Без названия"}</h3>
                    <p class="meta">${item.releaseDate || "Год неизвестен"}</p>
                    <p class="desc">${item.overview || "Описание отсутствует"}</p>
                    <div class="rating ${ratingClass}">⭐ ${rating.toFixed(1)}/10</div>
                </div>
            `;

        } else if (selectedContentType === "music") {
            const minutes = Math.floor(item.duration_ms / 60000);
            const seconds = String(Math.floor((item.duration_ms % 60000) / 1000)).padStart(2, '0');
            const duration = `${minutes}:${seconds}`;

            card.className += " music-card";
            card.innerHTML = `
                <img src="${item.cover || 'https://via.placeholder.com/300'}" alt="${item.album}" onerror="this.src='https://via.placeholder.com/300'">
                <div class="music-info">
                    <h3>${item.title || "Без названия"}</h3>
                    <p class="artist">${item.artist || "Неизвестный артист"}</p>
                    <p class="album">${item.album || ""}</p>
                    <div class="music-meta">
                        <span class="duration">⏱ ${duration}</span>
                        ${item.explicit ? '<span class="explicit">🅴</span>' : ''}
                    </div>
                    <a href="${item.spotify_url}" target="_blank" rel="noopener" class="buy-link">🎧 Spotify</a>
                    ${item.preview_url ? `<button class="preview-btn" data-preview="${item.preview_url}">▶️ 30s</button>` : ""}
                </div>
            `;

            // Добавляем обработчик превью после вставки в DOM
            if (item.preview_url) {
                card.querySelector(".preview-btn").addEventListener("click", () => {
                    const audio = new Audio(item.preview_url);
                    audio.play().catch(() => console.log("Превью не воспроизведено"));
                });
            }
        }

        resultsDiv.appendChild(card);
    });
}

// 10. Основная логика поиска
if (searchBtn) {
    searchBtn.addEventListener("click", async () => {
        searchBtn.disabled = true;
        loading.classList.remove("hidden");
        resultsDiv.innerHTML = "";

        try {
            let endpoint, body;

            if (selectedContentType === "music") {
                endpoint = "/recommend/music";
                body = { genre: selectedGenre, period: selectedPeriod, context: selectedContext, lang: currentLang };
            } else {
                const mood = document.getElementById("mood")?.value;
                const userType = document.getElementById("userType")?.value;
                if (!mood || !userType) throw new Error("Не выбрано настроение или тип пользователя");

                endpoint = selectedContentType === "books" ? "/recommend/books" : "/recommend/movies";
                body = { coffee: selectedCoffee, mood, userType, lang: currentLang };
            }

            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

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