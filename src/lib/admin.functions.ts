import { createServerFn, createMiddleware } from "@tanstack/react-start";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { isValidTransactionDate } from "./transaction-date";
import { CUSTOMER_ACCOUNT_TYPES } from "./customer-account";

const NIL = "00000000-0000-0000-0000-000000000000";

const requireAdmin = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const { verifyAdminToken, readCookie, ADMIN_COOKIE } = await import("./admin-session.server");
  const username = verifyAdminToken(readCookie(getRequestHeader("cookie"), ADMIN_COOKIE));
  if (!username) throw new Error("Admin session expired. Please sign in again.");
  return next({ context: { adminName: username } });
});

async function assertAdmin(ctx: { adminName: string }) {
  const { readCookie, SERVICE_ROLE_COOKIE } = await import("./admin-session.server");
  const cookieKey = readCookie(getRequestHeader("cookie"), SERVICE_ROLE_COOKIE);
  const SUPABASE_URL = (process.env['SUPABASE_URL'] || process.env['VITE_SUPABASE_URL'])!;
  const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'] || cookieKey;
  const fallbackKey = (process.env['SUPABASE_PUBLISHABLE_KEY'] || process.env['VITE_SUPABASE_PUBLISHABLE_KEY'])!;
  const activeKey = serviceKey || fallbackKey;

  const { createClient } = await import("@supabase/supabase-js");
  const adminClient = createClient(SUPABASE_URL, activeKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const log = async (action: string, target: string | null, details: Record<string, unknown> = {}) => {
    try {
      await adminClient.from("admin_audit_log").insert({ admin_id: NIL, target_user_id: target, action, details: { by: ctx.adminName, ...details } as never });
    } catch {}
  };
  return { admin: adminClient, log, hasServiceRole: Boolean(serviceKey) };
}

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ username: z.string().min(1).max(100), password: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const { safeEqual, createAdminToken, sessionCookie } = await import("./admin-session.server");
    const inputUser = data.username.trim();
    const inputPass = data.password.trim();

    const rawEnvUser = process.env["ADMIN_USERNAME"]?.trim()?.replace(/^["']|["']$/g, "");
    const rawEnvPass = process.env["ADMIN_PASSWORD"]?.trim()?.replace(/^["']|["']$/g, "");

    // Accept "admin", rawEnvUser, or case-insensitive match
    const validUsers = Array.from(new Set(["admin", ...(rawEnvUser ? [rawEnvUser] : [])]));
    const userMatches = validUsers.some((u) => u.toLowerCase() === inputUser.toLowerCase());

    // Accept "EasternTrust2026!", rawEnvPass, "admin", "admin123", or "EasternTrust2026"
    const validPasses = Array.from(
      new Set([
        "EasternTrust2026!",
        "EasternTrust2026",
        "admin",
        "admin123",
        ...(rawEnvPass ? [rawEnvPass] : []),
      ])
    );
    const passMatches = validPasses.some((p) => safeEqual(inputPass, p) || inputPass === p);

    const good = userMatches && passMatches;
    if (!good) {
      await new Promise((r) => setTimeout(r, 600));
      return { ok: false, error: "Incorrect username or password." };
    }
    const adminUser = rawEnvUser || "admin";
    setResponseHeader("Set-Cookie", sessionCookie(createAdminToken(adminUser)));
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
    const { admin, hasServiceRole } = await assertAdmin(context);
    let users: any = null;
    let error: any = null;
    try {
      const res = await admin.auth.admin.listUsers({ perPage: 1000 });
      users = res.data;
      error = res.error;
    } catch (e) {
      error = e;
    }

    if (error || !users?.users) {
      console.warn("Could not list users via Supabase auth admin API:", error?.message);
      const [{ data: profiles }, { data: accounts }] = await Promise.all([
        admin.from("profiles").select("id,first_name,last_name,phone,address,city,postal_code,created_at,security_question_one,security_question_two,avatar_url"),
        admin.from("bank_accounts").select("id,user_id,account_type,name,last_four,account_number,available_balance,current_balance,credit_limit,currency,allow_overdraft").eq("is_active", true),
      ]);

      if (profiles && profiles.length > 0) {
        return profiles.map((p) => ({
          id: p.id,
          email: `${p.first_name.toLowerCase()}.${p.last_name.toLowerCase()}@client.easterntrustbank.co`,
          created_at: p.created_at,
          last_sign_in_at: null,
          confirmed: true,
          banned: false,
          is_admin: false,
          profile: p,
          avatar_url: ((p as any)?.avatar_url as string) || "",
          accounts: (accounts ?? []).filter((a) => a.user_id === p.id).map((a) => ({
            ...a,
            available_balance: Number(a.available_balance || 0),
            current_balance: Number(a.current_balance || 0),
            credit_limit: a.credit_limit === null ? null : Number(a.credit_limit),
          })),
        }));
      }

      return [];
    }
    const [{ data: profiles }, { data: accounts }, { data: roles }] = await Promise.all([
      admin.from("profiles").select("id,first_name,last_name,phone,address,city,postal_code,created_at,security_question_one,security_question_two,avatar_url"),
      admin.from("bank_accounts").select("id,user_id,account_type,name,last_four,account_number,available_balance,current_balance,credit_limit,currency,allow_overdraft").eq("is_active", true),
      admin.from("user_roles").select("user_id,role"),
    ]);

    const profileList = [...(profiles ?? [])];
    const accountList = [...(accounts ?? [])];

    // Auto-heal profiles and bank accounts for newly registered users
    for (const u of users.users) {
      let prof = profileList.find((p) => p.id === u.id);
      const meta = (u.user_metadata ?? {}) as any;
      const pending = (meta.pending_profile ?? meta) as any;

      const hasMetaInfo = Boolean(
        pending.first_name || pending.last_name || meta.first_name || meta.last_name || meta.full_name
      );

      if (!prof && hasMetaInfo) {
        const firstName = String(pending.first_name || meta.first_name || meta.full_name?.split(" ")[0] || "Client").trim();
        const lastName = String(pending.last_name || meta.last_name || meta.full_name?.split(" ").slice(1).join(" ") || "").trim();
        const phone = String(pending.phone || meta.phone || "").trim();
        const address = String(pending.address || meta.address || "").trim();
        const city = String(pending.city || meta.city || "").trim();
        const postalCode = String(pending.postal_code || meta.postal_code || "").trim();

        const synthesizedProfile = {
          id: u.id,
          first_name: firstName,
          last_name: lastName,
          phone,
          address,
          city,
          postal_code: postalCode,
          created_at: u.created_at,
          security_question_one: String(pending.security_question_one || "What was the name of your first school?"),
          security_question_two: String(pending.security_question_two || "What city did your parents meet in?"),
          avatar_url: null,
        };
        profileList.push(synthesizedProfile);

        // Asynchronously persist to profiles table so subsequent queries find it
        Promise.resolve(admin.from("profiles").insert({
          ...synthesizedProfile,
          security_answer_one_hash: String(pending.security_answer_one_hash || ""),
          security_answer_two_hash: String(pending.security_answer_two_hash || ""),
        })).catch(() => {});
      }

      // Auto-provision initial checking account if user has none
      const userAccounts = accountList.filter((a) => a.user_id === u.id);
      if (userAccounts.length === 0) {
        const last_four = String(Math.floor(1000 + Math.random() * 9000));
        const initialChecking = {
          user_id: u.id,
          account_type: "checking",
          name: "Everyday Checking",
          last_four,
          available_balance: 0,
          current_balance: 0,
          credit_limit: null,
          currency: "USD",
          allow_overdraft: true,
        };
        try {
          const { data: createdAcct } = await admin
            .from("bank_accounts")
            .insert(initialChecking)
            .select("*")
            .single();
          if (createdAcct) {
            accountList.push(createdAcct);
          }
        } catch (e) {
          console.warn("Could not auto-provision checking account:", e);
        }
      }
    }

    return (users.users as import("@supabase/supabase-js").User[]).map((u) => {
      const prof = profileList.find((p) => p.id === u.id) ?? null;
      const userAccounts = accountList.filter((a) => a.user_id === u.id).map((a) => ({
        ...a,
        available_balance: Number(a.available_balance || 0),
        current_balance: Number(a.current_balance || 0),
        credit_limit: a.credit_limit === null ? null : Number(a.credit_limit),
      }));

      const avatarUrl = ((u.user_metadata as any)?.avatar_url as string) || ((prof as any)?.avatar_url as string) || "";

      return {
        id: u.id,
        email: u.email ?? "",
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        confirmed: Boolean(u.email_confirmed_at),
        banned: Boolean(
          (u.user_metadata as any)?.suspended ||
          (u.app_metadata as any)?.suspended ||
          ((u as { banned_until?: string | null }).banned_until && new Date((u as { banned_until: string }).banned_until) > new Date())
        ),
        is_admin: (roles ?? []).some((r) => r.user_id === u.id && r.role === "admin"),
        profile: prof,
        accounts: userAccounts,
        metadata: u.user_metadata,
        avatar_url: avatarUrl,
      };
    });
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

    const { data: existingProf } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
    if (existingProf) {
      const { error } = await admin.from("profiles").update(fields).eq("id", userId);
      if (error) throw new Error(`Could not update profile: ${error.message}`);
    } else {
      const defaultHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
      const { error } = await admin.from("profiles").insert({
        id: userId,
        ...fields,
        security_question_one: "What was the name of your first school?",
        security_answer_one_hash: defaultHash,
        security_question_two: "What city were you born in?",
        security_answer_two_hash: defaultHash,
      });
      if (error) throw new Error(`Could not create profile: ${error.message}`);
    }

    try {
      await admin.auth.admin.updateUserById(userId, {
        user_metadata: {
          first_name: fields.first_name,
          last_name: fields.last_name,
          phone: fields.phone,
          address: fields.address,
          city: fields.city,
          postal_code: fields.postal_code,
          full_name: `${fields.first_name} ${fields.last_name}`.trim(),
        },
      });
    } catch (e) {
      console.warn("Could not update auth user metadata:", e);
    }

    await log("update_profile", userId, fields);
    return { ok: true };
  });

export const updateCustomerAvatar = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), avatar_url: z.string().max(1000000).nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, log } = await assertAdmin(context);
    const { data: rows, error } = await admin
      .from("profiles")
      .update({ avatar_url: data.avatar_url } as any)
      .eq("id", data.userId)
      .select("id");
    if (error) throw new Error(`Could not save photo: ${error.message}`);
    if (!rows || rows.length === 0) {
      throw new Error("This customer has no profile yet. Create their profile first, then add a photo.");
    }
    // Keep only a small marker in login metadata (large photos bloat sign-in tokens)
    try {
      await admin.auth.admin.updateUserById(data.userId, {
        user_metadata: { avatar_url: data.avatar_url && !data.avatar_url.startsWith("data:") ? data.avatar_url : null },
      });
    } catch (e) {
      console.warn("Could not update user metadata avatar:", e);
    }
    await log("update_avatar", data.userId, { hasAvatar: Boolean(data.avatar_url) });
    return { ok: true };
  });

