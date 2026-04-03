import { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

function getIsStandalone() {
  if (typeof window === 'undefined') {
    return false
  }

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (typeof navigator !== 'undefined' && 'standalone' in navigator && navigator.standalone === true)
  )
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(getIsStandalone)

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      const installEvent = event as BeforeInstallPromptEvent
      if (typeof installEvent.prompt === 'function') {
        setDeferredPrompt(installEvent)
      }
    }

    function handleInstalled() {
      setDeferredPrompt(null)
      setIsInstalled(true)
    }

    function handleDisplayModeChange() {
      setIsInstalled(getIsStandalone())
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)

    const mediaQuery = window.matchMedia('(display-mode: standalone)')
    mediaQuery.addEventListener('change', handleDisplayModeChange)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
      mediaQuery.removeEventListener('change', handleDisplayModeChange)
    }
  }, [])

  async function install() {
    if (!deferredPrompt) {
      return false
    }

    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    setDeferredPrompt(null)

    if (choice.outcome === 'accepted') {
      setIsInstalled(true)
      return true
    }

    return false
  }

  return {
    canInstall: !isInstalled && deferredPrompt !== null,
    isInstalled,
    install,
  }
}