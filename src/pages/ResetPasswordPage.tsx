import { useState } from "react";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import { Alert, Box, Button, Container, Paper, Stack, TextField, Typography } from "@mui/material";
import { useMutation } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { authApi } from "../lib/api/authApi";
import { getApiErrorMessage } from "../lib/api/client";

const resetSchema = z
    .object({
        email: z.email("Enter a valid email"),
        password: z.string().min(8, "Password must be at least 8 characters"),
        confirm_password: z.string().min(1, "Confirm your password"),
    })
    .refine((data) => data.password === data.confirm_password, {
        message: "Passwords do not match",
        path: ["confirm_password"],
    });

export const ResetPasswordPage = () => {
    const navigate = useNavigate();
    const [form, setForm] = useState({
        email: "",
        password: "",
        confirm_password: "",
    });
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const resetMutation = useMutation({
        mutationFn: authApi.resetPassword,
        onSuccess: () => {
            enqueueSnackbar("Password updated. You can sign in.", { variant: "success" });
            navigate("/login", { replace: true });
        },
        onError: (err) => setError(getApiErrorMessage(err)),
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        const result = resetSchema.safeParse(form);
        if (!result.success) {
            const errors = result.error.flatten().fieldErrors;
            setFieldErrors({
                email: errors.email?.[0] || "",
                password: errors.password?.[0] || "",
                confirm_password: errors.confirm_password?.[0] || "",
            });
            return;
        }
        setFieldErrors({});
        resetMutation.mutate({
            email: result.data.email,
            password: result.data.password,
            confirm_password: result.data.confirm_password,
        });
    };

    return (
        <Container maxWidth="sm" sx={{ py: 8 }}>
            <Paper sx={{ p: 4 }}>
                <Typography variant="h4" gutterBottom>
                    Reset password
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Enter the email for your account and choose a new password.
                </Typography>
                <Box component="form" onSubmit={submit}>
                    <Stack spacing={2}>
                        {error && <Alert severity="error">{error}</Alert>}
                        <TextField
                            label="Email"
                            type="email"
                            autoComplete="email"
                            value={form.email}
                            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                            error={!!fieldErrors.email}
                            helperText={fieldErrors.email}
                            fullWidth
                        />
                        <TextField
                            label="New password"
                            type="password"
                            autoComplete="new-password"
                            value={form.password}
                            onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                            error={!!fieldErrors.password}
                            helperText={fieldErrors.password}
                            fullWidth
                        />
                        <TextField
                            label="Confirm new password"
                            type="password"
                            autoComplete="new-password"
                            value={form.confirm_password}
                            onChange={(e) => setForm((p) => ({ ...p, confirm_password: e.target.value }))}
                            error={!!fieldErrors.confirm_password}
                            helperText={fieldErrors.confirm_password}
                            fullWidth
                        />
                        <Button disabled={resetMutation.isPending} type="submit" variant="contained">
                            Update password
                        </Button>
                        <Typography variant="body2">
                            <Link to="/login">Back to login</Link>
                        </Typography>
                    </Stack>
                </Box>
            </Paper>
        </Container>
    );
};
