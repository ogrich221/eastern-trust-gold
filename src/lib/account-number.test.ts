import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cleanAccountNumber, formatAccountNumber, isValidAccountNumber } from "./account-number";

describe("account numbers", () => {
  it("strips spaces and hyphens and validates 8 to 20 digit account numbers", () => {
    assert.equal(cleanAccountNumber("8204-1001 4617"), "820410014617");
    assert.equal(isValidAccountNumber("8204 1001 4617"), true);
    assert.equal(isValidAccountNumber("1234567"), false);
    assert.equal(isValidAccountNumber("123456789012345678901"), false);
  });

  it("formats 12-digit account numbers into 4-digit groups", () => {
    assert.equal(formatAccountNumber("820410014617", "4617"), "8204 1001 4617");
    assert.equal(formatAccountNumber(null, "4617"), "•••• •••• 4617");
  });
});