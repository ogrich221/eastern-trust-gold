import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Set a New Password | Eastern Trust Bank" },
      { name: "description", content: "Choose a new password for your Eastern Trust Bank account." },
      { property: "og:title", content: "Set a New Password | Eastern Trust Bank" },
      { property: "og:description", content: "Securely choose a new online banking password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [checked, setChecked] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (session && event === "SIGNED_IN")) {
        setReady(true);
        setChecked(true);
      }
    });
    const hash = window.location.hash;
    const hashErr = new URLSearchParams(hash.slice(1)).get("error_description");
    if (hashErr) setError(hashErr.replace(/\+/g, " "));
    supabase.auth.getSession().then(({ data: s }) => {
      if (s.session) setReady(true);
      setTimeout(() => setChecked(true), s.session ? 0 : 2500);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(error.message);
    setDone(true);
    setTimeout(() => navigate({ to: "/dashboard" }), 1500);
  };

  return (
    <main className="min-h-[calc(100vh-5rem)] py-16">
      <div className="mx-auto max-w-md px-5">
        <div className="mb-10 text-center">
          <LockKeyhole className="mx-auto size-8 text-primary" />
          <h1 className="mt-5 text-5xl">New password.</h1>
          <p className="mt-3 text-sm text-muted-foreground">Choose a strong password you haven't used before.</p>
        </div>
        <div className="border border-border bg-card p-7">
          {done ? (
            <p className="text-center text-sm">Password updated. Taking you to your account…</p>
          ) : !ready ? (
            <div className="space-y-4 text-center text-sm">
              <p>{checked ? (error || "This reset link is invalid or has expired.") : "Verifying your reset link…"}</p>
              {checked && <Button asChild variant="outline" className="w-full"><Link to="/forgot-password">Request a new link</Link></Button>}
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <div>
                <Label htmlFor="pw">New password</Label>
                <PasswordInput id="pw" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2" inputClassName="h-11" />
              </div>
              <div>
                <Label htmlFor="pw2">Confirm new password</Label>
                <PasswordInput id="pw2" autoComplete="new-password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-2" inputClassName="h-11" />
              </div>
              {error && <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">{error}</p>}
              <Button className="h-11 w-full" disabled={busy}>{busy ? "Saving…" : "Update password"}</Button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
