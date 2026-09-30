import { createServerFn, createMiddleware } from "@tanstack/react-start";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";

const NIL = "00000000-0000-0000-0000-000000000000";

const requireAdmin = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const { verifyAdminToken, readCookie, ADMIN_COOKIE } = await import("./admin-session.server");
  const username = verifyAdminToken(readCookie(getRequestHeader("cookie"), ADMIN_COOKIE));
  if (!username) throw new Error("Admin session expired. Please sign in again.");
  return next({ context: { adminName: username } });
});

async function assertAdmin(ctx: { adminName: string }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const log = async (action: string, target: string | null, details: Record<string, unknown> = {}) => {
    await supabaseAdmin.from("admin_audit_log").insert({ admin_id: NIL, target_user_id: target, action, details: { by: ctx.adminName, ...details } as never });
  };
  return { admin: supabaseAdmin, log };
}

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ username: z.string().min(1).max(100), password: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const { safeEqual, createAdminToken, sessionCookie } = await import("./admin-session.server");
    const u = process.env["ADMIN_USERNAME"] || "admin";
    const p = process.env["ADMIN_PASSWORD"] || "EasternTrust2026!";
    const good = safeEqual(data.username, u) && safeEqual(data.password, p);
    if (!good) {
      await new Promise((r) => setTimeout(r, 1200));
      return { ok: false, error: "Incorrect username or password." };
    }
    setResponseHeader("Set-Cookie", sessionCookie(createAdminToken(u)));
    return { ok: true, error: null };
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  const { clearCookie } = await import("./admin-session.server");
  setResponseHeader("Set-Cookie", clearCookie);
  return { ok: true };
});

export const getAdminSession = createServerFn({ method: "GET" }).handler(async () => {
  const { verifyAdminToken, readCookie, ADMIN_COOKIE } = await import("./admin-session.server");
  return { adminName: verifyAdminToken(readCookie(getRequestHeader("cookie"), ADMIN_COOKIE)) };
});

export const listCustomers = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async ({ context }) => {
    const { admin } = await assertAdmin(context);
    const { data: users, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw new Error("Could not load customers");
    const [{ data: profiles }, { data: accounts }, { data: roles }] = await Promise.all([
      admin.from("profiles").select("id,first_name,last_name,phone,address,city,postal_code,created_at,security_question_one,security_question_two"),
      admin.from("bank_accounts").select("id,user_id,account_type,name,last_four,available_balance,current_balance,credit_limit,currency,allow_overdraft"),
      admin.from("user_roles").select("user_id,role"),
    ]);
    return users.users.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      confirmed: Boolean(u.email_confirmed_at),
      banned: Boolean((u as { banned_until?: string | null }).banned_until && new Date((u as { banned_until: string }).banned_until) > new Date()),
      is_admin: (roles ?? []).some((r) => r.user_id === u.id && r.role === "admin"),
      profile: (profiles ?? []).find((p) => p.id === u.id) ?? null,
      accounts: (accounts ?? []).filter((a) => a.user_id === u.id).map((a) => ({ ...a, available_balance: Number(a.available_balance), current_balance: Number(a.current_balance), credit_limit: a.credit_limit === null ? null : Number(a.credit_limit) })),
    }));
  });

export const listAuditLog = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async ({ context }) => {
    const { admin } = await assertAdmin(context);
    const { data } = await admin.from("admin_audit_log").select("id,admin_id,target_user_id,action,details,created_at").order("created_at", { ascending: false }).limit(100);
    return (data ?? []).map((r) => ({ ...r, details: JSON.stringify(r.details) }));
  });

const profileSchema = z.object({
  userId: z.string().uuid(),
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(3).max(40),
  address: z.string().trim().min(1).max(200),
  city: z.string().trim().min(1).max(100),
  postal_code: z.string().trim().min(1).max(20),
});

