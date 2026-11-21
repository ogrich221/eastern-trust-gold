export const CUSTOMER_ACCOUNT_TYPES = ["checking"] as const;

export function usableCustomerAccounts<T extends { account_type: string; is_active?: boolean }>(accounts: T[]): T[] {
  return accounts.filter((account) => account.account_type === "checking" && account.is_active !== false).slice(0, 1);
}