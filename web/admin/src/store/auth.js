import { atom } from 'jotai'

const TOKEN_KEY = 'cpdd_admin_token'

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
