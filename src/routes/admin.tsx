import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Eye, LogIn, LogOut, MailCheck, Plus, Search, ShieldAlert, ShieldCheck, Trash2, UserPlus, UserX, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  getAdminSession, adminLogin, adminLogout, listCustomers, listAuditLog, updateCustomerProfile, updateCustomerEmail, setCustomerPassword,
  updateAccountBalance, setCustomerSuspended, setCustomerAdmin, deleteCustomer, logViewAsCustomer,
  createCustomer, createProfileForCustomer, deleteCustomerProfile, resetSecurityQuestions, confirmCustomerEmail,
  addCustomerAccount, renameCustomerAccount, removeCustomerAccount, signInAsCustomer,
} from "@/lib/admin.functions";
import { TransactionForm, TransactionLedger } from "@/components/admin-transactions";
import { UserProfile } from "@/components/user-profile";

export const Route = createFileRoute("/admin")({
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
    e.preventDefault(); setBusy(true); setError(null);
    try {
      const r = await loginFn({ data: { username, password } });
      if (!r.ok) setError(r.error); else await qc.invalidateQueries({ queryKey: ["admin-session"] });
    } catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  };
  return (
    <main className="mx-auto max-w-md px-5 py-20">
      <ShieldCheck className="size-10 text-primary" />
      <p className="mt-5 text-xs font-semibold uppercase tracking-widest text-primary">Staff only</p>
      <h1 className="mt-2 text-4xl">Admin sign in</h1>
      <p className="mt-2 text-sm text-muted-foreground">This portal has its own login, separate from customer accounts.</p>
      <form onSubmit={submit} className="mt-8 space-y-4 border border-border bg-card p-6">
        <div><Label htmlFor="au">Username</Label><Input id="au" className="mt-1" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} /></div>
        <div><Label htmlFor="ap">Password</Label><Input id="ap" type="password" className="mt-1" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy || !username || !password}>{busy ? "Signing in…" : "Sign in"}</Button>
      </form>
    </main>
  );
}

