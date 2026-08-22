/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { MergeFieldClass, mergeFieldClassOf } from "./MergeFields";
import { AnyClass, AnySchemaItem, CustomAttribute, CustomAttributeProps, CustomAttributeValues, LocalOrFullName, SchemaDocument, SchemaSet } from "./SchemaDocument";
import { SchemaIssueList } from "./SchemaIssues";
import { SchemaJsonReader } from "./SchemaJsonReader";
import { SchemaJsonWriter } from "./SchemaJsonWriter";
import { collectReferenceSites } from "./Validation/ReferenceRules";

type JsonObject = Record<string, unknown>;

/** What to do about one field the two sides of a merge disagree on.
 *
 * - `keepTarget` - leave the target's value. The default for every class of field.
 * - `takeIncoming` - overwrite with the incoming value.
 * - `rename` - carry both, by adding the incoming construct under a derived name. Applies to
 *   properties, and to schema items when {@link SchemaMergeOptions.renameItemOnConflict} is on;
 *   asked for anywhere else it is reported and treated as `keepTarget`.
 * - `skip` - drop the incoming construct entirely rather than merging any of it.
 *
 * @alpha
 */
export type SchemaMergeResolution = "keepTarget" | "takeIncoming" | "rename" | "skip";

/** One disagreement between the target and the incoming schema, handed to
 * {@link SchemaMergeOptions.onConflict}.
 * @alpha
 */
export interface SchemaMergeConflict {
  /** The construct the field belongs to, in the form validation reports (`"MyDomain:Pump.SerialNumber"`). */
  location: string;
  /** The disagreeing field (`"typeName"`). */
  field: string;
  /** How the field is classified - see {@link MergeFieldClass}. */
  fieldClass: MergeFieldClass;
  /** The value the target holds. `undefined` when the target does not carry the field. */
  target?: unknown;
  /** The value the incoming schema holds. */
  incoming?: unknown;
  /** What the merge would do without a callback. */
  defaultResolution: SchemaMergeResolution;
}

/** One custom attribute the merge is about to decide on, handed to
 * {@link SchemaMergeOptions.onCustomAttribute}. It fires for every class present on either side of
 * every container in the result, including containers taken wholesale from the incoming schema, so
 * a caller can suppress an attribute on newly added content as readily as on merged content.
 * @alpha
 */
export interface CustomAttributeMergeSite {
  /** The container, in the form validation reports. */
  location: string;
  /** Full name of the custom attribute class. */
  className: LocalOrFullName;
  /** The instance the target carries, if any. */
  target?: CustomAttributeProps;
  /** The instance the incoming schema carries, if any. */
  incoming?: CustomAttributeProps;
}

/** What to do with one custom attribute: keep the target's instance, take the incoming one, leave
 * the container without the attribute at all, or supply a replacement outright.
 * @alpha
 */
export type CustomAttributeMergeResolution = "keepTarget" | "takeIncoming" | "drop" | CustomAttributeProps;

/** @alpha */
export interface SchemaMergeOptions {
  /** Rename an incoming property that conflicts with the target's rather than dropping it. On by
   * default: a property name is referenced from almost nowhere (`ECDbMap:DbIndexList.properties`
   * and the ECSQL of a view are the exceptions), so carrying both sides costs little. */
  renamePropertyOnConflict?: boolean;
  /** Rename an incoming schema item whose name the target already uses for an item of another
   * kind, rather than dropping it. **Off by default**, because references to the item from other
   * schemas keep naming the target's item and silently mean something else afterwards. References
   * from within the incoming schema are repointed, so the incoming schema stays coherent on its
   * own. */
  renameItemOnConflict?: boolean;
  /** Decides a field-level disagreement. Return `undefined` to accept
   * {@link SchemaMergeConflict.defaultResolution}. */
  onConflict?: (conflict: SchemaMergeConflict) => SchemaMergeResolution | undefined;
  /** Decides one custom attribute. Return `undefined` for the default, which is that the incoming
   * instance wins and a one-sided instance is kept. */
  onCustomAttribute?: (site: CustomAttributeMergeSite) => CustomAttributeMergeResolution | undefined;
}

/** A construct the merge gave a different name to, so instance data naming the old one can be
 * remapped. Renames are derived from the incoming schema's name rather than from a counter, so
 * merging the same schema again produces the same names and reuses what is already there.
 * @alpha
 */
export interface SchemaMergeRename {
  kind: "property" | "item";
  /** The container the rename happened in - the class for a property, the schema for an item. */
  location: string;
  from: string;
  to: string;
}

/** The outcome of {@link mergeSchemaInto}.
 * @alpha
 */
export interface SchemaMergeResult {
  /** The target document, which is the merged result. `undefined` only when the incoming schema
   * could not be serialized at all. */
  document?: SchemaDocument;
  renames: SchemaMergeRename[];
  issues: SchemaIssueList;
}

