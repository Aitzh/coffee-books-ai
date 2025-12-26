import fetch from "node-fetch";
import { config } from "../config.js";

async function fetchWithTimeout(url, options, timeout = 12000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (e) {
        clearTimeout(id);
        throw e;
    }
}

export async function callAI(prompt, isJson = true) {
    const instruction = isJson ? "\nReturn ONLY valid minified JSON." : "";
    
    try {
        // --- Пытаемся вызвать Gemini ---
        const res = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${config.gemini.model}:generateContent?key=${config.gemini.key}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt + instruction }] }] })
        });
        
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!text) throw new Error("Gemini Empty");
        return text;

    } catch (err) {
        console.log(`⚠️ Gemini fail: ${err.message}. To Groq...`);
        
        // --- Fallback на Groq ---
        const res = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { 
                "Authorization": `Bearer ${config.groq.key}`, 
                "Content-Type": "application/json" 
            },
            body: JSON.stringify({
                model: config.groq.model,
                messages: [{ role: "user", content: prompt + instruction }],
                response_format: isJson ? { type: "json_object" } : null
            })
        });

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;

        // ИСПРАВЛЕННЫЙ БЛОК:
        if (!content) {
            throw new Error("Both AI failed: No content in Groq response");
        }
        
        return content;
    }
}