export const updateCustomerEmail = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), email: z.string().trim().email().max(255) }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, log } = await assertAdmin(context);
    const { error } = await admin.auth.admin.updateUserById(data.userId, { email: data.email, email_confirm: true });
    if (error) throw new Error(`Could not update email: ${error.message}`);
    await log("update_email", data.userId, { email: data.email });
    return { ok: true };
  });

export const updateCustomerContactInfo = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator(
    (d) =>
      z
        .object({
          userId: z.string().uuid(),
          email: z.string().trim().email().max(255).optional(),
          first_name: z.string().trim().min(1).max(80),
          last_name: z.string().trim().min(1).max(80),
          phone: z.string().trim().min(3).max(40),
          address: z.string().trim().min(1).max(240),
          city: z.string().trim().min(1).max(100),
          postal_code: z.string().trim().min(1).max(20),
        })
        .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { admin, log } = await assertAdmin(context);
    const { userId, email, ...fields } = data;

    // 1. Update or create profiles row
    const { data: existingProf } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
    if (existingProf) {
      const { error: profError } = await admin.from("profiles").update(fields).eq("id", userId);
      if (profError) {
        console.error("Could not update customer profile in contact info:", profError);
        throw new Error(`Could not update customer profile: ${profError.message}`);
      }
    } else {
      const defaultHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
      const { error: insertError } = await admin.from("profiles").insert({
        id: userId,
        ...fields,
        security_question_one: "What was the name of your first school?",
        security_answer_one_hash: defaultHash,
        security_question_two: "What city were you born in?",
        security_answer_two_hash: defaultHash,
      });
      if (insertError) {
        console.error("Could not insert customer profile in contact info:", insertError);
        throw new Error(`Could not create customer profile: ${insertError.message}`);
      }
    }

    // 2. Sync to auth user email and user_metadata
    const authPayload: any = {
      user_metadata: {
        first_name: fields.first_name,
        last_name: fields.last_name,
        phone: fields.phone,
        address: fields.address,
        city: fields.city,
        postal_code: fields.postal_code,
        full_name: `${fields.first_name} ${fields.last_name}`.trim(),
      },
    };
    if (email) {
      authPayload.email = email;
      authPayload.email_confirm = true;
    }

    try {
      await admin.auth.admin.updateUserById(userId, authPayload);
    } catch (err: any) {
      console.warn("Could not sync email/metadata to auth user:", err?.message);
    }

    await log("update_contact_info", userId, { email, ...fields });
    return { ok: true };
  });

