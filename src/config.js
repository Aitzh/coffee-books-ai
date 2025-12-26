import "dotenv/config";

export const config = {
    port: process.env.PORT || 3000,
    gemini: {
        key: process.env.GEMINI_API_KEY?.trim(),
        model: "gemini-2.0-flash-lite" // Вижу, ты обновился на 2.0, круто!
    },
    groq: {
        key: process.env.GROQ_API_KEY?.trim(),
        model: "llama-3.3-70b-versatile"
    },
    googleBooks: {
        key: process.env.GOOGLE_BOOKS_API_KEY?.trim()
    }
};