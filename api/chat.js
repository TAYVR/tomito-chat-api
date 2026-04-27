export default async function handler(req, res) {
    // 1. Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // 2. Handle preflight (OPTIONS)
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 3. Ensure the request is POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // 4. Read the message from the Body
    const { message } = req.body;
    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }

    const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
    const GROQ_KEY = process.env.GROQ_API_KEY;

    const systemPrompt = "You are a movie assistant for Tomito. Keep answers EXTREMELY SHORT (1-2 sentences). Wrap movie/TV titles in double asterisks: **Title**. Use Darija/Arabic if the user speaks it.";

    const isShortQuery = message.length < 150;
    let reply = null;
    let usedModel = null;

    // --- STRATEGY 1: TRY GROQ FOR SHORT QUERIES ---
    if (isShortQuery && GROQ_KEY) {
        try {
            console.log("Routing to Groq (Short Query)...");
            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${GROQ_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    "model": "llama-3.1-70b-versatile",
                    "messages": [
                        { "role": "system", "content": systemPrompt },
                        { "role": "user", "content": message }
                    ],
                    "temperature": 0.7,
                    "max_tokens": 150
                })
            });

            const data = await response.json();
            if (data.choices?.[0]?.message) {
                reply = data.choices[0].message.content;
                usedModel = "groq/llama-3.1";
            }
        } catch (error) {
            console.error("Groq failed, will fallback to OpenRouter:", error);
        }
    }

    // --- STRATEGY 2: TRY OPENROUTER (FOR LONG QUERIES OR GROQ FALLBACK) ---
    if (!reply && OPENROUTER_KEY) {
        console.log("Routing to OpenRouter...");
        const models = isShortQuery
            ? ['google/gemma-2-9b-it:free', 'meta-llama/llama-3.1-8b-instruct:free'] // Fast models for short fallback
            : ['google/gemma-2-27b-it:free', 'mistralai/mistral-large-2407', 'anthropic/claude-3-haiku']; // Smarter models for long queries

        for (const model of models) {
            try {
                console.log(`Trying OpenRouter model: ${model}`);
                const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${OPENROUTER_KEY}`,
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://tomito-assistant.vercel.app",
                        "X-Title": "Tomito Movie Assistant",
                    },
                    body: JSON.stringify({
                        "model": model,
                        "messages": [
                            { "role": "system", "content": systemPrompt },
                            { "role": "user", "content": message }
                        ],
                    })
                });

                const data = await response.json();
                if (data.choices?.[0]?.message) {
                    reply = data.choices[0].message.content;
                    usedModel = model;
                    break;
                }
            } catch (error) {
                console.error(`OpenRouter model ${model} failed:`, error);
            }
        }
    }

    if (reply) {
        return res.status(200).json({ reply, model: usedModel });
    }

    return res.status(500).json({ error: 'No models available or API keys missing' });
}
