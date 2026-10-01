import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Eastern Trust Bank" },
      { name: "description", content: "Personal and business banking built on lasting trust." },
      { name: "author", content: "Eastern Trust Bank" },
      { property: "og:title", content: "Eastern Trust Bank" },
      { property: "og:description", content: "Personal and business banking built on lasting trust." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@EasternTrustBank" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function TawkChat() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ((window as any).Tawk_API) return;
    (window as any).Tawk_API = (window as any).Tawk_API || {};
    (window as any).Tawk_LoadStart = new Date();
    const s1 = document.createElement("script");
    const s0 = document.getElementsByTagName("script")[0];
    s1.async = true;
    s1.src = "https://embed.tawk.to/6abd6db60823be3449cff655/1k3pv952u";
    s1.charset = "UTF-8";
    s1.setAttribute("crossorigin", "*");
    if (s0 && s0.parentNode) {
      s0.parentNode.insertBefore(s1, s0);
    } else {
      document.body.appendChild(s1);
    }
  }, []);
  return null;
}

function NetlifyDrawerRemover() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const purge = () => {
      const els = document.querySelectorAll(
        "script[src*='netlify'], iframe[src*='netlify'], #netlify-hud, #netlify-hud-sdk, [data-netlify-site-id], div[class*='netlify-drawer'], div[class*='netlify-badge'], div[data-netlify-feedback], #lovable-badge, [id*='lovable'], [class*='lovable'], a[href*='lovable.dev'], [data-lovable], iframe[src*='lovable']"
      );
      els.forEach((el) => {
        try {
          el.remove();
        } catch {}
      });
    };
    purge();
    const timer = setInterval(purge, 500);
    const obs = new MutationObserver(purge);
    obs.observe(document.documentElement, { childList: true, subtree: true });
    return () => {
      clearInterval(timer);
      obs.disconnect();
    };
  }, []);
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState(false);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSignedIn(Boolean(data.session));
      if (data.session?.user) {
        const metaUrl = (data.session.user.user_metadata?.avatar_url as string) || (typeof window !== "undefined" ? localStorage.getItem(`etb_avatar_${data.session.user.id}`) : null);
        setUserAvatar(metaUrl || null);
      }
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      setSignedIn(Boolean(session));
      if (session?.user) {
        const metaUrl = (session.user.user_metadata?.avatar_url as string) || (typeof window !== "undefined" ? localStorage.getItem(`etb_avatar_${session.user.id}`) : null);
        setUserAvatar(metaUrl || null);
      } else {
        setUserAvatar(null);
      }
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient, router]);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const links = [["Personal", "/personal"], ["Business", "/business"], ["Cards", "/cards"], ["Loans", "/loans"], ["Grants", "/grants"], ["IRS & Tax", "/irs"], ["Rates", "/rates"], ["Help & Support", "/help"]] as const;

  return (
    <QueryClientProvider client={queryClient}>
      <TawkChat />
      <NetlifyDrawerRemover />
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">
          <Link to="/" className="flex items-center gap-3" aria-label="Eastern Trust Bank home">
            <span className="grid size-10 place-items-center border border-primary text-lg font-bold text-primary">ET</span>
            <span className="font-display text-xl font-semibold text-foreground">Eastern Trust <span className="text-primary">Bank</span></span>
          </Link>
          <nav className="hidden items-center gap-7 lg:flex" aria-label="Main navigation">
            {links.map(([label, to]) => <Link key={to} to={to} className="text-sm text-muted-foreground transition-colors hover:text-primary" activeProps={{ className: "text-primary" }}>{label}</Link>)}
          </nav>
          <div className="hidden items-center gap-3 lg:flex">
            {signedIn ? (
              <>
                <Button asChild variant="outline" className="flex items-center gap-2">
                  <Link to="/dashboard">
                    <span className="relative flex size-5 shrink-0 overflow-hidden rounded-full border border-primary/40">
                      {userAvatar ? (
                        <img src={userAvatar} alt="Profile" className="size-full object-cover" />
                      ) : (
                        <span className="flex size-full items-center justify-center bg-primary/10 text-[9px] font-semibold text-primary">ET</span>
                      )}
                    </span>
                    My account
                  </Link>
                </Button>
                <Button onClick={signOut}>Sign out</Button>
              </>
            ) : (
              <>
                <Button asChild variant="ghost"><Link to="/auth">Log in</Link></Button>
                <Button asChild><Link to="/signup">Open an account</Link></Button>
              </>
            )}
          </div>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">{menuOpen ? <X /> : <Menu />}</Button>
        </div>
        {menuOpen && (
          <nav className="border-t border-border px-5 py-5 lg:hidden">
            {links.map(([label, to]) => <Link key={to} to={to} onClick={() => setMenuOpen(false)} className="block border-b border-border py-3 text-sm">{label}</Link>)}
            {signedIn ? (
              <div className="mt-4 flex gap-3">
                <Button asChild variant="outline" className="flex-1 flex items-center justify-center gap-2" onClick={() => setMenuOpen(false)}>
                  <Link to="/dashboard">
                    <span className="relative flex size-5 shrink-0 overflow-hidden rounded-full border border-primary/40">
                      {userAvatar ? (
                        <img src={userAvatar} alt="Profile" className="size-full object-cover" />
                      ) : (
                        <span className="flex size-full items-center justify-center bg-primary/10 text-[9px] font-semibold text-primary">ET</span>
                      )}
                    </span>
                    My account
                  </Link>
                </Button>
                <Button onClick={() => { setMenuOpen(false); signOut(); }} className="flex-1">Sign out</Button>
              </div>
            ) : (
              <div className="mt-4 flex gap-3">
                <Button asChild variant="outline" className="flex-1"><Link to="/auth">Log in</Link></Button>
                <Button asChild className="flex-1"><Link to="/signup">Open account</Link></Button>
              </div>
            )}
          </nav>
        )}
      </header>
      <Outlet />
    </QueryClientProvider>
  );
}
