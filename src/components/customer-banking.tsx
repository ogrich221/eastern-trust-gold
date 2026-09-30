import { useCallback, useEffect, useState } from "react";
import { ArrowLeftRight, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type BankAccount = { id: string; account_type: string; name: string; last_four: string; available_balance: number };
type Txn = { id: string; account_id: string; txn_type: string; amount: number; currency: string; description: string; status: string; created_at: string; balance_after: number };

const errors: Record<string, string> = {
  INSUFFICIENT_FUNDS: "There isn't enough money in that account.",
  INVALID_AMOUNT: "Enter a valid amount (up to 2 decimal places).",
  RECIPIENT_NOT_FOUND: "We couldn't find an Eastern Trust customer with that email.",
  SAME_ACCOUNT: "Choose two different accounts.",
  SOURCE_NOT_ALLOWED: "You can't send money from that account.",
  INVALID_PAYEE: "Enter who you're paying.",
  CURRENCY_MISMATCH: "Those accounts use different currencies.",
};
const friendly = (m: string) => Object.entries(errors).find(([k]) => m.includes(k))?.[1] ?? "Something went wrong. Please try again.";
const fmt = (n: number, c = "USD") => n.toLocaleString("en-US", { style: "currency", currency: c });
const selectCls = "h-10 w-full border border-input bg-background px-3 text-sm";

export function CustomerBanking({ accounts, onChange, hidden }: { accounts: BankAccount[]; onChange: () => void; hidden: boolean }) {
  const [txns, setTxns] = useState<Txn[] | null>(null);
  const [mode, setMode] = useState<"transfer" | "pay" | null>(null);
  const [filter, setFilter] = useState("all");

  const loadTxns = useCallback(async () => {
    let q = supabase.from("account_transactions").select("id,account_id,txn_type,amount,currency,description,status,created_at,balance_after").order("created_at", { ascending: false }).limit(100);
    if (filter !== "all") q = q.eq("account_id", filter);
    const { data } = await q;
    setTxns((data ?? []).map((t) => ({ ...t, amount: Number(t.amount), balance_after: Number(t.balance_after) })));
  }, [filter]);
  useEffect(() => { loadTxns(); }, [loadTxns]);

  const done = () => { setMode(null); onChange(); loadTxns(); };
  const name = (id: string) => { const a = accounts.find((x) => x.id === id); return a ? `${a.name} •••• ${a.last_four}` : ""; };

  return (
    <>
      <div className="mt-12 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl">Move money</h2>
        <div className="flex gap-3">
          <Button onClick={() => setMode("transfer")}><ArrowLeftRight /> Transfer</Button>
          <Button variant="outline" onClick={() => setMode("pay")}><Receipt /> Pay a bill</Button>
        </div>
      </div>

      <div className="mt-12 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl">Transaction history</h2>
        <select aria-label="Filter by account" className={selectCls + " max-w-xs"} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All accounts</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} •••• {a.last_four}</option>)}
        </select>
      </div>
      <div className="mt-5 border border-border bg-card">
        {txns === null && <p className="p-6 text-muted-foreground">Loading…</p>}
        {txns?.length === 0 && <p className="p-6 text-muted-foreground">No transactions yet.</p>}
        <ul className="divide-y divide-border">
          {txns?.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div className="min-w-0">
                <p className="font-medium">{t.description}</p>
                <p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()} · {name(t.account_id)}{t.status === "REVERSED" ? " · Reversed" : ""}</p>
              </div>
              <div className="text-right">
                <p className={t.txn_type === "CREDIT" ? "font-semibold text-primary" : "font-semibold"}>{hidden ? "••••" : `${t.txn_type === "CREDIT" ? "+" : "−"}${fmt(t.amount, t.currency)}`}</p>
                <p className="text-xs text-muted-foreground">Balance {hidden ? "••••" : fmt(t.balance_after, t.currency)}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <MoneyDialog mode={mode} accounts={accounts} onClose={() => setMode(null)} onDone={done} />
    </>
  );
}

