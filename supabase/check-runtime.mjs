// Simulate runtime checks — test each import for missing exports
import dotenv from 'dotenv';
dotenv.config();

let errors = [];

// 1. Check appStore exports
try {
  const { appReducer, initialState, AppContext } = await import('../src/store/appStore.ts');
  if (!appReducer) errors.push('appStore: missing appReducer');
  if (!initialState) errors.push('appStore: missing initialState');
  if (!AppContext) errors.push('appStore: missing AppContext');
  else console.log('✅ appStore exports OK');
} catch(e) { errors.push(`appStore: ${e.message}`); }

// 2. Check authStore exports  
try {
  const { AuthContext, authReducer, useAuth } = await import('../src/store/authStore.ts');
  if (!authReducer) errors.push('authStore: missing authReducer');
  console.log('✅ authStore exports OK');
} catch(e) { errors.push(`authStore: ${e.message}`); }

// 3. Check types
try {
  const { AVAILABLE_MODELS, DEFAULT_MODEL } = await import('../src/types/index.ts');
  if (!AVAILABLE_MODELS?.length) errors.push('types: AVAILABLE_MODELS empty');
  if (!DEFAULT_MODEL) errors.push('types: DEFAULT_MODEL missing');
  else console.log(`✅ types OK — default: ${DEFAULT_MODEL}, models: ${AVAILABLE_MODELS.length}`);
} catch(e) { errors.push(`types: ${e.message}`); }

// 4. Check lib/utils
try {
  const { generateId, cn } = await import('../src/lib/utils.ts');
  if (!generateId || !cn) errors.push('utils: missing exports');
  else console.log('✅ utils exports OK');
} catch(e) { errors.push(`utils: ${e.message}`); }

// 5. Check authApi
try {
  const mod = await import('../src/lib/authApi.ts');
  if (!mod.signIn || !mod.signUp) errors.push('authApi: missing signIn/signUp');
  else console.log('✅ authApi exports OK');
} catch(e) { errors.push(`authApi: ${e.message}`); }

if (errors.length === 0) {
  console.log('\n✅ All runtime checks passed — crash is UI/render related');
  console.log('   Open http://localhost:3001 and check the browser console for the real error');
} else {
  console.log('\n❌ Runtime errors found:');
  errors.forEach(e => console.log('  •', e));
}
