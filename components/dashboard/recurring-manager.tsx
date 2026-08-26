"use client";

import { Dialog } from "@/components/ui/dialog";
import { RecurringList } from "@/components/dashboard/recurring-list";
import type { Account, RecurringRule } from "@/lib/budget/types";

type AccountLookup = Record<string, Account>;

/**
 * Everything currently set to repeat, in one place.
 *
 * A dialog rather than a band on the Transactions page: schedules aren't part
 * of the month you're reading, they're the settings behind it, and a standing
 * list of them would push the actual ledger down the page every time you
 * opened it. This is where you come to change one, which is rare.
 */
export function RecurringManager({
  uid,
  rules,
  accounts,
  loading,
  open,
  onClose,
  onEdit,
}: {
  uid: string | null;
  rules: RecurringRule[];
  accounts: AccountLookup;
  loading: boolean;
  open: boolean;
  onClose: () => void;
  onEdit: (rule: RecurringRule) => void;
}) {
  const running = rules.filter((rule) => rule.active).length;
  const paused = rules.length - running;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title="Recurring entries"
      description={
        rules.length === 0
          ? "Tick Repeat when you add an entry and it will show up here."
          : `${running} running${paused > 0 ? `, ${paused} paused` : ""}. Recorded for you as they fall due.`
      }
    >
      <RecurringList
        uid={uid}
        rules={rules}
        accounts={accounts}
        loading={loading}
        onEdit={onEdit}
      />
    </Dialog>
  );
}
