import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { GOAL_SCOPES, goalId, type Goal, type GoalScope } from "./types";

/**
 * A month's plan: what the user means to earn, put away, invest and stay under
 * during that month specifically.
 *
 * Goals live under the month they belong to, so August's plan is a different
 * set of documents from July's and editing one can never move the other. One
 * document per goal within a month, keyed so a scope can't be budgeted twice.
 */
export function goalsPath(uid: string, monthKey: string) {
  return collection(db, "users", uid, "budgets", monthKey, "goals");
}

export function goalDoc(uid: string, monthKey: string, id: string) {
  return doc(db, "users", uid, "budgets", monthKey, "goals", id);
}

/** Where an older build kept a single set of goals shared by every month. */
function legacyGoalsPath(uid: string) {
  return collection(db, "users", uid, "budgets");
}

/** Goals by document id. */
export type GoalMap = Record<string, Goal>;

export async function setGoal(
  uid: string,
  monthKey: string,
  scope: GoalScope,
  categoryId: string | null,
  amountCents: number,
): Promise<void> {
  await setDoc(goalDoc(uid, monthKey, goalId(scope, categoryId)), {
    scope,
    categoryId: scope === "expense" ? categoryId : null,
    amountCents,
  });
}

export async function removeGoal(
  uid: string,
  monthKey: string,
  id: string,
): Promise<void> {
  await deleteDoc(goalDoc(uid, monthKey, id));
}

function parseGoal(id: string, data: Record<string, unknown>): Goal | null {
  const amountCents =
    typeof data.amountCents === "number"
      ? data.amountCents
      : // Older expense budgets stored the ceiling under `limitCents`.
        typeof data.limitCents === "number"
        ? data.limitCents
        : null;
  if (amountCents === null || amountCents <= 0) return null;

  const scope = GOAL_SCOPES.includes(data.scope as GoalScope)
    ? (data.scope as GoalScope)
    : "expense";

  const categoryId =
    scope === "expense"
      ? typeof data.categoryId === "string"
        ? data.categoryId
        : id.replace(/^expense:/, "")
      : null;

  if (scope === "expense" && !categoryId) return null;

  return { id, scope, categoryId, amountCents };
}

function collect(
  docs: { id: string; data: () => Record<string, unknown> }[],
): GoalMap {
  const goals: GoalMap = {};
  for (const document of docs) {
    const goal = parseGoal(document.id, document.data());
    if (goal) goals[document.id] = goal;
  }
  return goals;
}

export function subscribeGoals(
  uid: string,
  monthKey: string,
  onChange: (goals: GoalMap) => void,
  onError: (error: unknown) => void,
) {
  return onSnapshot(
    goalsPath(uid, monthKey),
    (snapshot) => onChange(collect(snapshot.docs)),
    onError,
  );
}

export async function readGoals(
  uid: string,
  monthKey: string,
): Promise<GoalMap> {
  return collect((await getDocs(goalsPath(uid, monthKey))).docs);
}

/**
 * Duplicates one month's plan into another.
 *
 * Months are independent by design, which would otherwise mean rebuilding the
 * same plan every four weeks. Copying is explicit and one-directional: it never
 * runs on its own, and it refuses to overwrite a month that already has a plan.
 */
export async function copyGoals(
  uid: string,
  fromMonthKey: string,
  toMonthKey: string,
): Promise<number> {
  const source = await readGoals(uid, fromMonthKey);
  const entries = Object.values(source);
  if (entries.length === 0) return 0;

  const batch = writeBatch(db);
  for (const goal of entries) {
    batch.set(goalDoc(uid, toMonthKey, goal.id), {
      scope: goal.scope,
      categoryId: goal.categoryId,
      amountCents: goal.amountCents,
    });
  }
  await batch.commit();
  return entries.length;
}

/**
 * Moves goals from the build that shared one plan across all months into the
 * month given, then clears them.
 *
 * The old documents sat directly in `budgets/`, while month plans live in
 * `budgets/{month}/goals/` — a subcollection whose parent document is never
 * written. That's what makes this safe to detect: anything actually returned
 * by a read of `budgets/` is, by construction, a leftover from the old shape.
 */
export async function migrateLegacyGoals(
  uid: string,
  intoMonthKey: string,
): Promise<number> {
  const legacy = await getDocs(legacyGoalsPath(uid));
  if (legacy.empty) return 0;

  const goals = Object.values(collect(legacy.docs));
  const existing = await readGoals(uid, intoMonthKey);
  const batch = writeBatch(db);

  // Only seed the month if it has no plan of its own — a migration must never
  // overwrite something the user has already set up here.
  if (Object.keys(existing).length === 0) {
    for (const goal of goals) {
      batch.set(goalDoc(uid, intoMonthKey, goal.id), {
        scope: goal.scope,
        categoryId: goal.categoryId,
        amountCents: goal.amountCents,
      });
    }
  }

  for (const document of legacy.docs) batch.delete(document.ref);
  await batch.commit();
  return goals.length;
}
