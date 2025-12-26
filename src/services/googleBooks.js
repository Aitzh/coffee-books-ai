import fetch from "node-fetch";
import { config } from "../config.js";

export async function searchBooks(queries, userType) {
    let rawBooks = [];
    
    for (const q of queries) {
        const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=5&key=${config.googleBooks.key}`;
        try {
            const res = await fetch(url).then(r => r.json());
            if (res.items) rawBooks.push(...res.items);
        } catch (e) {
            console.error(`Search error for ${q}:`, e.message);
        }
    }

    // Умная пост-фильтрация по категориям
    return Array.from(new Map(rawBooks.map(item => [item.id, item])).values())
        .filter(b => b.volumeInfo?.imageLinks?.thumbnail)
        .filter(b => {
            const cats = (b.volumeInfo.categories || []).map(c => c.toLowerCase());
            // Если взрослый/студент — убираем детское
            if (userType.includes("adult") || userType.includes("student")) {
                return !cats.some(c => c.includes("juvenile") || c.includes("children"));
            }
            return true;
        })
        .slice(0, 4);
}