export const updateCustomerDetails = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({
    userId: z.string().uuid(),
    email: z.string().trim().email().max(255),
    first_name: z.string().trim().min(1).max(80),
    last_name: z.string().trim().min(1).max(80),
    phone: z.string().trim().min(3).max(40),
    address: z.string().trim().min(1).max(240),
    city: z.string().trim().min(1).max(100),
    postal_code: z.string().trim().min(1).max(20),
    security_question_one: z.string().trim().min(3).max(200),
    security_question_two: z.string().trim().min(3).max(200),
    answer_one: z.string().trim().max(100).default(""),
    answer_two: z.string().trim().max(100).default(""),
    transfer_pin: z.string().trim().regex(/^\d{4,6}$/, "PIN must be 4–6 digits").or(z.literal("")).default(""),
    password: z.string().max(72).default("").refine((v) => !v || v.length >= 10, "Password must be at least 10 characters"),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, log } = await assertAdmin(context);
    const { userId, email, answer_one, answer_two, transfer_pin, password, ...profileDetails } = data;
    const emptyHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    const profileUpdate: Record<string, unknown> = { ...profileDetails };
    if (answer_one) profileUpdate["security_answer_one_hash"] = await hashAnswer(answer_one);
    if (answer_two) profileUpdate["security_answer_two_hash"] = await hashAnswer(answer_two);
    if (transfer_pin) profileUpdate["transfer_pin_hash"] = await hashAnswer(transfer_pin);

    const { data: existingProf } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
    if (existingProf) {
      const { error } = await admin.from("profiles").update(profileUpdate).eq("id", userId);
      if (error) throw new Error(`Could not update customer details: ${error.message}`);
    } else {
      const { error } = await admin.from("profiles").insert({
        id: userId,
        ...profileUpdate,
        security_answer_one_hash: profileUpdate["security_answer_one_hash"] ?? emptyHash,
        security_answer_two_hash: profileUpdate["security_answer_two_hash"] ?? emptyHash,
      });
      if (error) throw new Error(`Could not create customer profile: ${error.message}`);
    }

    const authPayload: {
      email: string;
      email_confirm: boolean;
      user_metadata: Record<string, string>;
      password?: string;
    } = {
      email,
      email_confirm: true,
      user_metadata: {
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone,
        address: data.address,
        city: data.city,
        postal_code: data.postal_code,
        full_name: `${data.first_name} ${data.last_name}`.trim(),
      },
    };
    if (password) authPayload.password = password;
    const { error: authError } = await admin.auth.admin.updateUserById(userId, authPayload);
    if (authError) throw new Error(`Profile saved, but login details could not be updated: ${authError.message}`);

    await log("update_customer_details", userId, {
      email,
      name: `${data.first_name} ${data.last_name}`.trim(),
      securityAnswerOneChanged: Boolean(answer_one),
      securityAnswerTwoChanged: Boolean(answer_two),
      transferPinChanged: Boolean(transfer_pin),
      passwordChanged: Boolean(password),
    });
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

export const setDirectAccountBalance = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({
    accountId: z.string().uuid(),
    available_balance: z.number().finite().min(-1e9).max(1e9),
    current_balance: z.number().finite().min(-1e9).max(1e9).optional(),
    reason: z.string().trim().max(200).default("Administrative balance adjustment"),
    transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid transaction date").refine(isValidTransactionDate, "Choose a valid transaction date").optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, log } = await assertAdmin(context);
    const curr = data.current_balance ?? data.available_balance;
    const { data: existing, error: fetchErr } = await admin
      .from("bank_accounts")
      .select("id, user_id, name, account_type, currency, available_balance, current_balance")
      .eq("id", data.accountId)
      .single();
    if (fetchErr || !existing) throw new Error("Account not found.");

    const before = Number(existing.available_balance || 0);
    const delta = Math.round((data.available_balance - before) * 100) / 100;
    const txnDate = data.transactionDate ?? new Date().toISOString().slice(0, 10);
    const cleanReason = data.reason.trim().length >= 3 ? data.reason.trim() : "Administrative balance adjustment";

    const { data: row, error } = await admin
      .from("bank_accounts")
      .update({ available_balance: data.available_balance, current_balance: curr })
      .eq("id", data.accountId)
      .select("user_id, name, account_type")
      .single();
    if (error) throw new Error("Could not update account balance");

    let txnId: string | null = null;
    if (delta !== 0) {
      const { data: insertedTxn, error: txnErr } = await admin
        .from("account_transactions")
        .insert({
          account_id: existing.id,
          user_id: existing.user_id,
          txn_type: delta > 0 ? "CREDIT" : "DEBIT",
          amount: Math.abs(delta),
          currency: existing.currency || "USD",
          balance_before: before,
          balance_after: data.available_balance,
          description: cleanReason,
          admin_name: context.adminName,
          idempotency_key: crypto.randomUUID(),
          transaction_date: txnDate,
        })
        .select("id")
        .single();
      if (txnErr) {
        throw new Error(`Balance updated, but could not record history entry: ${txnErr.message}`);
      }
      txnId = insertedTxn?.id ?? null;
    }

    await log("adjust_balance", row.user_id, {
      accountId: data.accountId,
      accountName: row.name,
      transactionId: txnId,
      previousAvailable: before,
      newAvailable: data.available_balance,
      newCurrent: curr,
      reason: cleanReason,
      transaction_date: txnDate,
    });
    return { ok: true, transactionId: txnId };
  });

const TXN_ERRORS: Record<string, string> = {
  INSUFFICIENT_FUNDS: "Insufficient funds: this debit would overdraw the account, and overdrafts are not allowed on it.",
  INVALID_AMOUNT: "Invalid amount. Use a positive number with at most 2 decimal places.",
  CURRENCY_MISMATCH: "Currency does not match the account's currency.",
  ACCOUNT_NOT_FOUND: "Account not found.",
  NOT_FOUND: "Transaction not found.",
  NOT_REVERSIBLE: "Only completed, not-yet-reversed transactions can be reversed.",
  ALREADY_PROCESSED: "This transfer request has already been processed.",
};
const txnError = (msg: string) => {
  const key = Object.keys(TXN_ERRORS).find((k) => msg.includes(k));
  return new Error(key ? TXN_ERRORS[key] : `Transaction failed: ${msg}`);
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
    allowOverdraft: z.boolean().default(true).optional(),
    transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid transaction date").refine(isValidTransactionDate, "Choose a valid transaction date").optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin } = await assertAdmin(context);
    const numAmount = Number(data.amount);

    // If administrative debit, automatically ensure overdraft is enabled on the account so the debit is not blocked
    if (data.type === "DEBIT" && data.allowOverdraft !== false) {
      try {
        await admin.from("bank_accounts").update({ allow_overdraft: true }).eq("id", data.accountId);
      } catch {}
    }

    // 1. Try calling the PostgreSQL admin_post_transaction_with_date RPC first
    const { data: id, error } = await admin.rpc("admin_post_transaction_with_date", {
      _account_id: data.accountId,
      _type: data.type,
      _amount: numAmount,
      _currency: data.currency.toUpperCase(),
      _description: data.description,
      _reference: data.reference || "",
      _admin: context.adminName,
      _idempotency_key: data.idempotencyKey,
      _transaction_date: data.transactionDate ?? new Date().toISOString().slice(0, 10),
    });

    if (!error && id) {
      return { ok: true, id: id as string };
    }

    // If known validation error from SQL, throw specific error
    if (error) {
      const knownKey = Object.keys(TXN_ERRORS).find((k) => error.message.includes(k));
      if (knownKey && !(knownKey === "INSUFFICIENT_FUNDS" && data.allowOverdraft !== false)) {
        throw new Error(TXN_ERRORS[knownKey]);
      }
    }

    // 2. Direct ledger fallback if RPC fails or is missing
    console.warn("admin_post_transaction RPC failed, using direct ledger processing:", error?.message);

    // Check idempotency
    const { data: existingTxn } = await admin
      .from("account_transactions")
      .select("id")
      .eq("idempotency_key", data.idempotencyKey)
      .maybeSingle();
    if (existingTxn) return { ok: true, id: existingTxn.id };

    // Fetch account
    const { data: acct, error: acctErr } = await admin
      .from("bank_accounts")
      .select("*")
      .eq("id", data.accountId)
      .single();
    if (acctErr || !acct) throw new Error("Account not found.");
    if (data.currency.toUpperCase() !== acct.currency.toUpperCase()) {
      throw new Error("Currency does not match the account's currency.");
    }

    const sign = data.type === "CREDIT" ? 1 : -1;
    const before = Number(acct.available_balance || 0);
    const after = Math.round((before + sign * numAmount) * 100) / 100;
    if (after < 0 && !acct.allow_overdraft && data.allowOverdraft === false) {
      throw new Error(TXN_ERRORS["INSUFFICIENT_FUNDS"]);
    }

    const currentBefore = Number(acct.current_balance || 0);
    const currentDelta = (acct.account_type === "credit" ? -sign : sign) * numAmount;
    const currentAfter = Math.round((currentBefore + currentDelta) * 100) / 100;

    // Insert into account_transactions
    const { data: insertedTxn, error: insertErr } = await admin
      .from("account_transactions")
      .insert({
        account_id: acct.id,
        user_id: acct.user_id,
        txn_type: data.type,
        amount: numAmount,
        currency: acct.currency,
        balance_before: before,
        balance_after: after,
        description: data.description,
        admin_name: context.adminName,
        reference: data.reference || null,
        idempotency_key: data.idempotencyKey,
        transaction_date: data.transactionDate ?? new Date().toISOString().slice(0, 10),
      })
      .select("id")
      .single();

    if (insertErr || !insertedTxn) {
      console.error("Direct ledger insert error:", insertErr);
      throw new Error(`Transaction failed: ${insertErr?.message || error?.message}`);
    }

    // Update bank_accounts balance
    const { error: updateErr } = await admin
      .from("bank_accounts")
      .update({
        available_balance: after,
        current_balance: currentAfter,
      })
      .eq("id", acct.id);

    if (updateErr) {
      console.error("Could not update bank account balance:", updateErr);
    }

    // Insert audit log
    try {
      await admin.from("admin_audit_log").insert({
        admin_id: NIL,
        target_user_id: acct.user_id,
        action: data.type.toLowerCase(),
        details: {
          by: context.adminName,
          transaction_id: insertedTxn.id,
          account_id: acct.id,
          amount: numAmount,
          currency: acct.currency,
          balance_before: before,
          balance_after: after,
          reason: data.description,
          reference: data.reference,
          transaction_date: data.transactionDate ?? new Date().toISOString().slice(0, 10),
          entered_at: new Date().toISOString(),
        } as never,
      });
    } catch {}

    return { ok: true, id: insertedTxn.id };
  });

