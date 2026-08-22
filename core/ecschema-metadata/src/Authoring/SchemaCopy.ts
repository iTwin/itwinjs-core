/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { AnyClass, AnyProperty, AnySchemaItem, ECClass, Property, SchemaDocument, SchemaItem, SchemaSet } from "./SchemaDocument";
import { SchemaIssueList } from "./SchemaIssues";
import { SchemaJsonReader } from "./SchemaJsonReader";
import { SchemaJsonWriter } from "./SchemaJsonWriter";

/** Options shared by every copy operation.
 * @alpha
 */
export interface SchemaCopyOptions {
  /** Name for the copy. Defaults to the source's name, which for a copy into the same owner leaves
   * two entries sharing a name - allowed (the document tolerates invalid states), rarely wanted. */
  name?: string;
  /** Add to the destination document any schema reference the copied content needs and the
   * destination does not already declare, taking the version from the source document. On by
   * default. Purely additive: an existing reference is never modified, so a version disagreement
   * stays visible to validation - the same rule {@link SchemaDocument.referenceTo} follows.
   *
   * This does **not** rewrite the copy's own references. See the remarks on {@link copyItemInto}.
   * With this off, a reference the destination cannot resolve keeps whatever separator the
   * serializer wrote (`"BisCore.Element"`); the two EC separators compare equal, so it resolves as
   * soon as the destination declares that schema. */
  carrySchemaReferences?: boolean;
}

/** The outcome of a copy: the copy itself, plus anything that went wrong producing it. `copy` is
 * `undefined` only when the copy could not be made at all.
 *
 * Copying serializes the source and reads it back, so the issues are the serializer's: most often a
 * custom attribute whose class is in no schema the *source* document can reach, which is dropped
 * with an error rather than copied blind. Check {@link SchemaIssueList.hasErrors} before treating a
 * copy as faithful.
 * @alpha
 */
export interface SchemaCopyResult<T> {
  copy?: T;
  issues: SchemaIssueList;
}

/** Copies a schema item into `document` and returns the copy - the way to lift the blueprint of a
 * class out of one schema and into another. The source is untouched; use
 * {@link SchemaDocument.moveItemIn} to relocate rather than duplicate.
 *
 * The copy is deep: properties, custom attributes, relationship constraints, enumerators, and
 * composites all come along. It is made by round-tripping the item through the ECJSON serializer,
 * so it stays complete as fields are added to the model, rather than needing a hand-written clone
 * per item kind kept in step by hand.
 *
 * **References are copied verbatim**, the same rule {@link SchemaDocument.moveItemIn} follows. A
 * reference qualified by schema name (`"BisCore:PhysicalElement"`) keeps meaning what it meant, and
 * `carrySchemaReferences` makes sure the destination declares that schema. An **unqualified**
 * reference (`"Pump"`) meant "an item of the source schema" and in the destination means an item of
 * the *destination* schema - so a class copied out of a schema that referred to its siblings by
 * bare name needs those siblings copied too, or its references requalified. Only the caller knows
 * which was intended, so nothing is rewritten automatically.
 *
 * @example
 * ```ts
 * const { copy, issues } = copyItemInto(myDomain, bisCore.getEntity("PhysicalElement")!, { name: "PumpBase" });
 * ```
 * @alpha
 */
export function copyItemInto(document: SchemaDocument, item: SchemaItem, options?: SchemaCopyOptions): SchemaCopyResult<AnySchemaItem> {
  const name = options?.name ?? item.name;
  const written = new SchemaJsonWriter().writeItemTree(item as AnySchemaItem);
  if (written.tree === undefined)
    return { issues: written.issues };
  carrySchemaReferences(written.tree, item.document, document, options);
  const issues = new SchemaJsonReader().readItemInto(document, name, written.tree);
  issues.addAll(written.issues);
  return { copy: document.getItem(name), issues };
}

/** Copies a property into `declaringClass` and returns the copy. Same semantics as
 * {@link copyItemInto}, one level down - including that references are copied verbatim.
 * @alpha
 */
