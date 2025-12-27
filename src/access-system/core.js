export const core = {
    generateKey(prefix = "GK") {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        const code = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
        const date = new Date().toISOString().slice(2, 10).replace(/-/g, "");
        return `${prefix}-${code}-${date}`;
    },

    checkAccess(ticket, category) {
        if (!ticket) return { error: "Билет не найден" };
        if (ticket.status !== "active") return { error: "Билет заблокирован" };
        if (!(category in ticket.limits)) return { error: `Категория ${category} не куплена` };

        const remaining = ticket.limits[category] - (ticket.used[category] || 0);
        if (remaining <= 0) return { error: `Лимит ${category} исчерпан` };

        return { ok: true, remaining };
    }
};