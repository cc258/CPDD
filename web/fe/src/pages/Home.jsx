import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAtomValue, useSetAtom } from 'jotai'
import http, { chatSocket } from '../api/http.js'
import { tokenAtom, userAtom } from '../store/auth.js'
import { Avatar, displayName } from '../components/Avatar.jsx'

export default function Home() {
  const [contacts, setContacts] = useState([])
  const me = useAtomValue(userAtom)
  const setToken = useSetAtom(tokenAtom)
  const setUser = useSetAtom(userAtom)
  const navigate = useNavigate()

  useEffect(() => {
    http.get('/auth/me').then(({ data }) => setUser(data))
    // 已按最近对话排序
    http.get('/chat/contacts').then(({ data }) => setContacts(data))
    // 保持在线状态，供“添加好友”页展示
    const ws = chatSocket()
    return () => ws.close()
  }, [setUser])

  function logout() {
    setToken('')
    setUser(null)
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen justify-center bg-[#ededed]">
      <div className="flex h-screen w-full max-w-[420px] flex-col overflow-hidden bg-[#f7f7f7] shadow-[0_0_40px_rgba(0,0,0,0.08)] sm:my-4 sm:h-[calc(100vh-2rem)] sm:rounded-xl">
        {/* 顶栏 */}
        <header className="flex items-center justify-between border-b border-black/5 bg-[#ededed] px-4 py-3">
          <span className="text-[17px] font-semibold text-gray-900">CPDD</span>
          <div className="flex items-center gap-2">
            <Link
              to="/lobby"
              className="rounded-md bg-white px-2.5 py-1 text-sm text-gray-600 transition hover:bg-black/5"
            >
              添加好友
            </Link>
            <button
              onClick={logout}
              className="rounded-md px-2 py-1 text-sm text-gray-500 transition hover:bg-black/5 hover:text-gray-700"
            >
              退出
            </button>
            <Avatar user={me} size="sm" />
          </div>
        </header>

        {/* 自己信息 */}
        <div className="border-b border-black/5 bg-white px-4 py-3">
          <div className="flex items-center gap-3">
            <Avatar user={me} size="lg" />
            <p className="truncate text-[15px] font-medium text-gray-900">
              {me?.username || '加载中…'}
            </p>
          </div>
        </div>

        {/* 会话列表 */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-white thin-scrollbar">
          {contacts.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-gray-400">
              还没有其他用户，注册一个新账号即可开始聊天
            </p>
          )}
          {contacts.map((u) => (
            <Link
              key={u.id}
              to={`/chat/${u.id}`}
              className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 transition hover:bg-[#f7f7f7]"
            >
              <Avatar user={u} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] text-gray-900">
                  {displayName(u.username, u.role)}
                </p>
                <p className="mt-0.5 truncate whitespace-nowrap text-xs text-gray-400">
                  {u.last_message || '\u00A0'}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
