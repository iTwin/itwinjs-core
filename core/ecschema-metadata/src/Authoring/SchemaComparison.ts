/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { SchemaDocument } from "./SchemaDocument";
import { SchemaIssueList } from "./SchemaIssues";
import { SchemaJsonWriter } from "./SchemaJsonWriter";

/** One leaf-level difference between two compared documents. `left`/`right` are the JSON-rendered
 * values; `undefined` means the field is absent on that side.
 * @alpha
 */
export interface SchemaValueDifference {
  /** Dot path to the differing field - relative to the item for item differences (e.g.
   * `properties.SerialNumber.priority`), relative to the schema otherwise (e.g. `version`). */
  path: string;
  left?: string;
  right?: string;
}

/** How an item differs between the two documents, relative to left -> right.
 * @alpha
 */
export type SchemaItemChange = "added" | "removed" | "modified";

/** A schema item that differs between the two compared documents.
 * @alpha
 */
export interface SchemaItemComparison {
  name: string;
  change: SchemaItemChange;
  /** The field-level differences for a `modified` item; empty for `added`/`removed` (the whole
   * item is the difference - both documents are at hand to inspect it by name). */
  differences: SchemaValueDifference[];
}

/** The result of {@link compareSchemaDocuments}.
 * @alpha
 */
export interface SchemaComparison {
  areEqual: boolean;
  /** Differences outside the items: identity, references, schema custom attributes. */
  schemaDifferences: SchemaValueDifference[];
  /** The items that differ, one entry per item. */
  itemDifferences: SchemaItemComparison[];
  /** Problems encountered while canonicalizing the documents for comparison (e.g. an item
   * reference that matches nothing in the reference list) - they flag spots where the comparison
   * may be less meaningful than it looks. */
  issues: SchemaIssueList;
}

/** Compares two schema documents for semantic equality, reporting every difference in one walk.
 * `left` is the baseline and `right` the candidate, so `added` means "present only in `right`".
 *
 * Equality means "the documents serialize to the same canonical form": both sides are rendered to
 * the ECJSON 3.2 tree and the trees are compared. That buys the normalizations a field-by-field
 * walk would have to redo:
 * - **Item references compare resolved, not verbatim.** A document may hold a reference as a local
 *   name, a full name, or alias-qualified with either separator; each side resolves through its
 *   own reference list, so `bis:PhysicalElement` equals `BisCore.PhysicalElement` when `bis` is
 *   that document's alias for BisCore.
 * - **Reference aliases are ignored.** The alias a schema assigns to a reference is ECXML-internal
 *   plumbing - it only abbreviates names within that one file and carries no semantic information,
 *   so documents read from ECXML and ECJSON (which has no reference aliases) compare equal.
 *   The schema's *own* alias is identity and does compare.
 * - **Spec defaults equal absence.** A field written with its spec default value (the
 *   `Authoring.SpecDefaults` table - a relationship's `referencing` strength, a constraint's
 *   `polymorphic` flag, the Format separators, and so on) means the same schema as omitting it, and
 *   serializers disagree on which convention they follow - the published XML and JSON of the same
 *   schema differ on these today. The document preserves the distinction for exact round-trips; the
 *   comparison renders both sides with defaults dropped, so they compare equal.
 *
 * Order-insensitive where order carries no meaning: items, properties, enumerators, and custom
 * attributes match by name; `constraintClasses` and `mixins` compare as sets. Presentation formats
 * stay ordered (the first is the default).
 *
 * Custom attribute values compare leniently across types (`"5"` equals `5`, `"True"` equals
 * `true`): the documents are validity-free, so CA values are untyped, and ECXML renders every
 * scalar as text while ECJSON keeps types. Known limitation, same as the readers': an XML-read
 * struct-array CA value differs in shape from its JSON-read counterpart until a compiler types it.
 * @alpha
 */
