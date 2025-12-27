import express from "express";
import { callAI } from "../ai/client.js";
import { searchMovies } from "../services/tmdb.js";
import { cleanJSON } from "../utils/cleanJSON.js";
import { cache } from "../utils/cache.js";
import { gatekeeper } from "../access-system/index.js";

const router = express.Router();
const CATEGORY = "movies";

router.post("/", gatekeeper.wrap(CATEGORY, async (req, res) => {
    const { coffee, mood, userType, lang } = req.body;
    
    const cacheKey = `movies-${coffee}-${mood}-${userType}-${lang}`.toLowerCase();

    try {
        console.log(`🎬 Новый запрос (Movies): ${mood} + ${userType} (кофе: ${coffee})`);

        if (cache.has(cacheKey)) {
            console.log("📦 Взято из кэша (Movies)");
            return res.json(cache.get(cacheKey));
        }

        const searchPrompt = `You are a movie recommendation expert. Analyze the user's profile and generate TMDB search queries.

USER PROFILE:
- Mood/State: "${mood}"
- Age Group: "${userType}"
- Coffee preference (minor factor): "${coffee}"

TASK:
Based PRIMARILY on mood and age, generate 3 search queries for TMDB API.
Each query should be EITHER:
1. A TMDB genre name (Action, Drama, Comedy, Thriller, Romance, Horror, Adventure, Science Fiction, Mystery, Fantasy, Animation, Documentary)
2. A specific keyword or theme

IMPORTANT:
- Prioritize mood and age group over coffee
- For "tired, cozy" → suggest Drama, Romance, Family films
- For "energetic, adventures" → suggest Action, Adventure, Thriller
- For "mysterious" → suggest Mystery, Thriller, Crime
- For teenagers → avoid adult themes, suggest Adventure, Animation, Fantasy
- For students → suggest thought-provoking Drama, Sci-Fi, Documentary
- For adults → any genre is acceptable

Return JSON: 
{
  "queries": ["Genre1 or keyword1", "Genre2 or keyword2", "Genre3 or keyword3"],
  "vibe_logic": "Brief explanation in English why these movies match the mood and age"
}`;

        const aiSearchRaw = await callAI(searchPrompt, true);
        let searchData;

        try {
            searchData = JSON.parse(cleanJSON(aiSearchRaw));
        } catch (e) {
            console.warn("⚠️ Ошибка парсинга поиска, применяю fallback");
            
            let fallbackQueries = ["Drama"];
            if (mood.includes("energetic") || mood.includes("adventure")) {
                fallbackQueries = ["Action", "Adventure", "Thriller"];
            } else if (mood.includes("tired") || mood.includes("cozy")) {
                fallbackQueries = ["Drama", "Romance", "Comedy"];
            } else if (mood.includes("mysterious")) {
                fallbackQueries = ["Mystery", "Thriller", "Crime"];
            } else if (mood.includes("motivation")) {
                fallbackQueries = ["Drama", "inspirational", "underdog"];
            }
            
            searchData = { 
                queries: fallbackQueries, 
                vibe_logic: "Movies matching your mood and age..." 
            };
        }

        const queries = searchData.queries || ["Drama"];
        const vibe_logic = searchData.vibe_logic || "Movies for your mood...";

        console.log(`🔎 Ищу фильмы по запросам: ${queries.join(", ")}`);
        const movies = await searchMovies(queries, userType);

        if (movies.length === 0) {
            return res.json({ 
                movies: [], 
                meta: { vibe_logic: "No movies found. Try different mood/age settings." } 
            });
        }

        const formattedMovies = movies.map(m => ({
            id: m.id,
            title: m.title,
            overview: (m.overview || "No description available").substring(0, 200) + "...",
            poster: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : "",
            rating: m.vote_average || 0,
            releaseDate: m.release_date || "N/A"
        }));

        let finalResponse;
        
        if (lang !== 'en') {
            const targetLang = lang === 'kz' ? 'Kazakh' : 'Russian';
            const translationPrompt = `Translate the following movie information to ${targetLang}. Keep it natural and engaging.

Vibe explanation: "${vibe_logic}"

Movies:
${formattedMovies.map(m => `ID:${m.id} | Title:"${m.title}" | Overview:"${m.overview}"`).join("\n")}

Return JSON:
{
  "translated_vibe": "translated vibe explanation",
  "translated_movies": [
    {"id": "movie_id", "title": "translated title", "overview": "translated overview"},
    ...
  ]
}`;

            try {
                const aiTransRaw = await callAI(translationPrompt, true);
                const transData = JSON.parse(cleanJSON(aiTransRaw));

                finalResponse = {
                    meta: { vibe_logic: transData.translated_vibe || vibe_logic },
                    movies: formattedMovies.map(m => {
                        const trans = transData.translated_movies?.find(tm => tm.id == m.id);
                        return { 
                            ...m, 
                            title: trans?.title || m.title, 
                            overview: trans?.overview || m.overview 
                        };
                    })
                };
            } catch (transErr) {
                console.warn("⚠️ Ошибка перевода, отдаю оригинал:", transErr.message);
                finalResponse = { movies: formattedMovies, meta: { vibe_logic } };
            }
        } else {
            finalResponse = { movies: formattedMovies, meta: { vibe_logic } };
        }

        if (cache.size > 100) cache.clear();
        cache.set(cacheKey, finalResponse);

        res.json(finalResponse);

    } catch (err) {
        console.error("🔥 Error (Movies):", err);
        res.status(500).json({ error: "Server Error", details: err.message });
    }
}));

export default router;