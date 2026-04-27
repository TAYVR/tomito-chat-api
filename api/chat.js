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

    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
    }

    const models = [
        'gemini-2.0-flash',
        'gemini-1.5-flash-latest',
        'gemini-1.5-pro-latest',
        'gemini-1.5-flash'
    ];
    let lastError = null;

    for (const model of models) {
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: `You are a movie assistant for Tomito. Answer this: ${message}` }] }]
                })
            });

            const data = await response.json();

            // Check for Google API Error
            if (data.error) {
                console.warn(`Model ${model} failed:`, data.error.message);
                lastError = data.error;

                // If it's a quota error (429) OR model not found (404), try next model
                if (data.error.code === 429 || data.error.code === 404) continue;

                // For other errors, try fallback anyway
                if (data.error.code >= 500) continue;

                return res.status(data.error.code || 500).json({ error: "Google API Error", details: data.error });
            }

            // Check Structure
            if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                const reply = data.candidates[0].content.parts[0].text;
                return res.status(200).json({ reply, model }); // Include model name for debugging
            } else {
                lastError = { message: 'Unexpected JSON Structure', data };
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
        error: 'All AI models failed or exceeded quota',
        details: lastError
    });
}