export function compareSchemaDocuments(left: SchemaDocument, right: SchemaDocument): SchemaComparison {
  const issues = new SchemaIssueList();
  const writer = new SchemaJsonWriter();
  const leftResult = writer.writeDocumentTree(left, { omitDefaults: true });
  const rightResult = writer.writeDocumentTree(right, { omitDefaults: true });
  issues.addAll(leftResult.issues);
  issues.addAll(rightResult.issues);
  const leftTree = leftResult.tree ?? {};
  const rightTree = rightResult.tree ?? {};

  const schemaDifferences: SchemaValueDifference[] = [];
  for (const key of unionKeys(leftTree, rightTree)) {
    if (key === "items" || key === "$schema")
      continue;
    compareValues(key, leftTree[key], rightTree[key], key === "customAttributes", schemaDifferences);
  }

  const itemDifferences: SchemaItemComparison[] = [];
  const leftItems = (leftTree.items ?? {}) as Record<string, unknown>;
  const rightItems = (rightTree.items ?? {}) as Record<string, unknown>;
  for (const name of unionKeys(leftItems, rightItems)) {
    if (!(name in rightItems)) {
      itemDifferences.push({ name, change: "removed", differences: [] });
      continue;
    }
    if (!(name in leftItems)) {
      itemDifferences.push({ name, change: "added", differences: [] });
      continue;
    }
    const differences: SchemaValueDifference[] = [];
    compareValues("", leftItems[name], rightItems[name], false, differences);
    if (differences.length > 0)
      itemDifferences.push({ name, change: "modified", differences });
  }

  return {
    areEqual: schemaDifferences.length === 0 && itemDifferences.length === 0,
    schemaDifferences,
    itemDifferences,
    issues,
  };
}

/** Renders a comparison as a compact human-readable listing - one line per difference, `+`/`-`/`~`
 * prefixes for added/removed/modified items. Intended for test failure output and diagnostics.
 * @alpha
 */
export function formatSchemaComparison(comparison: SchemaComparison): string {
  if (comparison.areEqual)
    return "No differences.";
  const lines: string[] = [];
  for (const difference of comparison.schemaDifferences)
    lines.push(`  ${renderDifference(difference)}`);
  for (const item of comparison.itemDifferences) {
    if (item.change === "added") {
      lines.push(`+ ${item.name}`);
    } else if (item.change === "removed") {
      lines.push(`- ${item.name}`);
    } else {
      lines.push(`~ ${item.name}`);
      for (const difference of item.differences)
        lines.push(`    ${renderDifference(difference)}`);
    }
  }
  return lines.join("\n");
}

function renderDifference(difference: SchemaValueDifference): string {
  return `${difference.path}: ${difference.left ?? "<absent>"} -> ${difference.right ?? "<absent>"}`;
}

// ===== Canonical-tree comparison =====

