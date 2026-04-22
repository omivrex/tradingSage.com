import { useMemo, useState } from "react";
import { z } from "zod";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Alert, Box, Button, Container, Paper, Stack, TextField, Typography } from "@mui/material";
import { useMutation } from "@tanstack/react-query";
import { authApi } from "../lib/api/authApi";
import { getApiErrorMessage } from "../lib/api/client";
import { useAuthStore } from "../store/authStore";

const loginSchema = z.object({
    username: z.string().min(1, "Username is required"),
    password: z.string().min(1, "Password is required"),
});

export const LoginPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const setToken = useAuthStore((s) => s.setToken);
    const [form, setForm] = useState({ username: "", password: "" });
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const redirectTo = useMemo(() => (location.state as { from?: string } | null)?.from || "/dashboard", [location.state]);

    const loginMutation = useMutation({
        mutationFn: authApi.login,
        onSuccess: (data) => {
            setToken(data.access_token);
            navigate(redirectTo, { replace: true });
        },
        onError: (err) => setError(getApiErrorMessage(err)),
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        const result = loginSchema.safeParse(form);
        if (!result.success) {
            const errors = result.error.flatten().fieldErrors;
            setFieldErrors({
                username: errors.username?.[0] || "",
                password: errors.password?.[0] || "",
            });
            return;
        }
        setFieldErrors({});
        loginMutation.mutate(result.data);
    };

    return (
        <Container maxWidth="sm" sx={{ py: 8 }}>
            <Paper sx={{ p: 4 }}>
                <Typography variant="h4" gutterBottom>
                    Login
                </Typography>
                <Box component="form" onSubmit={submit}>
                    <Stack spacing={2}>
                        {error && <Alert severity="error">{error}</Alert>}
                        <TextField
                            label="Username"
                            value={form.username}
                            onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                            error={!!fieldErrors.username}
                            helperText={fieldErrors.username}
                        />
                        <TextField
                            label="Password"
                            type="password"
                            value={form.password}
                            onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                            error={!!fieldErrors.password}
                            helperText={fieldErrors.password}
                        />
                        <Typography variant="body2" sx={{ alignSelf: "flex-start" }}>
                            <Link to="/reset-password">Forgot password?</Link>
                        </Typography>
                        <Button disabled={loginMutation.isPending} type="submit" variant="contained">
                            Sign In
                        </Button>
                        <Typography variant="body2">
                            No account? <Link to="/register">Register</Link>
                        </Typography>
                    </Stack>
                </Box>
            </Paper>
        </Container>
    );
};
