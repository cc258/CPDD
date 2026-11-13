import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSetAtom } from 'jotai'
import http from '../api/http.js'
import { tokenAtom } from '../store/auth.js'

export const ROLE_LABELS = {
  super_admin: '超级管理员',
  admin: '管理员',
  vip: 'VIP 用户',
  user: '普通用户',
}

const STAFF_ROLES = ['super_admin', 'admin']

export default function Home() {
  const [users, setUsers] = useState([])
  const [files, setFiles] = useState([])
  const [me, setMe] = useState(null)
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' })
  const [error, setError] = useState('')
  const setToken = useSetAtom(tokenAtom)
  const navigate = useNavigate()

  const loadUsers = useCallback(() => {
    http.get('/users').then(({ data }) => setUsers(data))
  }, [])

  const loadFiles = useCallback(() => {
    http.get('/files').then(({ data }) => setFiles(data))
  }, [])

  useEffect(() => {
    http.get('/auth/me').then(({ data }) => setMe(data))
    loadUsers()
    loadFiles()
  }, [loadUsers, loadFiles])

  const isSuperAdmin = me?.role === 'super_admin'

  async function createUser(e) {
    e.preventDefault()
    setError('')
    if (!newUser.username) return
    try {
      await http.post('/users', newUser)
      setNewUser({ username: '', password: '', role: 'user' })
      loadUsers()
    } catch (err) {
      setError(err.response?.data?.detail || '新增失败')
    }
  }

  async function deleteUser(id) {
    if (!confirm('确定删除该用户？')) return
    setError('')
    try {
      await http.delete(`/users/${id}`)
      loadUsers()
    } catch (err) {
      setError(err.response?.data?.detail || '删除失败')
    }
  }

  async function changeRole(id, role) {
    setError('')
    try {
      await http.put(`/users/${id}`, { role })
      loadUsers()
    } catch (err) {
      setError(err.response?.data?.detail || '修改角色失败')
    }
  }

  async function uploadFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const form = new FormData()
    form.append('file', file)
    await http.post('/files/upload', form)
    loadFiles()
    e.target.value = ''
  }

  async function deleteFile(id) {
    if (!confirm('确定删除该文件？')) return
    await http.delete(`/files/${id}`)
    loadFiles()
  }

  function logout() {
    setToken('')
    navigate('/login')
  }

  const roleOptions = isSuperAdmin
    ? ['super_admin', 'admin', 'vip', 'user']
    : ['vip', 'user']

  return (
    <div className="admin">
      <header className="admin-header">
        <h1>CPDD 管理后台</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            {me?.username} · {ROLE_LABELS[me?.role] || '—'}
          </span>
          <button className="btn-plain" onClick={logout}>退出登录</button>
        </div>
      </header>

      {error && <p className="error mb-3">{error}</p>}

      <section className="panel">
        <h2>用户管理</h2>
        <form className="inline-form" onSubmit={createUser}>
          <input
            placeholder="用户名"
            value={newUser.username}
            onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
          />
          <input
            type="password"
            placeholder="初始密码"
            value={newUser.password}
            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
          />
          <select
            value={newUser.role}
            onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
          >
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-primary">新增用户</button>
        </form>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>用户名</th>
              <th>角色</th>
              <th>注册时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const canManage = isSuperAdmin || !STAFF_ROLES.includes(u.role)
              return (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>
                    <Link to={`/users/${u.id}`}>{u.username}</Link>
                  </td>
                  <td>
                    <select
                      value={u.role}
                      disabled={!canManage}
                      onChange={(e) => changeRole(u.id, e.target.value)}
                    >
                      {roleOptions.map((role) => (
                        <option key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{new Date(u.created_at).toLocaleString()}</td>
                  <td>
                    <button
                      className="btn-danger"
                      disabled={u.id === me?.id}
                      onClick={() => deleteUser(u.id)}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h2>文件管理</h2>
        <label className="btn-primary upload-btn">
          上传文件
          <input type="file" hidden onChange={uploadFile} />
        </label>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>文件名</th>
              <th>大小</th>
              <th>上传时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {files.map((f) => (
              <tr key={f.id}>
                <td>{f.id}</td>
                <td>{f.filename}</td>
                <td>{(f.size / 1024).toFixed(1)} KB</td>
                <td>{new Date(f.created_at).toLocaleString()}</td>
                <td>
                  <a className="btn-plain" href={`/api/files/${f.id}/download`}>
                    下载
                  </a>
                  <button className="btn-danger" onClick={() => deleteFile(f.id)}>
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
