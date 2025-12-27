import express from "express";
import { callAI } from "../ai/client.js";
import { searchMusic } from "../services/spotify.js";
import { cleanJSON } from "../utils/cleanJSON.js";
import { cache } from "../utils/cache.js";
import { gatekeeper } from "../access-system/index.js";

const router = express.Router();
const CATEGORY = "music";

router.post("/", gatekeeper.wrap(CATEGORY, async (req, res) => {
    const { genre, period, context, lang } = req.body;
    
    const cacheKey = `music-${genre}-${period}-${context}-${lang}`.toLowerCase();

    try {
        console.log(`🎵 Новый запрос (Music): genre=${genre}, period=${period}, context=${context}`);

        if (cache.has(cacheKey)) {
            console.log("📦 Взято из кэша (Music)");
            return res.json(cache.get(cacheKey));
        }

        // Определяем energy на основе context
        let energy = "medium";
        if (context === "party" || context === "focus") energy = "high";
        else if (context === "late_night" || context === "chill") energy = "low";

        const vibePrompt = `You are a music curator. Create a brief, engaging explanation (1-2 sentences) about why this music selection fits the user's request.

SELECTION PARAMETERS:
- Genre: ${genre}
- Period: ${period}
- Context: ${context}
- Energy: ${energy}

Create a natural explanation that connects these elements. Be creative and insightful.

Return JSON:
{
  "vibe_logic": "your explanation in English"
}`;

        const aiVibeRaw = await callAI(vibePrompt, true);
        let vibe_logic = "Perfect music selection for your mood...";

        try {
            const vibeData = JSON.parse(cleanJSON(aiVibeRaw));
            vibe_logic = vibeData.vibe_logic || vibe_logic;
        } catch (e) {
            console.warn("⚠️ Ошибка парсинга vibe, использую fallback");
        }

        console.log(`🔎 Ищу музыку: genre=${genre}, period=${period}, context=${context}, energy=${energy}`);
        
        const tracks = await searchMusic(
            { 
                genres: [genre], 
                period: period === "all" ? null : period, 
                context, 
                energy, 
                source: "mixed" 
            },
            "adult"
        );

        if (tracks.length === 0) {
            return res.json({ 
                tracks: [], 
                meta: { vibe_logic: "No tracks found. Try different settings." } 
            });
        }

        const formattedTracks = tracks.map(t => {
            const durationMinutes = Math.floor(t.duration_ms / 60000);
            const durationSeconds = Math.floor((t.duration_ms % 60000) / 1000);
            const durationFormatted = `${durationMinutes}:${durationSeconds.toString().padStart(2, '0')}`;
            
            const releaseYear = t.album.release_date ? new Date(t.album.release_date).getFullYear() : 'N/A';
            
            const coverImage = t.album.images?.[0]?.url || 
                              t.album.images?.[1]?.url || 
                              t.album.images?.[2]?.url || 
                              'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400';
            
            return {
                id: t.id,
                title: t.name,
                artist: t.artists.map(a => a.name).join(", "),
                album: t.album.name,
                cover: coverImage,
                preview_url: t.preview_url || null,
                spotify_url: t.external_urls.spotify,
                duration_ms: t.duration_ms,
                duration_formatted: durationFormatted,
                explicit: t.explicit,
                popularity: t.popularity || 0,
                release_year: releaseYear,
                album_type: t.album.album_type,
                genre: genre,
                period: period,
                context: context
            };
        });

        let finalResponse;
        
        if (lang !== 'en') {
            const targetLang = lang === 'kz' ? 'Kazakh' : 'Russian';
            const translationPrompt = `Translate the following music vibe explanation to ${targetLang}. Keep it natural and engaging.

Original: "${vibe_logic}"

Return JSON:
{
  "translated_vibe": "translated text"
}`;

            try {
                const aiTransRaw = await callAI(translationPrompt, true);
                const transData = JSON.parse(cleanJSON(aiTransRaw));

                finalResponse = {
                    meta: { vibe_logic: transData.translated_vibe || vibe_logic },
                    tracks: formattedTracks
                };
            } catch (transErr) {
                console.warn("⚠️ Ошибка перевода, отдаю оригинал");
                finalResponse = { tracks: formattedTracks, meta: { vibe_logic } };
            }
        } else {
            finalResponse = { tracks: formattedTracks, meta: { vibe_logic } };
        }

        if (cache.size > 100) cache.clear();
        cache.set(cacheKey, finalResponse);

        res.json(finalResponse);

    } catch (err) {
        console.error("🔥 Error (Music):", err);
        res.status(500).json({ error: "Server Error", details: err.message });
    }
}));

export default router;