function MoneyDialog({ mode, accounts, onClose, onDone }: { mode: "transfer" | "pay" | null; accounts: BankAccount[]; onClose: () => void; onDone: () => void }) {
  const sources = accounts.filter((a) => (mode === "pay" ? a.account_type !== "investment" : ["checking", "savings"].includes(a.account_type)));
  const [from, setFrom] = useState("");
  const [toKind, setToKind] = useState<"own" | "customer">("own");
  const [to, setTo] = useState("");
  const [email, setEmail] = useState("");
  const [payee, setPayee] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState("");

  useEffect(() => {
    if (mode) { setFrom(sources[0]?.id ?? ""); setTo(""); setEmail(""); setPayee(""); setAmount(""); setMemo(""); setStep("form"); setErr(""); setKey(crypto.randomUUID()); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const amt = Number(amount.replace(/,/g, "").trim());
  const src = accounts.find((a) => a.id === from);
  const review = () => {
    setErr("");
    if (!src) return setErr("Choose an account.");
    if (!(amt > 0) || Math.round(amt * 100) !== amt * 100) return setErr(errors["INVALID_AMOUNT"]!);
    if (mode === "transfer" && toKind === "own" && !to) return setErr("Choose where to send it.");
    if (mode === "transfer" && toKind === "customer" && !/^\S+@\S+\.\S+$/.test(email)) return setErr("Enter the recipient's email.");
    if (mode === "pay" && payee.trim().length < 2) return setErr(errors["INVALID_PAYEE"]!);
    setStep("confirm");
  };
  const submit = async () => {
    setBusy(true); setErr("");
    const { error } = mode === "transfer"
      ? await supabase.rpc("customer_transfer", { _from: from, _to_account: toKind === "own" ? to : (null as unknown as string), _to_email: toKind === "customer" ? email : (null as unknown as string), _amount: amt, _memo: memo, _key: key })
      : await supabase.rpc("customer_payment", { _from: from, _payee: payee, _amount: amt, _memo: memo, _key: key });
    setBusy(false);
    if (error) { setErr(friendly(error.message)); setStep("form"); return; }
    onDone();
  };
  const destination = mode === "pay" ? payee : toKind === "own" ? accounts.find((a) => a.id === to)?.name ?? "" : email;

  return (
    <Dialog open={mode !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "pay" ? "Pay a bill" : "Transfer money"}</DialogTitle>
          <DialogDescription>{mode === "pay" ? "Pay a company or person from your account." : "Move money between your accounts or to another Eastern Trust customer."}</DialogDescription>
        </DialogHeader>
        {step === "form" ? (
          <div className="grid gap-4">
            <div className="grid gap-2"><Label htmlFor="from">From</Label>
              <select id="from" className={selectCls} value={from} onChange={(e) => setFrom(e.target.value)}>
                {sources.map((a) => <option key={a.id} value={a.id}>{a.name} •••• {a.last_four} ({fmt(a.available_balance)} available)</option>)}
              </select></div>
            {mode === "transfer" ? (
              <>
                <div className="grid gap-2"><Label htmlFor="kind">To</Label>
                  <select id="kind" className={selectCls} value={toKind} onChange={(e) => setToKind(e.target.value as "own" | "customer")}>
                    <option value="own">One of my accounts</option>
                    <option value="customer">Another Eastern Trust customer</option>
                  </select></div>
                {toKind === "own" ? (
                  <select aria-label="Destination account" className={selectCls} value={to} onChange={(e) => setTo(e.target.value)}>
                    <option value="">Choose account…</option>
                    {accounts.filter((a) => a.id !== from).map((a) => <option key={a.id} value={a.id}>{a.name} •••• {a.last_four}</option>)}
                  </select>
                ) : (
                  <Input aria-label="Recipient email" type="email" placeholder="Recipient's email" value={email} onChange={(e) => setEmail(e.target.value)} />
                )}
              </>
            ) : (
              <div className="grid gap-2"><Label htmlFor="payee">Pay to</Label><Input id="payee" maxLength={80} placeholder="e.g. City Electric" value={payee} onChange={(e) => setPayee(e.target.value)} /></div>
            )}
            <div className="grid gap-2"><Label htmlFor="amt">Amount (USD)</Label><Input id="amt" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div className="grid gap-2"><Label htmlFor="memo">Note (optional)</Label><Input id="memo" maxLength={140} value={memo} onChange={(e) => setMemo(e.target.value)} /></div>
            {err && <p className="text-sm text-destructive">{err}</p>}
          </div>
        ) : (
          <div className="grid gap-2 text-sm">
            <p>Send <strong>{fmt(amt)}</strong> from <strong>{src?.name}</strong> to <strong>{destination}</strong>?</p>
            {memo && <p className="text-muted-foreground">Note: {memo}</p>}
            {err && <p className="text-destructive">{err}</p>}
          </div>
        )}
        <DialogFooter>
          {step === "form"
            ? <Button onClick={review}>Review</Button>
            : <><Button variant="outline" onClick={() => setStep("form")} disabled={busy}>Back</Button><Button onClick={submit} disabled={busy}>{busy ? "Sending…" : "Confirm"}</Button></>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