function AdminPortal({ adminName }: { adminName: string }) {
  const logoutFn = useServerFn(adminLogout);
  const qcRoot = useQueryClient();
  const signOut = async () => { await logoutFn(); qcRoot.removeQueries({ queryKey: ["admin-customers"] }); qcRoot.removeQueries({ queryKey: ["admin-audit"] }); await qcRoot.invalidateQueries({ queryKey: ["admin-session"] }); };
  const listFn = useServerFn(listCustomers);
  const auditFn = useServerFn(listAuditLog);
  const customers = useQuery({ queryKey: ["admin-customers"], queryFn: () => listFn() });
  const audit = useQuery({ queryKey: ["admin-audit"], queryFn: () => auditFn() });
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return (customers.data ?? []).filter((c) =>
      [c.email, c.profile?.first_name, c.profile?.last_name, c.profile?.phone].some((v) => v?.toLowerCase().includes(s)),
    );
  }, [customers.data, q]);
  const selected = customers.data?.find((c) => c.id === selectedId) ?? null;
  const emailOf = (id: string | null) => customers.data?.find((c) => c.id === id)?.email ?? id?.slice(0, 8) ?? "—";

  return (
    <main className="py-12">
      <Toaster />
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Staff</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4"><h1 className="text-4xl md:text-5xl">Admin portal</h1><div className="flex items-center gap-3 text-sm text-muted-foreground">Signed in as {adminName}<Button variant="outline" size="sm" onClick={signOut}><LogOut /> Sign out</Button></div></div>
        <Tabs defaultValue="customers" className="mt-8">
          <TabsList><TabsTrigger value="customers">Customers</TabsTrigger><TabsTrigger value="transactions">Transactions</TabsTrigger><TabsTrigger value="audit">Activity log</TabsTrigger></TabsList>
          <TabsContent value="transactions" className="mt-6"><TransactionLedger emailOf={(id) => emailOf(id)} /></TabsContent>
          <TabsContent value="customers" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
              <div className="border border-border bg-card">
                <div className="border-b border-border p-3"><NewCustomerDialog /></div>
                <div className="relative border-b border-border p-3">
                  <Search className="absolute left-6 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, phone" className="pl-9" />
                </div>
                <ul className="max-h-[70vh] overflow-y-auto">
                  {customers.isLoading && <li className="p-4 text-sm text-muted-foreground">Loading…</li>}
                  {customers.error && <li className="p-4 text-sm text-destructive">{errMsg(customers.error)}</li>}
                  {filtered.map((c) => (
                    <li key={c.id}>
                      <button onClick={() => setSelectedId(c.id)} className={`w-full border-b border-border p-4 text-left transition-colors hover:bg-accent ${selectedId === c.id ? "bg-accent" : ""}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{c.profile ? `${c.profile.first_name} ${c.profile.last_name}` : "No profile yet"}</span>
                          <span className="flex gap-1">{c.is_admin && <Badge>Admin</Badge>}{c.banned && <Badge variant="destructive">Suspended</Badge>}</span>
                        </div>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{c.email}</p>
                      </button>
                    </li>
                  ))}
                  {customers.data && filtered.length === 0 && <li className="p-4 text-sm text-muted-foreground">No customers found.</li>}
                </ul>
              </div>
              <div>{selected ? <CustomerDetail key={selected.id} c={selected} onDeleted={() => setSelectedId(null)} /> : <div className="border border-dashed border-border p-10 text-center text-muted-foreground">Select a customer to manage.</div>}</div>
            </div>
          </TabsContent>
          <TabsContent value="audit" className="mt-6">
            <div className="overflow-x-auto border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-muted-foreground"><tr><th className="p-3">When</th><th className="p-3">Admin</th><th className="p-3">Action</th><th className="p-3">Customer</th><th className="p-3">Details</th></tr></thead>
                <tbody>
                  {(audit.data ?? []).map((r) => (
                    <tr key={r.id} className="border-b border-border">
                      <td className="p-3 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                      <td className="p-3">{(() => { try { return (JSON.parse(r.details) as { by?: string }).by ?? "—"; } catch { return "—"; } })()}</td>
                      <td className="p-3">{r.action.replace(/_/g, " ")}</td>
                      <td className="p-3">{r.target_user_id ? emailOf(r.target_user_id) : "—"}</td>
                      <td className="max-w-xs truncate p-3 text-xs text-muted-foreground">{r.details === "{}" ? "" : r.details}</td>
                    </tr>
                  ))}
                  {audit.data?.length === 0 && <tr><td colSpan={5} className="p-4 text-muted-foreground">No activity yet.</td></tr>}
                </tbody>
              </table>
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
    onSuccess: () => { toast.success(success); qc.invalidateQueries({ queryKey: ["admin-customers"] }); qc.invalidateQueries({ queryKey: ["admin-audit"] }); after?.(); },
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
  const signInFn = useServerFn(signInAsCustomer);
  const [signingIn, setSigningIn] = useState(false);

  const [p, setP] = useState({
    first_name: c.profile?.first_name ?? "", last_name: c.profile?.last_name ?? "", phone: c.profile?.phone ?? "",
    address: c.profile?.address ?? "", city: c.profile?.city ?? "", postal_code: c.profile?.postal_code ?? "",
  });
  const [email, setEmail] = useState(c.email);
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [viewOpen, setViewOpen] = useState(false);

  const openView = () => { setViewOpen(true); logView({ data: { userId: c.id } }).catch(() => {}); };
  const loginAs = async () => {
    const tab = window.open("about:blank", "_blank");
    setSigningIn(true);
    try {
      const { url } = await signInFn({ data: { userId: c.id, origin: window.location.origin } });
      if (tab) tab.location.href = url; else window.location.href = url;
      toast.success("Signed in as customer in a new tab");
    } catch (e) { tab?.close(); toast.error(errMsg(e)); } finally { setSigningIn(false); }
  };

  return (
    <div className="space-y-6">
      <section className="border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-3xl">{c.profile ? `${c.profile.first_name} ${c.profile.last_name}` : c.email}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{c.email} · Joined {new Date(c.created_at).toLocaleDateString()} · {c.confirmed ? "Email confirmed" : "Email not confirmed"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={loginAs} disabled={signingIn || c.banned}><LogIn /> {signingIn ? "Opening…" : "Log in as customer"}</Button>
            <Button variant="outline" onClick={openView}><Eye /> View as customer</Button>
            <Button variant="outline" disabled={suspendM.isPending} onClick={() => suspendM.mutate({ userId: c.id, suspended: !c.banned })}>{c.banned ? <><UserCheck /> Reactivate</> : <><UserX /> Suspend</>}</Button>
            <Button variant="outline" disabled={adminM.isPending} onClick={() => adminM.mutate({ userId: c.id, isAdmin: !c.is_admin })}><ShieldCheck /> {c.is_admin ? "Remove admin" : "Make admin"}</Button>
          </div>
        </div>
      </section>

      {!c.profile && <CreateProfile userId={c.id} />}
      {c.profile && (
        <section className="border border-border bg-card p-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xl">Profile</h3>
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive"><Trash2 /> Delete profile</Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Delete this profile?</AlertDialogTitle><AlertDialogDescription>Removes name, contact details and security questions. The login and accounts stay.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => delProfileM.mutate({ userId: c.id })}>Delete profile</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); profileM.mutate({ userId: c.id, ...p }); }}>
            {(Object.keys(p) as (keyof typeof p)[]).map((k) => (
              <div key={k} className={k === "address" ? "sm:col-span-2" : ""}>
                <Label htmlFor={k} className="capitalize">{k.replace("_", " ")}</Label>
                <Input id={k} className="mt-1" value={p[k]} onChange={(e) => setP({ ...p, [k]: e.target.value })} />
              </div>
            ))}
            <div className="sm:col-span-2"><Button type="submit" disabled={profileM.isPending}>Save profile</Button></div>
          </form>
          <p className="mt-4 text-xs text-muted-foreground">Current questions: {c.profile.security_question_one} / {c.profile.security_question_two}. Answers are stored scrambled and can't be viewed.</p>
          <ResetSecurity userId={c.id} />
        </section>
      )}

      <section className="grid gap-6 md:grid-cols-2">
        <form className="border border-border bg-card p-6" onSubmit={(e) => { e.preventDefault(); emailM.mutate({ userId: c.id, email }); }}>
          <h3 className="text-xl">Login email</h3>
          <Input type="email" className="mt-4" value={email} onChange={(e) => setEmail(e.target.value)} />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="submit" disabled={emailM.isPending || email === c.email}>Update email</Button>
            {!c.confirmed && <Button type="button" variant="outline" disabled={confirmM.isPending} onClick={() => confirmM.mutate({ userId: c.id })}><MailCheck /> Mark confirmed</Button>}
          </div>
        </form>
        <form className="border border-border bg-card p-6" onSubmit={(e) => { e.preventDefault(); passM.mutate({ userId: c.id, password }, { onSuccess: () => setPassword("") }); }}>
          <h3 className="text-xl">Set new password</h3>
          <Input type="password" className="mt-4" placeholder="At least 10 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button type="submit" className="mt-3" disabled={passM.isPending || password.length < 10}>Set password</Button>
        </form>
      </section>

      <section className="border border-border bg-card p-6">
        <h3 className="text-xl">Accounts & balances</h3>
        <div className="mt-4 space-y-4">
          {c.accounts.length === 0 && <p className="text-sm text-muted-foreground">No accounts.</p>}
          {c.accounts.map((a) => <AccountEditor key={a.id} a={a} />)}
        </div>
        <AddAccount userId={c.id} existing={c.accounts.map((a) => a.account_type)} />
      </section>

      <section className="border border-destructive/50 bg-card p-6">
        <h3 className="text-xl text-destructive">Danger zone</h3>
        <p className="mt-2 text-sm text-muted-foreground">Permanently deletes this customer's login, profile and all accounts. This cannot be undone.</p>
        <AlertDialog onOpenChange={() => setConfirmText("")}>
          <AlertDialogTrigger asChild><Button variant="destructive" className="mt-4"><Trash2 /> Delete customer permanently</Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {c.email}?</AlertDialogTitle>
              <AlertDialogDescription>Type DELETE to confirm. All of this customer's data will be erased forever.</AlertDialogDescription>
            </AlertDialogHeader>
            <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" />
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction disabled={confirmText !== "DELETE" || deleteM.isPending} onClick={() => deleteM.mutate({ userId: c.id })}>Delete forever</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>

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
    </div>
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
    if (limit !== "" && !Number.isFinite(Number(limit))) { toast.error("Enter a valid credit limit"); return; }
    m.mutate({ accountId: a.id, credit_limit: a.account_type === "credit" && limit !== "" ? Number(limit) : null, allow_overdraft: overdraft });
    if (name !== a.name || four !== a.last_four) {
      if (!/^\d{4}$/.test(four)) { toast.error("Last four must be 4 digits"); return; }
      renameM.mutate({ accountId: a.id, name, last_four: four });
    }
  };
  return (
    <div className="space-y-3 border border-border p-4">
      <form onSubmit={submit} className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm text-muted-foreground">Available balance</p>
          <p className="text-2xl font-semibold text-primary">{a.available_balance.toLocaleString("en-US", { style: "currency", currency: a.currency })}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_120px_auto] sm:items-end">
          <div><Label className="text-xs">Account name ({a.account_type})</Label><Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label className="text-xs">Last four</Label><Input className="mt-1" maxLength={4} value={four} onChange={(e) => setFour(e.target.value)} /></div>
          <AlertDialog>
            <AlertDialogTrigger asChild><Button type="button" variant="ghost" size="sm" className="text-destructive"><Trash2 /> Remove</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Remove {a.name}?</AlertDialogTitle><AlertDialogDescription>This account will be erased. Its transaction history stays in the ledger.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => removeM.mutate({ accountId: a.id })}>Remove</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <div>{a.account_type === "credit" && <><Label className="text-xs">Credit limit</Label><Input className="mt-1" inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} /></>}</div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={overdraft} onChange={(e) => setOverdraft(e.target.checked)} /> Allow overdraft</label>
          <Button type="submit" size="sm" disabled={m.isPending || renameM.isPending}>Save settings</Button>
        </div>
      </form>
      <TransactionForm a={a} />
    </div>
  );
}

const TYPE_DEFAULT_NAMES: Record<string, string> = { checking: "Everyday Checking", savings: "High-Yield Savings", credit: "Gold Rewards Card", investment: "Wealth Portfolio" };

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
    const b = Number(bal); const l = Number(limit);
    if (!Number.isFinite(b) || (t === "credit" && !Number.isFinite(l))) { toast.error("Enter valid numbers"); return; }
    m.mutate({ userId, account_type: t as "checking", name: TYPE_DEFAULT_NAMES[t]!, available_balance: t === "credit" ? l - b : b, current_balance: b, credit_limit: t === "credit" ? l : null });
  };
  return (
    <form onSubmit={submit} className="mt-4 grid items-end gap-3 border border-dashed border-border p-4 sm:grid-cols-[1fr_1fr_1fr_auto]">
      <div><Label className="text-xs">New account type</Label>
        <select value={t} onChange={(e) => setType(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm capitalize">{missing.map((x) => <option key={x} value={x}>{x}</option>)}</select>
      </div>
      <div><Label className="text-xs">{t === "credit" ? "Amount owed" : "Opening balance"}</Label><Input className="mt-1" inputMode="decimal" value={bal} onChange={(e) => setBal(e.target.value)} /></div>
      <div>{t === "credit" && <><Label className="text-xs">Credit limit</Label><Input className="mt-1" inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} /></>}</div>
      <Button type="submit" size="sm" disabled={m.isPending}><Plus /> Add account</Button>
    </form>
  );
}

const QUESTIONS = ["What was the name of your first pet?", "In what city were you born?", "What was the name of your childhood friend?", "What was your first job?"];
const emptyProfile = { first_name: "", last_name: "", phone: "", address: "", city: "", postal_code: "" };
const emptySec = { security_question_one: QUESTIONS[0]!, answer_one: "", security_question_two: QUESTIONS[1]!, answer_two: "" };

function SecurityFields({ v, set }: { v: typeof emptySec; set: (v: typeof emptySec) => void }) {
  return (
    <>
      {([["security_question_one", "answer_one"], ["security_question_two", "answer_two"]] as const).map(([q, a], i) => (
        <div key={q} className="space-y-2">
          <Label className="text-xs">Security question {i + 1}</Label>
          <select value={v[q]} onChange={(e) => set({ ...v, [q]: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{QUESTIONS.map((x) => <option key={x}>{x}</option>)}</select>
          <Input placeholder="Answer" value={v[a]} onChange={(e) => set({ ...v, [a]: e.target.value })} />
        </div>
      ))}
    </>
  );
}

function ProfileFields({ v, set }: { v: typeof emptyProfile; set: (v: typeof emptyProfile) => void }) {
  return (
    <>
      {(Object.keys(v) as (keyof typeof emptyProfile)[]).map((k) => (
        <div key={k} className={k === "address" ? "sm:col-span-2" : ""}>
          <Label className="text-xs capitalize">{k.replace("_", " ")}</Label>
          <Input className="mt-1" value={v[k]} onChange={(e) => set({ ...v, [k]: e.target.value })} />
        </div>
      ))}
    </>
  );
}

function NewCustomerDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [p, setP] = useState(emptyProfile);
  const [sec, setSec] = useState(emptySec);
  const m = useAdminAction(useServerFn(createCustomer), "Customer created with starter accounts", () => { setOpen(false); setEmail(""); setPassword(""); setP(emptyProfile); setSec(emptySec); });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button className="w-full" onClick={() => setOpen(true)}><UserPlus /> New customer</Button>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Create customer</DialogTitle><DialogDescription>The login is ready to use immediately — no email confirmation needed.</DialogDescription></DialogHeader>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); m.mutate({ email, password, ...p, ...sec }); }}>
          <div><Label className="text-xs">Email</Label><Input type="email" className="mt-1" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><Label className="text-xs">Password</Label><Input type="password" className="mt-1" placeholder="At least 10 characters" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <ProfileFields v={p} set={setP} />
          <SecurityFields v={sec} set={setSec} />
          <div className="sm:col-span-2"><Button type="submit" disabled={m.isPending}>{m.isPending ? "Creating…" : "Create customer"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateProfile({ userId }: { userId: string }) {
  const [p, setP] = useState(emptyProfile);
  const [sec, setSec] = useState(emptySec);
  const m = useAdminAction(useServerFn(createProfileForCustomer), "Profile created");
  return (
    <section className="border border-border bg-card p-6">
      <h3 className="text-xl">Create profile</h3>
      <p className="mt-1 text-sm text-muted-foreground">This customer has no profile yet. Creating one also opens their starter accounts.</p>
      <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); m.mutate({ userId, ...p, ...sec }); }}>
        <ProfileFields v={p} set={setP} />
        <SecurityFields v={sec} set={setSec} />
        <div className="sm:col-span-2"><Button type="submit" disabled={m.isPending}>Create profile</Button></div>
      </form>
    </section>
  );
}

function ResetSecurity({ userId }: { userId: string }) {
  const [sec, setSec] = useState(emptySec);
  const m = useAdminAction(useServerFn(resetSecurityQuestions), "Security questions reset", () => setSec(emptySec));
  return (
    <form className="mt-6 grid gap-4 border-t border-border pt-6 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); m.mutate({ userId, ...sec }); }}>
      <h4 className="sm:col-span-2 font-medium">Reset security questions</h4>
      <SecurityFields v={sec} set={setSec} />
      <div className="sm:col-span-2"><Button type="submit" variant="outline" disabled={m.isPending}>Reset questions</Button></div>
    </form>
  );
}