/** Merges `incoming` into the schema of the same name in `target`, or copies it in when the set
 * holds no such schema. The target set is the result, so calling this repeatedly with the same set
 * accumulates schemas into it. `incoming` is never modified.
 *
 * **The merge never throws and never refuses.** Every disagreement it cannot reconcile is recorded
 * in {@link SchemaMergeResult.issues} with a name and a location, and the result is a document the
 * caller then runs {@link validateSchemaDocument} over and repairs. That division is what the
 * validity-free model buys: policy does not have to be encoded in merge-time flags and failures,
 * because there is a later step that can express it.
 *
 * **Merging is a union - nothing is ever removed.** A property, item, enumerator, or custom
 * attribute the target has and the incoming schema does not is left alone.
 *
 * How disagreements are settled is the {@link mergeFieldClasses} table: a field that says what a
 * construct *is* is a conflict, one that qualifies it keeps the target's value with a warning, and
 * annotation keeps the target's value quietly. {@link SchemaMergeOptions.onConflict} overrides any
 * of it, synchronously and in the one pass.
 *
 * Two things to know about what the result looks like:
 * - An item that actually merged is rebuilt, so it moves to the end of the document's item list and
 *   any field written with its spec default collapses to absent. Both are without meaning in ECJSON
 *   and ECXML alike. Items the incoming schema says nothing about are not touched at all.
 * - **Property order is preserved**: the target's order is authoritative and properties only the
 *   incoming schema has are appended in its order. Unlike item order, this one is visible - it is
 *   what an ECSQL `SELECT *` returns.
 *
 * Merging materializes custom attributes, so the custom attribute classes of both sides need to be
 * reachable from the target set. An attribute whose class is not is dropped with an error, the same
 * contract the writers have.
 *
 * @example
 * ```ts
 * const target = new Authoring.SchemaSet([bisCore]);
 * for (const source of incomingSchemas) {
 *   const { issues, renames } = Authoring.mergeSchemaInto(target, source);
 *   reportRenames(renames);
 * }
 * const problems = Authoring.validateSchemaSet(target);
 * ```
 * @alpha
 */
export function mergeSchemaInto(target: SchemaSet, incoming: SchemaDocument, options?: SchemaMergeOptions): SchemaMergeResult {
  const issues = new SchemaIssueList("merge");
  const renames: SchemaMergeRename[] = [];

  const written = new SchemaJsonWriter().writeDocumentTree(incoming, { omitDefaults: true });
  issues.addAll(written.issues);
  if (written.tree === undefined) {
    issues.addError("schema-not-serializable", `The incoming schema "${incoming.name}" could not be serialized, so nothing was merged.`, incoming.name);
    return { renames, issues };
  }

  const document = target.getSchema(incoming.name)
    ?? target.createSchema(incoming.name, incoming.alias, incoming.readVersion, incoming.writeVersion, incoming.minorVersion);
  const context: MergeContext = { document, incoming, issues, renames, options: options ?? {}, baseClassWarningReported: false };

  mergeSchemaVersion(context);
  mergeSchemaReferences(context);
  mergeLeaves(written.tree, document, context);
  mergeItems(written.tree, context);

  return { document, renames, issues };
}

interface MergeContext {
  document: SchemaDocument;
  incoming: SchemaDocument;
  issues: SchemaIssueList;
  renames: SchemaMergeRename[];
  options: SchemaMergeOptions;
  baseClassWarningReported: boolean;
}

// ===== Schema level =====

/** The higher of the two versions wins, component by component in significance order. This is
 * ECObjects-native's default too; consumers that own a versioning policy (the transformation
 * service bumps the minor afterwards, connectors preserve read/write and bump the minor) apply it
 * on the result. */
function mergeSchemaVersion(context: MergeContext): void {
  const { document, incoming } = context;
  const targetVersion = [document.readVersion, document.writeVersion, document.minorVersion];
  const incomingVersion = [incoming.readVersion, incoming.writeVersion, incoming.minorVersion];
  for (let i = 0; i < 3; ++i) {
    if (incomingVersion[i] === targetVersion[i])
      continue;
    if (incomingVersion[i] > targetVersion[i]) {
      [document.readVersion, document.writeVersion, document.minorVersion] = incomingVersion;
      context.issues.addInfo("schema-version-raised",
        `The schema version was raised from ${targetVersion.join(".")} to ${incomingVersion.join(".")} to match the incoming schema.`, document.name);
    }
    return;
  }
}

/** Adds every reference the incoming schema declares and the target does not. An existing reference
 * is never rewritten, the rule {@link SchemaDocument.referenceTo} already follows - a version
 * disagreement stays visible to validation rather than being silently resolved here. */
function mergeSchemaReferences(context: MergeContext): void {
  const { document, incoming, issues } = context;
  for (const reference of incoming.references) {
    const existing = document.getSchemaReference(reference.name);
    if (existing === undefined) {
      document.setSchemaReference(reference);
      continue;
    }
    const existingVersion = `${existing.readVersion}.${existing.writeVersion}.${existing.minorVersion}`;
    const incomingVersion = `${reference.readVersion}.${reference.writeVersion}.${reference.minorVersion}`;
    if (existingVersion !== incomingVersion) {
      issues.addWarning("schema-reference-version-differs",
        `The target references "${reference.name}" at ${existingVersion} and the incoming schema at ${incomingVersion}; the target's reference was kept.`, document.name);
    }
  }
}

