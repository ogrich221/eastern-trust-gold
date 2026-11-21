import { useMemo } from "react";
import { Download, FileSpreadsheet, TrendingUp, Users, Wallet, CreditCard, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface CustomerReportData {
  id: string;
  email: string;
  created_at: string;
  confirmed: boolean;
  banned: boolean;
  is_admin: boolean;
  profile: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    city?: string;
  } | null;
  accounts: Array<{
    id: string;
    account_type: string;
    name: string;
    available_balance: number;
    current_balance: number;
    credit_limit: number | null;
  }>;
}

interface AuditRow {
  id: string;
  created_at: string;
  admin_id: string;
  action: string;
  target_user_id: string | null;
  details: string;
}

interface AdminReportsProps {
  customers: CustomerReportData[];
  auditLogs: AuditRow[];
  emailOf: (id: string | null) => string;
}

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

function downloadCSV(filename: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function AdminReports({ customers, auditLogs, emailOf }: AdminReportsProps) {
  // Aggregate account statistics
  const stats = useMemo(() => {
    let checkingCount = 0, checkingBal = 0;
    let savingsCount = 0, savingsBal = 0;
    let creditCount = 0, creditBal = 0, creditLimitTotal = 0;
    let investmentCount = 0, investmentBal = 0;

    customers.forEach((c) => {
      c.accounts.forEach((a) => {
        const bal = Number(a.available_balance || 0);
        const cur = Number(a.current_balance || 0);
        if (a.account_type === "checking") {
          checkingCount++;
          checkingBal += bal;
        } else if (a.account_type === "savings") {
          savingsCount++;
          savingsBal += bal;
        } else if (a.account_type === "credit") {
          creditCount++;
          creditBal += cur;
          creditLimitTotal += Number(a.credit_limit || 0);
        } else if (a.account_type === "investment") {
          investmentCount++;
          investmentBal += cur;
        }
      });
    });

    const totalLiquidDeposits = checkingBal;
    const totalAssets = checkingBal;

    return {
      checkingCount, checkingBal,
      savingsCount, savingsBal,
      creditCount, creditBal, creditLimitTotal,
      investmentCount, investmentBal,
      totalLiquidDeposits,
      totalAssets,
    };
  }, [customers]);

  const exportCustomers = () => {
    const headers = ["Customer ID", "Email", "First Name", "Last Name", "Phone", "City", "Status", "Total Balance"];
    const rows = customers.map((c) => {
      const fn = c.profile?.first_name || "";
      const ln = c.profile?.last_name || "";
      const phone = c.profile?.phone || "";
      const city = c.profile?.city || "";
      const status = c.banned ? "Suspended" : c.is_admin ? "Admin" : "Active";
      const totalBal = c.accounts.reduce((s, a) => s + (a.account_type === "credit" ? -a.current_balance : a.available_balance), 0);
      return [
        `"${c.id}"`,
        `"${c.email}"`,
        `"${fn}"`,
        `"${ln}"`,
        `"${phone}"`,
        `"${city}"`,
        `"${status}"`,
        totalBal.toFixed(2),
      ].join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");
    downloadCSV(`eastern-trust-customers-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast.success("Customer Report CSV downloaded");
  };

  const exportAuditLog = () => {
    const headers = ["Timestamp", "Admin", "Action", "Target Customer", "Details"];
    const rows = auditLogs.map((log) => {
      let adminName = "System";
      try {
        const d = JSON.parse(log.details);
        if (d.by) adminName = d.by;
      } catch {}
      return [
        `"${new Date(log.created_at).toLocaleString()}"`,
        `"${adminName}"`,
        `"${log.action.replace(/_/g, " ")}"`,
        `"${emailOf(log.target_user_id)}"`,
        `"${log.details.replace(/"/g, '""')}"`,
      ].join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");
    downloadCSV(`eastern-trust-audit-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast.success("Audit Log CSV downloaded");
  };

  return (
    <div className="space-y-8">
      {/* Report Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl p-5 shadow-xl relative overflow-hidden group hover:border-amber-500/40 transition-all duration-300">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Liquid Deposits</span>
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Wallet className="size-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-amber-400 font-display">{fmt(stats.totalLiquidDeposits)}</p>
          <p className="mt-1 text-xs text-slate-400">{stats.checkingCount} Everyday Checking accounts</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl p-5 shadow-xl relative overflow-hidden group hover:border-emerald-500/40 transition-all duration-300">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Assets Under Management</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <TrendingUp className="size-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-emerald-400 font-display">{fmt(stats.totalAssets)}</p>
          <p className="mt-1 text-xs text-slate-400">Everyday Checking liquid assets</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl p-5 shadow-xl relative overflow-hidden group hover:border-amber-500/40 transition-all duration-300">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Credit Extended / Drawn</span>
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <CreditCard className="size-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-white font-display">{fmt(stats.creditBal)}</p>
          <p className="mt-1 text-xs text-slate-400">Limit capacity: {fmt(stats.creditLimitTotal)}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl p-5 shadow-xl relative overflow-hidden group hover:border-amber-500/40 transition-all duration-300">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Registered Customers</span>
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Users className="size-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-white font-display">{customers.length}</p>
          <p className="mt-1 text-xs text-slate-400">Active banking members</p>
        </div>
      </div>

      {/* Account Type Portfolio Breakdown */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl p-6 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white font-display">Deposit &amp; Lending Portfolio Breakdown</h2>
            <p className="text-xs text-slate-400">Aggregate balance distribution across product tiers.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCustomers} className="text-xs rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-slate-200">
              <Download className="mr-1.5 size-3.5" /> Export Customers (CSV)
            </Button>
            <Button variant="outline" size="sm" onClick={exportAuditLog} className="text-xs rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-slate-200">
              <FileSpreadsheet className="mr-1.5 size-3.5" /> Export Audit Trail (CSV)
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 text-xs text-slate-400">
              <tr>
                <th className="py-3 px-4">Account Category</th>
                <th className="py-3 px-4">Active Accounts</th>
                <th className="py-3 px-4">Aggregate Balance</th>
                <th className="py-3 px-4">Average per Account</th>
                <th className="py-3 px-4">Portfolio Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-200">
              <tr className="hover:bg-white/5 transition-colors">
                <td className="py-3.5 px-4 font-medium flex items-center gap-2 text-white">
                  <span className="size-2 rounded-full bg-amber-400" /> Everyday Checking
                </td>
                <td className="py-3.5 px-4">{stats.checkingCount}</td>
                <td className="py-3.5 px-4 font-semibold text-amber-300">{fmt(stats.checkingBal)}</td>
                <td className="py-3.5 px-4 text-slate-400">{fmt(stats.checkingCount ? stats.checkingBal / stats.checkingCount : 0)}</td>
                <td className="py-3.5 px-4 text-slate-400">{stats.totalAssets ? ((stats.checkingBal / stats.totalAssets) * 100).toFixed(1) : 0}%</td>
              </tr>
              <tr className="hover:bg-white/5 transition-colors">
                <td className="py-3.5 px-4 font-medium flex items-center gap-2 text-white">
                  <span className="size-2 rounded-full bg-[#F7931A]" /> Bitcoin (BTC) Vault Custody
                </td>
                <td className="py-3.5 px-4">{customers.length}</td>
                <td className="py-3.5 px-4 font-semibold text-white">{fmt(customers.length * 2710.74)}</td>
                <td className="py-3.5 px-4 text-slate-400">{fmt(2710.74)}</td>
                <td className="py-3.5 px-4 text-slate-400">Digital Assets</td>
              </tr>
              <tr className="hover:bg-white/5 transition-colors">
                <td className="py-3.5 px-4 font-medium flex items-center gap-2 text-white">
                  <span className="size-2 rounded-full bg-amber-400" /> Gold Rewards Credit
                </td>
                <td className="py-3.5 px-4">{stats.creditCount}</td>
                <td className="py-3.5 px-4 font-semibold text-white">{fmt(stats.creditBal)}</td>
                <td className="py-3.5 px-4 text-slate-400">{fmt(stats.creditCount ? stats.creditBal / stats.creditCount : 0)}</td>
                <td className="py-3.5 px-4 text-slate-400">Credit Line</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
