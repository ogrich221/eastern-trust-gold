import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { currentTransactionDate, formatTransactionDate, isValidTransactionDate } from "./transaction-date";

describe("admin transaction dates", () => {
  it("keeps the exact calendar date selected by the admin", () => {
    assert.equal(isValidTransactionDate("2026-11-01"), true);
    assert.equal(formatTransactionDate("2026-11-01"), "Nov 1, 2026");
  });

  it("rejects impossible or incomplete dates", () => {
    assert.equal(isValidTransactionDate("2026-02-29"), false);
    assert.equal(isValidTransactionDate("2028-02-29"), true);
    assert.equal(isValidTransactionDate("2026-13-01"), false);
    assert.equal(isValidTransactionDate(""), false);
  });

  it("defaults the picker to the admin's current local date", () => {
    assert.equal(currentTransactionDate(new Date(2026, 0, 2, 23, 59)), "2026-01-02");
  });
});