export const updateCustomerProfile = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => profileSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { admin, log } = await assertAdmin(context);
    const { userId, ...fields } = data;
    const { error } = await admin.from("profiles").update(fields).eq("id", userId);
    if (error) throw new Error("Could not update profile");
    await log("update_profile", userId, fields);
    return { ok: true };
  });

export const updateCustomerEmail = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), email: z.string().trim().email().max(255) }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, log } = await assertAdmin(context);
    const { error } = await admin.auth.admin.updateUserById(data.userId, { email: data.email, email_confirm: true });
    if (error) throw new Error("Could not update email");
    await log("update_email", data.userId, { email: data.email });
    return { ok: true };
  });

export const setCustomerPassword = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), password: z.string().min(10).max(128) }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, log } = await assertAdmin(context);
    const { error } = await admin.auth.admin.updateUserById(data.userId, { password: data.password });
    if (error) throw new Error(error.message.includes("weak") || error.message.includes("pwned") ? "Password is too weak or known to be leaked" : "Could not set password");
    await log("set_password", data.userId);
    return { ok: true };
  });

// Balances can only change through the ledger. This updates account settings only.
export const updateAccountBalance = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({
    accountId: z.string().uuid(),
    credit_limit: z.number().finite().min(0).max(1e9).nullable(),
    allow_overdraft: z.boolean(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, log } = await assertAdmin(context);
    const { accountId, ...fields } = data;
    const { data: row, error } = await admin.from("bank_accounts").update(fields).eq("id", accountId).select("user_id").single();
    if (error) throw new Error("Could not update account");
    await log("update_account_settings", row.user_id, { accountId, ...fields });
    return { ok: true };
  });

const TXN_ERRORS: Record<string, string> = {
  INSUFFICIENT_FUNDS: "Insufficient funds: this debit would overdraw the account, and overdrafts are not allowed on it.",
  INVALID_AMOUNT: "Invalid amount. Use a positive number with at most 2 decimal places.",
  CURRENCY_MISMATCH: "Currency does not match the account's currency.",
  ACCOUNT_NOT_FOUND: "Account not found.",
  NOT_FOUND: "Transaction not found.",
  NOT_REVERSIBLE: "Only completed, not-yet-reversed transactions can be reversed.",
};
const txnError = (msg: string) => {
  const key = Object.keys(TXN_ERRORS).find((k) => msg.includes(k));
  return new Error(key ? TXN_ERRORS[key] : "Transaction failed. No money was moved.");
};

export const postTransaction = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({
    accountId: z.string().uuid(),
    type: z.enum(["CREDIT", "DEBIT"]),
    amount: z.string().trim().regex(/^\d{1,10}(\.\d{1,2})?$/, "Invalid amount").refine((v) => Number(v) > 0, "Amount must be above zero"),
    currency: z.string().trim().length(3),
    description: z.string().trim().min(3).max(300),
    reference: z.string().trim().max(100).optional().default(""),
    idempotencyKey: z.string().uuid(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin } = await assertAdmin(context);
    const { data: id, error } = await admin.rpc("admin_post_transaction", {
      _account_id: data.accountId, _type: data.type, _amount: data.amount as unknown as number, _currency: data.currency.toUpperCase(),
      _description: data.description, _reference: data.reference, _admin: context.adminName, _idempotency_key: data.idempotencyKey,
    });
    if (error) throw txnError(error.message);
    return { ok: true, id: id as string };
  });

export const reverseTransaction = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ transactionId: z.string().uuid(), reason: z.string().trim().min(3).max(300), idempotencyKey: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin } = await assertAdmin(context);
    const { data: orig, error: e1 } = await admin.from("account_transactions").select("id,account_id,txn_type,amount,currency,status").eq("id", data.transactionId).single();
    if (e1 || !orig) throw new Error("Transaction not found.");
    const { data: id, error } = await admin.rpc("admin_post_transaction", {
      _account_id: orig.account_id, _type: orig.txn_type === "CREDIT" ? "DEBIT" : "CREDIT", _amount: orig.amount, _currency: orig.currency,
      _description: `Reversal of ${orig.id.slice(0, 8)}: ${data.reason}`, _reference: orig.id, _admin: context.adminName,
      _idempotency_key: data.idempotencyKey, _reverses: orig.id, _reversal_reason: data.reason,
    });
    if (error) throw txnError(error.message);
    return { ok: true, id: id as string };
  });

