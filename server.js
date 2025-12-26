import express from "express";
import fetch from "node-fetch";
import "dotenv/config";

// === ВАШИ КЛЮЧИ (ВСТАВЬ СЮДА) ===
const app = express();
const PORT = process.env.PORT || 3000; // <--- 2. Порт тоже берем из настроек

// 3. Берем ключи из "сейфа" (process.env)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 
const GOOGLE_BOOKS_API_KEY = process.env.GOOGLE_BOOKS_API_KEY;

// Проверка: если ключей нет, сервер скажет об этом
if (!GEMINI_API_KEY || !GOOGLE_BOOKS_API_KEY) {
    console.error("ОШИБКА: Не найдены API ключи в файле .env!");
    process.exit(1);
}

// === ИМЯ МОДЕЛИ (СТАНДАРТНОЕ) ===
const MODEL_NAME = "gemini-2.5-flash"; 

app.use(express.json());
app.use(express.static("public"));

// === НАСТРОЙКИ БЕЗОПАСНОСТИ ===
const SAFETY_SETTINGS = [
    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
];

// === БАЗА ПРОМПТОВ ===
const PROMPTS = {
    school: `
Ты рекомендательный ИИ для подбора книг школьникам 13–18 лет.
Входные данные: напиток: {{coffee}}, настроение: {{mood}}
Требования:
1. Подбирай книги с простым языком и короткими главами.
2. Избегай сложных тем.
3. Предпочитай YA, coming-of-age, приключения.
Сформируй 3 поисковых запроса для Google Books на английском языке.
Верни СТРОГО валидный JSON: { "queries": ["..."], "reading_state": "comfort" }`,

    university: `
Ты рекомендательный ИИ для подбора книг студентам 18–23 лет.
Входные данные: напиток: {{coffee}}, настроение: {{mood}}
Требования:
1. Подбирай книги со внятным сюжетом и умеренной глубиной.
2. Балансируй между развлечением и смыслом.
3. Подходящие жанры: fiction with ideas, mystery.
Сформируй 3 поисковых запроса для Google Books на английском языке.
Верни СТРОГО валидный JSON: { "queries": ["..."], "reading_state": "reflective" }`,

    adult: `
Ты рекомендательный ИИ для подбора книг взрослым читателям 23+.
Входные данные: напиток: {{coffee}}, настроение: {{mood}}
Требования:
1. Подбирай книги с чёткой идеей или сильной атмосферой.
2. Предпочитай зрелую художественную прозу, нон-фикшн.
3. Книги должны давать ощущение ценности времени.
Сформируй 3 поисковых запроса для Google Books на английском языке.
Верни СТРОГО валидный JSON: { "queries": ["..."], "reading_state": "thoughtful" }`
};

function cleanJSON(text) {
    return text.replace(/```json|```/g, "").trim();
}

app.post("/recommend", async (req, res) => {
    const { coffee, mood, userType, lang } = req.body;

    try {
        console.log(`\n--- Запрос: ${userType} | Язык: ${lang} | Модель: ${MODEL_NAME} ---`);

        // 1. ВЫБОР ПРОМПТА
        let template;
        if (!userType) template = PROMPTS.adult;
        else if (userType.includes("teenager") || userType.includes("14-18")) template = PROMPTS.school;
        else if (userType.includes("student")) template = PROMPTS.university;
        else template = PROMPTS.adult;

        const finalPrompt = template.replace("{{coffee}}", coffee).replace("{{mood}}", mood);

        // 2. GEMINI -> ЗАПРОСЫ
        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                contents: [{ parts: [{ text: finalPrompt }] }],
                safetySettings: SAFETY_SETTINGS
            })
        });
        
        const geminiData = await geminiRes.json();
        
        if (!geminiData.candidates) {
            console.error("ОШИБКА GEMINI:", JSON.stringify(geminiData, null, 2));
            throw new Error(`Модель ${MODEL_NAME} вернула ошибку.`);
        }

        const aiText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
        
        let parsedData = { queries: [`best books for ${mood} ${userType}`] };
        try { parsedData = JSON.parse(cleanJSON(aiText)); } catch (e) { console.log("JSON Error, fallback used"); }

        console.log("Стратегия:", parsedData.queries);

        // 3. GOOGLE BOOKS
        let foundBooks = [];
        for (const q of parsedData.queries) {
            const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&langRestrict=en&maxResults=2&key=${GOOGLE_BOOKS_API_KEY}`;
            try {
                const bRes = await fetch(url).then(r => r.json());
                if (bRes.items) foundBooks.push(...bRes.items);
            } catch (e) {}
        }

        let uniqueBooks = Array.from(new Map(foundBooks.map(item => [item.id, item])).values())
            .filter(b => b.volumeInfo?.imageLinks?.thumbnail)
            .slice(0, 4);

        if (uniqueBooks.length === 0) {
            console.log("⚠️ Ничего не нашли, пробуем запасной поиск...");
            const fbRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(mood)}&maxResults=3&key=${GOOGLE_BOOKS_API_KEY}`).then(r => r.json());
            uniqueBooks = fbRes.items || [];
        }

        // 4. ПЕРЕВОД
        const targetLang = lang === 'kz' ? 'Kazakh' : lang === 'ru' ? 'Russian' : 'English';
        const transPrompt = `Translate book info to ${targetLang}. Keep tone: ${parsedData.reading_state || 'neutral'}.
        Books: ${uniqueBooks.map((b, i) => `[${i}] ${b.volumeInfo.title} :: ${b.volumeInfo.description?.substring(0, 150)}`).join("\n")}
        Return JSON: {"translated": [{"title": "...", "description": "..."}]}`;

        const transRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                contents: [{ parts: [{ text: transPrompt }] }],
                safetySettings: SAFETY_SETTINGS
            })
        });
        
        const transJson = await transRes.json();
        
        let translations = [];
        if (transJson.candidates) {
             try { translations = JSON.parse(cleanJSON(transJson.candidates[0].content.parts[0].text)).translated; } catch (e) {}
        }

        const finalResponse = uniqueBooks.map((b, i) => ({
            id: b.id,
            thumbnail: b.volumeInfo.imageLinks?.thumbnail?.replace("http://", "https://"),
            infoLink: b.volumeInfo.infoLink,
            title: translations[i]?.title || b.volumeInfo.title,
            authors: b.volumeInfo.authors || [],
            description: translations[i]?.description || b.volumeInfo.description
        }));

        res.json(finalResponse);

    } catch (err) {
        console.error("КРИТИЧЕСКАЯ ОШИБКА:", err.message);
        res.status(500).json({ error: "Server Error" });
    }
});

app.listen(PORT, () => console.log(`🚀 Сервер: http://localhost:${PORT}`));