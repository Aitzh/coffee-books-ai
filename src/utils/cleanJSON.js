export function cleanJSON(text) {
    if (!text) return "";
    // Убираем маркдаун и невидимые символы, которые мешают парсингу
    return text.replace(/```json|```|[\u0000-\u001F\u007F-\u009F]/g, "").trim();
}