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

    try {
        // 3. التواصل مع Gemini
        // بدل هاد السطر:
        // const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {

        // بهذا السطر (استعمل gemini-1.5-flash-latest):
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `You are a movie assistant for Tomito. Answer this: ${message}` }] }]
            })
        });

        const data = await response.json();

        // 4. إرسال الجواب مع التحقق من وجود بيانات
        if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
            const reply = data.candidates[0].content.parts[0].text;
            res.status(200).json({ reply });
        } else {
            console.error('Gemini API Error:', data);
            res.status(500).json({ error: 'Invalid response from AI' });
        }

    } catch (error) {
        console.error('Chat API Error:', error);
        res.status(500).json({ error: 'Failed to connect to AI' });
    }
}
