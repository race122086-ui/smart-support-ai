import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { api, setCsrfToken } from '../api/client.js'

const SessionContext = createContext(null)

export function SessionProvider({ children }) {
  const [session, setSession] = useState({ loading: true, user: null })

  useEffect(() => {
    let active = true
    api.me()
      .then((data) => {
        if (!active) return
        setCsrfToken(data.csrfToken)
        setSession({ loading: false, user: data.user })
      })
      .catch(() => {
        if (active) setSession({ loading: false, user: null })
      })
    function expired() {
      setCsrfToken(null)
      setSession({ loading: false, user: null })
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
      setSession({ loading: false, user: data.user })
    },
    async logout() {
      try {
        await api.logout()
      } finally {
        setCsrfToken(null)
        setSession({ loading: false, user: null })
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
