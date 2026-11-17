// Cross-space pull lineage. A row pulled from another space carries
// `copiedFrom` — the ROOT row it descends from, not merely its immediate
// source — so chains (A → B → C → back to A) still match with one rule:
// two rows are "the same thing" when their origins are equal.
//
// Lineage is a matching hint for re-pulls (pull again → merge only what's
// new), never authorization: RLS ignores it, and nothing follows it across
// spaces.

/** The root a row descends from: its own lineage when it was pulled, else
 *  its own id. A pull writes `copiedFrom = originOf(sourceRow)`. */
export const originOf = (row: { id: string; copiedFrom: string | null }): string => row.copiedFrom ?? row.id