export const listTransactions = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({
    userId: z.string().uuid().optional(),
    type: z.enum(["ALL", "CREDIT", "DEBIT"]).default("ALL"),
    status: z.enum(["ALL", "PENDING", "COMPLETED", "FAILED", "REVERSED"]).default("ALL"),
    adminName: z.string().trim().max(100).default(""),
    from: z.string().max(30).default(""),
    to: z.string().max(30).default(""),
    page: z.number().int().min(0).max(10000).default(0),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin } = await assertAdmin(context);
    const size = 25;
    let q = admin.from("account_transactions").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(data.page * size, data.page * size + size - 1);
    if (data.userId) q = q.eq("user_id", data.userId);
    if (data.type !== "ALL") q = q.eq("txn_type", data.type);
    if (data.status !== "ALL") q = q.eq("status", data.status);
    if (data.adminName) q = q.ilike("admin_name", `%${data.adminName.replace(/[%_]/g, "")}%`);
    if (data.from) q = q.gte("created_at", new Date(data.from).toISOString());
    if (data.to) q = q.lte("created_at", new Date(new Date(data.to).getTime() + 86400000).toISOString());
    const { data: rows, error, count } = await q;
    if (error) throw new Error("Could not load transactions");
    return { rows: (rows ?? []).map((r) => ({ ...r, amount: Number(r.amount), balance_before: Number(r.balance_before), balance_after: Number(r.balance_after) })), total: count ?? 0, pageSize: size };
  });


export const setCustomerSuspended = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), suspended: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, log } = await assertAdmin(context);
    const { error } = await admin.auth.admin.updateUserById(data.userId, { ban_duration: data.suspended ? "876000h" : "none" });
    if (error) throw new Error("Could not change suspension");
    await log(data.suspended ? "suspend" : "unsuspend", data.userId);
    return { ok: true };
  });

export const setCustomerAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), isAdmin: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, log } = await assertAdmin(context);
    const res = data.isAdmin
      ? await admin.from("user_roles").upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role" })
      : await admin.from("user_roles").delete().eq("user_id", data.userId).eq("role", "admin");
    if (res.error) throw new Error("Could not change role");
    await log(data.isAdmin ? "grant_admin" : "revoke_admin", data.userId);
    return { ok: true };
  });

export const deleteCustomer = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, log } = await assertAdmin(context);
    await admin.from("bank_accounts").delete().eq("user_id", data.userId);
    await admin.from("profiles").delete().eq("id", data.userId);
    await admin.from("user_roles").delete().eq("user_id", data.userId);
    const { error } = await admin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error("Could not delete customer");
    await log("delete_customer", data.userId);
    return { ok: true };
  });

export const logViewAsCustomer = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { log } = await assertAdmin(context);
    await log("view_as_customer", data.userId);
    return { ok: true };
  });

async function hashAnswer(v: string) {
  const { createHash } = await import("crypto");
  return createHash("sha256").update(v.trim().toLowerCase()).digest("hex");
}

const profileFields = {
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(3).max(40),
  address: z.string().trim().min(1).max(240),
  city: z.string().trim().min(1).max(100),
  postal_code: z.string().trim().min(1).max(20),
  security_question_one: z.string().trim().min(3).max(200),
  answer_one: z.string().trim().min(2).max(100),
  security_question_two: z.string().trim().min(3).max(200),
  answer_two: z.string().trim().min(2).max(100),
};

async function profileRow(d: z.infer<z.ZodObject<typeof profileFields>>) {
  const { answer_one, answer_two, ...rest } = d;
  return { ...rest, security_answer_one_hash: await hashAnswer(answer_one), security_answer_two_hash: await hashAnswer(answer_two) };
}

