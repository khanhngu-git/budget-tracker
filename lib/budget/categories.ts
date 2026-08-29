/**
 * Themes for everyday-account transactions. Savings, Investments and Debt
 * accounts change only through transfers and balance adjustments, so they
 * carry no category.
 */

import type { IconName } from "@/components/ui/icon";

export type CategoryFlow = "income" | "expense";

/**
 * The heading a category sits under in the picker.
 *
 * Groups exist because the list is now long enough that a flat grid is a
 * search rather than a choice — "Phone" is findable in seconds under Home &
 * bills, and only by scanning in an alphabet.
 */
export const CATEGORY_GROUPS = [
  "Earnings",
  "Money in",
  "Home & bills",
  "Food & drink",
  "Getting around",
  "Health & care",
  "Life & family",
  "Fun & extras",
  "Money out",
] as const;
export type CategoryGroup = (typeof CATEGORY_GROUPS)[number];

export type Category = {
  id: string;
  label: string;
  flow: CategoryFlow;
  group: CategoryGroup;
  icon: IconName;
};

/**
 * Ids are permanent: every transaction ever recorded points at one, and a goal
 * document is keyed by it. Labels, icons and groups are presentation and can
 * be changed freely; ids can only ever be added.
 */
export const CATEGORIES: Category[] = [
  /* ── Income ───────────────────────────────────────────────────────── */
  { id: "salary", label: "Salary", flow: "income", group: "Earnings", icon: "banknote" },
  { id: "bonus", label: "Bonus", flow: "income", group: "Earnings", icon: "medal" },
  { id: "freelance", label: "Freelance", flow: "income", group: "Earnings", icon: "laptop" },
  { id: "pension", label: "Pension", flow: "income", group: "Earnings", icon: "vault" },
  { id: "benefits", label: "Benefits", flow: "income", group: "Earnings", icon: "shield" },

  { id: "interest", label: "Interest", flow: "income", group: "Money in", icon: "percent" },
  { id: "investment-income", label: "Dividends", flow: "income", group: "Money in", icon: "trendUp" },
  { id: "rent-income", label: "Rent received", flow: "income", group: "Money in", icon: "key" },
  { id: "sale", label: "Something I sold", flow: "income", group: "Money in", icon: "tag" },
  { id: "refund", label: "Refund", flow: "income", group: "Money in", icon: "undo" },
  { id: "gift-in", label: "Gift received", flow: "income", group: "Money in", icon: "gift" },
  { id: "other-income", label: "Other income", flow: "income", group: "Money in", icon: "sparkle" },

  /* ── Expense ──────────────────────────────────────────────────────── */
  { id: "rent", label: "Rent or mortgage", flow: "expense", group: "Home & bills", icon: "home" },
  { id: "bills", label: "Bills", flow: "expense", group: "Home & bills", icon: "receipt" },
  { id: "utilities", label: "Gas & electric", flow: "expense", group: "Home & bills", icon: "bolt" },
  { id: "water", label: "Water", flow: "expense", group: "Home & bills", icon: "droplet" },
  { id: "phone", label: "Phone", flow: "expense", group: "Home & bills", icon: "phone" },
  { id: "internet", label: "Internet", flow: "expense", group: "Home & bills", icon: "wifi" },
  { id: "council-tax", label: "Council tax", flow: "expense", group: "Home & bills", icon: "bank" },
  { id: "home-maintenance", label: "Home upkeep", flow: "expense", group: "Home & bills", icon: "wrench" },
  { id: "insurance", label: "Insurance", flow: "expense", group: "Home & bills", icon: "shield" },

  { id: "groceries", label: "Groceries", flow: "expense", group: "Food & drink", icon: "basket" },
  { id: "dining", label: "Dining out", flow: "expense", group: "Food & drink", icon: "cutlery" },
  { id: "coffee", label: "Coffee", flow: "expense", group: "Food & drink", icon: "coffee" },
  { id: "drinks", label: "Drinks", flow: "expense", group: "Food & drink", icon: "glass" },

  { id: "fuel", label: "Petrol", flow: "expense", group: "Getting around", icon: "fuel" },
  { id: "transport", label: "Car & upkeep", flow: "expense", group: "Getting around", icon: "car" },
  { id: "public-transport", label: "Public transport", flow: "expense", group: "Getting around", icon: "bus" },
  { id: "travel", label: "Travel", flow: "expense", group: "Getting around", icon: "plane" },

  { id: "health", label: "Health", flow: "expense", group: "Health & care", icon: "pill" },
  { id: "fitness", label: "Fitness", flow: "expense", group: "Health & care", icon: "dumbbell" },
  { id: "personal-care", label: "Personal care", flow: "expense", group: "Health & care", icon: "scissors" },

  { id: "childcare", label: "Childcare", flow: "expense", group: "Life & family", icon: "baby" },
  { id: "pets", label: "Pets", flow: "expense", group: "Life & family", icon: "paw" },
  { id: "education", label: "Education", flow: "expense", group: "Life & family", icon: "cap" },
  { id: "gift-out", label: "Gifts", flow: "expense", group: "Life & family", icon: "gift" },
  { id: "charity", label: "Giving", flow: "expense", group: "Life & family", icon: "heart" },

  { id: "shopping", label: "Shopping", flow: "expense", group: "Fun & extras", icon: "bag" },
  { id: "clothing", label: "Clothes", flow: "expense", group: "Fun & extras", icon: "tag" },
  { id: "entertainment", label: "Entertainment", flow: "expense", group: "Fun & extras", icon: "play" },
  { id: "subscriptions", label: "Subscriptions", flow: "expense", group: "Fun & extras", icon: "repeat" },
  { id: "membership", label: "Membership", flow: "expense", group: "Fun & extras", icon: "card" },

  { id: "fees", label: "Fees & interest", flow: "expense", group: "Money out", icon: "percent" },
  { id: "tax", label: "Tax", flow: "expense", group: "Money out", icon: "scales" },
  { id: "other-expense", label: "Other", flow: "expense", group: "Money out", icon: "dots" },
];

const BY_ID = new Map(CATEGORIES.map((category) => [category.id, category]));

export function categoriesFor(flow: CategoryFlow): Category[] {
  return CATEGORIES.filter((category) => category.flow === flow);
}

/** Categories of one flow, in group order, with empty groups dropped. */
export function groupedCategories(
  flow: CategoryFlow,
): { group: CategoryGroup; categories: Category[] }[] {
  return CATEGORY_GROUPS.map((group) => ({
    group,
    categories: CATEGORIES.filter(
      (category) => category.flow === flow && category.group === group,
    ),
  })).filter((entry) => entry.categories.length > 0);
}

export function findCategory(id: string | null): Category | null {
  return id ? (BY_ID.get(id) ?? null) : null;
}

export function categoryLabel(id: string | null): string {
  if (!id) return "Transfer";
  return BY_ID.get(id)?.label ?? "Uncategorised";
}

export function categoryIcon(id: string | null): IconName {
  if (!id) return "swap";
  return BY_ID.get(id)?.icon ?? "dots";
}
