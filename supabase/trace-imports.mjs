// Trace the import chain to find what causes the blank page
// We do this by fetching each module and looking for dynamic import errors

const BASE = 'http://localhost:3001';
const seen = new Set();
const errors = [];

async function fetchModule(path) {
  if (seen.has(path)) return;
  seen.add(path);
  
  const r = await fetch(`${BASE}${path}`);
  if (r.status !== 200) {
    errors.push(`HTTP ${r.status}: ${path}`);
    return;
  }
  
  const text = await r.text();
  
  // Check for Vite error markers
  if (text.includes('__vite_error__') || text.includes('createErrorOverlay')) {
    errors.push(`Transform error in: ${path}`);
    console.log(`❌ TRANSFORM ERROR: ${path}`);
    console.log(text.substring(0, 500));
    return;
  }
  
  // Look for failed dynamic imports (404 responses embedded in the module)
  if (text.includes('Failed to fetch') || text.includes('ENOENT')) {
    errors.push(`Import error in: ${path}`);
  }
}

// Manually trace the key files
const keyModules = [
  '/src/main.tsx',
  '/src/App.tsx',
  '/src/components/layout/AppLayout.tsx',
  '/src/components/auth/AuthProvider.tsx',
  '/src/store/authStore.ts',
  '/src/components/sidebar/Sidebar.tsx',
  '/src/components/layout/TopHeader.tsx',
  '/src/hooks/useChat.ts',
  '/src/hooks/useConversations.ts',
  '/src/assets/GabbyLogo.tsx',
  '/src/assets/NovaLogo.tsx',  // Check if old file still being referenced
  '/src/lib/authApi.ts',
];

console.log('Checking modules...\n');
for (const mod of keyModules) {
  const r = await fetch(`${BASE}${mod}`);
  if (r.status === 200) {
    const t = await r.text();
    // Look for specific error patterns in transformed code
    const hasViteError = t.includes('__vite_error__');
    const hasSyntaxError = t.includes('SyntaxError');
    const importsFailed = t.includes('could not resolve') || t.includes('Cannot find module');
    
    if (hasViteError || hasSyntaxError || importsFailed) {
      console.log(`❌ ERROR in ${mod}`);
      console.log('  First 300 chars:', t.substring(0, 300));
    } else {
      console.log(`✅ ${mod}`);
    }
  } else {
    console.log(`❌ ${r.status} ${mod}`);
  }
}

// Check for any 500 errors on critical paths
console.log('\n--- Checking for 500/transform errors ---');
const criticalPaths = [
  '/src/components/composer/Composer.tsx',
  '/src/components/chat/ChatView.tsx',
  '/src/components/chat/MessageBubble.tsx',
  '/src/components/settings/SettingsPanel.tsx',
  '/src/hooks/useTheme.ts',
];

for (const p of criticalPaths) {
  const r = await fetch(`${BASE}${p}`);
  console.log(`${r.status === 200 ? '✅' : '❌'} ${r.status} ${p}`);
}
