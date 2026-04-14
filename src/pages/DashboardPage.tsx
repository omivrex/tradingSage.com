import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { enqueueSnackbar } from 'notistack'
import { meApi } from '../lib/api/meApi'
import { assetsApi } from '../lib/api/assetsApi'
import { sessionsApi } from '../lib/api/sessionsApi'
import type { CreateSessionPayload } from '../lib/api/sessionsApi'
import { exportsApi } from '../lib/api/exportsApi'
import { getApiErrorMessage } from '../lib/api/client'
import { queryKeys } from '../lib/queryKeys'

const sessionSchema = z.object({
  asset_id: z.union([
    z.string().min(1, 'Select a saved user asset'),
    z.number().finite('Select a saved user asset'),
  ]),
  stake_pct: z.number().gt(0, 'Stake must be greater than 0').lte(100, 'Stake must be <= 100'),
  session_target_pct: z
    .number()
    .gt(0, 'Session target must be greater than 0')
    .lte(100, 'Session target must be <= 100'),
  window: z.string().trim().min(1, 'Window is required').default('1d'),
  granularity: z.string().trim().min(1, 'Granularity is required').default('5m'),
  rolling_liquidity: z.boolean().default(false),
  rolling_scan_every_n_candles: z
    .number()
    .int('Rolling scan interval must be a whole number')
    .min(1, 'Rolling scan interval must be >= 1'),
  max_trades_per_session: z
    .number()
    .int('Max trades must be a whole number')
    .min(1, 'Max trades must be >= 1')
    .nullable()
    .optional(),
})

