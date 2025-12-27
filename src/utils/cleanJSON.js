export function cleanJSON(text) {
    if (!text) return "{}";

    try {
        // 1. Убираем теги <think>...</think> от DeepSeek
        let cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "");
        
        // 2. Убираем markdown блоки кода
        cleaned = cleaned.replace(/```json\s*/g, "").replace(/```\s*/g, "");
        
        // 3. Находим первую { или [ и последнюю } или ]
        const firstBrace = cleaned.search(/[\{\[]/);
        const lastBrace = Math.max(
            cleaned.lastIndexOf('}'),
            cleaned.lastIndexOf(']')
        );
        
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            cleaned = cleaned.substring(firstBrace, lastBrace + 1);
        }
        
        // 4. Убираем невидимые символы
        cleaned = cleaned.replace(/[\u0000-\u001F\u007F-\u009F]/g, "").trim();
        
        return cleaned;
        
    } catch (e) {
        console.error("⚠️ cleanJSON error:", e);
        return text;
    }
}