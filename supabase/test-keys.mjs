import dotenv from 'dotenv';
dotenv.config();

const OR_KEY = process.env.OPENROUTER_API_KEYS;
const GROQ_KEY = process.env.GROQ_API_KEYS;

async function testGroq() {
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'qwen/qwen3.8-27b', messages: [{ role: 'user', content: 'Say OK' }], max_tokens: 5 }),
    });
    const d = await r.json();
    if (d.choices?.[0]?.message?.content) {
      console.log(`✅ GROQ: WORKING — "${d.choices[0].message.content.trim()}" (model: qwen/qwen3.8-27b)`);
    } else {
      console.log(`❌ GROQ: FAILED — ${JSON.stringify(d).substring(0, 120)}`);
    }
  } catch (e) { console.log(`❌ GROQ: ERROR — ${e.message}`); }
}

async function testOpenRouter(model) {
  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OR_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:5173',
        'X-Title': 'Gabby AI',
      },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: 'Say OK' }], max_tokens: 5 }),
    });
    const d = await r.json();
    if (d.choices?.[0]?.message?.content) {
      console.log(`✅ OPENROUTER: WORKING — model: ${model}`);
      return true;
    } else {
      const msg = d.error?.message ?? JSON.stringify(d).substring(0, 100);
      console.log(`❌ OPENROUTER: ${model} — ${msg}`);
      return false;
    }
  } catch (e) { console.log(`❌ OPENROUTER: ERROR — ${e.message}`); return false; }
}

console.log('\n=== Testing Gabby AI API Keys ===\n');
await testGroq();

// Test OpenRouter free models that are actually available now
const freeModels = [
  'nvidia/nemotron-3.5-lightning:free',
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-3.5-super-vl:free',
  'xingchen-agi/xing4.0-29b-a4b:free',
  'google/gemma-4-26b-a4b-it:free',
];

let orWorking = false;
for (const m of freeModels) {
  const ok = await testOpenRouter(m);
  if (ok) { orWorking = true; break; }
}
if (!orWorking) console.log('❌ OPENROUTER: No free models working — key may need credits');

console.log('\n=== Summary ===');
console.log('Groq key:       gsk_cQFy...PJBF');
console.log('OpenRouter key: sk-or-v1...6092');
console.log('');
