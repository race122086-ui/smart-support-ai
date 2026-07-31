import { useEffect, useState } from 'react'

export function PwaInstall() {
  const [installPrompt, setInstallPrompt] = useState(null)

  useEffect(() => {
    function offerInstall(event) {
      event.preventDefault()
      setInstallPrompt(event)
    }

    function clearInstallPrompt() {
      setInstallPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', offerInstall)
    window.addEventListener('appinstalled', clearInstallPrompt)

    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', offerInstall)
      window.removeEventListener('appinstalled', clearInstallPrompt)
    }
  }, [])

  async function install() {
    if (!installPrompt) return
    await installPrompt.prompt()
    setInstallPrompt(null)
  }

  if (!installPrompt) return null

  return <button type="button" className="install-button" onClick={install}>Instalar app</button>
}