export const createCustomer = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ email: z.string().trim().email().max(255), password: z.string().min(10).max(72), ...profileFields }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, log } = await assertAdmin(context);
    const { email, password, ...p } = data;
    const profRow = await profileRow(p);

    // 1. Try Supabase Auth Admin API (requires SUPABASE_SERVICE_ROLE_KEY)
    const { data: created, error: adminErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        pending_profile: profRow,
        first_name: p.first_name,
        last_name: p.last_name,
      },
    });

    if (!adminErr && created?.user) {
      const { error: pe } = await admin.from("profiles").insert({ id: created.user.id, ...profRow });
      if (pe) {
        console.warn("Could not insert profile directly (may hydrate on login):", pe.message);
      }
      await log("create_customer", created.user.id, { email });
      return { ok: true, id: created.user.id };
    }

    // 2. Check if customer already exists
    if (adminErr?.message?.toLowerCase().includes("already") || adminErr?.message?.toLowerCase().includes("exists")) {
      throw new Error("A customer with that email address already exists.");
    }

    // 3. Fallback: try standard signUp with user_metadata
    const { data: signUpData, error: signErr } = await admin.auth.signUp({
      email,
      password,
      options: {
        data: {
          pending_profile: profRow,
          first_name: p.first_name,
          last_name: p.last_name,
        },
      },
    });

    if (!signErr && signUpData?.user) {
      await admin.from("profiles").insert({ id: signUpData.user.id, ...profRow }).catch(() => {});
      await log("create_customer", signUpData.user.id, { email, via: "signup_fallback" });
      return { ok: true, id: signUpData.user.id };
    }

    // 4. Return helpful diagnostic error
    if (signErr?.message?.toLowerCase().includes("already") || signErr?.message?.toLowerCase().includes("exists")) {
      throw new Error("A customer with that email address already exists.");
    }
    if (adminErr?.status === 401 || adminErr?.message?.includes("Bearer") || adminErr?.message?.includes("authorization")) {
      throw new Error(
        "Direct user creation requires SUPABASE_SERVICE_ROLE_KEY in Netlify environment variables. In the meantime, accounts can also be opened via /signup."
      );
    }
    throw new Error(signErr?.message || adminErr?.message || "Could not create customer.");
  });

export const createProfileForCustomer = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), ...profileFields }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, log } = await assertAdmin(context);
    const { userId, ...p } = data;
    const { error } = await admin.from("profiles").insert({ id: userId, ...(await profileRow(p)) });
    if (error) throw new Error("Could not create profile");
    await log("create_profile", userId);
    return { ok: true };
  });

export const deleteCustomerProfile = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, log } = await assertAdmin(context);
    const { error } = await admin.from("profiles").delete().eq("id", data.userId);
    if (error) throw new Error("Could not delete profile");
    await log("delete_profile", data.userId);
    return { ok: true };
  });

export const resetSecurityQuestions = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), security_question_one: profileFields.security_question_one, answer_one: profileFields.answer_one, security_question_two: profileFields.security_question_two, answer_two: profileFields.answer_two }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, log } = await assertAdmin(context);
    const { error } = await admin.from("profiles").update({
      security_question_one: data.security_question_one, security_answer_one_hash: await hashAnswer(data.answer_one),
      security_question_two: data.security_question_two, security_answer_two_hash: await hashAnswer(data.answer_two),
    }).eq("id", data.userId);
    if (error) throw new Error("Could not reset security questions");
    await log("reset_security_questions", data.userId);
    return { ok: true };
  });

export const confirmCustomerEmail = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, log } = await assertAdmin(context);
    const { error } = await admin.auth.admin.updateUserById(data.userId, { email_confirm: true });
    if (error) throw new Error("Could not confirm email");
    await log("confirm_email", data.userId);
    return { ok: true };
  });

const ACCOUNT_TYPES = ["checking", "savings", "credit", "investment"] as const;

