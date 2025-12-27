import { provider } from "./provider.js";
import { core } from "./core.js";

export const createGuard = (category) => {
    return async (req, res, next) => {
        const key = req.headers["x-access-key"];
        if (!key) return res.status(401).json({ error: "Access key missing" });

        try {
            const ticket = await provider.findTicket(key);
            const access = core.checkAccess(ticket, category);

            if (!access.ok) {
                return res.status(403).json({ error: access.error });
            }

            // Прокидываем данные дальше, чтобы ИИ знал остаток
            req.gatekeeper = { key, category, remaining: access.remaining };
            next();
        } catch (err) {
            res.status(500).json({ error: "Gatekeeper error" });
        }
    };
};