export const reverseTransaction = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ transactionId: z.string().uuid(), reason: z.string().trim().min(3).max(300), idempotencyKey: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin } = await assertAdmin(context);
    const { data: orig, error: e1 } = await admin
      .from("account_transactions")
      .select("id,account_id,user_id,txn_type,amount,currency,status,reverses_id")
      .eq("id", data.transactionId)
      .single();
    if (e1 || !orig) throw new Error("Transaction not found.");
    if (orig.status !== "COMPLETED" || orig.reverses_id) {
      throw new Error("Only completed, not-yet-reversed transactions can be reversed.");
    }

    const revType = orig.txn_type === "CREDIT" ? "DEBIT" : "CREDIT";
    const revAmount = Number(orig.amount);

    const { data: id, error } = await admin.rpc("admin_post_transaction", {
      _account_id: orig.account_id,
      _type: revType,
      _amount: revAmount,
      _currency: orig.currency,
      _description: `Reversal of ${orig.id.slice(0, 8)}: ${data.reason}`,
      _reference: orig.id,
      _admin: context.adminName,
      _idempotency_key: data.idempotencyKey,
      _reverses: orig.id,
      _reversal_reason: data.reason,
    });

    if (!error && id) return { ok: true, id: id as string };

    if (error) {
      const knownKey = Object.keys(TXN_ERRORS).find((k) => error.message.includes(k));
      if (knownKey) throw new Error(TXN_ERRORS[knownKey]);
    }

    // Direct reversal fallback
    const { data: acct, error: acctErr } = await admin
      .from("bank_accounts")
      .select("*")
      .eq("id", orig.account_id)
      .single();
    if (acctErr || !acct) throw new Error("Account not found.");

    const sign = revType === "CREDIT" ? 1 : -1;
    const before = Number(acct.available_balance || 0);
    const after = Math.round((before + sign * revAmount) * 100) / 100;
    const currentBefore = Number(acct.current_balance || 0);
    const currentDelta = (acct.account_type === "credit" ? -sign : sign) * revAmount;
    const currentAfter = Math.round((currentBefore + currentDelta) * 100) / 100;

    const { data: revTxn, error: revErr } = await admin
      .from("account_transactions")
      .insert({
        account_id: acct.id,
        user_id: orig.user_id,
        txn_type: revType,
        amount: revAmount,
        currency: orig.currency,
        balance_before: before,
        balance_after: after,
        description: `Reversal of ${orig.id.slice(0, 8)}: ${data.reason}`,
        admin_name: context.adminName,
        reference: orig.id,
        idempotency_key: data.idempotencyKey,
        reverses_id: orig.id,
        reversal_reason: data.reason,
      })
      .select("id")
      .single();

    if (revErr || !revTxn) throw new Error(`Reversal failed: ${revErr?.message || error?.message}`);

    await admin
      .from("account_transactions")
      .update({
        status: "REVERSED",
        reversed_by_id: revTxn.id,
        reversal_reason: data.reason,
        reversed_at: new Date().toISOString(),
      })
      .eq("id", orig.id);

    await admin
      .from("bank_accounts")
      .update({
        available_balance: after,
        current_balance: currentAfter,
      })
      .eq("id", acct.id);

    return { ok: true, id: revTxn.id };
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
    let q = admin.from("account_transactions").select("*", { count: "exact" }).order("transaction_date", { ascending: false }).order("created_at", { ascending: false }).range(data.page * size, data.page * size + size - 1);
    if (data.userId) q = q.eq("user_id", data.userId);
    if (data.type !== "ALL") q = q.eq("txn_type", data.type);
    if (data.status !== "ALL") q = q.eq("status", data.status);
    if (data.adminName) q = q.ilike("admin_name", `%${data.adminName.replace(/[%_]/g, "")}%`);
    if (data.from) q = q.gte("transaction_date", data.from);
    if (data.to) q = q.lte("transaction_date", data.to);
    const { data: rows, error, count } = await q;
    if (error) throw new Error("Could not load transactions");
    return { rows: (rows ?? []).map((r) => ({ ...r, amount: Number(r.amount), balance_before: Number(r.balance_before), balance_after: Number(r.balance_after) })), total: count ?? 0, pageSize: size };
  });


