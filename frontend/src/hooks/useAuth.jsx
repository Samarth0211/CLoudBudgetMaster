import { createContext, useContext, useState, useEffect } from 'react'
import api from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    const userData = localStorage.getItem('user')
    if (token && userData) {
      setUser(JSON.parse(userData))
    }
    setLoading(false)
  }, [])

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('refresh_token', data.refresh_token)
    const userObj = { id: data.id, email: data.email, full_name: data.full_name, plan: data.plan, is_admin: !!data.is_admin }
    localStorage.setItem('user', JSON.stringify(userObj))
    setUser(userObj)
    return data
  }

  const register = async (email, password, full_name) => {
    const { data } = await api.post('/auth/register', { email, password, full_name })
    // Auto-login: store tokens and user from register response
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('refresh_token', data.refresh_token)
    const userObj = { id: data.id, email: data.email, full_name: data.full_name, plan: data.plan, is_admin: !!data.is_admin }
    localStorage.setItem('user', JSON.stringify(userObj))
    setUser(userObj)
    return data
  }

  const logout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
