import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { postTransaction, reverseTransaction, listTransactions, listWires, setWireStatus } from "@/lib/admin.functions";

const fmt = (n: number, c = "USD") => n.toLocaleString("en-US", { style: "currency", currency: c });
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");
const newKey = () => crypto.randomUUID();

function useRefresh() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["admin-customers"] });
    qc.invalidateQueries({ queryKey: ["admin-audit"] });
    qc.invalidateQueries({ queryKey: ["admin-txns"] });
  };
}

type Acct = { id: string; name: string; last_four: string; account_type: string; available_balance: number; currency: string; allow_overdraft: boolean };

export function TransactionForm({ a }: { a: Acct }) {
  const post = useServerFn(postTransaction);
  const refresh = useRefresh();
  const [type, setType] = useState<"CREDIT" | "DEBIT" | null>(null);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(a.currency);
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  // One key per confirmation; repeated clicks reuse it so the server records the transaction once.
  const [key, setKey] = useState(newKey);
  const cleanAmount = amount.replace(/,/g, "").trim();
  const n = Number(cleanAmount);
  const valid = /^\d{1,10}(\.\d{1,2})?$/.test(cleanAmount) && n > 0;
  const m = useMutation({
    mutationFn: (t: "CREDIT" | "DEBIT") => post({ data: { accountId: a.id, type: t, amount: cleanAmount, currency, description, reference, idempotencyKey: key, allowOverdraft: true } }),
    onSuccess: (r) => { toast.success(`Transaction ${r.id.slice(0, 8)} completed`); setType(null); setAmount(""); setDescription(""); setReference(""); setKey(newKey()); refresh(); },
    onError: (e) => { toast.error(errMsg(e)); setKey(newKey()); },
  });
  const open = (t: "CREDIT" | "DEBIT") => {
    if (!valid) { toast.error("Enter a positive amount with at most 2 decimals"); return; }
    if (description.trim().length < 3) { toast.error("A description / reason is required"); return; }
    setType(t);
  };
  const after = type ? a.available_balance + (type === "CREDIT" ? n : -n) : 0;
  const isOverdraft = type === "DEBIT" && after < 0;

  return (
    <div className="space-y-3 border-t border-border pt-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">New transaction</p>
      <div className="grid gap-3 sm:grid-cols-[140px_90px_1fr_160px]">
        <div><Label className="text-xs">Amount</Label><Input className="mt-1" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></div>
        <div><Label className="text-xs">Currency</Label>
          <select className="mt-1 h-9 w-full border border-input bg-background px-2 text-sm" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value={a.currency}>{a.currency}</option>
          </select>
        </div>
        <div><Label className="text-xs">Description / reason (required)</Label><Input className="mt-1" maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Wire transfer, payroll, adjustment" /></div>
        <div><Label className="text-xs">Internal reference (optional)</Label><Input className="mt-1" maxLength={100} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. TXN-10492" /></div>
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={() => open("CREDIT")} className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs">
          + Credit Account
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => open("DEBIT")} className="border-rose-500/50 text-rose-400 hover:bg-rose-500/10 font-semibold text-xs">
          − Debit Account
        </Button>
      </div>
      <AlertDialog open={type !== null} onOpenChange={(o) => { if (!o && !m.isPending) setType(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm {type === "CREDIT" ? "Credit (+)" : "Debit (−)"}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>{a.name} •••• {a.last_four}</p>
                <p>Transaction Amount: <strong className={type === "CREDIT" ? "text-emerald-400" : "text-rose-400"}>{type === "CREDIT" ? "+" : "−"}{fmt(n || 0, currency)}</strong></p>
                <p>Current Balance: <strong>{fmt(a.available_balance, a.currency)}</strong></p>
                <p>Resulting Balance: <strong className={after < 0 ? "text-rose-400" : "text-emerald-400"}>{fmt(after, a.currency)}</strong></p>
                <p>Reason / Description: <em>{description}</em></p>
                {reference && <p>Reference: {reference}</p>}
                {isOverdraft && (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-300">
                    <strong>Administrative Overdraft:</strong> This debit exceeds available funds. Resulting balance will be <strong>{fmt(after, a.currency)}</strong>. Administrative override is authorized.
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={m.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={m.isPending} onClick={(e) => { e.preventDefault(); if (type) m.mutate(type); }}>
              {m.isPending ? "Processing…" : `Confirm ${type === "CREDIT" ? "Credit" : "Debit"}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function TransactionLedger({ userId, emailOf }: { userId?: string; emailOf?: (id: string) => string }) {
  const listFn = useServerFn(listTransactions);
  const [f, setF] = useState({ type: "ALL" as "ALL" | "CREDIT" | "DEBIT", status: "ALL" as "ALL" | "PENDING" | "COMPLETED" | "FAILED" | "REVERSED", adminName: "", from: "", to: "" });
  const [page, setPage] = useState(0);
  const q = useQuery({ queryKey: ["admin-txns", userId ?? "all", f, page], queryFn: () => listFn({ data: { userId, ...f, page } }) });
  const [rev, setRev] = useState<{ id: string; reason: string; key: string } | null>(null);
  const reverseFn = useServerFn(reverseTransaction);
  const refresh = useRefresh();
  const rm = useMutation({
    mutationFn: (r: { id: string; reason: string; key: string }) => reverseFn({ data: { transactionId: r.id, reason: r.reason, idempotencyKey: r.key } }),
    onSuccess: () => { toast.success("Transaction reversed"); setRev(null); refresh(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const set = (k: keyof typeof f, v: string) => { setF({ ...f, [k]: v }); setPage(0); };
  const pages = q.data ? Math.max(1, Math.ceil(q.data.total / q.data.pageSize)) : 1;
  const sel = "h-9 border border-input bg-background px-2 text-sm";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <select className={sel} value={f.type} onChange={(e) => set("type", e.target.value)}><option value="ALL">All types</option><option>CREDIT</option><option>DEBIT</option></select>
        <select className={sel} value={f.status} onChange={(e) => set("status", e.target.value)}><option value="ALL">All statuses</option><option>COMPLETED</option><option>PENDING</option><option>FAILED</option><option>REVERSED</option></select>
        <Input className="w-40" placeholder="Admin" value={f.adminName} onChange={(e) => set("adminName", e.target.value)} />
        <Input className="w-40" type="date" value={f.from} onChange={(e) => set("from", e.target.value)} aria-label="From date" />
        <Input className="w-40" type="date" value={f.to} onChange={(e) => set("to", e.target.value)} aria-label="To date" />
      </div>
      <div className="overflow-x-auto border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-muted-foreground">
            <tr><th className="p-2">When</th><th className="p-2">ID</th>{!userId && <th className="p-2">Customer</th>}<th className="p-2">Type</th><th className="p-2 text-right">Amount</th><th className="p-2 text-right">Before → After</th><th className="p-2">Reason</th><th className="p-2">Admin</th><th className="p-2">Status</th><th className="p-2" /></tr>
          </thead>
          <tbody>
            {q.isLoading && <tr><td colSpan={10} className="p-3 text-muted-foreground">Loading…</td></tr>}
            {q.error && <tr><td colSpan={10} className="p-3 text-destructive">{errMsg(q.error)}</td></tr>}
            {q.data?.rows.map((t) => (
              <tr key={t.id} className="border-b border-border align-top">
                <td className="p-2 whitespace-nowrap">{new Date(t.created_at).toLocaleString()}</td>
                <td className="p-2 font-mono text-xs" title={t.id}>{t.id.slice(0, 8)}{t.reference && <div className="text-muted-foreground">ref {t.reference.slice(0, 12)}</div>}</td>
                {!userId && <td className="p-2 text-xs">{emailOf?.(t.user_id) ?? t.user_id.slice(0, 8)}</td>}
                <td className="p-2"><Badge variant={t.txn_type === "CREDIT" ? "default" : "outline"}>{t.txn_type}</Badge></td>
                <td className="p-2 text-right whitespace-nowrap">{fmt(t.amount, t.currency)}</td>
                <td className="p-2 text-right whitespace-nowrap text-xs">{fmt(t.balance_before, t.currency)} → {fmt(t.balance_after, t.currency)}</td>
                <td className="max-w-xs p-2 text-xs">{t.description}{t.reversal_reason && t.status === "REVERSED" && <div className="text-muted-foreground">Reversed: {t.reversal_reason}</div>}</td>
                <td className="p-2 text-xs">{t.admin_name}</td>
                <td className="p-2"><Badge variant={t.status === "REVERSED" || t.status === "FAILED" ? "destructive" : "secondary"}>{t.status}</Badge></td>
                <td className="p-2">{t.status === "COMPLETED" && !t.reverses_id && <Button size="sm" variant="ghost" onClick={() => setRev({ id: t.id, reason: "", key: newKey() })}><Undo2 /> Reverse</Button>}</td>
              </tr>
            ))}
            {q.data?.rows.length === 0 && <tr><td colSpan={10} className="p-3 text-muted-foreground">No transactions.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{q.data?.total ?? 0} transactions</span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
          <span>Page {page + 1} of {pages}</span>
          <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      </div>
      <AlertDialog open={rev !== null} onOpenChange={(o) => { if (!o && !rm.isPending) setRev(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reverse transaction {rev?.id.slice(0, 8)}?</AlertDialogTitle>
            <AlertDialogDescription>A new opposite transaction will be recorded and linked. The original stays in the ledger marked REVERSED.</AlertDialogDescription>
          </AlertDialogHeader>
          <div><Label className="text-xs">Reason for reversal (required)</Label><Input className="mt-1" maxLength={300} value={rev?.reason ?? ""} onChange={(e) => rev && setRev({ ...rev, reason: e.target.value })} /></div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rm.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={rm.isPending || (rev?.reason.trim().length ?? 0) < 3} onClick={(e) => { e.preventDefault(); if (rev) rm.mutate(rev); }}>{rm.isPending ? "Reversing…" : "Reverse"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type Wire = {
  id: string; txn_id: string; user_id: string; account_id: string; recipient_name: string;
  recipient_bank: string; swift_bic: string; account_number: string; country: string;
  currency: string; amount: number; memo: string | null; status: string; created_at: string;
};

export function WireReview({ emailOf }: { emailOf: (id: string) => string }) {
  const list = useServerFn(listWires);
  const act = useServerFn(setWireStatus);
  const refresh = useRefresh();
  const qc = useQueryClient();
  const wires = useQuery({ queryKey: ["admin-wires"], queryFn: () => list() });
  const [target, setTarget] = useState<{ wire: Wire; action: "complete" | "cancel"; reason: string } | null>(null);

  const m = useMutation({
    mutationFn: async (t: { wire: Wire; action: "complete" | "cancel"; reason: string }) => {
      await act({ data: { wireId: t.wire.id, action: t.action, reason: t.reason, idempotencyKey: newKey() } });
    },
    onSuccess: () => { toast.success("Wire updated."); setTarget(null); refresh(); qc.invalidateQueries({ queryKey: ["admin-wires"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });

  const badge = (s: string) =>
    s === "PENDING" ? <Badge variant="outline" className="border-amber-500 text-amber-600">Pending</Badge>
    : s === "COMPLETED" ? <Badge variant="outline" className="border-primary text-primary">Completed</Badge>
    : <Badge variant="outline" className="border-destructive text-destructive">Cancelled</Badge>;

  return (
    <div className="border border-border bg-card">
      <div className="border-b border-border p-5">
        <h3 className="text-lg font-semibold">International wires</h3>
        <p className="text-sm text-muted-foreground">Review pending wires. Completing releases the wire; cancelling refunds the customer in full.</p>
      </div>
      {wires.isLoading && <p className="p-5 text-muted-foreground">Loading…</p>}
      {wires.data?.length === 0 && <p className="p-5 text-muted-foreground">No wire transfers yet.</p>}
      <ul className="divide-y divide-border">
        {wires.data?.map((w) => (
          <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div className="min-w-0">
              <p className="font-medium">{fmt(Number(w.amount))} → {w.recipient_name} ({w.country}) {badge(w.status)}</p>
              <p className="text-xs text-muted-foreground">
                {emailOf(w.user_id)} · {w.recipient_bank} · SWIFT {w.swift_bic} · Acct {w.account_number} · Receives {w.currency} · {new Date(w.created_at).toLocaleString()}
                {w.memo ? ` · ${w.memo}` : ""}
              </p>
            </div>
            {w.status === "PENDING" && (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setTarget({ wire: w, action: "complete", reason: "" })}>Complete</Button>
                <Button size="sm" variant="outline" onClick={() => setTarget({ wire: w, action: "cancel", reason: "" })}>Cancel & refund</Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <AlertDialog open={target !== null} onOpenChange={(o) => { if (!o && !m.isPending) setTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{target?.action === "complete" ? "Release this wire?" : "Cancel and refund this wire?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {target?.action === "complete"
                ? `The ${target ? fmt(Number(target.wire.amount)) : ""} wire to ${target?.wire.recipient_name} will be marked as sent.`
                : `The customer will be refunded ${target ? fmt(Number(target.wire.amount)) : ""} and the wire will be cancelled.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div><Label className="text-xs">Reason (required, recorded in the activity log)</Label><Input className="mt-1" maxLength={300} value={target?.reason ?? ""} onChange={(e) => target && setTarget({ ...target, reason: e.target.value })} /></div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={m.isPending}>Back</AlertDialogCancel>
            <AlertDialogAction disabled={m.isPending || (target?.reason.trim().length ?? 0) < 3} onClick={(e) => { e.preventDefault(); if (target) m.mutate(target); }}>
              {m.isPending ? "Working…" : target?.action === "complete" ? "Release wire" : "Cancel & refund"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
