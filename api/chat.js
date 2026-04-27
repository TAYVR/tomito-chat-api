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

    const TMDB_KEY = process.env.TMDB_API_KEY || "882e741f7283dc9ba1654d4692ec30f6";

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
                            "content": "You are a movie assistant for Tomito. Your goal is to help users find movies and TV shows. Keep your answers EXTREMELY SHORT and direct (max 2-3 sentences). When suggesting a movie or show, wrap the title in double asterisks like this: **Movie Title**. AI will automatically generate the correct links for you later."
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
                let reply = data.choices[0].message.content;

                // --- DYNAMIC ENRICHMENT ---
                try {
                    // Find all bolded titles: **Title**
                    const boldRegex = /\*\*(.*?)\*\*/g;
                    const matches = [...reply.matchAll(boldRegex)];
                    const seen = new Set();

                    for (const match of matches) {
                        const title = match[1];
                        if (seen.has(title)) continue;
                        seen.add(title);

                        const searchRes = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_KEY}&query=${encodeURIComponent(title)}&language=en-US`);
                        const searchData = await searchRes.json();

                        if (searchData.results && searchData.results.length > 0) {
                            const result = searchData.results[0];
                            if (result.media_type === 'movie' || result.media_type === 'tv') {
                                const type = result.media_type;
                                const id = result.id;
                                const originalTitle = result.title || result.name;
                                const slug = originalTitle.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
                                const correctUrl = `https://tv.tomito.xyz/${type}/${id}-${slug}`;

                                // Replace all occurrences of the bolded title with a markdown link
                                reply = reply.split(match[0]).join(`[${originalTitle}](${correctUrl})`);
                            }
                        }
                    }
                } catch (enrichError) {
                    console.error("Enrichment failed:", enrichError);
                }

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
