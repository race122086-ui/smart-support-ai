import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { api, setCsrfToken } from '../api/client.js'

const SessionContext = createContext(null)
let sessionRestorePromise = null

function restoreSession() {
  if (!sessionRestorePromise) {
    sessionRestorePromise = api.me().finally(() => {
      sessionRestorePromise = null
    })
  }
  return sessionRestorePromise
}

export function SessionProvider({ children }) {
  const [session, setSession] = useState({ status: 'loading', user: null })

  useEffect(() => {
    let active = true
    restoreSession()
      .then((data) => {
        if (!active) return
        setCsrfToken(data.csrfToken)
        setSession({ status: 'authenticated', user: data.user })
      })
      .catch(() => {
        if (active) setSession({ status: 'anonymous', user: null })
      })
    function expired() {
      setCsrfToken(null)
      setSession({ status: 'anonymous', user: null })
    }
    window.addEventListener('smartsupport:session-expired', expired)
    return () => {
      active = false
      window.removeEventListener('smartsupport:session-expired', expired)
    }
  }, [])

  const value = useMemo(() => ({
    ...session,
    async login(credentials) {
      const data = await api.login(credentials)
      setCsrfToken(data.csrfToken)
      setSession({ status: 'authenticated', user: data.user })
    },
    async logout() {
      try {
        await api.logout()
      } finally {
        setCsrfToken(null)
        setSession({ status: 'anonymous', user: null })
      }
    },
  }), [session])

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession debe usarse dentro de SessionProvider')
  return value
}
