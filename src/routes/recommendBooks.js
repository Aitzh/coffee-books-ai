import express from "express";
import { callAI } from "../ai/client.js";
import { searchBooks } from "../services/googleBooks.js";
import { cleanJSON } from "../utils/cleanJSON.js";
import { cache } from "../utils/cache.js";
import { gatekeeper } from "../access-system/index.js";

const router = express.Router();
const CATEGORY = "books";

// Используем обертку wrap, чтобы автоматизировать списание и расчет лимитов
router.post("/", gatekeeper.wrap(CATEGORY, async (req, res) => {
    const { coffee, mood, userType, lang } = req.body;
    
    const cacheKey = `books-${coffee}-${mood}-${userType}-${lang}`.toLowerCase();

    try {
        console.log(`📚 Новый запрос (Books): ${mood} + ${userType} (кофе: ${coffee})`);

        // ==========================================
        // ЭТАП 0: КЭШ
        // ==========================================
        if (cache.has(cacheKey)) {
            console.log("📦 Взято из кэша (Books)");
            // Просто отдаем. Обертка сама поймет, что это успешный ответ,
            // спишет попытку в базе и допишет актуальный remaining.
            return res.json(cache.get(cacheKey));
        }

        // ==========================================
        // ЭТАП 1: AI → ГЕНЕРАЦИЯ ЗАПРОСОВ ПОИСКА
        // ==========================================
        const searchPrompt = `You are a book recommendation expert. Analyze the user's profile and generate Google Books search queries.

USER PROFILE:
- Mood/State: "${mood}"
- Age Group: "${userType}"
- Coffee preference (minor factor): "${coffee}"

TASK:
Based PRIMARILY on mood and age, generate 3 diverse search queries for Google Books API.
Queries should be in English and focus on genres, themes, or keywords.

IMPORTANT:
- Prioritize mood and age group over coffee
- For "tired, cozy" → suggest comfort reads, slice-of-life, gentle stories
- For "energetic, adventures" → suggest action, adventure, thrillers
- For "mysterious" → suggest mystery, detective, psychological thrillers
- For teenagers → suggest YA fiction, coming-of-age, fantasy
- For students → suggest contemporary fiction, self-improvement, thought-provoking
- For adults → any genre is acceptable

Return JSON:
{
  "queries": ["query1", "query2", "query3"],
  "vibe_logic": "Brief explanation in English why these books match"
}`;

        const aiSearchRaw = await callAI(searchPrompt, true);
        let searchData;

        try {
            searchData = JSON.parse(cleanJSON(aiSearchRaw));
        } catch (e) {
            console.warn("⚠️ Ошибка парсинга поиска, применяю fallback");
            
            // Твой оригинальный умный fallback
            let fallbackQueries = ["fiction"];
            if (mood.includes("energetic") || mood.includes("adventure")) {
                fallbackQueries = ["adventure fiction", "thriller", "action"];
            } else if (mood.includes("tired") || mood.includes("cozy")) {
                fallbackQueries = ["comfort read", "slice of life", "cozy mystery"];
            } else if (mood.includes("mysterious")) {
                fallbackQueries = ["mystery", "detective", "psychological thriller"];
            } else if (mood.includes("motivation")) {
                fallbackQueries = ["inspirational", "self-help", "motivation"];
            }
            
            searchData = { 
                queries: fallbackQueries, 
                vibe_logic: "Books matching your mood and age..." 
            };
        }

        const queries = searchData.queries || ["fiction"];
        const vibeLogic = searchData.vibe_logic || "Books for your vibe...";

        // ==========================================
        // ЭТАП 2: ПОИСК В GOOGLE BOOKS
        // ==========================================
        console.log(`🔎 Ищу книги в Google Books: ${queries.join(", ")}`);
        const books = await searchBooks(queries, userType);

        if (books.length === 0) {
            return res.json({ 
                books: [], 
                meta: { vibe_logic: "No books found. Try different settings." } 
            });
        }

        // Форматируем данные из Google Books API
        const formattedBooks = books.map(b => ({
            id: b.id,
            title: b.volumeInfo.title || "Unknown",
            authors: b.volumeInfo.authors || ["Unknown Author"],
            description: (b.volumeInfo.description || "No description available").substring(0, 200) + "...",
            thumbnail: b.volumeInfo.imageLinks?.thumbnail || "",
            infoLink: b.volumeInfo.infoLink || "#"
        }));

        // ==========================================
        // ЭТАП 3: ПЕРЕВОД (ЕСЛИ НУЖЕН)
        // ==========================================
        let finalResponse = {
            books: formattedBooks,
            meta: { vibe_logic: vibeLogic }
        };
        
        if (lang !== 'en') {
            const targetLang = lang === 'kz' ? 'Kazakh' : 'Russian';
            const translationPrompt = `Translate to ${targetLang}. Keep it natural and concise.

Vibe text: "${vibeLogic}"

Books to translate:
${formattedBooks.map(b => `ID:${b.id} | Title:"${b.title}" | Description:"${b.description}"`).join("\n")}

Return JSON: 
{
  "translated_vibe": "...", 
  "translated_books": [
    {"id": "...", "title": "...", "description": "..."},
    ...
  ]
}`;

            try {
                const aiTransRaw = await callAI(translationPrompt, true);
                const transData = JSON.parse(cleanJSON(aiTransRaw));

                finalResponse = {
                    meta: { vibe_logic: transData.translated_vibe || vibeLogic },
                    books: formattedBooks.map(b => {
                        const trans = transData.translated_books?.find(tb => tb.id === b.id);
                        return { 
                            ...b, 
                            title: trans?.title || b.title, 
                            description: trans?.description || b.description 
                        };
                    })
                };
            } catch (transErr) {
                console.warn("⚠️ Ошибка перевода, отдаю оригинал на английском");
            }
        }

        // ==========================================
        // ЭТАП 4: СОХРАНЕНИЕ В КЭШ И ОТВЕТ
        // ==========================================
        if (cache.size > 100) cache.clear();
        cache.set(cacheKey, finalResponse);

        // Просто вызываем res.json().
        // Обертка withGatekeeper сама перехватит этот вызов, спишет попытку в базе
        // и добавит в finalResponse.meta поле remaining.
        res.json(finalResponse);

    } catch (err) {
        // Если произошла ошибка до res.json, управление попадет сюда.
        // Обертка НЕ спишет попытку, так как ответ не был отправлен.
        console.error("🔥 Критическая ошибка в роутере Books:", err);
        res.status(500).json({ 
            error: "Internal Server Error", 
            details: err.message 
        });
    }
}));

export default router;