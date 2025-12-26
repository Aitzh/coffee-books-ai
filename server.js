import express from "express";
import fetch from "node-fetch";
import "dotenv/config";

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Берем все ключи из .env
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GOOGLE_BOOKS_API_KEY = process.env.GOOGLE_BOOKS_API_KEY;

// Проверка наличия основных ключей
if (!GOOGLE_BOOKS_API_KEY || (!GEMINI_API_KEY && !GROQ_API_KEY)) {
    console.error("ОШИБКА: Недостаточно API ключей в .env!");
    process.exit(1);
}

const GEMINI_MODEL = "gemini-1.5-flash"; // Исправил на 1.5
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
    school: `Ты ИИ для школьников 13-18 лет. Напиток: {{coffee}}, настроение: {{mood}}. Подбери YA книги. JSON: {"queries": ["..."], "reading_state": "comfort"}`,
    university: `Ты ИИ для студентов 18-23 лет. Напиток: {{coffee}}, настроение: {{mood}}. Подбери fiction. JSON: {"queries": ["..."], "reading_state": "reflective"}`,
    adult: `Ты ИИ для взрослых 23+. Напиток: {{coffee}}, настроение: {{mood}}. Подбери зрелую прозу. JSON: {"queries": ["..."], "reading_state": "thoughtful"}`
};

function cleanJSON(text) {
    return text.replace(/```json|```/g, "").trim();
}

// === УМНАЯ ФУНКЦИЯ ЗАПРОСА К ИИ (С РОТАЦИЕЙ) ===
async function callAI(prompt) {
    // Сначала пробуем Gemini
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
        throw new Error("Gemini Quota Exceeded or Error");
    } catch (err) {
        console.log("⚠️ Gemini не сработал, переключаюсь на Groq...");
        
        // Если Gemini упала, пробуем Groq
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
        let template = (userType?.includes("teenager")) ? PROMPTS.school : (userType?.includes("student")) ? PROMPTS.university : PROMPTS.adult;
        const finalPrompt = template.replace("{{coffee}}", coffee).replace("{{mood}}", mood);

        // 1. Получаем запросы от доступного ИИ
        const aiText = await callAI(finalPrompt);
        let parsedData = JSON.parse(cleanJSON(aiText));

        // 2. Поиск в Google Books
        let foundBooks = [];
        for (const q of parsedData.queries) {
            const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&langRestrict=en&maxResults=2&key=${GOOGLE_BOOKS_API_KEY}`;
            const bRes = await fetch(url).then(r => r.json());
            if (bRes.items) foundBooks.push(...bRes.items);
        }

        let uniqueBooks = Array.from(new Map(foundBooks.map(item => [item.id, item])).values())
            .filter(b => b.volumeInfo?.imageLinks?.thumbnail).slice(0, 4);

        // 3. Перевод (тоже через ротатор ИИ)
        const targetLang = lang === 'kz' ? 'Kazakh' : lang === 'ru' ? 'Russian' : 'English';
        const transPrompt = `Translate book info to ${targetLang}. JSON format: {"translated": [{"title": "...", "description": "..."}]}. Books: ${uniqueBooks.map(b => b.volumeInfo.title).join(", ")}`;
        
        const translatedRaw = await callAI(transPrompt);
        const translations = JSON.parse(cleanJSON(translatedRaw)).translated;

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
        console.error("Ошибка сервера:", err);
        res.status(500).json({ error: "Server Error" });
    }
});

app.listen(PORT, () => console.log(`🚀 Сервер на двух движках запущен!`));