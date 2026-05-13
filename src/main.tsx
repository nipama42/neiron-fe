import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './store/authStore'
import { ThemeProvider } from './store/themeContext'
import AuthGate from './components/AuthGate'
import TelegramMiniAppEnterBanner from './components/TelegramMiniAppEnterBanner'
import { tryRedirectTelegramBrowserToMiniApp } from './lib/telegramMiniAppRedirect'
import { initTelegramMiniAppViewport } from './lib/telegramMiniAppViewport'
import { ensureTelegramScript } from './lib/ensureTelegramScript'
import { applyThemeToDocument, resolveTheme } from './lib/themePreference'
import './index.css'

applyThemeToDocument(resolveTheme())

void ensureTelegramScript().then(() => {
  initTelegramMiniAppViewport()
})

function TelegramInAppBrowserRedirect() {
  useEffect(() => {
    const delays = [0, 400, 1200, 2800]
    const ids = delays.map((ms) => window.setTimeout(() => tryRedirectTelegramBrowserToMiniApp(), ms))
    return () => ids.forEach((id) => window.clearTimeout(id))
  }, [])
  return null
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <TelegramInAppBrowserRedirect />
          <TelegramMiniAppEnterBanner />
          <AuthGate />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
)