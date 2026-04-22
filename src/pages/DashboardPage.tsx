import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
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
    Fab,
    Grid,
    IconButton,
    Modal,
    Stack,
    Switch,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from "@mui/material";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import CloseIcon from "@mui/icons-material/Close";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { meApi } from "../lib/api/meApi";
import { assetsApi } from "../lib/api/assetsApi";
import { sessionsApi } from "../lib/api/sessionsApi";
import type { CreateSessionPayload } from "../lib/api/sessionsApi";
import { exportsApi } from "../lib/api/exportsApi";
import { getApiErrorMessage } from "../lib/api/client";
import { queryKeys } from "../lib/queryKeys";

const sessionSchema = z
    .object({
        asset_id: z.union([z.string().min(1, "Select a saved user asset"), z.number().finite("Select a saved user asset")]),
        stake_pct: z.number().gt(0, "Stake must be greater than 0").lte(100, "Stake must be <= 100"),
        session_target_pct: z.number().gt(0, "Session target must be greater than 0").lte(100, "Session target must be <= 100"),
        granularity: z.string().trim().min(1, "Granularity is required").default("1m"),
        mode: z.enum(["backtest", "trade"]).default("backtest"),
        start: z.string().min(1, "Sampling start is required"),
        end: z.string().nullable().optional(),
        rolling_liquidity: z.boolean().default(false),
        rolling_scan_every_n_candles: z.number().int("Rolling scan interval must be a whole number").min(1, "Rolling scan interval must be >= 1"),
        max_trades_per_session: z.number().int("Max trades must be a whole number").min(1, "Max trades must be >= 1").nullable().optional(),
    })
    .superRefine((data, ctx) => {
        if (data.mode === "backtest" && data.end) {
            const startTs = Date.parse(data.start);
            const endTs = Date.parse(data.end);
            if (Number.isFinite(startTs) && Number.isFinite(endTs) && endTs <= startTs) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["end"],
                    message: "End must be later than start",
                });
            }
        }
    });