/** Applies the schema-level leaves (alias, label, description) and custom attributes. `name` and
 * `version` are settled ahead of this; `items` and `references` are walked elsewhere. */
function mergeLeaves(incomingTree: JsonObject, document: SchemaDocument, context: MergeContext): void {
  for (const field of ["alias", "label", "description"]) {
    const targetValue = field === "alias" ? document.alias : field === "label" ? document.label : document.description;
    const resolution = resolveLeaf(field, targetValue, incomingTree[field], document.name, context);
    if (resolution !== "takeIncoming")
      continue;
    const value = incomingTree[field];
    if (field === "alias" && typeof value === "string")
      document.alias = value;
    else if (field === "label")
      document.label = value as string | undefined;
    else if (field === "description")
      document.description = value as string | undefined;
  }

  applyCustomAttributes(document, asObjectArray(incomingTree.customAttributes), document.name, context);
}

/** Applies the custom attribute policy to a live container. The schema itself is the one container
 * that is never rebuilt from a tree, so its attributes are settled on the model instead. An
 * instance the policy keeps is left exactly as it is - including one still holding a verbatim ECXML
 * body, which is not disturbed by a merge that has no opinion about it. */
function applyCustomAttributes(container: SchemaDocument, incomingAttributes: JsonObject[], location: string, context: MergeContext): void {
  const entries = new Map<string, { className: string, target?: CustomAttribute, incoming?: JsonObject }>();
  const order: string[] = [];
  const entryFor = (className: string): { className: string, target?: CustomAttribute, incoming?: JsonObject } => {
    const key = className.toLowerCase().replace(":", ".");
    let entry = entries.get(key);
    if (entry === undefined) {
      entry = { className };
      entries.set(key, entry);
      order.push(key);
    }
    return entry;
  };

  for (const attribute of container.customAttributes)
    entryFor(attribute.className).target = attribute;
  for (const attribute of incomingAttributes) {
    const className = asString(attribute.className);
    if (className !== undefined)
      entryFor(className).incoming = attribute;
  }

  for (const key of order) {
    const { className, target, incoming } = entries.get(key)!;
    const answer = context.options.onCustomAttribute?.({
      location, className,
      target: target === undefined ? undefined : { className: target.className, values: target.tryGetValues() },
      incoming: incoming === undefined ? undefined : toCustomAttributeProps(incoming),
    });

    if (answer === "drop") {
      container.customAttributes.remove(className);
      continue;
    }
    if (typeof answer === "object") {
      container.customAttributes.remove(className);
      container.customAttributes.add(answer);
      continue;
    }
    if (answer === "keepTarget" || incoming === undefined)
      continue;
    container.customAttributes.remove(className);
    container.customAttributes.add(toCustomAttributeProps(incoming));
  }
}

// ===== Items =====

function mergeItems(incomingTree: JsonObject, context: MergeContext): void {
  const { document, issues, options } = context;
  const items = isObject(incomingTree.items) ? incomingTree.items : {};
  const renamedItems: Array<{ from: string, to: string }> = [];

  for (const [name, value] of Object.entries(items)) {
    if (!isObject(value))
      continue;
    const existing = document.getItem(name);
    if (existing === undefined) {
      readItem(document, name, value, context);
      continue;
    }

    const location = `${document.name}:${existing.name}`;
    if (existing.schemaItemType !== value.schemaItemType) {
      const resolution = askConflict({
        location, field: "schemaItemType", fieldClass: "identity",
        target: existing.schemaItemType, incoming: value.schemaItemType,
        defaultResolution: options.renameItemOnConflict === true ? "rename" : "keepTarget",
      }, context);
      if (resolution === "rename") {
        renamedItems.push({ from: name, to: renameAndAddItem(name, value, context) });
      } else if (resolution === "takeIncoming") {
        document.removeItem(existing.name);
        readItem(document, existing.name, value, context);
      } else if (resolution !== "skip") {
        issues.addError("item-kind-conflict",
          `The target holds "${name}" as a ${existing.schemaItemType} and the incoming schema as a ${String(value.schemaItemType)}; the target's item was kept and the incoming one dropped. Enable renameItemOnConflict to carry both.`, location);
      }
      continue;
    }

    const targetTree = writeItem(existing, context);
    if (targetTree === undefined)
      continue;
    const merged = mergeItemTree(targetTree, value, existing, location, context);
    replaceItem(existing.name, merged, context);
  }

  // After every item is in place, so a reference from an item that had not been added yet when the
  // rename happened is repointed too.
  for (const { from, to } of renamedItems)
    repointItemReferences(from, to, context);
}

