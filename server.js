import "dotenv/config";
import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Берем все ключи из .env (с обрезкой лишних пробелов)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim();
const GROQ_API_KEY = process.env.GROQ_API_KEY?.trim();
const GOOGLE_BOOKS_API_KEY = process.env.GOOGLE_BOOKS_API_KEY?.trim();

// Проверка наличия основных ключей
if (!GOOGLE_BOOKS_API_KEY || (!GEMINI_API_KEY && !GROQ_API_KEY)) {
    console.error("ОШИБКА: Недостаточно API ключей в .env!");
    process.exit(1);
}

const GEMINI_MODEL = "gemini-2.0-flash-lite"; 
const GROQ_MODEL = "llama-3.3-70b-versatile";

app.use(express.json());
app.use(express.static("public"));

const SAFETY_SETTINGS = [
    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
];

const PROMPTS = {
    school: `Ты ИИ для подростков 13-18 лет. Напиток: {{coffee}}, настроение: {{mood}}. Подбери YA книги. JSON формат: {"queries": ["query 1", "query 2"], "reading_state": "comfort"}`,
    university: `Ты ИИ для студентов 18-23 лет. Напиток: {{coffee}}, настроение: {{mood}}. Подбери fiction. JSON формат: {"queries": ["query 1", "query 2"], "reading_state": "reflective"}`,
    adult: `Ты ИИ для взрослых 23+. Напиток: {{coffee}}, настроение: {{mood}}. Подбери зрелую прозу. JSON формат: {"queries": ["query 1", "query 2"], "reading_state": "thoughtful"}`
};

function cleanJSON(text) {
    return text.replace(/```json|```/g, "").trim();
}

// === УМНАЯ ФУНКЦИЯ ЗАПРОСА К ИИ (С РОТАЦИЕЙ) ===
async function callAI(prompt) {
    try {
        console.log("--- Попытка через Gemini ---");
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                contents: [{ parts: [{ text: prompt }] }],
                safetySettings: SAFETY_SETTINGS
            })
        });
        const data = await res.json();
        
        if (data.candidates && data.candidates[0].content.parts[0].text) {
            return data.candidates[0].content.parts[0].text;
        }
        throw new Error("Gemini Error");
    } catch (err) {
        console.log("⚠️ Gemini не сработал, переключаюсь на Groq...");
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: GROQ_MODEL,
                messages: [{ role: "user", content: prompt }],
                response_format: { type: "json_object" }
            })
        });
        const data = await res.json();
        return data.choices[0].message.content;
    }
}

app.post("/recommend", async (req, res) => {
    const { coffee, mood, userType, lang } = req.body;

    try {
        console.log(`\n--- Запрос: ${userType} | Настроение: ${mood} ---`);

        // 1. ПОДГОТОВКА ПРОМПТА
        let template = (userType?.includes("teenager")) ? PROMPTS.school : (userType?.includes("student")) ? PROMPTS.university : PROMPTS.adult;
        const finalPrompt = template.replace("{{coffee}}", coffee).replace("{{mood}}", mood);

        // 2. ЗАПРОС К ИИ
        const aiText = await callAI(finalPrompt);
        let parsedData;

        try {
            parsedData = JSON.parse(cleanJSON(aiText));
            // Защита: если queries не массив, исправляем
            if (!parsedData.queries || !Array.isArray(parsedData.queries)) {
                parsedData.queries = typeof parsedData.queries === 'string' ? [parsedData.queries] : ["popular books for " + mood];
            }
        } catch (e) {
            console.error("❌ Ошибка парсинга JSON:", e.message);
            parsedData = { queries: ["popular books for " + mood] };
        }

        // 3. ПОИСК В GOOGLE BOOKS
        let foundBooks = [];
        for (const q of parsedData.queries) {
            console.log("Ищу:", q);
            const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&langRestrict=en&maxResults=2&key=${GOOGLE_BOOKS_API_KEY}`;
            try {
                const bRes = await fetch(url).then(r => r.json());
                if (bRes.items) foundBooks.push(...bRes.items);
            } catch (e) {
                console.error("Ошибка Google Books для запроса:", q);
            }
        }

        // Очистка дубликатов и фильтрация
        let uniqueBooks = Array.from(new Map(foundBooks.map(item => [item.id, item])).values())
            .filter(b => b.volumeInfo?.imageLinks?.thumbnail).slice(0, 4);

        if (uniqueBooks.length === 0) {
            return res.json([]);
        }

        // 4. ПЕРЕВОД
        const targetLang = lang === 'kz' ? 'Kazakh' : lang === 'ru' ? 'Russian' : 'English';
        const transPrompt = `Translate book info to ${targetLang}. JSON format: {"translated": [{"title": "...", "description": "..."}]}. Books: ${uniqueBooks.map(b => b.volumeInfo.title + " - " + b.volumeInfo.description?.substring(0, 50)).join(" | ")}`;
        
        const translatedRaw = await callAI(transPrompt);
        let translations = [];
        try {
            translations = JSON.parse(cleanJSON(translatedRaw)).translated;
        } catch (e) {
            console.error("Ошибка парсинга перевода");
        }

        // 5. ФОРМИРОВАНИЕ ОТВЕТА
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
        console.error("КРИТИЧЕСКАЯ ОШИБКА:", err);
        res.status(500).json({ error: "Server Error" });
    }
});

app.listen(PORT, () => console.log(`🚀 Сервер на двух движках запущен на порту ${PORT}!`));