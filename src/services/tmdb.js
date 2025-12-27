import fetch from "node-fetch";
import { config } from "../config.js";

// Маппинг жанров TMDB (ID -> название)
const TMDB_GENRES = {
    28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy",
    80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family",
    14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music",
    9648: "Mystery", 10749: "Romance", 878: "Science Fiction",
    10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western"
};

// Обратный маппинг для быстрого поиска ID по названию
const GENRE_NAME_TO_ID = Object.entries(TMDB_GENRES).reduce((acc, [id, name]) => {
    acc[name.toLowerCase()] = id;
    return acc;
}, {});

export async function searchMovies(queries, userType) {
    let rawMovies = [];
    
    // Разбиваем запросы на жанры и ключевые слова
    const genreIds = [];
    const keywords = [];
    
    for (const q of queries) {
        const qLower = q.toLowerCase();
        
        // Проверяем, является ли запрос жанром
        if (GENRE_NAME_TO_ID[qLower]) {
            genreIds.push(GENRE_NAME_TO_ID[qLower]);
        } else {
            keywords.push(q);
        }
    }
    
    console.log(`🎯 Жанры: [${genreIds.join(", ")}], Ключевые слова: [${keywords.join(", ")}]`);
    
    // 1. Поиск по жанрам (discover endpoint - более качественные результаты)
    if (genreIds.length > 0) {
        const genreQuery = genreIds.join(",");
        const url = `https://api.themoviedb.org/3/discover/movie?api_key=${config.tmdb.key}&with_genres=${genreQuery}&language=en-US&sort_by=vote_average.desc&vote_count.gte=100`;
        
        try {
            const res = await fetch(url);
            const data = await res.json();
            
            if (data.results) {
                rawMovies.push(...data.results.slice(0, 8)); // Берем топ-8 по рейтингу
            }
        } catch (e) {
            console.error(`❌ TMDB genre search error:`, e.message);
        }
    }
    
    // 2. Поиск по ключевым словам
    for (const keyword of keywords) {
        const url = `https://api.themoviedb.org/3/search/movie?api_key=${config.tmdb.key}&query=${encodeURIComponent(keyword)}&language=en-US`;
        
        try {
            const res = await fetch(url);
            const data = await res.json();
            
            if (data.results) {
                rawMovies.push(...data.results.slice(0, 5));
            }
        } catch (e) {
            console.error(`❌ TMDB search error for "${keyword}":`, e.message);
        }
    }

    // Удаляем дубликаты
    const uniqueMovies = Array.from(
        new Map(rawMovies.map(item => [item.id, item])).values()
    );

    // Фильтруем и сортируем
    const filtered = uniqueMovies
        .filter(m => m.poster_path) // Только с постерами
        .filter(m => m.vote_average > 0) // Убираем без рейтинга
        .filter(m => m.vote_count > 50) // Хотя бы 50 голосов (популярные фильмы)
        .filter(m => {
            // Возрастная фильтрация
            if (userType.includes("teenager")) {
                return m.adult === false && m.vote_average >= 5.5; // Качественные фильмы для подростков
            } else if (userType.includes("student")) {
                return m.vote_average >= 6.0; // Студенты — более высокий порог
            } else {
                return m.vote_average >= 5.5; // Взрослые — любой контент
            }
        })
        .sort((a, b) => {
            // Сортируем по комбинации рейтинга и популярности
            const scoreA = a.vote_average * Math.log(a.vote_count);
            const scoreB = b.vote_average * Math.log(b.vote_count);
            return scoreB - scoreA;
        });

    return filtered.slice(0, 4);
}