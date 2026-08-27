"use client";

import { Select } from "@/components/ui/field";
import { canSpendFrom, type Account } from "@/lib/budget/types";

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
  const options = (list: Account[]) =>
    list.map((option) => (
      <option key={option.id} value={option.id}>
        {option.name}
      </option>
    ));

  return (
    <Select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
    >
      {/* Groups only earn their labels when there are two of them. */}
      {everyday.length > 0 && rest.length > 0 ? (
        <>
          <optgroup label="Everyday">{options(everyday)}</optgroup>
          <optgroup label="Other accounts">{options(rest)}</optgroup>
        </>
      ) : (
        options(accounts)
      )}
    </Select>
  );
}
