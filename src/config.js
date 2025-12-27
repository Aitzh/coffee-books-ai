import "dotenv/config";

export const config = {
    port: process.env.PORT || 3000,
    
    googleBooks: {
        key: process.env.GOOGLE_BOOKS_API_KEY?.trim()
    },

    openRouter: {
        key: process.env.OPENROUTER_API_KEY?.trim(),
        model: "tngtech/deepseek-r1t2-chimera:free"
    },

    tmdb: {
        key: process.env.TMDB_API_KEY?.trim()
    },

    spotify: {
        clientId: process.env.SPOTIFY_CLIENT_ID?.trim(),
        clientSecret: process.env.SPOTIFY_CLIENT_SECRET?.trim()
    }
};

// Проверка наличия ключей
if (!config.googleBooks.key) {
    console.warn("⚠️ GOOGLE_BOOKS_API_KEY not found in .env");
}

if (!config.openRouter.key) {
    console.warn("⚠️ OPENROUTER_API_KEY not found in .env");
}

if (!config.tmdb.key) {
    console.warn("⚠️ TMDB_API_KEY not found in .env");
}

if (!config.spotify.clientId || !config.spotify.clientSecret) {
    console.warn("⚠️ SPOTIFY credentials not found in .env");
}