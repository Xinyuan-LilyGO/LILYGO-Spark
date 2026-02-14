import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { ThemeProvider } from './contexts/ThemeContext'
import './i18n'
import './index.css'

// Windows only: load bundled CJK fonts for better Chinese display.
// Build: VITE_PLATFORM=win32 includes fonts; omitted for macOS/Linux (fonts not bundled).
// __INCLUDE_WIN_FONTS__ is replaced at build time for dead-code elimination.
if (__INCLUDE_WIN_FONTS__) {
  import('./fonts-win.css')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)
