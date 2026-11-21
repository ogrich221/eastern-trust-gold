import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UserProfile, type ProfileAccount, type ProfileData } from "@/components/user-profile";
import { BankLoadingScreen } from "@/components/bank-chrome";

export const Route = createFileRoute("/_authenticated/dashboard")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "My Profile & Accounts | Eastern Trust Bank" },
      { name: "description", content: "Your Eastern Trust Bank accounts, profile, and balances." },
      { property: "og:title", content: "My Profile & Accounts | Eastern Trust Bank" },
      { property: "og:description", content: "Your profile, accounts and balances at a glance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

const order = ["checking", "savings", "credit", "investment"];

function Dashboard() {
  const { user } = Route.useRouteContext();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [accounts, setAccounts] = useState<ProfileAccount[] | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const load = async () => {
      let { data: prof } = await supabase
        .from("profiles")
        .select("first_name,last_name,phone,address,city,postal_code,avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      if (!prof) {
        const raw = user.user_metadata?.["pending_profile"];
        if (raw && typeof raw === "object") {
          const p = raw as Record<string, unknown>;
          const keys = [
            "first_name",
            "last_name",
            "phone",
            "address",
            "city",
            "postal_code",
            "security_question_one",
            "security_answer_one_hash",
            "security_question_two",
            "security_answer_two_hash",
          ] as const;
          if (keys.every((k) => typeof p[k] === "string")) {
            const row = Object.fromEntries(keys.map((k) => [k, String(p[k])])) as Record<
              (typeof keys)[number],
              string
            >;
            const pinHash = p["transfer_pin_hash"];
            await supabase.from("profiles").insert({ id: user.id, ...row, ...(typeof pinHash === "string" ? { transfer_pin_hash: pinHash } : {}) });
            prof = {
              first_name: row.first_name,
              last_name: row.last_name,
              phone: row.phone,
              address: row.address,
              city: row.city,
              postal_code: row.postal_code,
              avatar_url: null,
            };
          }
        }
      }

      setProfile(prof || null);

      const { data } = await supabase
        .from("bank_accounts")
        .select("id,account_type,name,last_four,available_balance,current_balance,credit_limit,currency,allow_overdraft")
        .eq("user_id", user.id);

      const list = ((data ?? []) as ProfileAccount[])
        .filter((a) => a.account_type !== "savings" && a.account_type !== "investment")
        .map((a) => ({
          ...a,
          available_balance: Number(a.available_balance),
          current_balance: Number(a.current_balance),
          credit_limit: a.credit_limit === null ? null : Number(a.credit_limit),
        }));

      list.sort((a, b) => order.indexOf(a.account_type) - order.indexOf(b.account_type));
      setAccounts(list);
    };

    load();
  }, [user, tick]);

  useEffect(() => {
    const refreshOnReturn = () => {
      if (document.visibilityState === "visible") setTick((t) => t + 1);
    };
    const onFocus = () => setTick((t) => t + 1);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", refreshOnReturn);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", refreshOnReturn);
    };
  }, []);

  return (
    <main className="min-h-[calc(100vh-5rem)] py-10">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        {accounts === null ? (
          <BankLoadingScreen label="Loading your banking profile" />
        ) : (
          <UserProfile
            user={user}
            initialProfile={profile}
            accounts={accounts}
            onRefresh={() => setTick((t) => t + 1)}
          />
        )}
      </div>
    </main>
  );
}
