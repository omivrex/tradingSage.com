import { useState } from 'react'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { Alert, Box, Button, Container, Paper, Stack, TextField, Typography } from '@mui/material'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../lib/api/authApi'
import { getApiErrorMessage } from '../lib/api/client'

const registerSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  email: z.email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  deriv_api_token: z.string().min(1, 'Deriv API key is required'),
})

export const RegisterPage = () => {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    deriv_api_token: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const registerMutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: () => navigate('/login'),
    onError: (err) => setError(getApiErrorMessage(err)),
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const result = registerSchema.safeParse(form)
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors
      setFieldErrors({
        username: errors.username?.[0] || '',
        email: errors.email?.[0] || '',
        password: errors.password?.[0] || '',
        deriv_api_token: errors.deriv_api_token?.[0] || '',
      })
      return
    }
    setFieldErrors({})
    registerMutation.mutate(result.data)
  }

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>Register</Typography>
        <Box component="form" onSubmit={submit}>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="Username" value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} error={!!fieldErrors.username} helperText={fieldErrors.username} />
            <TextField label="Email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} error={!!fieldErrors.email} helperText={fieldErrors.email} />
            <TextField label="Password" type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} error={!!fieldErrors.password} helperText={fieldErrors.password} />
            <TextField label="Deriv API key" value={form.deriv_api_token} onChange={(e) => setForm((p) => ({ ...p, deriv_api_token: e.target.value }))} error={!!fieldErrors.deriv_api_token} helperText={fieldErrors.deriv_api_token} />
            <Button disabled={registerMutation.isPending} type="submit" variant="contained">Create Account</Button>
            <Typography variant="body2">Already have an account? <Link to="/login">Login</Link></Typography>
          </Stack>
        </Box>
      </Paper>
    </Container>
  )
}
