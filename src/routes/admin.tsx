import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Eye,
  LogIn,
  LogOut,
  Mail,
  MailCheck,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserPlus,
  UserX,
  UserCheck,
  KeyRound,
  FileSpreadsheet,
  TrendingUp,
  CreditCard,
  Wallet,
  Users,
  AlertTriangle,
  Lock,
  Sliders,
  CheckCircle2,
  Clock,
  ExternalLink,
  User,
  Copy,
  FileText,
  History,
  Building2,
  MapPin,
  Phone,
  Shield,
  ArrowDownRight,
  ArrowUpRight,
  Camera,
  Edit3,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Toaster } from "@/components/ui/sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  getAdminSession,
  adminLogin,
  adminLogout,
  listCustomers,
  listAuditLog,
  listTransactions,
  updateCustomerProfile,
  updateCustomerEmail,
  setCustomerPassword,
  updateAccountBalance,
  setDirectAccountBalance,
  setCustomerSuspended,
  setCustomerAdmin,
  deleteCustomer,
  logViewAsCustomer,
  createCustomer,
  createProfileForCustomer,
  deleteCustomerProfile,
  resetSecurityQuestions,
  confirmCustomerEmail,
  addCustomerAccount,
  renameCustomerAccount,
  signInAsCustomer,
  signOutCustomer,
  saveSupabaseServiceKey,
  checkServiceKeyStatus,
  updateCustomerAvatar,
  updateCustomerContactInfo,
  updateCustomerDetails,
  postTransaction,
  purgeTestrunUsers,
} from "@/lib/admin.functions";
import { TransactionForm, TransactionLedger, WireReview } from "@/components/admin-transactions";
import { UserProfile } from "@/components/user-profile";
import { AdminReports } from "@/components/admin-reports";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AvatarModal } from "@/components/avatar-modal";
import { currentTransactionDate, formatTransactionDate, isValidTransactionDate } from "@/lib/transaction-date";
import { BankLoadingScreen, HistoryNavigation } from "@/components/bank-chrome";

export const Route = createFileRoute("/admin")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Admin Portal | Eastern Trust Bank" },
      { name: "description", content: "Staff portal for managing Eastern Trust Bank customers." },
      { property: "og:title", content: "Admin Portal | Eastern Trust Bank" },
      { property: "og:description", content: "Manage customer profiles and accounts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type Customer = Awaited<ReturnType<typeof listCustomers>>[number];
const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

function AdminPage() {
  const sessionFn = useServerFn(getAdminSession);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-session"],
    queryFn: async () => {
      try {
        return await sessionFn();
      } catch {
        return { adminName: null };
      }
    },
    retry: 1,
  });
  if (isLoading) return <BankLoadingScreen label="Loading admin portal" />;
  if (isError || !data?.adminName) return <AdminLogin />;
  return <AdminPortal adminName={data.adminName} />;
}

