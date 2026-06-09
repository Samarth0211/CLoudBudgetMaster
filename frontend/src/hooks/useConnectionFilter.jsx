import { createContext, useContext, useState, useEffect } from 'react'
import api from '../lib/api'

const Ctx = createContext(null)
const KEY = 'connFilter'

/** Global "which cloud account am I viewing" filter, shared across all tabs. */
export function ConnectionFilterProvider({ children }) {
  const [connections, setConnections] = useState([])
  const [connectionId, setId] = useState(() => {
    try { return localStorage.getItem(KEY) || '' } catch { return '' }
  })

  useEffect(() => {
    api.get('/connections').then(r => {
      const cs = r.data.connections || []
      setConnections(cs)
      // saved filter points at a deleted connection -> reset to "all"
      if (connectionId && !cs.some(c => c.id === connectionId)) setConnectionId('')
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setConnectionId = (id) => {
    setId(id || '')
    try { id ? localStorage.setItem(KEY, id) : localStorage.removeItem(KEY) } catch { /* ignore */ }
  }

  return <Ctx.Provider value={{ connections, connectionId, setConnectionId }}>{children}</Ctx.Provider>
}

export function useConnectionFilter() {
  return useContext(Ctx) || { connections: [], connectionId: '', setConnectionId: () => {} }
}
