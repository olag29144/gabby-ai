const r = await fetch('http://localhost:3001/');
const t = await r.text();
console.log('Title:', t.match(/<title>(.*?)<\/title>/)?.[1]);
console.log('Has loading msg:', t.includes('Loading Gabby AI'));
console.log('Has error handler:', t.includes('Gabby AI startup error'));
console.log('Has root div:', t.includes('id="root"'));
console.log('Has main.tsx:', t.includes('main.tsx'));
console.log('\nFull HTML:\n', t);