export const DashboardPage = () => {
    const qc = useQueryClient();
    const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
    const [selectedSessionId, setSelectedSessionId] = useState("");
    const [sessionForm, setSessionForm] = useState({
        asset_id: "",
        stake_pct: 0.1,
        session_target_pct: 1,
        granularity: "1m",
        mode: "backtest" as "backtest" | "trade",
        start: "",
        end: "",
        rolling_liquidity: false,
        rolling_scan_every_n_candles: 5,
        max_trades_per_session: "5",
    });
    const [derivKey, setDerivKey] = useState("");
    const [sessionFieldErrors, setSessionFieldErrors] = useState<Record<string, string>>({});
    const [exportJobId, setExportJobId] = useState<string | null>(null);
    const [exportStatus, setExportStatus] = useState<"idle" | "starting" | "polling" | "ready" | "downloading" | "error">("idle");
    const [exportErrorMessage, setExportErrorMessage] = useState<string | null>(null);
    const [exportStartedAt, setExportStartedAt] = useState<number | null>(null);
    const logsContainerRef = useRef<HTMLDivElement | null>(null);

    const meQuery = useQuery({ queryKey: queryKeys.me, queryFn: meApi.getMe });
    const myAssetsQuery = useQuery({ queryKey: queryKeys.assetsMine, queryFn: meApi.getMyAssets });
    const catalogQuery = useQuery({ queryKey: queryKeys.assetsCatalog, queryFn: assetsApi.getCatalogAssets, retry: false });
    const sessionsListQuery = useQuery({ queryKey: queryKeys.sessionsList, queryFn: sessionsApi.listSessions });
    const sessionDetailQuery = useQuery({
        queryKey: queryKeys.sessionsDetail(selectedSessionId),
        queryFn: () => sessionsApi.getSessionById(selectedSessionId),
        enabled: !!selectedSessionId,
        refetchInterval: (query) => {
            const status = query.state.data?.status;
            return status === "pending" || status === "running" ? 4000 : false;
        },
    });

    const updateDerivKeyMutation = useMutation({
        mutationFn: () => meApi.updateDerivKey(derivKey),
        onSuccess: () => enqueueSnackbar("API key updated", { variant: "success" }),
        onError: (err) => enqueueSnackbar(getApiErrorMessage(err), { variant: "error" }),
    });

    const saveAssetsMutation = useMutation({
        mutationFn: (symbols: string[]) => meApi.updateMyAssets(symbols),
        onSuccess: async () => {
            enqueueSnackbar("Assets saved", { variant: "success" });
            await qc.invalidateQueries({ queryKey: queryKeys.assetsMine });
        },
    });

    const createSessionMutation = useMutation({
        mutationFn: async () => {
            const normalized = {
                ...sessionForm,
                start: sessionForm.start,
                end: sessionForm.mode === "trade" || sessionForm.end === "" ? undefined : sessionForm.end,
                max_trades_per_session: sessionForm.max_trades_per_session === "" ? undefined : Number(sessionForm.max_trades_per_session),
            };
            const parsed = sessionSchema.safeParse(normalized);
            if (!parsed.success) {
                const errors = parsed.error.flatten().fieldErrors;
                setSessionFieldErrors({
                    asset_id: errors.asset_id?.[0] || "",
                    stake_pct: errors.stake_pct?.[0] || "",
                    session_target_pct: errors.session_target_pct?.[0] || "",
                    granularity: errors.granularity?.[0] || "",
                    mode: errors.mode?.[0] || "",
                    start: errors.start?.[0] || "",
                    end: errors.end?.[0] || "",
                    rolling_scan_every_n_candles: errors.rolling_scan_every_n_candles?.[0] || "",
                    max_trades_per_session: errors.max_trades_per_session?.[0] || "",
                });
                throw new Error("Invalid session payload");
            }
            setSessionFieldErrors({});
            const payload: CreateSessionPayload = {
                asset_id: parsed.data.asset_id,
                stake_pct: parsed.data.stake_pct,
                session_target_pct: parsed.data.session_target_pct,
                granularity: parsed.data.granularity,
                mode: parsed.data.mode,
                start: new Date(parsed.data.start).toISOString(),
                end: parsed.data.mode === "backtest" && parsed.data.end ? new Date(parsed.data.end).toISOString() : undefined,
                rolling_liquidity: parsed.data.rolling_liquidity,
                rolling_scan_every_n_candles: parsed.data.rolling_scan_every_n_candles,
                max_trades_per_session: parsed.data.max_trades_per_session,
            };
            return sessionsApi.createSession(payload);
        },
        onSuccess: async (session) => {
            enqueueSnackbar("Session created", { variant: "success" });
            setSelectedSessionId(session.id);
            await qc.invalidateQueries({ queryKey: queryKeys.sessionsList });
            await qc.invalidateQueries({ queryKey: queryKeys.sessionsDetail(session.id) });
        },
        onError: (err: unknown) => {
            const message = getApiErrorMessage(err);
            if (message.includes("409")) {
                enqueueSnackbar("You already have a pending or running session", { variant: "warning" });
                return;
            }
            enqueueSnackbar(message, { variant: "error" });
        },
    });

    const stopSessionMutation = useMutation({
        mutationFn: () => sessionsApi.stopSession(selectedSessionId),
        onSuccess: async () => {
            enqueueSnackbar("Stop signal sent", { variant: "success" });
            await qc.invalidateQueries({ queryKey: queryKeys.sessionsList });
            await qc.invalidateQueries({ queryKey: queryKeys.sessionsDetail(selectedSessionId) });
        },
    });

    const startExportMutation = useMutation({
        mutationFn: async () => {
            if (!selectedSessionId) throw new Error("Select a session first");
            return exportsApi.startBundleExport(selectedSessionId);
        },
        onMutate: () => {
            setExportStatus("starting");
            setExportErrorMessage(null);
        },
        onSuccess: (jobId) => {
            setExportJobId(jobId);
            setExportStatus("polling");
            setExportStartedAt(Date.now());
        },
        onError: (err) => {
            setExportStatus("error");
            setExportErrorMessage(getApiErrorMessage(err));
        },
    });

    const downloadExportMutation = useMutation({
        mutationFn: async () => {
            if (!selectedSessionId || !exportJobId) throw new Error("No ready export to download");
            await exportsApi.downloadBundleZip(selectedSessionId, exportJobId);
        },
        onMutate: () => setExportStatus("downloading"),
        onSuccess: () => {
            setExportStatus("ready");
            enqueueSnackbar("Download complete", { variant: "success" });
        },
        onError: (err) => {
            setExportStatus("error");
            setExportErrorMessage(getApiErrorMessage(err));
        },
    });

    const dedupedSymbols = useMemo(() => Array.from(new Set(selectedSymbols.map((s) => s.trim().toUpperCase()).filter(Boolean))), [selectedSymbols]);

    useEffect(() => {
        if (!myAssetsQuery.data?.length) return;
        setSelectedSymbols((prev) => {
            if (prev.length > 0) return prev;
            return myAssetsQuery.data.map((asset) => asset.symbol);
        });
    }, [myAssetsQuery.data]);

    const normalizedSessionPayload = useMemo(
        () => ({
            ...sessionForm,
            granularity: sessionForm.granularity.trim(),
            mode: sessionForm.mode,
            start: sessionForm.start,
            end: sessionForm.mode === "trade" || sessionForm.end === "" ? undefined : sessionForm.end,
            max_trades_per_session: sessionForm.max_trades_per_session === "" ? undefined : Number(sessionForm.max_trades_per_session),
        }),
        [sessionForm],
    );
    const sessionValidation = sessionSchema.safeParse(normalizedSessionPayload);
    const exportElapsedSeconds = exportStartedAt ? Math.floor((Date.now() - exportStartedAt) / 1000) : 0;
    const isSessionModalOpen = !!selectedSessionId;

    useEffect(() => {
        setExportJobId(null);
        setExportStatus("idle");
        setExportErrorMessage(null);
        setExportStartedAt(null);
    }, [selectedSessionId]);

    useEffect(() => {
        if (!selectedSessionId || !exportJobId || exportStatus !== "polling") return;

        const pollIntervalMs = 3000;
        const maxPollMs = 30 * 60 * 1000;
        let cancelled = false;

        const poll = async () => {
            if (cancelled) return;
            if (exportStartedAt && Date.now() - exportStartedAt > maxPollMs) {
                setExportStatus("error");
                setExportErrorMessage("Export timed out after 30 minutes. Please retry export.");
                return;
            }
            try {
                const job = await exportsApi.getBundleExportJob(selectedSessionId, exportJobId);
                if (cancelled) return;
                if (job.status === "ready") {
                    setExportStatus("ready");
                    enqueueSnackbar("Export ready", { variant: "success" });
                    return;
                }
                if (job.status === "error") {
                    setExportStatus("error");
                    setExportErrorMessage(job.error_message || "Export job failed.");
                    return;
                }
            } catch (err) {
                setExportStatus("error");
                setExportErrorMessage(getApiErrorMessage(err));
            }
        };

        void poll();
        const timer = setInterval(() => {
            void poll();
        }, pollIntervalMs);

        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [selectedSessionId, exportJobId, exportStatus, exportStartedAt]);

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom>
                Dashboard
            </Typography>
            <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6">User Profile</Typography>
                            {meQuery.isLoading ? (
                                <CircularProgress size={20} />
                            ) : (
                                <Stack spacing={1} sx={{ mt: 1 }}>
                                    <Typography>
                                        <strong>Username:</strong> {meQuery.data?.username}
                                    </Typography>
                                    <Typography>
                                        <strong>Email:</strong> {meQuery.data?.email}
                                    </Typography>
                                </Stack>
                            )}
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6">Update Deriv API Key</Typography>
                            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                                <TextField fullWidth label="Deriv API key" value={derivKey} onChange={(e) => setDerivKey(e.target.value)} />
                                <Button
                                    disabled={!derivKey || updateDerivKeyMutation.isPending}
                                    variant="contained"
                                    onClick={() => updateDerivKeyMutation.mutate()}
                                >
                                    Update
                                </Button>
                            </Stack>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid size={12}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                Asset Management
                            </Typography>
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
                            <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: "wrap" }}>
                                {myAssetsQuery.data?.map((asset) => (
                                    <Chip key={asset.id} label={`${asset.symbol} (${asset.display_name})`} />
                                ))}
                            </Stack>
                            <Button
                                sx={{ mt: 2 }}
                                variant="contained"
                                disabled={!dedupedSymbols.length || saveAssetsMutation.isPending}
                                onClick={() => saveAssetsMutation.mutate(dedupedSymbols)}
                            >
                                Save Selected Symbols
                            </Button>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid size={12}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                Create Session
                            </Typography>
                            <Grid container spacing={2}>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                        Technical configuration
                                    </Typography>
                                    <Stack spacing={2}>
                                        <Autocomplete
                                            options={myAssetsQuery.data || []}
                                            getOptionLabel={(o) => `${o.symbol} - ${o.display_name}`}
                                            onChange={(_, value) => {
                                                setSessionForm((p) => ({ ...p, asset_id: value?.id || "" }));
                                                setSessionFieldErrors((prev) => ({ ...prev, asset_id: "" }));
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
                                            type="datetime-local"
                                            label="Sampling start"
                                            value={sessionForm.start}
                                            onChange={(e) => {
                                                setSessionForm((p) => ({ ...p, start: e.target.value }));
                                                setSessionFieldErrors((prev) => ({ ...prev, start: "" }));
                                            }}
                                            error={!!sessionFieldErrors.start}
                                            helperText={sessionFieldErrors.start}
                                            fullWidth
                                            InputLabelProps={{ shrink: true }}
                                        />
                                        {sessionForm.mode === "backtest" && (
                                            <TextField
                                                type="datetime-local"
                                                label="Sampling end (optional)"
                                                value={sessionForm.end}
                                                onChange={(e) => {
                                                    setSessionForm((p) => ({ ...p, end: e.target.value }));
                                                    setSessionFieldErrors((prev) => ({ ...prev, end: "" }));
                                                }}
                                                error={!!sessionFieldErrors.end}
                                                helperText={sessionFieldErrors.end || "If omitted, end defaults to current time when session starts."}
                                                fullWidth
                                                InputLabelProps={{ shrink: true }}
                                            />
                                        )}
                                        <Stack spacing={1}>
                                            <Stack direction="row" alignItems="center" spacing={1}>
                                                <Typography>Trade mode</Typography>
                                                <Switch
                                                    checked={sessionForm.mode === "trade"}
                                                    onChange={(e) => {
                                                        const isTrade = e.target.checked;
                                                        setSessionForm((p) => ({
                                                            ...p,
                                                            mode: isTrade ? "trade" : "backtest",
                                                            end: isTrade ? "" : p.end,
                                                        }));
                                                        setSessionFieldErrors((prev) => ({ ...prev, mode: "", end: "" }));
                                                    }}
                                                    size="small"
                                                />
                                            </Stack>
                                        </Stack>
                                        <TextField
                                            label="granularity"
                                            value={sessionForm.granularity}
                                            onChange={(e) => {
                                                setSessionForm((p) => ({ ...p, granularity: e.target.value }));
                                                setSessionFieldErrors((prev) => ({ ...prev, granularity: "" }));
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
                                                        setSessionForm((p) => ({ ...p, rolling_scan_every_n_candles: Number(e.target.value) }));
                                                        setSessionFieldErrors((prev) => ({ ...prev, rolling_scan_every_n_candles: "" }));
                                                    }}
                                                    error={!!sessionFieldErrors.rolling_scan_every_n_candles}
                                                    fullWidth
                                                    sx={{ maxWidth: 320 }}
                                                />
                                            )}
                                            <Typography variant="caption" color="text.secondary">
                                                {sessionFieldErrors.rolling_scan_every_n_candles ||
                                                    "Every N candles at selected granularity (e.g. 1m x 5 = every 5 minutes)."}
                                            </Typography>
                                        </Stack>
                                    </Stack>
                                </Grid>

                                <Grid size={{ xs: 12, md: 6 }}>
                                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                        Target configuration
                                    </Typography>
                                    <Stack spacing={2}>
                                        <TextField
                                            type="number"
                                            label="stake % per trade"
                                            value={sessionForm.stake_pct}
                                            onChange={(e) => {
                                                setSessionForm((p) => ({ ...p, stake_pct: Number(e.target.value) }));
                                                setSessionFieldErrors((prev) => ({ ...prev, stake_pct: "" }));
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
                                                setSessionForm((p) => ({ ...p, session_target_pct: Number(e.target.value) }));
                                                setSessionFieldErrors((prev) => ({ ...prev, session_target_pct: "" }));
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
                                                setSessionForm((p) => ({ ...p, max_trades_per_session: e.target.value }));
                                                setSessionFieldErrors((prev) => ({ ...prev, max_trades_per_session: "" }));
                                            }}
                                            error={!!sessionFieldErrors.max_trades_per_session}
                                            helperText={
                                                sessionFieldErrors.max_trades_per_session ||
                                                `Empty means unlimited. Session stops after N closed trades (win/loss). \n
                                                Per-trade TP is derived from session target using 1 / N.\n
                                                ${sessionForm.max_trades_per_session !== "" ? `Per-trade TP is ${1 / Number(sessionForm.max_trades_per_session)}%` : ""}`
                                            }
                                            fullWidth
                                        />
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
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                                {sessionForm.mode === "trade" ? "Real Deriv orders may be placed." : "No real orders will be placed."}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid size={12}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6">Sessions</Typography>
                            {sessionsListQuery.isLoading ? (
                                <CircularProgress size={20} />
                            ) : (
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>ID</TableCell>
                                            <TableCell>Status</TableCell>
                                            <TableCell>Created</TableCell>
                                            <TableCell>Started</TableCell>
                                            <TableCell>Ended</TableCell>
                                            <TableCell>Error</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {sessionsListQuery.data?.map((s) => (
                                            <TableRow
                                                key={s.id}
                                                hover
                                                selected={selectedSessionId === s.id}
                                                onClick={() => setSelectedSessionId((prev) => (prev === s.id ? "" : s.id))}
                                                sx={{ cursor: "pointer" }}
                                            >
                                                <TableCell>{s.id}</TableCell>
                                                <TableCell>{s.status}</TableCell>
                                                <TableCell>{s.created_at}</TableCell>
                                                <TableCell>{s.started_at || "-"}</TableCell>
                                                <TableCell>{s.ended_at || "-"}</TableCell>
                                                <TableCell>{s.error_message || "-"}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                            {!sessionsListQuery.data?.length && !sessionsListQuery.isLoading && (
                                <Alert sx={{ mt: 2 }} severity="info">
                                    No sessions yet.
                                </Alert>
                            )}
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
            <Modal open={isSessionModalOpen} onClose={() => setSelectedSessionId("")}>
                <Box
                    sx={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        width: { xs: "97vw", md: "92vw" },
                        height: { xs: "92vh", md: "92vh" },
                        bgcolor: "background.paper",
                        borderRadius: 1,
                        boxShadow: 24,
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                    }}
                >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
                        <Typography variant="h6">Session {selectedSessionId || ""}</Typography>
                        <IconButton aria-label="close logs" onClick={() => setSelectedSessionId("")}>
                            <CloseIcon />
                        </IconButton>
                    </Stack>

                    <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
                        {sessionDetailQuery.isLoading && <CircularProgress size={20} />}
                        {sessionDetailQuery.data && (
                            <Typography variant="body2">
                                Config: asset_id={sessionDetailQuery.data.asset_id}, stake_pct={sessionDetailQuery.data.stake_pct}, session_target_pct=
                                {sessionDetailQuery.data.session_target_pct}, mode={sessionDetailQuery.data.mode || "-"}, start=
                                {sessionDetailQuery.data.start || "-"}, end={sessionDetailQuery.data.end ?? "-"}, granularity=
                                {sessionDetailQuery.data.granularity}, rolling_scan_every_n_candles=
                                {sessionDetailQuery.data.rolling_scan_every_n_candles}, max_trades_per_session=
                                {sessionDetailQuery.data.max_trades_per_session ?? "unlimited"}
                            </Typography>
                        )}
                        <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: "wrap", justifyContent: "flex-end" }}>
                            <Button
                                variant="outlined"
                                disabled={!selectedSessionId || stopSessionMutation.isPending}
                                onClick={() => stopSessionMutation.mutate()}
                            >
                                Stop Session
                            </Button>
                            <Button
                                variant="outlined"
                                disabled={!selectedSessionId || exportStatus === "starting" || exportStatus === "polling" || exportStatus === "downloading"}
                                onClick={() => startExportMutation.mutate()}
                            >
                                {exportStatus === "starting" ? "Preparing export…" : "Prepare Export ZIP"}
                            </Button>
                            <Button
                                variant="contained"
                                disabled={!selectedSessionId || exportStatus !== "ready" || downloadExportMutation.isPending}
                                onClick={() => downloadExportMutation.mutate()}
                            >
                                {exportStatus === "downloading" ? "Downloading…" : "Download ZIP"}
                            </Button>
                        </Stack>
                        {exportStatus === "polling" && (
                            <Alert sx={{ mt: 2 }} severity="info">
                                Exporting… {exportElapsedSeconds > 0 ? `(${exportElapsedSeconds}s elapsed)` : ""}
                            </Alert>
                        )}
                        {exportStatus === "ready" && (
                            <Alert sx={{ mt: 2 }} severity="success">
                                Export ready. Click Download ZIP.
                            </Alert>
                        )}
                        {exportStatus === "error" && (
                            <Alert
                                sx={{ mt: 2 }}
                                severity="error"
                                action={
                                    <Button color="inherit" size="small" onClick={() => startExportMutation.mutate()}>
                                        Retry export
                                    </Button>
                                }
                            >
                                {exportErrorMessage || "Export failed."}
                            </Alert>
                        )}
                    </Box>

                    <Box ref={logsContainerRef} sx={{ p: 2, overflowY: "auto", flex: 1, position: "relative" }}>
                        <TextField
                            multiline
                            minRows={20}
                            value={sessionDetailQuery.data?.log_text || ""}
                            label="log_text"
                            InputProps={{ readOnly: true }}
                            fullWidth
                        />
                        {sessionDetailQuery.data && (
                            <Fab
                                color="primary"
                                size="small"
                                aria-label="scroll logs to top"
                                onClick={() => logsContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
                                sx={{ position: "sticky", bottom: 12, mt: 2, left: "calc(100% - 48px)" }}
                            >
                                <KeyboardArrowUpIcon />
                            </Fab>
                        )}
                    </Box>
                </Box>
            </Modal>
        </Box>
    );
};
