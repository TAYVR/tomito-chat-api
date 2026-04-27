export default async function handler(req, res) {
    // 1. التأكد أن الطلب هو POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // 2. قراءة الميساج من الـ Body
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
                    "HTTP-Referer": "https://tomito-assistant.vercel.app", // Optional site URL
                    "X-Title": "Tomito Movie Assistant", // Optional site name
                },
                body: JSON.stringify({
                    "model": model,
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are a movie assistant for Tomito."
                        },
                        {
                            "role": "user",
                            "content": message
                        }
                    ],
                })
            });

            const data = await response.json();

            // Check for OpenRouter error
            if (data.error) {
                console.warn(`Model ${model} failed:`, data.error.message || data.error);
                lastError = data.error;
                continue; // Try next model on any error (quota, 404, etc.)
            }

            // Parse response (OpenAI format)
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

    // If we get here, all models failed
    return res.status(500).json({
        error: 'All OpenRouter models failed',
        details: lastError
    });
}
