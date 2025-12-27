import { gatekeeper } from "./src/access-system/index.js";

// 1. Запуск системы
await gatekeeper.start({ 
    uri: process.env.MONGO_URI, 
    dbName: "coffee-books-ai" 
});

// 2. Защита роута (только для книг)
app.post("/recommend/books", gatekeeper.guard("books"), async (req, res) => {
    // Вызываем ИИ...
    const result = await callAI(req.body);

    // Списываем попытку только при успехе!
    await gatekeeper.consume(req.gatekeeper.key, "books");

    res.json({ result, remaining: req.gatekeeper.remaining - 1 });
});