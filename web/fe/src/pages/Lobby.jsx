import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import http, { chatSocket } from '../api/http.js'
import { Avatar, displayName } from '../components/Avatar.jsx'

const emptyPair = () => ({ user: '', robot: '' })

export default function Lobby() {
  const navigate = useNavigate()
  const [robots, setRobots] = useState([])
  const [online, setOnline] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [intro, setIntro] = useState('')
  const [presets, setPresets] = useState([emptyPair()])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [me, setMe] = useState(null)
  const [editingId, setEditingId] = useState(null)

  function loadRobots() {
    http.get('/robots').then(({ data }) => setRobots(data)).catch(() => {})
  }

  function resetForm() {
    setName('')
    setIntro('')
    setPresets([emptyPair()])
    setEditingId(null)
    setError('')
  }

  function openCreate() {
    if (showForm && !editingId) {
      setShowForm(false)
      return
    }
    resetForm()
    setShowForm(true)
  }

  async function openEdit(robot) {
    const { data } = await http.get(`/robots/by-user/${robot.user_id}`)
    setName(data.name)
    setIntro(data.intro)
    setPresets(
      data.presets.length > 0
        ? data.presets.map((p) => ({ user: p.user, robot: p.robot }))
        : [emptyPair()],
    )
    setEditingId(robot.id)
    setShowForm(true)
    setError('')
  }

  useEffect(() => {
    loadRobots()
    http.get('/auth/me').then(({ data }) => setMe(data)).catch(() => {})

    // 建立连接维持在线状态，并定时刷新在线用户
    const ws = chatSocket()
    const loadOnline = () => {
      Promise.all([http.get('/users'), http.get('/chat/online')])
        .then(([users, ids]) => {
          const onlineIds = new Set(ids.data)
          setOnline(users.data.filter((u) => onlineIds.has(u.id)))
        })
        .catch(() => {})
    }
    loadOnline()
    const timer = setInterval(loadOnline, 5000)
    return () => {
      clearInterval(timer)
      ws.close()
    }
  }, [])

  async function addRobot(robot) {
    if (robot.added) {
      navigate(`/chat/${robot.user_id}`)
      return
    }
    await http.post(`/robots/${robot.id}/add`)
    navigate(`/chat/${robot.user_id}`)
  }

  function updatePair(index, key, value) {
    setPresets((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    )
  }

  function addPair() {
    setPresets((prev) => [...prev, emptyPair()])
  }

  function removePair(index) {
    setPresets((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)))
  }

  async function createRobot(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const valid = presets.filter((p) => p.user.trim() || p.robot.trim())
      const body = { name, intro, presets: valid }
      if (editingId) {
        await http.put(`/robots/${editingId}`, body)
      } else {
        await http.post('/robots', body)
      }
      resetForm()
      setShowForm(false)
      loadRobots()
    } catch (err) {
      setError(err.response?.data?.detail || (editingId ? '保存失败' : '创建失败'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen justify-center bg-[#ededed]">
      <div className="flex h-screen w-full max-w-[420px] flex-col overflow-hidden bg-[#f7f7f7] shadow-[0_0_40px_rgba(0,0,0,0.08)] sm:my-4 sm:h-[calc(100vh-2rem)] sm:rounded-xl">
        <header className="flex items-center gap-2 border-b border-black/5 bg-[#ededed] px-3 py-3">
          <button
            onClick={() => navigate('/')}
            className="flex h-8 w-8 items-center justify-center rounded-md text-gray-600 transition hover:bg-black/5"
            aria-label="返回"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className="flex-1 text-[16px] font-medium text-gray-900">添加好友</h1>
          <button
            onClick={openCreate}
            className="rounded-md bg-wx-green px-3 py-1.5 text-sm font-medium text-white transition hover:bg-wx-green-dark"
          >
            {showForm && !editingId ? '收起' : '创建机器人'}
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto thin-scrollbar">
          {showForm && (
            <form
              onSubmit={createRobot}
              className="space-y-3 border-b border-black/5 bg-white px-4 py-4"
            >
              <p className="text-sm font-medium text-gray-700">
                {editingId ? '修改机器人' : '创建机器人'}
              </p>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="名称（2-32 位）"
                className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-wx-green focus:bg-white"
              />
              <input
                value={intro}
                onChange={(e) => setIntro(e.target.value)}
                placeholder="简介（选填）"
                className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-wx-green focus:bg-white"
              />
              <p className="pt-1 text-xs text-gray-400">
                每行都是一条消息：左侧是你发送的话，右侧是机器人回复。只填左侧表示你连续发多条；只填右侧表示机器人主动连续发言。
              </p>
              {presets.map((pair, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="w-10 shrink-0 text-xs text-gray-400">第{index + 1}段</span>
                  <input
                    value={pair.user}
                    onChange={(e) => updatePair(index, 'user', e.target.value)}
                    placeholder="你说的话"
                    className="min-w-0 flex-1 rounded-md border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-wx-green"
                  />
                  <input
                    value={pair.robot}
                    onChange={(e) => updatePair(index, 'robot', e.target.value)}
                    placeholder="自动回复（选填）"
                    className="min-w-0 flex-1 rounded-md border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-wx-green"
                  />
                  <button
                    type="button"
                    onClick={() => removePair(index)}
                    className="shrink-0 rounded px-1.5 py-1 text-xs text-red-400 transition hover:bg-red-50"
                  >
                    删除
                  </button>
                </div>
              ))}
              <div className="flex items-center justify-between">
                <button type="button" onClick={addPair} className="text-sm text-wx-green">
                  + 添加一段对话
                </button>
                <button
                  type="submit"
                  disabled={loading || !name.trim()}
                  className="rounded-md bg-wx-green px-4 py-2 text-sm font-medium text-white transition hover:bg-wx-green-dark disabled:opacity-50"
                >
                  {loading
                    ? editingId
                      ? '保存中…'
                      : '创建中…'
                    : editingId
                      ? '保存修改'
                      : '创建'}
                </button>
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
            </form>
          )}

          {/* 在线用户 */}
          <p className="bg-[#f7f7f7] px-4 pb-1 pt-3 text-xs text-gray-400">
            在线用户 {online.length > 0 && `(${online.length})`}
          </p>
          {online.length === 0 ? (
            <p className="bg-white px-4 py-4 text-center text-sm text-gray-400">
              暂无其他在线用户
            </p>
          ) : (
            <ul className="bg-white">
              {online.map((user) => (
                <li
                  key={user.id}
                  className="flex items-center gap-3 border-b border-gray-100 px-4 py-3"
                >
                  <Avatar user={user} size="lg" />
                  <p className="min-w-0 flex-1 truncate text-[15px] text-gray-900">
                    {displayName(user.username, user.role)}
                  </p>
                  <button
                    onClick={() => navigate(`/chat/${user.id}`)}
                    className="shrink-0 rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-200"
                  >
                    聊天
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* 机器人（自己是创建者，管理员可见全部） */}
          <p className="bg-[#f7f7f7] px-4 pb-1 pt-3 text-xs text-gray-400">机器人</p>
          {robots.length === 0 ? (
            <p className="bg-white px-4 py-4 text-center text-sm text-gray-400">
              还没有机器人，创建一个吧
            </p>
          ) : (
            <ul className="bg-white">
              {robots.map((robot) => (
                <li
                  key={robot.id}
                  className="flex items-start gap-3 border-b border-gray-100 px-4 py-3"
                >
                  <Avatar user={{ id: robot.user_id, username: robot.name }} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] text-gray-900">
                      {displayName(robot.name, 'robot')}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">
                      {robot.intro || '\u00A0'}
                    </p>
                  </div>
                  <div className="mt-1 flex shrink-0 items-center gap-2">
                    {(me?.role === 'admin' ||
                      me?.role === 'super_admin' ||
                      robot.owner_id === me?.id) && (
                      <button
                        onClick={() => openEdit(robot)}
                        className="rounded-md px-2 py-1.5 text-xs text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                      >
                        编辑
                      </button>
                    )}
                    <button
                      onClick={() => addRobot(robot)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                        robot.added
                          ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          : 'bg-wx-green text-white hover:bg-wx-green-dark'
                      }`}
                    >
                      {robot.added ? '聊天' : '添加'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