/** Serializes a target item so it can be merged as a tree. */
function writeItem(item: AnySchemaItem, context: MergeContext): JsonObject | undefined {
  const written = new SchemaJsonWriter().writeItemTree(item);
  context.issues.addAll(written.issues);
  return written.tree;
}

/** Adds an item the target does not have. It goes through the same tree merge against an empty
 * target, so an item taken wholesale is walked exactly like a merged one - which is what gets the
 * custom attribute policy applied to its properties and constraints, not only to the item itself. */
function readItem(document: SchemaDocument, name: string, tree: JsonObject, context: MergeContext): void {
  const merged = mergeItemTree({}, tree, undefined, `${document.name}:${name}`, context);
  context.issues.addAll(new SchemaJsonReader().readItemInto(document, name, merged));
}

function replaceItem(name: string, tree: JsonObject, context: MergeContext): void {
  context.document.removeItem(name);
  context.issues.addAll(new SchemaJsonReader().readItemInto(context.document, name, tree));
}

/** Adds an incoming item whose name the target uses for a different kind, under a derived name,
 * with every reference to it from within the incoming schema repointed. */
function renameAndAddItem(name: string, tree: JsonObject, context: MergeContext): string {
  const { document, issues } = context;
  const renamed = findFreeName(name, (candidate) => document.getItem(candidate) === undefined);
  readItem(document, renamed, tree, context);
  context.renames.push({ kind: "item", location: document.name, from: name, to: renamed });
  issues.addWarning("item-renamed",
    `"${name}" was added as "${renamed}" because the target already uses that name for an item of another kind. References to it from outside this schema still name the target's item.`,
    `${document.name}:${renamed}`);
  return renamed;
}

/** Repoints every reference in the merged document that named the renamed item and came from the
 * incoming schema. Driven by the validator's reference-site table, which is the one enumeration of
 * the model's cross-item references and carries a drift test. */
function repointItemReferences(from: string, to: string, context: MergeContext): void {
  const { document } = context;
  const matches = (reference: LocalOrFullName): boolean => {
    const separator = reference.search(/[.:]/);
    const itemName = separator < 0 ? reference : reference.substring(separator + 1);
    if (itemName.toLowerCase() !== from.toLowerCase())
      return false;
    return document.resolveSchemaName(reference).toLowerCase() === document.name.toLowerCase();
  };

  for (const item of document.items) {
    const constructs: Array<Parameters<typeof collectReferenceSites>[0]> = [item];
    if (isClass(item))
      constructs.push(...item.properties);
    if ("source" in item && "target" in item)
      constructs.push(item.source, item.target);
    for (const construct of constructs) {
      for (const site of collectReferenceSites(construct)) {
        if (matches(site.value))
          site.set(`${document.name}:${to}`);
      }
    }
  }
}

function isClass(item: AnySchemaItem): item is AnyClass {
  return "properties" in item;
}

// ===== Item trees =====

function mergeItemTree(targetTree: JsonObject, incomingTree: JsonObject, targetItem: AnySchemaItem | undefined, location: string, context: MergeContext): JsonObject {
  const merged: JsonObject = { ...targetTree };

  for (const field of unionKeys(targetTree, incomingTree)) {
    if (field === "customAttributes" || field === "properties" || field === "baseClass" || field === "mixins")
      continue;
    if (field === "source" || field === "target") {
      merged[field] = mergeConstraint(asObject(targetTree[field]), asObject(incomingTree[field]), `${location}(${field === "source" ? "Source" : "Target"})`, context);
      continue;
    }
    if (field === "enumerators") {
      merged[field] = mergeKeyedList(asObjectArray(targetTree[field]), asObjectArray(incomingTree[field]), "name", location, context);
      continue;
    }
    if (field === "constraintClasses" || field === "presentationUnits") {
      merged[field] = mergeStringList(targetTree[field], incomingTree[field]);
      continue;
    }
    applyLeaf(merged, field, targetTree[field], incomingTree[field], location, context);
  }

  mergeBaseClass(merged, targetTree, incomingTree, location, context);
  if (targetTree.properties !== undefined || incomingTree.properties !== undefined)
    merged.properties = mergeProperties(asObjectArray(targetTree.properties), asObjectArray(incomingTree.properties), targetItem, location, context);
  applyCustomAttributesToTree(merged, asObjectArray(targetTree.customAttributes), location, context, asObjectArray(incomingTree.customAttributes));
  return merged;
}

/** `mixins` unions. `baseClass` is a single field where ECObjects-native keeps one list, so a second
 * base needs somewhere to go: a base that narrows the other replaces it, and two disjoint bases keep
 * the target's and put the incoming one in `mixins` - what the ECXML 2.0 reader does with a second
 * `<BaseClass>` element. Validation then reports it, since an entity class is not a mixin. */