export const DashboardPage = () => {
  const qc = useQueryClient()
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [sessionForm, setSessionForm] = useState({
    asset_id: '',
    stake_pct: 1,
    session_target_pct: 1,
    window: '1d',
    granularity: '5m',
    rolling_liquidity: false,
    rolling_scan_every_n_candles: 4,
    max_trades_per_session: '',
  })
  const [derivKey, setDerivKey] = useState('')
  const [sessionFieldErrors, setSessionFieldErrors] = useState<Record<string, string>>({})

  const meQuery = useQuery({ queryKey: queryKeys.me, queryFn: meApi.getMe })
  const myAssetsQuery = useQuery({ queryKey: queryKeys.assetsMine, queryFn: meApi.getMyAssets })
  const catalogQuery = useQuery({ queryKey: queryKeys.assetsCatalog, queryFn: assetsApi.getCatalogAssets, retry: false })
  const sessionsListQuery = useQuery({ queryKey: queryKeys.sessionsList, queryFn: sessionsApi.listSessions })
  const sessionDetailQuery = useQuery({
    queryKey: queryKeys.sessionsDetail(selectedSessionId),
    queryFn: () => sessionsApi.getSessionById(selectedSessionId),
    enabled: !!selectedSessionId,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'pending' || status === 'running' ? 4000 : false
    },
  })

  const updateDerivKeyMutation = useMutation({
    mutationFn: () => meApi.updateDerivKey(derivKey),
    onSuccess: () => enqueueSnackbar('API key updated', { variant: 'success' }),
    onError: (err) => enqueueSnackbar(getApiErrorMessage(err), { variant: 'error' }),
  })

  const saveAssetsMutation = useMutation({
    mutationFn: (symbols: string[]) => meApi.updateMyAssets(symbols),
    onSuccess: async () => {
      enqueueSnackbar('Assets saved', { variant: 'success' })
      await qc.invalidateQueries({ queryKey: queryKeys.assetsMine })
    },
  })

  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const normalized = {
        ...sessionForm,
        max_trades_per_session:
          sessionForm.max_trades_per_session === '' ? undefined : Number(sessionForm.max_trades_per_session),
      }
      const parsed = sessionSchema.safeParse(normalized)
      if (!parsed.success) {
        const errors = parsed.error.flatten().fieldErrors
        setSessionFieldErrors({
          asset_id: errors.asset_id?.[0] || '',
          stake_pct: errors.stake_pct?.[0] || '',
          session_target_pct: errors.session_target_pct?.[0] || '',
          window: errors.window?.[0] || '',
          granularity: errors.granularity?.[0] || '',
          rolling_scan_every_n_candles: errors.rolling_scan_every_n_candles?.[0] || '',
          max_trades_per_session: errors.max_trades_per_session?.[0] || '',
        })
        throw new Error('Invalid session payload')
      }
      setSessionFieldErrors({})
      const payload: CreateSessionPayload = {
        asset_id: parsed.data.asset_id,
        stake_pct: parsed.data.stake_pct,
        session_target_pct: parsed.data.session_target_pct,
        window: parsed.data.window,
        granularity: parsed.data.granularity,
        rolling_liquidity: parsed.data.rolling_liquidity,
        rolling_scan_every_n_candles: parsed.data.rolling_scan_every_n_candles,
        max_trades_per_session: parsed.data.max_trades_per_session,
      }
      return sessionsApi.createSession(payload)
    },
    onSuccess: async (session) => {
      enqueueSnackbar('Session created', { variant: 'success' })
      setSelectedSessionId(session.id)
      await qc.invalidateQueries({ queryKey: queryKeys.sessionsList })
      await qc.invalidateQueries({ queryKey: queryKeys.sessionsDetail(session.id) })
    },
    onError: (err: unknown) => {
      const message = getApiErrorMessage(err)
      if (message.includes('409')) {
        enqueueSnackbar('You already have a pending or running session', { variant: 'warning' })
        return
      }
      enqueueSnackbar(message, { variant: 'error' })
    },
  })

  const stopSessionMutation = useMutation({
    mutationFn: () => sessionsApi.stopSession(selectedSessionId),
    onSuccess: async () => {
      enqueueSnackbar('Stop signal sent', { variant: 'success' })
      await qc.invalidateQueries({ queryKey: queryKeys.sessionsList })
      await qc.invalidateQueries({ queryKey: queryKeys.sessionsDetail(selectedSessionId) })
    },
  })

  const dedupedSymbols = useMemo(
    () => Array.from(new Set(selectedSymbols.map((s) => s.trim().toUpperCase()).filter(Boolean))),
    [selectedSymbols],
  )

  useEffect(() => {
    if (!myAssetsQuery.data?.length) return
    setSelectedSymbols((prev) => {
      if (prev.length > 0) return prev
      return myAssetsQuery.data.map((asset) => asset.symbol)
    })
  }, [myAssetsQuery.data])

  const normalizedSessionPayload = useMemo(
    () => ({
      ...sessionForm,
      window: sessionForm.window.trim(),
      granularity: sessionForm.granularity.trim(),
      max_trades_per_session:
        sessionForm.max_trades_per_session === '' ? undefined : Number(sessionForm.max_trades_per_session),
    }),
    [sessionForm],
  )
  const sessionValidation = sessionSchema.safeParse(normalizedSessionPayload)

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>Dashboard</Typography>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card><CardContent>
            <Typography variant="h6">User Profile</Typography>
            {meQuery.isLoading ? <CircularProgress size={20} /> : (
              <Stack spacing={1} sx={{ mt: 1 }}>
                <Typography><strong>Username:</strong> {meQuery.data?.username}</Typography>
                <Typography><strong>Email:</strong> {meQuery.data?.email}</Typography>
              </Stack>
            )}
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card><CardContent>
            <Typography variant="h6">Update Deriv API Key</Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              <TextField fullWidth label="Deriv API key" value={derivKey} onChange={(e) => setDerivKey(e.target.value)} />
              <Button disabled={!derivKey || updateDerivKeyMutation.isPending} variant="contained" onClick={() => updateDerivKeyMutation.mutate()}>Update</Button>
            </Stack>
          </CardContent></Card>
        </Grid>

        <Grid size={12}>
          <Card><CardContent>
            <Typography variant="h6" gutterBottom>Asset Management</Typography>
            {catalogQuery.isError && (
              <Alert severity="warning" action={<Button onClick={() => catalogQuery.refetch()}>Retry</Button>}>
                Asset catalog is temporarily unavailable (Deriv may be down).
              </Alert>
            )}
            <Autocomplete
              multiple
              sx={{ mt: 2 }}
              options={catalogQuery.data?.map((a) => a.symbol) || []}
              value={selectedSymbols}
              onChange={(_, value) => setSelectedSymbols(value)}
              renderInput={(params) => <TextField {...params} label="Select symbols" />}
            />
            <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap' }}>
              {myAssetsQuery.data?.map((asset) => <Chip key={asset.id} label={`${asset.symbol} (${asset.display_name})`} />)}
            </Stack>
            <Button sx={{ mt: 2 }} variant="contained" disabled={!dedupedSymbols.length || saveAssetsMutation.isPending} onClick={() => saveAssetsMutation.mutate(dedupedSymbols)}>
              Save Selected Symbols
            </Button>
          </CardContent></Card>
        </Grid>

        <Grid size={12}>
          <Card><CardContent>
            <Typography variant="h6" gutterBottom>Create Session</Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Technical configuration</Typography>
                <Stack spacing={2}>
                  <Autocomplete
                    options={myAssetsQuery.data || []}
                    getOptionLabel={(o) => `${o.symbol} - ${o.display_name}`}
                    onChange={(_, value) => {
                      setSessionForm((p) => ({ ...p, asset_id: value?.id || '' }))
                      setSessionFieldErrors((prev) => ({ ...prev, asset_id: '' }))
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Saved User Asset"
                        error={!!sessionFieldErrors.asset_id}
                        helperText={sessionFieldErrors.asset_id}
                      />
                    )}
                  />
                  <TextField
                    label="window"
                    value={sessionForm.window}
                    onChange={(e) => {
                      setSessionForm((p) => ({ ...p, window: e.target.value }))
                      setSessionFieldErrors((prev) => ({ ...prev, window: '' }))
                    }}
                    error={!!sessionFieldErrors.window}
                    helperText={sessionFieldErrors.window}
                    fullWidth
                  />
                  <TextField
                    label="granularity"
                    value={sessionForm.granularity}
                    onChange={(e) => {
                      setSessionForm((p) => ({ ...p, granularity: e.target.value }))
                      setSessionFieldErrors((prev) => ({ ...prev, granularity: '' }))
                    }}
                    error={!!sessionFieldErrors.granularity}
                    helperText={sessionFieldErrors.granularity}
                    fullWidth
                  />
                  <Stack spacing={1}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Checkbox
                        checked={sessionForm.rolling_liquidity}
                        onChange={(e) => setSessionForm((p) => ({ ...p, rolling_liquidity: e.target.checked }))}
                        size="small"
                      />
                      <Typography>rolling window</Typography>
                    </Stack>
                    {sessionForm.rolling_liquidity && (
                      <TextField
                        type="number"
                        label="rolling scan interval (candles)"
                        value={sessionForm.rolling_scan_every_n_candles}
                        onChange={(e) => {
                          setSessionForm((p) => ({ ...p, rolling_scan_every_n_candles: Number(e.target.value) }))
                          setSessionFieldErrors((prev) => ({ ...prev, rolling_scan_every_n_candles: '' }))
                        }}
                        error={!!sessionFieldErrors.rolling_scan_every_n_candles}
                        fullWidth
                        sx={{ maxWidth: 320 }}
                      />
                    )}
                    <Typography variant="caption" color="text.secondary">
                      {sessionFieldErrors.rolling_scan_every_n_candles ||
                        'Every N candles at selected granularity (e.g. 15m x 4 = every 1 hour).'}
                    </Typography>
                  </Stack>
                </Stack>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Target configuration</Typography>
                <Stack spacing={2}>
                  <TextField
                    type="number"
                    label="stake % per trade"
                    value={sessionForm.stake_pct}
                    onChange={(e) => {
                      setSessionForm((p) => ({ ...p, stake_pct: Number(e.target.value) }))
                      setSessionFieldErrors((prev) => ({ ...prev, stake_pct: '' }))
                    }}
                    error={!!sessionFieldErrors.stake_pct}
                    helperText={sessionFieldErrors.stake_pct}
                    fullWidth
                  />
                  <TextField
                    type="number"
                    label="session target %"
                    value={sessionForm.session_target_pct}
                    onChange={(e) => {
                      setSessionForm((p) => ({ ...p, session_target_pct: Number(e.target.value) }))
                      setSessionFieldErrors((prev) => ({ ...prev, session_target_pct: '' }))
                    }}
                    error={!!sessionFieldErrors.session_target_pct}
                    helperText={sessionFieldErrors.session_target_pct}
                    fullWidth
                  />
                  <TextField
                    type="number"
                    label="max trades per session (optional)"
                    value={sessionForm.max_trades_per_session}
                    onChange={(e) => {
                      setSessionForm((p) => ({ ...p, max_trades_per_session: e.target.value }))
                      setSessionFieldErrors((prev) => ({ ...prev, max_trades_per_session: '' }))
                    }}
                    error={!!sessionFieldErrors.max_trades_per_session}
                    helperText={
                      sessionFieldErrors.max_trades_per_session ||
                      'Empty means unlimited. Session stops after N closed trades (win/loss).'
                    }
                    fullWidth
                  />
                  {sessionForm.max_trades_per_session !== '' && (
                    <Typography variant="caption" color="text.secondary">
                      Per-trade TP is derived from session target using 1 / N.
                    </Typography>
                  )}
                </Stack>
              </Grid>
            </Grid>
            <Button
              sx={{ mt: 2 }}
              variant="contained"
              disabled={createSessionMutation.isPending || !sessionValidation.success}
              onClick={() => createSessionMutation.mutate()}
            >
              Start Session
            </Button>
          </CardContent></Card>
        </Grid>

        <Grid size={12}>
          <Card><CardContent>
            <Typography variant="h6">Sessions</Typography>
            {sessionsListQuery.isLoading ? <CircularProgress size={20} /> : (
              <Table size="small">
                <TableHead><TableRow>
                  <TableCell>ID</TableCell><TableCell>Status</TableCell><TableCell>Created</TableCell><TableCell>Started</TableCell><TableCell>Ended</TableCell><TableCell>Error</TableCell>
                </TableRow></TableHead>
                <TableBody>
                  {sessionsListQuery.data?.map((s) => (
                    <TableRow key={s.id} hover selected={selectedSessionId === s.id} onClick={() => setSelectedSessionId(s.id)} sx={{ cursor: 'pointer' }}>
                      <TableCell>{s.id}</TableCell><TableCell>{s.status}</TableCell><TableCell>{s.created_at}</TableCell><TableCell>{s.started_at || '-'}</TableCell><TableCell>{s.ended_at || '-'}</TableCell><TableCell>{s.error_message || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {!sessionsListQuery.data?.length && !sessionsListQuery.isLoading && <Alert sx={{ mt: 2 }} severity="info">No sessions yet.</Alert>}
            <Divider sx={{ my: 2 }} />
            {sessionDetailQuery.data && (
              <Stack spacing={1}>
                <Typography variant="subtitle1">Selected Session: {sessionDetailQuery.data.id}</Typography>
                <Typography variant="body2">
                  Config: asset_id={sessionDetailQuery.data.asset_id}, stake_pct={sessionDetailQuery.data.stake_pct},
                  session_target_pct={sessionDetailQuery.data.session_target_pct}, window={sessionDetailQuery.data.window},
                  granularity={sessionDetailQuery.data.granularity}, rolling_scan_every_n_candles=
                  {sessionDetailQuery.data.rolling_scan_every_n_candles}, max_trades_per_session=
                  {sessionDetailQuery.data.max_trades_per_session ?? 'unlimited'}
                </Typography>
                <TextField multiline minRows={8} value={sessionDetailQuery.data.log_text || ''} label="log_text" InputProps={{ readOnly: true }} />
                <Stack direction="row" spacing={1}>
                  <Button variant="outlined" disabled={!selectedSessionId || stopSessionMutation.isPending} onClick={() => stopSessionMutation.mutate()}>Stop Session</Button>
                  <Button variant="outlined" onClick={() => exportsApi.downloadLogs(selectedSessionId)} disabled={!selectedSessionId}>logs txt</Button>
                  <Button variant="outlined" onClick={() => exportsApi.downloadLiquidity(selectedSessionId)} disabled={!selectedSessionId}>liquidity.csv</Button>
                  <Button variant="outlined" onClick={() => exportsApi.downloadTracks(selectedSessionId)} disabled={!selectedSessionId}>tracks.zip</Button>
                  <Button variant="outlined" onClick={() => exportsApi.downloadOrders(selectedSessionId)} disabled={!selectedSessionId}>orders.csv</Button>
                </Stack>
              </Stack>
            )}
          </CardContent></Card>
        </Grid>
      </Grid>
    </Box>
  )
}
