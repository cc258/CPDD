import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSetAtom } from 'jotai'
import http from '../api/http.js'
import { tokenAtom, userAtom } from '../store/auth.js'

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-[15px] text-gray-800 outline-none transition focus:border-wx-green focus:bg-white focus:ring-2 focus:ring-wx-green/15'
const primaryClass =
  'w-full rounded-lg bg-wx-green py-3 text-[15px] font-medium text-white transition hover:bg-wx-green-dark disabled:cursor-not-allowed disabled:opacity-50'

export default function Login() {
  const navigate = useNavigate()
  const setToken = useSetAtom(tokenAtom)
  const setUser = useSetAtom(userAtom)

  const [mode, setMode] = useState('login') // login | register | forgot | qr
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)

  // 密码登录
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  // 注册
  const [regName, setRegName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirm, setRegConfirm] = useState('')

  // 忘记密码
  const [resetName, setResetName] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newConfirm, setNewConfirm] = useState('')
  const [resetStep, setResetStep] = useState(1)

  // 二维码登录
  const [qr, setQr] = useState(null)
  const [qrStatus, setQrStatus] = useState('pending')
  const pollRef = useRef(null)

  function applyLogin(data) {
    setToken(data.access_token)
    setUser(data.user)
    navigate('/')
  }

  function switchMode(next) {
    setMode(next)
    setError('')
    setNotice('')
  }

  async function submitLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await http.post('/auth/login', { username, password })
      applyLogin(data)
    } catch (err) {
      setError(err.response?.data?.detail || '登录失败，请检查用户名和密码')
    } finally {
      setLoading(false)
    }
  }

  async function submitRegister(e) {
    e.preventDefault()
    setError('')
    if (regPassword.length < 6) return setError('密码至少 6 位')
    if (regPassword !== regConfirm) return setError('两次输入的密码不一致')

    setLoading(true)
    try {
      const { data } = await http.post('/auth/register', {
        username: regName,
        password: regPassword,
        email: regEmail || null,
      })
      applyLogin(data)
    } catch (err) {
      setError(err.response?.data?.detail || '注册失败，用户名可能已存在')
    } finally {
      setLoading(false)
    }
  }

  async function requestReset(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await http.post('/auth/forgot-password', { username: resetName })
      setResetToken(data.reset_token || '')
      setResetStep(2)
      setNotice(
        data.reset_token
          ? '开发环境已生成重置令牌，请设置新密码'
          : '重置令牌已生成，请查看服务端日志或邮件后继续',
      )
    } catch (err) {
      setError(err.response?.data?.detail || '操作失败')
    } finally {
      setLoading(false)
    }
  }

  async function submitReset(e) {
    e.preventDefault()
    setError('')
    if (newPassword.length < 6) return setError('密码至少 6 位')
    if (newPassword !== newConfirm) return setError('两次输入的密码不一致')

    setLoading(true)
    try {
      await http.post('/auth/reset-password', {
        token: resetToken,
        new_password: newPassword,
      })
      switchMode('login')
      setNotice('密码已重置，请使用新密码登录')
      setPassword('')
    } catch (err) {
      setError(err.response?.data?.detail || '重置失败')
    } finally {
      setLoading(false)
    }
  }

  // 二维码：进入该模式时创建并轮询
  useEffect(() => {
    if (mode !== 'qr') {
      clearInterval(pollRef.current)
      return
    }

    let disposed = false

    async function createQr() {
      setQrStatus('pending')
      setQr(null)
      try {
        const { data } = await http.post('/auth/qr/create')
        if (disposed) return
        setQr(data)
        startPolling(data.qr_id)
      } catch {
        if (!disposed) setQrStatus('error')
      }
    }

    function startPolling(qrId) {
      clearInterval(pollRef.current)
      pollRef.current = setInterval(async () => {
        try {
          const { data } = await http.get(`/auth/qr/${qrId}/status`)
          if (data.status === 'confirmed' && data.token) {
            clearInterval(pollRef.current)
            applyLogin(data.token)
          } else if (data.status === 'expired') {
            clearInterval(pollRef.current)
            setQrStatus('expired')
          }
        } catch {
          // 网络抖动时继续轮询
        }
      }, 1500)
    }

    createQr()
    return () => {
      disposed = true
      clearInterval(pollRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f2f4f5] px-4 py-10">
      {/* 背景光斑 */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-wx-green/15 blur-3xl animate-float-slow" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-emerald-300/20 blur-3xl animate-float-slow" />

      <div className="relative z-10 flex w-full max-w-[900px] overflow-hidden rounded-3xl bg-white shadow-[0_24px_70px_rgba(0,0,0,0.14)]">
        {/* 左侧品牌区 */}
        <div className="hidden w-[340px] flex-col justify-between bg-gradient-to-br from-[#07c160] to-[#049e4c] p-10 text-white md:flex">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 text-xl font-bold">
                微
              </span>
              <span className="text-2xl font-semibold tracking-wide">CPDD</span>
            </div>
            <p className="mt-10 text-[28px] font-semibold leading-snug">
              和好友，
              <br />
              随时随地聊起来
            </p>
            <p className="mt-4 text-sm leading-relaxed text-white/75">
              支持文字聊天、文件传输、二维码登录。
              一个账号，连接你的所有设备。
            </p>
          </div>
          <div className="space-y-3 text-sm text-white/85">
            <p className="flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/80" />
              实时消息 · 秒级送达
            </p>
            <p className="flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/80" />
              扫码登录 · 安全便捷
            </p>
            <p className="flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/80" />
              文件传输 · 随时下载
            </p>
          </div>
        </div>

        {/* 右侧操作区 */}
        <div className="flex-1 px-6 py-9 sm:px-10 sm:py-11">
          <div className="mb-7 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              {mode === 'login' && '登录'}
              {mode === 'register' && '注册账号'}
              {mode === 'forgot' && '找回密码'}
              {mode === 'qr' && '二维码登录'}
            </h2>
            {mode === 'login' && (
              <button
                type="button"
                onClick={() => switchMode('qr')}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-gray-500 transition hover:bg-gray-100 hover:text-wx-green"
              >
                <QrIcon />
                扫码登录
              </button>
            )}
            {mode !== 'login' && (
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="text-sm text-gray-500 transition hover:text-wx-green"
              >
                返回登录
              </button>
            )}
          </div>

          {(error || notice) && (
            <div
              className={`mb-4 rounded-lg px-4 py-2.5 text-sm ${
                error
                  ? 'bg-red-50 text-red-600'
                  : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              {error || notice}
            </div>
          )}

          {mode === 'login' && (
            <form onSubmit={submitLogin} className="space-y-4">
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
              <button type="submit" className={primaryClass} disabled={loading}>
                {loading ? '登录中…' : '登 录'}
              </button>
              <div className="flex items-center justify-between pt-1 text-sm">
                <button
                  type="button"
                  className="text-gray-500 transition hover:text-wx-green"
                  onClick={() => switchMode('register')}
                >
                  注册新账号
                </button>
                <button
                  type="button"
                  className="text-gray-500 transition hover:text-wx-green"
                  onClick={() => {
                    setResetStep(1)
                    switchMode('forgot')
                  }}
                >
                  忘记密码？
                </button>
              </div>
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={submitRegister} className="space-y-4">
              <input
                className={inputClass}
                placeholder="用户名（2-32 位）"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                autoFocus
              />
              <input
                className={inputClass}
                type="email"
                placeholder="邮箱（选填）"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
              />
              <input
                className={inputClass}
                type="password"
                placeholder="密码（至少 6 位）"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
              />
              <input
                className={inputClass}
                type="password"
                placeholder="确认密码"
                value={regConfirm}
                onChange={(e) => setRegConfirm(e.target.value)}
              />
              <button type="submit" className={primaryClass} disabled={loading}>
                {loading ? '注册中…' : '注 册'}
              </button>
              <p className="text-center text-xs text-gray-400">
                第一个注册的用户将自动成为超级管理员
              </p>
            </form>
          )}

          {mode === 'forgot' && resetStep === 1 && (
            <form onSubmit={requestReset} className="space-y-4">
              <input
                className={inputClass}
                placeholder="请输入用户名"
                value={resetName}
                onChange={(e) => setResetName(e.target.value)}
                autoFocus
              />
              <button type="submit" className={primaryClass} disabled={loading}>
                {loading ? '提交中…' : '获取重置令牌'}
              </button>
              <p className="text-center text-xs text-gray-400">
                未配置邮件服务时，开发环境会直接返回重置令牌
              </p>
            </form>
          )}

          {mode === 'forgot' && resetStep === 2 && (
            <form onSubmit={submitReset} className="space-y-4">
              <input
                className={inputClass}
                placeholder="重置令牌"
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
              />
              <input
                className={inputClass}
                type="password"
                placeholder="新密码（至少 6 位）"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoFocus
              />
              <input
                className={inputClass}
                type="password"
                placeholder="确认新密码"
                value={newConfirm}
                onChange={(e) => setNewConfirm(e.target.value)}
              />
              <button type="submit" className={primaryClass} disabled={loading}>
                {loading ? '提交中…' : '重置密码'}
              </button>
            </form>
          )}

          {mode === 'qr' && (
            <div className="flex flex-col items-center pt-2">
              <div className="relative flex h-[240px] w-[240px] items-center justify-center rounded-2xl border border-gray-100 bg-gray-50 p-4">
                {qr && qrStatus === 'pending' && (
                  <img src={qr.qr_image} alt="登录二维码" className="h-full w-full" />
                )}
                {!qr && qrStatus !== 'error' && (
                  <span className="text-sm text-gray-400">正在生成二维码…</span>
                )}
                {(qrStatus === 'expired' || qrStatus === 'error') && (
                  <button
                    type="button"
                    className="text-sm text-wx-green"
                    onClick={() => {
                      setMode('login')
                      setTimeout(() => setMode('qr'), 0)
                    }}
                  >
                    二维码已失效，点击刷新
                  </button>
                )}
              </div>
              <p className="mt-5 text-center text-sm leading-relaxed text-gray-500">
                打开手机端，使用已登录的账号扫码
                <br />
                并在手机端确认登录
              </p>
              {qrStatus === 'pending' && (
                <p className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-wx-green" />
                  等待扫码确认…
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function QrIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3zM19 19h2v2h-2zM14 19h2v2h-2z" />
    </svg>
  )
}
