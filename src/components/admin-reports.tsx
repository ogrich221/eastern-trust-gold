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
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Liquid Deposits</span>
            <Wallet className="size-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-bold text-primary font-display">{fmt(stats.totalLiquidDeposits)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{stats.checkingCount} Everyday Checking accounts</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Assets Under Mgmt</span>
            <TrendingUp className="size-4 text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground font-display">{fmt(stats.totalAssets)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Everyday Checking liquid assets</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Credit Extended / Owed</span>
            <CreditCard className="size-4 text-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground font-display">{fmt(stats.creditBal)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Limit capacity: {fmt(stats.creditLimitTotal)}</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Registered Customers</span>
            <Users className="size-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground font-display">{customers.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">Active banking members</p>
        </div>
      </div>

      {/* Account Type Portfolio Breakdown */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Deposit & Lending Portfolio Breakdown</h2>
            <p className="text-xs text-muted-foreground">Aggregate balance distribution across product tiers.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCustomers} className="text-xs">
              <Download className="mr-1.5 size-3.5" /> Export Customers (CSV)
            </Button>
            <Button variant="outline" size="sm" onClick={exportAuditLog} className="text-xs">
              <FileSpreadsheet className="mr-1.5 size-3.5" /> Export Audit Trail (CSV)
            </Button>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs text-muted-foreground">
              <tr>
                <th className="py-3 px-4">Account Category</th>
                <th className="py-3 px-4">Active Accounts</th>
                <th className="py-3 px-4">Aggregate Balance</th>
                <th className="py-3 px-4">Average per Account</th>
                <th className="py-3 px-4">Portfolio Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="py-3.5 px-4 font-medium flex items-center gap-2">
                  <span className="size-2 rounded-full bg-primary" /> Everyday Checking
                </td>
                <td className="py-3.5 px-4">{stats.checkingCount}</td>
                <td className="py-3.5 px-4 font-semibold">{fmt(stats.checkingBal)}</td>
                <td className="py-3.5 px-4 text-muted-foreground">{fmt(stats.checkingCount ? stats.checkingBal / stats.checkingCount : 0)}</td>
                <td className="py-3.5 px-4 text-muted-foreground">{stats.totalAssets ? ((stats.checkingBal / stats.totalAssets) * 100).toFixed(1) : 0}%</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-medium flex items-center gap-2">
                  <span className="size-2 rounded-full bg-[#F7931A]" /> Bitcoin (BTC) Vault Custody
                </td>
                <td className="py-3.5 px-4">{customers.length}</td>
                <td className="py-3.5 px-4 font-semibold">{fmt(customers.length * 2710.74)}</td>
                <td className="py-3.5 px-4 text-muted-foreground">{fmt(2710.74)}</td>
                <td className="py-3.5 px-4 text-muted-foreground">Digital Assets</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-medium flex items-center gap-2">
                  <span className="size-2 rounded-full bg-amber-400" /> Gold Rewards Credit
                </td>
                <td className="py-3.5 px-4">{stats.creditCount}</td>
                <td className="py-3.5 px-4 font-semibold">{fmt(stats.creditBal)}</td>
                <td className="py-3.5 px-4 text-muted-foreground">{fmt(stats.creditCount ? stats.creditBal / stats.creditCount : 0)}</td>
                <td className="py-3.5 px-4 text-muted-foreground">Credit Line</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
