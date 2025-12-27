import fetch from "node-fetch";
import { config } from "../config.js";

export async function callAI(prompt, isJson = true) {
    const instruction = isJson 
        ? "\n\nIMPORTANT: Return ONLY valid minified JSON without any markdown formatting, code blocks, or explanatory text." 
        : "";

    try {
        console.log(`🤖 Calling OpenRouter: ${config.openRouter.model}`);

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${config.openRouter.key}`,
                "HTTP-Referer": "http://localhost:3000",
                "X-Title": "Coffee Books AI"
            },
            body: JSON.stringify({
                model: config.openRouter.model,
                messages: [
                    {
                        role: "user",
                        content: prompt + instruction
                    }
                ]
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenRouter API Error: ${response.status} - ${error}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            console.error("❌ API Response:", JSON.stringify(data));
            throw new Error("OpenRouter returned empty content");
        }

        console.log("✅ AI Response received");
        return content;

    } catch (err) {
        console.error("❌ OpenRouter Error:", err.message);
        throw err;
    }
}