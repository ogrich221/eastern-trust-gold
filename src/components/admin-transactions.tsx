import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Pencil, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { postTransaction, reverseTransaction, listTransactions, listWires, setWireStatus, listTransferRequests, reviewTransferRequest, updateTransactionDate } from "@/lib/admin.functions";
import { currentTransactionDate, formatTransactionDate, isValidTransactionDate } from "@/lib/transaction-date";
import { formatAccountNumber } from "@/lib/account-number";

const fmt = (n: number, c = "USD") => n.toLocaleString("en-US", { style: "currency", currency: c });
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");
const newKey = () => crypto.randomUUID();

function useRefresh() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["admin-customers"] });
    qc.invalidateQueries({ queryKey: ["admin-audit"] });
    qc.invalidateQueries({ queryKey: ["admin-txns"] });
    qc.invalidateQueries({ queryKey: ["admin-transfer-requests"] });
    qc.invalidateQueries({ queryKey: ["admin-wires"] });
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
  const [transactionDate, setTransactionDate] = useState(currentTransactionDate);
  // One key per confirmation; repeated clicks reuse it so the server records the transaction once.
  const [key, setKey] = useState(newKey);
  const cleanAmount = amount.replace(/,/g, "").trim();
  const n = Number(cleanAmount);
  const valid = /^\d{1,10}(\.\d{1,2})?$/.test(cleanAmount) && n > 0;
  const m = useMutation({
    mutationFn: (t: "CREDIT" | "DEBIT") => post({ data: { accountId: a.id, type: t, amount: cleanAmount, currency, description, reference, idempotencyKey: key, allowOverdraft: true, transactionDate } }),
    onSuccess: (r) => { toast.success(`Transaction ${r.id.slice(0, 8)} completed`); setType(null); setAmount(""); setDescription(""); setReference(""); setTransactionDate(currentTransactionDate()); setKey(newKey()); refresh(); },
    onError: (e) => { toast.error(errMsg(e)); setKey(newKey()); },
  });
  const open = (t: "CREDIT" | "DEBIT") => {
    if (!valid) { toast.error("Enter a positive amount with at most 2 decimals"); return; }
    if (description.trim().length < 3) { toast.error("A description / reason is required"); return; }
    if (!isValidTransactionDate(transactionDate)) { toast.error("Choose a valid transaction date"); return; }
    setType(t);
  };
  const after = type ? a.available_balance + (type === "CREDIT" ? n : -n) : 0;
  const isOverdraft = type === "DEBIT" && after < 0;

  return (
    <div className="space-y-4 border-t border-white/10 pt-4">
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-amber-400 animate-pulse" />
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">Post Real-Time Transaction</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[140px_90px_160px_1fr_160px]">
        <div>
          <Label className="text-xs text-slate-300">Amount</Label>
          <Input
            className="mt-1 h-9 rounded-xl border-white/10 bg-slate-950/60 backdrop-blur-md text-white font-mono placeholder:text-slate-500 focus:border-amber-500/50"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div>
          <Label className="text-xs text-slate-300">Currency</Label>
          <select
            className="mt-1 h-9 w-full rounded-xl border border-white/10 bg-slate-950/60 backdrop-blur-md px-2 text-xs text-white"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            <option value={a.currency}>{a.currency}</option>
          </select>
        </div>
        <div>
          <Label htmlFor={`transaction-date-${a.id}`} className="text-xs text-slate-300">Transaction date</Label>
          <Input
            id={`transaction-date-${a.id}`}
            className="mt-1 h-9 rounded-xl border-white/10 bg-slate-950/60 backdrop-blur-md text-white text-xs focus:border-amber-500/50"
            type="date"
            required
            value={transactionDate}
            onChange={(e) => setTransactionDate(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs text-slate-300">Description / reason (required)</Label>
          <Input
            className="mt-1 h-9 rounded-xl border-white/10 bg-slate-950/60 backdrop-blur-md text-white placeholder:text-slate-500 focus:border-amber-500/50"
            maxLength={300}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Wire transfer, payroll, adjustment"
          />
        </div>
        <div>
          <Label className="text-xs text-slate-300">Internal reference (optional)</Label>
          <Input
            className="mt-1 h-9 rounded-xl border-white/10 bg-slate-950/60 backdrop-blur-md text-white font-mono placeholder:text-slate-500 focus:border-amber-500/50"
            maxLength={100}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. TXN-10492"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => open("CREDIT")}
          className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-sm"
        >
          + Credit Account
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => open("DEBIT")}
          className="rounded-xl border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 font-semibold text-xs"
        >
          − Debit Account
        </Button>
      </div>
      <AlertDialog open={type !== null} onOpenChange={(o) => { if (!o && !m.isPending) setType(null); }}>
        <AlertDialogContent className="rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-2xl text-slate-100 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold text-white">
              Confirm {type === "CREDIT" ? "Credit (+)" : "Debit (−)"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-slate-300">
                <p className="font-semibold text-white">{a.name} •••• {a.last_four}</p>
                <p>Transaction Amount: <strong className={type === "CREDIT" ? "text-emerald-400" : "text-rose-400"}>{type === "CREDIT" ? "+" : "−"}{fmt(n || 0, currency)}</strong></p>
                <p>Current Balance: <strong className="text-white">{fmt(a.available_balance, a.currency)}</strong></p>
                <p>Resulting Balance: <strong className={after < 0 ? "text-rose-400" : "text-emerald-400"}>{fmt(after, a.currency)}</strong></p>
                <p>Transaction date: <strong className="text-white">{formatTransactionDate(transactionDate)}</strong></p>
                <p>Reason / Description: <em className="text-slate-200">{description}</em></p>
                {reference && <p className="font-mono text-xs">Reference: {reference}</p>}
                {isOverdraft && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
                    <strong>Administrative Overdraft:</strong> This debit exceeds available funds. Resulting balance will be <strong>{fmt(after, a.currency)}</strong>. Administrative override is authorized.
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={m.isPending} className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={m.isPending}
              onClick={(e) => { e.preventDefault(); if (type) m.mutate(type); }}
              className={`rounded-xl text-xs font-semibold ${type === "CREDIT" ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-rose-600 hover:bg-rose-500 text-white"}`}
            >
              {m.isPending ? "Posting…" : "Confirm & Post"}
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
  const [dateEdit, setDateEdit] = useState<{ id: string; date: string; reason: string } | null>(null);
  const reverseFn = useServerFn(reverseTransaction);
  const updateDateFn = useServerFn(updateTransactionDate);
  const refresh = useRefresh();
  const rm = useMutation({
    mutationFn: (r: { id: string; reason: string; key: string }) => reverseFn({ data: { transactionId: r.id, reason: r.reason, idempotencyKey: r.key } }),
    onSuccess: () => { toast.success("Transaction reversed"); setRev(null); refresh(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const dateMutation = useMutation({
    mutationFn: (edit: { id: string; date: string; reason: string }) => updateDateFn({ data: { transactionId: edit.id, transactionDate: edit.date, reason: edit.reason } }),
    onSuccess: () => { toast.success("Transaction date updated"); setDateEdit(null); refresh(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const set = (k: keyof typeof f, v: string) => { setF({ ...f, [k]: v }); setPage(0); };
  const pages = q.data ? Math.max(1, Math.ceil(q.data.total / q.data.pageSize)) : 1;
  const sel = "h-9 rounded-xl border border-white/10 bg-slate-950/60 backdrop-blur-md px-3 text-xs text-white focus:border-amber-500/50";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <select className={sel} value={f.type} onChange={(e) => set("type", e.target.value)}>
          <option value="ALL">All types</option>
          <option>CREDIT</option>
          <option>DEBIT</option>
        </select>
        <select className={sel} value={f.status} onChange={(e) => set("status", e.target.value)}>
          <option value="ALL">All statuses</option>
          <option>COMPLETED</option>
          <option>PENDING</option>
          <option>FAILED</option>
          <option>REVERSED</option>
        </select>
        <Input
          className="w-40 h-9 rounded-xl border-white/10 bg-slate-950/60 backdrop-blur-md text-white text-xs placeholder:text-slate-500 focus:border-amber-500/50"
          placeholder="Filter by Admin..."
          value={f.adminName}
          onChange={(e) => set("adminName", e.target.value)}
        />
        <Input
          className="w-40 h-9 rounded-xl border-white/10 bg-slate-950/60 backdrop-blur-md text-white text-xs"
          type="date"
          value={f.from}
          onChange={(e) => set("from", e.target.value)}
          aria-label="From date"
        />
        <Input
          className="w-40 h-9 rounded-xl border-white/10 bg-slate-950/60 backdrop-blur-md text-white text-xs"
          type="date"
          value={f.to}
          onChange={(e) => set("to", e.target.value)}
          aria-label="To date"
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl shadow-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-white/10 text-left text-xs text-slate-400">
            <tr>
              <th className="p-3">Transaction Date</th>
              <th className="p-3">ID</th>
              {!userId && <th className="p-3">Customer</th>}
              <th className="p-3">Type</th>
              <th className="p-3 text-right">Amount</th>
              <th className="p-3 text-right">Before → After</th>
              <th className="p-3">Reason</th>
              <th className="p-3">Admin</th>
              <th className="p-3">Status</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-slate-200">
            {q.isLoading && <tr><td colSpan={10} className="p-4 text-center text-slate-400">Loading transactions…</td></tr>}
            {q.error && <tr><td colSpan={10} className="p-4 text-center text-rose-400">{errMsg(q.error)}</td></tr>}
            {q.data?.rows.map((t) => (
              <tr key={t.id} className="hover:bg-white/5 transition-colors align-top">
                <td className="p-3 whitespace-nowrap">
                  <div className="text-xs font-medium text-white">{formatTransactionDate(t.transaction_date)}</div>
                  <div className="text-[10px] text-slate-400">Entered {new Date(t.created_at).toLocaleString()}</div>
                </td>
                <td className="p-3 font-mono text-xs text-white" title={t.id}>
                  {t.id.slice(0, 8)}
                  {t.reference && <div className="text-[10px] text-slate-400 font-mono">ref {t.reference.slice(0, 12)}</div>}
                </td>
                {!userId && <td className="p-3 text-xs text-slate-300">{emailOf?.(t.user_id) ?? t.user_id.slice(0, 8)}</td>}
                <td className="p-3">
                  <Badge variant="outline" className={`text-xs ${t.txn_type === "CREDIT" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-rose-500/40 bg-rose-500/10 text-rose-300"}`}>
                    {t.txn_type}
                  </Badge>
                </td>
                <td className={`p-3 text-right whitespace-nowrap font-semibold ${t.txn_type === "CREDIT" ? "text-emerald-400" : "text-rose-400"}`}>
                  {fmt(t.amount, t.currency)}
                </td>
                <td className="p-3 text-right whitespace-nowrap text-xs text-slate-400 font-mono">
                  {fmt(t.balance_before, t.currency)} → {fmt(t.balance_after, t.currency)}
                </td>
                <td className="max-w-xs p-3 text-xs text-slate-300">
                  {t.description}
                  {t.reversal_reason && t.status === "REVERSED" && (
                    <div className="text-[10px] text-amber-300">Reversed: {t.reversal_reason}</div>
                  )}
                </td>
                <td className="p-3 text-xs text-slate-400">{t.admin_name}</td>
                <td className="p-3">
                  <Badge variant="outline" className={`text-xs ${t.status === "PENDING" ? "border-amber-500/40 bg-amber-500/10 text-amber-300" : t.status === "REVERSED" || t.status === "FAILED" ? "border-rose-500/40 bg-rose-500/10 text-rose-300" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"}`}>
                    {t.status}
                  </Badge>
                </td>
                <td className="p-3">
                  <div className="flex flex-col items-start gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDateEdit({ id: t.id, date: t.transaction_date, reason: "" })}
                      className="h-7 text-xs text-slate-400 hover:text-white hover:bg-white/10"
                    >
                      <Pencil className="mr-1 size-3" /> Edit date
                    </Button>
                    {t.status === "COMPLETED" && !t.reverses_id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setRev({ id: t.id, reason: "", key: newKey() })}
                        className="h-7 text-xs text-slate-400 hover:text-white hover:bg-white/10"
                      >
                        <Undo2 className="mr-1 size-3" /> Reverse
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {q.data?.rows.length === 0 && (
              <tr><td colSpan={10} className="p-6 text-center text-slate-400">No transactions found matching filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{q.data?.total ?? 0} transactions recorded</span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-xs">
            Previous
          </Button>
          <span>Page {page + 1} of {pages}</span>
          <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)} className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-xs">
            Next
          </Button>
        </div>
      </div>

      <AlertDialog open={dateEdit !== null} onOpenChange={(o) => { if (!o && !dateMutation.isPending) setDateEdit(null); }}>
        <AlertDialogContent className="rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-2xl text-slate-100 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Edit transaction date</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-300">
              Change only the calendar date for transaction {dateEdit?.id.slice(0, 8)}. The amount, balances, description, and original entry time stay unchanged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-transaction-date" className="text-xs text-slate-300">Transaction date</Label>
              <Input
                id="edit-transaction-date"
                type="date"
                className="mt-1 h-9 rounded-xl border-white/10 bg-slate-950/60 text-white text-xs"
                value={dateEdit?.date ?? ""}
                onChange={(e) => dateEdit && setDateEdit({ ...dateEdit, date: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-transaction-date-reason" className="text-xs text-slate-300">Reason for correction (required)</Label>
              <Input
                id="edit-transaction-date-reason"
                className="mt-1 h-9 rounded-xl border-white/10 bg-slate-950/60 text-white text-xs placeholder:text-slate-500"
                maxLength={300}
                value={dateEdit?.reason ?? ""}
                onChange={(e) => dateEdit && setDateEdit({ ...dateEdit, reason: e.target.value })}
                placeholder="e.g. Corrected value date from customer statement"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={dateMutation.isPending} className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={dateMutation.isPending || !dateEdit || !isValidTransactionDate(dateEdit.date) || dateEdit.reason.trim().length < 3}
              onClick={(e) => { e.preventDefault(); if (dateEdit) dateMutation.mutate(dateEdit); }}
              className="rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium text-xs"
            >
              {dateMutation.isPending ? "Saving…" : "Save Date"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={rev !== null} onOpenChange={(o) => { if (!o && !rm.isPending) setRev(null); }}>
        <AlertDialogContent className="rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-2xl text-slate-100 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Reverse transaction {rev?.id.slice(0, 8)}?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-300">
              A new opposite transaction will be recorded and linked in the ledger. The original stays marked REVERSED.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div>
            <Label className="text-xs text-slate-300">Reason for reversal (required)</Label>
            <Input
              className="mt-1 h-9 rounded-xl border-white/10 bg-slate-950/60 backdrop-blur-md text-white text-xs placeholder:text-slate-500"
              maxLength={300}
              value={rev?.reason ?? ""}
              onChange={(e) => rev && setRev({ ...rev, reason: e.target.value })}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rm.isPending} className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={rm.isPending || (rev?.reason.trim().length ?? 0) < 3}
              onClick={(e) => { e.preventDefault(); if (rev) rm.mutate(rev); }}
              className="rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs"
            >
              {rm.isPending ? "Reversing…" : "Reverse Transaction"}
            </AlertDialogAction>
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

type TransferRequest = {
  id: string; txn_id: string; transfer_kind: string; sender_user_id: string;
  recipient_user_id: string | null; recipient_name: string; recipient_account_number: string | null;
  amount: number; currency: string; memo: string | null; status: string;
  reviewed_by: string | null; review_reason: string | null; created_at: string;
};

export function TransferReview({ emailOf }: { emailOf: (id: string) => string }) {
  const list = useServerFn(listTransferRequests);
  const review = useServerFn(reviewTransferRequest);
  const refresh = useRefresh();
  const requests = useQuery({ queryKey: ["admin-transfer-requests"], queryFn: () => list() });
  const [target, setTarget] = useState<{ req: TransferRequest; action: "approve" | "cancel"; reason: string } | null>(null);

  const m = useMutation({
    mutationFn: async (t: { req: TransferRequest; action: "approve" | "cancel"; reason: string }) => {
      await review({ data: { requestId: t.req.id, action: t.action, reason: t.reason, idempotencyKey: newKey() } });
    },
    onSuccess: (_, vars) => {
      toast.success(vars.action === "approve" ? "Transfer approved and released." : "Transfer declined and refunded.");
      setTarget(null);
      refresh();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const pendingCount = (requests.data ?? []).filter((r) => r.status === "PENDING").length;
  const badge = (s: string) =>
    s === "PENDING" ? <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-300">Pending</Badge>
    : s === "COMPLETED" ? <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300">Approved</Badge>
    : <Badge variant="outline" className="border-rose-500/40 bg-rose-500/10 text-rose-300">Declined</Badge>;

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl shadow-xl overflow-hidden">
      <div className="border-b border-white/10 p-5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-white font-display flex items-center gap-2">
            Pending Customer Transfers &amp; Payments
            {pendingCount > 0 && (
              <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-300 text-xs">
                {pendingCount} pending
              </Badge>
            )}
          </h3>
          <p className="text-xs text-slate-400">All customer domestic transfers and bill payments arrive pending. Approving releases funds to the recipient; declining refunds the sender in full.</p>
        </div>
      </div>
      {requests.isLoading && <p className="p-5 text-xs text-slate-400">Loading customer transfer requests…</p>}
      {requests.data?.length === 0 && <p className="p-5 text-xs text-slate-400">No customer transfer requests yet.</p>}
      <ul className="divide-y divide-white/5">
        {requests.data?.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-5 hover:bg-white/5 transition-colors">
            <div className="min-w-0">
              <div className="font-semibold text-white flex flex-wrap items-center gap-2">
                <span>{fmt(Number(r.amount), r.currency)} → {r.recipient_name}</span>
                <Badge variant="outline" className="border-white/15 bg-white/5 text-slate-300 text-[10px]">
                  {r.transfer_kind === "DOMESTIC" ? "Domestic Transfer" : "Bill Payment"}
                </Badge>
                {badge(r.status)}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                From {emailOf(r.sender_user_id)}
                {r.recipient_account_number ? ` · To Acct ${formatAccountNumber(r.recipient_account_number)}` : ""}
                {r.recipient_user_id ? ` (${emailOf(r.recipient_user_id)})` : ""}
                {" · "}{new Date(r.created_at).toLocaleString()}
                {r.memo ? ` · Note: ${r.memo}` : ""}
                {r.review_reason ? ` · Review: ${r.review_reason}` : ""}
              </p>
            </div>
            {r.status === "PENDING" && (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setTarget({ req: r, action: "approve", reason: "" })} className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold">
                  Approve Transfer
                </Button>
                <Button size="sm" variant="outline" onClick={() => setTarget({ req: r, action: "cancel", reason: "" })} className="rounded-xl border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 text-xs font-semibold">
                  Decline &amp; Refund
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <AlertDialog open={target !== null} onOpenChange={(o) => { if (!o && !m.isPending) setTarget(null); }}>
        <AlertDialogContent className="rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-2xl text-slate-100 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              {target?.action === "approve" ? "Approve and release this transfer?" : "Decline and refund this transfer?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-300">
              {target?.action === "approve"
                ? target.req.transfer_kind === "DOMESTIC"
                  ? "This will mark the sender's debit as completed and credit the recipient's checking account immediately."
                  : "This will mark the bill payment as completed."
                : "This will decline the request and immediately refund the full amount back to the sender's account."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div>
            <Label className="text-xs text-slate-300">Audit reason (required)</Label>
            <Input
              className="mt-1 h-9 rounded-xl border-white/10 bg-slate-950/60 backdrop-blur-md text-white text-xs placeholder:text-slate-500"
              maxLength={200}
              value={target?.reason ?? ""}
              onChange={(e) => target && setTarget({ ...target, reason: e.target.value })}
              placeholder="e.g. Verified sender and recipient details"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={m.isPending} className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={m.isPending || (target?.reason.trim().length ?? 0) < 3}
              onClick={(e) => { e.preventDefault(); if (target) m.mutate(target); }}
              className={`rounded-xl text-xs font-semibold ${target?.action === "approve" ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-rose-600 hover:bg-rose-500 text-white"}`}
            >
              {m.isPending ? "Processing…" : target?.action === "approve" ? "Confirm Approval" : "Confirm Decline & Refund"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

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
    s === "PENDING" ? <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-300">Pending</Badge>
    : s === "COMPLETED" ? <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300">Completed</Badge>
    : <Badge variant="outline" className="border-rose-500/40 bg-rose-500/10 text-rose-300">Cancelled</Badge>;

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl shadow-xl overflow-hidden">
      <div className="border-b border-white/10 p-5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-white font-display">International Wire Authorizations</h3>
          <p className="text-xs text-slate-400">Review pending cross-border wires. Releasing dispatches funds; cancelling refunds customer in full.</p>
        </div>
      </div>
      {wires.isLoading && <p className="p-5 text-xs text-slate-400">Loading pending wires…</p>}
      {wires.data?.length === 0 && <p className="p-5 text-xs text-slate-400">No wire transfers currently pending.</p>}
      <ul className="divide-y divide-white/5">
        {wires.data?.map((w) => (
          <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 p-5 hover:bg-white/5 transition-colors">
            <div className="min-w-0">
              <div className="font-semibold text-white flex flex-wrap items-center gap-2"><span>{fmt(Number(w.amount))} → {w.recipient_name} ({w.country})</span> {badge(w.status)}</div>
              <p className="text-xs text-slate-400 mt-0.5">
                {emailOf(w.user_id)} · {w.recipient_bank} · SWIFT {w.swift_bic} · Acct {w.account_number} · Receives {w.currency} · {new Date(w.created_at).toLocaleString()}
                {w.memo ? ` · Memo: ${w.memo}` : ""}
              </p>
            </div>
            {w.status === "PENDING" && (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setTarget({ wire: w, action: "complete", reason: "" })} className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold">
                  Release Wire
                </Button>
                <Button size="sm" variant="outline" onClick={() => setTarget({ wire: w, action: "cancel", reason: "" })} className="rounded-xl border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 text-xs font-semibold">
                  Cancel &amp; Refund
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <AlertDialog open={target !== null} onOpenChange={(o) => { if (!o && !m.isPending) setTarget(null); }}>
        <AlertDialogContent className="rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-2xl text-slate-100 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">{target?.action === "complete" ? "Release this international wire?" : "Cancel and refund this wire?"}</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-300">
              {target?.action === "complete" ? "This will mark the wire as processed and complete." : "This will immediately reverse the debit and credit back the customer's account."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div>
            <Label className="text-xs text-slate-300">Audit reason (required)</Label>
            <Input
              className="mt-1 h-9 rounded-xl border-white/10 bg-slate-950/60 backdrop-blur-md text-white text-xs placeholder:text-slate-500"
              maxLength={200}
              value={target?.reason ?? ""}
              onChange={(e) => target && setTarget({ ...target, reason: e.target.value })}
              placeholder="e.g. Verified by officer, requested by sender"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={m.isPending} className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={m.isPending || (target?.reason.trim().length ?? 0) < 3}
              onClick={(e) => { e.preventDefault(); if (target) m.mutate(target); }}
              className={`rounded-xl text-xs font-semibold ${target?.action === "complete" ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-rose-600 hover:bg-rose-500 text-white"}`}
            >
              {m.isPending ? "Processing…" : target?.action === "complete" ? "Confirm Release" : "Confirm Cancellation"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