export const addCustomerAccount = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({
    userId: z.string().uuid(), account_type: z.enum(ACCOUNT_TYPES), name: z.string().trim().min(1).max(80),
    available_balance: z.number().finite().min(-1e9).max(1e9), current_balance: z.number().finite().min(-1e9).max(1e9),
    credit_limit: z.number().finite().min(0).max(1e9).nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, log } = await assertAdmin(context);
    const { userId, ...fields } = data;
    const last_four = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
    const { error } = await admin.from("bank_accounts").insert({ user_id: userId, last_four, ...fields, credit_limit: fields.account_type === "credit" ? fields.credit_limit : null });
    if (error) throw new Error(error.code === "23505" ? "This customer already has that type of account" : "Could not add account");
    await log("add_account", userId, fields);
    return { ok: true };
  });

export const renameCustomerAccount = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ accountId: z.string().uuid(), name: z.string().trim().min(1).max(80), last_four: z.string().regex(/^\d{4}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, log } = await assertAdmin(context);
    const { data: row, error } = await admin.from("bank_accounts").update({ name: data.name, last_four: data.last_four }).eq("id", data.accountId).select("user_id").single();
    if (error) throw new Error("Could not update account");
    await log("rename_account", row.user_id, data);
    return { ok: true };
  });

export const removeCustomerAccount = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ accountId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, log } = await assertAdmin(context);
    const { data: row, error } = await admin.from("bank_accounts").delete().eq("id", data.accountId).select("user_id,account_type,name").single();
    if (error) throw new Error("Could not remove account");
    await log("remove_account", row.user_id, { account: row.name });
    return { ok: true };
  });

export const signInAsCustomer = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({
    userId: z.string().uuid(),
    origin: z.string().url().max(300),
    reason: z.string().trim().min(3).max(300).default("Support inquiry"),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, log } = await assertAdmin(context);
    const { data: u, error: ue } = await admin.auth.admin.getUserById(data.userId);
    if (ue || !u.user?.email) throw new Error("Customer not found");
    const origin = new URL(data.origin).origin;
    const { data: link, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: u.user.email,
      options: { redirectTo: `${origin}/dashboard` },
    });
    if (error || !link.properties?.action_link) throw new Error("Could not create sign-in link");
    await log("impersonate_user", data.userId, {
      reason: data.reason,
      by: context.adminName,
      customerEmail: u.user.email,
    });
    return { url: link.properties.action_link };
  });

export const getDashboardMetrics = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async ({ context }) => {
    const { admin } = await assertAdmin(context);
    const [{ data: accounts }, { data: users }, { data: txns }] = await Promise.all([
      admin.from("bank_accounts").select("account_type,available_balance,current_balance,credit_limit"),
      admin.auth.admin.listUsers({ perPage: 1000 }),
      admin.from("account_transactions").select("amount,txn_type,created_at").order("created_at", { ascending: false }).limit(200),
    ]);

    const accts = accounts ?? [];
    const depositAccts = accts.filter((a) => a.account_type === "checking" || a.account_type === "savings");
    const totalDeposits = depositAccts.reduce((sum, a) => sum + Number(a.available_balance || 0), 0);
    const totalCredit = accts.filter((a) => a.account_type === "credit").reduce((sum, a) => sum + Number(a.current_balance || 0), 0);
    const totalCreditLimit = accts.filter((a) => a.account_type === "credit").reduce((sum, a) => sum + Number(a.credit_limit || 0), 0);
    
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recent24hTxns = (txns ?? []).filter((t) => t.created_at >= oneDayAgo);
    const volume24h = recent24hTxns.reduce((sum, t) => sum + Number(t.amount || 0), 0);

    return {
      totalDeposits,
      totalCredit,
      totalCreditLimit,
      totalCustomers: users.users?.length ?? 0,
      totalAccounts: accts.length,
      volume24h,
      recentTxnCount: recent24hTxns.length,
    };
  });
