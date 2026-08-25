/**
 * Themes for Spending-account transactions. Savings and Investments change
 * only through transfers and balance adjustments, so they carry no category.
 */

import type { IconName } from "@/components/ui/icon";

export type CategoryFlow = "income" | "expense";

export type Category = {
  id: string;
  label: string;
  flow: CategoryFlow;
  icon: IconName;
};

export const CATEGORIES: Category[] = [
  // Income
  { id: "salary", label: "Salary", flow: "income", icon: "banknote" },
  { id: "freelance", label: "Freelance", flow: "income", icon: "laptop" },
  { id: "refund", label: "Refund", flow: "income", icon: "undo" },
  { id: "gift-in", label: "Gift received", flow: "income", icon: "gift" },
  { id: "other-income", label: "Other income", flow: "income", icon: "sparkle" },

  // Expense
  { id: "rent", label: "Rent", flow: "expense", icon: "home" },
  { id: "groceries", label: "Groceries", flow: "expense", icon: "basket" },
  { id: "dining", label: "Dining out", flow: "expense", icon: "cutlery" },
  { id: "utilities", label: "Utilities", flow: "expense", icon: "bolt" },
  { id: "transport", label: "Transport", flow: "expense", icon: "car" },
  { id: "membership", label: "Membership", flow: "expense", icon: "card" },
  { id: "health", label: "Health", flow: "expense", icon: "heart" },
  { id: "shopping", label: "Shopping", flow: "expense", icon: "bag" },
  {
    id: "entertainment",
    label: "Entertainment",
    flow: "expense",
    icon: "play",
  },
  { id: "education", label: "Education", flow: "expense", icon: "cap" },
  { id: "travel", label: "Travel", flow: "expense", icon: "plane" },
  { id: "other-expense", label: "Other", flow: "expense", icon: "dots" },
];

const BY_ID = new Map(CATEGORIES.map((category) => [category.id, category]));

export function categoriesFor(flow: CategoryFlow): Category[] {
  return CATEGORIES.filter((category) => category.flow === flow);
}

export function categoryLabel(id: string | null): string {
  if (!id) return "Transfer";
  return BY_ID.get(id)?.label ?? "Uncategorised";
}

export function categoryIcon(id: string | null): IconName {
  if (!id) return "swap";
  return BY_ID.get(id)?.icon ?? "dots";
}
