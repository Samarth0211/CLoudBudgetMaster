import axios from 'axios'

// Resolve the API base URL. Prefer the build-time env var, but fall back by
// hostname so a missing .env.production never silently points prod at localhost.
function resolveBaseURL() {
  if (import.meta.env.VITE_API_BASE_URL) return import.meta.env.VITE_API_BASE_URL
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return 'https://api.cloudbudgetmaster.com/v1'
  }
  return 'http://localhost:8000/v1'
}

const api = axios.create({ baseURL: resolveBaseURL() })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
