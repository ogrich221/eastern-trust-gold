import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeftRight, Check, Copy, Globe, KeyRound, Receipt, AlertTriangle, RefreshCw, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listTransactions } from "@/lib/admin.functions";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatTransactionDate } from "@/lib/transaction-date";
import { cleanAccountNumber, formatAccountNumber, isValidAccountNumber } from "@/lib/account-number";

export type BankAccount = { id: string; account_type: string; name: string; last_four: string; account_number?: string | null; available_balance: number };
type Txn = { id: string; account_id: string; txn_type: string; amount: number; currency: string; description: string; status: string; created_at: string; transaction_date: string; balance_after: number | null; pendingIncoming?: boolean };
const BANK_ROUTING_NUMBER = "021000089";
const BANK_ADDRESS = "Eastern Trust Bank NA, 100 Wall Street, Suite 2400, New York, NY 10005";

const errors: Record<string, string> = {
  INSUFFICIENT_FUNDS: "There isn't enough money in that account.",
  INVALID_AMOUNT: "Enter a valid amount (up to 2 decimal places).",
  RECIPIENT_NOT_FOUND: "We couldn't find an active Eastern Trust account with that account number.",
  SAME_ACCOUNT: "You can't transfer to your own account.",
  ACCOUNT_NOT_FOUND: "Your active checking account wasn't found. Please refresh and try again.",
  ARCHIVED_ACCOUNT_LOCKED: "This account is archived and cannot be used for transfers.",
  PROFILE_NOT_FOUND: "We couldn't find your profile. Please refresh and try again.",
  SOURCE_NOT_ALLOWED: "You can't send money from that account.",
  INVALID_PAYEE: "Enter who you're paying.",
  CURRENCY_MISMATCH: "Those accounts use different currencies.",
  PIN_INVALID: "That transfer PIN isn't correct.",
  INVALID_PIN: "Choose a PIN of 4 to 6 digits.",
  INVALID_RECIPIENT: "Enter the recipient's full name.",
  INVALID_BANK: "Enter the recipient's bank name.",
  INVALID_BANK_ADDRESS: "Enter the recipient's bank address.",
  INVALID_SWIFT: "Enter a valid SWIFT/BIC code (8–11 characters).",
  INVALID_ACCOUNT_NUMBER: "Enter a valid recipient account number (8–20 digits).",
  INVALID_CURRENCY: "Choose a currency.",
  INVALID_COUNTRY: "Choose a destination country.",
  COUNTRY_NOT_SUPPORTED: "We don't currently support wire transfers to that country.",
  ACCOUNT_SUSPENDED: "Account suspended: Transfers and bill payments are restricted.",
};
const friendly = (m: string) => Object.entries(errors).find(([k]) => m.includes(k))?.[1] ?? "Something went wrong. Please try again.";
const fmt = (n: number, c = "USD") => n.toLocaleString("en-US", { style: "currency", currency: c });
const selectCls = "h-10 w-full border border-input bg-background px-3 text-sm";

async function hashPin(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value.trim().toLowerCase()));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const WIRE_COUNTRIES = [
  "United States", "Canada", "Mexico", "Brazil", "Argentina", "Chile", "Colombia", "Peru",
  "United Kingdom", "Ireland", "France", "Germany", "Spain", "Portugal", "Italy", "Netherlands",
  "Belgium", "Switzerland", "Austria", "Sweden", "Norway", "Denmark", "Finland", "Poland",
  "Czech Republic", "Greece", "Turkey", "United Arab Emirates", "Saudi Arabia", "Qatar", "Israel",
  "India", "China", "Japan", "South Korea", "Singapore", "Hong Kong", "Taiwan", "Thailand",
  "Vietnam", "Malaysia", "Indonesia", "Philippines", "Australia", "New Zealand",
];
const WIRE_CURRENCIES = [
  "USD", "EUR", "GBP", "CHF", "CAD", "AUD", "NZD", "JPY", "CNY", "HKD", "SGD", "AED", "SAR",
  "QAR", "ILS", "INR", "BRL", "MXN", "ARS", "CLP", "COP", "PEN", "SEK", "NOK", "DKK", "PLN",
  "CZK", "TRY", "THB", "MYR", "IDR", "PHP", "KRW", "TWD",
];