function mergeBaseClass(merged: JsonObject, targetTree: JsonObject, incomingTree: JsonObject, location: string, context: MergeContext): void {
  const mixins = mergeStringList(targetTree.mixins, incomingTree.mixins);
  const targetBase = asString(targetTree.baseClass);
  const incomingBase = asString(incomingTree.baseClass);

  if (incomingBase !== undefined && targetBase === undefined) {
    merged.baseClass = incomingBase;
  } else if (incomingBase !== undefined && targetBase !== undefined && !sameItem(targetBase, incomingBase, context)) {
    if (derivesFrom(incomingBase, targetBase, context)) {
      merged.baseClass = incomingBase;
      context.issues.addInfo("base-class-narrowed",
        `The base class was narrowed from "${targetBase}" to the incoming schema's "${incomingBase}", which derives from it.`, location);
    } else if (derivesFrom(targetBase, incomingBase, context)) {
      merged.baseClass = targetBase;
    } else {
      merged.baseClass = targetBase;
      if (!mixins.some((mixin) => sameItem(mixin, incomingBase, context)))
        mixins.push(incomingBase);
      context.issues.addError("base-class-conflict",
        `The target's base class "${targetBase}" and the incoming schema's "${incomingBase}" are unrelated; the target's was kept and the incoming one carried in "mixins", which validation reports.`, location);
    }
  }

  if (mixins.length > 0)
    merged.mixins = mixins;
}

/** Whether `derived` reaches `base` through base classes and mixins. Comparison is by resolved item
 * rather than by reference string, since the same class is named differently on the two sides (a
 * bare local name, a schema-qualified one, an alias) and every one of them means the same item. An
 * unresolvable hop reports once and answers `false`, which degrades a narrowing to the disjoint case
 * rather than guessing at it. */
function derivesFrom(derived: string, base: string, context: MergeContext): boolean {
  const baseItem = resolveClass(base, context);
  const start = resolveClass(derived, context);
  if (baseItem === undefined || start === undefined)
    return false;

  const seen = new Set<AnyClass>([start]);
  const queue: AnyClass[] = [];
  const push = (reference: LocalOrFullName | undefined): void => {
    if (reference === undefined)
      return;
    const item = resolveClass(reference, context);
    if (item !== undefined && !seen.has(item)) {
      seen.add(item);
      queue.push(item);
    }
  };
  const pushBases = (item: AnyClass): void => {
    push(item.baseClass);
    if ("mixins" in item)
      item.mixins.forEach(push);
  };

  pushBases(start);
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === baseItem)
      return true;
    pushBases(current);
  }
  return false;
}

function resolveClass(reference: LocalOrFullName, context: MergeContext): AnyClass | undefined {
  const item = context.document.resolveItem(reference);
  if (item === undefined) {
    if (!context.baseClassWarningReported) {
      context.baseClassWarningReported = true;
      context.issues.addWarning("base-class-not-loaded",
        `"${reference}" is not in the target schema set, so base class relationships and inherited property collisions could not be checked. Load the referenced schemas for a complete merge.`, context.document.name);
    }
    return undefined;
  }
  return isClass(item) ? item : undefined;
}

/** Whether two reference strings name the same item, falling back to comparing the strings when
 * they do not resolve. */
function sameItem(left: string, right: string, context: MergeContext): boolean {
  if (sameReference(left, right))
    return true;
  const leftItem = context.document.resolveItem(left);
  return leftItem !== undefined && leftItem === context.document.resolveItem(right);
}

function mergeConstraint(targetTree: JsonObject | undefined, incomingTree: JsonObject | undefined, location: string, context: MergeContext): JsonObject {
  const target = targetTree ?? {};
  const incoming = incomingTree ?? {};
  const merged: JsonObject = { ...target };
  for (const field of unionKeys(target, incoming)) {
    if (field === "customAttributes")
      continue;
    if (field === "constraintClasses") {
      merged[field] = mergeStringList(target[field], incoming[field]);
      continue;
    }
    applyLeaf(merged, field, target[field], incoming[field], location, context);
  }
  applyCustomAttributesToTree(merged, asObjectArray(target.customAttributes), location, context, asObjectArray(incoming.customAttributes));
  return merged;
}

// ===== Properties =====

/** The target's order is authoritative and incoming-only properties append in the incoming schema's
 * order. An order disagreement over the shared properties is reported and not reconciled:
 * interleaving is not stable across a second merge of the same schema, and reordering a class that
 * is already imported changes what `SELECT *` returns for nothing in return. */
function mergeProperties(targetProperties: JsonObject[], incomingProperties: JsonObject[], targetItem: AnySchemaItem | undefined, location: string, context: MergeContext): JsonObject[] {
  const merged = targetProperties.map((property) => ({ ...property }));
  const indexByName = new Map<string, number>();
  merged.forEach((property, index) => {
    const name = asString(property.name);
    if (name !== undefined)
      indexByName.set(name.toLowerCase(), index);
  });

  for (const incomingProperty of incomingProperties) {
    const name = asString(incomingProperty.name);
    if (name === undefined)
      continue;
    const propertyLocation = `${location}.${name}`;
    const index = indexByName.get(name.toLowerCase());

    if (index === undefined) {
      const inherited = inheritedProperty(targetItem, name, context);
      if (inherited !== undefined && identityConflict(inherited, incomingProperty).length > 0) {
        addConflictingProperty(merged, indexByName, incomingProperty, name, inherited, propertyLocation, context, true);
        continue;
      }
      merged.push(withMergedCustomAttributes(incomingProperty, undefined, propertyLocation, context));
      indexByName.set(name.toLowerCase(), merged.length - 1);
      continue;
    }

    const targetProperty = merged[index];
    if (identityConflict(targetProperty, incomingProperty).length > 0) {
      addConflictingProperty(merged, indexByName, incomingProperty, name, targetProperty, propertyLocation, context, false);
      continue;
    }
    merged[index] = mergePropertyTree(targetProperty, incomingProperty, propertyLocation, context);
  }

  reportOrderDisagreement(targetProperties, incomingProperties, location, context);
  return merged;
}

