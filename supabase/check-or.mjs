import dotenv from 'dotenv';
dotenv.config();

const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEYS}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'http://localhost:5173',
  },
  body: JSON.stringify({
    model: 'nvidia/nemotron-3.5-lightning:free',
    messages: [{ role: 'user', content: 'Say OK' }],
    max_tokens: 10,
  }),
});

const d = await r.json();
console.log('Status:', r.status);
console.log('Full response:', JSON.stringify(d, null, 2).substring(0, 800));
