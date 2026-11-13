import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import http from '../api/http.js'
import { ROLE_LABELS } from './Home.jsx'

const STAFF_ROLES = ['super_admin', 'admin']

export default function Detail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [me, setMe] = useState(null)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('user')
  const [error, setError] = useState('')

  useEffect(() => {
    http.get('/auth/me').then(({ data }) => setMe(data))
    http.get(`/users/${id}`).then(({ data }) => {
      setUser(data)
      setUsername(data.username)
      setEmail(data.email || '')
      setRole(data.role)
    })
  }, [id])

  async function save(e) {
    e.preventDefault()
    setError('')
    try {
      await http.put(`/users/${id}`, { username, email: email || null, role })
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || '保存失败')
    }
  }

  if (!user) return <div className="admin">加载中…</div>

  const isSuperAdmin = me?.role === 'super_admin'
  const canManage = isSuperAdmin || !STAFF_ROLES.includes(user.role)
  const roleOptions = isSuperAdmin
    ? ['super_admin', 'admin', 'vip', 'user']
    : ['vip', 'user']

  return (
    <div className="admin">
      <header className="admin-header">
        <button className="btn-plain" onClick={() => navigate('/')}>‹ 返回</button>
        <h1>用户详情</h1>
        <span />
      </header>
      <section className="panel">
        <form className="detail-form" onSubmit={save}>
          <label>
            ID
            <input value={user.id} disabled />
          </label>
          <label>
            用户名
            <input
              value={username}
              disabled={!canManage}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
          <label>
            邮箱
            <input
              type="email"
              value={email}
              disabled={!canManage}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            角色
            <select
              value={role}
              disabled={!canManage}
              onChange={(e) => setRole(e.target.value)}
            >
              {roleOptions.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </label>
          <label>
            注册时间
            <input value={new Date(user.created_at).toLocaleString()} disabled />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn-primary" disabled={!canManage}>
            保存
          </button>
        </form>
      </section>
    </div>
  )
}
