// Live end-to-end test through our own server
async function test(label, model) {
  process.stdout.write(`Testing ${label} (${model})... `);
  try {
    const r = await fetch('http://localhost:3001/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Reply with just: WORKING' }], model }),
    });
    const text = await r.text();
    const lines = text.split('\n').filter(l => l.startsWith('data: ') && l !== 'data: [DONE]');
    const combined = lines.map(l => {
      try { return JSON.parse(l.slice(6)).text ?? ''; } catch { return ''; }
    }).join('');
    if (combined) {
      console.log(`✅  "${combined.trim().substring(0, 40)}"`);
    } else {
      console.log(`⚠️  empty response — raw: ${text.substring(0, 100)}`);
    }
  } catch (e) {
    console.log(`❌  ${e.message}`);
  }
}

console.log('\n=== Gabby AI — Live API Key Tests ===\n');
await test('Groq', 'groq/qwen/qwen3.8-27b');
await test('OpenRouter Nemotron (free)', 'nvidia/nemotron-3.5-lightning:free');
await test('OpenRouter Gemma (free)', 'google/gemma-4-31b-it:free');
console.log('\nDone.\n');
