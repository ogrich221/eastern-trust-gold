import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Forgot Password | Eastern Trust Bank" },
      { name: "description", content: "Reset your Eastern Trust Bank online banking password." },
      { property: "og:title", content: "Forgot Password | Eastern Trust Bank" },
      { property: "og:description", content: "Request a secure password reset link." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ForgotPage,
});

function ForgotPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  };

  return (
    <main className="min-h-[calc(100vh-5rem)] py-16">
      <div className="mx-auto max-w-md px-5">
        <div className="mb-10 text-center">
          <KeyRound className="mx-auto size-8 text-primary" />
          <h1 className="mt-5 text-5xl">Forgot password?</h1>
          <p className="mt-3 text-sm text-muted-foreground">Enter your email and we'll send you a secure reset link.</p>
        </div>
        <div className="border border-border bg-card p-7">
          {sent ? (
            <div className="space-y-4 text-center text-sm">
              <p>If an account exists for <strong>{email}</strong>, a reset link is on its way. Check your Inbox and Spam folder.</p>
              <Button asChild variant="outline" className="w-full"><Link to="/auth">Back to log in</Link></Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <div>
                <Label htmlFor="email">Email address</Label>
                <Input id="email" type="email" required maxLength={255} value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 h-11" />
              </div>
              {error && <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">{error}</p>}
              <Button className="h-11 w-full" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</Button>
              <p className="text-center text-sm text-muted-foreground">
                Remembered it? <Link to="/auth" className="text-primary hover:underline">Log in</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
