import fetch from "node-fetch";
import { config } from "../config.js";

export async function searchBooks(queries, userType) {
    let rawBooks = [];
    
    for (const q of queries) {
        const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=5&key=${config.googleBooks.key}&langRestrict=en`;
        
        try {
            const res = await fetch(url);
            const data = await res.json();
            
            if (data.items) {
                rawBooks.push(...data.items);
            }
        } catch (e) {
            console.error(`❌ Search error for "${q}":`, e.message);
        }
    }

    // Удаляем дубликаты по ID
    const uniqueBooks = Array.from(
        new Map(rawBooks.map(item => [item.id, item])).values()
    );

    // Фильтруем книги
    const filtered = uniqueBooks
        .filter(b => b.volumeInfo?.imageLinks?.thumbnail) // Только с обложками
        .filter(b => {
            const cats = (b.volumeInfo.categories || []).map(c => c.toLowerCase());
            
            // Если взрослый/студент — убираем детские книги
            if (userType.includes("adult") || userType.includes("student")) {
                return !cats.some(c => 
                    c.includes("juvenile") || 
                    c.includes("children") || 
                    c.includes("kids")
                );
            }
            return true;
        });

    return filtered.slice(0, 4);
}