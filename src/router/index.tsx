import { useEffect } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { Button, Container, Stack } from '@mui/material'
import { LoginPage } from '../pages/LoginPage'
import { RegisterPage } from '../pages/RegisterPage'
import { DashboardPage } from '../pages/DashboardPage'
import { ProtectedRoute } from './ProtectedRoute'
import { setUnauthorizedHandler } from '../lib/navigation'
import { useAuthStore } from '../store/authStore'

const DashboardLayout = () => {
  const clearToken = useAuthStore((s) => s.clearToken)
  const navigate = useNavigate()
  return (
    <Container maxWidth="xl" sx={{ py: 2 }}>
      <Stack direction="row" justifyContent="flex-end">
        <Button
          onClick={() => {
            clearToken()
            navigate('/login')
          }}
        >
          Logout
        </Button>
      </Stack>
      <DashboardPage />
    </Container>
  )
}

export const AppRouter = () => {
  const navigate = useNavigate()

  useEffect(() => {
    setUnauthorizedHandler(() => navigate('/login', { replace: true }))
  }, [navigate])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardLayout />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
