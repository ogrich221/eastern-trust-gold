import { test } from "node:test";
import assert from "node:assert/strict";
import { CUSTOMER_ACCOUNT_TYPES, usableCustomerAccounts } from "./customer-account";

test("a customer has only one usable account for credits and debits", () => {
  const accounts = [
    { id: "primary", account_type: "checking", is_active: true },
    { id: "second", account_type: "checking", is_active: true },
    { id: "card", account_type: "credit", is_active: false },
  ];
  assert.deepEqual(usableCustomerAccounts(accounts).map((a) => a.id), ["primary"]);
  assert.deepEqual(CUSTOMER_ACCOUNT_TYPES, ["checking"]);
});

test("archived accounts remain unchanged and are not usable", () => {
  const archived = { id: "archived", account_type: "checking", is_active: false, available_balance: 250 };
  assert.deepEqual(usableCustomerAccounts([archived]), []);
  assert.equal(archived.available_balance, 250);
});