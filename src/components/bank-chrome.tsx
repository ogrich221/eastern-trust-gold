import { useEffect, useState } from "react";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function BankLogo({ className, linked = true }: { className?: string; linked?: boolean }) {
  const content = (
    <>
      <span className="grid size-10 shrink-0 place-items-center border border-primary text-lg font-bold text-primary">ET</span>
      <span className="font-display text-xl font-semibold text-foreground">
        Eastern Trust <span className="text-primary">Bank</span>
      </span>
    </>
  );

  if (!linked) return <div className={cn("flex items-center gap-3", className)}>{content}</div>;
  return (
    <Link to="/" className={cn("flex items-center gap-3", className)} aria-label="Eastern Trust Bank home">
      {content}
    </Link>
  );
}

export function HistoryNavigation({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <nav className={cn("flex items-center gap-1", className)} aria-label="Page history">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-9"
        onClick={() => router.history.back()}
        aria-label="Go back"
        title="Back"
      >
        <ArrowLeft />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-9"
        onClick={() => router.history.forward()}
        aria-label="Go forward"
        title="Forward"
      >
        <ArrowRight />
      </Button>
    </nav>
  );
}

export function BankLoadingScreen({ label = "Loading your secure banking experience" }: { label?: string }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center bg-background px-6"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="flex flex-col items-center text-center">
        <div className="animate-pulse">
          <BankLogo linked={false} className="flex-col gap-5" />
        </div>
        <div className="mt-8 h-px w-40 overflow-hidden bg-border">
          <div className="h-full w-1/2 animate-pulse bg-primary" />
        </div>
        <p className="mt-4 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export function RouteLoadingIndicator() {
  const routeLoading = useRouterState({ select: (state) => state.isLoading });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

  if (hydrated && !routeLoading) return null;
  return <BankLoadingScreen />;
}