export function copyPropertyInto(declaringClass: ECClass, property: Property, options?: SchemaCopyOptions): SchemaCopyResult<AnyProperty> {
  const name = options?.name ?? property.name;
  const written = new SchemaJsonWriter().writePropertyTree(property as AnyProperty);
  if (written.tree === undefined)
    return { issues: written.issues };
  carrySchemaReferences(written.tree, property.document, declaringClass.document, options);
  const issues = new SchemaJsonReader().readPropertyInto(declaringClass as AnyClass, name, written.tree);
  issues.addAll(written.issues);
  return { copy: declaringClass.getProperty(name), issues };
}

/** Copies a whole document into `schemaSet` and returns the copy, leaving the source where it is.
 * The counterpart of {@link SchemaSet.moveIn}.
 *
 * A document carries its own reference list, so nothing has to be carried or requalified here - the
 * caveat on {@link copyItemInto} does not apply.
 *
 * When the set already holds a schema of that name the incumbent is left alone, an error is
 * reported, and the copy is still returned - in a private set of its own, so a caller that wants to
 * rename and retry can. Check {@link SchemaCopyResult.issues} rather than assuming the copy joined
 * the set.
 * @alpha
 */
export function copyDocumentInto(schemaSet: SchemaSet, document: SchemaDocument, options?: Pick<SchemaCopyOptions, "name">): SchemaCopyResult<SchemaDocument> {
  const written = new SchemaJsonWriter().writeDocumentTree(document);
  if (written.tree === undefined)
    return { issues: written.issues };
  const tree = options?.name === undefined ? written.tree : { ...written.tree, name: options.name };
  const read = new SchemaJsonReader().readObject(tree, { schemaSet });
  read.issues.addAll(written.issues);
  return { copy: read.document, issues: read.issues };
}

/** Adds to `destination` every schema reference the serialized tree names by qualifier and the
 * destination does not already declare.
 *
 * Deliberately driven by scanning the tree's strings for a `Qualifier:Name` shape rather than by a
 * list of which fields hold references: the scan can only ever over-approximate, and its failure
 * mode is a reference that is not needed - which validation reports - rather than a missing one,
 * which would silently break the copy. A field list would have to be kept in step with the writer
 * and would go wrong quietly when it was not. */
function carrySchemaReferences(tree: Record<string, unknown>, source: SchemaDocument, destination: SchemaDocument, options: SchemaCopyOptions | undefined): void {
  if (options?.carrySchemaReferences === false || source === destination)
    return;

  const wanted = new Set<string>();
  collectQualifiers(tree, wanted);
  for (const qualifier of wanted) {
    const schemaName = source.resolveSchemaName(`${qualifier}:x`);
    if (schemaName.toLowerCase() === destination.name.toLowerCase())
      continue;
    if (destination.getSchemaReference(schemaName) !== undefined)
      continue;
    // Only carry a schema the source actually declares (or is itself). An unknown qualifier is
    // something validation should report on the copy, not something to invent a reference for.
    const referenced = schemaName.toLowerCase() === source.name.toLowerCase() ? source : source.getSchemaReference(schemaName);
    if (referenced !== undefined)
      destination.setSchemaReference(referenced);
  }
}

/** Matches a `Qualifier:Name` / `Qualifier.Name` reference occupying a whole string. */
const qualifiedReferencePattern = /^([A-Za-z_][\w]*)[.:]([A-Za-z_][\w]*)$/;

/** Collects the qualifier of every string in the tree that looks like a qualified item reference. */
function collectQualifiers(value: unknown, into: Set<string>): void {
  if (typeof value === "string") {
    const match = qualifiedReferencePattern.exec(value);
    if (match !== null)
      into.add(match[1]);
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value)
      collectQualifiers(entry, into);
    return;
  }
  if (typeof value === "object" && value !== null) {
    for (const member of Object.values(value))
      collectQualifiers(member, into);
  }
}