function AdminLogin() {
  const loginFn = useServerFn(adminLogin);
  const qc = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await loginFn({ data: { username: username.trim(), password: password.trim() } });
      if (!r.ok) setError(r.error);
      else await qc.invalidateQueries({ queryKey: ["admin-session"] });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-16 overflow-hidden bg-slate-950 text-slate-100">
      <HistoryNavigation className="absolute left-4 top-4 z-10" />
      {/* Ambient glass background glow */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(217,119,6,0.15),transparent_50%),radial-gradient(circle_at_75%_75%,rgba(16,185,129,0.1),transparent_50%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:3.5rem_3.5rem]" />

      <div className="relative w-full max-w-md">
        {/* Luminous frosted glass panel */}
        <div className="rounded-3xl border border-white/10 bg-slate-900/50 backdrop-blur-2xl p-8 shadow-[0_8px_32px_0_rgba(0,0,0,0.55)] sm:p-10 relative overflow-hidden">
          {/* Subtle top edge specular gloss */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />

          <div className="flex flex-col items-center text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-400 shadow-lg shadow-amber-500/10">
              <ShieldCheck className="size-8" />
            </div>
            <span className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-amber-400">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Authorized Staff Only
            </span>
            <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Admin &amp; Staff Portal
            </h1>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed max-w-xs">
              Sign in to manage customers, accounts, and monitor transactions.
            </p>
          </div>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <Label htmlFor="au" className="text-xs font-medium text-slate-300">Admin Username</Label>
              <Input
                id="au"
                className="mt-1.5 h-11 rounded-xl border-white/10 bg-slate-950/60 backdrop-blur-md text-white placeholder:text-slate-500 focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40"
                autoComplete="username"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="ap" className="text-xs font-medium text-slate-300">Admin Password</Label>
              <PasswordInput
                id="ap"
                className="mt-1.5 h-11 rounded-xl border-white/10 bg-slate-950/60 backdrop-blur-md text-white placeholder:text-slate-500 focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40"
                autoComplete="current-password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-center gap-2">
                <AlertTriangle className="size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              className="mt-2 w-full h-11 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 font-semibold text-slate-950 shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500 active:scale-[0.99] transition-all"
              disabled={busy || !username.trim() || !password.trim()}
            >
              {busy ? "Authenticating…" : "Sign In to Portal"}
            </Button>

            <div className="pt-2 text-center text-[11px] text-slate-400">
              Default access: <strong className="font-mono text-slate-200">admin</strong> / <strong className="font-mono text-slate-200">EasternTrust2026!</strong>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function AdminPortal({ adminName }: { adminName: string }) {
  const logoutFn = useServerFn(adminLogout);
  const qcRoot = useQueryClient();
  const signOut = async () => {
    await logoutFn();
    qcRoot.removeQueries({ queryKey: ["admin-customers"] });
    qcRoot.removeQueries({ queryKey: ["admin-audit"] });
    await qcRoot.invalidateQueries({ queryKey: ["admin-session"] });
  };

  const listFn = useServerFn(listCustomers);
  const auditFn = useServerFn(listAuditLog);
  const checkKeyFn = useServerFn(checkServiceKeyStatus);
  const saveKeyFn = useServerFn(saveSupabaseServiceKey);

  const customers = useQuery({ queryKey: ["admin-customers"], queryFn: () => listFn() });
  const audit = useQuery({ queryKey: ["admin-audit"], queryFn: () => auditFn() });
  const keyStatus = useQuery({ queryKey: ["admin-key-status"], queryFn: () => checkKeyFn() });

  const [serviceKeyInput, setServiceKeyInput] = useState("");
  const [savingKey, setSavingKey] = useState(false);

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (serviceKeyInput.trim().length < 20) {
      toast.error("Please enter a valid Supabase service_role key");
      return;
    }
    setSavingKey(true);
    try {
      await saveKeyFn({ data: { key: serviceKeyInput.trim() } });
      toast.success("Service role key connected! Loading customer database...");
      setServiceKeyInput("");
      await qcRoot.invalidateQueries({ queryKey: ["admin-key-status"] });
      await qcRoot.invalidateQueries({ queryKey: ["admin-customers"] });
      await qcRoot.invalidateQueries({ queryKey: ["admin-audit"] });
    } catch (err: any) {
      toast.error(err?.message || "Failed to save key");
    } finally {
      setSavingKey(false);
    }
  };

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended" | "admin" | "unconfirmed" | "testrun">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quickModalCustomer, setQuickModalCustomer] = useState<Customer | null>(null);
  const [quickModalOpen, setQuickModalOpen] = useState(false);

  // Filter out any public homepage contact inquiries so the executive portal shows pure banking records
  const staffAuditLogs = useMemo(() => {
    return (audit.data ?? []).filter((r) => r.action !== "homepage_inquiry");
  }, [audit.data]);

  const isTestrunCustomer = (c: Customer) => {
    const fn = (c.profile?.first_name || "").toLowerCase().trim();
    const ln = (c.profile?.last_name || "").toLowerCase().trim();
    const em = (c.email || "").toLowerCase().trim();
    const fullName = `${fn} ${ln}`.trim();
    return (
      em.includes("@test.com") ||
      em.includes("@example.com") ||
      em.includes("@client.easterntrustbank.co") ||
      em.includes("+test") ||
      em.includes("testrun") ||
      em.includes("demo") ||
      em.includes("dummy") ||
      em.includes("sample") ||
      em.includes("fake") ||
      fn.includes("test") ||
      ln.includes("test") ||
      fn.includes("demo") ||
      ln.includes("demo") ||
      fullName === "jane doe" ||
      fullName === "john doe" ||
      fullName === "client"
    );
  };

  // Compute live overview metrics
  const metrics = useMemo(() => {
    let totalDeposits = 0;
    let totalCredit = 0;
    const list = customers.data ?? [];
    list.forEach((c) => {
      c.accounts.forEach((a) => {
        if (a.account_type === "checking") {
          totalDeposits += Number(a.available_balance || 0);
        } else if (a.account_type === "credit") {
          totalCredit += Number(a.current_balance || 0);
        }
      });
    });
    return {
      totalDeposits,
      totalCredit,
      totalCustomers: list.length,
      activeCustomers: list.filter((c) => !c.banned).length,
    };
  }, [customers.data]);

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    return (customers.data ?? []).filter((c) => {
      const fullName = `${c.profile?.first_name ?? ""} ${c.profile?.last_name ?? ""}`.trim();
      const matchText = [
        c.email,
        c.profile?.first_name,
        c.profile?.last_name,
        fullName,
        c.profile?.phone,
        c.profile?.address,
        c.profile?.city,
        c.id,
      ].some((v) =>
        v?.toLowerCase().includes(s)
      );
      if (!matchText) return false;
      if (statusFilter === "active") return !c.banned;
      if (statusFilter === "suspended") return c.banned;
      if (statusFilter === "admin") return c.is_admin;
      if (statusFilter === "unconfirmed") return !c.confirmed;
      if (statusFilter === "testrun") return isTestrunCustomer(c);
      return true;
    });
  }, [customers.data, q, statusFilter]);

  const selected = customers.data?.find((c) => c.id === selectedId) ?? null;
  const emailOf = (id: string | null) => customers.data?.find((c) => c.id === id)?.email ?? id?.slice(0, 8) ?? "—";

  return (
    <main className="relative min-h-screen py-10 overflow-hidden bg-slate-950 text-slate-100">
      {/* Ambient glass background glow */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(217,119,6,0.12),transparent_50%),radial-gradient(circle_at_80%_80%,rgba(16,185,129,0.08),transparent_50%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem]" />
      <Toaster />
      <div className="relative mx-auto max-w-7xl px-5 lg:px-8 space-y-8">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-slate-900/40 backdrop-blur-2xl p-6 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/30 to-transparent" />
          <div className="flex items-center gap-4">
            <HistoryNavigation />
            <span className="flex size-14 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-400 shadow-lg shadow-amber-500/10">
              <ShieldCheck className="size-7" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-400">Executive Administration</p>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium text-emerald-400">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Core Banking Live
                </span>
              </div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-white md:text-3xl font-display">Treasury &amp; Operations Portal</h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <p className="text-[11px] text-slate-400">Logged in officer</p>
              <div className="text-sm font-semibold text-white flex items-center justify-end gap-1.5">
                {adminName} <Badge variant="outline" className="text-[10px] py-0 border-amber-500/40 bg-amber-500/10 text-amber-300">Admin</Badge>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={signOut} className="rounded-xl border-white/10 bg-slate-800/40 backdrop-blur hover:bg-white/10 text-xs">
              <LogOut className="mr-1.5 size-3.5" /> Sign Out
            </Button>
          </div>
        </div>

        {/* Global Banking Metrics Ribbon */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl p-5 shadow-xl relative overflow-hidden group hover:border-amber-500/40 transition-all duration-300">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Customer Deposits</span>
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Wallet className="size-4" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold text-amber-400 font-display">{money(metrics.totalDeposits)}</p>
            <p className="mt-1 text-xs text-slate-400">Liquid Everyday Checking</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl p-5 shadow-xl relative overflow-hidden group hover:border-amber-500/40 transition-all duration-300">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Active Credit Drawn</span>
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <CreditCard className="size-4" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold text-white font-display">{money(metrics.totalCredit)}</p>
            <p className="mt-1 text-xs text-slate-400">Gold Rewards Outstanding</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl p-5 shadow-xl relative overflow-hidden group hover:border-amber-500/40 transition-all duration-300">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Registered Accounts</span>
              <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                <Users className="size-4" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold text-white font-display">{metrics.totalCustomers}</p>
            <p className="mt-1 text-xs text-slate-400">{metrics.activeCustomers} active customers</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl p-5 shadow-xl relative overflow-hidden group hover:border-emerald-500/40 transition-all duration-300">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Security & Audit Status</span>
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <CheckCircle2 className="size-4" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold text-emerald-400 font-display">Compliant</p>
            <p className="mt-1 text-xs text-slate-400">{staffAuditLogs.length} logged staff actions</p>
          </div>
        </section>

        {/* Top-Level Tabs */}
        <Tabs defaultValue="customers" className="w-full">
          <div>
            <TabsList className="h-auto w-full justify-start gap-1.5 overflow-x-auto rounded-2xl bg-slate-900/50 backdrop-blur-xl border border-white/10 p-1.5 shadow-lg">
              <TabsTrigger
                value="customers"
                className="rounded-xl border border-transparent px-4 py-2.5 text-xs font-semibold data-[state=active]:border-amber-500/40 data-[state=active]:bg-amber-500/15 data-[state=active]:text-amber-300 data-[state=active]:shadow text-slate-300 hover:text-white hover:bg-white/5 transition-all"
              >
                <Users className="mr-2 size-4" /> Customer Management
              </TabsTrigger>
              <TabsTrigger
                value="transactions"
                className="rounded-xl border border-transparent px-4 py-2.5 text-xs font-semibold data-[state=active]:border-amber-500/40 data-[state=active]:bg-amber-500/15 data-[state=active]:text-amber-300 data-[state=active]:shadow text-slate-300 hover:text-white hover:bg-white/5 transition-all"
              >
                <Clock className="mr-2 size-4" /> Transaction Monitoring
              </TabsTrigger>
              <TabsTrigger
                value="reports"
                className="rounded-xl border border-transparent px-4 py-2.5 text-xs font-semibold data-[state=active]:border-amber-500/40 data-[state=active]:bg-amber-500/15 data-[state=active]:text-amber-300 data-[state=active]:shadow text-slate-300 hover:text-white hover:bg-white/5 transition-all"
              >
                <FileSpreadsheet className="mr-2 size-4" /> Reports & Analytics
              </TabsTrigger>
              <TabsTrigger
                value="permissions"
                className="rounded-xl border border-transparent px-4 py-2.5 text-xs font-semibold data-[state=active]:border-amber-500/40 data-[state=active]:bg-amber-500/15 data-[state=active]:text-amber-300 data-[state=active]:shadow text-slate-300 hover:text-white hover:bg-white/5 transition-all"
              >
                <Sliders className="mr-2 size-4" /> Role Permissions
              </TabsTrigger>
              <TabsTrigger
                value="audit"
                className="rounded-xl border border-transparent px-4 py-2.5 text-xs font-semibold data-[state=active]:border-amber-500/40 data-[state=active]:bg-amber-500/15 data-[state=active]:text-amber-300 data-[state=active]:shadow text-slate-300 hover:text-white hover:bg-white/5 transition-all"
              >
                <ShieldCheck className="mr-2 size-4" /> Activity Log
              </TabsTrigger>
              <TabsTrigger
                value="security"
                className="rounded-xl border border-transparent px-4 py-2.5 text-xs font-semibold data-[state=active]:border-amber-500/40 data-[state=active]:bg-amber-500/15 data-[state=active]:text-amber-300 data-[state=active]:shadow text-slate-300 hover:text-white hover:bg-white/5 transition-all"
              >
                <Lock className="mr-2 size-4" /> Security Settings
              </TabsTrigger>
            </TabsList>
          </div>

          {/* TAB 1: CUSTOMER MANAGEMENT */}
          <TabsContent value="customers" className="mt-6 space-y-6">
            {!keyStatus.data?.configured && (
              <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-5 text-amber-200">
                <div className="flex flex-col sm:flex-row items-start gap-4">
                  <div className="grid size-10 place-items-center rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
                    <KeyRound className="size-5" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <h4 className="font-semibold text-sm text-foreground">Connect Supabase Service Role Key to Monitor &amp; Manage Customers</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Supabase restricts user monitoring, listing, and direct customer administration to the backend <code className="text-foreground">service_role</code> secret key. Paste your secret key below to connect your database immediately:
                    </p>
                    <form onSubmit={handleSaveKey} className="flex flex-wrap gap-2 pt-1">
                      <PasswordInput
                        placeholder="Paste service_role key (sb_secret_... or eyJhbGci...)"
                        value={serviceKeyInput}
                        onChange={(e) => setServiceKeyInput(e.target.value)}
                        className="max-w-md"
                        inputClassName="text-xs h-9 font-mono bg-background"
                      />
                      <Button
                        type="submit"
                        size="sm"
                        disabled={savingKey || serviceKeyInput.trim().length < 20}
                        className="text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white"
                      >
                        {savingKey ? "Connecting…" : "Connect Key & Load Users"}
                      </Button>
                    </form>
                    <p className="text-[11px] text-muted-foreground/80">
                      📍 Where to find it: <strong>Supabase Dashboard → Project Settings → API → Project API Keys → service_role (secret)</strong>
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
              {/* Customer Directory Sidebar */}
              <div className="rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl shadow-xl overflow-hidden flex flex-col h-[750px]">
                <div className="border-b border-white/10 p-3.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white">Customers Directory</h3>
                    <Badge variant="outline" className="border-white/10 text-[10px] text-slate-300">
                      {filtered.length}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <PurgeTestrunDialog onPurged={() => qcRoot.invalidateQueries({ queryKey: ["admin-customers"] })} />
                    <NewCustomerDialog />
                  </div>
                </div>

                <div className="p-3 border-b border-white/10 space-y-2.5">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Search name, email, phone..."
                      className="pl-9 h-9 text-xs rounded-xl border-white/10 bg-slate-950/60 backdrop-blur-md text-white placeholder:text-slate-500 focus:border-amber-500/50"
                    />
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {(["all", "active", "suspended", "admin", "unconfirmed", "testrun"] as const).map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setStatusFilter(filter)}
                        className={`text-[11px] px-2.5 py-1 rounded-lg transition-all capitalize ${
                          statusFilter === filter
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 font-medium"
                            : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        {filter === "testrun" ? "Test Accounts" : filter}
                      </button>
                    ))}
                  </div>
                </div>

                <ul className="flex-1 overflow-y-auto divide-y divide-white/5">
                  {customers.isLoading && <li className="p-4 text-sm text-muted-foreground">Loading customers…</li>}
                  {customers.error && <li className="p-4 text-sm text-destructive">{errMsg(customers.error)}</li>}
                  {filtered.map((c) => {
                    const fullName = c.profile ? `${c.profile.first_name} ${c.profile.last_name}`.trim() : "";
                    const totalBal = c.accounts.reduce(
                      (s, a) => s + (a.account_type === "credit" ? -a.current_balance : a.available_balance),
                      0
                    );
                    const isSelected = selectedId === c.id;

                    return (
                      <li key={c.id}>
                        <div
                          onClick={() => setSelectedId(c.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelectedId(c.id);
                            }
                          }}
                          className={`w-full p-4 text-left transition-all cursor-pointer ${
                            isSelected ? "bg-amber-500/15 border-l-4 border-amber-500 text-white" : "hover:bg-white/5 text-slate-200"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <Avatar className="size-9 border border-white/10 shrink-0">
                                {c.avatar_url ? (
                                  <AvatarImage src={c.avatar_url} alt={fullName || c.email} className="object-cover" />
                                ) : null}
                                <AvatarFallback className="bg-amber-500/10 text-xs font-semibold text-amber-300">
                                  {(fullName ? fullName.slice(0, 2) : c.email.slice(0, 2)).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-sm text-white truncate">
                                  {fullName || c.email}
                                </p>
                                <p className="truncate text-xs text-slate-400">{c.email}</p>
                                {c.profile?.phone && (
                                  <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                    <Phone className="size-2.5 shrink-0 text-slate-500" /> {c.profile.phone}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs font-bold text-white">{money(totalBal)}</p>
                              <p className="text-[10px] text-slate-400">{c.accounts.length} accts</p>
                            </div>
                          </div>

                          {/* Individual Account Chips */}
                          <div className="mt-2 flex flex-wrap gap-1">
                            {c.accounts.map((a) => (
                              <span
                                key={a.id}
                                className="bg-white/5 border border-white/10 px-2 py-0.5 rounded-md text-[10px] font-mono text-slate-300"
                              >
                                {a.account_type}: <strong className="text-white">{money(a.available_balance)}</strong>
                              </span>
                            ))}
                          </div>

                          <div className="mt-2.5 flex items-center justify-between gap-1.5 border-t border-white/5 pt-2">
                            <div className="flex items-center gap-1 flex-wrap">
                              {c.is_admin && <Badge variant="outline" className="text-[10px] py-0 border-amber-500/40 bg-amber-500/10 text-amber-300">Admin</Badge>}
                              {isTestrunCustomer(c) && (
                                <Badge variant="outline" className="text-[10px] py-0 border-rose-500/40 bg-rose-500/10 text-rose-300">
                                  Testrun
                                </Badge>
                              )}
                              {c.banned ? (
                                <Badge variant="destructive" className="text-[10px] py-0">Suspended</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] py-0 text-emerald-400 border-emerald-500/40">Active</Badge>
                              )}
                              {!c.confirmed && <Badge variant="secondary" className="text-[10px] py-0 text-slate-400">Unconfirmed</Badge>}
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-6 text-[11px] px-2 font-semibold text-emerald-400 hover:text-emerald-300 border-emerald-500/30 hover:border-emerald-500/60 bg-emerald-500/10 hover:bg-emerald-500/20"
                              onClick={(e) => {
                                e.stopPropagation();
                                setQuickModalCustomer(c);
                                setQuickModalOpen(true);
                              }}
                            >
                              <TrendingUp className="mr-1 size-3" /> Credit / Debit
                            </Button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                  {customers.data && filtered.length === 0 && (
                    <li className="p-8 text-center text-sm text-slate-400">No matching customers found.</li>
                  )}
                </ul>
              </div>

              {/* Customer Detail View */}
              <div className="h-[750px] overflow-y-auto">
                {selected ? (
                  <CustomerDetail key={selected.id} c={selected} onDeleted={() => setSelectedId(null)} />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-slate-900/20 backdrop-blur-md p-12 text-center text-slate-400">
                    <Users className="size-12 stroke-[1.5] text-slate-600" />
                    <h3 className="mt-4 text-lg font-semibold text-white">Select a Customer</h3>
                    <p className="mt-1 text-sm max-w-sm text-slate-400">
                      Choose an account from the directory to inspect balances, adjust limits, monitor activity, or launch an authorized support session.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: TRANSACTION MONITORING */}
          <TabsContent value="transactions" className="mt-6 space-y-6">
            <WireReview emailOf={(id) => emailOf(id)} />
            <TransactionLedger emailOf={(id) => emailOf(id)} />
          </TabsContent>

          {/* TAB 3: REPORTS & ANALYTICS */}
          <TabsContent value="reports" className="mt-6">
            <AdminReports
              customers={customers.data ?? []}
              auditLogs={staffAuditLogs}
              emailOf={(id) => emailOf(id)}
            />
          </TabsContent>

          {/* TAB 4: PERMISSIONS MATRIX */}
          <TabsContent value="permissions" className="mt-6">
            <div className="rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl shadow-xl p-6 space-y-6">
              <div className="border-b border-white/10 pb-4">
                <h2 className="text-xl font-bold tracking-tight text-white font-display">Staff Roles &amp; Permissions Matrix</h2>
                <p className="text-xs text-slate-400">
                  Role-based security controls governing staff access across accounts, transfers, and customer details.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-white/10 text-xs text-slate-400">
                    <tr>
                      <th className="py-3 px-4">Role Title</th>
                      <th className="py-3 px-4">View Balances</th>
                      <th className="py-3 px-4">Post Transactions</th>
                      <th className="py-3 px-4">Reverse Entries</th>
                      <th className="py-3 px-4">Log in as User</th>
                      <th className="py-3 px-4">Delete Accounts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-200">
                    <tr className="hover:bg-white/5 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-white flex items-center gap-2">
                        <ShieldCheck className="size-4 text-amber-400" /> Super Admin
                      </td>
                      <td className="py-3.5 px-4 text-emerald-400 font-medium">Full Access</td>
                      <td className="py-3.5 px-4 text-emerald-400 font-medium">Full Access</td>
                      <td className="py-3.5 px-4 text-emerald-400 font-medium">Full Access</td>
                      <td className="py-3.5 px-4 text-emerald-400 font-medium">Authorized Audit</td>
                      <td className="py-3.5 px-4 text-emerald-400 font-medium">Full Control</td>
                    </tr>
                    <tr className="hover:bg-white/5 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-white flex items-center gap-2">
                        <Users className="size-4 text-sky-400" /> Support Specialist
                      </td>
                      <td className="py-3.5 px-4 text-emerald-400 font-medium">Full Access</td>
                      <td className="py-3.5 px-4 text-slate-400">Review Only</td>
                      <td className="py-3.5 px-4 text-slate-400">Approval Needed</td>
                      <td className="py-3.5 px-4 text-emerald-400 font-medium">Authorized Audit</td>
                      <td className="py-3.5 px-4 text-rose-400 font-medium">Denied</td>
                    </tr>
                    <tr className="hover:bg-white/5 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-white flex items-center gap-2">
                        <Lock className="size-4 text-amber-400" /> Compliance Auditor
                      </td>
                      <td className="py-3.5 px-4 text-emerald-400 font-medium">Read Only</td>
                      <td className="py-3.5 px-4 text-rose-400 font-medium">Denied</td>
                      <td className="py-3.5 px-4 text-rose-400 font-medium">Denied</td>
                      <td className="py-3.5 px-4 text-rose-400 font-medium">Denied</td>
                      <td className="py-3.5 px-4 text-rose-400 font-medium">Denied</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* TAB 5: AUDIT LOG */}
          <TabsContent value="audit" className="mt-6">
            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl shadow-xl overflow-hidden">
              <div className="p-5 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-white font-display">Administrative Activity Log</h3>
                  <p className="text-xs text-slate-400">Immutable trail of every internal transaction, support impersonation, and staff adjustment.</p>
                </div>
                <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-xs font-mono">
                  {staffAuditLogs.length} logged events
                </Badge>
              </div>
              <table className="w-full text-sm">
                <thead className="border-b border-white/10 text-left text-slate-400 text-xs">
                  <tr>
                    <th className="p-3.5">Timestamp</th>
                    <th className="p-3.5">Admin</th>
                    <th className="p-3.5">Action</th>
                    <th className="p-3.5">Customer</th>
                    <th className="p-3.5">Details / Support Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-200">
                  {staffAuditLogs.map((r) => {
                    let admin = "—";
                    let reason = "";
                    try {
                      const d = JSON.parse(r.details);
                      admin = d.by ?? "admin";
                      reason = d.reason ?? "";
                    } catch {}
                    return (
                      <tr key={r.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-3.5 whitespace-nowrap text-xs text-slate-400 font-mono">
                          {new Date(r.created_at).toLocaleString()}
                        </td>
                        <td className="p-3.5 font-medium text-white">{admin}</td>
                        <td className="p-3.5">
                          <Badge variant="outline" className="text-xs border-amber-500/40 bg-amber-500/10 text-amber-300 capitalize">
                            {r.action.replace(/_/g, " ")}
                          </Badge>
                        </td>
                        <td className="p-3.5 text-xs text-slate-300">{r.target_user_id ? emailOf(r.target_user_id) : "—"}</td>
                        <td className="max-w-md p-3.5 text-xs text-slate-400">
                          {reason ? (
                            <span className="font-semibold text-white">Reason: {reason}</span>
                          ) : r.details === "{}" ? (
                            "—"
                          ) : (
                            r.details
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {staffAuditLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-sm text-slate-400">
                        No administrative staff activity recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* TAB 6: SECURITY SETTINGS */}
          <TabsContent value="security" className="mt-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl shadow-xl p-6 space-y-4">
                <h3 className="text-base font-semibold text-white font-display">Admin Credentials &amp; Environment</h3>
                <p className="text-xs text-slate-400">
                  Your staff credentials are authenticated securely via cryptographic HMAC session tokens.
                </p>

                <div className="rounded-xl bg-slate-950/60 backdrop-blur-md p-4 border border-white/10 space-y-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Active Officer:</span>
                    <strong className="text-white font-mono">{adminName}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Session Expiration:</span>
                    <strong className="text-emerald-400">8 Hours (Strict HttpOnly Cookie)</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Authentication Method:</span>
                    <strong className="text-amber-300">HMAC-SHA256 Tokenization</strong>
                  </div>
                </div>

                <div className="pt-2">
                  <p className="text-xs font-semibold text-white mb-1">To change Admin Credentials:</p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Set <code className="bg-white/10 px-1.5 py-0.5 rounded text-amber-300 font-mono">ADMIN_USERNAME</code> and{" "}
                    <code className="bg-white/10 px-1.5 py-0.5 rounded text-amber-300 font-mono">ADMIN_PASSWORD</code> in your Netlify
                    dashboard under <strong>Project configuration &gt; Environment variables</strong>.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl shadow-xl p-6 space-y-4">
                <h3 className="text-base font-semibold text-white font-display">Compliance &amp; Audit Mandates</h3>
                <p className="text-xs text-slate-400">
                  Standard Operating Procedures (SOP) for customer support impersonation.
                </p>

                <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
                  <div className="flex gap-2.5">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Every "Log in as user" action requires an approved support ticket or reason.</span>
                  </div>
                  <div className="flex gap-2.5">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>All account modifications and balance overrides are permanently written to the ledger.</span>
                  </div>
                  <div className="flex gap-2.5">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Customer security answers remain encrypted with one-way hashes and cannot be read by staff.</span>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <QuickCreditDebitModal
        open={quickModalOpen}
        onOpenChange={setQuickModalOpen}
        customer={quickModalCustomer}
      />
    </main>
  );
}

function useAdminAction<T>(fn: (args: { data: T }) => Promise<unknown>, success: string, after?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: T) => fn({ data }),
    onSuccess: () => {
      toast.success(success);
      qc.invalidateQueries({ queryKey: ["admin-customers"] });
      qc.invalidateQueries({ queryKey: ["admin-audit"] });
      qc.invalidateQueries({ queryKey: ["admin-txns"] });
      after?.();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
}

function CustomerDetail({ c, onDeleted }: { c: Customer; onDeleted: () => void }) {
  const profileM = useAdminAction(useServerFn(updateCustomerProfile), "Profile saved");
  const emailM = useAdminAction(useServerFn(updateCustomerEmail), "Email updated");
  const passM = useAdminAction(useServerFn(setCustomerPassword), "Password set");
  const suspendM = useAdminAction(useServerFn(setCustomerSuspended), c.banned ? "Customer reactivated" : "Customer suspended");
  const adminM = useAdminAction(useServerFn(setCustomerAdmin), c.is_admin ? "Admin access removed" : "Admin access granted");
  const deleteM = useAdminAction(useServerFn(deleteCustomer), "Customer permanently deleted", onDeleted);
  const logView = useServerFn(logViewAsCustomer);
  const delProfileM = useAdminAction(useServerFn(deleteCustomerProfile), "Profile deleted");
  const confirmM = useAdminAction(useServerFn(confirmCustomerEmail), "Email marked as confirmed");
  const avatarM = useAdminAction(useServerFn(updateCustomerAvatar), "Customer avatar updated");
  const contactInfoM = useAdminAction(useServerFn(updateCustomerContactInfo), "Personal contact information updated");
  const signOutM = useAdminAction(useServerFn(signOutCustomer), "Customer signed out of all devices");

  const [p, setP] = useState({
    first_name: c.profile?.first_name ?? "",
    last_name: c.profile?.last_name ?? "",
    phone: c.profile?.phone ?? "",
    address: c.profile?.address ?? "",
    city: c.profile?.city ?? "",
    postal_code: c.profile?.postal_code ?? "",
  });
  const [email, setEmail] = useState(c.email);

  useEffect(() => {
    setP({
      first_name: c.profile?.first_name ?? "",
      last_name: c.profile?.last_name ?? "",
      phone: c.profile?.phone ?? "",
      address: c.profile?.address ?? "",
      city: c.profile?.city ?? "",
      postal_code: c.profile?.postal_code ?? "",
    });
    setEmail(c.email);
  }, [c]);
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [viewOpen, setViewOpen] = useState(false);
  const [impersonateOpen, setImpersonateOpen] = useState(false);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [quickCreditDebitOpen, setQuickCreditDebitOpen] = useState(false);

  const fullName = c.profile ? `${c.profile.first_name} ${c.profile.last_name}`.trim() : "";
  const initials = (fullName ? fullName.slice(0, 2) : c.email.slice(0, 2)).toUpperCase();

  const openView = () => {
    setViewOpen(true);
    logView({ data: { userId: c.id } }).catch(() => {});
  };

  return (
    <div className="space-y-6">
      {/* Customer Header Box */}
      <section className="rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl p-6 shadow-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative group shrink-0">
              <Avatar className="size-16 border-2 border-primary/50 shadow-md">
                {c.avatar_url ? (
                  <AvatarImage src={c.avatar_url} alt={fullName || c.email} className="object-cover" />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-xl font-bold text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => setAvatarModalOpen(true)}
                title="Change customer avatar"
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <Camera className="size-5" />
              </button>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold tracking-tight text-white">
                  {fullName || c.email}
                </h2>
                {c.is_admin && <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-300">Admin</Badge>}
                {c.banned ? (
                  <Badge variant="destructive">Suspended</Badge>
                ) : (
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-400">Active</Badge>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {c.email} · ID: <span className="font-mono text-slate-300">{c.id.slice(0, 8)}</span> · {c.confirmed ? "Email verified" : "Unverified"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => setQuickCreditDebitOpen(true)}
              className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-sm"
            >
              <TrendingUp className="mr-1.5 size-3.5" /> Credit / Debit
            </Button>
            <Button variant="outline" size="sm" onClick={() => setContactModalOpen(true)} className="text-xs border-white/10 bg-white/5 hover:bg-white/10 text-slate-200">
              <FileText className="mr-1.5 size-3.5" /> Edit Customer Details
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAvatarModalOpen(true)} className="text-xs border-white/10 bg-white/5 hover:bg-white/10 text-slate-200">
              <Camera className="mr-1.5 size-3.5" /> Photo
            </Button>
            <Button onClick={() => setImpersonateOpen(true)} className="text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium">
              <LogIn className="mr-1.5 size-3.5" /> Log in as user
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs border-white/10 bg-white/5 hover:bg-white/10 text-slate-200"
              disabled={signOutM.isPending}
              onClick={() => {
                if (window.confirm(`Sign ${c.email} out of every device?`)) signOutM.mutate({ userId: c.id });
              }}
            >
              <LogOut className="mr-1.5 size-3.5" /> {signOutM.isPending ? "Signing out..." : "Sign out customer"}
            </Button>
            <Button variant="outline" size="sm" onClick={openView} className="text-xs border-white/10 bg-white/5 hover:bg-white/10 text-slate-200">
              <Eye className="mr-1.5 size-3.5" /> View Profile
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={suspendM.isPending}
              onClick={() => suspendM.mutate({ userId: c.id, suspended: !c.banned })}
              className="text-xs border-white/10 bg-white/5 hover:bg-white/10 text-slate-200"
            >
              {c.banned ? <><UserCheck className="mr-1.5 size-3.5" /> Reactivate</> : <><UserX className="mr-1.5 size-3.5" /> Suspend</>}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={adminM.isPending}
              onClick={() => adminM.mutate({ userId: c.id, isAdmin: !c.is_admin })}
              className="text-xs border-white/10 bg-white/5 hover:bg-white/10 text-slate-200"
            >
              <ShieldCheck className="mr-1.5 size-3.5" /> {c.is_admin ? "Remove Admin" : "Make Admin"}
            </Button>

            {/* Direct Quick Delete Customer */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs rounded-xl border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 hover:text-rose-200"
                >
                  <Trash2 className="mr-1.5 size-3.5 text-rose-400" /> Delete User
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-rose-400 flex items-center gap-2">
                    <Trash2 className="size-5" /> Delete {fullName || c.email}?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-xs text-slate-300 leading-relaxed">
                    Are you sure you want to permanently delete this customer? This will remove all their bank accounts, profiles, transactions, and authentication credentials immediately.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-xs">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs"
                    onClick={() => deleteM.mutate({ userId: c.id })}
                  >
                    {deleteM.isPending ? "Deleting..." : "Permanently Delete Customer"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {!c.confirmed && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-300">
            <div className="flex items-center gap-2.5">
              <MailCheck className="size-4 shrink-0 text-amber-400" />
              <div>
                <p className="font-semibold text-foreground">Email Confirmation Pending</p>
                <p className="text-muted-foreground">This customer registered online. Confirming their account activates full login capabilities immediately.</p>
              </div>
            </div>
            <Button
              size="sm"
              disabled={confirmM.isPending}
              onClick={() => confirmM.mutate({ userId: c.id })}
              className="bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs h-8"
            >
              <CheckCircle2 className="mr-1.5 size-3.5" /> Confirm &amp; Activate Customer
            </Button>
          </div>
        )}
      </section>

      {/* Detail Sub Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="bg-slate-900/50 backdrop-blur-xl border border-white/10 flex-wrap h-auto p-1.5 rounded-2xl gap-1.5">
          <TabsTrigger value="overview" className="rounded-xl text-xs font-semibold data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-200 data-[state=active]:border data-[state=active]:border-amber-500/40 text-slate-300 transition-all">
            <User className="mr-1.5 size-3.5" /> Full Dossier
          </TabsTrigger>
          <TabsTrigger value="accounts" className="rounded-xl text-xs font-semibold data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-200 data-[state=active]:border data-[state=active]:border-amber-500/40 text-slate-300 transition-all">
            <Wallet className="mr-1.5 size-3.5" /> Accounts &amp; Balances ({c.accounts.length})
          </TabsTrigger>
          <TabsTrigger value="transactions" className="rounded-xl text-xs font-semibold data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-200 data-[state=active]:border data-[state=active]:border-amber-500/40 text-slate-300 transition-all">
            <History className="mr-1.5 size-3.5" /> Transaction Ledger
          </TabsTrigger>
          <TabsTrigger value="profile" className="rounded-xl text-xs font-semibold data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-200 data-[state=active]:border data-[state=active]:border-amber-500/40 text-slate-300 transition-all">
            <FileText className="mr-1.5 size-3.5" /> Contact Information
          </TabsTrigger>
          <TabsTrigger value="security" className="rounded-xl text-xs font-semibold data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-200 data-[state=active]:border data-[state=active]:border-amber-500/40 text-slate-300 transition-all">
            <Lock className="mr-1.5 size-3.5" /> Security &amp; Login
          </TabsTrigger>
          <TabsTrigger value="danger" className="rounded-xl text-xs font-semibold data-[state=active]:bg-rose-500/20 data-[state=active]:text-rose-200 data-[state=active]:border data-[state=active]:border-rose-500/40 text-rose-300 transition-all">
            <AlertTriangle className="mr-1.5 size-3.5" /> Danger Zone
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: FULL DOSSIER & COMPREHENSIVE OVERVIEW */}
        <TabsContent value="overview" className="mt-4 space-y-6">
          {/* Quick Metrics Strip */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl p-5 shadow-lg">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Liquid Deposits</span>
              <p className="mt-1 text-2xl font-bold font-display text-amber-400">
                {money(c.accounts.filter(a => a.account_type === 'checking').reduce((s, a) => s + (a.available_balance || 0), 0))}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">Checking available</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl p-5 shadow-lg">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Ledger Balance</span>
              <p className="mt-1 text-2xl font-bold font-display text-white">
                {money(c.accounts.reduce((s, a) => s + (a.current_balance || 0), 0))}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">Checking ledger balance</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl p-5 shadow-lg">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Accounts Linked</span>
              <p className="mt-1 text-2xl font-bold font-display text-white">{c.accounts.length}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">Active banking services</p>
            </div>
          </div>

          {/* Personal Identification & Contact Card */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-white font-display">
                <User className="size-4 text-amber-400" /> Customer Identity &amp; Contact Details
              </h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setContactModalOpen(true)}
                  className="text-xs h-7 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-slate-200"
                >
                  <Edit3 className="mr-1 size-3" /> Edit Customer Details
                </Button>
                <Badge variant="outline" className="text-xs font-mono border-white/10 text-slate-300">
                  {c.is_admin ? "Administrator" : "Standard Client"}
                </Badge>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 text-xs">
              <div className="flex items-center gap-3">
                <Avatar className="size-11 border border-white/10 shrink-0">
                  {c.avatar_url ? (
                    <AvatarImage src={c.avatar_url} alt={fullName || c.email} className="object-cover" />
                  ) : null}
                  <AvatarFallback className="bg-amber-500/10 text-xs font-semibold text-amber-300">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-slate-400">Full Legal Name</p>
                  <p className="mt-0.5 font-semibold text-sm text-white">
                    {fullName || "Not Set"}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-muted-foreground">Registered Email</p>
                <p className="mt-1 font-semibold text-foreground flex items-center gap-1.5">
                  {c.email}
                  {c.confirmed ? (
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded font-mono">Verified</span>
                  ) : (
                    <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded font-mono">Unverified</span>
                  )}
                </p>
              </div>

              <div>
                <p className="text-muted-foreground">Direct Telephone</p>
                <p className="mt-1 font-semibold text-foreground flex items-center gap-1.5">
                  <Phone className="size-3 text-muted-foreground" />
                  {c.profile?.phone || "Not Set"}
                </p>
              </div>

              <div className="sm:col-span-2">
                <p className="text-muted-foreground">Primary Residential Address</p>
                <p className="mt-1 font-semibold text-foreground flex items-center gap-1.5">
                  <MapPin className="size-3 text-muted-foreground shrink-0" />
                  {c.profile?.address ? `${c.profile.address}, ${c.profile.city} ${c.profile.postal_code}` : "No address on file"}
                </p>
              </div>

              <div>
                <p className="text-muted-foreground">Customer ID (UUID)</p>
                <div className="mt-1 flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                  <span className="truncate max-w-[170px]">{c.id}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(c.id);
                      toast.success("Copied customer ID");
                    }}
                    className="hover:text-primary p-0.5 rounded"
                  >
                    <Copy className="size-3" />
                  </button>
                </div>
              </div>

              <div>
                <p className="text-muted-foreground">Last Recorded Sign-In</p>
                <p className="mt-1 font-mono text-[11px] text-foreground flex items-center gap-1">
                  <Clock className="size-3 text-muted-foreground" />
                  {c.last_sign_in_at ? new Date(c.last_sign_in_at).toLocaleString() : "Never (Pending first login)"}
                </p>
              </div>

              <div>
                <p className="text-muted-foreground">Account Standing</p>
                <p className="mt-1 font-semibold text-foreground flex items-center gap-1.5">
                  {c.banned ? (
                    <span className="text-rose-400 flex items-center gap-1 font-medium"><AlertTriangle className="size-3" /> Suspended</span>
                  ) : (
                    <span className="text-emerald-400 flex items-center gap-1 font-medium"><CheckCircle2 className="size-3" /> Good Standing (Active)</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* All Accounts Deep Breakdown */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-white">
                <Wallet className="size-4 text-amber-400" /> Active Banking &amp; Card Accounts
              </h3>
              <span className="text-xs text-slate-400">Routing Number: <strong className="text-white font-mono">021000089</strong></span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {c.accounts.map((a) => (
                <div key={a.id} className="rounded-xl border border-white/10 bg-slate-950/60 backdrop-blur-md p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        {a.account_type} Account
                      </span>
                      <h4 className="font-semibold text-sm text-white">{a.name}</h4>
                    </div>
                    <Badge variant="outline" className="font-mono text-xs border-white/10 text-slate-300">
                      •••• {a.last_four}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5 text-xs">
                    <div>
                      <p className="text-slate-400 text-[11px]">Available Balance</p>
                      <p className="font-bold text-sm text-amber-400 font-display">{money(a.available_balance)}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-[11px]">Current Balance</p>
                      <p className="font-bold text-sm text-white font-display">{money(a.current_balance)}</p>
                    </div>
                    {a.credit_limit !== null && (
                      <div>
                        <p className="text-slate-400 text-[11px]">Credit Limit</p>
                        <p className="font-medium text-xs text-slate-300 font-mono">{money(a.credit_limit)}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-slate-400 text-[11px]">Overdraft Permitted</p>
                      <p className="font-medium text-xs text-slate-300">{a.allow_overdraft ? "Yes" : "No"}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Security & Verification Credentials */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2 border-b border-white/10 pb-3 text-white">
              <Shield className="size-4 text-amber-400" /> Security &amp; Compliance Details
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 text-xs">
              <div className="rounded-xl border border-white/10 p-3.5 bg-slate-950/60 backdrop-blur-md">
                <p className="font-semibold text-white text-[11px]">Security Question 1</p>
                <p className="mt-1 text-slate-400">{c.profile?.security_question_one || "What was the name of your first pet?"}</p>
                <p className="mt-2 text-[10px] text-emerald-400 font-mono">✓ Cryptographic SHA-256 Hash Configured</p>
              </div>
              <div className="rounded-xl border border-white/10 p-3.5 bg-slate-950/60 backdrop-blur-md">
                <p className="font-semibold text-white text-[11px]">Security Question 2</p>
                <p className="mt-1 text-slate-400">{c.profile?.security_question_two || "In what city were you born?"}</p>
                <p className="mt-2 text-[10px] text-emerald-400 font-mono">✓ Cryptographic SHA-256 Hash Configured</p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: ACCOUNTS */}
        <TabsContent value="accounts" className="mt-4 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl p-6 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <div>
                <h3 className="text-base font-semibold text-white font-display">Customer Accounts</h3>
                <p className="text-xs text-slate-400">Manage account parameters or immediately credit/debit liquid funds.</p>
              </div>
              <Button
                size="sm"
                onClick={() => setQuickCreditDebitOpen(true)}
                className="text-xs rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
              >
                <TrendingUp className="mr-1.5 size-3.5" /> Credit / Debit
              </Button>
            </div>
            <div className="space-y-4">
              {c.accounts.length === 0 && <p className="text-sm text-slate-400">No accounts configured.</p>}
              {c.accounts.map((a) => (
                <AccountEditor key={a.id} a={a} />
              ))}
            </div>
            {c.accounts.length === 0 && <AddAccount userId={c.id} />}
          </div>
        </TabsContent>

        {/* TAB 3: TRANSACTIONS LEDGER */}
        <TabsContent value="transactions" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-white font-display">Customer Transaction Ledger</h3>
              <p className="text-xs text-slate-400">Audited history of credits, debits, wires, and balance adjustments for this customer.</p>
            </div>
            <Button
              size="sm"
              onClick={() => setQuickCreditDebitOpen(true)}
              className="text-xs rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
            >
              <TrendingUp className="mr-1.5 size-3.5" /> Post Credit / Debit
            </Button>
          </div>
          <TransactionLedger userId={c.id} />
        </TabsContent>

        {/* TAB 4: PROFILE */}
        <TabsContent value="profile" className="mt-4">
          {!c.profile && <CreateProfile userId={c.id} />}
          {c.profile && (
            <section className="rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl p-6 shadow-xl space-y-5">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div>
                  <h3 className="text-base font-semibold flex items-center gap-2 text-white font-display">
                    <FileText className="size-4 text-amber-400" /> Personal Identity &amp; Contact Details
                  </h3>
                  <p className="text-xs text-slate-400">
                    View and edit the customer's legal name, primary email address, phone number, and residential address.
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs rounded-xl">
                      <Trash2 className="mr-1 size-3.5" /> Clear Profile
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-2xl text-slate-100 shadow-2xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-white">Reset customer profile?</AlertDialogTitle>
                      <AlertDialogDescription className="text-xs text-slate-300">
                        Removes name, phone, and residential address. Login credentials and accounts remain intact.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-xs">Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => delProfileM.mutate({ userId: c.id })} className="rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs">
                        Confirm Clear
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              <form
                className="grid gap-4 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  contactInfoM.mutate({
                    userId: c.id,
                    email,
                    first_name: p.first_name,
                    last_name: p.last_name,
                    phone: p.phone,
                    address: p.address,
                    city: p.city,
                    postal_code: p.postal_code,
                  });
                }}
              >
                <div>
                  <Label htmlFor="prof-first-name" className="text-xs font-semibold text-slate-300">
                    Legal First Name <span className="text-rose-400">*</span>
                  </Label>
                  <Input
                    id="prof-first-name"
                    className="mt-1 h-9 rounded-xl border-white/10 bg-slate-950/60 backdrop-blur-md text-white placeholder:text-slate-500"
                    value={p.first_name}
                    onChange={(e) => setP({ ...p, first_name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="prof-last-name" className="text-xs font-semibold text-slate-300">
                    Legal Last Name <span className="text-rose-400">*</span>
                  </Label>
                  <Input
                    id="prof-last-name"
                    className="mt-1 h-9 rounded-xl border-white/10 bg-slate-950/60 backdrop-blur-md text-white placeholder:text-slate-500"
                    value={p.last_name}
                    onChange={(e) => setP({ ...p, last_name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="prof-email" className="text-xs font-semibold text-slate-300">
                    Primary Email Address <span className="text-rose-400">*</span>
                  </Label>
                  <Input
                    id="prof-email"
                    type="email"
                    className="mt-1 h-9 rounded-xl border-white/10 bg-slate-950/60 backdrop-blur-md text-white placeholder:text-slate-500"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <p className="mt-1 text-[11px] text-slate-400">Used for customer sign-in and security notifications.</p>
                </div>

                <div>
                  <Label htmlFor="prof-phone" className="text-xs font-semibold text-slate-300">
                    Direct Telephone / Phone Number <span className="text-rose-400">*</span>
                  </Label>
                  <Input
                    id="prof-phone"
                    className="mt-1 h-9 rounded-xl border-white/10 bg-slate-950/60 backdrop-blur-md text-white placeholder:text-slate-500"
                    value={p.phone}
                    onChange={(e) => setP({ ...p, phone: e.target.value })}
                    placeholder="+1 (555) 000-0000"
                    required
                  />
                  <p className="mt-1 text-[11px] text-slate-400">Direct telephone on file for customer contact and security.</p>
                </div>

                <div className="sm:col-span-2">
                  <Label htmlFor="prof-address" className="text-xs font-semibold text-slate-300">
                    Primary Residential Street Address <span className="text-rose-400">*</span>
                  </Label>
                  <Input
                    id="prof-address"
                    className="mt-1 h-9 rounded-xl border-white/10 bg-slate-950/60 backdrop-blur-md text-white placeholder:text-slate-500"
                    value={p.address}
                    onChange={(e) => setP({ ...p, address: e.target.value })}
                    placeholder="123 Financial Way, Suite 400"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="prof-city" className="text-xs font-semibold text-slate-300">
                    City, State / Region <span className="text-rose-400">*</span>
                  </Label>
                  <Input
                    id="prof-city"
                    className="mt-1 h-9 rounded-xl border-white/10 bg-slate-950/60 backdrop-blur-md text-white placeholder:text-slate-500"
                    value={p.city}
                    onChange={(e) => setP({ ...p, city: e.target.value })}
                    placeholder="e.g. Atlanta, GA or New York, NY"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="prof-postal" className="text-xs font-semibold text-slate-300">
                    Postal / ZIP Code <span className="text-rose-400">*</span>
                  </Label>
                  <Input
                    id="prof-postal"
                    className="mt-1 h-9 rounded-xl border-white/10 bg-slate-950/60 backdrop-blur-md text-white placeholder:text-slate-500"
                    value={p.postal_code}
                    onChange={(e) => setP({ ...p, postal_code: e.target.value })}
                    placeholder="e.g. 30303 or 10001"
                    required
                  />
                </div>

                <div className="sm:col-span-2 pt-2 border-t border-white/10 flex items-center justify-between">
                  <p className="text-xs text-slate-400">All changes are recorded in the immutable administrative security audit log.</p>
                  <Button type="submit" size="sm" disabled={contactInfoM.isPending} className="rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs">
                    {contactInfoM.isPending ? "Saving..." : "Save Contact Information"}
                  </Button>
                </div>
              </form>
            </section>
          )}
        </TabsContent>

        {/* TAB 5: SECURITY */}
        <TabsContent value="security" className="mt-4 space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            <form
              className="rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl p-6 shadow-xl"
              onSubmit={(e) => {
                e.preventDefault();
                emailM.mutate({ userId: c.id, email });
              }}
            >
              <h3 className="text-base font-semibold text-white font-display">Primary Login Email</h3>
              <Input
                type="email"
                className="mt-4 h-9 rounded-xl border-white/10 bg-slate-950/60 backdrop-blur-md text-white placeholder:text-slate-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="submit" size="sm" disabled={emailM.isPending || email === c.email} className="rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs">
                  Update Email
                </Button>
                {!c.confirmed && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={confirmM.isPending}
                    onClick={() => confirmM.mutate({ userId: c.id })}
                    className="rounded-xl border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 text-xs"
                  >
                    <MailCheck className="mr-1.5 size-3.5" /> Mark Confirmed
                  </Button>
                )}
              </div>
            </form>

            <form
              className="rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl p-6 shadow-xl"
              onSubmit={(e) => {
                e.preventDefault();
                passM.mutate({ userId: c.id, password }, { onSuccess: () => setPassword("") });
              }}
            >
              <h3 className="text-base font-semibold text-white font-display">Reset Password</h3>
              <PasswordInput
                className="mt-4"
                inputClassName="h-9 rounded-xl border-white/10 bg-slate-950/60 backdrop-blur-md text-white placeholder:text-slate-500"
                placeholder="New password (min 10 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button type="submit" size="sm" className="mt-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs" disabled={passM.isPending || password.length < 10}>
                Set Password
              </Button>
            </form>
          </div>

          {c.profile && (
            <div className="rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl p-6 shadow-xl">
              <h3 className="text-base font-semibold mb-2 text-white font-display">Security Questions</h3>
              <p className="text-xs text-slate-400 mb-4">
                Current: {c.profile.security_question_one} &amp; {c.profile.security_question_two}. Answers are stored with cryptographic hashes.
              </p>
              <ResetSecurity userId={c.id} />
            </div>
          )}
        </TabsContent>

        {/* TAB 6: DANGER ZONE */}
        <TabsContent value="danger" className="mt-4">
          <section className="rounded-2xl border border-rose-500/30 bg-rose-950/20 backdrop-blur-xl p-6 shadow-xl">
            <h3 className="text-base font-semibold text-rose-400 flex items-center gap-2 font-display">
              <AlertTriangle className="size-5" /> Danger Zone
            </h3>
            <p className="mt-2 text-xs text-slate-300">
              Permanently delete this customer's account, profile, bank accounts, and login credentials. This cannot be undone.
            </p>
            <AlertDialog onOpenChange={() => setConfirmText("")}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="mt-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs">
                  <Trash2 className="mr-1.5 size-3.5" /> Delete Customer Permanently
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-2xl text-slate-100 shadow-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-rose-400 flex items-center gap-2">
                    <Trash2 className="size-5" /> Delete customer {c.email}?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-xs text-slate-300">
                    Type <strong className="text-white font-mono">DELETE</strong> to confirm permanent erasure.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="rounded-xl border-white/10 bg-slate-950/60 backdrop-blur-md text-white font-mono"
                />
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-xs">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={confirmText !== "DELETE" || deleteM.isPending}
                    onClick={() => deleteM.mutate({ userId: c.id })}
                    className="rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
                  >
                    Delete Forever
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </section>
        </TabsContent>
      </Tabs>

      {/* Authorized Support "Log in as user" Dialog */}
      <LogInAsUserDialog
        open={impersonateOpen}
        onOpenChange={setImpersonateOpen}
        customer={c}
      />

      {/* Read-only Live UserProfile Modal */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-6">
          <DialogHeader className="mb-4">
            <DialogTitle>Viewing Customer Profile: {c.profile ? `${c.profile.first_name} ${c.profile.last_name}` : c.email}</DialogTitle>
            <DialogDescription>Live preview of the customer's dashboard and profile experience (recorded in audit log).</DialogDescription>
          </DialogHeader>
          <UserProfile
            user={{ id: c.id, email: c.email, banned: c.banned }}
            initialProfile={c.profile}
            accounts={c.accounts.map((a) => ({
              ...a,
              available_balance: Number(a.available_balance),
              current_balance: Number(a.current_balance),
              credit_limit: a.credit_limit === null ? null : Number(a.credit_limit),
            }))}
            isAdminView={true}
            isSuspended={c.banned}
            onStatusChange={async (suspended) => {
              await suspendM.mutateAsync({ userId: c.id, suspended });
            }}
            onSaveContact={async (data) => {
              await contactInfoM.mutateAsync({
                userId: c.id,
                email: c.email,
                ...data,
              });
            }}
          />
        </DialogContent>
      </Dialog>

      <AvatarModal
        open={avatarModalOpen}
        onOpenChange={setAvatarModalOpen}
        currentAvatarUrl={c.avatar_url}
        fullName={fullName || c.email}
        initials={initials}
        userId={c.id}
        onSave={async (url) => {
          await avatarM.mutateAsync({ userId: c.id, avatar_url: url || null });
        }}
        onAvatarUpdated={() => {}}
      />

      <EditContactInfoDialog
        open={contactModalOpen}
        onOpenChange={setContactModalOpen}
        customer={c}
      />

      <QuickCreditDebitModal
        open={quickCreditDebitOpen}
        onOpenChange={setQuickCreditDebitOpen}
        customer={c}
      />
    </div>
  );
}

function LogInAsUserDialog({
  open,
  onOpenChange,
  customer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer;
}) {
  const signInFn = useServerFn(signInAsCustomer);
  const [reason, setReason] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleLaunch = async () => {
    if (!reason.trim()) {
      toast.error("Please enter a support ticket or reason");
      return;
    }
    if (!agreed) {
      toast.error("You must acknowledge the security mandate");
      return;
    }

    const tab = window.open("about:blank", "_blank");
    setBusy(true);
    try {
      const { url } = await signInFn({
        data: {
          userId: customer.id,
          origin: window.location.origin,
          reason: reason.trim(),
        },
      });
      if (tab) tab.location.href = url;
      else window.location.href = url;
      toast.success("Signed in as customer in a new tab");
      onOpenChange(false);
    } catch (e) {
      tab?.close();
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-2xl text-slate-100 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white font-display">
            <Lock className="size-5 text-amber-400" /> Authorized Customer Support Access
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-300">
            You are initiating a direct support session for{" "}
            <strong className="text-white">{customer.profile ? `${customer.profile.first_name} ${customer.profile.last_name}` : customer.email}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="support-reason" className="text-xs font-semibold text-slate-300">
              Support Reason or Ticket Reference <span className="text-rose-400">*</span>
            </Label>
            <Input
              id="support-reason"
              placeholder="e.g. Ticket #9201 - Verify pending deposit"
              className="mt-1 h-9 rounded-xl border-white/10 bg-slate-950/60 backdrop-blur-md text-white placeholder:text-slate-500"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <label className="flex items-start gap-2.5 rounded-xl border border-white/10 p-3.5 cursor-pointer bg-slate-950/60 backdrop-blur-md">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 rounded accent-amber-500"
            />
            <span className="text-xs text-slate-300 leading-relaxed">
              I certify that this support session is authorized for official bank operations. This event and my admin username will be permanently recorded in the immutable audit log.
            </span>
          </label>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={busy} className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-xs">
            Cancel
          </Button>
          <Button size="sm" onClick={handleLaunch} disabled={busy || !reason.trim() || !agreed} className="rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs">
            {busy ? "Authorizing…" : "Launch Customer Session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditContactInfoDialog({
  open,
  onOpenChange,
  customer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer;
}) {
  const qc = useQueryClient();
  const detailsFn = useServerFn(updateCustomerDetails);
  const [form, setForm] = useState({
    first_name: customer.profile?.first_name ?? "",
    last_name: customer.profile?.last_name ?? "",
    email: customer.email,
    phone: customer.profile?.phone ?? "",
    address: customer.profile?.address ?? "",
    city: customer.profile?.city ?? "",
    postal_code: customer.profile?.postal_code ?? "",
    security_question_one: customer.profile?.security_question_one ?? QUESTIONS[0]!,
    security_question_two: customer.profile?.security_question_two ?? QUESTIONS[1]!,
    answer_one: "",
    answer_two: "",
    transfer_pin: "",
    password: "",
  });

  useEffect(() => {
    setForm({
      first_name: customer.profile?.first_name ?? "",
      last_name: customer.profile?.last_name ?? "",
      email: customer.email,
      phone: customer.profile?.phone ?? "",
      address: customer.profile?.address ?? "",
      city: customer.profile?.city ?? "",
      postal_code: customer.profile?.postal_code ?? "",
      security_question_one: customer.profile?.security_question_one ?? QUESTIONS[0]!,
      security_question_two: customer.profile?.security_question_two ?? QUESTIONS[1]!,
      answer_one: "",
      answer_two: "",
      transfer_pin: "",
      password: "",
    });
  }, [customer]);

  const m = useMutation({
    mutationFn: (data: typeof form) => detailsFn({ data: { userId: customer.id, ...data } }),
    onSuccess: () => {
      toast.success("Customer details updated successfully");
      qc.invalidateQueries({ queryKey: ["admin-customers"] });
      qc.invalidateQueries({ queryKey: ["admin-audit"] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast.error("First and last name are required");
      return;
    }
    if (!form.email.trim() || !form.email.includes("@")) {
      toast.error("A valid email address is required");
      return;
    }
    if (!form.phone.trim()) {
      toast.error("A contact telephone number is required");
      return;
    }
    if (form.transfer_pin && !/^\d{4,6}$/.test(form.transfer_pin)) {
      toast.error("Transfer PIN must contain 4 to 6 digits");
      return;
    }
    if (form.password && form.password.length < 10) {
      toast.error("A new password must contain at least 10 characters");
      return;
    }
    m.mutate(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-2xl text-slate-100 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white font-display">
            <FileText className="size-5 text-amber-400" /> Edit All Customer Details
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-300">
            Update identity, contact, login, and security records for{" "}
            <strong className="text-white">{customer.profile ? `${customer.profile.first_name} ${customer.profile.last_name}` : customer.email}</strong>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ci-first-name" className="text-xs font-semibold text-slate-300">
                Legal First Name <span className="text-rose-400">*</span>
              </Label>
              <Input
                id="ci-first-name"
                className="mt-1 h-9 rounded-xl border-white/10 bg-slate-950/60 backdrop-blur-md text-white placeholder:text-slate-500"
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="ci-last-name" className="text-xs font-semibold text-slate-300">
                Legal Last Name <span className="text-rose-400">*</span>
              </Label>
              <Input
                id="ci-last-name"
                className="mt-1 h-9 rounded-xl border-white/10 bg-slate-950/60 backdrop-blur-md text-white placeholder:text-slate-500"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ci-email" className="text-xs font-semibold text-slate-300">
                Email Address <span className="text-rose-400">*</span>
              </Label>
              <Input
                id="ci-email"
                type="email"
                className="mt-1 h-9 rounded-xl border-white/10 bg-slate-950/60 backdrop-blur-md text-white placeholder:text-slate-500"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="ci-phone" className="text-xs font-semibold text-slate-300">
                Telephone / Mobile <span className="text-rose-400">*</span>
              </Label>
              <Input
                id="ci-phone"
                className="mt-1 h-9 rounded-xl border-white/10 bg-slate-950/60 backdrop-blur-md text-white placeholder:text-slate-500"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+1 (555) 000-0000"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="ci-address" className="text-xs font-semibold text-slate-300">
              Primary Residential Address <span className="text-rose-400">*</span>
            </Label>
            <Input
              id="ci-address"
              className="mt-1 h-9 rounded-xl border-white/10 bg-slate-950/60 backdrop-blur-md text-white placeholder:text-slate-500"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="123 Financial Way, Suite 400"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ci-city" className="text-xs font-semibold text-slate-300">
                City, State / Region <span className="text-rose-400">*</span>
              </Label>
              <Input
                id="ci-city"
                className="mt-1 h-9 rounded-xl border-white/10 bg-slate-950/60 backdrop-blur-md text-white placeholder:text-slate-500"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="e.g. Atlanta, GA or New York, NY"
                required
              />
            </div>
            <div>
              <Label htmlFor="ci-postal" className="text-xs font-semibold text-slate-300">
                Postal / ZIP Code <span className="text-rose-400">*</span>
              </Label>
              <Input
                id="ci-postal"
                className="mt-1 h-9 rounded-xl border-white/10 bg-slate-950/60 backdrop-blur-md text-white placeholder:text-slate-500"
                value={form.postal_code}
                onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
                placeholder="e.g. 30303 or 10001"
                required
              />
            </div>
          </div>

          <fieldset className="space-y-4 border-t border-white/10 pt-5">
            <legend className="px-1 text-sm font-semibold text-white">Security questions</legend>
            <p className="text-xs text-slate-400">Leave either answer blank to keep its current one-way security hash.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {([["security_question_one", "answer_one"], ["security_question_two", "answer_two"]] as const).map(([questionKey, answerKey], index) => (
                <div key={questionKey} className="space-y-3 rounded-xl border border-white/10 bg-slate-950/40 p-4">
                  <div>
                    <Label htmlFor={`ci-${questionKey}`} className="text-xs font-semibold text-slate-300">Security Question {index + 1}</Label>
                    <select
                      id={`ci-${questionKey}`}
                      className="mt-1 h-9 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 text-xs text-white"
                      value={form[questionKey]}
                      onChange={(e) => setForm({ ...form, [questionKey]: e.target.value })}
                      required
                    >
                      {Array.from(new Set([form[questionKey], ...QUESTIONS])).map((question) => <option key={question} value={question} className="bg-slate-900 text-white">{question}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor={`ci-${answerKey}`} className="text-xs font-semibold text-slate-300">New Answer {index + 1} (optional)</Label>
                    <PasswordInput
                      id={`ci-${answerKey}`}
                      className="mt-1"
                      inputClassName="h-9 rounded-xl border-white/10 bg-slate-950/60 text-white placeholder:text-slate-500"
                      maxLength={100}
                      value={form[answerKey]}
                      onChange={(e) => setForm({ ...form, [answerKey]: e.target.value })}
                      placeholder="Keep current answer"
                      autoComplete="off"
                    />
                  </div>
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset className="grid gap-4 border-t border-white/10 pt-5 sm:grid-cols-2">
            <legend className="col-span-full px-1 text-sm font-semibold text-white">Login &amp; transfer security</legend>
            <div>
              <Label htmlFor="ci-transfer-pin" className="text-xs font-semibold text-slate-300">New Transfer PIN (optional)</Label>
              <PasswordInput
                id="ci-transfer-pin"
                className="mt-1"
                inputClassName="h-9 rounded-xl border-white/10 bg-slate-950/60 text-white placeholder:text-slate-500"
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                value={form.transfer_pin}
                onChange={(e) => setForm({ ...form, transfer_pin: e.target.value.replace(/\D/g, "") })}
                placeholder="4–6 digits; keep current if blank"
              />
            </div>
            <div>
              <Label htmlFor="ci-new-password" className="text-xs font-semibold text-slate-300">New Login Password (optional)</Label>
              <PasswordInput
                id="ci-new-password"
                className="mt-1"
                inputClassName="h-9 rounded-xl border-white/10 bg-slate-950/60 text-white placeholder:text-slate-500"
                autoComplete="new-password"
                maxLength={72}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Minimum 10 characters"
              />
            </div>
          </fieldset>

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={m.isPending} className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-xs">
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={m.isPending} className="rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs">
              {m.isPending ? "Saving..." : "Save All Customer Details"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function QuickCreditDebitModal({
  open,
  onOpenChange,
  customer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
}) {
  const qc = useQueryClient();
  const postTxn = useServerFn(postTransaction);
  const addAcct = useServerFn(addCustomerAccount);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [type, setType] = useState<"CREDIT" | "DEBIT">("CREDIT");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("Administrative deposit");
  const [reference, setReference] = useState("");
  const [transactionDate, setTransactionDate] = useState(currentTransactionDate);
  const [busy, setBusy] = useState(false);
  const [creatingAcct, setCreatingAcct] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (customer?.accounts && customer.accounts.length > 0) {
      setSelectedAccountId(customer.accounts[0]!.id);
      setAmount("");
      setType("CREDIT");
      setDescription("Administrative credit / deposit");
      setReference("");
      setTransactionDate(currentTransactionDate());
    } else {
      setSelectedAccountId("");
    }
  }, [customer?.id, open]);

  if (!customer) return null;

  const currentAccount = customer.accounts.find((a) => a.id === selectedAccountId) ?? customer.accounts[0];
  const cleanAmount = amount.replace(/,/g, "").trim();
  const numAmount = Number(cleanAmount);
  const validAmount = /^\d{1,10}(\.\d{1,2})?$/.test(cleanAmount) && numAmount > 0;

  const before = Number(currentAccount?.available_balance || 0);
  const after = currentAccount ? before + (type === "CREDIT" ? numAmount : -numAmount) : 0;
  const isOverdraft = type === "DEBIT" && after < 0;

  const handleCreateStarterAccount = async () => {
    setCreatingAcct(true);
    try {
      await addAcct({
        data: {
          userId: customer.id,
          account_type: "checking",
          name: "Everyday Checking",
          available_balance: 0,
          current_balance: 0,
          credit_limit: null,
        },
      });
      toast.success("Everyday Checking account opened for customer");
      await qc.invalidateQueries({ queryKey: ["admin-customers"] });
    } catch (e: any) {
      toast.error(errMsg(e));
    } finally {
      setCreatingAcct(false);
    }
  };

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAccount) {
      toast.error("Please select or initialize an account first");
      return;
    }
    if (!validAmount) {
      toast.error("Please enter a valid positive amount (e.g. 500.00)");
      return;
    }
    if (description.trim().length < 3) {
      toast.error("A description / reason of at least 3 characters is required");
      return;
    }
    if (!isValidTransactionDate(transactionDate)) {
      toast.error("Please choose a valid transaction date");
      return;
    }

    setBusy(true);
    try {
      await postTxn({
        data: {
          accountId: currentAccount.id,
          type,
          amount: cleanAmount,
          currency: currentAccount.currency || "USD",
          description: description.trim(),
          reference: reference.trim() || undefined,
          idempotencyKey: crypto.randomUUID(),
          allowOverdraft: true,
          transactionDate,
        },
      });
      toast.success(`${type === "CREDIT" ? "Credited" : "Debited"} ${money(numAmount)} on ${currentAccount.name}, dated ${formatTransactionDate(transactionDate)}`);
      await qc.invalidateQueries({ queryKey: ["admin-customers"] });
      await qc.invalidateQueries({ queryKey: ["admin-audit"] });
      await qc.invalidateQueries({ queryKey: ["admin-txns"] });
      onOpenChange(false);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const customerName = customer.profile ? `${customer.profile.first_name} ${customer.profile.last_name}`.trim() : customer.email;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-2xl text-slate-100 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white font-display">
            <TrendingUp className="size-5 text-amber-400" /> Credit or Debit Customer Account
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-300">
            Post an immediate ledger credit or debit for <strong className="text-white">{customerName}</strong> ({customer.email}).
          </DialogDescription>
        </DialogHeader>

        {customer.accounts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 p-6 text-center space-y-3 bg-white/5">
            <Wallet className="size-8 mx-auto text-slate-400" />
            <h4 className="font-semibold text-sm text-white">No Active Accounts</h4>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              This customer does not have an active banking account yet. Initialize their Everyday Checking account to start crediting.
            </p>
            <Button
              type="button"
              size="sm"
              onClick={handleCreateStarterAccount}
              disabled={creatingAcct}
              className="text-xs rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold"
            >
              {creatingAcct ? "Opening Checking..." : "Open Everyday Checking Account"}
            </Button>
          </div>
        ) : (
          <form onSubmit={handlePost} className="space-y-4 py-2">
            {/* Account Selector */}
            <div>
              <Label className="text-xs font-semibold text-slate-300">Select Target Account</Label>
              <select
                value={selectedAccountId || currentAccount?.id}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="mt-1 h-9 w-full rounded-xl border border-white/10 bg-slate-950/60 backdrop-blur-md px-3 text-xs text-white"
              >
                {customer.accounts.map((a) => (
                  <option key={a.id} value={a.id} className="bg-slate-900 text-white">
                    {a.name} (•••• {a.last_four}) — Available: {money(a.available_balance)} [{a.account_type.toUpperCase()}]
                  </option>
                ))}
              </select>
            </div>

            {/* Type selector */}
            <div>
              <Label className="text-xs font-semibold text-slate-300">Transaction Type</Label>
              <div className="grid grid-cols-2 gap-3 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    setType("CREDIT");
                    setDescription("Administrative credit / deposit");
                  }}
                  className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition-all ${
                    type === "CREDIT"
                      ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300 shadow-sm"
                      : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <ArrowUpRight className="size-4" /> Credit (+) [Add Funds]
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setType("DEBIT");
                    setDescription("Administrative debit / fee");
                  }}
                  className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition-all ${
                    type === "DEBIT"
                      ? "border-rose-500/50 bg-rose-500/20 text-rose-300 shadow-sm"
                      : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <ArrowDownRight className="size-4" /> Debit (−) [Deduct Funds]
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="quick-transaction-date" className="text-xs font-semibold">
                Transaction Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="quick-transaction-date"
                className="mt-1 text-xs"
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                required
              />
              <p className="mt-1 text-[11px] text-muted-foreground">This date appears in transaction history; the actual entry time is retained for auditing.</p>
            </div>

            {/* Amount input & Quick buttons */}
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="quick-amount" className="text-xs font-semibold text-slate-300">
                  Amount ({currentAccount?.currency || "USD"}) <span className="text-rose-400">*</span>
                </Label>
                <span className="text-[11px] text-slate-400">
                  Current: <strong className="text-white">{money(currentAccount?.available_balance || 0)}</strong>
                </span>
              </div>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-mono">$</span>
                <Input
                  id="quick-amount"
                  className="pl-7 font-mono font-bold text-sm h-10 rounded-xl border-white/10 bg-slate-950/60 backdrop-blur-md text-white placeholder:text-slate-500 focus:border-amber-500/50"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>

              {/* Quick Amount Chips */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[100, 500, 1000, 5000, 10000, 25000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAmount(String(preset))}
                    className="text-[11px] font-mono rounded-lg bg-white/5 border border-white/10 px-2.5 py-1 hover:bg-white/10 hover:text-white text-slate-300 transition-all"
                  >
                    +${preset.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* Description & Reference */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="quick-desc" className="text-xs font-semibold text-slate-300">
                  Description / Memo <span className="text-rose-400">*</span>
                </Label>
                <Input
                  id="quick-desc"
                  className="mt-1 text-xs h-9 rounded-xl border-white/10 bg-slate-950/60 backdrop-blur-md text-white placeholder:text-slate-500 focus:border-amber-500/50"
                  maxLength={300}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Wire transfer, payroll"
                  required
                />
              </div>
              <div>
                <Label htmlFor="quick-ref" className="text-xs font-semibold text-slate-300">
                  Internal Reference (Optional)
                </Label>
                <Input
                  id="quick-ref"
                  className="mt-1 text-xs font-mono h-9 rounded-xl border-white/10 bg-slate-950/60 backdrop-blur-md text-white placeholder:text-slate-500 focus:border-amber-500/50"
                  maxLength={100}
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. TXN-9201"
                />
              </div>
            </div>

            {/* Live Balance Summary */}
            {validAmount && currentAccount && (
              <div className="rounded-xl border border-white/10 bg-slate-950/60 backdrop-blur-md p-3.5 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Current Available Balance:</span>
                  <span className="font-mono font-medium text-white">{money(before)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{type === "CREDIT" ? "Credit Addition:" : "Debit Deduction:"}</span>
                  <span className={`font-mono font-bold ${type === "CREDIT" ? "text-emerald-400" : "text-rose-400"}`}>
                    {type === "CREDIT" ? "+" : "−"}{money(numAmount)}
                  </span>
                </div>
                <div className="border-t border-white/10 pt-1.5 flex justify-between font-bold">
                  <span className="text-white">Resulting Available Balance:</span>
                  <span className={`font-mono ${after < 0 ? "text-rose-400" : "text-emerald-400"}`}>
                    {money(after)}
                  </span>
                </div>
                {isOverdraft && (
                  <p className="text-[11px] text-amber-300 pt-1 font-medium">
                    ⚠️ Notice: This debit will result in a negative balance ({money(after)}). Administrative overdraft is authorized.
                  </p>
                )}
              </div>
            )}

            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={busy} className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-xs">
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={busy || !validAmount}
                className={`rounded-xl text-xs font-semibold ${type === "CREDIT" ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-rose-600 hover:bg-rose-500 text-white"}`}
              >
                {busy ? "Processing…" : `Confirm ${type === "CREDIT" ? "Credit (+)" : "Debit (−)"}`}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AccountEditor({ a }: { a: Customer["accounts"][number] }) {
  const m = useAdminAction(useServerFn(updateAccountBalance), "Account settings saved");
  const renameM = useAdminAction(useServerFn(renameCustomerAccount), "Account details updated");
  const directM = useAdminAction(useServerFn(setDirectAccountBalance), "Account balance adjusted");
  const [limit, setLimit] = useState(a.credit_limit === null ? "" : String(a.credit_limit));
  const [overdraft, setOverdraft] = useState(a.allow_overdraft);
  const [name, setName] = useState(a.name);
  const [four, setFour] = useState(a.last_four);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [directAvailable, setDirectAvailable] = useState(String(a.available_balance));
  const [directCurrent, setDirectCurrent] = useState(String(a.current_balance));
  const [directReason, setDirectReason] = useState("Administrative balance adjustment");
  const [directDate, setDirectDate] = useState(currentTransactionDate);

  useEffect(() => {
    setDirectAvailable(String(a.available_balance));
    setDirectCurrent(String(a.current_balance));
    setName(a.name);
    setFour(a.last_four);
    setLimit(a.credit_limit === null ? "" : String(a.credit_limit));
    setOverdraft(a.allow_overdraft);
  }, [a]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (limit !== "" && !Number.isFinite(Number(limit))) {
      toast.error("Enter a valid credit limit");
      return;
    }
    m.mutate({
      accountId: a.id,
      credit_limit: a.account_type === "credit" && limit !== "" ? Number(limit) : null,
      allow_overdraft: overdraft,
    });
    if (name !== a.name || four !== a.last_four) {
      if (!/^\d{4}$/.test(four)) {
        toast.error("Last four must be 4 digits");
        return;
      }
      renameM.mutate({ accountId: a.id, name, last_four: four });
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 backdrop-blur-md p-5 space-y-4 shadow-lg">
      <form onSubmit={submit} className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/10 pb-3">
          <div>
            <p className="text-xs text-slate-400 capitalize">{a.account_type} Account</p>
            <p className="text-base font-semibold text-white">{a.name} (•••• {a.last_four})</p>
          </div>
          <div className="text-right flex flex-col items-end gap-1">
            <p className="text-xs text-slate-400">Available Balance</p>
            <p className="text-xl font-bold text-amber-400 font-display">
              {a.available_balance.toLocaleString("en-US", { style: "currency", currency: a.currency })}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setDirectAvailable(String(a.available_balance));
                setDirectCurrent(String(a.current_balance));
                setAdjustOpen(true);
              }}
              className="h-6 text-[10px] px-2 rounded-lg border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white"
            >
              <Sliders className="mr-1 size-3" /> Adjust Directly
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_120px_auto] sm:items-end">
          <div>
            <Label className="text-xs text-slate-300">Account Label</Label>
            <Input className="mt-1 h-9 rounded-xl border-white/10 bg-slate-950/60 backdrop-blur-md text-white placeholder:text-slate-500" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs text-slate-300">Last 4 Digits</Label>
            <Input className="mt-1 h-9 font-mono rounded-xl border-white/10 bg-slate-950/60 backdrop-blur-md text-white" maxLength={4} value={four} onChange={(e) => setFour(e.target.value)} />
          </div>

        </div>

        <div className="grid items-center gap-3 sm:grid-cols-[1fr_1fr_auto] border-t border-white/10 pt-3">
          <div>
            {a.account_type === "credit" && (
              <>
                <Label className="text-xs text-slate-300">Credit Limit</Label>
                <Input className="mt-1 h-9 rounded-xl border-white/10 bg-slate-950/60 backdrop-blur-md text-white font-mono" inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} />
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={overdraft} onCheckedChange={setOverdraft} id={`od-${a.id}`} />
            <Label htmlFor={`od-${a.id}`} className="text-xs text-slate-300 cursor-pointer">Allow Overdraft</Label>
          </div>
          <Button type="submit" size="sm" disabled={m.isPending || renameM.isPending} className="rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs h-9">
            Save Settings
          </Button>
        </div>
      </form>

      <TransactionForm a={a} />

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-2xl text-slate-100 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white font-display">
              <Sliders className="size-4 text-amber-400" /> Direct Balance Override
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-300">
              Directly set the balances for <strong className="text-white">{a.name} (•••• {a.last_four})</strong>. This adjustment will be recorded in the security audit log.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const avail = Number(directAvailable.replace(/,/g, ""));
              const curr = Number(directCurrent.replace(/,/g, ""));
              if (!Number.isFinite(avail) || !Number.isFinite(curr)) {
                toast.error("Please enter valid numbers for balances");
                return;
              }
              if (!isValidTransactionDate(directDate)) {
                toast.error("Please choose a valid transaction date");
                return;
              }
              directM.mutate(
                {
                  accountId: a.id,
                  available_balance: avail,
                  current_balance: curr,
                  reason: directReason.trim() || "Administrative balance adjustment",
                  transactionDate: directDate,
                },
                {
                  onSuccess: () => setAdjustOpen(false),
                }
              );
            }}
            className="space-y-4 py-2"
          >
            <div>
              <Label className="text-xs font-semibold text-slate-300">Available Balance ({a.currency})</Label>
              <Input
                className="mt-1 h-9 rounded-xl border-white/10 bg-slate-950/60 backdrop-blur-md text-white font-mono"
                inputMode="decimal"
                value={directAvailable}
                onChange={(e) => setDirectAvailable(e.target.value)}
                required
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Funds immediately available for customer spending or transfers.
              </p>
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-300">
                {a.account_type === "credit" ? "Current Balance Owed (Card Debt)" : "Current / Ledger Balance"} ({a.currency})
              </Label>
              <Input
                className="mt-1 h-9 rounded-xl border-white/10 bg-slate-950/60 backdrop-blur-md text-white font-mono"
                inputMode="decimal"
                value={directCurrent}
                onChange={(e) => setDirectCurrent(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor={`direct-date-${a.id}`} className="text-xs font-semibold text-slate-300">Transaction Date</Label>
              <Input
                id={`direct-date-${a.id}`}
                type="date"
                className="mt-1 h-9 rounded-xl border-white/10 bg-slate-950/60 backdrop-blur-md text-white text-xs"
                value={directDate}
                onChange={(e) => setDirectDate(e.target.value)}
                required
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-300">Reason for Balance Override</Label>
              <Input
                className="mt-1 h-9 rounded-xl border-white/10 bg-slate-950/60 backdrop-blur-md text-white text-xs placeholder:text-slate-500"
                maxLength={200}
                value={directReason}
                onChange={(e) => setDirectReason(e.target.value)}
                placeholder="e.g. Account opening deposit correction, manual adjustment"
                required
              />
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" size="sm" onClick={() => setAdjustOpen(false)} disabled={directM.isPending} className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-xs">
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={directM.isPending} className="rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs">
                {directM.isPending ? "Applying…" : "Save Balance"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddAccount({ userId }: { userId: string }) {
  const m = useAdminAction(useServerFn(addCustomerAccount), "Account created");
  return (
    <Button type="button" variant="outline" className="mt-4" disabled={m.isPending}
      onClick={() => m.mutate({ userId, account_type: "checking", name: "Everyday Checking", available_balance: 0, current_balance: 0, credit_limit: null })}>
      <Plus className="mr-2 size-4" /> {m.isPending ? "Creating…" : "Create account"}
    </Button>
  );
}

const QUESTIONS = [
  "What was the name of your first pet?",
  "In what city were you born?",
  "What was the name of your childhood friend?",
  "What was your first job?",
];

const emptyProfile = { first_name: "", last_name: "", phone: "", address: "", city: "", postal_code: "" };
const emptySec = { security_question_one: QUESTIONS[0]!, answer_one: "", security_question_two: QUESTIONS[1]!, answer_two: "" };

function SecurityFields({ v, set }: { v: typeof emptySec; set: (v: typeof emptySec) => void }) {
  return (
    <>
      {([["security_question_one", "answer_one"], ["security_question_two", "answer_two"]] as const).map(([q, a], i) => (
        <div key={q} className="space-y-1.5">
          <Label className="text-xs text-slate-300">Security Question {i + 1}</Label>
          <select
            className="h-9 w-full rounded-xl border border-white/10 bg-slate-950/60 backdrop-blur-md px-3 text-xs text-white"
            value={v[q]}
            onChange={(e) => set({ ...v, [q]: e.target.value })}
          >
            {QUESTIONS.map((opt) => (
              <option key={opt} value={opt} className="bg-slate-900 text-white">
                {opt}
              </option>
            ))}
          </select>
          <Input
            placeholder="Security answer"
            className="text-xs h-9 rounded-xl border-white/10 bg-slate-950/60 backdrop-blur-md text-white placeholder:text-slate-500"
            value={v[a]}
            onChange={(e) => set({ ...v, [a]: e.target.value })}
          />
        </div>
      ))}
    </>
  );
}

function CreateProfile({ userId }: { userId: string }) {
  const m = useAdminAction(useServerFn(createProfileForCustomer), "Profile created");
  const [p, setP] = useState(emptyProfile);
  const [s, setS] = useState(emptySec);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    m.mutate({ userId, ...p, ...s });
  };
  return (
    <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl p-6 space-y-4 shadow-xl">
      <h3 className="text-base font-semibold text-white font-display">Create Initial Customer Profile</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {(Object.keys(p) as (keyof typeof p)[]).map((k) => (
          <div key={k} className={k === "address" ? "sm:col-span-2" : ""}>
            <Label className="capitalize text-xs text-slate-300">{k.replace("_", " ")}</Label>
            <Input className="mt-1 text-xs h-9 rounded-xl border-white/10 bg-slate-950/60 backdrop-blur-md text-white placeholder:text-slate-500" value={p[k]} onChange={(e) => setP({ ...p, [k]: e.target.value })} />
          </div>
        ))}
        <SecurityFields v={s} set={setS} />
      </div>
      <Button type="submit" size="sm" disabled={m.isPending} className="rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs">
        {m.isPending ? "Creating..." : "Create Profile"}
      </Button>
    </form>
  );
}

function ResetSecurity({ userId }: { userId: string }) {
  const m = useAdminAction(useServerFn(resetSecurityQuestions), "Security questions reset");
  const [s, setS] = useState(emptySec);
  const [open, setOpen] = useState(false);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    m.mutate({ userId, ...s }, { onSuccess: () => setOpen(false) });
  };
  return (
    <div>
      <Button type="button" variant="outline" size="sm" className="text-xs rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-slate-200" onClick={() => setOpen(!open)}>
        <KeyRound className="mr-1.5 size-3.5" /> Reset Security Questions
      </Button>
      {open && (
        <form onSubmit={submit} className="mt-4 space-y-3 rounded-2xl border border-white/10 p-5 bg-slate-950/40 backdrop-blur-md">
          <SecurityFields v={s} set={setS} />
          <Button type="submit" size="sm" disabled={m.isPending} className="rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs">
            Save New Questions
          </Button>
        </form>
      )}
    </div>
  );
}

function NewCustomerDialog() {
  const [open, setOpen] = useState(false);
  const createM = useAdminAction(useServerFn(createCustomer), "Customer created successfully!", () => {
    setOpen(false);
    setEmail("");
    setPassword("");
    setP(emptyProfile);
    setS(emptySec);
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [p, setP] = useState(emptyProfile);
  const [s, setS] = useState(emptySec);

  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*";
    let pass = "ETB$";
    for (let i = 0; i < 12; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(pass);
    toast.info("Strong secure password generated: " + pass);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    createM.mutate({ email: email.trim(), password, ...p, ...s });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)} className="h-8 gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold shadow-sm">
        <UserPlus className="size-3.5" /> Add Customer
      </Button>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-2xl text-slate-100 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-white font-display">Create New Bank Customer</DialogTitle>
          <DialogDescription className="text-xs text-slate-300">
            Creates an authenticated login and automatically provisions Everyday Checking and Gold Rewards Card accounts.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 py-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs text-slate-300">Email <span className="text-rose-400">*</span></Label>
              <Input
                type="email"
                placeholder="customer@domain.com"
                className="mt-1 text-xs h-9 rounded-xl border-white/10 bg-slate-950/60 backdrop-blur-md text-white placeholder:text-slate-500"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs text-slate-300">Password <span className="text-rose-400">*</span></Label>
                <button
                  type="button"
                  onClick={generatePassword}
                  className="text-[10px] text-amber-400 hover:underline"
                >
                  Generate Strong
                </button>
              </div>
              <Input
                type="text"
                className="mt-1 text-xs font-mono h-9 rounded-xl border-white/10 bg-slate-950/60 backdrop-blur-md text-white placeholder:text-slate-500"
                required
                placeholder="Min 10 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(Object.keys(p) as (keyof typeof p)[]).map((k) => (
              <div key={k} className={k === "address" ? "sm:col-span-2" : ""}>
                <Label className="capitalize text-xs text-slate-300">{k.replace("_", " ")} <span className="text-rose-400">*</span></Label>
                <Input className="mt-1 text-xs h-9 rounded-xl border-white/10 bg-slate-950/60 backdrop-blur-md text-white placeholder:text-slate-500" required value={p[k]} onChange={(e) => setP({ ...p, [k]: e.target.value })} />
              </div>
            ))}
          </div>
          <SecurityFields v={s} set={setS} />
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-xs">
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={createM.isPending || password.length < 10} className="rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs">
              {createM.isPending ? "Creating Account…" : "Create Customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PurgeTestrunDialog({ onPurged }: { onPurged: () => void }) {
  const purgeFn = useServerFn(purgeTestrunUsers);
  const [purging, setPurging] = useState(false);
  const [open, setOpen] = useState(false);

  const handlePurge = async () => {
    setPurging(true);
    try {
      const res = await purgeFn();
      if (res.purgedCount > 0) {
        toast.success(`Successfully purged ${res.purgedCount} testrun user(s)! Only user-created accounts remain.`);
      } else {
        toast.info("No testrun users found. Only your custom accounts exist.");
      }
      setOpen(false);
      onPurged();
    } catch (err: any) {
      toast.error(err?.message || "Failed to purge testrun users");
    } finally {
      setPurging(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 rounded-xl border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 hover:text-rose-200 text-xs font-medium transition-all"
        >
          <Sparkles className="size-3.5 text-rose-400" />
          Purge Test Users
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-rose-400 text-lg">
            <Trash2 className="size-5" />
            Purge All Testrun Customers?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs text-slate-300 leading-relaxed space-y-2">
            <span className="block">
              This will automatically identify and delete dummy, sample, and test accounts
              (e.g. <code className="text-amber-300 font-mono">*@test.com</code>, <code className="text-amber-300 font-mono">*@example.com</code>, <code className="text-amber-300 font-mono">*@client.easterntrustbank.co</code>, Jane Doe, or test profiles).
            </span>
            <span className="block font-semibold text-rose-300">
              Only authentic user-created accounts will be kept intact.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-xs">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handlePurge}
            disabled={purging}
            className="rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs"
          >
            {purging ? "Purging Test Users…" : "Yes, Purge Test Accounts"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