export function CustomerBanking({
  accounts,
  onChange,
  hidden,
  isSuspended = false,
  customerId,
  isAdminView = false,
  accountHolderName = "Eastern Trust Client",
}: {
  accounts: BankAccount[];
  onChange: () => void;
  hidden: boolean;
  isSuspended?: boolean;
  customerId?: string;
  isAdminView?: boolean;
  accountHolderName?: string;
}) {
  const listAdminTxns = useServerFn(listTransactions);
  const [txns, setTxns] = useState<Txn[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [mode, setMode] = useState<"transfer" | "pay" | "wire" | null>(null);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState<"transfer" | "pay" | "wire" | null>(null);
  const [userSuspended, setUserSuspended] = useState(isSuspended);

  useEffect(() => {
    setUserSuspended(isSuspended);
  }, [isSuspended]);

  const loadTxns = useCallback(async () => {
    setRefreshing(true);
    setLoadError(null);
    try {
      if (isAdminView && customerId) {
        const res = await listAdminTxns({ data: { userId: customerId, type: "ALL", status: "ALL", adminName: "", from: "", to: "", page: 0 } });
        const rows = (res.rows ?? [])
          .filter((t) => filter === "all" || t.account_id === filter)
          .map((t) => ({
            id: t.id,
            account_id: t.account_id,
            txn_type: t.txn_type,
            amount: Number(t.amount),
            currency: t.currency,
            description: t.description,
            status: t.status,
            created_at: t.created_at,
            transaction_date: t.transaction_date,
            balance_after: Number(t.balance_after),
          }));
        setTxns(rows);
        return;
      }

      let q = supabase
        .from("account_transactions")
        .select("id,account_id,txn_type,amount,currency,description,status,created_at,transaction_date,balance_after")
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100);
      if (filter !== "all") q = q.eq("account_id", filter);
      let incomingQ = supabase
        .from("customer_transfer_requests")
        .select("id,to_account_id,recipient_user_id,amount,currency,memo,status,created_at")
        .eq("status", "PENDING")
        .order("created_at", { ascending: false })
        .limit(50);
      if (filter !== "all") incomingQ = incomingQ.eq("to_account_id", filter);

      const [{ data, error }, { data: incomingRows }, { data: authData }] = await Promise.all([
        q,
        incomingQ,
        supabase.auth.getUser(),
      ]);
      if (error) {
        setLoadError("Could not load transaction history.");
        return;
      }
      const myId = authData.user?.id;
      const posted: Txn[] = (data ?? []).map((t) => ({
        ...t,
        amount: Number(t.amount),
        balance_after: Number(t.balance_after),
      }));
      const incoming: Txn[] = (incomingRows ?? [])
        .filter((r) => Boolean(myId && r.recipient_user_id === myId && r.to_account_id))
        .map((r) => ({
          id: `incoming-${r.id}`,
          account_id: r.to_account_id!,
          txn_type: "CREDIT",
          amount: Number(r.amount),
          currency: r.currency,
          description: `Incoming Eastern Trust transfer${r.memo ? ` — ${r.memo}` : ""}`,
          status: "PENDING",
          created_at: r.created_at,
          transaction_date: r.created_at.slice(0, 10),
          balance_after: null,
          pendingIncoming: true,
        }));
      const merged = [...incoming, ...posted].sort((a, b) => {
        const dateCmp = b.transaction_date.localeCompare(a.transaction_date);
        return dateCmp !== 0 ? dateCmp : b.created_at.localeCompare(a.created_at);
      });
      setTxns(merged);
    } catch {
      setLoadError("Could not load transaction history.");
    } finally {
      setRefreshing(false);
    }
  }, [filter, isAdminView, customerId, listAdminTxns]);

  useEffect(() => { loadTxns(); }, [loadTxns, accounts]);

  useEffect(() => {
    if (isAdminView) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") loadTxns();
    };
    const onFocus = () => loadTxns();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isAdminView, loadTxns]);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const suspended = Boolean(
        isSuspended ||
        (u.user as any)?.banned ||
        u.user.user_metadata?.["suspended"] ||
        (u.user as any)?.app_metadata?.suspended ||
        ((u.user as any)?.banned_until && new Date((u.user as any).banned_until) > new Date())
      );
      if (suspended) setUserSuspended(true);
      const { data } = await supabase.from("profiles").select("transfer_pin_hash").eq("id", u.user.id).maybeSingle();
      setHasPin(Boolean(data?.transfer_pin_hash));
    })();
  }, [isSuspended]);

  const openMode = async (m: "transfer" | "pay" | "wire") => {
    if (userSuspended) {
      toast.error("Transfers and payments are restricted while your account is suspended. Please contact customer support.");
      return;
    }
    let pinReady = hasPin;
    if (pinReady === null) {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        const { data } = await supabase.from("profiles").select("transfer_pin_hash").eq("id", u.user.id).maybeSingle();
        pinReady = Boolean(data?.transfer_pin_hash);
        setHasPin(pinReady);
      }
    }
    if (pinReady === false) { setPendingMode(m); setPinOpen(true); return; }
    setMode(m);
  };

  const done = () => { setMode(null); onChange(); loadTxns(); };
  const name = (id: string) => { const a = accounts.find((x) => x.id === id); return a ? `${a.name} •••• ${a.last_four}` : "Archived account"; };

  return (
    <>
      <div className="mt-12 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Move money</h2>
          {userSuspended && (
            <p className="mt-1 text-xs text-destructive flex items-center gap-1 font-medium">
              <AlertTriangle className="size-3.5" />
              Transfer features are restricted while your account is suspended.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => openMode("transfer")}
            disabled={userSuspended}
            className={userSuspended ? "opacity-60 cursor-not-allowed" : ""}
          >
            <ArrowLeftRight className="mr-1.5 size-4" /> Domestic transfer
          </Button>
          <Button variant="outline" onClick={() => setReceiveOpen(true)}>
            <Download className="mr-1.5 size-4" /> Receive money
          </Button>
          <Button
            variant="outline"
            onClick={() => openMode("pay")}
            disabled={userSuspended}
            className={userSuspended ? "opacity-60 cursor-not-allowed" : ""}
          >
            <Receipt className="mr-1.5 size-4" /> Pay a bill
          </Button>
          <Button
            variant="outline"
            onClick={() => openMode("wire")}
            disabled={userSuspended}
            className={userSuspended ? "opacity-60 cursor-not-allowed" : ""}
          >
            <Globe className="mr-1.5 size-4" /> International wire
          </Button>
        </div>
      </div>

      <div className="mt-12 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl">Transaction history</h2>
        <div className="flex items-center gap-2">
          <select aria-label="Filter by account" className={selectCls + " max-w-xs"} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All accounts</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} •••• {a.last_four}</option>)}
          </select>
          <Button type="button" variant="outline" size="icon" aria-label="Refresh transaction history" onClick={() => { onChange(); loadTxns(); }} disabled={refreshing}>
            <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>
      <div className="mt-5 border border-border bg-card">
        {loadError && <p className="p-6 text-sm text-destructive">{loadError}</p>}
        {!loadError && txns === null && <p className="p-6 text-muted-foreground">Loading…</p>}
        {!loadError && txns?.length === 0 && <p className="p-6 text-muted-foreground">No transactions yet.</p>}
        <ul className="divide-y divide-border">
          {txns?.map((t) => {
            const acctLabel = name(t.account_id);
            return (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
                <div className="min-w-0">
                  <div className="font-medium flex flex-wrap items-center gap-2">
                    <span>{t.description}</span>
                    {t.status === "PENDING" && (
                      <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-[11px]">
                        Pending approval
                      </Badge>
                    )}
                    {t.status === "REVERSED" && (
                      <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive text-[11px]">
                        Reversed
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatTransactionDate(t.transaction_date)}
                    {acctLabel ? ` · ${acctLabel}` : ""}
                    {t.status === "PENDING" ? " · Awaiting admin verification" : t.status === "COMPLETED" ? " · Completed" : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className={t.txn_type === "CREDIT" ? "font-semibold text-primary" : "font-semibold"}>{hidden ? "••••" : `${t.txn_type === "CREDIT" ? "+" : "−"}${fmt(t.amount, t.currency)}`}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.pendingIncoming || t.balance_after === null
                      ? "Pending credit"
                      : `Balance ${hidden ? "••••" : fmt(t.balance_after, t.currency)}`}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <SetPinDialog open={pinOpen} onClose={() => { setPinOpen(false); setPendingMode(null); }} onDone={() => { setPinOpen(false); setHasPin(true); if (pendingMode) setMode(pendingMode); setPendingMode(null); }} />
      <MoneyDialog mode={mode === "wire" ? null : mode} accounts={accounts} isSuspended={userSuspended} onClose={() => setMode(null)} onDone={done} />
      <WireDialog open={mode === "wire"} accounts={accounts} isSuspended={userSuspended} onClose={() => setMode(null)} onDone={done} />
      <ReceiveMoneyDialog open={receiveOpen} onClose={() => setReceiveOpen(false)} account={accounts[0]} accountHolderName={accountHolderName} />
    </>
  );
}

function ReceiveMoneyDialog({ open, onClose, account, accountHolderName }: { open: boolean; onClose: () => void; account: BankAccount | undefined; accountHolderName: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  const acctFormatted = formatAccountNumber(account?.account_number, account?.last_four);
  const acctRaw = cleanAccountNumber(account?.account_number ?? "") || acctFormatted.replace(/\s/g, "");
  const copy = (label: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopied(label);
    toast.success(`${label} copied`);
    setTimeout(() => setCopied(null), 1800);
  };
  const rows = [
    { label: "Recipient name", value: accountHolderName },
    { label: "Account number", value: acctFormatted, copyValue: acctRaw, mono: true },
    { label: "Routing number", value: BANK_ROUTING_NUMBER, mono: true },
    { label: "Bank address", value: BANK_ADDRESS },
  ];
  const fullSummary = `Recipient Name: ${accountHolderName}\nAccount Number: ${acctRaw}\nRouting Number: ${BANK_ROUTING_NUMBER}\nBank Address: ${BANK_ADDRESS}`;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Your transfer details</DialogTitle>
          <DialogDescription>Share these details with another Eastern Trust customer so they can transfer money directly to your checking account.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 text-sm">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-3 border border-border bg-background/60 p-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{r.label}</p>
                <p className={r.mono ? "font-mono font-semibold" : "font-medium"}>{r.value}</p>
              </div>
              <Button type="button" variant="ghost" size="icon" aria-label={`Copy ${r.label}`} onClick={() => copy(r.label, r.copyValue ?? r.value)}>
                {copied === r.label ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
              </Button>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
          <Button type="button" onClick={() => copy("All transfer details", fullSummary)}>
            <Copy className="mr-1.5 size-4" /> Copy all details
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SetPinDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setPin(""); setConfirm(""); setErr(""); } }, [open]);

  const submit = async () => {
    setErr("");
    if (!/^\d{4,6}$/.test(pin)) return setErr(errors["INVALID_PIN"]!);
    if (pin !== confirm) return setErr("PINs do not match.");
    setBusy(true);
    const { error } = await supabase.rpc("set_transfer_pin", { _pin_hash: await hashPin(pin) });
    setBusy(false);
    if (error) return setErr(friendly(error.message));
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><KeyRound className="size-5 text-primary" /> Create your transfer PIN</DialogTitle>
          <DialogDescription>Before you can move money, set a 4–6 digit PIN. You'll enter it to approve every transfer, payment or wire.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2"><Label htmlFor="newpin">Transfer PIN</Label><PasswordInput id="newpin" inputMode="numeric" autoComplete="off" minLength={4} maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} /></div>
          <div className="grid gap-2"><Label htmlFor="newpin2">Confirm PIN</Label><PasswordInput id="newpin2" inputMode="numeric" autoComplete="off" minLength={4} maxLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ""))} /></div>
          {err && <p className="text-sm text-destructive">{err}</p>}
        </div>
        <DialogFooter><Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save PIN"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PinField({ pin, setPin }: { pin: string; setPin: (v: string) => void }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor="txnpin">Transfer PIN</Label>
      <PasswordInput id="txnpin" inputMode="numeric" autoComplete="off" minLength={4} maxLength={6} placeholder="4–6 digits" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
    </div>
  );
}

