import { useState, useMemo, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import {
  Landmark,
  CreditCard,
  Bitcoin,
  TrendingUp,
  ArrowDownRight,
  ArrowUpRight,
  QrCode,
  RefreshCw,
  Zap,
  Copy,
  Check,
  Eye,
  EyeOff,
  ShieldCheck,
  Sliders,
  FileText,
  Wallet,
  HandCoins,
  Smartphone,
  Mail,
  MapPin,
  Download,
  ExternalLink,
  Edit3,
  Camera,
  Clock,
  Layers,
  Sparkles,
  Bell,
  LogOut,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CustomerBanking } from "./customer-banking";
import { AvatarModal } from "./avatar-modal";

export type ProfileAccount = {
  id: string;
  account_type: string;
  name: string;
  last_four: string;
  available_balance: number;
  current_balance: number;
  credit_limit: number | null;
  currency?: string;
  allow_overdraft?: boolean;
};

export type ProfileData = {
  first_name?: string;
  last_name?: string;
  phone?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  avatar_url?: string;
  security_question_one?: string;
  security_question_two?: string;
};

interface UserProfileProps {
  user: {
    id: string;
    email?: string;
    user_metadata?: Record<string, any>;
    banned?: boolean;
    banned_until?: string | null;
  };
  initialProfile?: ProfileData | null;
  accounts: ProfileAccount[];
  onRefresh?: () => void;
  isAdminView?: boolean;
  isSuspended?: boolean;
  onStatusChange?: (suspended: boolean) => Promise<void>;
  onSaveContact?: (data: { first_name: string; last_name: string; phone: string; address: string; city: string; postal_code: string }) => Promise<void>;
}

const formatCurrency = (amount: number, currency = "USD") =>
  amount.toLocaleString("en-US", { style: "currency", currency });

const ACCOUNT_TYPE_CONFIG: Record<
  string,
  { label: string; icon: typeof Landmark; fullPrefix: string; description: string }
> = {
  checking: {
    label: "Everyday Checking",
    icon: Landmark,
    fullPrefix: "8204 9182 ",
    description: "Daily spending, debit transactions, and automated direct deposits",
  },
  credit: {
    label: "Gold Rewards Card",
    icon: CreditCard,
    fullPrefix: "5421 9012 ",
    description: "3% Cash back on travel and dining with zero foreign transaction fees",
  },
};

export function UserProfile({
  user,
  initialProfile,
  accounts,
  onRefresh,
  isAdminView = false,
  isSuspended: propIsSuspended,
  onStatusChange,
  onSaveContact,
}: UserProfileProps) {
  const [profile, setProfile] = useState<ProfileData>(initialProfile ?? {});
  const [localSuspended, setLocalSuspended] = useState<boolean | null>(null);

  const isSuspended = useMemo(() => {
    if (localSuspended !== null) return localSuspended;
    if (typeof propIsSuspended === "boolean") return propIsSuspended;
    if ((user as any)?.banned) return true;
    const bu = (user as any)?.banned_until;
    if (bu && new Date(bu) > new Date()) return true;
    if (user.user_metadata?.suspended || user.user_metadata?.status === "suspended") return true;
    if ((user as any)?.app_metadata?.suspended || (user as any)?.app_metadata?.status === "suspended") return true;
    if ((profile as any)?.status === "suspended" || (profile as any)?.is_suspended) return true;
    return false;
  }, [localSuspended, propIsSuspended, user, profile]);

  const handleToggleStatus = async (nextSuspended: boolean) => {
    try {
      if (onStatusChange) {
        await onStatusChange(nextSuspended);
      }
      setLocalSuspended(nextSuspended);
      toast.success(nextSuspended ? "Account status updated to Suspended." : "Account status updated to Active.");
      onRefresh?.();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update account status.");
    }
  };

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [revealedAccounts, setRevealedAccounts] = useState<Record<string, boolean>>({});
  const [hideBalances, setHideBalances] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // Contact info editing modal
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [contactForm, setContactForm] = useState({
    first_name: initialProfile?.first_name ?? "",
    last_name: initialProfile?.last_name ?? "",
    phone: initialProfile?.phone ?? "",
    address: initialProfile?.address ?? "",
    city: initialProfile?.city ?? "",
    postal_code: initialProfile?.postal_code ?? "",
  });
  const [isSavingContact, setIsSavingContact] = useState(false);

  // Avatar customization
  const [avatarUrl, setAvatarUrl] = useState<string>(() => {
    const metaUrl = (user as any)?.user_metadata?.avatar_url;
    if (typeof window !== "undefined") {
      return metaUrl || initialProfile?.avatar_url || localStorage.getItem(`etb_avatar_${user.id}`) || "";
    }
    return metaUrl || initialProfile?.avatar_url || "";
  });
  const [isAvatarDialogOpen, setIsAvatarDialogOpen] = useState(false);

  // Linked cards interactive controls
  const [isCardFrozen, setIsCardFrozen] = useState(false);
  const [isInternationalEnabled, setIsInternationalEnabled] = useState(true);
  const [cardDailyLimit, setCardDailyLimit] = useState(2500);

  // Notifications state
  const [notifications, setNotifications] = useState({
    emailDeposits: true,
    emailWithdrawals: true,
    smsSecurity: true,
    smsTransactions: false,
    monthlyStatements: true,
    irsAlerts: true,
  });

  // Transfer permissions state
  const [transferPermissions, setTransferPermissions] = useState({
    dailyTransferLimit: 10000,
    allowWireTransfers: true,
    allowInternationalWires: false,
    allowOverdraftProtection: true,
  });

  // Simulated Login activity log
  const loginActivity = useMemo(
    () => [
      {
        id: "log-1",
        device: "Chrome / Windows 11",
        ip: "108.162.245.89",
        location: "New York, USA",
        time: "Just now (Current session)",
        status: "Active",
      },
      {
        id: "log-2",
        device: "Safari / iOS 18",
        ip: "172.56.21.14",
        location: "New York, USA",
        time: "Yesterday, 8:42 PM",
        status: "Completed",
      },
      {
        id: "log-3",
        device: "Firefox / macOS",
        ip: "74.125.210.33",
        location: "Boston, USA",
        time: "Sep 28, 2026, 11:15 AM",
        status: "Completed",
      },
    ],
    []
  );

  useEffect(() => {
    if (initialProfile) {
      setProfile(initialProfile);
      setContactForm({
        first_name: initialProfile.first_name ?? "",
        last_name: initialProfile.last_name ?? "",
        phone: initialProfile.phone ?? "",
        address: initialProfile.address ?? "",
        city: initialProfile.city ?? "",
        postal_code: initialProfile.postal_code ?? "",
      });
    }
  }, [initialProfile]);

  const fullName = useMemo(() => {
    const fn = (profile.first_name || "").trim();
    const ln = (profile.last_name || "").trim();
    if (fn || ln) return `${fn} ${ln}`.trim();
    return user.email ? user.email.split("@")[0] : "Account Holder";
  }, [profile, user.email]);

  const initials = useMemo(() => {
    const fn = (profile.first_name || "").trim();
    const ln = (profile.last_name || "").trim();
    if (fn && ln) return `${fn[0]}${ln[0]}`.toUpperCase();
    if (fn) return fn.slice(0, 2).toUpperCase();
    return "ET";
  }, [profile]);

  const copyToClipboard = (text: string, key: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const toggleReveal = (accountId: string) => {
    setRevealedAccounts((prev) => ({ ...prev, [accountId]: !prev[accountId] }));
  };

  const handleSaveContact = async () => {
    setIsSavingContact(true);
    try {
      if (onSaveContact) {
        await onSaveContact(contactForm);
      } else {
        const { error } = await supabase
          .from("profiles")
          .update({
            first_name: contactForm.first_name,
            last_name: contactForm.last_name,
            phone: contactForm.phone,
            address: contactForm.address,
            city: contactForm.city,
            postal_code: contactForm.postal_code,
          })
          .eq("id", user.id);

        if (error) throw error;
      }

      setProfile((prev) => ({ ...prev, ...contactForm }));
      toast.success("Contact details updated successfully");
      setIsEditingContact(false);
      onRefresh?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setIsSavingContact(false);
    }
  };

  const handleAvatarChange = () => {
    setIsAvatarDialogOpen(true);
  };

  // Filter visible accounts (High-Yield Savings & Wealth Portfolio removed per requirements)
  const visibleAccounts = useMemo(
    () => accounts.filter((a) => a.account_type !== "savings" && a.account_type !== "investment"),
    [accounts]
  );

  const totalAssets = useMemo(
    () =>
      visibleAccounts
        .filter((a) => a.account_type === "checking")
        .reduce((sum, a) => sum + (a.current_balance || 0), 0),
    [visibleAccounts]
  );

  const availableCash = useMemo(
    () =>
      visibleAccounts
        .filter((a) => a.account_type === "checking")
        .reduce((sum, a) => sum + (a.available_balance || 0), 0),
    [visibleAccounts]
  );

  const totalCardOwed = useMemo(
    () =>
      visibleAccounts
        .filter((a) => a.account_type === "credit")
        .reduce((sum, a) => sum + (a.current_balance || 0), 0),
    [visibleAccounts]
  );

  const primaryChecking = visibleAccounts.find((a) => a.account_type === "checking") || visibleAccounts[0];

  // Bitcoin (BTC) Trading & Custody State
  const [btcPrice] = useState(64850.0);
  const [btcHoldings, setBtcHoldings] = useState(0);
  const [btcBuyUsd, setBtcBuyUsd] = useState("500");
  const [btcBuying, setBtcBuying] = useState(false);
  const [autoDca, setAutoDca] = useState(false);
  const [dcaFreq, setDcaFreq] = useState("weekly");
  const [dcaAmount, setDcaAmount] = useState("100");
  const [btcTransactions, setBtcTransactions] = useState<any[]>([]);

  const handleBuyBitcoin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const usd = parseFloat(btcBuyUsd.replace(/,/g, ""));
    if (isNaN(usd) || usd <= 0) {
      toast.error("Please enter a valid dollar amount.");
      return;
    }
    const currentAvail = primaryChecking ? primaryChecking.available_balance : 0;
    if (usd > currentAvail) {
      toast.error(`Insufficient checking funds. Available: ${formatCurrency(currentAvail)}`);
      return;
    }

    setBtcBuying(true);
    setTimeout(() => {
      const btcPurchased = usd / btcPrice;
      setBtcHoldings((prev) => prev + btcPurchased);
      if (primaryChecking) {
        primaryChecking.available_balance = Math.max(0, primaryChecking.available_balance - usd);
        primaryChecking.current_balance = Math.max(0, primaryChecking.current_balance - usd);
      }
      const newTx = {
        id: `btc-tx-${Date.now()}`,
        type: "BUY",
        amountBtc: btcPurchased,
        amountUsd: usd,
        price: btcPrice,
        date: "Just now",
        status: "COMPLETED",
        txHash: `bc1q${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 6)}`,
      };
      setBtcTransactions((prev) => [newTx, ...prev]);
      setBtcBuying(false);
      toast.success(
        `Successfully purchased ${btcPurchased.toFixed(8)} BTC for ${formatCurrency(usd)}! Custody settlement complete.`
      );
    }, 850);
  };

  return (
    <div className="space-y-8">
      {/* Dashboard action bar — top right */}
      <div className="flex flex-wrap items-center justify-end gap-2" aria-label="Account actions">
        <Button
          size="sm"
          onClick={() => setActiveTab("bitcoin")}
          className="bg-[#F7931A] text-white hover:bg-[#F7931A]/90 text-xs font-semibold shadow-sm"
        >
          <Bitcoin className="mr-1.5 size-4" /> Buy Bitcoin
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setHideBalances(!hideBalances)}
          className="text-xs"
        >
          {hideBalances ? <Eye className="mr-1.5 size-3.5" /> : <EyeOff className="mr-1.5 size-3.5" />}
          {hideBalances ? "Show Balances" : "Hide Balances"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsAvatarDialogOpen(true)}
          className="text-xs"
        >
          <Camera className="mr-1.5 size-3.5" /> Photo
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsEditingContact(true)}
          className="text-xs"
        >
          <Edit3 className="mr-1.5 size-3.5" /> Edit Profile
        </Button>
        <Button
          size="sm"
          asChild
          className="text-xs bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Link to="/help">
            <Sparkles className="mr-1.5 size-3.5" /> Support & Concierge
          </Link>
        </Button>
        {!isAdminView && (
          <Button
            variant="outline"
            size="sm"
            className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive border-border"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.assign("/auth");
            }}
          >
            <LogOut className="mr-1.5 size-3.5" /> Sign out
          </Button>
        )}
      </div>

      {/* Top Profile Header Card */}
      <section className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-card via-card to-card/60 p-6 md:p-8 shadow-sm">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-5">
            <div className="relative group shrink-0">
              <Avatar className="size-14 border-2 border-primary/40 shadow-inner md:size-16">
                {avatarUrl ? (
                  <AvatarImage src={avatarUrl} alt={fullName} className="object-cover" />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-base font-semibold text-primary md:text-lg">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => setIsAvatarDialogOpen(true)}
                aria-label="Change profile photo"
                title="Change photo"
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <Camera className="size-4" />
              </button>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{fullName}</h1>
                <Badge variant="outline" className="border-primary/40 bg-primary/5 text-primary text-xs font-medium">
                  <ShieldCheck className="mr-1 size-3" /> Premier Account
                </Badge>
                {/* Account Status Badge (Active or Suspended) */}
                {isSuspended ? (
                  <Badge variant="destructive" className="flex items-center gap-1.5 text-xs font-semibold shadow-sm bg-destructive/15 text-destructive border border-destructive/30">
                    <AlertTriangle className="size-3 text-destructive" /> Account: Suspended
                  </Badge>
                ) : (
                  <Badge variant="outline" className="flex items-center gap-1.5 text-xs font-medium border-emerald-500/40 bg-emerald-500/10 text-emerald-400">
                    <span className="size-2 rounded-full bg-emerald-400" /> Account: Active
                  </Badge>
                )}
                {isAdminView && onStatusChange && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => handleToggleStatus(!isSuspended)}
                    className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground underline"
                  >
                    Set to {isSuspended ? "Active" : "Suspended"}
                  </Button>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{user.email || "No email linked"}</p>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5 font-medium">
                  <span className={`inline-block size-2 rounded-full ${isSuspended ? "bg-destructive animate-pulse" : "bg-emerald-400"}`} />
                  Account Status: <strong className={isSuspended ? "text-destructive" : "text-emerald-400"}>{isSuspended ? "Suspended" : "Active / Good Standing"}</strong>
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5 text-primary" />
                  {profile.city ? `${profile.city}, USA` : "Eastern Trust Client"}
                </span>
                <span className="font-mono text-muted-foreground/80">
                  ID: ETB-{user.id.slice(0, 8).toUpperCase()}
                </span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Account Warning Notification Banner if Suspended */}
      {isSuspended && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-destructive shadow-sm">
          <AlertTriangle className="size-5 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-semibold text-sm">Account Notice: Account Suspended</p>
            <p className="text-muted-foreground">
              This banking account is currently marked as suspended. Outgoing wire transfers, debits, and new card transactions may be restricted. Please reach out to our 24/7 Client Concierge for assistance.
            </p>
          </div>
        </div>
      )}

      {/* Financial Snapshot Summary Ribbon */}
      <section aria-label="Balance summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total Balance
            </p>
            <button
              type="button"
              onClick={() => setHideBalances(!hideBalances)}
              className="text-muted-foreground hover:text-primary transition-colors p-1 -mr-1 -mt-1 rounded hover:bg-muted/60"
              title={hideBalances ? "Show balance" : "Hide balance"}
              aria-label={hideBalances ? "Show balance" : "Hide balance"}
            >
              {hideBalances ? <EyeOff className="size-4" /> : <Eye className="size-4 text-primary" />}
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <p className="text-2xl font-bold text-primary font-display">
              {hideBalances ? "••••••••" : formatCurrency(totalAssets)}
            </p>
            <button
              type="button"
              onClick={() => setHideBalances(!hideBalances)}
              className="text-muted-foreground hover:text-primary transition-colors p-1 rounded hover:bg-muted/60"
              title={hideBalances ? "Show balance" : "Hide balance"}
              aria-label={hideBalances ? "Show balance" : "Hide balance"}
            >
              {hideBalances ? <EyeOff className="size-4" /> : <Eye className="size-4 text-primary" />}
            </button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Across all your accounts</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Available to Spend
            </p>
            <button
              type="button"
              onClick={() => setHideBalances(!hideBalances)}
              className="text-muted-foreground hover:text-primary transition-colors p-1 -mr-1 -mt-1 rounded hover:bg-muted/60"
              title={hideBalances ? "Show balance" : "Hide balance"}
              aria-label={hideBalances ? "Show balance" : "Hide balance"}
            >
              {hideBalances ? <EyeOff className="size-4" /> : <Eye className="size-4 text-muted-foreground" />}
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <p className="text-2xl font-bold text-foreground font-display">
              {hideBalances ? "••••••••" : formatCurrency(availableCash)}
            </p>
            <button
              type="button"
              onClick={() => setHideBalances(!hideBalances)}
              className="text-muted-foreground hover:text-primary transition-colors p-1 rounded hover:bg-muted/60"
              title={hideBalances ? "Show balance" : "Hide balance"}
              aria-label={hideBalances ? "Show balance" : "Hide balance"}
            >
              {hideBalances ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Immediate spend & transfer funds</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Card Balance / Credit
            </p>
            <button
              type="button"
              onClick={() => setHideBalances(!hideBalances)}
              className="text-muted-foreground hover:text-primary transition-colors p-1 -mr-1 -mt-1 rounded hover:bg-muted/60"
              title={hideBalances ? "Show balance" : "Hide balance"}
              aria-label={hideBalances ? "Show balance" : "Hide balance"}
            >
              {hideBalances ? <EyeOff className="size-4" /> : <Eye className="size-4 text-muted-foreground" />}
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <p className="text-2xl font-bold text-foreground font-display">
              {hideBalances ? "••••••••" : formatCurrency(totalCardOwed)}
            </p>
            <button
              type="button"
              onClick={() => setHideBalances(!hideBalances)}
              className="text-muted-foreground hover:text-primary transition-colors p-1 rounded hover:bg-muted/60"
              title={hideBalances ? "Show balance" : "Hide balance"}
              aria-label={hideBalances ? "Show balance" : "Hide balance"}
            >
              {hideBalances ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Gold Rewards statement owed</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Bitcoin Portfolio
            </p>
            <button
              type="button"
              onClick={() => setHideBalances(!hideBalances)}
              className="text-muted-foreground hover:text-primary transition-colors p-1 -mr-1 -mt-1 rounded hover:bg-muted/60"
              title={hideBalances ? "Show balance" : "Hide balance"}
              aria-label={hideBalances ? "Show balance" : "Hide balance"}
            >
              {hideBalances ? <EyeOff className="size-4" /> : <Eye className="size-4 text-[#F7931A]" />}
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <p className="text-2xl font-bold text-[#F7931A] font-display">
              {hideBalances ? "••••••••" : formatCurrency(btcHoldings * btcPrice)}
            </p>
            <button
              type="button"
              onClick={() => setHideBalances(!hideBalances)}
              className="text-muted-foreground hover:text-primary transition-colors p-1 rounded hover:bg-muted/60"
              title={hideBalances ? "Show balance" : "Hide balance"}
              aria-label={hideBalances ? "Show balance" : "Hide balance"}
            >
              {hideBalances ? <EyeOff className="size-4" /> : <Eye className="size-4 text-[#F7931A]" />}
            </button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{btcHoldings.toFixed(4)} BTC in Custody</p>
        </div>
      </section>

      {/* Main Tabbed Profile Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="border-b border-border">
          <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-none bg-transparent p-0 pb-px">
            <TabsTrigger
              value="overview"
              className="rounded-t-lg border-b-2 border-transparent px-4 py-3 text-sm font-medium data-[state=active]:border-primary data-[state=active]:bg-card data-[state=active]:text-foreground"
            >
              <Landmark className="mr-2 size-4" /> Overview & Accounts
            </TabsTrigger>
            <TabsTrigger
              value="bitcoin"
              className="rounded-t-lg border-b-2 border-transparent px-4 py-3 text-sm font-medium data-[state=active]:border-[#F7931A] data-[state=active]:bg-card data-[state=active]:text-[#F7931A]"
            >
              <Bitcoin className="mr-2 size-4 text-[#F7931A]" /> Buy Bitcoin (BTC)
            </TabsTrigger>
            <TabsTrigger
              value="transactions"
              className="rounded-t-lg border-b-2 border-transparent px-4 py-3 text-sm font-medium data-[state=active]:border-primary data-[state=active]:bg-card data-[state=active]:text-foreground"
            >
              <Clock className="mr-2 size-4" /> Transactions
            </TabsTrigger>
            <TabsTrigger
              value="cards"
              className="rounded-t-lg border-b-2 border-transparent px-4 py-3 text-sm font-medium data-[state=active]:border-primary data-[state=active]:bg-card data-[state=active]:text-foreground"
            >
              <CreditCard className="mr-2 size-4" /> Linked Cards
            </TabsTrigger>
            <TabsTrigger
              value="services"
              className="rounded-t-lg border-b-2 border-transparent px-4 py-3 text-sm font-medium data-[state=active]:border-primary data-[state=active]:bg-card data-[state=active]:text-foreground"
            >
              <Layers className="mr-2 size-4" /> Loans, Grants & IRS
            </TabsTrigger>
            <TabsTrigger
              value="security"
              className="rounded-t-lg border-b-2 border-transparent px-4 py-3 text-sm font-medium data-[state=active]:border-primary data-[state=active]:bg-card data-[state=active]:text-foreground"
            >
              <ShieldCheck className="mr-2 size-4" /> Security & Activity
            </TabsTrigger>
            <TabsTrigger
              value="permissions"
              className="rounded-t-lg border-b-2 border-transparent px-4 py-3 text-sm font-medium data-[state=active]:border-primary data-[state=active]:bg-card data-[state=active]:text-foreground"
            >
              <Sliders className="mr-2 size-4" /> Preferences & Limits
            </TabsTrigger>
          </TabsList>
        </div>

        {/* TAB 1: OVERVIEW & ACCOUNTS */}
        <TabsContent value="overview" className="space-y-8 pt-6">
          {/* Account Numbers and Balances Cards */}
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-tight">Accounts & Balances</h2>
                <p className="text-xs text-muted-foreground">
                  Official routing number: <strong className="text-foreground">021000089</strong> (Eastern Trust Bank NA)
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard("021000089", "routing")}
                className="text-xs text-muted-foreground hover:text-primary"
              >
                {copiedKey === "routing" ? <Check className="mr-1 size-3.5 text-primary" /> : <Copy className="mr-1 size-3.5" />}
                Copy Routing #
              </Button>
            </div>

            <div className="mt-4 grid gap-5 md:grid-cols-2">
              {visibleAccounts.map((a) => {
                const config = ACCOUNT_TYPE_CONFIG[a.account_type] || {
                  label: a.name,
                  icon: Landmark,
                  fullPrefix: "9000 0000 ",
                  description: "Standard deposit account",
                };
                const Icon = config.icon;
                const isRevealed = Boolean(revealedAccounts[a.id]);
                const fullAccountNumber = `${config.fullPrefix}${a.last_four}`;

                return (
                  <article
                    key={a.id}
                    className="group relative flex flex-col justify-between rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/50 hover:shadow-md"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <span className="grid size-11 place-items-center rounded-lg border border-primary/30 bg-primary/5 text-primary">
                            <Icon className="size-5" />
                          </span>
                          <div>
                            <h3 className="font-semibold text-lg text-foreground">{a.name}</h3>
                            <p className="text-xs text-muted-foreground capitalize">{a.account_type} Account</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs capitalize font-normal">
                          {a.account_type}
                        </Badge>
                      </div>

                      {/* Account Number with Reveal and Copy */}
                      <div className="mt-4 flex items-center justify-between rounded-md bg-background/60 p-2.5 border border-border/60">
                        <div className="flex items-center gap-2 font-mono text-xs">
                          <span className="text-muted-foreground">Acct:</span>
                          <span className="font-semibold text-foreground">
                            {isRevealed ? fullAccountNumber : `•••• •••• •••• ${a.last_four}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => toggleReveal(a.id)}
                            className="p-1 text-muted-foreground hover:text-foreground"
                            title={isRevealed ? "Mask account number" : "Reveal full account number"}
                          >
                            {isRevealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(fullAccountNumber.replace(/\s/g, ""), `acct-${a.id}`)}
                            className="p-1 text-muted-foreground hover:text-foreground"
                            title="Copy account number"
                          >
                            {copiedKey === `acct-${a.id}` ? (
                              <Check className="size-3.5 text-primary" />
                            ) : (
                              <Copy className="size-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Balances Display */}
                      <div className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-4">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-medium text-muted-foreground">
                              {a.account_type === "credit" ? "Available Credit" : "Available Funds"}
                            </p>
                            <button
                              type="button"
                              onClick={() => setHideBalances(!hideBalances)}
                              className="text-muted-foreground hover:text-primary transition-colors p-0.5 rounded hover:bg-muted/50"
                              title={hideBalances ? "Show balance" : "Hide balance"}
                              aria-label={hideBalances ? "Show balance" : "Hide balance"}
                            >
                              {hideBalances ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                            </button>
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <p className="text-xl font-bold text-foreground">
                              {hideBalances ? "••••••" : formatCurrency(a.available_balance, a.currency)}
                            </p>
                            <button
                              type="button"
                              onClick={() => setHideBalances(!hideBalances)}
                              className="text-muted-foreground hover:text-primary transition-colors p-0.5 rounded hover:bg-muted/50"
                              title={hideBalances ? "Show balance" : "Hide balance"}
                              aria-label={hideBalances ? "Show balance" : "Hide balance"}
                            >
                              {hideBalances ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                            </button>
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-medium text-muted-foreground">
                              {a.account_type === "credit"
                                ? "Current Balance Owed"
                                : "Current Balance"}
                            </p>
                            <button
                              type="button"
                              onClick={() => setHideBalances(!hideBalances)}
                              className="text-muted-foreground hover:text-primary transition-colors p-0.5 rounded hover:bg-muted/50"
                              title={hideBalances ? "Show balance" : "Hide balance"}
                              aria-label={hideBalances ? "Show balance" : "Hide balance"}
                            >
                              {hideBalances ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                            </button>
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <p className="text-xl font-semibold text-muted-foreground">
                              {hideBalances ? "••••••" : formatCurrency(a.current_balance, a.currency)}
                            </p>
                            <button
                              type="button"
                              onClick={() => setHideBalances(!hideBalances)}
                              className="text-muted-foreground hover:text-primary transition-colors p-0.5 rounded hover:bg-muted/50"
                              title={hideBalances ? "Show balance" : "Hide balance"}
                              aria-label={hideBalances ? "Show balance" : "Hide balance"}
                            >
                              {hideBalances ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border/40">
                      <span>
                        {a.credit_limit !== null
                          ? `Limit: ${formatCurrency(a.credit_limit)}`
                          : a.allow_overdraft
                          ? "Overdraft Enabled"
                          : "Standard Protection"}
                      </span>
                      <button
                        onClick={() => setActiveTab("transactions")}
                        className="text-primary hover:underline font-medium inline-flex items-center"
                      >
                        View Statements & History →
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          {/* Customer Banking Move Money Drawer */}
          <div className="border-t border-border pt-8">
            <CustomerBanking
              accounts={visibleAccounts}
              hidden={hideBalances}
              onChange={() => onRefresh?.()}
            />
          </div>
        </TabsContent>

        {/* TAB 2: BUY BITCOIN (BTC) & CRYPTO CUSTODY */}
        <TabsContent value="bitcoin" className="space-y-6 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-full bg-[#F7931A]/20 text-[#F7931A]">
                  <Bitcoin className="size-5" />
                </span>
                <h2 className="text-xl font-bold tracking-tight">Bitcoin Vault & Instant Execution</h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Buy, accumulate, and store physical Bitcoin backed by Eastern Trust institutional cold-storage custody.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-xs py-1">
                <TrendingUp className="mr-1 size-3.5" /> 1 BTC = {formatCurrency(btcPrice)} (+3.15% 24h)
              </Badge>
              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-xs py-1">
                <ShieldCheck className="mr-1 size-3.5" /> Insured Custody
              </Badge>
            </div>
          </div>

          {/* Bitcoin Portfolio Cards */}
          <div className="grid gap-5 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs uppercase tracking-wider font-semibold">Total Bitcoin Holdings</span>
                <Bitcoin className="size-5 text-[#F7931A]" />
              </div>
              <p className="mt-3 text-3xl font-extrabold tracking-tight text-foreground font-mono">
                {hideBalances ? "••••••••" : `${btcHoldings.toFixed(6)} BTC`}
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground flex items-center gap-1">
                <span>Value:</span>
                <strong className="text-foreground">{hideBalances ? "••••••" : formatCurrency(btcHoldings * btcPrice)}</strong>
                <span className="text-emerald-400 font-medium ml-1">+$84.12 24h</span>
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs uppercase tracking-wider font-semibold">Custody Wallet Address</span>
                <QrCode className="size-4 cursor-pointer hover:text-foreground" onClick={() => toast.info("Displaying Custody QR Code for Deposit")} />
              </div>
              <p className="mt-3 font-mono text-xs font-semibold text-foreground truncate bg-background p-2 rounded border border-border">
                bc1q9a7z4m28v0e91f63j8a98f2etb09
              </p>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">SegWit Bech32 • Native BTC</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard("bc1q9a7z4m28v0e91f63j8a98f2etb09", "btc-addr")}
                  className="inline-flex items-center text-primary hover:underline font-medium"
                >
                  {copiedKey === "btc-addr" ? <Check className="mr-1 size-3" /> : <Copy className="mr-1 size-3" />}
                  Copy Address
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs uppercase tracking-wider font-semibold">Automated Accumulation (DCA)</span>
                <RefreshCw className="size-4 text-primary" />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{autoDca ? "Active Accumulator" : "Paused"}</p>
                  <p className="text-xs text-muted-foreground">
                    {autoDca ? `$${dcaAmount} / ${dcaFreq} from Checking` : "Schedule recurring Bitcoin buys"}
                  </p>
                </div>
                <Switch
                  checked={autoDca}
                  onCheckedChange={(val) => {
                    setAutoDca(val);
                    toast.success(val ? "Automated Bitcoin accumulation enabled" : "Automated DCA paused");
                  }}
                />
              </div>
              {autoDca && (
                <div className="mt-2 flex gap-1.5">
                  {(["daily", "weekly", "monthly"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setDcaFreq(f)}
                      className={`text-[10px] px-2 py-0.5 rounded capitalize ${dcaFreq === f ? "bg-primary text-primary-foreground font-semibold" : "bg-muted text-muted-foreground"}`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Interactive Buy Bitcoin Order Terminal */}
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="lg:col-span-3 rounded-xl border border-[#F7931A]/30 bg-gradient-to-b from-card to-card/60 p-6 md:p-8 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Zap className="size-4 text-[#F7931A]" /> Instant Bitcoin Purchase
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Execute market buys settled directly from your Everyday Checking account.
                  </p>
                </div>
                <Badge className="bg-[#F7931A] text-white hover:bg-[#F7931A]/90 text-xs">
                  0% Commission
                </Badge>
              </div>

              <form onSubmit={handleBuyBitcoin} className="space-y-5">
                {/* Funding Account Selector */}
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Paying With</Label>
                  <div className="mt-1.5 flex items-center justify-between rounded-lg border border-border bg-background p-3">
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 place-items-center rounded-md border border-primary/30 bg-primary/10 text-primary">
                        <Landmark className="size-4" />
                      </span>
                      <div>
                        <p className="text-xs font-semibold text-foreground">
                          {primaryChecking?.name || "Everyday Checking"} •••• {primaryChecking?.last_four || "9182"}
                        </p>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                          Available balance: {hideBalances ? "••••••" : formatCurrency(primaryChecking?.available_balance || 0)}
                          <button
                            type="button"
                            onClick={() => setHideBalances(!hideBalances)}
                            className="text-muted-foreground hover:text-primary transition-colors p-0.5"
                            title={hideBalances ? "Show balance" : "Hide balance"}
                          >
                            {hideBalances ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                          </button>
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">
                      Verified
                    </Badge>
                  </div>
                </div>

                {/* Amount Selection */}
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-muted-foreground">Purchase Amount (USD)</Label>
                    <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                      Available: {hideBalances ? "••••••" : formatCurrency(primaryChecking?.available_balance || 0)}
                      <button
                        type="button"
                        onClick={() => setHideBalances(!hideBalances)}
                        className="text-muted-foreground hover:text-primary transition-colors p-0.5"
                        title={hideBalances ? "Show balance" : "Hide balance"}
                      >
                        {hideBalances ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                      </button>
                    </span>
                  </div>
                  <div className="mt-1.5 relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-semibold text-muted-foreground">$</span>
                    <Input
                      type="number"
                      min="1"
                      step="any"
                      value={btcBuyUsd}
                      onChange={(e) => setBtcBuyUsd(e.target.value)}
                      placeholder="0.00"
                      className="pl-8 text-base font-bold h-12"
                    />
                  </div>
                  {/* Preset Pills */}
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {["50", "100", "250", "500", "1000", "2500"].map((amt) => (
                      <Button
                        key={amt}
                        type="button"
                        variant={btcBuyUsd === amt ? "default" : "outline"}
                        size="sm"
                        onClick={() => setBtcBuyUsd(amt)}
                        className={`text-xs h-7 px-3 ${btcBuyUsd === amt ? "bg-[#F7931A] text-white hover:bg-[#F7931A]/90" : ""}`}
                      >
                        ${amt}
                      </Button>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setBtcBuyUsd(String(Math.floor(primaryChecking?.available_balance || 0)))}
                      className="text-xs h-7 px-3 border-dashed"
                    >
                      Max
                    </Button>
                  </div>
                </div>

                {/* Live Conversion Breakdown */}
                <div className="rounded-lg bg-background/60 p-4 border border-border/60 space-y-2.5 text-xs">
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>Target Execution Price</span>
                    <span className="font-mono text-foreground">{formatCurrency(btcPrice)} / BTC</span>
                  </div>
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>Eastern Trust Brokerage Fee</span>
                    <span className="text-emerald-400 font-medium">$0.00 (Waived)</span>
                  </div>
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>Custody & Settlement Fee</span>
                    <span className="text-emerald-400 font-medium">$0.00 (Waived)</span>
                  </div>
                  <div className="border-t border-border pt-2 flex justify-between items-center font-semibold text-foreground">
                    <span>Estimated Bitcoin Received</span>
                    <span className="font-mono text-base text-[#F7931A]">
                      {((parseFloat(btcBuyUsd) || 0) / btcPrice).toFixed(8)} BTC
                    </span>
                  </div>
                </div>

                {/* Submit Buy CTA */}
                <Button
                  type="submit"
                  size="lg"
                  disabled={btcBuying || !(parseFloat(btcBuyUsd) > 0)}
                  className="w-full bg-[#F7931A] text-white hover:bg-[#F7931A]/90 font-bold h-12 text-sm shadow-md"
                >
                  {btcBuying ? (
                    <span className="flex items-center gap-2">
                      <RefreshCw className="size-4 animate-spin" /> Executing Order on Mainnet…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Bitcoin className="size-5" /> Buy {((parseFloat(btcBuyUsd) || 0) / btcPrice).toFixed(6)} BTC Now
                    </span>
                  )}
                </Button>
                <p className="text-[11px] text-center text-muted-foreground">
                  By clicking buy, you authorize an immediate debit from your Everyday Checking account. Cryptocurrencies are held in insured cold-storage.
                </p>
              </form>
            </div>

            {/* Bitcoin Security & Custody Architecture Details */}
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-xl border border-border bg-card p-6 space-y-4">
                <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <ShieldCheck className="size-4 text-primary" /> Institutional Bitcoin Custody
                </h4>
                <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
                  <div className="flex gap-2.5">
                    <span className="size-1.5 rounded-full bg-[#F7931A] mt-1.5 shrink-0" />
                    <p><strong>100% Cold-Storage:</strong> Your Bitcoin private keys are generated in multi-signature offline hardware security modules (HSM).</p>
                  </div>
                  <div className="flex gap-2.5">
                    <span className="size-1.5 rounded-full bg-[#F7931A] mt-1.5 shrink-0" />
                    <p><strong>Direct Integration:</strong> Easily sell or convert Bitcoin back into your checking account funds anytime with zero waiting period.</p>
                  </div>
                  <div className="flex gap-2.5">
                    <span className="size-1.5 rounded-full bg-[#F7931A] mt-1.5 shrink-0" />
                    <p><strong>Tax & IRS Automated Reporting:</strong> All executed orders generate automated Form 8949 and 1099-DA compliant crypto tax logs.</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-6">
                <h4 className="text-sm font-semibold text-foreground mb-3">Market Insights</h4>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between border-b border-border/50 pb-2">
                    <span className="text-muted-foreground">24h High</span>
                    <span className="font-mono text-foreground">$65,210.00</span>
                  </div>
                  <div className="flex justify-between border-b border-border/50 pb-2">
                    <span className="text-muted-foreground">24h Low</span>
                    <span className="font-mono text-foreground">$63,490.00</span>
                  </div>
                  <div className="flex justify-between border-b border-border/50 pb-2">
                    <span className="text-muted-foreground">24h Trading Volume</span>
                    <span className="font-mono text-foreground">$28.4 Billion</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Dominance</span>
                    <span className="font-mono text-foreground">58.2%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bitcoin Transaction Settlement History */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h3 className="text-base font-bold text-foreground mb-4">Bitcoin Order History</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-3 font-medium">Type</th>
                    <th className="pb-3 font-medium">Timestamp</th>
                    <th className="pb-3 font-medium">Bitcoin Amount</th>
                    <th className="pb-3 font-medium">Total Paid</th>
                    <th className="pb-3 font-medium">Execution Price</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium text-right">Blockchain Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {btcTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-muted/30">
                      <td className="py-3 font-bold text-emerald-400 flex items-center gap-1.5">
                        <ArrowDownRight className="size-3.5" /> BUY
                      </td>
                      <td className="py-3 text-muted-foreground">{tx.date}</td>
                      <td className="py-3 font-mono font-bold text-foreground">+{tx.amountBtc.toFixed(6)} BTC</td>
                      <td className="py-3 font-semibold text-foreground">{formatCurrency(tx.amountUsd)}</td>
                      <td className="py-3 font-mono text-muted-foreground">{formatCurrency(tx.price)}</td>
                      <td className="py-3">
                        <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px]">
                          {tx.status}
                        </Badge>
                      </td>
                      <td className="py-3 font-mono text-right text-muted-foreground">{tx.txHash}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: TRANSACTIONS */}
        <TabsContent value="transactions" className="space-y-6 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Transaction History & Statements</h2>
              <p className="text-xs text-muted-foreground">
                Full search, account filtering, and downloadable monthly statements.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  toast.success("Generating formal statement PDF for September 2026...");
                  setTimeout(() => toast.info("Statement downloaded successfully"), 1200);
                }}
                className="text-xs"
              >
                <Download className="mr-1.5 size-3.5" /> Download e-Statement (PDF)
              </Button>
            </div>
          </div>

          {/* Embed the customer banking ledger with full history and filtering */}
          <CustomerBanking
            accounts={accounts}
            hidden={hideBalances}
            onChange={() => onRefresh?.()}
          />
        </TabsContent>

        {/* TAB 3: LINKED CARDS */}
        <TabsContent value="cards" className="space-y-6 pt-6">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Linked Cards & Payment Methods</h2>
            <p className="text-xs text-muted-foreground">
              Manage your physical and virtual cards, security freeze, and contactless payment limits.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Visual Gold Card */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-tr from-amber-950 via-zinc-900 to-amber-900 p-6 text-white shadow-xl border border-amber-600/30">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold tracking-wider text-amber-400 uppercase">
                    Eastern Trust Gold Rewards
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5">Credit Signature Card</p>
                </div>
                <div className="flex size-10 items-center justify-center rounded-lg border border-amber-400/40 bg-amber-400/10 text-amber-300 font-bold">
                  ET
                </div>
              </div>

              <div className="my-8 flex items-center justify-between">
                <div className="h-7 w-10 rounded bg-amber-300/30 border border-amber-300/40" />
                <p className="font-mono text-lg tracking-widest text-zinc-200">
                  •••• •••• •••• 5511
                </p>
              </div>

              <div className="flex items-end justify-between text-xs">
                <div>
                  <p className="text-zinc-400 uppercase text-[10px]">Cardholder</p>
                  <p className="font-medium tracking-wide text-zinc-100">{fullName}</p>
                </div>
                <div>
                  <p className="text-zinc-400 uppercase text-[10px]">Expires</p>
                  <p className="font-mono text-zinc-100">09/29</p>
                </div>
                <div>
                  <Badge
                    variant="outline"
                    className={
                      isCardFrozen
                        ? "border-red-500 bg-red-950/80 text-red-300"
                        : "border-emerald-500 bg-emerald-950/80 text-emerald-300"
                    }
                  >
                    {isCardFrozen ? "Frozen" : "Active"}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Visual Debit Card */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-tr from-zinc-900 via-neutral-900 to-zinc-800 p-6 text-white shadow-xl border border-zinc-700/50">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold tracking-wider text-primary uppercase">
                    Eastern Trust Premier Debit
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5">Linked to {primaryChecking?.name || "Checking"}</p>
                </div>
                <div className="flex size-10 items-center justify-center rounded-lg border border-primary/40 bg-primary/10 text-primary font-bold">
                  ET
                </div>
              </div>

              <div className="my-8 flex items-center justify-between">
                <div className="h-7 w-10 rounded bg-zinc-600/40 border border-zinc-500/50" />
                <p className="font-mono text-lg tracking-widest text-zinc-200">
                  •••• •••• •••• {primaryChecking?.last_four || "1024"}
                </p>
              </div>

              <div className="flex items-end justify-between text-xs">
                <div>
                  <p className="text-zinc-400 uppercase text-[10px]">Cardholder</p>
                  <p className="font-medium tracking-wide text-zinc-100">{fullName}</p>
                </div>
                <div>
                  <p className="text-zinc-400 uppercase text-[10px]">Expires</p>
                  <p className="font-mono text-zinc-100">11/30</p>
                </div>
                <div>
                  <Badge variant="outline" className="border-emerald-500 bg-emerald-950/80 text-emerald-300">
                    Active
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Card Management Controls */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="text-base font-semibold">Card Security & Spending Controls</h3>
            <div className="mt-5 space-y-4 divide-y divide-border">
              <div className="flex items-center justify-between pt-3 first:pt-0">
                <div>
                  <p className="text-sm font-medium">Instant Card Lock / Freeze</p>
                  <p className="text-xs text-muted-foreground">
                    Temporarily block all new transactions on your Gold Rewards card.
                  </p>
                </div>
                <Switch
                  checked={isCardFrozen}
                  onCheckedChange={(val) => {
                    setIsCardFrozen(val);
                    toast(val ? "Card frozen successfully" : "Card unlocked and active");
                  }}
                />
              </div>

              <div className="flex items-center justify-between pt-4">
                <div>
                  <p className="text-sm font-medium">International & Overseas Purchases</p>
                  <p className="text-xs text-muted-foreground">
                    Allow foreign transactions when traveling abroad.
                  </p>
                </div>
                <Switch
                  checked={isInternationalEnabled}
                  onCheckedChange={(val) => {
                    setIsInternationalEnabled(val);
                    toast.success("International permissions updated");
                  }}
                />
              </div>

              <div className="flex items-center justify-between pt-4">
                <div>
                  <p className="text-sm font-medium">Daily Contactless & ATM Limit</p>
                  <p className="text-xs text-muted-foreground">
                    Maximum cash withdrawal and point-of-sale limit:{" "}
                    <strong className="text-foreground">{formatCurrency(cardDailyLimit)}</strong>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      const newLimit = prompt("Enter daily limit (USD):", String(cardDailyLimit));
                      if (newLimit && Number(newLimit) > 0) {
                        setCardDailyLimit(Number(newLimit));
                        toast.success("Daily limit updated");
                      }
                    }}
                  >
                    Adjust Limit
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* TAB 4: LOANS, GRANTS & IRS HUB */}
        <TabsContent value="services" className="space-y-8 pt-6">
          {/* LOANS SECTION */}
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-tight">Active Loans & Mortgages</h2>
                <p className="text-xs text-muted-foreground">
                  View scheduled payoffs, rates, or apply for new financing options.
                </p>
              </div>
              <Button asChild size="sm" variant="outline" className="text-xs">
                <Link to="/loans">
                  <Wallet className="mr-1.5 size-3.5 text-primary" /> View All Loan Products
                </Link>
              </Button>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-base">Fixed Premier Auto Loan</h3>
                    <p className="text-xs text-muted-foreground">Loan #LN-883921 · 48 Months</p>
                  </div>
                  <Badge variant="outline" className="border-primary/40 text-primary text-xs">
                    Current · 4.49% APR
                  </Badge>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Principal Balance</p>
                    <p className="text-lg font-bold text-foreground font-display">$18,450.00</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Next Payment Due</p>
                    <p className="text-lg font-semibold text-foreground">Oct 15, 2026 ($428.10)</p>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => toast.success("Payment of $428.10 scheduled from Everyday Checking")}
                  >
                    Pay Loan
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-dashed border-border bg-card/40 p-5 flex flex-col justify-between">
                <div>
                  <h3 className="font-semibold text-base">Home Mortgage & Personal Financing</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Pre-approved for up to $450,000 at competitive member rates. No prepayment penalties.
                  </p>
                </div>
                <div className="mt-6 flex items-center justify-between pt-3 border-t border-border/40">
                  <span className="text-xs text-muted-foreground">Rates starting at 5.25%</span>
                  <Button asChild size="sm" variant="outline" className="text-xs">
                    <Link to="/loans">Explore & Apply →</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* GRANTS SECTION */}
          <div className="border-t border-border pt-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-tight">Community & Business Grants</h2>
                <p className="text-xs text-muted-foreground">
                  Eastern Trust Bank grant programs supporting small businesses, education, and homeowners.
                </p>
              </div>
              <Button asChild size="sm" variant="outline" className="text-xs">
                <Link to="/grants">
                  <HandCoins className="mr-1.5 size-3.5 text-primary" /> Grant Directory
                </Link>
              </Button>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-md bg-primary/10 text-primary">
                    <HandCoins className="size-4" />
                  </span>
                  <h3 className="font-semibold text-sm">Small Business Innovation Grant</h3>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Up to $25,000 for local enterprises expanding technology, hiring, and operations.
                </p>
                <div className="mt-4 flex items-center justify-between pt-3 border-t border-border text-xs">
                  <Badge variant="outline" className="text-emerald-400 border-emerald-500/40">
                    Eligible
                  </Badge>
                  <Link to="/grants" className="text-primary hover:underline font-medium">
                    Apply Now
                  </Link>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-md bg-primary/10 text-primary">
                    <HandCoins className="size-4" />
                  </span>
                  <h3 className="font-semibold text-sm">First-Time Homebuyer Assistance</h3>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Up to $10,000 in non-repayable down payment assistance for qualified primary residences.
                </p>
                <div className="mt-4 flex items-center justify-between pt-3 border-t border-border text-xs">
                  <Badge variant="outline" className="text-muted-foreground">
                    Pre-qualification Open
                  </Badge>
                  <Link to="/grants" className="text-primary hover:underline font-medium">
                    Check Eligibility
                  </Link>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-md bg-primary/10 text-primary">
                    <HandCoins className="size-4" />
                  </span>
                  <h3 className="font-semibold text-sm">Community Trade Scholarship</h3>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Tuition support for technical and vocational trade certifications.
                </p>
                <div className="mt-4 flex items-center justify-between pt-3 border-t border-border text-xs">
                  <Badge variant="outline" className="text-primary border-primary/40">
                    Annual Review
                  </Badge>
                  <Link to="/grants" className="text-primary hover:underline font-medium">
                    Learn More
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* IRS & TAX HUB */}
          <div className="border-t border-border pt-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-tight">IRS & Tax Services</h2>
                <p className="text-xs text-muted-foreground">
                  Direct deposit refund routing details, 1099 tax forms, and federal payment instructions.
                </p>
              </div>
              <Button asChild size="sm" variant="outline" className="text-xs">
                <Link to="/irs">
                  <FileText className="mr-1.5 size-3.5 text-primary" /> Tax Support Center
                </Link>
              </Button>
            </div>

            <div className="mt-4 grid gap-5 md:grid-cols-2">
              {/* IRS Direct Deposit Routing Box */}
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
                <div className="flex items-center gap-2">
                  <FileText className="size-5 text-primary" />
                  <h3 className="font-semibold text-base text-foreground">
                    IRS Tax Refund Direct Deposit Setup
                  </h3>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Enter these exact numbers on your IRS 1040 form to receive direct deposit up to 5 days faster:
                </p>

                <div className="mt-4 space-y-2 rounded-lg bg-card p-3 border border-border">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Bank Name:</span>
                    <strong className="text-foreground">Eastern Trust Bank NA</strong>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Routing Transit Number (RTN):</span>
                    <div className="flex items-center gap-1 font-mono font-bold text-foreground">
                      <span>021000089</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard("021000089", "irs-routing")}
                        className="text-primary hover:text-primary/80"
                      >
                        {copiedKey === "irs-routing" ? <Check className="size-3" /> : <Copy className="size-3" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Account Number:</span>
                    <div className="flex items-center gap-1 font-mono font-bold text-foreground">
                      <span>82049182{primaryChecking?.last_four || "1024"}</span>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(`82049182${primaryChecking?.last_four || "1024"}`, "irs-acct")
                        }
                        className="text-primary hover:text-primary/80"
                      >
                        {copiedKey === "irs-acct" ? <Check className="size-3" /> : <Copy className="size-3" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Account Type:</span>
                    <strong className="text-foreground">Checking</strong>
                  </div>
                </div>
              </div>

              {/* Tax Statements & Downloads */}
              <div className="rounded-xl border border-border bg-card p-5 flex flex-col justify-between">
                <div>
                  <h3 className="font-semibold text-base">Annual Tax Documents</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Form 1099-INT (Interest Earned) and Form 1098 (Mortgage Interest).
                  </p>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between rounded-md border border-border p-2.5 text-xs">
                      <div>
                        <p className="font-medium text-foreground">2025 Form 1099-INT</p>
                        <p className="text-muted-foreground">Interest Income Statement · PDF</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-primary text-xs"
                        onClick={() => toast.success("Downloading 2025 Form 1099-INT PDF...")}
                      >
                        <Download className="mr-1 size-3" /> Download
                      </Button>
                    </div>
                    <div className="flex items-center justify-between rounded-md border border-border p-2.5 text-xs">
                      <div>
                        <p className="font-medium text-foreground">Estimated Tax Payment Guide</p>
                        <p className="text-muted-foreground">IRS EFTPS electronic filing checklist</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-primary text-xs"
                        onClick={() => toast.info("Opening IRS Electronic Tax Payment Guide")}
                      >
                        <ExternalLink className="mr-1 size-3" /> View
                      </Button>
                    </div>
                  </div>
                </div>
                <p className="mt-4 text-[11px] text-muted-foreground">
                  * Eastern Trust Bank is an FDIC-insured financial institution and is not affiliated with the IRS.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* TAB 5: SECURITY & LOGIN ACTIVITY */}
        <TabsContent value="security" className="space-y-6 pt-6">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Security Settings & Login Activity</h2>
            <p className="text-xs text-muted-foreground">
              Monitor recent sign-ins, manage authentication factors, and review security settings.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Security Summary Card */}
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <h3 className="text-base font-semibold">Account Protections</h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium">Password Protection</p>
                    <p className="text-xs text-muted-foreground">Last updated within 90 days</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      const p = prompt("Enter your new password (minimum 10 characters):");
                      if (p && p.length >= 10) {
                        toast.success("Password changed successfully");
                      } else if (p) {
                        toast.error("Password must be at least 10 characters");
                      }
                    }}
                  >
                    Change
                  </Button>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium">Two-Factor Authentication (2FA)</p>
                    <p className="text-xs text-muted-foreground">SMS verification code on new devices</p>
                  </div>
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-xs">
                    Enabled
                  </Badge>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium">Security Challenge Questions</p>
                    <p className="text-xs text-muted-foreground">2 of 2 questions configured</p>
                  </div>
                  <Badge variant="outline" className="text-primary border-primary/30 text-xs">
                    Active
                  </Badge>
                </div>
              </div>
            </div>

            {/* Contact Details Card */}
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">Verified Contact Info</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-primary"
                  onClick={() => setIsEditingContact(true)}
                >
                  <Edit3 className="mr-1 size-3.5" /> Edit
                </Button>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <Mail className="size-4 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Primary Login Email</p>
                    <p className="font-medium text-foreground">{user.email || "No email"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <Smartphone className="size-4 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Verified Phone</p>
                    <p className="font-medium text-foreground">{profile.phone || "+1 (555) 392-8190"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <MapPin className="size-4 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Mailing Address</p>
                    <p className="font-medium text-foreground">
                      {profile.address
                        ? `${profile.address}, ${profile.city || ""} ${profile.postal_code || ""}`
                        : "740 Park Avenue, New York, NY 10021"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Login Activity Table */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="text-base font-semibold">Recent Login & Session Activity</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Review recent authentications across web browsers and mobile apps.
            </p>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border text-muted-foreground">
                  <tr>
                    <th className="py-2.5 px-3">Device / Browser</th>
                    <th className="py-2.5 px-3">Approximate Location</th>
                    <th className="py-2.5 px-3">IP Address</th>
                    <th className="py-2.5 px-3">Time</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loginActivity.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/30">
                      <td className="py-3 px-3 font-medium text-foreground">{log.device}</td>
                      <td className="py-3 px-3 text-muted-foreground">{log.location}</td>
                      <td className="py-3 px-3 font-mono text-muted-foreground">{log.ip}</td>
                      <td className="py-3 px-3 text-muted-foreground">{log.time}</td>
                      <td className="py-3 px-3">
                        <Badge
                          variant="outline"
                          className={
                            log.status === "Active"
                              ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                              : "border-border text-muted-foreground"
                          }
                        >
                          {log.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* TAB 6: NOTIFICATIONS & PERMISSIONS */}
        <TabsContent value="permissions" className="space-y-6 pt-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Notification Preferences */}
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Bell className="size-5 text-primary" />
                <h3 className="text-base font-semibold">Notification Preferences</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Choose how and when Eastern Trust Bank alerts you about account events.
              </p>

              <div className="space-y-4 divide-y divide-border pt-2">
                <div className="flex items-center justify-between pt-3 first:pt-0">
                  <div>
                    <p className="text-sm font-medium">Large Deposit Notifications</p>
                    <p className="text-xs text-muted-foreground">Instant email alert for credits over $500</p>
                  </div>
                  <Switch
                    checked={notifications.emailDeposits}
                    onCheckedChange={(val) => {
                      setNotifications((prev) => ({ ...prev, emailDeposits: val }));
                      toast.success("Deposit alerts updated");
                    }}
                  />
                </div>

                <div className="flex items-center justify-between pt-4">
                  <div>
                    <p className="text-sm font-medium">Debit & Withdrawal Alerts</p>
                    <p className="text-xs text-muted-foreground">Immediate notice for all outgoing charges</p>
                  </div>
                  <Switch
                    checked={notifications.emailWithdrawals}
                    onCheckedChange={(val) => {
                      setNotifications((prev) => ({ ...prev, emailWithdrawals: val }));
                      toast.success("Debit alerts updated");
                    }}
                  />
                </div>

                <div className="flex items-center justify-between pt-4">
                  <div>
                    <p className="text-sm font-medium">Urgent Security & Login SMS</p>
                    <p className="text-xs text-muted-foreground">Text notifications for unrecognized sign-ins</p>
                  </div>
                  <Switch
                    checked={notifications.smsSecurity}
                    onCheckedChange={(val) => {
                      setNotifications((prev) => ({ ...prev, smsSecurity: val }));
                      toast.success("Security SMS preferences saved");
                    }}
                  />
                </div>

                <div className="flex items-center justify-between pt-4">
                  <div>
                    <p className="text-sm font-medium">IRS & Tax Update Reminders</p>
                    <p className="text-xs text-muted-foreground">Annual 1099 notifications and deposit updates</p>
                  </div>
                  <Switch
                    checked={notifications.irsAlerts}
                    onCheckedChange={(val) => {
                      setNotifications((prev) => ({ ...prev, irsAlerts: val }));
                      toast.success("Tax alert preferences saved");
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Transfer & Payment Permissions */}
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Sliders className="size-5 text-primary" />
                <h3 className="text-base font-semibold">Transfer & Payment Permissions</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Set transfer guardrails, external wire authorizations, and limits.
              </p>

              <div className="space-y-4 divide-y divide-border pt-2">
                <div className="flex items-center justify-between pt-3 first:pt-0">
                  <div>
                    <p className="text-sm font-medium">Daily Outgoing Transfer Limit</p>
                    <p className="text-xs text-muted-foreground">
                      Current:{" "}
                      <strong className="text-foreground">
                        {formatCurrency(transferPermissions.dailyTransferLimit)}
                      </strong>
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      const newLimit = prompt(
                        "Set daily transfer limit (USD):",
                        String(transferPermissions.dailyTransferLimit)
                      );
                      if (newLimit && Number(newLimit) > 0) {
                        setTransferPermissions((p) => ({
                          ...p,
                          dailyTransferLimit: Number(newLimit),
                        }));
                        toast.success("Daily transfer limit updated");
                      }
                    }}
                  >
                    Adjust
                  </Button>
                </div>

                <div className="flex items-center justify-between pt-4">
                  <div>
                    <p className="text-sm font-medium">Domestic Wire Transfers</p>
                    <p className="text-xs text-muted-foreground">Same-day wire capabilities</p>
                  </div>
                  <Switch
                    checked={transferPermissions.allowWireTransfers}
                    onCheckedChange={(val) => {
                      setTransferPermissions((p) => ({ ...p, allowWireTransfers: val }));
                      toast.success("Domestic wire permissions updated");
                    }}
                  />
                </div>

                <div className="flex items-center justify-between pt-4">
                  <div>
                    <p className="text-sm font-medium">International SWIFT Wires</p>
                    <p className="text-xs text-muted-foreground">Cross-border foreign currency wires</p>
                  </div>
                  <Switch
                    checked={transferPermissions.allowInternationalWires}
                    onCheckedChange={(val) => {
                      setTransferPermissions((p) => ({ ...p, allowInternationalWires: val }));
                      toast.success("International wire permissions updated");
                    }}
                  />
                </div>

                <div className="flex items-center justify-between pt-4">
                  <div>
                    <p className="text-sm font-medium">Automatic Overdraft Protection</p>
                    <p className="text-xs text-muted-foreground">
                      Cover checking shortfalls with courtesy overdraft buffer
                    </p>
                  </div>
                  <Switch
                    checked={transferPermissions.allowOverdraftProtection}
                    onCheckedChange={(val) => {
                      setTransferPermissions((p) => ({ ...p, allowOverdraftProtection: val }));
                      toast.success("Overdraft protection setting saved");
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Contact Details Modal */}
      <Dialog open={isEditingContact} onOpenChange={setIsEditingContact}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Profile & Contact Details</DialogTitle>
            <DialogDescription>
              Keep your contact information up to date for statements and security verifications.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveContact();
            }}
            className="space-y-4"
          >
            {/* Profile Photo Preview & Change in Edit Dialog */}
            <div className="flex items-center gap-3.5 rounded-lg border border-border/70 bg-muted/30 p-3">
              <Avatar className="size-12 border border-border shrink-0">
                {avatarUrl ? (
                  <AvatarImage src={avatarUrl} alt={fullName} className="object-cover" />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">Profile Picture</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {avatarUrl ? "Custom photo active" : "Using monogram initials"}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAvatarDialogOpen(true)}
                className="text-xs shrink-0"
              >
                <Camera className="mr-1.5 size-3.5" /> Change Photo
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="first_name" className="text-xs">
                  First Name
                </Label>
                <Input
                  id="first_name"
                  className="mt-1"
                  value={contactForm.first_name}
                  onChange={(e) => setContactForm({ ...contactForm, first_name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="last_name" className="text-xs">
                  Last Name
                </Label>
                <Input
                  id="last_name"
                  className="mt-1"
                  value={contactForm.last_name}
                  onChange={(e) => setContactForm({ ...contactForm, last_name: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="phone" className="text-xs">
                Phone Number
              </Label>
              <Input
                id="phone"
                className="mt-1"
                value={contactForm.phone}
                onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                placeholder="+1 (555) 000-0000"
              />
            </div>

            <div>
              <Label htmlFor="address" className="text-xs">
                Street Address
              </Label>
              <Input
                id="address"
                className="mt-1"
                value={contactForm.address}
                onChange={(e) => setContactForm({ ...contactForm, address: e.target.value })}
                placeholder="123 Financial Way"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="city" className="text-xs">
                  City
                </Label>
                <Input
                  id="city"
                  className="mt-1"
                  value={contactForm.city}
                  onChange={(e) => setContactForm({ ...contactForm, city: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="postal_code" className="text-xs">
                  Postal Code
                </Label>
                <Input
                  id="postal_code"
                  className="mt-1"
                  value={contactForm.postal_code}
                  onChange={(e) => setContactForm({ ...contactForm, postal_code: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditingContact(false)}
                disabled={isSavingContact}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingContact}>
                {isSavingContact ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AvatarModal
        open={isAvatarDialogOpen}
        onOpenChange={setIsAvatarDialogOpen}
        currentAvatarUrl={avatarUrl}
        fullName={fullName ?? ""}
        initials={initials}
        userId={user.id}
        onAvatarUpdated={(newUrl) => {
          setAvatarUrl(newUrl);
          onRefresh?.();
        }}
      />
    </div>
  );
}
