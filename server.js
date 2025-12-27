import express from "express";
import "dotenv/config"; // 1. Загрузка ключей из .env
import { config } from "./src/config.js";
import { gatekeeper } from "./src/access-system/index.js"; // 2. Наш модуль доступа

// Твои роутеры (импортируем один раз)
import recommendBooksRouter from "./src/routes/recommendBooks.js";
import recommendMoviesRouter from "./src/routes/recommendMovies.js";
import recommendMusicRouter from "./src/routes/recommendMusic.js";

const app = express();

app.use(express.json());
app.use(express.static("public"));

// --- 🛡️ ЗАЩИЩЕННЫЕ РОУТЫ ---
// Мы ставим Guard ПЕРЕД роутером. Теперь никто не пройдет без билета.
app.use("/recommend/books", gatekeeper.guard("books"), recommendBooksRouter);
app.use("/recommend/movies", gatekeeper.guard("movies"), recommendMoviesRouter);
app.use("/recommend/music", gatekeeper.guard("music"), recommendMusicRouter);

// --- 🎫 АДМИН-ПАНЕЛЬ (В ОДНОМ ЭКЗЕМПЛЯРЕ) ---
app.get("/admin/issue-ticket", async (req, res) => {
    const { secret, books, music, movies, days } = req.query;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const timestamp = new Date().toLocaleString("ru-RU");

    // Проверка секрета из .env
    if (secret !== process.env.ADMIN_SECRET) {
        console.warn(`⚠️ [${timestamp}] Попытка взлома админки с IP: ${ip}`);
        return res.status(401).send("⛔ Доступ запрещен. Неверный пароль.");
    }

    try {
        const key = await gatekeeper.issueTicket({
            limits: {
                books: parseInt(books) || 5,
                music: parseInt(music) || 0,
                movies: parseInt(movies) || 0
            },
            days: parseInt(days) || 1
        });

        console.log(`--- 🎫 НОВЫЙ БИЛЕТ: ${key} (B:${books || 5}) ---`);

        res.send(`
            <div style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h2 style="color: #2c3e50;">🎫 Билет успешно создан!</h2>
                <div style="font-size: 2.5em; background: #ecf0f1; padding: 25px; display: inline-block; border-radius: 15px; border: 2px dashed #bdc3c7;">
                    <code>${key}</code>
                </div>
                <p style="margin-top: 20px;">Отправь этот код клиенту.</p>
                <p><small>Действителен: ${days || 1} день</small></p>
            </div>
        `);
    } catch (err) {
        console.error("❌ Ошибка админки:", err.message);
        res.status(500).send("Ошибка при создании билета: " + err.message);
    }
});
// server.js

// Роут для проверки остатка (без списания)
// Мы используем guard("books"), чтобы проверить хотя бы одну категорию
app.get("/access/status", gatekeeper.guard("books"), (req, res) => {
    // Если guard пропустил, значит билет валиден
    // Мы просто отдаем то, что guard нашел в базе
    res.json({
        remaining: req.gatekeeper.remaining, // остаток, который нашел guard
        key: req.gatekeeper.key
    });
});
app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// --- 🚀 ЗАПУСК СИСТЕМЫ ---
async function start() {
    try {
        // Сначала подключаем базу данных
        await gatekeeper.start({ 
            uri: process.env.GATEKEEPER_DB_URI,
            dbName: "coffee-books-ai" 
        });
        
        // Только потом включаем сервер
        app.listen(config.port, () => {
            console.log(`🚀 Сервер запущен: http://localhost:${config.port}`);
            console.log(`🔑 Админка доступна по секретной ссылке`);
        });
    } catch (err) {
        console.error("💥 Критическая ошибка при старте:", err.message);
        process.exit(1);
    }
}

start();