function MoneyDialog({ mode, accounts, isSuspended = false, onClose, onDone }: { mode: "transfer" | "pay" | null; accounts: BankAccount[]; isSuspended?: boolean; onClose: () => void; onDone: () => void }) {
  const sources = accounts.filter((a) => (mode === "pay" ? a.account_type !== "investment" : ["checking", "savings"].includes(a.account_type)));
  const [from, setFrom] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientAcct, setRecipientAcct] = useState("");
  const [recipientBankAddress, setRecipientBankAddress] = useState("");
  const [payee, setPayee] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [pin, setPin] = useState("");
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState("");

  useEffect(() => {
    if (mode) { setFrom(sources[0]?.id ?? ""); setRecipientName(""); setRecipientAcct(""); setRecipientBankAddress(""); setPayee(""); setAmount(""); setMemo(""); setPin(""); setStep("form"); setErr(""); setKey(crypto.randomUUID()); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const amt = Number(amount.replace(/,/g, "").trim());
  const cleanRecipient = recipientName.trim();
  const cleanAcct = cleanAccountNumber(recipientAcct);
  const cleanBankAddress = recipientBankAddress.trim();
  const src = accounts.find((a) => a.id === from);
  const review = () => {
    setErr("");
    if (isSuspended) return setErr("Transfers and payments are restricted while your account is suspended.");
    if (!src) return setErr("Choose an account.");
    if (!(amt > 0) || Math.round(amt * 100) !== amt * 100) return setErr(errors["INVALID_AMOUNT"]!);
    if (mode === "transfer") {
      if (cleanRecipient.length < 2) return setErr(errors["INVALID_RECIPIENT"]!);
      if (!isValidAccountNumber(recipientAcct)) return setErr(errors["INVALID_ACCOUNT_NUMBER"]!);
      if (cleanBankAddress.length < 5) return setErr(errors["INVALID_BANK_ADDRESS"]!);
    }
    if (mode === "pay" && payee.trim().length < 2) return setErr(errors["INVALID_PAYEE"]!);
    setStep("confirm");
  };
  const submit = async () => {
    if (isSuspended) return setErr("Transfers and payments are restricted while your account is suspended.");
    setBusy(true); setErr("");
    const pinHash = await hashPin(pin);
    const { error } = mode === "transfer"
      ? await supabase.rpc("customer_user_transfer", { _from: from, _recipient_name: cleanRecipient, _to_account_number: cleanAcct, _amount: amt, _memo: memo, _key: key, _pin_hash: pinHash })
      : await supabase.rpc("customer_payment", { _from: from, _payee: payee, _amount: amt, _memo: memo, _key: key, _pin_hash: pinHash });
    setBusy(false);
    if (error) { setErr(friendly(error.message)); if (error.message.includes("PIN_INVALID")) return; setStep("form"); return; }
    toast.success(mode === "transfer" ? `Transfer of ${fmt(amt)} to ${cleanRecipient} (•••• ${cleanAcct.slice(-4)}) submitted — pending admin approval.` : `Payment of ${fmt(amt)} to ${payee.trim()} submitted — pending admin approval.`);
    onDone();
  };
  const destination = mode === "pay" ? payee : cleanRecipient;

  return (
    <Dialog open={mode !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "pay" ? "Pay a bill" : "Domestic transfer"}</DialogTitle>
          <DialogDescription>{mode === "pay" ? "Pay a company or person from your account. Payments remain pending until verified by our team." : "Send money to another Eastern Trust customer using their name, account number, and bank address. Transfers remain pending until verified by our team."}</DialogDescription>
        </DialogHeader>
        {step === "form" ? (
          <div className="grid gap-4">
            <div className="grid gap-2"><Label htmlFor="from">From</Label>
              <select id="from" className={selectCls} value={from} onChange={(e) => setFrom(e.target.value)}>
                {sources.map((a) => <option key={a.id} value={a.id}>{a.name} •••• {a.last_four} ({fmt(a.available_balance)} available)</option>)}
              </select></div>
            {mode === "transfer" ? (
              <>
                <div className="grid gap-2"><Label htmlFor="recipient-name">Recipient full name</Label>
                  <Input id="recipient-name" maxLength={120} placeholder="e.g. Jane Doe" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
                </div>
                <div className="grid gap-2"><Label htmlFor="recipient-acct">Recipient account number</Label>
                  <Input id="recipient-acct" inputMode="numeric" maxLength={24} placeholder="e.g. 8204 1001 4617" value={recipientAcct} onChange={(e) => setRecipientAcct(e.target.value)} />
                </div>
                <div className="grid gap-2"><Label htmlFor="recipient-bank-address">Recipient bank address</Label>
                  <Input id="recipient-bank-address" maxLength={200} placeholder="e.g. Eastern Trust Bank NA, 100 Wall St, New York, NY" value={recipientBankAddress} onChange={(e) => setRecipientBankAddress(e.target.value)} />
                </div>
              </>
            ) : (
              <div className="grid gap-2"><Label htmlFor="payee">Pay to</Label><Input id="payee" maxLength={80} placeholder="e.g. City Electric" value={payee} onChange={(e) => setPayee(e.target.value)} /></div>
            )}
            <div className="grid gap-2"><Label htmlFor="amt">Amount (USD)</Label><Input id="amt" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div className="grid gap-2"><Label htmlFor="memo">Note (optional)</Label><Input id="memo" maxLength={140} value={memo} onChange={(e) => setMemo(e.target.value)} /></div>
            {err && <p className="text-sm text-destructive">{err}</p>}
          </div>
        ) : (
          <div className="grid gap-4 text-sm">
            <p>Send <strong>{fmt(amt)}</strong> from <strong>{src?.name}</strong> to <strong>{destination}</strong>?</p>
            {mode === "transfer" && (
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>Account number: <span className="font-mono text-foreground">{formatAccountNumber(cleanAcct)}</span></p>
                <p>Bank address: <span className="text-foreground">{cleanBankAddress}</span></p>
              </div>
            )}
            {memo && <p className="text-muted-foreground">Note: {memo}</p>}
            <PinField pin={pin} setPin={setPin} />
            {err && <p className="text-destructive">{err}</p>}
          </div>
        )}
        <DialogFooter>
          {step === "form"
            ? <Button onClick={review}>Review</Button>
            : <><Button variant="outline" onClick={() => setStep("form")} disabled={busy}>Back</Button><Button onClick={submit} disabled={busy || pin.length < 4}>{busy ? "Sending…" : "Confirm"}</Button></>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WireDialog({ open, accounts, isSuspended = false, onClose, onDone }: { open: boolean; accounts: BankAccount[]; isSuspended?: boolean; onClose: () => void; onDone: () => void }) {
  const sources = accounts.filter((a) => ["checking", "savings"].includes(a.account_type));
  const [from, setFrom] = useState("");
  const [recipient, setRecipient] = useState("");
  const [bank, setBank] = useState("");
  const [swift, setSwift] = useState("");
  const [acctNo, setAcctNo] = useState("");
  const [country, setCountry] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [pin, setPin] = useState("");
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState("");

  useEffect(() => {
    if (open) { setFrom(sources[0]?.id ?? ""); setRecipient(""); setBank(""); setSwift(""); setAcctNo(""); setCountry(""); setCurrency("EUR"); setAmount(""); setMemo(""); setPin(""); setStep("form"); setErr(""); setKey(crypto.randomUUID()); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const amt = Number(amount.replace(/,/g, "").trim());
  const src = accounts.find((a) => a.id === from);
  const review = () => {
    setErr("");
    if (isSuspended) return setErr("Wire transfers are restricted while your account is suspended.");
    if (!src) return setErr("Choose an account.");
    if (!(amt > 0) || Math.round(amt * 100) !== amt * 100) return setErr(errors["INVALID_AMOUNT"]!);
    if (recipient.trim().length < 2) return setErr(errors["INVALID_RECIPIENT"]!);
    if (bank.trim().length < 2) return setErr(errors["INVALID_BANK"]!);
    if (!/^[A-Za-z0-9]{8,11}$/.test(swift.trim())) return setErr(errors["INVALID_SWIFT"]!);
    if (acctNo.trim().length < 4 || acctNo.trim().length > 34) return setErr(errors["INVALID_ACCOUNT_NUMBER"]!);
    if (!country) return setErr(errors["INVALID_COUNTRY"]!);
    setStep("confirm");
  };
  const submit = async () => {
    if (isSuspended) return setErr("Wire transfers are restricted while your account is suspended.");
    setBusy(true); setErr("");
    const { error } = await supabase.rpc("customer_wire", {
      _from: from, _amount: amt, _currency: currency, _recipient_name: recipient, _recipient_bank: bank,
      _swift: swift, _account_number: acctNo, _country: country, _memo: memo, _key: key, _pin_hash: await hashPin(pin),
    });
    setBusy(false);
    if (error) { setErr(friendly(error.message)); if (error.message.includes("PIN_INVALID")) return; setStep("form"); return; }
    toast.success(`Wire request for ${fmt(amt)} to ${recipient.trim()} submitted — pending admin approval.`);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>International wire transfer</DialogTitle>
          <DialogDescription>Send money to a bank account outside the United States. Wires are reviewed by our team before release. African destinations are not currently supported.</DialogDescription>
        </DialogHeader>
        {step === "form" ? (
          <div className="grid gap-4">
            <div className="grid gap-2"><Label htmlFor="wfrom">From</Label>
              <select id="wfrom" className={selectCls} value={from} onChange={(e) => setFrom(e.target.value)}>
                {sources.map((a) => <option key={a.id} value={a.id}>{a.name} •••• {a.last_four} ({fmt(a.available_balance)} available)</option>)}
              </select></div>
            <div className="grid gap-2"><Label htmlFor="wname">Recipient's full name</Label><Input id="wname" maxLength={120} value={recipient} onChange={(e) => setRecipient(e.target.value)} /></div>
            <div className="grid gap-2"><Label htmlFor="wbank">Recipient's bank</Label><Input id="wbank" maxLength={120} value={bank} onChange={(e) => setBank(e.target.value)} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2"><Label htmlFor="wswift">SWIFT / BIC</Label><Input id="wswift" maxLength={11} placeholder="e.g. DEUTDEFF" value={swift} onChange={(e) => setSwift(e.target.value.toUpperCase())} /></div>
              <div className="grid gap-2"><Label htmlFor="wacct">Account number / IBAN</Label><Input id="wacct" maxLength={34} value={acctNo} onChange={(e) => setAcctNo(e.target.value)} /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2"><Label htmlFor="wcountry">Destination country</Label>
                <select id="wcountry" className={selectCls} value={country} onChange={(e) => setCountry(e.target.value)}>
                  <option value="">Choose country…</option>
                  {WIRE_COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select></div>
              <div className="grid gap-2"><Label htmlFor="wcur">Receiving currency</Label>
                <select id="wcur" className={selectCls} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {WIRE_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select></div>
            </div>
            <div className="grid gap-2"><Label htmlFor="wamt">Amount (USD)</Label><Input id="wamt" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} /><p className="text-xs text-muted-foreground">Charged in your account's currency; the recipient's bank converts to {currency}.</p></div>
            <div className="grid gap-2"><Label htmlFor="wmemo">Note (optional)</Label><Input id="wmemo" maxLength={140} value={memo} onChange={(e) => setMemo(e.target.value)} /></div>
            {err && <p className="text-sm text-destructive">{err}</p>}
          </div>
        ) : (
          <div className="grid gap-4 text-sm">
            <p>Wire <strong>{fmt(amt)}</strong> from <strong>{src?.name}</strong> to <strong>{recipient}</strong> at <strong>{bank}</strong> ({country})?</p>
            <p className="text-muted-foreground">SWIFT {swift.trim().toUpperCase()} · Account {acctNo.trim()} · Receives in {currency}</p>
            {memo && <p className="text-muted-foreground">Note: {memo}</p>}
            <PinField pin={pin} setPin={setPin} />
            {err && <p className="text-destructive">{err}</p>}
          </div>
        )}
        <DialogFooter>
          {step === "form"
            ? <Button onClick={review}>Review</Button>
            : <><Button variant="outline" onClick={() => setStep("form")} disabled={busy}>Back</Button><Button onClick={submit} disabled={busy || pin.length < 4}>{busy ? "Sending…" : "Confirm wire"}</Button></>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
