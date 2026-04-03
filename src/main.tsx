import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { BrowserRouter } from 'react-router-dom'
import { handleGoogleRedirect } from './lib/googleAuth'

window.onerror = (msg, url, line, col, error) => {
  document.body.innerHTML = `<div style="padding:20px;color:red;background:black;z-index:9999;position:fixed;top:0;left:0;width:100%;height:100%;font-size:20px;">
    <h1>Runtime Error:</h1>
    <pre>${msg}</pre>
    <pre>${error?.stack}</pre>
  </div>`;
};
window.addEventListener('unhandledrejection', (event) => {
  document.body.innerHTML = `<div style="padding:20px;color:red;background:black;z-index:9999;position:fixed;top:0;left:0;width:100%;height:100%;font-size:20px;">
    <h1>Unhandled Rejection:</h1>
    <pre>${event.reason?.message || event.reason}</pre>
    <pre>${event.reason?.stack}</pre>
  </div>`;
});

try {
  handleGoogleRedirect()

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  )
} catch (e: any) {
  document.body.innerHTML += `<div style="color:red;padding:20px;">${e.message}</div>`;
}
