export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    const API_KEY = process.env.OPENROUTER_API_KEY;
    if (!API_KEY) return res.status(500).json({ error: 'OPENROUTER_API_KEY not set' });

    // FAST FREE MODELS FIRST
    const models = [
        'google/gemma-2-9b-it:free',
        'meta-llama/llama-3.1-8b-instruct:free',
        'mistralai/mistral-7b-instruct:free',
        'google/gemma-2-27b-it:free',
        'qwen/qwen-2-7b-instruct:free',
        'microsoft/phi-3-mini-128k-instruct:free'
    ];

    for (const model of models) {
        try {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${API_KEY}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://tomito-assistant.vercel.app",
                    "X-Title": "Tomito Movie Assistant",
                },
                body: JSON.stringify({
                    "model": model,
                    "messages": [
                        {
                            "role": "system",
                            "content": "Tomito Movie Assistant. Short responses (1 sentence). Wrap movie titles in **Title**. Speak Darija/Arabic or french or english."
                        },
                        { "role": "user", "content": message }
                    ],
                })
            });

            const data = await response.json();
            if (data.choices?.[0]?.message) {
                return res.status(200).json({ reply: data.choices[0].message.content, model });
            }
        } catch (error) {
            console.error(`Error with ${model}:`, error);
        }
    }

    return res.status(500).json({ error: 'All models failed' });
}
