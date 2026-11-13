import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAtomValue, useSetAtom } from 'jotai'
import http from '../api/http.js'
import { tokenAtom, userAtom } from '../store/auth.js'

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-[15px] outline-none transition focus:border-wx-green focus:bg-white'

export default function ConfirmQr() {
  const { id } = useParams()
  const token = useAtomValue(tokenAtom)
  const user = useAtomValue(userAtom)
  const setToken = useSetAtom(tokenAtom)
  const setUser = useSetAtom(userAtom)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  async function loginFirst(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await http.post('/auth/login', { username, password })
      setToken(data.access_token)
      setUser(data.user)
    } catch {
      setError('用户名或密码错误')
    } finally {
      setLoading(false)
    }
  }

  async function confirm() {
    setError('')
    setLoading(true)
    try {
      await http.post(`/auth/qr/${id}/confirm`)
      setDone(true)
    } catch (err) {
      setError(err.response?.data?.detail || '确认失败，二维码可能已过期')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f2f4f5] px-4">
      <div className="w-full max-w-[360px] rounded-2xl bg-white p-8 shadow-[0_16px_50px_rgba(0,0,0,0.12)]">
        <h1 className="mb-1 text-lg font-semibold text-gray-900">扫码登录确认</h1>
        <p className="mb-6 text-sm text-gray-500">
          确认后，电脑端将使用当前账号登录。
        </p>

        {done ? (
          <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            已确认登录，请回到原来的登录页面。
          </div>
        ) : !token ? (
          <form onSubmit={loginFirst} className="space-y-3">
            <p className="text-sm text-gray-600">请先登录当前账号</p>
            <input
              className={inputClass}
              placeholder="用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
            <input
              className={inputClass}
              type="password"
              placeholder="密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-wx-green py-3 text-[15px] font-medium text-white transition hover:bg-wx-green-dark disabled:opacity-50"
            >
              {loading ? '登录中…' : '登录并继续'}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg bg-gray-50 px-4 py-3">
              <p className="text-sm text-gray-500">当前账号</p>
              <p className="mt-1 font-medium text-gray-900">
                {user?.username || '已登录用户'}
              </p>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button
              onClick={confirm}
              disabled={loading}
              className="w-full rounded-lg bg-wx-green py-3 text-[15px] font-medium text-white transition hover:bg-wx-green-dark disabled:opacity-50"
            >
              {loading ? '确认中…' : '确认登录'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
