import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Stack,
  Switch,
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
  aggregate: z.boolean().default(false),
  rolling_liquidity: z.boolean().default(false),
  pg: z.string().nullable(),
  tick_chunk_cooldown: z
    .number()
    .gt(0, 'Tick chunk cooldown must be greater than 0')
    .lte(3600, 'Tick chunk cooldown must be <= 3600'),
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
    aggregate: false,
    rolling_liquidity: false,
    pg: '',
    tick_chunk_cooldown: 5,
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
        pg: sessionForm.pg ? sessionForm.pg : null,
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
          tick_chunk_cooldown: errors.tick_chunk_cooldown?.[0] || '',
        })
        throw new Error('Invalid session payload')
      }
      setSessionFieldErrors({})
      return sessionsApi.createSession(parsed.data)
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
      pg: sessionForm.pg ? sessionForm.pg : null,
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
              <Grid size={{ xs: 12, md: 4 }}>
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
              </Grid>
              <Grid size={{ xs: 6, md: 2 }}>
                <TextField
                  type="number"
                  label="stake_pct"
                  value={sessionForm.stake_pct}
                  onChange={(e) => {
                    setSessionForm((p) => ({ ...p, stake_pct: Number(e.target.value) }))
                    setSessionFieldErrors((prev) => ({ ...prev, stake_pct: '' }))
                  }}
                  error={!!sessionFieldErrors.stake_pct}
                  helperText={sessionFieldErrors.stake_pct}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 6, md: 2 }}>
                <TextField
                  type="number"
                  label="session_target_pct"
                  value={sessionForm.session_target_pct}
                  onChange={(e) => {
                    setSessionForm((p) => ({ ...p, session_target_pct: Number(e.target.value) }))
                    setSessionFieldErrors((prev) => ({ ...prev, session_target_pct: '' }))
                  }}
                  error={!!sessionFieldErrors.session_target_pct}
                  helperText={sessionFieldErrors.session_target_pct}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 6, md: 2 }}>
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
              </Grid>
              <Grid size={{ xs: 6, md: 2 }}>
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
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}><TextField label="pg (optional)" value={sessionForm.pg} onChange={(e) => setSessionForm((p) => ({ ...p, pg: e.target.value }))} fullWidth /></Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <TextField
                  type="number"
                  label="tick_chunk_cooldown"
                  value={sessionForm.tick_chunk_cooldown}
                  onChange={(e) => {
                    setSessionForm((p) => ({ ...p, tick_chunk_cooldown: Number(e.target.value) }))
                    setSessionFieldErrors((prev) => ({ ...prev, tick_chunk_cooldown: '' }))
                  }}
                  error={!!sessionFieldErrors.tick_chunk_cooldown}
                  helperText={sessionFieldErrors.tick_chunk_cooldown}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}><Stack direction="row" alignItems="center"><Typography>aggregate</Typography><Switch checked={sessionForm.aggregate} onChange={(_, checked) => setSessionForm((p) => ({ ...p, aggregate: checked }))} /></Stack></Grid>
              <Grid size={{ xs: 6, md: 3 }}><Stack direction="row" alignItems="center"><Typography>rolling_liquidity</Typography><Switch checked={sessionForm.rolling_liquidity} onChange={(_, checked) => setSessionForm((p) => ({ ...p, rolling_liquidity: checked }))} /></Stack></Grid>
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
                <Typography variant="body2">Config: asset_id={sessionDetailQuery.data.asset_id}, stake_pct={sessionDetailQuery.data.stake_pct}, session_target_pct={sessionDetailQuery.data.session_target_pct}, window={sessionDetailQuery.data.window}, granularity={sessionDetailQuery.data.granularity}</Typography>
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
