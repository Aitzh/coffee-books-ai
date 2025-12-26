import fetch from "node-fetch";
import { config } from "../config.js";

// Увеличиваем дефолтный таймаут до 30 секунд
async function fetchWithTimeout(url, options, timeout = 30000) { 
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (e) {
        clearTimeout(id);
        if (e.name === 'AbortError') {
            throw new Error("AI response took too long (Timeout)");
        }
        throw e;
    }
}

export async function callAI(prompt, isJson = true) {
    const instruction = isJson ? "\nReturn ONLY valid minified JSON." : "";
    
    // --- ПЕРВАЯ ПОПЫТКА: GEMINI ---
    try {
        console.log("--- Sending request to Gemini ---");
        const res = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${config.gemini.model}:generateContent?key=${config.gemini.key}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                contents: [{ parts: [{ text: prompt + instruction }] }],
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                ]
            })
        });

        const data = await res.json();
        
        if (data.error) {
            console.error("❌ Gemini API Error:", data.error.message);
            throw new Error(`Gemini API Error: ${data.error.message}`);
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!text) {
            const reason = data.candidates?.[0]?.finishReason;
            console.warn("⚠️ Gemini returned no text. Reason:", reason || "Unknown");
            throw new Error("Gemini Empty Response");
        }
        
        return text;

    } catch (err) {
        // --- ЗАПАСНОЙ ВАРИАНТ: GROQ ---
        console.log(`⚠️ Gemini fallback triggered: ${err.message}. Trying Groq...`);
        
        try {
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

            if (!content) {
                throw new Error("Groq returned no content");
            }
            
            return content;

        } catch (groqErr) {
            console.error("❌ Both AI services failed.");
            throw new Error(`All AI providers failed: ${groqErr.message}`);
        }
    }
}