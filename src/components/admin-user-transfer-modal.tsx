import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { adminTransferBetweenUsers } from "@/lib/admin.functions";
import { cleanAccountNumber, formatAccountNumber, isValidAccountNumber } from "@/lib/account-number";
import { currentTransactionDate, isValidTransactionDate } from "@/lib/transaction-date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type AdminTransferCustomer = {
  id: string;
  email: string;
  profile: { first_name: string; last_name: string } | null;
  accounts: {
    id: string;
    name: string;
    last_four: string;
    account_number?: string | null;
    available_balance: number;
    currency: string;
  }[];
};

const money = (n: number, c = "USD") => n.toLocaleString("en-US", { style: "currency", currency: c });
const customerLabel = (c: AdminTransferCustomer) => {
  const n = c.profile ? `${c.profile.first_name} ${c.profile.last_name}`.trim() : "";
  return n || c.email;
};

export function AdminUserTransferModal({
  open,
  onOpenChange,
  customers,
  initialSenderId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: AdminTransferCustomer[];
  initialSenderId?: string | null;
}) {
  const qc = useQueryClient();
  const runTransfer = useServerFn(adminTransferBetweenUsers);
  const activeCustomers = customers.filter((c) => c.accounts.length > 0);

  const [senderId, setSenderId] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientAcct, setRecipientAcct] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [transactionDate, setTransactionDate] = useState(currentTransactionDate);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const firstSender = (initialSenderId && activeCustomers.find((c) => c.id === initialSenderId)?.id) || activeCustomers[0]?.id || "";
    setSenderId(firstSender);
    setRecipientId("");
    setRecipientName("");
    setRecipientAcct("");
    setAmount("");
    setMemo("");
    setTransactionDate(currentTransactionDate());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialSenderId]);

  const sender = activeCustomers.find((c) => c.id === senderId);
  const senderAcct = sender?.accounts[0];
  const cleanAcct = cleanAccountNumber(recipientAcct);
  const matchedRecipient = activeCustomers.find((c) => c.accounts[0]?.account_number && cleanAccountNumber(c.accounts[0].account_number) === cleanAcct);
  const numAmount = Number(amount.replace(/,/g, "").trim()) || 0;

  const selectRecipientCustomer = (id: string) => {
    setRecipientId(id);
    const picked = activeCustomers.find((c) => c.id === id);
    if (picked) {
      setRecipientName(customerLabel(picked));
      setRecipientAcct(picked.accounts[0]?.account_number || "");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderAcct) { toast.error("Select a sender with an active checking account."); return; }
    if (recipientName.trim().length < 2) { toast.error("Enter the recipient's full name."); return; }
    if (!isValidAccountNumber(recipientAcct)) { toast.error("Enter a valid recipient account number."); return; }
    if (!(numAmount > 0)) { toast.error("Enter an amount above zero."); return; }
    if (!isValidTransactionDate(transactionDate)) { toast.error("Choose a valid transaction date."); return; }
    setBusy(true);
    try {
      await runTransfer({
        data: {
          fromAccountId: senderAcct.id,
          toAccountNumber: cleanAcct,
          recipientName: recipientName.trim(),
          amount: numAmount.toFixed(2),
          memo: memo.trim(),
          transactionDate,
          idempotencyKey: crypto.randomUUID(),
        },
      });
      toast.success(`Transferred ${money(numAmount, senderAcct.currency)} from ${customerLabel(sender!)} to ${recipientName.trim()}.`);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin-customers"] }),
        qc.invalidateQueries({ queryKey: ["admin-txns"] }),
        qc.invalidateQueries({ queryKey: ["admin-audit"] }),
      ]);
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Transfer failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto border-white/10 bg-slate-900 text-slate-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white font-display">
            <ArrowLeftRight className="size-4 text-amber-400" /> User-to-User Transfer
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400">
            Transfer funds directly between two customers&apos; active checking accounts. Both histories update immediately.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="admin-xfer-from" className="text-xs text-slate-300">From customer</Label>
            <select
              id="admin-xfer-from"
              value={senderId}
              onChange={(e) => setSenderId(e.target.value)}
              className="mt-1 h-9 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 text-xs text-white"
            >
              {activeCustomers.map((c) => (
                <option key={c.id} value={c.id} className="bg-slate-900">
                  {customerLabel(c)} — Acct {formatAccountNumber(c.accounts[0]?.account_number, c.accounts[0]?.last_four)} ({money(c.accounts[0]?.available_balance ?? 0)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="admin-xfer-pick" className="text-xs text-slate-300">Quick-pick recipient customer</Label>
            <select
              id="admin-xfer-pick"
              value={recipientId}
              onChange={(e) => selectRecipientCustomer(e.target.value)}
              className="mt-1 h-9 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 text-xs text-white"
            >
              <option value="" className="bg-slate-900">Choose customer or enter account number below…</option>
              {activeCustomers.filter((c) => c.id !== senderId).map((c) => (
                <option key={c.id} value={c.id} className="bg-slate-900">
                  {customerLabel(c)} — Acct {formatAccountNumber(c.accounts[0]?.account_number, c.accounts[0]?.last_four)} ({money(c.accounts[0]?.available_balance ?? 0)})
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="admin-xfer-name" className="text-xs text-slate-300">Recipient full name</Label>
              <Input id="admin-xfer-name" required value={recipientName} onChange={(e) => setRecipientName(e.target.value)} className="mt-1 h-9 border-white/10 bg-slate-950/60 text-xs text-white" placeholder="Recipient name" />
            </div>
            <div>
              <Label htmlFor="admin-xfer-acct" className="text-xs text-slate-300">Recipient account number</Label>
              <Input id="admin-xfer-acct" required value={recipientAcct} onChange={(e) => { setRecipientAcct(e.target.value); setRecipientId(""); }} className="mt-1 h-9 border-white/10 bg-slate-950/60 font-mono text-xs text-white" placeholder="8204 1001 4617" />
            </div>
          </div>
          {cleanAcct.length >= 8 && (
            <p className={`text-xs ${matchedRecipient ? "text-emerald-400" : "text-amber-400"}`}>
              {matchedRecipient ? `Matched account: ${customerLabel(matchedRecipient)} (${formatAccountNumber(matchedRecipient.accounts[0]?.account_number)})` : "No active customer account matches this number yet."}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="admin-xfer-amt" className="text-xs text-slate-300">Amount (USD)</Label>
              <Input id="admin-xfer-amt" required inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 h-9 border-white/10 bg-slate-950/60 text-xs text-white" placeholder="0.00" />
            </div>
            <div>
              <Label htmlFor="admin-xfer-date" className="text-xs text-slate-300">Transaction date</Label>
              <Input id="admin-xfer-date" type="date" required value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} className="mt-1 h-9 border-white/10 bg-slate-950/60 text-xs text-white" />
            </div>
          </div>

          <div>
            <Label htmlFor="admin-xfer-memo" className="text-xs text-slate-300">Note / Reference (optional)</Label>
            <Input id="admin-xfer-memo" maxLength={140} value={memo} onChange={(e) => setMemo(e.target.value)} className="mt-1 h-9 border-white/10 bg-slate-950/60 text-xs text-white" placeholder="e.g. Client settlement" />
          </div>

          {senderAcct && numAmount > 0 && (
            <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3 text-xs space-y-1 text-slate-300">
              <p>Sender after: <strong className={senderAcct.available_balance - numAmount < 0 ? "text-rose-400" : "text-white"}>{money(senderAcct.available_balance - numAmount, senderAcct.currency)}</strong></p>
              {matchedRecipient?.accounts[0] && (
                <p>Recipient after: <strong className="text-emerald-400">{money(matchedRecipient.accounts[0].available_balance + numAmount, matchedRecipient.accounts[0].currency)}</strong></p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy} className="border-white/10 bg-white/5 text-xs">Cancel</Button>
            <Button type="submit" disabled={busy} className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs">
              {busy ? "Transferring…" : "Execute Transfer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}