function unionKeys(left: Record<string, unknown>, right: Record<string, unknown>): string[] {
  const keys = Object.keys(left);
  for (const key of Object.keys(right)) {
    if (!(key in left))
      keys.push(key);
  }
  return keys;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function render(value: unknown): string | undefined {
  return value === undefined ? undefined : JSON.stringify(value);
}

function joinPath(path: string, key: string): string {
  return path.length === 0 ? key : `${path}.${key}`;
}

/** Array fields whose order carries no meaning - compared as sets. */
const UNORDERED_STRING_ARRAYS = new Set(["constraintClasses", "mixins"]);

function compareValues(path: string, left: unknown, right: unknown, lenient: boolean, out: SchemaValueDifference[]): void {
  if (left === undefined && right === undefined)
    return;
  if (left === undefined || right === undefined) {
    out.push({ path, left: render(left), right: render(right) });
    return;
  }

  // The XML reader's untyped custom attribute values keep a struct-array entry's element name as
  // a single-key wrapper object ({ DbIndex: {...} } for { ...the entry... }) - lexically
  // unavoidable without the CA class - and reads a one-entry struct array as the bare entry
  // rather than an array. When only one side is wrapped, compare through the wrapper; when only
  // one side is an array, compare the other as a one-element array.
  if (lenient) {
    const leftWrapped = singleKeyWrapperValue(left);
    const rightWrapped = singleKeyWrapperValue(right);
    if (leftWrapped !== undefined && rightWrapped === undefined && (isPlainObject(right) || Array.isArray(right)))
      return compareValues(path, leftWrapped, right, lenient, out);
    if (rightWrapped !== undefined && leftWrapped === undefined && (isPlainObject(left) || Array.isArray(left)))
      return compareValues(path, left, rightWrapped, lenient, out);
    if (Array.isArray(left) !== Array.isArray(right))
      return compareValues(path, Array.isArray(left) ? left : [left], Array.isArray(right) ? right : [right], lenient, out);
  }

  if (isPlainObject(left) && isPlainObject(right)) {
    for (const key of unionKeys(left, right))
      compareValues(joinPath(path, key), left[key], right[key], lenient || key === "customAttributes", out);
    return;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    compareArrays(path, left, right, lenient, out);
    return;
  }

  if (!scalarEquals(left, right, lenient))
    out.push({ path, left: render(left), right: render(right) });
}

/** When `value` is a plain object with exactly one key holding a plain object, returns that inner
 * object (the XML struct-array entry wrapper shape); otherwise `undefined`. */
function singleKeyWrapperValue(value: unknown): Record<string, unknown> | undefined {
  if (!isPlainObject(value))
    return undefined;
  const keys = Object.keys(value);
  if (keys.length !== 1)
    return undefined;
  const inner = value[keys[0]];
  return isPlainObject(inner) ? inner : undefined;
}

function compareArrays(path: string, left: unknown[], right: unknown[], lenient: boolean, out: SchemaValueDifference[]): void {
  const key = entryKeyField(left, right);
  if (key !== undefined) {
    // Entries are named (properties, enumerators, references, composite units) or className-keyed
    // (custom attributes) - match by that key, order-insensitively.
    const leftByKey = new Map(left.map((entry) => [(entry as Record<string, unknown>)[key] as string, entry]));
    const rightByKey = new Map(right.map((entry) => [(entry as Record<string, unknown>)[key] as string, entry]));
    for (const [entryKey, leftEntry] of leftByKey)
      compareValues(joinPath(path, entryKey), leftEntry, rightByKey.get(entryKey), lenient, out);
    for (const [entryKey, rightEntry] of rightByKey) {
      if (!leftByKey.has(entryKey))
        compareValues(joinPath(path, entryKey), undefined, rightEntry, lenient, out);
    }
    return;
  }

  const lastSegment = path.substring(path.lastIndexOf(".") + 1);
  const ordered = !UNORDERED_STRING_ARRAYS.has(lastSegment);
  const leftEntries = ordered ? left : [...left].sort();
  const rightEntries = ordered ? right : [...right].sort();
  const length = Math.max(leftEntries.length, rightEntries.length);
  for (let i = 0; i < length; ++i)
    compareValues(`${path}[${i}]`, leftEntries[i], rightEntries[i], lenient, out);
}

/** When every entry on both sides is an object carrying a string `name` (or `className` for
 * custom attributes), arrays match entries by that field instead of by position. */
function entryKeyField(left: unknown[], right: unknown[]): "name" | "className" | undefined {
  for (const field of ["name", "className"] as const) {
    const matches = (entry: unknown): boolean => isPlainObject(entry) && typeof entry[field] === "string";
    if (left.length + right.length > 0 && left.every(matches) && right.every(matches))
      return field;
  }
  return undefined;
}

/** Scalar equality. In lenient mode (custom attribute values, which are untyped - ECXML renders
 * every scalar as text), values of different types compare by case-insensitive string form. */
function scalarEquals(left: unknown, right: unknown, lenient: boolean): boolean {
  if (left === right)
    return true;
  if (!lenient || typeof left === typeof right)
    return false;
  return String(left).toLowerCase() === String(right).toLowerCase();
}
