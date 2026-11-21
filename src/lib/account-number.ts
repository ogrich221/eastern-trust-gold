export function cleanAccountNumber(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function isValidAccountNumber(raw: string): boolean {
  const digits = cleanAccountNumber(raw);
  return digits.length >= 8 && digits.length <= 20;
}

export function formatAccountNumber(raw?: string | null, lastFour?: string): string {
  const digits = cleanAccountNumber(raw ?? "");
  if (digits.length === 12) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8, 12)}`;
  }
  if (digits.length >= 8) {
    return digits.replace(/(.{4})(?=.)/g, "$1 ").trim();
  }
  return `•••• •••• ${lastFour ?? "0000"}`;
}