import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Chrome, LockKeyhole } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  staticData: { sitemap: false }, head: () => ({ meta: [{ title: "Log In | Eastern Trust Bank" },{ name: "description", content: "Securely access your Eastern Trust Bank account." },{ property: "og:title", content: "Log In | Eastern Trust Bank" },{ property: "og:description", content: "Secure customer account access." },{ property: "og:type", content: "website" },{ name: "twitter:card", content: "summary" }] }), component: AuthPage });

import { toast } from "sonner";

let adminLoginAttempt: { token: string; result: Promise<string | null> } | null = null;

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    let on = true;
    const go = () => {
      if (on) navigate({ to: "/dashboard" });
    };
    const params = new URLSearchParams(window.location.search);
    const loginToken = params.get("login_token");
    if (loginToken) {
      const otpType = params.get("login_type") === "signup" ? "signup" : "magiclink";
      // Verify once per page load (effects can run twice); the token is single-use.
      if (!adminLoginAttempt || adminLoginAttempt.token !== loginToken) {
        adminLoginAttempt = {
          token: loginToken,
          result: (async () => {
            await supabase.auth.signOut({ scope: "local" });
            const { data, error: otpError } = await supabase.auth.verifyOtp({ token_hash: loginToken, type: otpType });
            if (otpError || !data.session) return otpError?.message || "No session was created.";
            return null;
          })(),
        };
      }
      adminLoginAttempt.result.then((msg) => {
        if (!on) return;
        if (msg) {
          setError(`Could not sign in to this customer's account (${msg}). Please press "Log in as user" again in the admin portal.`);
        } else {
          window.history.replaceState(null, "", "/auth");
          navigate({ to: "/dashboard", replace: true });
        }
      });
      return () => { on = false; };
    }
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) go();
    });
    const { data } = supabase.auth.onAuthStateChange((ev, sess) => {
      if (ev === "SIGNED_IN" && sess) go();
    });
    return () => {
      on = false;
      data.subscription.unsubscribe();
    };
  }, [navigate]);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    navigate({ to: "/dashboard" });
  };

  const resendConfirmation = async () => {
    if (!email) {
      toast.error("Please enter your email address.");
      return;
    }
    setResending(true);
    const { error } = await supabase.auth.resend({ type: "signup", email: email.trim() });
    setResending(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Confirmation email resent! Please check your Inbox and Spam folder.");
    }
  };

  const google = async () => {
    setError("");
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) setError(result.error.message);
    else if (!result.redirected) navigate({ to: "/dashboard" });
  };

  const isUnconfirmed = error.toLowerCase().includes("not confirmed") || error.toLowerCase().includes("unconfirmed");

  return (
    <main className="min-h-[calc(100vh-5rem)] py-16">
      <div className="mx-auto max-w-md px-5">
        <div className="mb-10 text-center">
          <LockKeyhole className="mx-auto size-8 text-primary" />
          <h1 className="mt-5 text-5xl">Welcome back.</h1>
          <p className="mt-3 text-sm text-muted-foreground">Secure access to your Eastern Trust Bank account.</p>
        </div>
        <form onSubmit={login} className="space-y-5 border border-border bg-card p-7">
          <div>
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              maxLength={255}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 h-11"
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 h-11"
            />
          </div>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive space-y-2">
              <p className="font-semibold">{error}</p>
              {isUnconfirmed && (
                <div className="pt-1 text-muted-foreground space-y-2">
                  <p>
                    A verification link was sent to your email. Check your <strong>Inbox</strong> and <strong>Spam / Junk</strong> folder.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full text-xs h-8 border-destructive/30 text-foreground hover:bg-destructive/20"
                    onClick={resendConfirmation}
                    disabled={resending}
                  >
                    {resending ? "Sending link…" : "Resend Confirmation Email"}
                  </Button>
                </div>
              )}
            </div>
          )}

          <Button className="h-11 w-full" disabled={busy}>
            {busy ? "Signing in…" : "Log in securely"}
          </Button>

          <p className="text-center text-sm text-muted-foreground pt-2">
            New to Eastern Trust?{" "}
            <Link to="/signup" className="text-primary hover:underline">
              Open an account
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}