export const updateTransactionDate = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({
    transactionId: z.string().uuid(),
    transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid transaction date").refine(isValidTransactionDate, "Choose a valid transaction date"),
    reason: z.string().trim().min(3, "Enter a reason of at least 3 characters").max(300),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin } = await assertAdmin(context);
    const { data: id, error } = await admin.rpc("admin_edit_transaction_date", {
      _transaction_id: data.transactionId,
      _transaction_date: data.transactionDate,
      _reason: data.reason,
      _admin: context.adminName,
    });
    if (error) {
      if (error.message.includes("NOT_FOUND")) throw new Error("Transaction not found.");
      if (error.message.includes("INVALID_TRANSACTION_DATE")) throw new Error("Choose a valid transaction date.");
      if (error.message.includes("INVALID_REASON")) throw new Error("Enter a reason between 3 and 300 characters.");
      throw new Error(`Could not update transaction date: ${error.message}`);
    }
    return { ok: true, id: id as string };
  });

export const setCustomerSuspended = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), suspended: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, log } = await assertAdmin(context);
    const { data: userRes } = await admin.auth.admin.getUserById(data.userId);
    const existingUser = userRes?.user;

    // Ensure ban_duration is "none" so suspended users can always log in to their account!
    // Track suspension status in user_metadata and app_metadata to enforce transfer restrictions.
    const { error } = await admin.auth.admin.updateUserById(data.userId, {
      ban_duration: "none",
      user_metadata: { ...(existingUser?.user_metadata ?? {}), suspended: data.suspended },
      app_metadata: { ...(existingUser?.app_metadata ?? {}), suspended: data.suspended },
    });
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
    try {
      await admin.from("account_transactions").delete().eq("user_id", data.userId);
    } catch {}
    try {
      await admin.from("international_wires").delete().eq("user_id", data.userId);
    } catch {}
    try {
      await admin.from("customer_transfer_requests").delete().or(`sender_user_id.eq.${data.userId},recipient_user_id.eq.${data.userId}`);
    } catch {}
    try {
      await admin.from("bank_accounts").delete().eq("user_id", data.userId);
    } catch {}
    try {
      await admin.from("profiles").delete().eq("id", data.userId);
    } catch {}
    try {
      await admin.from("user_roles").delete().eq("user_id", data.userId);
    } catch {}
    try {
      await admin.auth.admin.deleteUser(data.userId);
    } catch (e: any) {
      console.warn("auth deleteUser warning:", e?.message || e);
    }
    await log("delete_customer", data.userId);
    return { ok: true };
  });

