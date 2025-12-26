import express from "express";
import { config } from "./src/config.js";
import { callAI } from "./src/ai/client.js";
import { searchBooks } from "./src/services/googleBooks.js";
import { cleanJSON } from "./src/utils/cleanJSON.js";
import { cache } from "./src/utils/cache.js";

const app = express();
app.use(express.json());
app.use(express.static("public"));

app.post("/recommend", async (req, res) => {
    const { coffee, mood, userType, lang } = req.body;
    const cacheKey = `${coffee}-${mood}-${userType}-${lang}`.toLowerCase();

    // ПРОВЕРКА КЭША
    if (cache.has(cacheKey)) return res.json(cache.get(cacheKey));

    try {
        // ЭТАП 1: Генерируем запросы (Thinking)
        const searchPrompt = `Analyze: Drink "${coffee}", Mood "${mood}", Category "${userType}". 
        Create 3 English search queries for Google Books. 
        Return JSON: {"queries": ["q1", "q2", "q3"], "vibe_logic": "..."}`;

        const aiSearchRaw = await callAI(searchPrompt);
        const { queries, vibe_logic } = JSON.parse(cleanJSON(aiSearchRaw));

        // ЭТАП 2: Поиск (Filtering inside service)
        const books = await searchBooks(queries, userType);
        if (books.length === 0) return res.json({ books: [], meta: { vibe_logic: "No matches found" } });

        // ЭТАП 3: Локализация (Translation with context)
        const targetLang = lang === 'kz' ? 'Kazakh' : lang === 'ru' ? 'Russian' : 'English';
        const translationPrompt = `Translate to ${targetLang}. Vibe: "${vibe_logic}". 
        Books: ${books.map(b => `ID:${b.id} | T:${b.title}`).join(" ## ")}. 
        Return JSON: {"translated_vibe": "...", "translated_books": [{"id": "...", "title": "...", "description": "..."}]}`;

        const aiTransRaw = await callAI(translationPrompt);
        const transData = JSON.parse(cleanJSON(aiTransRaw));

        // ЭТАП 4: Сборка ответа с ID-Matching (Point #8)
        const response = {
            meta: { vibe_logic: transData.translated_vibe || vibe_logic },
            books: books.map(b => {
                const trans = transData.translated_books?.find(tb => tb.id === b.id);
                return { ...b, title: trans?.title || b.title, description: trans?.description || b.description };
            })
        };

        // Ограничение размера кэша
        if (cache.size > 100) cache.delete(cache.keys().next().value);
        cache.set(cacheKey, response);

        res.json(response);

    } catch (err) {
        console.error("Critical Error:", err.message);
        res.status(500).json({ error: "Service Error" });
    }
});

app.listen(config.port, () => console.log(`🚀 Server on port ${config.port}`));