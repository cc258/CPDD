import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSetAtom } from 'jotai'
import http from '../api/http.js'
import { tokenAtom } from '../store/auth.js'

const STAFF_ROLES = ['super_admin', 'admin']

export default function Login() {
  const navigate = useNavigate()
  const setToken = useSetAtom(tokenAtom)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setError('')
    try {
      const { data } = await http.post('/auth/login', { username, password })
      if (!STAFF_ROLES.includes(data.user.role)) {
        setError('该账号没有管理后台权限')
        return
      }
      setToken(data.access_token)
      navigate('/')
    } catch {
      setError('登录失败，请检查用户名和密码')
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <h1 className="login-title">CPDD 管理后台</h1>
        <input
          placeholder="管理员用户名"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
        />
        <input
          type="password"
          placeholder="密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn-primary">登录</button>
      </form>
    </div>
  )
}