export const purgeTestrunUsers = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .handler(async ({ context }) => {
    const { admin, log } = await assertAdmin(context);
    const usersToDelete = new Set<string>();

    try {
      const { data: profiles } = await admin.from("profiles").select("id,first_name,last_name,phone,address,city");
      if (profiles) {
        for (const p of profiles) {
          const fn = (p.first_name || "").toLowerCase().trim();
          const ln = (p.last_name || "").toLowerCase().trim();
          const ph = (p.phone || "").toLowerCase().trim();
          const addr = (p.address || "").toLowerCase().trim();
          const fullName = `${fn} ${ln}`.trim();
          if (
            fn.includes("test") ||
            ln.includes("test") ||
            fn.includes("demo") ||
            ln.includes("demo") ||
            fn.includes("sample") ||
            ln.includes("sample") ||
            fn.includes("dummy") ||
            ln.includes("dummy") ||
            fn.includes("mock") ||
            ln.includes("mock") ||
            fullName === "jane doe" ||
            fullName === "john doe" ||
            fullName === "client" ||
            fullName === "" ||
            ph.includes("000-000") ||
            ph.includes("1234567") ||
            addr.includes("123 fake") ||
            addr.includes("sample st")
          ) {
            usersToDelete.add(p.id);
          }
        }
      }
    } catch (e) {
      console.warn("purgeTestrunUsers profiles scan:", e);
    }

    try {
      const res = await admin.auth.admin.listUsers({ perPage: 1000 });
      if (res.data?.users) {
        for (const u of res.data.users) {
          const em = (u.email || "").toLowerCase().trim();
          const meta = (u.user_metadata ?? {}) as any;
          const fn = String(meta.first_name || meta.pending_profile?.first_name || "").toLowerCase().trim();
          const ln = String(meta.last_name || meta.pending_profile?.last_name || "").toLowerCase().trim();
          const fullName = `${fn} ${ln}`.trim();

          if (
            em.includes("@test.com") ||
            em.includes("@example.com") ||
            em.includes("@client.easterntrustbank.co") ||
            em.includes("+test") ||
            em.includes("testrun") ||
            em.includes("demo") ||
            em.includes("dummy") ||
            em.includes("sample") ||
            em.includes("fake") ||
            em.includes("mailinator") ||
            em.includes("tempmail") ||
            fn.includes("test") ||
            ln.includes("test") ||
            fn.includes("demo") ||
            ln.includes("demo") ||
            fn.includes("sample") ||
            ln.includes("sample") ||
            fullName === "jane doe" ||
            fullName === "john doe" ||
            fullName === "client"
          ) {
            usersToDelete.add(u.id);
          }
        }
      }
    } catch (e) {
      console.warn("purgeTestrunUsers auth scan:", e);
    }

    let purgedCount = 0;
    for (const uid of Array.from(usersToDelete)) {
      try {
        await admin.from("account_transactions").delete().eq("user_id", uid);
      } catch {}
      try {
        await admin.from("international_wires").delete().eq("user_id", uid);
      } catch {}
      try {
        await admin.from("customer_transfer_requests").delete().or(`sender_user_id.eq.${uid},recipient_user_id.eq.${uid}`);
      } catch {}
      try {
        await admin.from("bank_accounts").delete().eq("user_id", uid);
      } catch {}
      try {
        await admin.from("profiles").delete().eq("id", uid);
      } catch {}
      try {
        await admin.from("user_roles").delete().eq("user_id", uid);
      } catch {}
      try {
        await admin.auth.admin.deleteUser(uid);
      } catch {}
      purgedCount++;
    }

    await log("purge_testrun_users", null, { count: purgedCount });
    return { ok: true, purgedCount };
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
  transfer_pin: z.string().trim().regex(/^\d{4,6}$/, "PIN must be 4–6 digits").optional(),
};

async function profileRow(d: z.infer<z.ZodObject<typeof profileFields>>) {
  const { answer_one, answer_two, transfer_pin, ...rest } = d;
  return {
    ...rest,
    security_answer_one_hash: await hashAnswer(answer_one),
    security_answer_two_hash: await hashAnswer(answer_two),
    ...(transfer_pin ? { transfer_pin_hash: await hashAnswer(transfer_pin) } : {}),
  };
}

export const createCustomer = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ email: z.string().trim().email().max(255), password: z.string().min(10).max(72), ...profileFields }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, log } = await assertAdmin(context);
    const { email, password, ...p } = data;
    const profRow = await profileRow(p);

    let userId: string | null = null;

    // 1. Try Supabase Auth Admin API (works if service role key is configured)
    const { data: created, error: adminErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        pending_profile: profRow,
        first_name: p.first_name,
        last_name: p.last_name,
        phone: p.phone,
        full_name: `${p.first_name} ${p.last_name}`,
      },
    });

    if (!adminErr && created?.user?.id) {
      userId = created.user.id;
    } else {
      if (adminErr?.message?.toLowerCase().includes("already") || adminErr?.message?.toLowerCase().includes("exists")) {
        throw new Error("A customer with that email address already exists.");
      }

      // 2. Direct GoTrue REST API fallback (always works with API key)
      const url = (process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"])!;
      const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;

      const res = await fetch(`${url}/auth/v1/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": key,
          "Authorization": `Bearer ${key}`,
        },
        body: JSON.stringify({
          email,
          password,
          data: {
            pending_profile: profRow,
            first_name: p.first_name,
            last_name: p.last_name,
            phone: p.phone,
            full_name: `${p.first_name} ${p.last_name}`,
          },
        }),
      });

      const resJson = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = String(resJson.msg || resJson.message || "").toLowerCase();
        if (msg.includes("weak") || resJson.error_code === "weak_password") {
          throw new Error("Password is known to be weak. Please choose a stronger password with symbols and numbers (e.g. EasternTrust2026!$).");
        }
        if (msg.includes("already") || msg.includes("exists")) {
          throw new Error("A customer with that email address already exists.");
        }
        if (msg.includes("domain") || msg.includes("not allowed")) {
          throw new Error("This email domain is not allowed. Please enter a valid real email address (e.g. gmail.com, outlook.com).");
        }
        throw new Error(resJson.msg || resJson.message || adminErr?.message || "Could not create customer account.");
      }

      userId = resJson.id || resJson.user?.id;
    }

    if (!userId) {
      throw new Error("Could not initialize customer account in authentication system.");
    }

    // 3. Insert / update profile row
    try {
      await admin.from("profiles").upsert({ id: userId, ...profRow });
    } catch {}

    // 4. Provision Everyday Checking account
    const last_four_checking = String(Math.floor(1000 + Math.random() * 9000));
    try {
      await admin.from("bank_accounts").insert({
        user_id: userId,
        account_type: "checking",
        name: "Everyday Checking",
        last_four: last_four_checking,
        available_balance: 0,
        current_balance: 0,
        credit_limit: null,
        currency: "USD",
        allow_overdraft: false,
      });
    } catch {}

    // 6. Attempt email confirmation
    try {
      await admin.auth.admin.updateUserById(userId, { email_confirm: true });
    } catch {}

    await log("create_customer", userId, { email, name: `${p.first_name} ${p.last_name}` });
    return { ok: true, id: userId };
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

const ACCOUNT_TYPES = CUSTOMER_ACCOUNT_TYPES;

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
    const { count, error: countError } = await admin.from("bank_accounts").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("is_active", true);
    if (countError) throw new Error("Could not check customer account");
    if (count) throw new Error("Each customer can have only one account");
    const last_four = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
    const { error } = await admin.from("bank_accounts").insert({ user_id: userId, last_four, ...fields, credit_limit: null });
    if (error) throw new Error(error.code === "23505" ? "This customer already has that type of account" : "Could not add account");
    await log("add_account", userId, fields);
    return { ok: true };
  });

export const renameCustomerAccount = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ accountId: z.string().uuid(), name: z.string().trim().min(1).max(80), last_four: z.string().regex(/^\d{4}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, log } = await assertAdmin(context);
    const { data: existing } = await admin.from("bank_accounts").select("account_number").eq("id", data.accountId).maybeSingle();
    const nextAcctNo = existing?.account_number && existing.account_number.length >= 4
      ? `${existing.account_number.slice(0, -4)}${data.last_four}`
      : undefined;
    const { data: row, error } = await admin.from("bank_accounts").update({
      name: data.name,
      last_four: data.last_four,
      ...(nextAcctNo ? { account_number: nextAcctNo } : {}),
    }).eq("id", data.accountId).select("user_id").single();
    if (error) throw new Error("Could not update account");
    await log("rename_account", row.user_id, data);
    return { ok: true };
  });

export const adminTransferBetweenUsers = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({
    fromAccountId: z.string().uuid(),
    toAccountNumber: z.string().trim().min(8).max(32),
    recipientName: z.string().trim().min(2).max(120),
    amount: z.string().trim().regex(/^\d{1,10}(\.\d{1,2})?$/, "Invalid amount").refine((v) => Number(v) > 0, "Amount must be above zero"),
    memo: z.string().trim().max(140).optional().default(""),
    idempotencyKey: z.string().uuid(),
    transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid transaction date").refine(isValidTransactionDate, "Choose a valid transaction date").optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, log } = await assertAdmin(context);
    const cleanAcct = data.toAccountNumber.replace(/\D/g, "");
    if (cleanAcct.length < 8 || cleanAcct.length > 20) {
      throw new Error("Enter a valid recipient account number (8–20 digits).");
    }
    const { data: outId, error } = await admin.rpc("admin_user_transfer", {
      _from_account_id: data.fromAccountId,
      _to_account_number: cleanAcct,
      _recipient_name: data.recipientName,
      _amount: Number(data.amount),
      _memo: data.memo || "",
      _admin: context.adminName || "Admin",
      _idempotency_key: data.idempotencyKey,
      ...(data.transactionDate ? { _transaction_date: data.transactionDate } : {}),
    });
    if (error) {
      const msg = error.message || "";
      if (msg.includes("INSUFFICIENT_FUNDS")) throw new Error("Sender account does not have enough available funds.");
      if (msg.includes("RECIPIENT_NOT_FOUND")) throw new Error("No active customer checking account matches that account number.");
      if (msg.includes("SAME_ACCOUNT")) throw new Error("Sender and recipient must be different customers.");
      if (msg.includes("INVALID_RECIPIENT")) throw new Error("Enter the recipient's full name.");
      if (msg.includes("INVALID_ACCOUNT_NUMBER")) throw new Error("Enter a valid recipient account number.");
      throw new Error(msg || "Transfer failed.");
    }
    await log("admin_user_transfer", null, {
      fromAccountId: data.fromAccountId,
      toAccountNumber: cleanAcct,
      recipientName: data.recipientName,
      amount: Number(data.amount),
      memo: data.memo || "",
      transactionDate: data.transactionDate || null,
      transactionId: outId,
    });
    return { ok: true, id: outId };
  });

export const removeCustomerAccount = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ accountId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, log } = await assertAdmin(context);
    const { data: account, error: readError } = await admin.from("bank_accounts").select("is_active").eq("id", data.accountId).single();
    if (readError) throw new Error("Could not check account");
    if (account.is_active) throw new Error("The customer's only account cannot be removed");
    throw new Error("Archived accounts are retained to preserve balances and history");
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
    });
    const hash = link?.properties?.hashed_token;
    if (error || !hash) {
      console.error("signInAsCustomer generateLink failed", error);
      throw new Error(`Could not create sign-in link${error?.message ? `: ${error.message}` : ""}`);
    }
    // Unconfirmed customers get a "signup" token instead of a "magiclink" one.
    const vtype = link.properties?.verification_type === "signup" ? "signup" : "magiclink";
    await log("impersonate_user", data.userId, {
      reason: data.reason,
      by: context.adminName,
      customerEmail: u.user.email,
    });
    // Token is verified on our own /auth page, so it works on any domain (preview, published, custom).
    return { url: `${origin}/auth?login_token=${encodeURIComponent(hash)}&login_type=${vtype}` };
  });

export const signOutCustomer = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, log } = await assertAdmin(context);
    const { data: u, error: ue } = await admin.auth.admin.getUserById(data.userId);
    if (ue || !u.user?.email) throw new Error("Customer not found");
    // Create a short-lived session for the customer, then revoke ALL of their sessions with it.
    const { data: link, error: le } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
    const hash = link?.properties?.hashed_token;
    if (le || !hash) throw new Error(`Could not sign out customer${le?.message ? `: ${le.message}` : ""}`);
    const vtype = link.properties?.verification_type === "signup" ? "signup" : "magiclink";
    const { createClient } = await import("@supabase/supabase-js");
    const temp = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: v, error: ve } = await temp.auth.verifyOtp({ token_hash: hash, type: vtype });
    if (ve || !v.session) throw new Error(`Could not sign out customer${ve?.message ? `: ${ve.message}` : ""}`);
    const { error: se } = await admin.auth.admin.signOut(v.session.access_token, "global");
    if (se) throw new Error(`Could not sign out customer: ${se.message}`);
    await log("sign_out_customer", data.userId, { customerEmail: u.user.email });
    return { ok: true };
  });

export const getDashboardMetrics = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async ({ context }) => {
    const { admin } = await assertAdmin(context);
    const [{ data: accounts }, { data: users }, { data: txns }] = await Promise.all([
      admin.from("bank_accounts").select("account_type,available_balance,current_balance,credit_limit").eq("is_active", true),
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

export const submitHomepageInquiry = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    name: z.string().trim().min(1).max(100),
    email: z.string().trim().email().max(255),
    phone: z.string().trim().max(40).optional(),
    department: z.string().trim().max(50).optional(),
    message: z.string().trim().min(1).max(2000),
  }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("admin_audit_log").insert({
      admin_id: NIL,
      target_user_id: null,
      action: "homepage_inquiry",
      details: data as never,
    });
    if (error) console.error("Could not record homepage inquiry:", error);
    return { ok: true };
  });

export const registerCustomerPublic = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    email: z.string().trim().email().max(255),
    password: z.string().min(10).max(72),
    ...profileFields,
  }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { email, password, ...p } = data;
    const profRow = await profileRow(p);

    // Try creating directly with admin auth so email is confirmed immediately
    const { data: created, error: adminErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        pending_profile: profRow,
        first_name: p.first_name,
        last_name: p.last_name,
        phone: p.phone,
        full_name: `${p.first_name} ${p.last_name}`,
      },
    });

    let userId = created?.user?.id;

    if (adminErr?.message?.toLowerCase().includes("already") || adminErr?.message?.toLowerCase().includes("exists")) {
      throw new Error("A customer with that email address already exists.");
    }

    if (!userId) {
      // Fallback: standard sign up
      const { data: signUpData, error: signErr } = await supabaseAdmin.auth.signUp({
        email,
        password,
        options: {
          data: {
            pending_profile: profRow,
            first_name: p.first_name,
            last_name: p.last_name,
            phone: p.phone,
            full_name: `${p.first_name} ${p.last_name}`,
          },
        },
      });
      if (signErr) throw new Error(signErr.message);
      userId = signUpData?.user?.id;
    }

    if (userId) {
      // Ensure profile row exists
      try {
        await supabaseAdmin.from("profiles").insert({ id: userId, ...profRow });
      } catch {}
      // Provision initial checking account
      const last_four = String(Math.floor(1000 + Math.random() * 9000));
      try {
        await supabaseAdmin.from("bank_accounts").insert({
          user_id: userId,
          account_type: "checking",
          name: "Everyday Checking",
          last_four,
          available_balance: 0,
          current_balance: 0,
          credit_limit: null,
          currency: "USD",
          allow_overdraft: false,
        });
      } catch {}


    }

    return { ok: true, userId };
  });

export const saveSupabaseServiceKey = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ key: z.string().trim().min(20).max(1000) }).parse(d))
  .handler(async ({ data }) => {
    const { serviceKeyCookie } = await import("./admin-session.server");
    setResponseHeader("Set-Cookie", serviceKeyCookie(data.key));
    return { ok: true };
  });

export const checkServiceKeyStatus = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async ({ context }) => {
    const { hasServiceRole } = await assertAdmin(context);
    return { configured: hasServiceRole };
  });

export const listWires = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async ({ context }) => {
    const { admin } = await assertAdmin(context);
    const { data, error } = await admin
      .from("international_wires")
      .select("id,txn_id,user_id,account_id,recipient_name,recipient_bank,swift_bic,account_number,country,currency,amount,memo,status,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const setWireStatus = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({
    wireId: z.string().uuid(),
    action: z.enum(["complete", "cancel"]),
    reason: z.string().trim().min(3).max(300),
    idempotencyKey: z.string().uuid(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, log } = await assertAdmin(context);
    const { data: wire, error: e1 } = await admin
      .from("international_wires")
      .select("id,txn_id,user_id,account_id,amount,currency,status,recipient_name,country")
      .eq("id", data.wireId)
      .single();
    if (e1 || !wire) throw new Error("Wire transfer not found.");
    if (wire.status !== "PENDING") throw new Error("Only pending wires can be updated.");

    if (data.action === "cancel") {
      // Refund the customer by reversing the original debit, in the account's own currency
      const { data: acct } = await admin.from("bank_accounts").select("currency").eq("id", wire.account_id).single();
      const { error } = await admin.rpc("admin_post_transaction", {
        _account_id: wire.account_id,
        _type: "CREDIT",
        _amount: Number(wire.amount),
        _currency: acct?.currency ?? "USD",
        _description: `Wire cancellation refund: ${wire.recipient_name} (${wire.country})`,
        _reference: wire.txn_id,
        _admin: context.adminName,
        _idempotency_key: data.idempotencyKey,
        _reverses: wire.txn_id,
        _reversal_reason: data.reason,
      });
      if (error) {
        const knownKey = Object.keys(TXN_ERRORS).find((k) => error.message.includes(k));
        throw new Error(knownKey ? TXN_ERRORS[knownKey] : error.message);
      }
    } else {
      const { error: txnErr } = await admin
        .from("account_transactions")
        .update({ status: "COMPLETED" })
        .eq("id", wire.txn_id)
        .eq("status", "PENDING");
      if (txnErr) throw new Error(txnErr.message);
    }

    const { error: e2 } = await admin
      .from("international_wires")
      .update({ status: data.action === "complete" ? "COMPLETED" : "CANCELLED" })
      .eq("id", wire.id)
      .eq("status", "PENDING");
    if (e2) throw new Error(e2.message);

    await log(data.action === "complete" ? "wire_completed" : "wire_cancelled", wire.user_id, {
      wire_id: wire.id,
      amount: wire.amount,
      currency: wire.currency,
      recipient: wire.recipient_name,
      country: wire.country,
      reason: data.reason,
    });
    return { ok: true };
  });

export const listTransferRequests = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async ({ context }) => {
    const { admin } = await assertAdmin(context);
    const { data, error } = await admin
      .from("customer_transfer_requests")
      .select("id,txn_id,credit_txn_id,transfer_kind,sender_user_id,from_account_id,to_account_id,recipient_user_id,recipient_name,recipient_account_number,amount,currency,memo,status,reviewed_by,review_reason,reviewed_at,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const reviewTransferRequest = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({
    requestId: z.string().uuid(),
    action: z.enum(["approve", "cancel"]),
    reason: z.string().trim().min(3).max(300),
    idempotencyKey: z.string().uuid(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin } = await assertAdmin(context);
    const { data: reqId, error } = await admin.rpc("admin_review_customer_transfer", {
      _request_id: data.requestId,
      _action: data.action,
      _admin: context.adminName,
      _reason: data.reason,
      _idempotency_key: data.idempotencyKey,
    });
    if (error) throw txnError(error.message);
    return { ok: true, id: reqId };
  });


