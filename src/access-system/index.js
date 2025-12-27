import { provider } from "./provider.js";
import { core } from "./core.js";
import { createGuard } from "./guard.js";
import { withGatekeeper } from "./withGatekeeper.js";

export const gatekeeper = {
    // Инициализация системы (подключение к базе)
    async start({ uri, dbName }) {
        await provider.init({ uri, dbName });
    },

    // Создание билета (Логика, которую мы прописывали)
    async issueTicket({ limits, days = 1 }) {
        const key = core.generateKey(); // Генерируем ключ типа GK-XXXXX-YYMMDD
        
        const ticket = {
            key,
            status: "active",
            limits,
            // Создаем объект использованных попыток, заполняя нулями
            used: Object.keys(limits).reduce((acc, cat) => ({ ...acc, [cat]: 0 }), {}),
            createdAt: new Date(),
            // Рассчитываем дату истечения
            expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000)
        };

        await provider.createTicket(ticket);
        
        // ОБЯЗАТЕЛЬНО возвращаем ключ, чтобы админка его увидела
        return key; 
    },

    // Списание (атомарное)
    async consume(key, category) {
        return await provider.atomicConsume(key, category);
    },

    // Защитник роута (Middleware)
    guard: createGuard,

    // Умная обертка для роутов
    wrap: withGatekeeper
};