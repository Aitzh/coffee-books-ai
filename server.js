import express from "express";
import { config } from "./src/config.js";
import recommendBooksRouter from "./src/routes/recommendBooks.js";
import recommendMoviesRouter from "./src/routes/recommendMovies.js";
import recommendMusicRouter from "./src/routes/recommendMusic.js";

const app = express();

app.use(express.json());
app.use(express.static("public"));

// Routes
app.use("/recommend/books", recommendBooksRouter);
app.use("/recommend/movies", recommendMoviesRouter);
app.use("/recommend/music", recommendMusicRouter);

app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(config.port, () => {
    console.log(`🚀 Server running on http://localhost:${config.port}`);
    console.log(`📚 Using model: ${config.openRouter.model}`);
});