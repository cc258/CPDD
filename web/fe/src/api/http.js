import axios from 'axios'

const http = axios.create({ baseURL: '/api' })

// 请求自动带上 JWT
http.interceptors.request.use((config) => {
  const token = localStorage.getItem('cpdd_fe_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// 401 时清除登录态并跳转登录页
http.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('cpdd_fe_token')
      location.href = '/login'
    }
    return Promise.reject(err)
  },
)

export function chatSocket() {
  const token = localStorage.getItem('cpdd_fe_token')
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  return new WebSocket(`${proto}://${location.host}/api/ws/chat?token=${token}`)
}

export default http
