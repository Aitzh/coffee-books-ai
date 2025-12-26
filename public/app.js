// 1. Инициализация элементов
const searchBtn = document.getElementById("searchBtn");
const resultsDiv = document.getElementById("results");
const loading = document.getElementById("loading");
const themeBtn = document.getElementById("themeBtn");
const coffeeItems = document.querySelectorAll(".coffee-item");
const langBtns = document.querySelectorAll(".lang-btn");

// 2. Словарь переводов (i18n)
const i18n = {
    ru: {
        title: "Coffee & Books AI", subtitle: "ИИ подберет книгу под твой кофе",
        coffee_label: "Какой кофе сегодня?", espresso: "Эспрессо", latte: "Латте", cappuccino: "Капучино", americano: "Американо",
        mood_label: "Твое настроение", mood_1: "⚡ Приключения", mood_2: "😴 Уют и покой", mood_3: "🚀 Мотивация", mood_4: "🌊 Расслабление", mood_5: "🕵️ Загадки",
        user_label: "Кто вы?", user_1: "Подросток", user_2: "Студент", user_3: "Взрослый",
        search_btn: "Подобрать книги", loading_text: "Gemini ищет лучшие истории..."
    },
    en: {
        title: "Coffee & Books AI", subtitle: "AI will find a book for your coffee",
        coffee_label: "Which coffee today?", espresso: "Espresso", latte: "Latte", cappuccino: "Cappuccino", americano: "Americano",
        mood_label: "Your mood", mood_1: "⚡ Adventure", mood_2: "😴 Cozy and Quiet", mood_3: "🚀 Motivation", mood_4: "🌊 Relaxation", mood_5: "🕵️ Mystery",
        user_label: "Who are you?", user_1: "Teenager", user_2: "Student", user_3: "Adult",
        search_btn: "Find Books", loading_text: "Gemini is searching for stories..."
    },
    kz: {
        title: "Coffee & Books AI", subtitle: "ЖИ сіздің кофеңізге кітап таңдайды",
        coffee_label: "Бүгін қандай кофе?", espresso: "Эспрессо", latte: "Латте", cappuccino: "Капучино", americano: "Американо",
        mood_label: "Көңіл-күйіңіз", mood_1: "⚡ Шытырман оқиға", mood_2: "😴 Жайлылық", mood_3: "🚀 Мотивация", mood_4: "🌊 Тыныштық", mood_5: "🕵️ Жұмбақ",
        user_label: "Сіз кімсіз?", user_1: "Жасөспірім", user_2: "Студент", user_3: "Ересек",
        search_btn: "Кітап таңдау", loading_text: "Gemini хикаяларды іздеуде..."
    }
};

// 3. Логика Языка
let currentLang = localStorage.getItem("lang") || "ru";

function updateLanguage(lang) {
    currentLang = lang;
    localStorage.setItem("lang", lang);

    // Обновляем текст везде, где есть атрибут data-i18n
    document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.getAttribute("data-i18n");
        if (i18n[lang][key]) {
            el.innerText = i18n[lang][key];
        }
    });

    // Визуально переключаем активную кнопку
    langBtns.forEach(btn => {
        btn.classList.toggle("active", btn.getAttribute("data-lang") === lang);
    });
}

// Вешаем слушатели на кнопки языка
langBtns.forEach(btn => {
    btn.addEventListener("click", () => updateLanguage(btn.getAttribute("data-lang")));
});

// Запускаем язык при загрузке
updateLanguage(currentLang);

// 4. Логика Темы
if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark-mode");
}

themeBtn.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    const isDark = document.body.classList.contains("dark-mode");
    localStorage.setItem("theme", isDark ? "dark" : "light");
});

// 5. Логика Выбора Кофе
let selectedCoffee = coffeeItems[0].getAttribute("data-value");

coffeeItems.forEach(item => {
    item.addEventListener("click", () => {
        coffeeItems.forEach(i => i.classList.remove("active"));
        item.classList.add("active");
        selectedCoffee = item.getAttribute("data-value");
    });
});

// 6. Логика Поиска (Единая и Финальная)
searchBtn.addEventListener("click", async () => {
    const mood = document.getElementById("mood").value;
    const userType = document.getElementById("userType").value;

    // Блокируем интерфейс
    searchBtn.disabled = true;
    loading.classList.remove("hidden");
    resultsDiv.innerHTML = "";

    try {
        const res = await fetch("/recommend", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                coffee: selectedCoffee, 
                mood, 
                userType,
                lang: currentLang 
            })
        });

        const books = await res.json();

        // Если пришел пустой массив или null
        if (!books || books.length === 0) {
            const noFoundText = {
                ru: "Ничего не нашлось. Попробуйте изменить параметры.",
                en: "Nothing found. Try changing parameters.",
                kz: "Ештеңе табылмады. Параметрлерді өзгертіп көріңіз."
            };
            resultsDiv.innerHTML = `<p style='text-align:center;'>${noFoundText[currentLang]}</p>`;
            return;
        }

        // Рендер карточек
        books.forEach(book => {
            const card = document.createElement("div");
            card.className = "book-card";
            
            const moreBtnText = { ru: "Подробнее", en: "Details", kz: "Толығырақ" };
            const authorText = { ru: "Автор", en: "Author", kz: "Автор" };

            card.innerHTML = `
                <img src="${book.thumbnail}" alt="Cover">
                <div class="book-info">
                    <h3>${book.title}</h3>
                    <p class="author">${authorText[currentLang]}: ${book.authors.join(", ")}</p>
                    <p class="desc">${book.description}</p>
                    <a href="${book.infoLink}" target="_blank" class="buy-link">${moreBtnText[currentLang]}</a>
                </div>
            `;
            resultsDiv.appendChild(card);
        });

    } catch (e) {
        console.error("Ошибка:", e);
        const errorText = {
            ru: "Ошибка сервера. Проверьте консоль.",
            en: "Server Error. Check console.",
            kz: "Сервер қатесі. Консольді тексеріңіз."
        };
        resultsDiv.innerHTML = `<p style='color:var(--primary); text-align:center;'>${errorText[currentLang]}</p>`;
    } finally {
        searchBtn.disabled = false;
        loading.classList.add("hidden");
    }
});