/** Handles a property the two sides define incompatibly: rename and carry both, or keep the
 * target's. The derived name is a function of the property and the incoming schema's name, so a
 * second merge of the same schema lands on the same name and reuses what is there, and a third
 * schema gets a name of its own. ECObjects-native's counter cannot do either. */
function addConflictingProperty(
  merged: JsonObject[], indexByName: Map<string, number>, incomingProperty: JsonObject, name: string,
  targetProperty: JsonObject, location: string, context: MergeContext, inherited: boolean,
): void {
  const { issues, options } = context;
  const fields = identityConflict(targetProperty, incomingProperty);
  const rename = options.renamePropertyOnConflict !== false;
  const resolution = askConflict({
    location, field: fields[0], fieldClass: "identity",
    target: targetProperty[fields[0]], incoming: incomingProperty[fields[0]],
    defaultResolution: rename ? "rename" : "keepTarget",
  }, context);

  if (resolution === "skip")
    return;
  if (resolution === "takeIncoming" && !inherited) {
    const index = indexByName.get(name.toLowerCase());
    if (index !== undefined) {
      merged[index] = withMergedCustomAttributes(incomingProperty, merged[index], location, context);
      return;
    }
  }
  if (resolution !== "rename") {
    issues.addError("property-conflict",
      `The target and the incoming schema define "${name}" incompatibly (${fields.join(", ")}); the ${inherited ? "inherited" : "target's"} declaration was kept and the incoming one dropped.`, location);
    return;
  }

  const container = location.substring(0, location.lastIndexOf("."));
  const renamed = findFreeName(name, (candidate) => {
    const existing = indexByName.get(candidate.toLowerCase());
    return existing === undefined || identityConflict(merged[existing], incomingProperty).length === 0;
  });

  const existingIndex = indexByName.get(renamed.toLowerCase());
  const copy = { ...incomingProperty, name: renamed };
  if (existingIndex === undefined) {
    merged.push(withMergedCustomAttributes(copy, undefined, `${container}.${renamed}`, context));
    indexByName.set(renamed.toLowerCase(), merged.length - 1);
  } else {
    merged[existingIndex] = mergePropertyTree(merged[existingIndex], copy, `${container}.${renamed}`, context);
  }

  context.renames.push({ kind: "property", location: container, from: name, to: renamed });
  issues.addWarning("property-renamed",
    `"${name}" was added as "${renamed}" because the ${inherited ? "inherited" : "target's"} declaration disagrees on ${fields.join(", ")}.`, `${container}.${renamed}`);
}

function mergePropertyTree(targetProperty: JsonObject, incomingProperty: JsonObject, location: string, context: MergeContext): JsonObject {
  const merged: JsonObject = { ...targetProperty };
  for (const field of unionKeys(targetProperty, incomingProperty)) {
    if (field === "customAttributes" || field === "name")
      continue;
    applyLeaf(merged, field, targetProperty[field], incomingProperty[field], location, context);
  }
  applyCustomAttributesToTree(merged, asObjectArray(targetProperty.customAttributes), location, context, asObjectArray(incomingProperty.customAttributes));
  return merged;
}

/** The identity-classed fields the two declarations disagree on - what makes them two different
 * properties rather than two descriptions of one. `name` is excluded: it is what a rename changes,
 * so comparing it would stop a renamed property from ever matching the declaration it came from. */
function identityConflict(targetProperty: JsonObject, incomingProperty: JsonObject): string[] {
  const fields: string[] = [];
  for (const field of unionKeys(targetProperty, incomingProperty)) {
    if (field === "name" || mergeFieldClassOf(field) !== "identity")
      continue;
    if (!sameValue(targetProperty[field], incomingProperty[field]))
      fields.push(field);
  }
  return fields;
}

/** The declaration a property name already has through the target class's base classes and mixins,
 * as a tree. `undefined` when there is none, and also when the base classes are not loaded - which
 * {@link derivesFrom} has already reported by then. */
function inheritedProperty(targetItem: AnySchemaItem | undefined, name: string, context: MergeContext): JsonObject | undefined {
  if (targetItem === undefined || !isClass(targetItem))
    return undefined;
  const property = targetItem.getExpandedProperty(name);
  if (property === undefined || property.declaringClass === targetItem)
    return undefined;
  const written = new SchemaJsonWriter().writePropertyTree(property);
  context.issues.addAll(written.issues);
  return written.tree;
}

