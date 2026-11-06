// Deep check — look for actual import errors in transformed modules
const modules = [
  '/src/main.tsx',
  '/src/App.tsx',
  '/src/components/layout/AppLayout.tsx',
  '/src/components/auth/AuthProvider.tsx',
  '/src/components/auth/AuthModal.tsx',
  '/src/store/appStore.ts',
  '/src/store/authStore.ts',
  '/src/hooks/useConversations.ts',
  '/src/hooks/useChat.ts',
  '/src/components/sidebar/Sidebar.tsx',
  '/src/components/layout/TopHeader.tsx',
  '/src/pages/HomeScreen.tsx',
  '/src/components/composer/Composer.tsx',
];

for (const mod of modules) {
  try {
    const mr = await fetch(`http://localhost:3001${mod}`);
    if (mr.status !== 200) {
      console.log(`❌ MISSING: ${mod} -> HTTP ${mr.status}`);
    } else {
      console.log(`✅ ${mod}`);
    }
  } catch (e) {
    console.log(`❌ ERROR: ${mod} -> ${e.message}`);
  }
}

// Check for any 500 errors on the server-side transforms
console.log('\n--- Checking for server-side transform errors ---');
const r = await fetch('http://localhost:3001/src/components/layout/AppLayout.tsx');
const text = await r.text();
// Look for Vite error overlays or transform errors
const hasTransformError = text.includes('__vite__') === false;
console.log('Transform error:', hasTransformError ? 'YES - might be broken' : 'No');
console.log('First 500 chars:', text.substring(0, 500));
