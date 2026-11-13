import { atom } from 'jotai'

const TOKEN_KEY = 'cpdd_fe_token'
const USER_KEY = 'cpdd_fe_user'

const baseTokenAtom = atom(localStorage.getItem(TOKEN_KEY) || '')

// 写入时同步到 localStorage，刷新页面保持登录态
export const tokenAtom = atom(
  (get) => get(baseTokenAtom),
  (get, set, next) => {
    set(baseTokenAtom, next)
    if (next) localStorage.setItem(TOKEN_KEY, next)
    else localStorage.removeItem(TOKEN_KEY)
  },
)

function readUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null')
  } catch {
    return null
  }
}

const baseUserAtom = atom(readUser())

// 持久化当前用户，刷新后仍能正确判断消息归属（左右排版）
export const userAtom = atom(
  (get) => get(baseUserAtom),
  (get, set, next) => {
    set(baseUserAtom, next)
    if (next) localStorage.setItem(USER_KEY, JSON.stringify(next))
    else localStorage.removeItem(USER_KEY)
  },
)