function reportOrderDisagreement(targetProperties: JsonObject[], incomingProperties: JsonObject[], location: string, context: MergeContext): void {
  const targetNames = targetProperties.map((property) => asString(property.name)?.toLowerCase()).filter((name): name is string => name !== undefined);
  const targetSet = new Set(targetNames);
  const shared = incomingProperties
    .map((property) => asString(property.name)?.toLowerCase())
    .filter((name): name is string => name !== undefined && targetSet.has(name));
  const inTargetOrder = targetNames.filter((name) => shared.includes(name));
  if (shared.length > 1 && shared.join() !== inTargetOrder.join()) {
    context.issues.addInfo("property-order-differs",
      `The two schemas order the shared properties of this class differently; the target's order was kept and properties only the incoming schema has were appended.`, location);
  }
}

// ===== Leaves =====

function applyLeaf(merged: JsonObject, field: string, targetValue: unknown, incomingValue: unknown, location: string, context: MergeContext): void {
  if (resolveLeaf(field, targetValue, incomingValue, location, context) === "takeIncoming")
    merged[field] = incomingValue;
}

/** Settles one leaf field. A value only the incoming schema has is taken - there is nothing to
 * disagree with. Everything else goes through the table and the callback. */
function resolveLeaf(field: string, targetValue: unknown, incomingValue: unknown, location: string, context: MergeContext): SchemaMergeResolution {
  if (incomingValue === undefined || sameValue(targetValue, incomingValue))
    return "keepTarget";
  if (targetValue === undefined)
    return "takeIncoming";

  const fieldClass = mergeFieldClassOf(field);
  if (fieldClass === undefined) {
    context.issues.addInfo("field-unclassified",
      `"${field}" has no entry in the merge policy table, so the target's value was kept. This is a gap in the table, not in the schemas.`, location);
    return "keepTarget";
  }

  const resolution = askConflict({ location, field, fieldClass, target: targetValue, incoming: incomingValue, defaultResolution: "keepTarget" }, context);
  if (resolution !== "keepTarget")
    return resolution;

  const message = `The target has ${field} ${render(targetValue)} and the incoming schema ${render(incomingValue)}; the target's value was kept.`;
  if (fieldClass === "identity")
    context.issues.addError("field-conflict", message, location);
  else if (fieldClass === "constrained")
    context.issues.addWarning("field-differs", message, location);
  else
    context.issues.addInfo("field-differs", message, location);
  return "keepTarget";
}

function askConflict(conflict: SchemaMergeConflict, context: MergeContext): SchemaMergeResolution {
  const answer = context.options.onConflict?.(conflict);
  if (answer === undefined)
    return conflict.defaultResolution;
  if (answer === "rename" && conflict.field !== "schemaItemType" && mergeFieldClassOf(conflict.field) !== "identity") {
    context.issues.addWarning("resolution-not-applicable",
      `"rename" was returned for ${conflict.field}, which is not a construct that can be renamed; the target's value was kept.`, conflict.location);
    return "keepTarget";
  }
  return answer;
}

// ===== Custom attributes =====

/** Runs the custom attribute policy over one container's attributes and writes the outcome into
 * `merged`. Called for every container in the result, including ones taken wholesale from the
 * incoming schema, which is what lets a caller suppress an attribute on new content too. */
function applyCustomAttributesToTree(merged: JsonObject, targetAttributes: JsonObject[] | undefined, location: string, context: MergeContext, incomingAttributes?: JsonObject[]): void {
  const incoming = incomingAttributes ?? asObjectArray(merged.customAttributes) ?? [];
  const target = targetAttributes ?? [];
  const result = mergeCustomAttributes(target, incoming, location, context);
  if (result.length > 0)
    merged.customAttributes = result;
  else
    delete merged.customAttributes;
}

function withMergedCustomAttributes(tree: JsonObject, targetTree: JsonObject | undefined, location: string, context: MergeContext): JsonObject {
  const copy = { ...tree };
  applyCustomAttributesToTree(copy, asObjectArray(targetTree?.customAttributes), location, context, asObjectArray(tree.customAttributes));
  return copy;
}

/** A custom attribute merges as one unit keyed by its class, never field by field: a blend of two
 * instances is a value neither side authored, and for something like `ECDbMap:DbIndexList` that is
 * worse than keeping one of them. The class name is a sound key because EC allows a container only
 * one instance of a class. */
