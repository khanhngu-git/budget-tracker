"use client";

import { Select } from "@/components/ui/select";
import {
  ACCOUNT_TYPE_ICONS,
  canSpendFrom,
  type Account,
} from "@/lib/budget/types";

/**
 * The accounts an entry is most likely to land on, first.
 *
 * Everyday income and expenses usually come out of the accounts you actually
 * pay with — including a card, which is spent from exactly like a current
 * account — so those lead. If the user has kept none, every account is offered
 * rather than blocking the entry: recording what happened matters more than
 * the tidiness of the model.
 */
export function spendableAccounts(accounts: Account[]): Account[] {
  const everyday = accounts.filter((account) => canSpendFrom(account.type));
  return everyday.length > 0 ? everyday : accounts;
}

/**
 * Which account an entry is charged to.
 *
 * Every account is offered, not just the everyday ones: a bonus really can be
 * paid straight into savings, and a fee really can come out of a brokerage
 * account. Grouping — rather than filtering — is what keeps the common answer
 * at the top of the list without making the true one unreachable, which is
 * what previously pushed those entries onto the wrong account.
 *
 * Shown whenever there is more than one account, including when the everyday
 * ones number one: "which account?" is a real question the moment a second
 * account exists.
 */
export function AccountSelect({
  id,
  accounts,
  value,
  onChange,
  disabled,
}: {
  id: string;
  accounts: Account[];
  value: string;
  onChange: (accountId: string) => void;
  disabled?: boolean;
}) {
  const everyday = accounts.filter((account) => canSpendFrom(account.type));
  const rest = accounts.filter((account) => !canSpendFrom(account.type));

  // Ordered before mapping, because the list draws each group's heading where
  // that group's first option falls.
  const options = [...everyday, ...rest].map((account) => ({
    value: account.id,
    label: account.name,
    icon: ACCOUNT_TYPE_ICONS[account.type],
    // A lone heading tells the reader nothing, and the Select drops it.
    group: canSpendFrom(account.type) ? "Everyday" : "Other accounts",
  }));

  return (
    <Select
      id={id}
      value={value}
      options={options}
      onChange={onChange}
      disabled={disabled}
    />
  );
}
