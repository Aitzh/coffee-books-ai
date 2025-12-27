import { MongoClient } from "mongodb";

let ticketsCollection = null;
let client = null;

export const provider = {
    async init({ uri, dbName = "gatekeeper" }) {
        if (!uri) throw new Error("Gatekeeper: URI is required");
        client = new MongoClient(uri);
        await client.connect();
        const db = client.db(dbName);
        ticketsCollection = db.collection("tickets");

        await ticketsCollection.createIndex({ key: 1 }, { unique: true });
        await ticketsCollection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    },

    async findTicket(key) {
        if (!ticketsCollection) throw new Error("Provider not initialized");
        return await ticketsCollection.findOne({ key });
    },

    async atomicConsume(key, category) {
        // Атомарная проверка + списание в один шаг
        const result = await ticketsCollection.findOneAndUpdate(
            { 
                key, 
                status: "active",
                $expr: { $lt: [`$used.${category}`, `$limits.${category}`] }
            },
            { $inc: { [`used.${category}`]: 1 } },
            { returnDocument: "after" }
        );
        return result; 
    },

    // ИСПРАВЛЕНО: параметр совпадает с телом функции
    async createTicket(data) {
        if (!ticketsCollection) throw new Error("Provider not initialized");
        return await ticketsCollection.insertOne(data);
    },

    // НОВОЕ: метод для блокировки/активации (для админки)
    async updateStatus(key, newStatus) {
        return await ticketsCollection.updateOne({ key }, { $set: { status: newStatus } });
    }
};