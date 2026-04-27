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
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    contents: [{ parts: [{ text: `You are a movie assistant for Tomito. Answer this: ${message}` }] }] 
  })
});;

    const data = await response.json();
    
    // هادي أهم خطوة: كنشوفو شنو جاب الـ API قبل ما نحكمو عليه
    console.log("--- GOOGLE API FULL RESPONSE ---");
    console.log(JSON.stringify(data, null, 2));
    console.log("--------------------------------");

    // التحقق من وجود Error من Google مباشرة
    if (data.error) {
       return res.status(500).json({ error: "Google API Error", details: data.error });
    }

    // التحقق من الـ Structure
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      const reply = data.candidates[0].content.parts[0].text;
      return res.status(200).json({ reply });
    } else {
      return res.status(500).json({ error: 'Unexpected JSON Structure', data: data });
    }
    
  } catch (error) {
    console.error('Catch Error:', error);
    return res.status(500).json({ error: 'Failed to connect to AI' });
  }
}
