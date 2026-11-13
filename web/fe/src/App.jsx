import { Routes, Route, Navigate } from 'react-router-dom'
import { useAtomValue } from 'jotai'
import { tokenAtom } from './store/auth.js'
import Login from './pages/Login.jsx'
import Home from './pages/Home.jsx'
import Detail from './pages/Detail.jsx'
import ConfirmQr from './pages/ConfirmQr.jsx'
import Lobby from './pages/Lobby.jsx'

function RequireAuth({ children }) {
  const token = useAtomValue(tokenAtom)
  return token ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/qr/:id" element={<ConfirmQr />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Home />
          </RequireAuth>
        }
      />
      <Route
        path="/chat/:id"
        element={
          <RequireAuth>
            <Detail />
          </RequireAuth>
        }
      />
      <Route
        path="/lobby"
        element={
          <RequireAuth>
            <Lobby />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
