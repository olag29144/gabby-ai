import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

try {
  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  );
} catch (err) {
  // Show error if React itself fails to mount
  root.innerHTML = `
    <div style="height:100vh;display:flex;align-items:center;justify-content:center;background:#1e1f20;flex-direction:column;gap:12px;font-family:monospace;padding:2rem;text-align:center">
      <p style="color:#f87171;font-size:1rem;font-weight:600">Gabby AI failed to mount</p>
      <pre style="color:#fca5a5;font-size:0.75rem;max-width:640px;white-space:pre-wrap;background:#282a2c;padding:1rem;border-radius:8px;border:1px solid rgba(248,113,113,0.3)">${err instanceof Error ? err.message + '\n\n' + err.stack : String(err)}</pre>
      <button onclick="location.reload()" style="padding:0.5rem 1.5rem;background:#4f8ef7;color:white;border:none;border-radius:999px;cursor:pointer">Reload</button>
    </div>`;
}
