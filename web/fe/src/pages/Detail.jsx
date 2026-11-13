import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAtomValue, useSetAtom } from 'jotai'
import { chatSocket, default as http } from '../api/http.js'
import { userAtom } from '../store/auth.js'
import { Avatar, displayName } from '../components/Avatar.jsx'

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function shouldShowTime(prev, cur) {
  if (!prev) return true
  return new Date(cur).getTime() - new Date(prev).getTime() > 5 * 60 * 1000
}

export default function Detail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const me = useAtomValue(userAtom)
  const setUser = useSetAtom(userAtom)
  const [peer, setPeer] = useState(null)
  const [messages, setMessages] = useState([])
  const [robotMeta, setRobotMeta] = useState(null)
  // 每次进入会话都从第一段预设重新开始
  const [scriptIndex, setScriptIndex] = useState(0)
  const [text, setText] = useState('')
  const wsRef = useRef(null)
  const listRef = useRef(null)
  const pendingStartRef = useRef(null)
  const startedRef = useRef(null)

  function sendStart() {
    if (startedRef.current === Number(id)) return
    startedRef.current = Number(id)
    const payload = JSON.stringify({ to: Number(id), start: true, preset_index: 0 })
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(payload)
    } else {
      pendingStartRef.current = payload
    }
  }

  useEffect(() => {
    // 刷新后若本地没有用户信息，先恢复当前用户，再判断消息归属
    if (!me) {
      http.get('/auth/me').then(({ data }) => setUser(data)).catch(() => {})
    }
  }, [me, setUser])

  useEffect(() => {
    http.get(`/users/${id}`).then(({ data }) => setPeer(data)).catch(() => {})
  }, [id])

  useEffect(() => {
    if (peer?.role !== 'robot') {
      setRobotMeta(null)
      return
    }
    // 机器人会话：每次进入都从第一段脚本开始
    http.get(`/robots/by-user/${peer.id}`).then(({ data }) => {
      setRobotMeta(data)
      const presets = data.presets || []
      // 跳过左侧为空的行（这些是机器人主动连续说的话）
      let index = 0
      while (index < presets.length && !(presets[index].user || '').trim()) index += 1
      setScriptIndex(index)
      setText(presets[index]?.user || '')
      if (presets.length > 0 && !(presets[0].user || '').trim()) {
        sendStart()
      }
    }).catch(() => {})
  }, [peer])

  useEffect(() => {
    // 只拉取与当前会话对象的聊天记录
    http
      .get('/chat/history', { params: { peer_id: Number(id) } })
      .then(({ data }) => setMessages(data))
      .catch(() => {})
  }, [id])

  useEffect(() => {
    const ws = chatSocket()
    wsRef.current = ws
    ws.onopen = () => {
      if (pendingStartRef.current) {
        ws.send(pendingStartRef.current)
        pendingStartRef.current = null
      }
    }
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      if (msg.type === 'message') {
        const m = msg.data
        // 只显示与当前对方之间的消息
        if (
          (m.user_id === Number(id) && m.recipient_id === me?.id) ||
          (m.user_id === me?.id && m.recipient_id === Number(id))
        ) {
          setMessages((prev) => [...prev, m])
        }
      }
    }
    return () => ws.close()
  }, [id, me?.id])

  useEffect(() => {
    listRef.current?.scrollTo(0, listRef.current.scrollHeight)
  }, [messages])

  function send(e) {
    e.preventDefault()
    const content = text.trim()
    if (!content) return
    // 机器人按本次会话的脚本进度回复
    wsRef.current?.send(
      JSON.stringify({
        to: Number(id),
        content,
        ...(robotMeta ? { preset_index: scriptIndex } : {}),
      }),
    )

    if (robotMeta) {
      // 下一段：跳过只有机器人发言的行，找到下一条“我说的话”
      const presets = robotMeta.presets || []
      let nextIndex = scriptIndex + 1
      while (nextIndex < presets.length && !(presets[nextIndex].user || '').trim()) {
        nextIndex += 1
      }
      setScriptIndex(nextIndex)
      setText(presets[nextIndex]?.user || '')
    } else {
      setText('')
    }
  }

  return (
    <div className="flex min-h-screen justify-center bg-[#ededed]">
      <div className="flex h-screen w-full max-w-[420px] flex-col overflow-hidden bg-[#f2f2f2] shadow-[0_0_40px_rgba(0,0,0,0.08)] sm:my-4 sm:h-[calc(100vh-2rem)] sm:rounded-xl">
        {/* 顶栏 */}
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
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-[16px] font-medium text-gray-900">
              {peer ? displayName(peer.username, peer.role) : '聊天'}
            </p>
          </div>
          <div className="w-8" />
        </header>

        {/* 消息区 */}
        <ul
          ref={listRef}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4 thin-scrollbar"
        >
          {messages.length === 0 && (
            <li className="pt-10 text-center text-xs text-gray-400">
              还没有消息，发送第一条开始聊天吧
            </li>
          )}
          {messages.map((m, index) => {
            const mine = m.user_id === me?.id
            const prev = messages[index - 1]
            return (
              <li key={m.id}>
                {shouldShowTime(prev?.created_at, m.created_at) && (
                  <p className="mb-2 text-center text-[11px] text-gray-400">
                    {formatTime(m.created_at)}
                  </p>
                )}
                <div className={`flex items-start gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
                  <Avatar user={{ id: m.user_id, username: m.username }} size="sm" />
                  <div className={`flex max-w-[72%] flex-col ${mine ? 'items-end' : 'items-start'}`}>
                    {!mine && (
                      <span className="mb-1 px-0.5 text-[11px] text-gray-400">
                        {displayName(m.username, m.role)}
                      </span>
                    )}
                    <div
                      className={`relative rounded-lg px-3 py-2 text-[14px] leading-relaxed break-words ${
                        mine
                          ? 'bg-[#95ec69] text-gray-900'
                          : 'bg-white text-gray-900 shadow-[0_1px_1px_rgba(0,0,0,0.04)]'
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>

        {/* 输入栏 */}
        <form
          onSubmit={send}
          className="flex items-center gap-2 border-t border-black/5 bg-[#f7f7f7] px-3 py-2.5"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="发送消息…"
            className="flex-1 rounded-md border border-transparent bg-white px-3 py-2 text-[14px] outline-none transition focus:border-wx-green"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="rounded-md bg-wx-green px-4 py-2 text-sm font-medium text-white transition hover:bg-wx-green-dark disabled:opacity-40"
          >
            发送
          </button>
        </form>
      </div>
    </div>
  )
}
