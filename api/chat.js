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

    const API_KEY = process.env.OPENROUTER_API_KEY;
    if (!API_KEY) {
        return res.status(500).json({ error: 'OPENROUTER_API_KEY is not configured' });
    }

    const models = [
        'nvidia/nemotron-3-super-120b-a12b:free',
        'tencent/hy3-preview:free',
        'inclusionai/ling-2.6-1t:free',
        'inclusionai/ling-2.6-flash:free',
        'minimax/minimax-m2.5:free',
        'openai/gpt-oss-120b:free',
        'nvidia/nemotron-3-nano-30b-a3b:free',
        'google/gemma-4-31b-it:free',
        'nvidia/nemotron-nano-9b-v2:free',
        'google/gemma-4-26b-a4b-it:free',
        'nvidia/llama-nemotron-embed-vl-1b-v2:free',
        'liquid/lfm-2.5-1.2b-thinking:free'
    ];

    let lastError = null;

    for (const model of models) {
        try {
            console.log(`Trying model: ${model}`);
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
                            "content": "You are a movie assistant for Tomito. Your goal is to help users find movies and TV shows. Keep your answers EXTREMELY SHORT and direct (max 2-3 sentences) to save time and tokens. Provide links in this format: [Title](https://tomito.xyz/movie/ID-slug). For TV shows, use: [Title](https://tomito.xyz/tv/ID-slug). Answer in Darija/Arabic if the user speaks it, but keep links in English/TMDB format."
                        },
                        {
                            "role": "user",
                            "content": message
                        }
                    ],
                })
            });

            const data = await response.json();

            if (data.error) {
                console.warn(`Model ${model} failed:`, data.error.message || data.error);
                lastError = data.error;
                continue;
            }

            if (data.choices && data.choices[0] && data.choices[0].message) {
                const reply = data.choices[0].message.content;
                return res.status(200).json({ reply, model });
            } else {
                lastError = { message: 'Unexpected API response structure', data };
                continue;
            }

        } catch (error) {
            console.error(`Catch Error with ${model}:`, error);
            lastError = error;
            continue;
        }
    }

    return res.status(500).json({
        error: 'All OpenRouter models failed',
        details: lastError
    });
}
