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
  Calendar,
  Shield,
  ArrowDownRight,
  ArrowUpRight,
  Camera,
  Edit3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  removeCustomerAccount,
  signInAsCustomer,
  signOutCustomer,
  saveSupabaseServiceKey,
  checkServiceKeyStatus,
  updateCustomerAvatar,
  updateCustomerContactInfo,
} from "@/lib/admin.functions";
import { TransactionForm, TransactionLedger } from "@/components/admin-transactions";
import { UserProfile } from "@/components/user-profile";
import { AdminReports } from "@/components/admin-reports";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AvatarModal } from "@/components/avatar-modal";

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
  if (isLoading) return <main className="mx-auto max-w-7xl px-5 py-16 text-muted-foreground animate-pulse">Loading admin portal…</main>;
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
      const r = await loginFn({ data: { username, password } });
      if (!r.ok) setError(r.error);
      else await qc.invalidateQueries({ queryKey: ["admin-session"] });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="mx-auto max-w-md px-5 py-20">
      <div className="flex size-12 items-center justify-center rounded-xl border border-primary/40 bg-primary/10 text-primary">
        <ShieldCheck className="size-7" />
      </div>
      <p className="mt-5 text-xs font-semibold uppercase tracking-widest text-primary">Authorized Personnel Only</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Admin & Staff Portal</h1>
      <p className="mt-2 text-sm text-muted-foreground">Sign in to manage customers, accounts, and monitor transactions.</p>
      <form onSubmit={submit} className="mt-8 space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div>
          <Label htmlFor="au">Admin Username</Label>
          <Input id="au" className="mt-1" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="ap">Admin Password</Label>
          <Input id="ap" type="password" className="mt-1" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy || !username || !password}>
          {busy ? "Authenticating…" : "Sign In to Portal"}
        </Button>
      </form>
    </main>
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
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended" | "admin" | "unconfirmed">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
      return true;
    });
  }, [customers.data, q, statusFilter]);

  const selected = customers.data?.find((c) => c.id === selectedId) ?? null;
  const emailOf = (id: string | null) => customers.data?.find((c) => c.id === id)?.email ?? id?.slice(0, 8) ?? "—";

  return (
    <main className="py-10">
      <Toaster />
      <div className="mx-auto max-w-7xl px-5 lg:px-8 space-y-8">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                <ShieldCheck className="size-4" />
              </span>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">Staff Operations</p>
            </div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">Admin Dashboard</h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Logged in as</p>
              <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                {adminName} <Badge variant="outline" className="text-[10px] py-0">Admin</Badge>
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="mr-1.5 size-3.5" /> Sign Out
            </Button>
          </div>
        </div>

        {/* Global Banking Metrics Ribbon */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Customer Deposits</span>
              <Wallet className="size-4 text-primary" />
            </div>
            <p className="mt-2 text-2xl font-bold text-primary font-display">{money(metrics.totalDeposits)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Liquid Everyday Checking</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">Active Credit Drawn</span>
              <CreditCard className="size-4 text-amber-400" />
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground font-display">{money(metrics.totalCredit)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Gold Rewards Outstanding</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">Registered Accounts</span>
              <Users className="size-4 text-primary" />
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground font-display">{metrics.totalCustomers}</p>
            <p className="mt-1 text-xs text-muted-foreground">{metrics.activeCustomers} active customers</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">Security & Audit Status</span>
              <CheckCircle2 className="size-4 text-emerald-400" />
            </div>
            <p className="mt-2 text-2xl font-bold text-emerald-400 font-display">Compliant</p>
            <p className="mt-1 text-xs text-muted-foreground">{audit.data?.length ?? 0} logged staff actions</p>
          </div>
        </section>

        {/* Top-Level Tabs */}
        <Tabs defaultValue="customers" className="w-full">
          <div className="border-b border-border">
            <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-none bg-transparent p-0 pb-px">
              <TabsTrigger
                value="customers"
                className="rounded-t-lg border-b-2 border-transparent px-4 py-3 text-sm font-medium data-[state=active]:border-primary data-[state=active]:bg-card data-[state=active]:text-foreground"
              >
                <Users className="mr-2 size-4" /> Customer Management
              </TabsTrigger>
              <TabsTrigger
                value="inquiries"
                className="rounded-t-lg border-b-2 border-transparent px-4 py-3 text-sm font-medium data-[state=active]:border-primary data-[state=active]:bg-card data-[state=active]:text-foreground"
              >
                <Mail className="mr-2 size-4" /> Homepage Inquiries
              </TabsTrigger>
              <TabsTrigger
                value="transactions"
                className="rounded-t-lg border-b-2 border-transparent px-4 py-3 text-sm font-medium data-[state=active]:border-primary data-[state=active]:bg-card data-[state=active]:text-foreground"
              >
                <Clock className="mr-2 size-4" /> Transaction Monitoring
              </TabsTrigger>
              <TabsTrigger
                value="reports"
                className="rounded-t-lg border-b-2 border-transparent px-4 py-3 text-sm font-medium data-[state=active]:border-primary data-[state=active]:bg-card data-[state=active]:text-foreground"
              >
                <FileSpreadsheet className="mr-2 size-4" /> Reports & Analytics
              </TabsTrigger>
              <TabsTrigger
                value="permissions"
                className="rounded-t-lg border-b-2 border-transparent px-4 py-3 text-sm font-medium data-[state=active]:border-primary data-[state=active]:bg-card data-[state=active]:text-foreground"
              >
                <Sliders className="mr-2 size-4" /> Role Permissions
              </TabsTrigger>
              <TabsTrigger
                value="audit"
                className="rounded-t-lg border-b-2 border-transparent px-4 py-3 text-sm font-medium data-[state=active]:border-primary data-[state=active]:bg-card data-[state=active]:text-foreground"
              >
                <ShieldCheck className="mr-2 size-4" /> Activity Log
              </TabsTrigger>
              <TabsTrigger
                value="security"
                className="rounded-t-lg border-b-2 border-transparent px-4 py-3 text-sm font-medium data-[state=active]:border-primary data-[state=active]:bg-card data-[state=active]:text-foreground"
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
                      <Input
                        type="password"
                        placeholder="Paste service_role key (sb_secret_... or eyJhbGci...)"
                        value={serviceKeyInput}
                        onChange={(e) => setServiceKeyInput(e.target.value)}
                        className="text-xs h-9 font-mono max-w-md bg-background"
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
              <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden flex flex-col h-[750px]">
                <div className="border-b border-border p-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Customers Directory</h3>
                  <NewCustomerDialog />
                </div>

                <div className="p-3 border-b border-border space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Search name, email, phone..."
                      className="pl-9 h-9 text-xs"
                    />
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {(["all", "active", "suspended", "admin", "unconfirmed"] as const).map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setStatusFilter(filter)}
                        className={`text-[11px] px-2.5 py-1 rounded-md transition-colors capitalize ${
                          statusFilter === filter
                            ? "bg-primary text-primary-foreground font-medium"
                            : "bg-muted/50 text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                </div>

                <ul className="flex-1 overflow-y-auto divide-y divide-border">
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
                        <button
                          onClick={() => setSelectedId(c.id)}
                          className={`w-full p-4 text-left transition-colors hover:bg-accent/60 ${
                            isSelected ? "bg-accent border-l-4 border-primary" : ""
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <Avatar className="size-9 border border-border shrink-0">
                                {c.avatar_url ? (
                                  <AvatarImage src={c.avatar_url} alt={fullName || c.email} className="object-cover" />
                                ) : null}
                                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                                  {(fullName ? fullName.slice(0, 2) : c.email.slice(0, 2)).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-sm text-foreground truncate">
                                  {fullName || c.email}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">{c.email}</p>
                                {c.profile?.phone && (
                                  <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                    <Phone className="size-2.5 shrink-0 text-muted-foreground" /> {c.profile.phone}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs font-bold text-foreground">{money(totalBal)}</p>
                              <p className="text-[10px] text-muted-foreground">{c.accounts.length} accts</p>
                            </div>
                          </div>

                          {/* Individual Account Chips */}
                          <div className="mt-2 flex flex-wrap gap-1">
                            {c.accounts.map((a) => (
                              <span
                                key={a.id}
                                className="bg-background/80 border border-border/70 px-1.5 py-0.5 rounded text-[10px] font-mono text-muted-foreground"
                              >
                                {a.account_type}: <strong className="text-foreground">{money(a.available_balance)}</strong>
                              </span>
                            ))}
                          </div>

                          <div className="mt-2 flex items-center gap-1.5">
                            {c.is_admin && <Badge variant="outline" className="text-[10px] py-0">Admin</Badge>}
                            {c.banned ? (
                              <Badge variant="destructive" className="text-[10px] py-0">Suspended</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] py-0 text-emerald-400 border-emerald-500/40">Active</Badge>
                            )}
                            {!c.confirmed && <Badge variant="secondary" className="text-[10px] py-0">Unconfirmed</Badge>}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                  {customers.data && filtered.length === 0 && (
                    <li className="p-8 text-center text-sm text-muted-foreground">No matching customers found.</li>
                  )}
                </ul>
              </div>

              {/* Customer Detail View */}
              <div className="h-[750px] overflow-y-auto">
                {selected ? (
                  <CustomerDetail key={selected.id} c={selected} onDeleted={() => setSelectedId(null)} />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
                    <Users className="size-12 stroke-[1.5] text-muted-foreground/60" />
                    <h3 className="mt-4 text-lg font-semibold text-foreground">Select a Customer</h3>
                    <p className="mt-1 text-sm max-w-sm">
                      Choose an account from the directory to inspect balances, adjust limits, monitor activity, or launch an authorized support session.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* TAB: HOMEPAGE INQUIRIES */}
          <TabsContent value="inquiries" className="mt-6">
            <HomepageInquiries auditLogs={audit.data ?? []} />
          </TabsContent>

          {/* TAB 2: TRANSACTION MONITORING */}
          <TabsContent value="transactions" className="mt-6">
            <TransactionLedger emailOf={(id) => emailOf(id)} />
          </TabsContent>

          {/* TAB 3: REPORTS & ANALYTICS */}
          <TabsContent value="reports" className="mt-6">
            <AdminReports
              customers={customers.data ?? []}
              auditLogs={audit.data ?? []}
              emailOf={(id) => emailOf(id)}
            />
          </TabsContent>

          {/* TAB 4: PERMISSIONS MATRIX */}
          <TabsContent value="permissions" className="mt-6">
            <div className="rounded-xl border border-border bg-card p-6 space-y-6">
              <div>
                <h2 className="text-xl font-bold tracking-tight">Staff Roles & Permissions Matrix</h2>
                <p className="text-xs text-muted-foreground">
                  Role-based security controls governing staff access across accounts, transfers, and customer details.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border text-xs text-muted-foreground">
                    <tr>
                      <th className="py-3 px-4">Role Title</th>
                      <th className="py-3 px-4">View Balances</th>
                      <th className="py-3 px-4">Post Transactions</th>
                      <th className="py-3 px-4">Reverse Entries</th>
                      <th className="py-3 px-4">Log in as User</th>
                      <th className="py-3 px-4">Delete Accounts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr>
                      <td className="py-3.5 px-4 font-semibold text-foreground flex items-center gap-2">
                        <ShieldCheck className="size-4 text-primary" /> Super Admin
                      </td>
                      <td className="py-3.5 px-4 text-emerald-400 font-medium">Full Access</td>
                      <td className="py-3.5 px-4 text-emerald-400 font-medium">Full Access</td>
                      <td className="py-3.5 px-4 text-emerald-400 font-medium">Full Access</td>
                      <td className="py-3.5 px-4 text-emerald-400 font-medium">Authorized Audit</td>
                      <td className="py-3.5 px-4 text-emerald-400 font-medium">Full Control</td>
                    </tr>
                    <tr>
                      <td className="py-3.5 px-4 font-semibold text-foreground flex items-center gap-2">
                        <Users className="size-4 text-blue-400" /> Support Specialist
                      </td>
                      <td className="py-3.5 px-4 text-emerald-400 font-medium">Full Access</td>
                      <td className="py-3.5 px-4 text-muted-foreground">Review Only</td>
                      <td className="py-3.5 px-4 text-muted-foreground">Approval Needed</td>
                      <td className="py-3.5 px-4 text-emerald-400 font-medium">Authorized Audit</td>
                      <td className="py-3.5 px-4 text-destructive font-medium">Denied</td>
                    </tr>
                    <tr>
                      <td className="py-3.5 px-4 font-semibold text-foreground flex items-center gap-2">
                        <Lock className="size-4 text-amber-400" /> Compliance Auditor
                      </td>
                      <td className="py-3.5 px-4 text-emerald-400 font-medium">Read Only</td>
                      <td className="py-3.5 px-4 text-destructive font-medium">Denied</td>
                      <td className="py-3.5 px-4 text-destructive font-medium">Denied</td>
                      <td className="py-3.5 px-4 text-destructive font-medium">Denied</td>
                      <td className="py-3.5 px-4 text-destructive font-medium">Denied</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* TAB 5: AUDIT LOG */}
          <TabsContent value="audit" className="mt-6">
            <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold">Audit Activity Log</h3>
                  <p className="text-xs text-muted-foreground">Immutable trail of every administrative transaction and support login.</p>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-muted-foreground text-xs">
                  <tr>
                    <th className="p-3.5">Timestamp</th>
                    <th className="p-3.5">Admin</th>
                    <th className="p-3.5">Action</th>
                    <th className="p-3.5">Customer</th>
                    <th className="p-3.5">Details / Support Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(audit.data ?? []).map((r) => {
                    let admin = "—";
                    let reason = "";
                    try {
                      const d = JSON.parse(r.details);
                      admin = d.by ?? "admin";
                      reason = d.reason ?? "";
                    } catch {}
                    return (
                      <tr key={r.id} className="hover:bg-muted/30">
                        <td className="p-3.5 whitespace-nowrap text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleString()}
                        </td>
                        <td className="p-3.5 font-medium">{admin}</td>
                        <td className="p-3.5">
                          <Badge variant="outline" className="text-xs capitalize">
                            {r.action.replace(/_/g, " ")}
                          </Badge>
                        </td>
                        <td className="p-3.5 text-xs">{r.target_user_id ? emailOf(r.target_user_id) : "—"}</td>
                        <td className="max-w-md p-3.5 text-xs text-muted-foreground">
                          {reason ? (
                            <span className="font-semibold text-foreground">Reason: {reason}</span>
                          ) : r.details === "{}" ? (
                            "—"
                          ) : (
                            r.details
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {audit.data?.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-sm text-muted-foreground">
                        No activity recorded yet.
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
              <div className="rounded-xl border border-border bg-card p-6 space-y-4">
                <h3 className="text-base font-semibold">Admin Credentials & Environment</h3>
                <p className="text-xs text-muted-foreground">
                  Your staff credentials are authenticated securely via server functions.
                </p>

                <div className="rounded-lg bg-background p-4 border border-border space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Active Username:</span>
                    <strong className="text-foreground font-mono">{adminName}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Session Expiration:</span>
                    <strong className="text-foreground">8 Hours (Strict HttpOnly Cookie)</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Authentication Method:</span>
                    <strong className="text-foreground">HMAC-SHA256 Tokenization</strong>
                  </div>
                </div>

                <div className="pt-2">
                  <p className="text-xs font-semibold text-foreground mb-1">To change Admin Credentials:</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Set <code className="bg-muted px-1.5 py-0.5 rounded text-primary">ADMIN_USERNAME</code> and{" "}
                    <code className="bg-muted px-1.5 py-0.5 rounded text-primary">ADMIN_PASSWORD</code> in your Netlify
                    dashboard under <strong>Project configuration &gt; Environment variables</strong>.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-6 space-y-4">
                <h3 className="text-base font-semibold">Compliance & Audit Mandates</h3>
                <p className="text-xs text-muted-foreground">
                  Standard Operating Procedures (SOP) for customer support impersonation.
                </p>

                <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
                  <div className="flex gap-2">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Every "Log in as user" action requires an approved support ticket or reason.</span>
                  </div>
                  <div className="flex gap-2">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>All account modifications and balance overrides are permanently written to the ledger.</span>
                  </div>
                  <div className="flex gap-2">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Customer security answers remain encrypted with one-way hashes and cannot be read by staff.</span>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
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
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [viewOpen, setViewOpen] = useState(false);
  const [impersonateOpen, setImpersonateOpen] = useState(false);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);

  const fullName = c.profile ? `${c.profile.first_name} ${c.profile.last_name}`.trim() : "";
  const initials = (fullName ? fullName.slice(0, 2) : c.email.slice(0, 2)).toUpperCase();

  const openView = () => {
    setViewOpen(true);
    logView({ data: { userId: c.id } }).catch(() => {});
  };

  return (
    <div className="space-y-6">
      {/* Customer Header Box */}
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
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
                <h2 className="text-2xl font-bold tracking-tight">
                  {fullName || c.email}
                </h2>
                {c.is_admin && <Badge>Admin</Badge>}
                {c.banned ? (
                  <Badge variant="destructive">Suspended</Badge>
                ) : (
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-400">Active</Badge>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {c.email} · ID: <span className="font-mono">{c.id.slice(0, 8)}</span> · Joined{" "}
                {new Date(c.created_at).toLocaleDateString()} · {c.confirmed ? "Email verified" : "Unverified"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setContactModalOpen(true)} className="text-xs">
              <FileText className="mr-1.5 size-3.5" /> Edit Contact Info
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAvatarModalOpen(true)} className="text-xs">
              <Camera className="mr-1.5 size-3.5" /> Photo
            </Button>
            <Button onClick={() => setImpersonateOpen(true)} disabled={c.banned} className="text-xs">
              <LogIn className="mr-1.5 size-3.5" /> Log in as user
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              disabled={signOutM.isPending}
              onClick={() => {
                if (window.confirm(`Sign ${c.email} out of every device?`)) signOutM.mutate({ userId: c.id });
              }}
            >
              <LogOut className="mr-1.5 size-3.5" /> {signOutM.isPending ? "Signing out..." : "Sign out customer"}
            </Button>
            <Button variant="outline" size="sm" onClick={openView} className="text-xs">
              <Eye className="mr-1.5 size-3.5" /> View Profile
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={suspendM.isPending}
              onClick={() => suspendM.mutate({ userId: c.id, suspended: !c.banned })}
              className="text-xs"
            >
              {c.banned ? <><UserCheck className="mr-1.5 size-3.5" /> Reactivate</> : <><UserX className="mr-1.5 size-3.5" /> Suspend</>}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={adminM.isPending}
              onClick={() => adminM.mutate({ userId: c.id, isAdmin: !c.is_admin })}
              className="text-xs"
            >
              <ShieldCheck className="mr-1.5 size-3.5" /> {c.is_admin ? "Remove Admin" : "Make Admin"}
            </Button>
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
        <TabsList className="bg-card border border-border flex-wrap h-auto p-1">
          <TabsTrigger value="overview">
            <User className="mr-1.5 size-3.5" /> Full Dossier
          </TabsTrigger>
          <TabsTrigger value="accounts">
            <Wallet className="mr-1.5 size-3.5" /> Accounts &amp; Balances ({c.accounts.length})
          </TabsTrigger>
          <TabsTrigger value="transactions">
            <History className="mr-1.5 size-3.5" /> Transaction Ledger
          </TabsTrigger>
          <TabsTrigger value="profile">
            <FileText className="mr-1.5 size-3.5" /> Contact Information
          </TabsTrigger>
          <TabsTrigger value="security">
            <Lock className="mr-1.5 size-3.5" /> Security &amp; Login
          </TabsTrigger>
          <TabsTrigger value="danger" className="text-destructive">
            <AlertTriangle className="mr-1.5 size-3.5" /> Danger Zone
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: FULL DOSSIER & COMPREHENSIVE OVERVIEW */}
        <TabsContent value="overview" className="mt-4 space-y-6">
          {/* Quick Metrics Strip */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total Liquid Deposits</span>
              <p className="mt-1 text-2xl font-bold font-display text-primary">
                {money(c.accounts.filter(a => a.account_type === 'checking').reduce((s, a) => s + (a.available_balance || 0), 0))}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Checking available</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Active Credit Line</span>
              <p className="mt-1 text-2xl font-bold font-display text-amber-400">
                {money(c.accounts.filter(a => a.account_type === 'credit').reduce((s, a) => s + (a.current_balance || 0), 0))}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Card balance outstanding</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total Accounts Linked</span>
              <p className="mt-1 text-2xl font-bold font-display text-foreground">{c.accounts.length}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Active banking services</p>
            </div>
          </div>

          {/* Personal Identification & Contact Card */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <User className="size-4 text-primary" /> Customer Identity &amp; Contact Details
              </h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setContactModalOpen(true)}
                  className="text-xs h-7"
                >
                  <Edit3 className="mr-1 size-3" /> Edit Contact Info
                </Button>
                <Badge variant="outline" className="text-xs font-mono">
                  {c.is_admin ? "Administrator" : "Standard Client"}
                </Badge>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 text-xs">
              <div className="flex items-center gap-3">
                <Avatar className="size-11 border border-border shrink-0">
                  {c.avatar_url ? (
                    <AvatarImage src={c.avatar_url} alt={fullName || c.email} className="object-cover" />
                  ) : null}
                  <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-muted-foreground">Full Legal Name</p>
                  <p className="mt-0.5 font-semibold text-sm text-foreground">
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
                <p className="text-muted-foreground">Registration Timestamp</p>
                <p className="mt-1 font-mono text-[11px] text-foreground flex items-center gap-1">
                  <Calendar className="size-3 text-muted-foreground" />
                  {new Date(c.created_at).toLocaleString()}
                </p>
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
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Wallet className="size-4 text-primary" /> Active Banking &amp; Card Accounts
              </h3>
              <span className="text-xs text-muted-foreground">Routing Number: <strong className="text-foreground font-mono">021000089</strong></span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {c.accounts.map((a) => (
                <div key={a.id} className="rounded-lg border border-border/80 bg-background/50 p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {a.account_type} Account
                      </span>
                      <h4 className="font-semibold text-sm text-foreground">{a.name}</h4>
                    </div>
                    <Badge variant="outline" className="font-mono text-xs">
                      •••• {a.last_four}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/40 text-xs">
                    <div>
                      <p className="text-muted-foreground text-[11px]">Available Balance</p>
                      <p className="font-bold text-sm text-primary font-display">{money(a.available_balance)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-[11px]">Current Balance</p>
                      <p className="font-bold text-sm text-foreground font-display">{money(a.current_balance)}</p>
                    </div>
                    {a.credit_limit !== null && (
                      <div>
                        <p className="text-muted-foreground text-[11px]">Credit Limit</p>
                        <p className="font-medium text-xs text-foreground font-mono">{money(a.credit_limit)}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-muted-foreground text-[11px]">Overdraft Permitted</p>
                      <p className="font-medium text-xs text-foreground">{a.allow_overdraft ? "Yes" : "No"}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Security & Verification Credentials */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2 border-b border-border pb-3">
              <Shield className="size-4 text-primary" /> Security &amp; Compliance Details
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 text-xs">
              <div className="rounded-lg border border-border p-3 bg-background/50">
                <p className="font-semibold text-foreground text-[11px]">Security Question 1</p>
                <p className="mt-1 text-muted-foreground">{c.profile?.security_question_one || "What was the name of your first pet?"}</p>
                <p className="mt-2 text-[10px] text-emerald-400 font-mono">✓ Cryptographic SHA-256 Hash Configured</p>
              </div>
              <div className="rounded-lg border border-border p-3 bg-background/50">
                <p className="font-semibold text-foreground text-[11px]">Security Question 2</p>
                <p className="mt-1 text-muted-foreground">{c.profile?.security_question_two || "In what city were you born?"}</p>
                <p className="mt-2 text-[10px] text-emerald-400 font-mono">✓ Cryptographic SHA-256 Hash Configured</p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: ACCOUNTS */}
        <TabsContent value="accounts" className="mt-4 space-y-4">
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="text-base font-semibold mb-4">Customer Accounts</h3>
            <div className="space-y-4">
              {c.accounts.length === 0 && <p className="text-sm text-muted-foreground">No accounts configured.</p>}
              {c.accounts.map((a) => (
                <AccountEditor key={a.id} a={a} />
              ))}
            </div>
            <AddAccount userId={c.id} existing={c.accounts.map((a) => a.account_type)} />
          </div>
        </TabsContent>

        {/* TAB 3: TRANSACTIONS LEDGER */}
        <TabsContent value="transactions" className="mt-4 space-y-4">
          <TransactionLedger userId={c.id} />
        </TabsContent>

        {/* TAB 2: PROFILE */}
        <TabsContent value="profile" className="mt-4">
          {!c.profile && <CreateProfile userId={c.id} />}
          {c.profile && (
            <section className="rounded-xl border border-border bg-card p-6 space-y-5">
              <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
                <div>
                  <h3 className="text-base font-semibold flex items-center gap-2">
                    <FileText className="size-4 text-primary" /> Personal Identity &amp; Contact Details
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    View and edit the customer's legal name, primary email address, phone number, and residential address.
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-destructive text-xs">
                      <Trash2 className="mr-1 size-3.5" /> Clear Profile
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reset customer profile?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Removes name, phone, and residential address. Login credentials and accounts remain intact.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => delProfileM.mutate({ userId: c.id })}>
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
                  <Label htmlFor="prof-first-name" className="text-xs font-semibold">
                    Legal First Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="prof-first-name"
                    className="mt-1"
                    value={p.first_name}
                    onChange={(e) => setP({ ...p, first_name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="prof-last-name" className="text-xs font-semibold">
                    Legal Last Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="prof-last-name"
                    className="mt-1"
                    value={p.last_name}
                    onChange={(e) => setP({ ...p, last_name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="prof-email" className="text-xs font-semibold">
                    Primary Email Address <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="prof-email"
                    type="email"
                    className="mt-1"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">Used for customer sign-in and security notifications.</p>
                </div>

                <div>
                  <Label htmlFor="prof-phone" className="text-xs font-semibold">
                    Direct Telephone / Phone Number <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="prof-phone"
                    className="mt-1"
                    value={p.phone}
                    onChange={(e) => setP({ ...p, phone: e.target.value })}
                    placeholder="+1 (555) 000-0000"
                    required
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">Direct telephone on file for customer contact and security.</p>
                </div>

                <div className="sm:col-span-2">
                  <Label htmlFor="prof-address" className="text-xs font-semibold">
                    Primary Residential Street Address <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="prof-address"
                    className="mt-1"
                    value={p.address}
                    onChange={(e) => setP({ ...p, address: e.target.value })}
                    placeholder="123 Financial Way, Suite 400"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="prof-city" className="text-xs font-semibold">
                    City <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="prof-city"
                    className="mt-1"
                    value={p.city}
                    onChange={(e) => setP({ ...p, city: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="prof-postal" className="text-xs font-semibold">
                    Postal / ZIP Code <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="prof-postal"
                    className="mt-1"
                    value={p.postal_code}
                    onChange={(e) => setP({ ...p, postal_code: e.target.value })}
                    required
                  />
                </div>

                <div className="sm:col-span-2 pt-2 border-t border-border flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">All changes are recorded in the immutable administrative security audit log.</p>
                  <Button type="submit" size="sm" disabled={contactInfoM.isPending}>
                    {contactInfoM.isPending ? "Saving..." : "Save Contact Information"}
                  </Button>
                </div>
              </form>
            </section>
          )}
        </TabsContent>

        {/* TAB 3: SECURITY */}
        <TabsContent value="security" className="mt-4 space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            <form
              className="rounded-xl border border-border bg-card p-6"
              onSubmit={(e) => {
                e.preventDefault();
                emailM.mutate({ userId: c.id, email });
              }}
            >
              <h3 className="text-base font-semibold">Primary Login Email</h3>
              <Input type="email" className="mt-4" value={email} onChange={(e) => setEmail(e.target.value)} />
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="submit" size="sm" disabled={emailM.isPending || email === c.email}>
                  Update Email
                </Button>
                {!c.confirmed && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={confirmM.isPending}
                    onClick={() => confirmM.mutate({ userId: c.id })}
                  >
                    <MailCheck className="mr-1.5 size-3.5" /> Mark Confirmed
                  </Button>
                )}
              </div>
            </form>

            <form
              className="rounded-xl border border-border bg-card p-6"
              onSubmit={(e) => {
                e.preventDefault();
                passM.mutate({ userId: c.id, password }, { onSuccess: () => setPassword("") });
              }}
            >
              <h3 className="text-base font-semibold">Reset Password</h3>
              <Input
                type="password"
                className="mt-4"
                placeholder="New password (min 10 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button type="submit" size="sm" className="mt-4" disabled={passM.isPending || password.length < 10}>
                Set Password
              </Button>
            </form>
          </div>

          {c.profile && (
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="text-base font-semibold mb-2">Security Questions</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Current: {c.profile.security_question_one} &amp; {c.profile.security_question_two}. Answers are stored with cryptographic hashes.
              </p>
              <ResetSecurity userId={c.id} />
            </div>
          )}
        </TabsContent>

        {/* TAB 4: DANGER ZONE */}
        <TabsContent value="danger" className="mt-4">
          <section className="rounded-xl border border-destructive/40 bg-card p-6">
            <h3 className="text-base font-semibold text-destructive flex items-center gap-2">
              <AlertTriangle className="size-5" /> Danger Zone
            </h3>
            <p className="mt-2 text-xs text-muted-foreground">
              Permanently delete this customer's account, profile, and login credentials. This cannot be undone.
            </p>
            <AlertDialog onOpenChange={() => setConfirmText("")}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="mt-4">
                  <Trash2 className="mr-1.5 size-3.5" /> Delete Customer Permanently
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete customer {c.email}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Type <strong>DELETE</strong> to confirm permanent erasure.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" />
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={confirmText !== "DELETE" || deleteM.isPending}
                    onClick={() => deleteM.mutate({ userId: c.id })}
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
            user={{ id: c.id, email: c.email }}
            initialProfile={c.profile}
            accounts={c.accounts.map((a) => ({
              ...a,
              available_balance: Number(a.available_balance),
              current_balance: Number(a.current_balance),
              credit_limit: a.credit_limit === null ? null : Number(a.credit_limit),
            }))}
            isAdminView={true}
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="size-5 text-primary" /> Authorized Customer Support Access
          </DialogTitle>
          <DialogDescription>
            You are initiating a direct support session for{" "}
            <strong>{customer.profile ? `${customer.profile.first_name} ${customer.profile.last_name}` : customer.email}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="support-reason" className="text-xs font-semibold">
              Support Reason or Ticket Reference <span className="text-destructive">*</span>
            </Label>
            <Input
              id="support-reason"
              placeholder="e.g. Ticket #9201 - Verify pending deposit"
              className="mt-1"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <label className="flex items-start gap-2.5 rounded-lg border border-border p-3 cursor-pointer bg-muted/30">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1"
            />
            <span className="text-xs text-muted-foreground leading-relaxed">
              I certify that this support session is authorized for official bank operations. This event and my admin username will be permanently recorded in the immutable audit log.
            </span>
          </label>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleLaunch} disabled={busy || !reason.trim() || !agreed}>
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
  const contactInfoFn = useServerFn(updateCustomerContactInfo);
  const [form, setForm] = useState({
    first_name: customer.profile?.first_name ?? "",
    last_name: customer.profile?.last_name ?? "",
    email: customer.email,
    phone: customer.profile?.phone ?? "",
    address: customer.profile?.address ?? "",
    city: customer.profile?.city ?? "",
    postal_code: customer.profile?.postal_code ?? "",
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
    });
  }, [customer]);

  const m = useMutation({
    mutationFn: (data: typeof form) => contactInfoFn({ data: { userId: customer.id, ...data } }),
    onSuccess: () => {
      toast.success("Contact details updated successfully");
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
    m.mutate(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-5 text-primary" /> Edit Personal Contact Information
          </DialogTitle>
          <DialogDescription>
            Update personal identity and direct contact records for{" "}
            <strong>{customer.profile ? `${customer.profile.first_name} ${customer.profile.last_name}` : customer.email}</strong>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ci-first-name" className="text-xs font-semibold">
                Legal First Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="ci-first-name"
                className="mt-1"
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="ci-last-name" className="text-xs font-semibold">
                Legal Last Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="ci-last-name"
                className="mt-1"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ci-email" className="text-xs font-semibold">
                Email Address <span className="text-destructive">*</span>
              </Label>
              <Input
                id="ci-email"
                type="email"
                className="mt-1"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="ci-phone" className="text-xs font-semibold">
                Telephone / Mobile <span className="text-destructive">*</span>
              </Label>
              <Input
                id="ci-phone"
                className="mt-1"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+1 (555) 000-0000"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="ci-address" className="text-xs font-semibold">
              Primary Residential Address <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ci-address"
              className="mt-1"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="123 Financial Way, Suite 400"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ci-city" className="text-xs font-semibold">
                City <span className="text-destructive">*</span>
              </Label>
              <Input
                id="ci-city"
                className="mt-1"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="ci-postal" className="text-xs font-semibold">
                Postal / ZIP Code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="ci-postal"
                className="mt-1"
                value={form.postal_code}
                onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
                required
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={m.isPending}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={m.isPending}>
              {m.isPending ? "Saving..." : "Save Contact Information"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AccountEditor({ a }: { a: Customer["accounts"][number] }) {
  const m = useAdminAction(useServerFn(updateAccountBalance), "Account settings saved");
  const renameM = useAdminAction(useServerFn(renameCustomerAccount), "Account details updated");
  const removeM = useAdminAction(useServerFn(removeCustomerAccount), "Account removed");
  const [limit, setLimit] = useState(a.credit_limit === null ? "" : String(a.credit_limit));
  const [overdraft, setOverdraft] = useState(a.allow_overdraft);
  const [name, setName] = useState(a.name);
  const [four, setFour] = useState(a.last_four);

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
    <div className="rounded-xl border border-border bg-card/60 p-4 space-y-4">
      <form onSubmit={submit} className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-3">
          <div>
            <p className="text-xs text-muted-foreground capitalize">{a.account_type} Account</p>
            <p className="text-base font-semibold text-foreground">{a.name} (•••• {a.last_four})</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Available Balance</p>
            <p className="text-xl font-bold text-primary font-display">
              {a.available_balance.toLocaleString("en-US", { style: "currency", currency: a.currency })}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_120px_auto] sm:items-end">
          <div>
            <Label className="text-xs">Account Label</Label>
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Last 4 Digits</Label>
            <Input className="mt-1 font-mono" maxLength={4} value={four} onChange={(e) => setFour(e.target.value)} />
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="text-destructive text-xs">
                <Trash2 className="mr-1 size-3.5" /> Remove
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove {a.name}?</AlertDialogTitle>
                <AlertDialogDescription>This account will be erased. Its transaction ledger remains intact.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => removeM.mutate({ accountId: a.id })}>
                  Confirm Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <div className="grid items-center gap-3 sm:grid-cols-[1fr_1fr_auto] border-t border-border/40 pt-3">
          <div>
            {a.account_type === "credit" && (
              <>
                <Label className="text-xs">Credit Limit</Label>
                <Input className="mt-1" inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} />
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={overdraft} onCheckedChange={setOverdraft} id={`od-${a.id}`} />
            <Label htmlFor={`od-${a.id}`} className="text-xs cursor-pointer">Allow Overdraft</Label>
          </div>
          <Button type="submit" size="sm" disabled={m.isPending || renameM.isPending}>
            Save Settings
          </Button>
        </div>
      </form>

      <TransactionForm a={a} />
    </div>
  );
}

const TYPE_DEFAULT_NAMES: Record<string, string> = {
  checking: "Everyday Checking",
  credit: "Gold Rewards Card",
};

function AddAccount({ userId, existing }: { userId: string; existing: string[] }) {
  const missing = Object.keys(TYPE_DEFAULT_NAMES).filter((t) => !existing.includes(t));
  const m = useAdminAction(useServerFn(addCustomerAccount), "Account added");
  const [type, setType] = useState(missing[0] ?? "");
  const [bal, setBal] = useState("0");
  const [limit, setLimit] = useState("5000");

  if (missing.length === 0) return null;
  const t = missing.includes(type) ? type : missing[0]!;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const b = Number(bal.replace(/,/g, ""));
    const l = Number(limit.replace(/,/g, ""));
    if (!Number.isFinite(b) || (t === "credit" && !Number.isFinite(l))) {
      toast.error("Enter valid numbers");
      return;
    }
    m.mutate({
      userId,
      account_type: t as "checking",
      name: TYPE_DEFAULT_NAMES[t]!,
      available_balance: t === "credit" ? l - b : b,
      current_balance: b,
      credit_limit: t === "credit" ? l : null,
    });
  };

  return (
    <form onSubmit={submit} className="mt-4 grid items-end gap-3 rounded-xl border border-dashed border-border p-4 sm:grid-cols-[1fr_1fr_1fr_auto]">
      <div>
        <Label className="text-xs">Add Account Type</Label>
        <select
          value={t}
          onChange={(e) => setType(e.target.value)}
          className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-xs capitalize"
        >
          {missing.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label className="text-xs">{t === "credit" ? "Amount Owed" : "Opening Balance"}</Label>
        <Input className="mt-1 h-9 text-xs" inputMode="decimal" value={bal} onChange={(e) => setBal(e.target.value)} />
      </div>
      <div>
        {t === "credit" && (
          <>
            <Label className="text-xs">Credit Limit</Label>
            <Input className="mt-1 h-9 text-xs" inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} />
          </>
        )}
      </div>
      <Button type="submit" size="sm" className="text-xs" disabled={m.isPending}>
        <Plus className="mr-1 size-3.5" /> Add
      </Button>
    </form>
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
        <div key={q} className="space-y-2">
          <Label className="text-xs">Question {i + 1}</Label>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
            value={v[q]}
            onChange={(e) => set({ ...v, [q]: e.target.value })}
          >
            {QUESTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <Input
            placeholder="Answer"
            className="text-xs"
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
    <form onSubmit={submit} className="rounded-xl border border-dashed border-border bg-card p-6 space-y-4">
      <h3 className="text-base font-semibold">Create Initial Customer Profile</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {(Object.keys(p) as (keyof typeof p)[]).map((k) => (
          <div key={k} className={k === "address" ? "sm:col-span-2" : ""}>
            <Label className="capitalize text-xs">{k.replace("_", " ")}</Label>
            <Input className="mt-1 text-xs" value={p[k]} onChange={(e) => setP({ ...p, [k]: e.target.value })} />
          </div>
        ))}
        <SecurityFields v={s} set={setS} />
      </div>
      <Button type="submit" size="sm" disabled={m.isPending}>
        Create Profile
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
      <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => setOpen(!open)}>
        <KeyRound className="mr-1.5 size-3.5" /> Reset Security Questions
      </Button>
      {open && (
        <form onSubmit={submit} className="mt-4 space-y-3 rounded-lg border border-border p-4 bg-muted/20">
          <SecurityFields v={s} set={setS} />
          <Button type="submit" size="sm" disabled={m.isPending}>
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
      <Button size="sm" onClick={() => setOpen(true)} className="text-xs">
        <UserPlus className="mr-1.5 size-3.5" /> Add Customer
      </Button>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Bank Customer</DialogTitle>
          <DialogDescription className="text-xs">
            Creates an authenticated login and automatically provisions Everyday Checking and Gold Rewards Card accounts.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 py-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Email *</Label>
              <Input
                type="email"
                placeholder="customer@domain.com"
                className="mt-1 text-xs"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Password *</Label>
                <button
                  type="button"
                  onClick={generatePassword}
                  className="text-[10px] text-primary hover:underline"
                >
                  Generate Strong
                </button>
              </div>
              <Input
                type="text"
                className="mt-1 text-xs font-mono"
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
                <Label className="capitalize text-xs">{k.replace("_", " ")} *</Label>
                <Input className="mt-1 text-xs" required value={p[k]} onChange={(e) => setP({ ...p, [k]: e.target.value })} />
              </div>
            ))}
          </div>
          <SecurityFields v={s} set={setS} />
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={createM.isPending || password.length < 10}>
              {createM.isPending ? "Creating Account…" : "Create Customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function HomepageInquiries({ auditLogs }: { auditLogs: { id: string; action: string; details: string; created_at: string }[] }) {
  const inquiries = useMemo(() => {
    return auditLogs
      .filter((r) => r.action === "homepage_inquiry")
      .map((r) => {
        let parsed: { name?: string; email?: string; phone?: string; department?: string; message?: string } = {};
        try {
          parsed = JSON.parse(r.details);
        } catch {}
        return {
          id: r.id,
          created_at: r.created_at,
          ...parsed,
        };
      });
  }, [auditLogs]);

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Homepage Client Inquiries</h2>
          <p className="text-xs text-muted-foreground">
            Inquiries and leads submitted directly through the Eastern Trust Bank website contact portal.
          </p>
        </div>
        <Badge variant="outline" className="text-xs">{inquiries.length} received</Badge>
      </div>

      {inquiries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
          <Mail className="mx-auto size-10 text-muted-foreground/60" />
          <h3 className="mt-3 text-base font-semibold text-foreground">No Homepage Inquiries Yet</h3>
          <p className="mt-1 text-xs">Direct messages submitted from the public homepage will appear here instantly.</p>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
          {inquiries.map((inq) => (
            <div key={inq.id} className="p-5 hover:bg-accent/40 transition-colors space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-foreground">{inq.name || "Anonymous Visitor"}</span>
                  {inq.department && (
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {inq.department}
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(inq.created_at).toLocaleString()}
                </span>
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground font-mono">
                {inq.email && <span>Email: <a href={`mailto:${inq.email}`} className="text-primary hover:underline">{inq.email}</a></span>}
                {inq.phone && <span>Phone: <a href={`tel:${inq.phone}`} className="text-foreground hover:underline">{inq.phone}</a></span>}
              </div>
              <p className="text-xs text-foreground/90 bg-muted/30 p-3 rounded-md border border-border/50 whitespace-pre-wrap">
                {inq.message || "—"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