function mergeCustomAttributes(targetAttributes: JsonObject[], incomingAttributes: JsonObject[], location: string, context: MergeContext): JsonObject[] {
  const byKey = new Map<string, { target?: JsonObject, incoming?: JsonObject, className: string }>();
  const order: string[] = [];
  const record = (attribute: JsonObject, side: "target" | "incoming"): void => {
    const className = asString(attribute.className);
    if (className === undefined)
      return;
    const key = className.toLowerCase().replace(":", ".");
    let entry = byKey.get(key);
    if (entry === undefined) {
      entry = { className };
      byKey.set(key, entry);
      order.push(key);
    }
    entry[side] = attribute;
  };
  targetAttributes.forEach((attribute) => record(attribute, "target"));
  incomingAttributes.forEach((attribute) => record(attribute, "incoming"));

  const merged: JsonObject[] = [];
  for (const key of order) {
    const { target, incoming, className } = byKey.get(key)!;
    const answer = context.options.onCustomAttribute?.({
      location, className,
      target: target === undefined ? undefined : toCustomAttributeProps(target),
      incoming: incoming === undefined ? undefined : toCustomAttributeProps(incoming),
    });

    if (answer === "drop")
      continue;
    if (typeof answer === "object") {
      merged.push(fromCustomAttributeProps(answer));
      continue;
    }
    const chosen = answer === "keepTarget" ? target ?? incoming : answer === "takeIncoming" ? incoming ?? target : incoming ?? target;
    if (chosen !== undefined)
      merged.push(chosen);
  }
  return merged;
}

/** The tree form is the flattened ECJSON one (`className` plus the values inline); the callback sees
 * the nested authoring shape, which is what {@link CustomAttributeSet.add} takes. */
function toCustomAttributeProps(attribute: JsonObject): CustomAttributeProps {
  const { className, ...values } = attribute;
  return { className: String(className), values: values as CustomAttributeValues };
}

function fromCustomAttributeProps(props: CustomAttributeProps): JsonObject {
  return { className: props.className, ...props.values };
}

// ===== Collections and values =====

/** Unions two lists of named objects: the target's entries in order, then the incoming schema's
 * that are new, with a shared name merged field by field. */
function mergeKeyedList(targetEntries: JsonObject[], incomingEntries: JsonObject[], key: string, location: string, context: MergeContext): JsonObject[] {
  const merged = targetEntries.map((entry) => ({ ...entry }));
  const indexByKey = new Map<string, number>();
  merged.forEach((entry, index) => {
    const value = asString(entry[key]);
    if (value !== undefined)
      indexByKey.set(value.toLowerCase(), index);
  });

  for (const incomingEntry of incomingEntries) {
    const value = asString(incomingEntry[key]);
    if (value === undefined)
      continue;
    const index = indexByKey.get(value.toLowerCase());
    if (index === undefined) {
      merged.push({ ...incomingEntry });
      indexByKey.set(value.toLowerCase(), merged.length - 1);
      continue;
    }
    const entryLocation = `${location}.${value}`;
    const target = merged[index];
    const entry: JsonObject = { ...target };
    for (const field of unionKeys(target, incomingEntry)) {
      if (field === key)
        continue;
      applyLeaf(entry, field, target[field], incomingEntry[field], entryLocation, context);
    }
    merged[index] = entry;
  }
  return merged;
}

/** Unions two reference lists, keeping the target's order. Entries compare with either EC separator
 * and without regard to case, so `bis:Element` and `BisCore.Element` are one entry. */
function mergeStringList(targetValue: unknown, incomingValue: unknown): string[] {
  const merged = asStringArray(targetValue);
  for (const entry of asStringArray(incomingValue)) {
    if (!merged.some((existing) => sameReference(existing, entry)))
      merged.push(entry);
  }
  return merged;
}

/** Picks the name a renamed construct gets. The suffix is a counter rather than something derived
 * from the incoming schema, because a merge is always between two schemas of the *same* name -
 * there is no second name to discriminate with. What makes accumulation work is `isFree` accepting
 * a candidate that already holds a compatible declaration: merging a third schema whose property
 * agrees with the one an earlier merge renamed lands on that same name instead of adding another.
 * ECObjects-native produces the same names and re-derives on every merge, so it does not. */
function findFreeName(name: string, isFree: (candidate: string) => boolean): string {
  for (let suffix = 1; ; ++suffix) {
    const candidate = `${name}_${suffix}`;
    if (isFree(candidate))
      return candidate;
  }
}

function sameReference(left: string, right: string): boolean {
  return left.toLowerCase().replace(":", ".") === right.toLowerCase().replace(":", ".");
}

function sameValue(left: unknown, right: unknown): boolean {
  if (left === right)
    return true;
  if (left === undefined || right === undefined)
    return false;
  return JSON.stringify(left) === JSON.stringify(right);
}

function render(value: unknown): string {
  return typeof value === "string" ? `"${value}"` : JSON.stringify(value) ?? "undefined";
}

function unionKeys(left: JsonObject, right: JsonObject): string[] {
  const keys = Object.keys(left);
  for (const key of Object.keys(right)) {
    if (!Object.hasOwn(left, key))
      keys.push(key);
  }
  return keys;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asObject(value: unknown): JsonObject | undefined {
  return isObject(value) ? value : undefined;
}

function asObjectArray(value: unknown): JsonObject[] {
  return Array.isArray(value) ? value.filter(isObject) : [];
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
