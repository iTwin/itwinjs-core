/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { DecimalPrecision, FormatTraits, FormatType, FractionalPrecision, ScientificType, ShowSignOption } from "@itwin/core-quantity";
import { AbstractSchemaItemType, CustomAttributeContainerType, ECClassModifier, isSupportedSchemaItemType, parsePrimitiveType, PrimitiveType, primitiveTypeToString, PropertyKind, RelationshipEnd, SchemaItemType, StrengthDirection, StrengthType } from "../ECObjects";
import { SchemaKey } from "../SchemaKey";
import { materializeCustomAttribute } from "./CustomAttributeConverter";
import { SchemaAuthoringError } from "./SchemaAuthoringError";

/** Item kinds the authoring model adds on top of {@link SchemaItemType}. The shared enum is what
 * the persisted formats and the read model speak, so it is not widened; the authoring discriminant
 * is the union of both ([Authoring.ItemKind]($ecschema-metadata)).
 * @alpha
 */
export enum AuthoringSchemaItemType {
  /** An ECSQL-backed view. No format has a `View` element: it is an entity class carrying the
   * `ECDbMap:QueryView` custom attribute, which the readers promote and the writers undo.
   * @see [Authoring.View]($ecschema-metadata) */
  // eslint-disable-next-line @typescript-eslint/no-shadow -- deliberately named for the View class, as every SchemaItemType member is
  View = "View",
}

/** The discriminant carried by [Authoring.SchemaItem.schemaItemType]($ecschema-metadata).
 * @alpha
 */
export type ItemKind = SchemaItemType | AuthoringSchemaItemType;

/** Whether `kind` satisfies `supported`, which may be a concrete kind or an
 * {@link AbstractSchemaItemType} grouping. Extends {@link isSupportedSchemaItemType} over the
 * authoring-only kinds: a [Authoring.View]($ecschema-metadata) is a class, so it answers to the `Class` grouping.
 * @internal
 */
export function isItemOfKind(kind: ItemKind, supported: keyof SchemaItemTypeMap): boolean {
  if (kind === supported)
    return true;
  if (kind === AuthoringSchemaItemType.View)
    return supported === AbstractSchemaItemType.Class || supported === AbstractSchemaItemType.SchemaItem;
  return isSupportedSchemaItemType(kind, supported as SchemaItemType | AbstractSchemaItemType);
}

/** Case-invariant name comparison. EC names are case-insensitive; comparison is the document's
 * only interpretation of a name, kept deliberately simple. */
function namesEqual(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/** Folds a schema-item full name to a comparable key: the two EC separators (`:` and `.`) are treated
 * as equivalent and case is ignored. */
function foldFullName(fullName: string): string {
  return fullName.replaceAll(".", ":").toLowerCase();
}

/** Matches the first EC separator. Hoisted because reference resolution runs it on every access. */
const separatorPattern = /[.:]/;

/** Splits an item reference into its optional qualifier (a schema name or alias) and the local item
 * name. Both EC separators are accepted; the first one encountered separates, since neither an EC
 * name nor an alias may contain one. */
function splitReference(reference: LocalOrFullName): { qualifier?: string, name: string } {
  const separator = reference.search(separatorPattern);
  if (separator < 0)
    return { name: reference };
  return { qualifier: reference.substring(0, separator), name: reference.substring(separator + 1) };
}

/** Marks one cached name as needing a fresh scan of the ordered collection. */
const staleName = Symbol("Authoring.staleName");

/** Case-folded name lookup over a collection its owner keeps ordered. Built on first use and
 * dropped whenever the collection changes, so an authoring session that edits far more than it
 * reads never pays for an index, and a walk that reads far more than it edits pays once. First
 * occurrence wins, matching the ordered collection's own duplicate rule. A rename updates the
 * common unique-name case in place; only names involved in a possible duplicate are rescanned. */
class NameLookup<T extends { readonly name: string }> {
  private _byName?: Map<string, T | typeof staleName>;

  public constructor(private readonly _entries: ReadonlyArray<T>) { }

  /** Drops the index. Called by the owner on every collection change. */
  public invalidate(): void {
    this._byName = undefined;
  }

  /** Updates a built index after `entry` changed its name without changing collection order. */
  public rename(entry: T, previousName: string): void {
    if (this._byName === undefined)
      return;
    const previousKey = previousName.toLowerCase();
    const newKey = entry.name.toLowerCase();
    if (previousKey === newKey)
      return;

    if (this._byName.get(previousKey) === entry)
      this._byName.set(previousKey, staleName);

    if (this._byName.has(newKey))
      this._byName.set(newKey, staleName);
    else
      this._byName.set(newKey, entry);
  }

  public get(name: string): T | undefined {
    if (this._byName === undefined) {
      this._byName = new Map<string, T | typeof staleName>();
      for (const entry of this._entries) {
        const entryKey = entry.name.toLowerCase();
        if (!this._byName.has(entryKey))
          this._byName.set(entryKey, entry);
      }
    }

    const key = name.toLowerCase();
    const found = this._byName.get(key);
    if (found !== staleName)
      return found;

    const refreshed = this._entries.find((entry) => entry.name.toLowerCase() === key);
    if (refreshed === undefined)
      this._byName.delete(key);
    else
      this._byName.set(key, refreshed);
    return refreshed;
  }
}

/** Assigns the owner of a document, item, property, or custom attribute. Module-private: ownership
 * is established at construction and changed only through the owning collection's move methods. */
const _setOwner = Symbol("Authoring.setOwner");

/** Registers a newly constructed child with its owner. Module-private, same reasoning. */
const _attach = Symbol("Authoring.attach");

/** Notifies an owner that one of its children changed name. */
const _nameChanged = Symbol("Authoring.nameChanged");

/** Applies the custom attributes an `init` object carries, in order. */
function addCustomAttributes(target: CustomAttributeSet, customAttributes: ReadonlyArray<CustomAttributeProps> | undefined): void {
  for (const props of customAttributes ?? [])
    target.add(props);
}

/** A collection of [Authoring.SchemaDocument]($ecschema-metadata)s that know about each other: the scope every item
 * reference in those documents resolves against, and the authority over their lifetime.
 *
 * A set holds at most **one document per schema name**, compared case-insensitively - `BisCore
 * 1.0.0` and `BisCore 1.0.15` cannot both be in one set. Nothing appears in a set unless someone
 * put it there. There is no locater, no on-demand loading, and no priority chain; use
 * [Authoring.SchemaResolver]($ecschema-metadata) to work out *which* schemas a document needs and to load them in.
 *
 * **Every document belongs to exactly one set, always.** That is what keeps a schema graph clean,
 * and it is the one rule to internalize:
 *
 * - `new SchemaDocument(...)` produces a document in a private set of its own, containing only it.
 * - [Authoring.SchemaSet.createSchema]($ecschema-metadata) constructs a document directly into this set.
 * - [Authoring.SchemaSet.moveIn]($ecschema-metadata) takes a document **out of** the set it is in and puts it here. There
 *   is deliberately no `add` - a document cannot be in two sets, so joining one always means
 *   leaving another.
 * - [Authoring.SchemaSet.moveOut]($ecschema-metadata) hands a document back in a fresh private set of its own, so it is
 *   never left without one.
 *
 * @example
 * ```ts
 * const set = new Authoring.SchemaSet();
 * const bis = set.createSchema("BisCore", "bis", 1, 0, 15);
 * set.moveIn(myDocument);            // myDocument leaves its previous set
 * myDocument.schemaSet === set;      // true
 * for (const document of set) { ... }
 * const detached = set.moveOut("MyDomain");  // back in a private set of its own
 * ```
 * @alpha
 */
export class SchemaSet implements Iterable<SchemaDocument> {
  /** Keyed by lowercased schema name - name lookup is the hot path of every reference resolution. */
  private readonly _byName = new Map<string, SchemaDocument>();

  /** Creates a set, optionally moving documents in straight away (see [Authoring.SchemaSet.moveIn]($ecschema-metadata)). */
  public constructor(documents?: Iterable<SchemaDocument>) {
    if (documents !== undefined) {
      for (const document of documents)
        this.moveIn(document);
    }
  }

  /** The number of documents in the set. */
  public get size(): number {
    return this._byName.size;
  }

  /** Iterates the documents in insertion order. */
  public [Symbol.iterator](): IterableIterator<SchemaDocument> {
    return this._byName.values();
  }

  /** The documents in insertion order, as an array. */
  public get schemas(): SchemaDocument[] {
    return [...this._byName.values()];
  }

  /** Constructs a document and holds it here. Same arguments as the [Authoring.SchemaDocument]($ecschema-metadata)
   * constructor. Throws if the set already holds a schema of that name. */
  public createSchema(name: string, alias: string, readVersion: number, writeVersion: number, minorVersion: number, init?: SchemaDocumentInit): SchemaDocument {
    this._requireNameFree(name);
    const document = new SchemaDocument(name, alias, readVersion, writeVersion, minorVersion, init);
    this.moveIn(document);
    return document;
  }

  /** Moves documents into this set, removing each from the set it currently belongs to. A document
   * already in this set is left alone. Throws if this set already holds a *different* document of
   * the same name - call [Authoring.SchemaSet.moveOut]($ecschema-metadata) for the incumbent first, so evicting it is
   * always the caller's decision. */
  public moveIn(...documents: SchemaDocument[]): void {
    for (const document of documents) {
      if (document.schemaSet === this)
        continue;
      this._requireNameFree(document.name);
      document.schemaSet._detach(document);
      this._byName.set(document.name.toLowerCase(), document);
      document[_setOwner](this);
    }
  }

  /** Removes the named schema (case-insensitive) and returns it in a fresh private set of its own,
   * or `undefined` if the set does not hold it. Accepts the document itself as well, which removes
   * it only if this set is the one holding it. */
  public moveOut(schema: string | SchemaDocument): SchemaDocument | undefined {
    const document = typeof schema === "string" ? this.getSchema(schema) : (schema.schemaSet === this ? schema : undefined);
    if (document === undefined)
      return undefined;
    this._detach(document);
    const privateSet = new SchemaSet();
    document[_setOwner](privateSet);
    privateSet[_attach](document);
    return document;
  }

  /** Returns the named schema (case-insensitive), or `undefined`. */
  public getSchema(name: string): SchemaDocument | undefined {
    return this._byName.get(name.toLowerCase());
  }

  /** True when the set holds a schema of that name (case-insensitive). */
  public hasSchema(name: string): boolean {
    return this._byName.has(name.toLowerCase());
  }

  /** Returns the item a schema-qualified full name (`"BisCore:Element"`, either separator) points
   * at, or `undefined` when the schema is not in the set or holds no such item. Aliases are not
   * accepted here - an alias is a property of the *referencing* document, so resolve through that
   * document ([Authoring.SchemaDocument.resolveItem]($ecschema-metadata)) when you have one. */
  public getItem(fullName: LocalOrFullName): AnySchemaItem | undefined {
    const { qualifier, name } = splitReference(fullName);
    if (qualifier === undefined)
      return undefined;
    return this.getSchema(qualifier)?.getItem(name);
  }

  /** Drops the document from this set's map without giving it a new owner - the caller must. */
  private _detach(document: SchemaDocument): void {
    this._byName.delete(document.name.toLowerCase());
  }

  /** @internal Registers a document that already points at this set - how a document constructed
   * with `new` joins the private set it creates for itself. */
  public [_attach](document: SchemaDocument): void {
    this._byName.set(document.name.toLowerCase(), document);
  }

  private _requireNameFree(name: string): void {
    const incumbent = this._byName.get(name.toLowerCase());
    if (incumbent !== undefined)
      SchemaAuthoringError.throwError("duplicate-schema-name",
        `The schema set already holds a schema named "${incumbent.name}" (${incumbent.readVersion}.${incumbent.writeVersion}.${incumbent.minorVersion}); a set holds one version per name. Move it out first.`,
        { itemName: incumbent.name });
  }
}

/**
 * An editable ECSchema: a namespace containing classes, properties, relationships, and other EC definitions.
 * @remarks
 * Models EC 3.2 and permits unfinished edits: duplicate names, unresolved references, and missing
 * required fields are reported by [Authoring.validateSchemaDocument]($ecschema-metadata) or [Authoring.validateSchemaSet]($ecschema-metadata).
 * Item names share one case-insensitive namespace across all item kinds. Schemas can reference
 * other schemas, but cannot nest or form reference cycles in a valid schema set.
 *
 * Every document belongs to exactly one [Authoring.SchemaSet]($ecschema-metadata), which is the scope its item references
 * resolve against. A document created with `new` gets a private set of its own; see
 * [Authoring.SchemaSet]($ecschema-metadata) for how documents move between sets.
 *
 * Items are **owned**: an item is created into a document and belongs to exactly one, the same rule
 * a document has with its schema set. The `create*` factories are the front door; the equivalent
 * `new X(document, ...)` constructors are public and do the same thing.
 * @example
 * ```ts
 * const doc = new SchemaDocument("MyDomain", "mydom", 1, 0, 0, {
 *   references: [{ name: "BisCore", readVersion: 1, writeVersion: 0, minorVersion: 0, alias: "bis" }],
 * });
 * const pump = doc.createEntity("Pump", { label: "Pump", baseClass: "BisCore:PhysicalElement" });
 * pump.createPrimitive("FlowRate", PrimitiveType.Double, { kindOfQuantity: "AecUnits:VOLUMETRIC_FLOW" });
 * const serial = pump.createPrimitive("SerialNumber", PrimitiveType.String);
 * serial.customAttributes.add(CoreCustomAttributes.hiddenProperty());
 * ```
 * @alpha
 */
export class SchemaDocument {
  /** Stable schema identifier and namespace for its items. Must be a valid [ECName]($ecschema-metadata); comparisons ignore case. */
  public readonly name: string;
  /** Short EC name for qualifying item references. Referencing schemas may choose a different local alias. */
  public alias: string;
  /** Read component of `RR.WW.mm`. Increment when the old schema can no longer read the new data. */
  public readVersion: number;
  /** Write component of `RR.WW.mm`. Increment when the old schema can still read, but cannot safely write, the new data. */
  public writeVersion: number;
  /** Minor component of `RR.WW.mm`. Increment for changes that preserve read and write compatibility. */
  public minorVersion: number;
  /** Human-readable display name for UI and localization; independent of the schema's identifier. */
  public label?: string;
  /** User-facing plain-text explanation of the schema's purpose. */
  public description?: string;
  /** Major component of the EC spec version this document was deserialized from (`3` for a 3.2
   * source), as a hint about its origin. `undefined` for documents created in memory, which are
   * treated as the latest known spec. Purely informational. */
  public originalECXmlVersionMajor?: number;
  /** Minor component to go along with [Authoring.SchemaDocument.originalECXmlVersionMajor]($ecschema-metadata) (`2` for a 3.2 source). */
  public originalECXmlVersionMinor?: number;
  /** Points back to the source the schema was deserialized from, e.g., a file path or URL. */
  public source?: string;
  /** Schema references (`name` + version components, each with its own local `alias`), in declaration order. */
  public readonly references: SchemaReference[] = [];
  /** Schema-level custom attributes. */
  public readonly customAttributes: CustomAttributeSet;

  private readonly _items: AnySchemaItem[] = [];
  private readonly _itemLookup = new NameLookup(this._items);
  private _schemaSet: SchemaSet;

  /** Creates a new document with the given identity, in a private [Authoring.SchemaSet]($ecschema-metadata) of its own.
   * `init` carries the complementary schema-level data; every field left out keeps its default. */
  public constructor(name: string, alias: string, readVersion: number, writeVersion: number, minorVersion: number, init?: SchemaDocumentInit) {
    this.name = name;
    this.alias = alias;
    this.readVersion = readVersion;
    this.writeVersion = writeVersion;
    this.minorVersion = minorVersion;
    this.customAttributes = new CustomAttributeSet(this);
    this._schemaSet = new SchemaSet();
    this._schemaSet[_attach](this);
    if (init) {
      this.label = init.label;
      this.description = init.description;
      this.originalECXmlVersionMajor = init.originalECXmlVersionMajor;
      this.originalECXmlVersionMinor = init.originalECXmlVersionMinor;
      this.source = init.source;
      if (init.references) {
        for (const reference of init.references)
          this.setSchemaReference(reference);
      }
      addCustomAttributes(this.customAttributes, init.customAttributes);
    }
  }

  /** The set this document belongs to - never `undefined`, and the scope every item reference in it
   * resolves against. A document created with `new` has a private set containing only itself. Use
   * [Authoring.SchemaSet.moveIn]($ecschema-metadata) / [Authoring.SchemaSet.moveOut]($ecschema-metadata) to change it. */
  public get schemaSet(): SchemaSet {
    return this._schemaSet;
  }

  /** @internal */
  public [_setOwner](schemaSet: SchemaSet): void {
    this._schemaSet = schemaSet;
  }

  /** The schema items (classes, enumerations, ...) in declaration order. Read-only because the
   * document owns them: an item is created into a document and stays there until it is removed or
   * moved. Use the `create*` factories (or the equivalent item constructors),
   * [Authoring.SchemaDocument.moveItemIn]($ecschema-metadata), and [Authoring.SchemaDocument.removeItem]($ecschema-metadata). */
  public get items(): ReadonlyArray<AnySchemaItem> {
    return this._items;
  }

  /** Moves items into this document, removing each from the document it currently belongs to - an
   * item belongs to exactly one, the way a document belongs to exactly one [Authoring.SchemaSet]($ecschema-metadata). The
   * item's own references are **not** rewritten: they were written in the origin's vocabulary and
   * only the caller knows what they should mean here. Duplicate names are allowed, consistent with
   * the document tolerating invalid states. */
  public moveItemIn(...items: SchemaItem[]): void {
    for (const item of items) {
      if (item.document === this)
        continue;
      item.document._detachItem(item);
      this._items.push(item as AnySchemaItem);
      item[_setOwner](this);
    }
    this._itemLookup.invalidate();
  }

  /** Removes the first item with the given name (case-insensitive) and returns whether there was
   * one. The item is gone: to keep it, move it into another document instead
   * ([Authoring.SchemaDocument.moveItemIn]($ecschema-metadata)). */
  public removeItem(name: string): boolean {
    const index = this._items.findIndex((i) => namesEqual(i.name, name));
    if (index === -1)
      return false;
    this._items.splice(index, 1);
    this._itemLookup.invalidate();
    return true;
  }

  /** @internal Registers an item constructed into this document. */
  public [_attach](item: SchemaItem): void {
    this._items.push(item as AnySchemaItem);
    this._itemLookup.invalidate();
  }

  /** @internal Keeps item lookup in step with an in-place rename. */
  public [_nameChanged](item: SchemaItem, previousName: string): void {
    this._itemLookup.rename(item as AnySchemaItem, previousName);
  }

  private _detachItem(item: SchemaItem): void {
    const index = this._items.indexOf(item as AnySchemaItem);
    if (index >= 0)
      this._items.splice(index, 1);
    this._itemLookup.invalidate();
  }

  /** A read-only {@link SchemaKey} over this document's current name and version, for matching and
   * comparing against other keys (`matches`, `compareByVersion`, the `SchemaMatchType` rules).
   * A new key is constructed on each access. Throws if a version component is out of range, since
   * a key cannot represent one - the one place the otherwise validity-free document enforces its data. */
  public get key(): SchemaKey {
    return new SchemaKey(this.name, this.readVersion, this.writeVersion, this.minorVersion);
  }

  /** Sets a schema reference: appends it, or replaces the existing reference of the same name
   * (case-insensitive) in place. The fields are copied into a stored reference, which is returned
   * for further configuration. Any object of the [Authoring.SchemaReference]($ecschema-metadata) shape can be
   * passed - a hand-written literal, another [Authoring.SchemaDocument]($ecschema-metadata), or a `SchemaView` `Schema` -
   * so a reference is derived from a schema a caller already holds by just passing it. The source's
   * own `alias` is then only the suggested default; set a different one on the returned reference
   * if this document uses one. */
  public setSchemaReference(reference: Readonly<SchemaReference>): SchemaReference {
    const stored: SchemaReference = {
      name: reference.name,
      readVersion: reference.readVersion,
      writeVersion: reference.writeVersion,
      minorVersion: reference.minorVersion,
      alias: reference.alias,
    };
    const index = this.references.findIndex((r) => namesEqual(r.name, stored.name));
    if (index >= 0)
      this.references[index] = stored;
    else
      this.references.push(stored);
    return stored;
  }

  /** Returns the schema reference with the given name (case-insensitive), or `undefined`. */
  public getSchemaReference(name: string): SchemaReference | undefined {
    return this.references.find((r) => namesEqual(r.name, name));
  }

  /** Gives every reference that has no alias the referenced schema's own, taken from this
   * document's [Authoring.SchemaSet]($ecschema-metadata), and returns how many were filled in. References that already have
   * an alias are left alone, and so are those whose schema the set does not hold.
   *
   * ECJSON qualifies item references by schema name and carries no alias at all, so a document read
   * from it cannot be written as ECXML, which requires one on every reference. Once the referenced
   * schemas are in the set, each one's own alias is the sensible default - it is what native writes
   * - and this applies it. Nothing else needs it: ECXML sources carry their aliases already. */
  public fillMissingReferenceAliases(): number {
    let filled = 0;
    for (const reference of this.references) {
      if (reference.alias !== null)
        continue;
      const alias = this._schemaSet.getSchema(reference.name)?.alias;
      if (alias === undefined || alias.length === 0)
        continue;
      reference.alias = alias;
      ++filled;
    }
    return filled;
  }

  /** Returns the document a schema reference points at, looked up by name in this document's
   * [Authoring.SchemaSet]($ecschema-metadata), or `undefined` when the set does not hold it. The set holds one version per
   * name, so the reference's version components take no part in the lookup - a version mismatch
   * between the reference and the document in the set is a validation finding, not a resolve miss. */
  public getReferencedSchema(name: string): SchemaDocument | undefined {
    return this._schemaSet.getSchema(name);
  }

  /** Returns the first item with the given name (case-insensitive), or `undefined`. */
  public getItem(name: string): AnySchemaItem | undefined {
    return this._itemLookup.get(name);
  }

  /** The name of the schema an item reference points at: this document's own name for an
   * unqualified reference, the referenced schema name or matching alias, or the qualifier itself
   * when it is undeclared. Schema names take precedence over aliases with the same spelling.
   * Answers "which schema" without requiring the schema to be in the set. */
  public resolveSchemaName(reference: LocalOrFullName): string {
    const { qualifier } = splitReference(reference);
    if (qualifier === undefined || namesEqual(qualifier, this.name))
      return this.name;

    // Schema-name qualification is the canonical in-memory form and must win over an alias with
    // the same spelling (for example, the legacy Units_Schema commonly has alias "Units").
    const byName = this.references.find((r) => namesEqual(r.name, qualifier));
    if (byName !== undefined)
      return byName.name;

    if (namesEqual(qualifier, this.alias))
      return this.name;
    const byAlias = this.references.find((r) => r.alias !== null && namesEqual(r.alias, qualifier));
    return byAlias?.name ?? qualifier;
  }

  /** Resolves an item reference to the document that should hold the item, or `undefined` when the
   * schema set does not hold it. An unqualified reference (`"Pump"`) means this document. A
   * qualified one (`"BisCore:Element"`, `"bis.Element"`) is matched by schema name first and then
   * by alias, and the resulting schema name is looked up in the set. */
  public resolveDocument(reference: LocalOrFullName): SchemaDocument | undefined {
    const schemaName = this.resolveSchemaName(reference);
    return namesEqual(schemaName, this.name) ? this : this._schemaSet.getSchema(schemaName);
  }

  /** Resolves an item reference to the item itself, or `undefined` when it does not resolve - the
   * schema set does not hold the target schema, or that schema has no such item. A miss is silent;
   * a dangling reference is reported by validation, not by an accessor.
   * @see [Authoring.SchemaDocument.resolveDocument]($ecschema-metadata) for how a reference maps to a schema. */
  public resolveItem(reference: LocalOrFullName): AnySchemaItem | undefined {
    const { name } = splitReference(reference);
    return this.resolveDocument(reference)?.getItem(name);
  }

  /** Resolves an item reference and narrows it to the given kind, or `undefined` when it does not
   * resolve or resolves to an item of a different kind. `itemType` may be a concrete
   * {@link SchemaItemType} or a grouping ({@link AbstractSchemaItemType.Class}). */
  public resolveItemOfType<K extends keyof SchemaItemTypeMap>(reference: LocalOrFullName, itemType: K): SchemaItemTypeMap[K] | undefined {
    const item = this.resolveItem(reference);
    return item !== undefined && isItemOfKind(item.schemaItemType, itemType) ? item as SchemaItemTypeMap[K] : undefined;
  }

  /** Builds the reference string this document uses to refer to `item`, and is what every setter
   * that accepts an item calls. An item of this document yields its bare name; an item of another
   * document yields `"SchemaName:ItemName"` and, when this document has no reference to that schema
   * yet, **one is added** using the other schema's version and its own alias as the suggested
   * default. An existing reference is never modified, so a version disagreement stays visible to
   * validation instead of being silently rewritten. */
  public referenceTo(item: SchemaItem): LocalOrFullName {
    const owner = item.document;
    if (owner === this)
      return item.name;
    if (this.getSchemaReference(owner.name) === undefined)
      this.setSchemaReference(owner);
    return `${owner.name}:${item.name}`;
  }

  /** Returns the first item with the given name whose kind matches `itemType`, narrowed to that
   * kind's type, or `undefined` (no such name, or a name of a different kind). `itemType` may be a
   * concrete {@link SchemaItemType} or a grouping ({@link AbstractSchemaItemType.Class},
   * {@link AbstractSchemaItemType.SchemaItem}), in which case any member kind matches.
   * Covers every item kind; dedicated getters like [Authoring.SchemaDocument.getEntity]($ecschema-metadata) exist only for
   * the most common ones. */
  public getItemOfType<K extends keyof SchemaItemTypeMap>(name: string, itemType: K): SchemaItemTypeMap[K] | undefined {
    const item = this.getItem(name);
    return item !== undefined && isItemOfKind(item.schemaItemType, itemType) ? item as SchemaItemTypeMap[K] : undefined;
  }

  /** Iterates every item of the given kind in declaration order, narrowed to that kind's type.
   * `itemType` may be a concrete {@link SchemaItemType} or a grouping
   * ({@link AbstractSchemaItemType.Class}, {@link AbstractSchemaItemType.SchemaItem}). */
  public *getItemsOfType<K extends keyof SchemaItemTypeMap>(itemType: K): IterableIterator<SchemaItemTypeMap[K]> {
    for (const item of this.items) {
      if (isItemOfKind(item.schemaItemType, itemType))
        yield item as SchemaItemTypeMap[K];
    }
  }

  /** Returns the first entity class with the given name, or `undefined`. Sugar over
   * [Authoring.SchemaDocument.getItemOfType]($ecschema-metadata) for the common case. */
  public getEntity(name: string): EntityClass | undefined {
    return this.getItemOfType(name, SchemaItemType.EntityClass);
  }

  /** Iterates every entity class in declaration order. Sugar over [Authoring.SchemaDocument.getItemsOfType]($ecschema-metadata). */
  public getEntities(): IterableIterator<EntityClass> {
    return this.getItemsOfType(SchemaItemType.EntityClass);
  }

  /** Creates an entity class, appends it, and returns it. */
  public createEntity(name: string, init?: EntityClassInit): EntityClass {
    return new EntityClass(this, name, init);
  }

  /** Creates a mixin, appends it, and returns it. `appliesTo` is the entity class the mixin may be
   * applied to (mandatory data). A mixin is abstract by definition regardless of its
   * [Authoring.ECClass.modifier]($ecschema-metadata) - see [Authoring.Mixin]($ecschema-metadata). */
  public createMixin(name: string, appliesTo: LocalOrFullName, init?: ClassInit): Mixin {
    return new Mixin(this, name, appliesTo, init);
  }

  /** Creates a struct class, appends it, and returns it. */
  public createStructClass(name: string, init?: ClassInit): StructClass {
    return new StructClass(this, name, init);
  }

  /** Creates a view, appends it, and returns it. `query` is the ECSQL its instances come from
   * (mandatory data). Declare a property per column the query returns - see [Authoring.View]($ecschema-metadata). */
  public createView(name: string, query: string, init?: ClassInit): View {
    return new View(this, name, query, init);
  }

  /** Creates a custom attribute class, appends it, and returns it. `appliesTo` is the bitmask of
   * container kinds the attribute may be applied to (mandatory data). */
  public createCustomAttributeClass(name: string, appliesTo: CustomAttributeContainerType, init?: ClassInit): CustomAttributeClass {
    return new CustomAttributeClass(this, name, appliesTo, init);
  }

  /** Creates a relationship class, appends it, and returns it. Configure the `source` and `target`
   * constraints inline via `init`, or on the returned handle with [Authoring.RelationshipConstraint.set]($ecschema-metadata). */
  public createRelationship(name: string, init?: RelationshipClassInit): RelationshipClass {
    return new RelationshipClass(this, name, init);
  }

  /** Creates an enumeration item, appends it, and returns it. `backingType` is the enumeration's
   * backing primitive (`"int"` or `"string"`). Add values with [Authoring.Enumeration.createEnumerator]($ecschema-metadata).
   * Note: this creates the enumeration *item*; to add an enumeration-backed *property* to a class use
   * [Authoring.ECClass.createEnumeration]($ecschema-metadata). */
  public createEnumeration(name: string, backingType: EnumerationBackingType, init?: EnumerationInit): Enumeration {
    return new Enumeration(this, name, backingType, init);
  }

  /** Creates a kind of quantity, appends it, and returns it. `persistenceUnit` is the unit reference
   * the KoQ persists in and `relativeError` its conversion tolerance (both mandatory data). */
  public createKindOfQuantity(name: string, persistenceUnit: LocalOrFullName, relativeError: number, init?: KindOfQuantityInit): KindOfQuantity {
    return new KindOfQuantity(this, name, persistenceUnit, relativeError, init);
  }

  /** Creates a property category, appends it, and returns it. */
  public createPropertyCategory(name: string, init?: PropertyCategoryInit): PropertyCategory {
    return new PropertyCategory(this, name, init);
  }

  /** Creates a unit system, appends it, and returns it. */
  public createUnitSystem(name: string, init?: SchemaItemInit): UnitSystem {
    return new UnitSystem(this, name, init);
  }

  /** Creates a phenomenon, appends it, and returns it. `definition` is its defining expression
   * (mandatory data). */
  public createPhenomenon(name: string, definition: string, init?: SchemaItemInit): Phenomenon {
    return new Phenomenon(this, name, definition, init);
  }

  /** Creates a unit, appends it, and returns it. `phenomenon` and `unitSystem` are item references
   * and `definition` its defining expression (all mandatory data). */
  public createUnit(name: string, phenomenon: LocalOrFullName, unitSystem: LocalOrFullName, definition: string, init?: UnitInit): Unit {
    return new Unit(this, name, phenomenon, unitSystem, definition, init);
  }

  /** Creates an inverted unit, appends it, and returns it. `invertsUnit` references the unit it is
   * the reciprocal of and `unitSystem` the system it belongs to (both mandatory data). */
  public createInvertedUnit(name: string, invertsUnit: LocalOrFullName, unitSystem: LocalOrFullName, init?: SchemaItemInit): InvertedUnit {
    return new InvertedUnit(this, name, invertsUnit, unitSystem, init);
  }

  /** Creates a constant, appends it, and returns it. `phenomenon` is an item reference and
   * `definition` its defining expression (both mandatory data). */
  public createConstant(name: string, phenomenon: LocalOrFullName, definition: string, init?: ConstantInit): Constant {
    return new Constant(this, name, phenomenon, definition, init);
  }

  /** Creates a format, appends it, and returns it. `type` is the numeric rendering kind (mandatory
   * data). */
  public createFormat(name: string, type: FormatType, init?: FormatInit): Format {
    return new Format(this, name, type, init);
  }
}

/** A relationship endpoint's multiplicity, as the `(lo..hi)` string the constraint stores.
 *
 * The four common values are spelled out so editors suggest them; any other well-formed range is
 * accepted, because bounded ranges above one are legal and do occur in published schemas
 * (`(2..2)`, `(0..2)`, `(2..*)`, `(1..2)` all appear in BIS). Use
 * [Authoring.parseMultiplicity]($ecschema-metadata) / [Authoring.formatMultiplicity]($ecschema-metadata) to work in numbers instead of strings;
 * validation is what reports a malformed one.
 * @alpha
 */
export type Multiplicity = "(0..1)" | "(0..*)" | "(1..1)" | "(1..*)" | (string & {});

/** The bounds of a [Authoring.Multiplicity]($ecschema-metadata), as numbers.
 * @alpha
 */
export interface MultiplicityBounds {
  /** Lower bound; `0` or more. */
  lowerLimit: number;
  /** Upper bound; at least `1` and no less than the lower bound, or `undefined` when unbounded (`*`)
   * - the same convention [Authoring.PrimitiveArrayProperty.maxOccurs]($ecschema-metadata) uses. */
  upperLimit?: number;
}

/** Matches `(lo..hi)` with optional surrounding whitespace, `hi` being a number or `*`. */
const multiplicityPattern = /^\(\s*(\d+)\s*\.\.\s*(\d+|\*)\s*\)$/;

/** Reads a multiplicity string into its numeric bounds, or `undefined` when it is not well-formed.
 * Does not judge whether the bounds are valid - `"(0..0)"` and `"(5..2)"` parse; validation reports
 * a zero upper bound or an upper bound below the lower bound.
 * @alpha
 */
export function parseMultiplicity(multiplicity: string): MultiplicityBounds | undefined {
  const match = multiplicityPattern.exec(multiplicity);
  if (match === null)
    return undefined;
  const upper = match[2];
  return { lowerLimit: Number(match[1]), upperLimit: upper === "*" ? undefined : Number(upper) };
}

/** Writes numeric bounds back to the string form a constraint stores.
 * @alpha
 */
export function formatMultiplicity(bounds: MultiplicityBounds): Multiplicity {
  return `(${bounds.lowerLimit}..${bounds.upperLimit ?? "*"})`;
}

/** A reference to a schema item, as a plain string. Either a bare local name (`"Pump"` - an item in
 * this same schema) or a full name (`"BisCore:PhysicalElement"`). On input it also tolerates the
 * alias-qualified form (`"bis:PhysicalElement"`) and the dot separator
 * (`"BisCore.PhysicalElement"`). Names compare case-insensitively. Store names here and use the
 * corresponding getter to resolve them through the document's [Authoring.SchemaSet]($ecschema-metadata); an unresolved
 * name is allowed during editing and reported by validation.
 * @alpha
 */
export type LocalOrFullName = string;

/** The spec-defined value each optional, defaultable field reads as when absent. The document keeps
 * "set to the default" and "absent" distinct so it can round-trip a source exactly, so these are
 * not applied on construction. They are the single source of truth for what the defaults are: the
 * per-field doc comments below point here, and a writer asked to drop redundant defaults (the
 * `omitDefaults` option of [Authoring.SchemaJsonWriter]($ecschema-metadata)) consults this.
 * @alpha
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const SpecDefaults = {
  /** A class with no `modifier`. */
  classModifier: ECClassModifier.None,
  /** A mixin's `modifier`. A mixin is abstract by definition, so this is the value `omitDefaults`
   * treats as redundant. An explicit non-abstract modifier on a mixin is meaningless - nothing in
   * this stack enforces or acts on it - but it is kept verbatim rather than silently rewritten
   * (see [Authoring.Mixin]($ecschema-metadata)). */
  mixinModifier: ECClassModifier.Abstract,
  /** A relationship with no `strength`. */
  relationshipStrength: StrengthType.Referencing,
  /** A relationship with no `strengthDirection`. */
  relationshipStrengthDirection: StrengthDirection.Forward,
  /** A relationship constraint with no `polymorphic` flag. */
  constraintPolymorphic: true,
  /** A format with no `roundFactor` - round to precision. */
  formatRoundFactor: 0,
  /** A format with no `showSignOption`. */
  formatShowSignOption: ShowSignOption.OnlyNegative,
  /** A format with no `decimalSeparator`. */
  formatDecimalSeparator: ".",
  /** A format with no `thousandSeparator`. */
  formatThousandSeparator: ",",
  /** A format with no `uomSeparator`. */
  formatUomSeparator: " ",
  /** A format with no `stationSeparator`. */
  formatStationSeparator: "+",
  /** A format composite with no `spacer`. */
  compositeSpacer: " ",
  /** A format composite with no `includeZero` flag. */
  compositeIncludeZero: true,
} as const;

/** A reference to another schema: invariant `name` + the three version components, plus the `alias`
 * this document uses for it within its own scope. Both [Authoring.SchemaDocument]($ecschema-metadata) and a `SchemaView`
 * `Schema` satisfy this shape structurally, so a schema a caller already holds can be passed
 * directly wherever a reference is expected.
 * @remarks
 * Declare a reference for each external schema whose items this document uses. A compatible
 * referenced version has matching read/write components and a minor component at least as high
 * as requested. Declaring a reference does not load its schema into the [Authoring.SchemaSet]($ecschema-metadata).
 * @alpha
 */
export interface SchemaReference {
  /** Stable name of the referenced schema, compared case-insensitively. */
  name: string;
  /** Read component of the referenced `RR.WW.mm` version. */
  readVersion: number;
  /** Write component of the referenced `RR.WW.mm` version. */
  writeVersion: number;
  /** Minor component of the referenced `RR.WW.mm` version. */
  minorVersion: number;
  /** Local shorthand for this schema in item references; may differ from the referenced schema's own alias.
   * Must be unique among this document's own and reference aliases, ignoring case. Use `null` when
   * unknown. ECXML requires an alias on every reference; ECJSON does not carry it. */
  alias: string | null;
}

/** Complementary schema-level data accepted by the [Authoring.SchemaDocument]($ecschema-metadata) constructor.
 * @alpha
 */
export interface SchemaDocumentInit {
  /** Human-readable display name for UI and localization. */
  label?: string;
  /** User-facing plain-text explanation of the schema's purpose. */
  description?: string;
  originalECXmlVersionMajor?: number;
  originalECXmlVersionMinor?: number;
  source?: string;
  /** Set through [Authoring.SchemaDocument.setSchemaReference]($ecschema-metadata), so the same shapes are accepted
   * (a literal, a held [Authoring.SchemaDocument]($ecschema-metadata), a `SchemaView` `Schema`) and the fields are copied. */
  references?: ReadonlyArray<Readonly<SchemaReference>>;
  /** Schema-level custom attributes, added in order. */
  customAttributes?: ReadonlyArray<CustomAttributeProps>;
}

/** A raw ECXML custom-attribute body: the value elements of a custom attribute exactly as the XML
 * reader found them. Held verbatim until the attribute is materialized against its class, and
 * written straight back out when it never is. A type alias over `string`.
 * @alpha
 */
export type XmlString = string;

/** One value inside a [Authoring.CustomAttribute]($ecschema-metadata): a primitive, a nested struct, or an array of either.
 * Primitives are already typed - the conversion from a source format produced them against the
 * custom attribute class, so a `boolean` property is a `boolean` here and not the string `"True"`.
 * @alpha
 */
export type CustomAttributeValue = string | number | boolean | CustomAttributeValues | CustomAttributeValue[];

/** The values of a [Authoring.CustomAttribute]($ecschema-metadata), keyed by the property names of its custom attribute
 * class. This is the canonical ECJSON shape of a custom attribute instance minus its `className`,
 * and it serializes to any output format.
 * @alpha
 */
export interface CustomAttributeValues { [name: string]: CustomAttributeValue }

/** Anything a [Authoring.CustomAttributeSet]($ecschema-metadata) can be attached to: a schema, a class, a property, or a
 * relationship constraint. A custom attribute reaches its [Authoring.SchemaDocument]($ecschema-metadata) through its
 * container, which is how it finds its own custom attribute class.
 * @alpha
 */
export type CustomAttributeContainer = SchemaDocument | ECClass | Property | RelationshipConstraint;

/** The plain shape accepted by [Authoring.CustomAttributeSet.add]($ecschema-metadata): a custom attribute class name and
 * optional values. The typed helpers for the standard custom attribute classes
 * ([Authoring.CoreCustomAttributes]($ecschema-metadata), [Authoring.ECDbMap]($ecschema-metadata)) return this shape.
 * @alpha
 */
export interface CustomAttributeProps {
  className: LocalOrFullName;
  values?: CustomAttributeValues;
}

/** Typed metadata applied to a schema, class, property, or relationship constraint.
 * @remarks
 * The custom attribute class defines the value shape and allowed container kinds. EC permits one
 * instance of each attribute class per container. Use [Authoring.CustomAttributeSet.set]($ecschema-metadata) to add or
 * replace that instance; [Authoring.CustomAttributeSet.add]($ecschema-metadata) preserves duplicates for repair workflows.
 *
 * An attribute read from ECXML retains its raw body until value access or output requires
 * materialization. Its class is needed to interpret the text values, structs, and arrays.
 * Resolution uses the document's [Authoring.SchemaSet]($ecschema-metadata), with built-in standard definitions
 * ([Authoring.CoreCustomAttributes]($ecschema-metadata), [Authoring.ECDbMap]($ecschema-metadata)) as fallbacks.
 *
 * [Authoring.CustomAttribute.values]($ecschema-metadata) throws if materialization needs a class that cannot be resolved;
 * [Authoring.CustomAttribute.tryGetValues]($ecschema-metadata) returns `undefined`. Writers report issues and can preserve
 * an unresolved XML body in XML output. Cross-format conversion requires the class metadata.
 * @alpha
 */
export class CustomAttribute {
  /** Full name of the custom attribute class, e.g. `"CoreCustomAttributes.DynamicSchema"`. Either EC
   * separator (`:` or `.`) is accepted and they compare as equal. The XML reader fills this from the
   * entry element name and its `xmlns`; when authoring, prefer the schema-name form over an alias -
   * an alias only resolves once the document holds the matching reference. */
  public className: LocalOrFullName;

  private _values?: CustomAttributeValues;
  private _rawXml?: XmlString;
  private _container: CustomAttributeContainer;

  /** Creates a materialized custom attribute on a container - the authoring form. */
  public constructor(container: CustomAttributeContainer, className: LocalOrFullName, values?: CustomAttributeValues) {
    this._container = container;
    this.className = className;
    this._values = values ?? {};
    container.customAttributes[_attach](this);
  }

  /** Creates an unmaterialized custom attribute holding a raw ECXML body, for readers of that
   * format. The body is understood only when the attribute is materialized against its class. */
  public static fromXmlBody(container: CustomAttributeContainer, className: LocalOrFullName, body: XmlString | undefined): CustomAttribute {
    const instance = new CustomAttribute(container, className);
    instance._values = undefined;
    instance._rawXml = body ?? "";
    return instance;
  }

  /** The schema, class, property, or relationship constraint this attribute is applied to. */
  public get container(): CustomAttributeContainer {
    return this._container;
  }

  /** The document this attribute is applied within, reached through its container - the scope its
   * custom attribute class resolves in. */
  public get document(): SchemaDocument {
    const container = this._container;
    return container instanceof SchemaDocument ? container : container.document;
  }

  /** @internal */
  public [_setOwner](container: CustomAttributeContainer): void {
    this._container = container;
  }

  /** False while the attribute still holds an unconverted ECXML body. Diagnostic only - reading
   * [Authoring.CustomAttribute.values]($ecschema-metadata) materializes. */
  public get isMaterialized(): boolean {
    return this._values !== undefined;
  }

  /** The unconverted ECXML body, or `undefined` once the attribute is materialized. Writers use it
   * to pass an attribute through verbatim when its class cannot be resolved.
   * @internal
   */
  public get rawXml(): XmlString | undefined {
    return this._rawXml;
  }

  /** The attribute's values, materializing it if needed. Throws when materialization needs the
   * custom attribute class and it cannot be resolved - see the class remarks. The returned object
   * is the live one: editing it edits the attribute. */
  public get values(): CustomAttributeValues {
    if (this._values === undefined) {
      this._values = materializeCustomAttribute(this, true);
      this._rawXml = undefined;
    }
    return this._values;
  }

  public set values(values: CustomAttributeValues) {
    this._values = values;
    this._rawXml = undefined;
  }

  /** The attribute's values, or `undefined` when materialization needs the custom attribute class
   * and it cannot be resolved. The non-throwing form of [Authoring.CustomAttribute.values]($ecschema-metadata), for callers
   * that legitimately do not know whether the class is reachable. */
  public tryGetValues(): CustomAttributeValues | undefined {
    if (this._values === undefined) {
      this._values = materializeCustomAttribute(this, false);
      if (this._values !== undefined)
        this._rawXml = undefined;
    }
    return this._values;
  }

  /** The value of one property, or `undefined` when the attribute does not carry it. Materializes,
   * so it throws under the same conditions as [Authoring.CustomAttribute.values]($ecschema-metadata). */
  public getValue(name: string): CustomAttributeValue | undefined {
    return this.values[name];
  }

  /** Sets the value of one property. Materializes first, so an attribute read from ECXML is
   * converted against its class before being edited. */
  public setValue(name: string, value: CustomAttributeValue): void {
    this.values[name] = value;
  }

  /** `{ className }` plus the values when materialized, so `JSON.stringify` renders an attribute
   * transparently without materializing one that is not. */
  public toJSON(): CustomAttributeJson {
    if (this._values !== undefined)
      return { className: this.className, values: this._values };
    return { className: this.className, xml: this._rawXml };
  }
}

/** The plain shape a [Authoring.CustomAttribute]($ecschema-metadata) renders as: its class name plus either the materialized
 * `values` or, while it still holds an unconverted ECXML body, that `xml`.
 * @alpha
 */
export interface CustomAttributeJson {
  className: LocalOrFullName;
  values?: CustomAttributeValues;
  xml?: XmlString;
}

/** An ordered set of custom attribute instances on a container (schema, class, property, or
 * relationship constraint). The spec allows at most one instance per custom attribute class and
 * does not guarantee order on round-trip; this preserves insertion order and, consistent with the
 * validity-free stance, does not reject a second instance of the same class.
 * @alpha
 */
export class CustomAttributeSet implements Iterable<CustomAttribute> {
  private readonly _items: CustomAttribute[] = [];

  /** @internal */
  public constructor(private readonly _container: CustomAttributeContainer) { }

  /** The container these attributes are applied to. */
  public get container(): CustomAttributeContainer {
    return this._container;
  }

  /** The number of custom attribute instances. */
  public get size(): number {
    return this._items.length;
  }

  /** Iterates the custom attribute instances in insertion order. */
  public [Symbol.iterator](): IterableIterator<CustomAttribute> {
    return this._items[Symbol.iterator]();
  }

  /** Adds custom attributes and returns the last one, for follow-up configuration in one
   * expression. A `{ className, values? }` literal - what the typed helpers for the standard
   * classes return - is constructed here; an existing [Authoring.CustomAttribute]($ecschema-metadata) instance is moved
   * over from the container it is currently applied to. */
  public add(customAttribute: CustomAttributeProps | CustomAttribute, ...more: Array<CustomAttributeProps | CustomAttribute>): CustomAttribute {
    let last = this._addOne(customAttribute);
    for (const ca of more)
      last = this._addOne(ca);
    return last;
  }

  private _addOne(ca: CustomAttributeProps | CustomAttribute): CustomAttribute {
    if (!(ca instanceof CustomAttribute))
      return new CustomAttribute(this._container, ca.className, ca.values);
    if (ca.container !== this._container) {
      ca.container.customAttributes._detach(ca);
      ca[_setOwner](this._container);
      this._items.push(ca);
    }
    return ca;
  }

  /** Adds or replaces the first instance of the same custom attribute class and returns it. Class
   * names are compared by resolved identity, as in [Authoring.CustomAttributeSet.get]($ecschema-metadata). Replacement preserves the existing
   * instance and its position; use `add` when duplicate instances are intentional. */
  public set(customAttribute: CustomAttributeProps): CustomAttribute {
    const existing = this.get(customAttribute.className);
    if (existing === undefined)
      return this.add(customAttribute);
    existing.values = customAttribute.values ?? {};
    return existing;
  }

  /** Returns the first instance of the named custom attribute class, or `undefined`. Matching is
   * case-insensitive, treats the `:` and `.` separators as equivalent, and resolves schema names,
   * aliases, and an omitted same-schema qualifier to the same class identity. */
  public get(className: string): CustomAttribute | undefined {
    const key = this._identity(className);
    return this._items.find((ca) => this._identity(ca.className) === key);
  }

  /** True when an instance of the named custom attribute class is present. */
  public has(className: string): boolean {
    return this.get(className) !== undefined;
  }

  /** Removes the first instance of the named custom attribute class and returns whether there was
   * one. Matching follows [Authoring.CustomAttributeSet.get]($ecschema-metadata). To keep it, add it to another container instead, which moves it. */
  public remove(className: string): boolean {
    const key = this._identity(className);
    const idx = this._items.findIndex((ca) => this._identity(ca.className) === key);
    if (idx === -1)
      return false;
    this._items.splice(idx, 1);
    return true;
  }

  private _identity(className: string): string {
    const document = this._container instanceof SchemaDocument ? this._container : this._container.document;
    const { name } = splitReference(className);
    return foldFullName(`${document.resolveSchemaName(className)}:${name}`);
  }

  /** The instances as plain objects, so `JSON.stringify` renders the set transparently. */
  public toJSON(): CustomAttributeJson[] {
    return this._items.map((ca) => ca.toJSON());
  }

  /** @internal Registers an attribute constructed onto this container. */
  public [_attach](customAttribute: CustomAttribute): void {
    this._items.push(customAttribute);
  }

  private _detach(customAttribute: CustomAttribute): void {
    const index = this._items.indexOf(customAttribute);
    if (index >= 0)
      this._items.splice(index, 1);
  }
}

/** Complementary data shared by every schema item kind's constructor. Item kinds with no data of
 * their own (e.g. [Authoring.UnitSystem]($ecschema-metadata)) accept this directly; the others extend it.
 * @alpha
 */
export interface SchemaItemInit {
  /** Human-readable display name; consumers fall back to the item name when absent. */
  label?: string;
  /** User-facing plain-text explanation of the item's purpose. */
  description?: string;
}

/** Common base of every schema item. `schemaItemType` is the discriminant for narrowing; the
 * `is*()` / `assert*()` methods below mirror the same checks on `SchemaView`.
 *
 * An item belongs to exactly one [Authoring.SchemaDocument]($ecschema-metadata) - the one that resolves its references -
 * from the moment it is constructed. Every item constructor takes that document as its first
 * argument and registers the item with it, which is all the `create*` factories on the document do.
 * @alpha
 */
export abstract class SchemaItem {
  /** Discriminates the item kind. A getter rather than a field: this constructor registers the
   * item with its document, and a subclass field initializer would not have run yet at that point. */
  public abstract get schemaItemType(): ItemKind;
  /** Human-readable display name; consumers fall back to the item name when absent. */
  public label?: string;
  /** User-facing plain-text explanation of the item's purpose. */
  public description?: string;

  private _name: string;
  private _document: SchemaDocument;

  protected constructor(document: SchemaDocument, name: string) {
    this._document = document;
    this._name = name;
    document[_attach](this);
  }

  /** The item's [ECName]($ecschema-metadata), unique case-insensitively across all item kinds in its schema.
   * Changing it preserves object identity and declaration order and updates name lookup.
   * Stored references to the old name are not rewritten. */
  public get name(): string {
    return this._name;
  }

  public set name(name: string) {
    if (name === this._name)
      return;
    const previousName = this._name;
    this._name = name;
    this._document[_nameChanged](this, previousName);
  }

  /** The document this item belongs to. Every reference the item holds resolves through this
   * document and its [Authoring.SchemaSet]($ecschema-metadata). Changed only by [Authoring.SchemaDocument.moveItemIn]($ecschema-metadata). */
  public get document(): SchemaDocument {
    return this._document;
  }

  /** @internal */
  public [_setOwner](document: SchemaDocument): void {
    this._document = document;
  }

  /** `"SchemaName:ItemName"`. */
  public get fullName(): string {
    return `${this._document.name}:${this.name}`;
  }

  /** Narrows to [Authoring.EntityClass]($ecschema-metadata). */
  public isEntity(): this is EntityClass {
    return this.schemaItemType === SchemaItemType.EntityClass;
  }

  /** Narrows to [Authoring.Mixin]($ecschema-metadata). */
  public isMixin(): this is Mixin {
    return this.schemaItemType === SchemaItemType.Mixin;
  }

  /** Narrows to [Authoring.StructClass]($ecschema-metadata). */
  public isStruct(): this is StructClass {
    return this.schemaItemType === SchemaItemType.StructClass;
  }

  /** Narrows to [Authoring.CustomAttributeClass]($ecschema-metadata). */
  public isCustomAttribute(): this is CustomAttributeClass {
    return this.schemaItemType === SchemaItemType.CustomAttributeClass;
  }

  /** Narrows to [Authoring.RelationshipClass]($ecschema-metadata). */
  public isRelationship(): this is RelationshipClass {
    return this.schemaItemType === SchemaItemType.RelationshipClass;
  }

  /** Narrows to [Authoring.View]($ecschema-metadata). */
  public isView(): this is View {
    return this.schemaItemType === AuthoringSchemaItemType.View;
  }

  /** Narrows to [Authoring.AnyClass]($ecschema-metadata) - true for every class kind, [Authoring.View]($ecschema-metadata) included. */
  public isClass(): this is AnyClass {
    return isItemOfKind(this.schemaItemType, AbstractSchemaItemType.Class);
  }

  /** @see isEntity */
  public assertEntity(): asserts this is EntityClass {
    if (!this.isEntity())
      throw new Error(`Expected an entity class, got ${this.schemaItemType} for "${this.name}"`);
  }

  /** @see isMixin */
  public assertMixin(): asserts this is Mixin {
    if (!this.isMixin())
      throw new Error(`Expected a mixin, got ${this.schemaItemType} for "${this.name}"`);
  }

  /** @see isStruct */
  public assertStruct(): asserts this is StructClass {
    if (!this.isStruct())
      throw new Error(`Expected a struct class, got ${this.schemaItemType} for "${this.name}"`);
  }

  /** @see isCustomAttribute */
  public assertCustomAttribute(): asserts this is CustomAttributeClass {
    if (!this.isCustomAttribute())
      throw new Error(`Expected a custom attribute class, got ${this.schemaItemType} for "${this.name}"`);
  }

  /** @see isRelationship */
  public assertRelationship(): asserts this is RelationshipClass {
    if (!this.isRelationship())
      throw new Error(`Expected a relationship class, got ${this.schemaItemType} for "${this.name}"`);
  }

  /** @see isView */
  public assertView(): asserts this is View {
    if (!this.isView())
      throw new Error(`Expected a view, got ${this.schemaItemType} for "${this.name}"`);
  }

  /** @see isClass */
  public assertClass(): asserts this is AnyClass {
    if (!this.isClass())
      throw new Error(`Expected a class, got ${this.schemaItemType} for "${this.name}"`);
  }
}

/** Complementary data shared by every class kind's constructor.
 * @alpha
 */
export interface ClassInit {
  /** Instantiability and subclassing: `None`, `Abstract`, or `Sealed`. See [Authoring.ECClass.modifier]($ecschema-metadata). */
  modifier?: ECClassModifier;
  /** Human-readable display name; consumers fall back to the class name when absent. */
  label?: string;
  /** User-facing explanation of what instances of this class represent. */
  description?: string;
  /** Single base class of the same EC kind; must not be sealed. See [Authoring.ECClass.baseClass]($ecschema-metadata). */
  baseClass?: LocalOrFullName;
  /** Class-level custom attributes, added in order. */
  customAttributes?: ReadonlyArray<CustomAttributeProps>;
  /** Properties to create on the class, in order, as plain declarations rather than constructed
   * objects - see [Authoring.ECClass.createProperties]($ecschema-metadata). */
  properties?: ReadonlyArray<AnyPropertyDeclaration>;
}

/** Common base of every EC class kind (entity, mixin, struct, custom attribute, relationship). Owns
 * the modifier, the single base-class reference, the custom attributes, and the property collection
 * plus its `create*` factories. Property kinds are valid per-class in the spec (e.g. navigation only
 * on relationship-endpoint classes, structs not recursing) - the document does not enforce that, so
 * every factory is available on every class kind and validation reports a misuse.
 * @alpha
 */
export abstract class ECClass extends SchemaItem {
  /** Whether the class can be instantiated or subclassed.
   * @remarks
   * `None` permits both; `Abstract` prohibits direct instances; `Sealed` prohibits subclasses.
   * An absent value means [Authoring.SpecDefaults.classModifier]($ecschema-metadata), except for mixins, which are always
   * abstract. The field retains `undefined` until explicitly set. ECXML 3.1 and later require a
   * relationship modifier; the writer emits `None` when this field is absent.
   */
  public modifier?: ECClassModifier;
  /** The single base class reference (e.g. `"BisCore:PhysicalElement"`), if any.
   * The base must have the same EC class kind and must not be sealed. Entity classes can also
   * apply [Authoring.EntityClass.mixins]($ecschema-metadata). Inheritance cycles are invalid.
   * @see [Authoring.ECClass.getBaseClass]($ecschema-metadata) to resolve it, [Authoring.ECClass.setBaseClass]($ecschema-metadata) to set it from a class. */
  public baseClass?: LocalOrFullName;
  /** Custom attributes declared on this class. EC inherits base-class attributes unless a local
   * instance of the same attribute class overrides them; this collection stores only local instances. */
  public readonly customAttributes: CustomAttributeSet;

  private readonly _properties: AnyProperty[] = [];
  private readonly _propertyLookup = new NameLookup(this._properties);

  protected constructor(document: SchemaDocument, name: string, init?: ClassInit) {
    super(document, name);
    this.customAttributes = new CustomAttributeSet(this);
    if (init) {
      this.label = init.label;
      this.description = init.description;
      this.modifier = init.modifier;
      this.baseClass = init.baseClass;
      addCustomAttributes(this.customAttributes, init.customAttributes);
      for (const declaration of init.properties ?? [])
        this.createProperty(declaration);
    }
  }

  /** The base class this class derives from, resolved through the document's schema set, or
   * `undefined` when there is no base class or it does not resolve. */
  public getBaseClass(): AnyClass | undefined {
    return this.baseClass === undefined ? undefined : this.document.resolveItemOfType(this.baseClass, AbstractSchemaItemType.Class);
  }

  /** Sets [Authoring.ECClass.baseClass]($ecschema-metadata) from a class rather than a reference string, adding a schema
   * reference to that class's schema when this document has none (see
   * [Authoring.SchemaDocument.referenceTo]($ecschema-metadata)). */
  public setBaseClass(baseClass: AnyClass): void {
    this.baseClass = this.document.referenceTo(baseClass);
  }

  /** This class's own properties in declaration order. Read-only because the class owns them: a
   * property is created into a class and stays there until it is removed or moved. Use the
   * `create*` factories (or the equivalent property constructors), [Authoring.ECClass.movePropertyIn]($ecschema-metadata),
   * and [Authoring.ECClass.removeProperty]($ecschema-metadata). */
  public get properties(): ReadonlyArray<AnyProperty> {
    return this._properties;
  }

  /** Moves properties into this class, removing each from the class it currently belongs to - a
   * property belongs to exactly one. Its own references are not rewritten. */
  public movePropertyIn(...properties: Property[]): void {
    for (const property of properties) {
      if (property.declaringClass === this)
        continue;
      property.declaringClass._detachProperty(property);
      this._properties.push(property as AnyProperty);
      property[_setOwner](this);
    }
    this._propertyLookup.invalidate();
  }

  /** Returns this class's own property with the given name (case-insensitive), or `undefined`.
   * @see [Authoring.ECClass.getExpandedProperty]($ecschema-metadata) to search base classes and mixins too. */
  public getProperty(name: string): AnyProperty | undefined {
    return this._propertyLookup.get(name);
  }

  /** Removes this class's own property with the given name (case-insensitive) and returns whether
   * there was one. To keep it, move it into another class instead ([Authoring.ECClass.movePropertyIn]($ecschema-metadata)). */
  public removeProperty(name: string): boolean {
    const index = this._properties.findIndex((p) => namesEqual(p.name, name));
    if (index === -1)
      return false;
    this._properties.splice(index, 1);
    this._propertyLookup.invalidate();
    return true;
  }

  /** @internal Registers a property constructed into this class. */
  public [_attach](property: Property): void {
    this._properties.push(property as AnyProperty);
    this._propertyLookup.invalidate();
  }

  /** @internal Keeps property lookup in step with an in-place rename. */
  public [_nameChanged](property: Property, previousName: string): void {
    this._propertyLookup.rename(property as AnyProperty, previousName);
  }

  private _detachProperty(property: Property): void {
    const index = this._properties.indexOf(property as AnyProperty);
    if (index >= 0)
      this._properties.splice(index, 1);
    this._propertyLookup.invalidate();
  }

  /** Every property this class has, inherited ones included, resolved through the document's schema
   * set: the base class first (depth first, so the root base class leads), then applied mixins in
   * declaration order, then this class's own properties.
   *   * A property an ancestor declares and this class overrides appears **once**: the overriding
   * declaration, at this class's own position rather than the one the ancestor introduced it at.
   * That is what native ecobjects does, and what the column order of an ECSQL `SELECT *` reflects.
   *
   * The base class and the applied mixins are separate branches, so a name they both declare is
   * kept from the first branch that contributed it and neither declaration overrides the other.
   * Within one branch the usual override rule applies.
   *
   * This is a structural expansion by name. It does not check that an override is compatible with
   * the property it overrides, so a struct property overridden by a primitive one is returned as
   * written; the validator is what reports that. Nor does it merge anything: use
   * [Authoring.Property.getBaseProperty]($ecschema-metadata) and decide for yourself what an inherited label, category or
   * kind of quantity should be.
   *
   * Resilient by design. A base class or mixin the schema set cannot resolve contributes nothing,
   * and a base-class cycle terminates rather than hanging - so the result can be incomplete without
   * saying so. Both conditions are validation findings. */
  public getExpandedProperties(): AnyProperty[] {
    return this._expandProperties(new Map<ECClass, AnyProperty[] | undefined>());
  }

  /** The property with the given name (case-insensitive) this class has, inherited ones included,
   * or `undefined`: this class's own properties first, then the base class, then applied mixins in
   * declaration order, depth first, first match winning. That is the same property
   * [Authoring.ECClass.getExpandedProperties]($ecschema-metadata) yields for the name, found without expanding the rest.
   *
   * `undefined` means no property of that name was reachable, which includes the case where a base
   * class does not resolve. */
  public getExpandedProperty(name: string): AnyProperty | undefined {
    return this._findExpandedProperty(name, new Set<ECClass>());
  }

  private _findExpandedProperty(name: string, visitedClasses: Set<ECClass>): AnyProperty | undefined {
    if (visitedClasses.has(this))
      return undefined;
    visitedClasses.add(this);
    const own = this.getProperty(name);
    if (own !== undefined)
      return own;
    const inherited = this.getBaseClass()?._findExpandedProperty(name, visitedClasses);
    if (inherited !== undefined)
      return inherited;
    if (this.isEntity()) {
      for (const mixin of this.getMixins()) {
        const fromMixin = mixin?._findExpandedProperty(name, visitedClasses);
        if (fromMixin !== undefined)
          return fromMixin;
      }
    }
    return undefined;
  }

  /** `expanded` memoizes one list per class for the duration of a single walk, so a mixin reached
   * through several paths is expanded once. A class maps to `undefined` while its own expansion is
   * still running, which is what makes a base-class cycle terminate. */
  private _expandProperties(expanded: Map<ECClass, AnyProperty[] | undefined>): AnyProperty[] {
    if (expanded.has(this))
      return expanded.get(this) ?? [];
    expanded.set(this, undefined);

    const collected: AnyProperty[] = [];
    const seen = new Set<string>();

    // This class's own properties are collected first so their names block the inherited ones - an
    // override lands here, at this class's own position, rather than where the ancestor introduced
    // the name. A duplicate own name keeps the first declaration, which is what getProperty does.
    const ownProperties: AnyProperty[] = [];
    for (const property of this._properties) {
      const key = property.name.toLowerCase();
      if (seen.has(key))
        continue;
      seen.add(key);
      ownProperties.push(property);
    }

    // The base class and the applied mixins are separate branches of the same class, so neither
    // overrides the other: the first branch to contribute a name keeps it.
    const baseClass = this.getBaseClass();
    const branches: Array<ECClass | undefined> = this.isEntity() ? [baseClass, ...this.getMixins()] : [baseClass];
    for (const branch of branches) {
      if (branch === undefined)
        continue;
      for (const property of branch._expandProperties(expanded)) {
        const key = property.name.toLowerCase();
        if (seen.has(key))
          continue;
        seen.add(key);
        collected.push(property);
      }
    }

    for (const property of ownProperties)
      collected.push(property);

    expanded.set(this, collected);
    return collected;
  }

  /** Creates a primitive property (keyword type), appends it, and returns it. */
  public createPrimitive(name: string, type: PrimitiveType, init?: PrimitivePropertyInit): PrimitiveProperty {
    return new PrimitiveProperty(this, name, type, init);
  }

  /** Creates an enumeration-backed primitive property, appends it, and returns it. `enumeration` is
   * a reference to an `Enumeration` item. Stored the same way as a keyword primitive (one
   * `typeName` field); the separate method just keeps the reference param strongly typed. */
  public createEnumeration(name: string, enumeration: LocalOrFullName, init?: PrimitivePropertyInit): PrimitiveProperty {
    return new PrimitiveProperty(this, name, enumeration, init);
  }

  /** Creates a primitive array property (keyword element type), appends it, and returns it. */
  public createPrimitiveArray(name: string, type: PrimitiveType, init?: PrimitiveArrayPropertyInit): PrimitiveArrayProperty {
    return new PrimitiveArrayProperty(this, name, type, init);
  }

  /** Creates an enumeration-backed array property, appends it, and returns it. */
  public createEnumerationArray(name: string, enumeration: LocalOrFullName, init?: PrimitiveArrayPropertyInit): PrimitiveArrayProperty {
    return new PrimitiveArrayProperty(this, name, enumeration, init);
  }

  /** Creates a struct property, appends it, and returns it. `structClass` is a reference to a
   * `StructClass` item. */
  public createStruct(name: string, structClass: LocalOrFullName, init?: PropertyInit): StructProperty {
    return new StructProperty(this, name, structClass, init);
  }

  /** Creates a struct array property, appends it, and returns it. */
  public createStructArray(name: string, structClass: LocalOrFullName, init?: StructArrayPropertyInit): StructArrayProperty {
    return new StructArrayProperty(this, name, structClass, init);
  }

  /** Creates a navigation property, appends it, and returns it. `relationship` references the
   * `RelationshipClass` it traverses and `direction` which end it starts from (mandatory data). */
  public createNavigation(name: string, relationship: LocalOrFullName, direction: StrengthDirection, init?: PropertyInit): NavigationProperty {
    return new NavigationProperty(this, name, relationship, direction, init);
  }

  /** Creates several properties from plain declarations, in order, and returns them.
   *
   * The `create*` factories above are the imperative front door; this is the declarative one, for
   * when a class's properties are better written as data than as a sequence of statements. A
   * declaration is not a constructed property - it describes one - so nothing is owned twice and the
   * ownership rule is untouched. `kind` selects the factory; the rest of the declaration is that
   * factory's arguments.
   *
   * @example
   * ```ts
   * pump.createProperties(
   *   { kind: PropertyKind.Primitive, name: "SerialNumber", type: PrimitiveType.String },
   *   { kind: PropertyKind.Primitive, name: "FlowRate", type: PrimitiveType.Double, kindOfQuantity: "AecUnits:VOLUMETRIC_FLOW" },
   *   { kind: PropertyKind.StructArray, name: "Ports", structClass: "PortInfo", maxOccurs: 8 },
   * );
   * ```
   */
  public createProperties(...declarations: AnyPropertyDeclaration[]): AnyProperty[] {
    return declarations.map((declaration) => this.createProperty(declaration));
  }

  /** Creates one property from a plain declaration and returns it, narrowed to the kind the
   * declaration names. @see [Authoring.ECClass.createProperties]($ecschema-metadata) */
  public createProperty<D extends AnyPropertyDeclaration>(declaration: D): PropertyDeclarationTypeMap[D["kind"]] {
    const property = this._createDeclaredProperty(declaration);
    return property as PropertyDeclarationTypeMap[D["kind"]];
  }

  private _createDeclaredProperty(declaration: AnyPropertyDeclaration): AnyProperty {
    switch (declaration.kind) {
      case PropertyKind.Primitive:
        return new PrimitiveProperty(this, declaration.name, declaration.type, declaration);
      case PropertyKind.PrimitiveArray:
        return new PrimitiveArrayProperty(this, declaration.name, declaration.type, declaration);
      case PropertyKind.Struct:
        return new StructProperty(this, declaration.name, declaration.structClass, declaration);
      case PropertyKind.StructArray:
        return new StructArrayProperty(this, declaration.name, declaration.structClass, declaration);
      case PropertyKind.Navigation:
        return new NavigationProperty(this, declaration.name, declaration.relationship, declaration.direction, declaration);
    }
  }
}

/** Describes a [Authoring.PrimitiveProperty]($ecschema-metadata) to create. `type` is a primitive keyword or an enumeration
 * reference, exactly as [Authoring.ECClass.createPrimitive]($ecschema-metadata) takes it.
 * @alpha
 */
export interface PrimitivePropertyDeclaration extends PrimitivePropertyInit {
  kind: PropertyKind.Primitive;
  name: string;
  type: PrimitiveType | LocalOrFullName;
}

/** Describes a [Authoring.PrimitiveArrayProperty]($ecschema-metadata) to create.
 * @alpha
 */
export interface PrimitiveArrayPropertyDeclaration extends PrimitiveArrayPropertyInit {
  kind: PropertyKind.PrimitiveArray;
  name: string;
  type: PrimitiveType | LocalOrFullName;
}

/** Describes a [Authoring.StructProperty]($ecschema-metadata) to create.
 * @alpha
 */
export interface StructPropertyDeclaration extends PropertyInit {
  kind: PropertyKind.Struct;
  name: string;
  structClass: LocalOrFullName;
}

/** Describes a [Authoring.StructArrayProperty]($ecschema-metadata) to create.
 * @alpha
 */
export interface StructArrayPropertyDeclaration extends StructArrayPropertyInit {
  kind: PropertyKind.StructArray;
  name: string;
  structClass: LocalOrFullName;
}

/** Describes a [Authoring.NavigationProperty]($ecschema-metadata) to create.
 * @alpha
 */
export interface NavigationPropertyDeclaration extends PropertyInit {
  kind: PropertyKind.Navigation;
  name: string;
  /** Root relationship to traverse; its destination endpoint must allow at most one instance. */
  relationship: LocalOrFullName;
  /** `Forward`: source to target. `Backward`: target to source, independently of relationship strength. */
  direction: StrengthDirection;
}

/** Plain data describing one property to create, discriminated by `kind` - the same discriminant
 * [Authoring.Property.kind]($ecschema-metadata) carries, so a declaration reads like the property it produces. Accepted by
 * [Authoring.ECClass.createProperties]($ecschema-metadata) and by [Authoring.ClassInit.properties]($ecschema-metadata).
 * @alpha
 */
export type AnyPropertyDeclaration = PrimitivePropertyDeclaration | PrimitiveArrayPropertyDeclaration
  | StructPropertyDeclaration | StructArrayPropertyDeclaration | NavigationPropertyDeclaration;

/** Maps each {@link PropertyKind} discriminant to the property type a declaration of that kind
 * produces, so [Authoring.ECClass.createProperty]($ecschema-metadata) returns the concrete kind rather than the union.
 * @alpha
 */
export interface PropertyDeclarationTypeMap {
  [PropertyKind.Primitive]: PrimitiveProperty;
  [PropertyKind.PrimitiveArray]: PrimitiveArrayProperty;
  [PropertyKind.Struct]: StructProperty;
  [PropertyKind.StructArray]: StructArrayProperty;
  [PropertyKind.Navigation]: NavigationProperty;
}

/** Complementary data accepted by the [Authoring.EntityClass]($ecschema-metadata) constructor.
 * @alpha
 */
export interface EntityClassInit extends ClassInit {
  /** Applied mixins, in declaration order. This entity must satisfy each mixin's [Authoring.Mixin.appliesTo]($ecschema-metadata) constraint. */
  mixins?: LocalOrFullName[];
}

/** A class of independently identifiable objects, with properties and relationships to other instances.
 * @remarks
 * An entity has at most one entity base class and can apply multiple mixins. It inherits properties
 * from both; primary and mixin branches must not introduce conflicting property names. Properties
 * inherited from a mixin cannot be overridden.
 * @alpha
 */
export class EntityClass extends ECClass {
  public get schemaItemType(): SchemaItemType.EntityClass { return SchemaItemType.EntityClass; }
  /** Applied mixin references, in declaration order. An entity has at most one
   * [Authoring.ECClass.baseClass]($ecschema-metadata); mixins are separate. Note that, lacking validation, after XML
   * deserialization a mixin may land in `baseClass` instead (the deserializer cannot tell them
   * apart) when there is no other base class.
   * @see [Authoring.EntityClass.getMixins]($ecschema-metadata) to resolve them, [Authoring.EntityClass.addMixin]($ecschema-metadata) to add one from a mixin. */
  public readonly mixins: LocalOrFullName[] = [];

  /** Creates an entity class in `document`. `name` is the only other mandatory argument. */
  public constructor(document: SchemaDocument, name: string, init?: EntityClassInit) {
    super(document, name, init);
    if (init?.mixins)
      this.mixins.push(...init.mixins);
  }

  /** The applied mixins, resolved through the document's schema set, positionally aligned with
   * [Authoring.EntityClass.mixins]($ecschema-metadata) - an entry that does not resolve is `undefined` rather than dropped,
   * so a caller can tell which one is missing. */
  public getMixins(): Array<Mixin | undefined> {
    return this.mixins.map((mixin) => this.document.resolveItemOfType(mixin, SchemaItemType.Mixin));
  }

  /** Appends a mixin reference from the mixin itself, adding a schema reference to its schema when
   * this document has none (see [Authoring.SchemaDocument.referenceTo]($ecschema-metadata)). */
  public addMixin(...mixins: Mixin[]): void {
    for (const mixin of mixins)
      this.mixins.push(this.document.referenceTo(mixin));
  }
}

/** A reusable set of properties and a secondary classification for entity classes.
 * @remarks
 * Mixins are always abstract. They can be relationship endpoints and can derive from one other
 * mixin, but cannot override inherited properties. [Authoring.Mixin.appliesTo]($ecschema-metadata) restricts which entity
 * classes may apply the mixin; it does not make that entity class a base class of the mixin.
 *
 * ECXML represents a mixin as an entity class with `CoreCustomAttributes:IsMixin`; readers and
 * writers handle that representation. Leave [Authoring.ECClass.modifier]($ecschema-metadata) absent or set it to
 * `Abstract`. Other values are retained as authored but have no useful meaning and do not
 * round-trip consistently across EC implementations.
 * @alpha
 */
export class Mixin extends ECClass {
  public get schemaItemType(): SchemaItemType.Mixin { return SchemaItemType.Mixin; }
  /** Entity class whose instances may carry this mixin, including derived entity classes. */
  public appliesTo: LocalOrFullName;

  /** Creates a mixin in `document`. `appliesTo` is mandatory. A mixin is abstract whether or not a
   * modifier is written, so none is defaulted here - an absent modifier round-trips as absent. */
  public constructor(document: SchemaDocument, name: string, appliesTo: LocalOrFullName, init?: ClassInit) {
    super(document, name, init);
    this.appliesTo = appliesTo;
  }

  /** The entity class this mixin may be applied to, resolved through the document's schema set. */
  public getAppliesTo(): EntityClass | undefined {
    return this.document.resolveItemOfType(this.appliesTo, SchemaItemType.EntityClass);
  }

  /** Sets [Authoring.Mixin.appliesTo]($ecschema-metadata) from the entity class itself (see [Authoring.SchemaDocument.referenceTo]($ecschema-metadata)). */
  public setAppliesTo(entityClass: EntityClass): void {
    this.appliesTo = this.document.referenceTo(entityClass);
  }
}

/** An ECSQL-backed view: a class whose instances are produced by a query rather than stored.
 *
 * No persisted format has a `View` element. In both ECXML and ECJSON a view is an entity class
 * carrying the `ECDbMap:QueryView` custom attribute, which holds the query; the readers promote such
 * a class to this kind and the writers undo the promotion. That is the same treatment [Authoring.Mixin]($ecschema-metadata)
 * gets in ECXML, one step further because ECJSON has no view either.
 *
 * The [Authoring.View.query]($ecschema-metadata) is stored and round-tripped verbatim - never parsed, and never rewritten
 * when an item it names is renamed. It is ECSQL, so it is the one place this otherwise
 * database-independent model depends on ECDb.
 *
 * ECDb accepts a view only when it is `Abstract`, has no base class, has no derived classes, and
 * declares exactly the properties its query returns with matching types. Nothing here enforces
 * that - the validator reports what it can see.
 * @alpha
 */
export class View extends ECClass {
  public get schemaItemType(): AuthoringSchemaItemType.View { return AuthoringSchemaItemType.View; }
  /** The ECSQL the view's instances come from (3.2: `ECDbMap:QueryView.Query`). Opaque to this
   * model: stored, compared, and written back as given. */
  public query: string;

  /** Creates a view in `document`. `query` is mandatory. */
  public constructor(document: SchemaDocument, name: string, query: string, init?: ClassInit) {
    super(document, name, init);
    this.query = query;
  }
}

/** A structured value embedded in a struct or struct-array property.
 * @remarks
 * Struct instances have no independent identity and cannot be relationship endpoints. A struct
 * can contain primitive values, arrays, and other structs, but cannot contain itself at any depth.
 * A struct can inherit from another non-sealed struct class. Struct-valued properties use exactly
 * their declared type.
 * @alpha
 */
export class StructClass extends ECClass {
  public get schemaItemType(): SchemaItemType.StructClass { return SchemaItemType.StructClass; }

  /** Creates a struct class in `document`. `name` is the only other mandatory argument. */
  public constructor(document: SchemaDocument, name: string, init?: ClassInit) {
    super(document, name, init);
  }
}

/** Defines typed metadata that [Authoring.CustomAttribute]($ecschema-metadata) instances attach to schema containers.
 * @remarks
 * Properties define the attribute's value shape; [Authoring.CustomAttributeClass.appliesTo]($ecschema-metadata) defines
 * where it may be used. Attribute classes can contain primitive, struct, and array properties,
 * but no navigation properties. An applied instance must use a concrete class. An attribute class
 * can inherit from another non-sealed custom attribute class.
 * @alpha
 */
export class CustomAttributeClass extends ECClass {
  public get schemaItemType(): SchemaItemType.CustomAttributeClass { return SchemaItemType.CustomAttributeClass; }
  /** Allowed container kinds, combined with bitwise OR, for example
   * `CustomAttributeContainerType.EntityClass | CustomAttributeContainerType.PrimitiveProperty`.
   * Group flags such as `AnyClass` and `AnyProperty` include every kind in that group.
   * Mixins use the `EntityClass` flag. At least one container kind must be allowed. */
  public appliesTo: CustomAttributeContainerType;

  /** Creates a custom attribute class in `document`. `appliesTo` is mandatory. */
  public constructor(document: SchemaDocument, name: string, appliesTo: CustomAttributeContainerType, init?: ClassInit) {
    super(document, name, init);
    this.appliesTo = appliesTo;
  }
}

/** Complementary data accepted by [Authoring.RelationshipConstraint.set]($ecschema-metadata) and by the `source` / `target`
 * fields of [Authoring.RelationshipClassInit]($ecschema-metadata). A pure field initializer: provided scalar fields are
 * assigned and `constraintClasses` are appended; omitted fields are left untouched.
 * @alpha
 */
export interface RelationshipConstraintInit {
  /** Number of instances at this end per instance at the opposite end. See [Authoring.RelationshipConstraint.multiplicity]($ecschema-metadata). */
  multiplicity?: Multiplicity;
  /** Role when traversing from this end, e.g. `owns children`. Required unless inherited from a base relationship. */
  roleLabel?: string;
  /** Whether derived constraint classes are accepted; defaults to true when absent. */
  polymorphic?: boolean;
  /** Common base of the allowed classes; required for multiple classes unless inherited. See [Authoring.RelationshipConstraint.abstractConstraint]($ecschema-metadata). */
  abstractConstraint?: LocalOrFullName;
  /** Allowed endpoint classes; appended to any already present. At least one is required. */
  constraintClasses?: LocalOrFullName[];
  /** Constraint-level custom attributes, added in order. */
  customAttributes?: ReadonlyArray<CustomAttributeProps>;
}

/** Complementary data accepted by the [Authoring.RelationshipClass]($ecschema-metadata) constructor.
 * @alpha
 */
export interface RelationshipClassInit extends ClassInit {
  /** Ownership/lifetime semantics: independent reference, shared holding, or exclusive embedding. See [Authoring.RelationshipClass.strength]($ecschema-metadata). */
  strength?: StrengthType;
  /** Owner end for holding/embedding: `Forward` means source, `Backward` means target. Defaults to `Forward`. */
  strengthDirection?: StrengthDirection;
  /** Configures the source constraint in the same pass as the class (see [Authoring.RelationshipConstraint.set]($ecschema-metadata)). */
  source?: RelationshipConstraintInit;
  /** Configures the target constraint in the same pass as the class. */
  target?: RelationshipConstraintInit;
}

/** One end (source or target) of a relationship. Not a schema item - it is owned by its
 * [Authoring.RelationshipClass]($ecschema-metadata). A constraint is a custom attribute container, but unlike classes and
 * properties it does not inherit CAs from a base relationship's constraint.
 * @alpha
 */
export class RelationshipConstraint {
  /** Which end of the relationship this constraint describes. */
  public readonly relationshipEnd: RelationshipEnd;
  /** The relationship class this constraint is one end of. */
  public readonly relationshipClass: RelationshipClass;
  /** Number of instances at this end that may relate to one instance at the opposite end.
   * @remarks
   * `(0..1)` means optional and singular; `(1..1)` means required and singular; `*` is unbounded.
   * For `ParentOwnsChildren`, source `(0..1)` permits at most one parent per child, while target
   * `(0..*)` permits any number of children per parent. New constraints start at `(0..*)`.
   * The upper bound must be at least one or `*`, and no less than the lower bound.
   * A derived relationship may narrow this range, but cannot widen it.
   * @see [Authoring.parseMultiplicity]($ecschema-metadata) to read it as numbers. */
  public multiplicity: Multiplicity = "(0..*)";
  /** Role when traversing from this end, e.g. source `owns children`, target `is owned by parent`.
   * Include the opposite role to support translation. Required by EC 3.1 and later unless inherited
   * from a base relationship; the field stores only the local label. */
  public roleLabel?: string;
  /** Whether instances of derived constraint classes are accepted. ECObjects applies this flag to
   * both the abstract constraint and the listed classes; `false` accepts only exact class matches.
   * An absent value means [Authoring.SpecDefaults.constraintPolymorphic]($ecschema-metadata) (`true`).
   * A derived relationship can restrict `true` to `false`, but cannot widen `false` to `true`. */
  public polymorphic?: boolean;
  /** Common base that every listed constraint class must equal or derive from.
   * @remarks
   * Required when there are multiple constraint classes and no inherited abstract constraint.
   * When omitted, a single constraint class supplies the effective constraint. The name does not
   * require an `Abstract` modifier. ECObjects endpoint support checks accept this class alongside
   * the listed constraint classes, including its subclasses when [Authoring.RelationshipConstraint.polymorphic]($ecschema-metadata) is true.
   */
  public abstractConstraint?: LocalOrFullName;
  /** Classes allowed at this endpoint, extended to their subclasses when [Authoring.RelationshipConstraint.polymorphic]($ecschema-metadata) is true.
   * At least one is required. Entity classes, mixins, and relationship classes can be endpoints. */
  public readonly constraintClasses: LocalOrFullName[] = [];
  /** Constraint-level custom attributes. */
  public readonly customAttributes: CustomAttributeSet;

  /** @internal Constructed by its [Authoring.RelationshipClass]($ecschema-metadata). */
  public constructor(relationshipClass: RelationshipClass, relationshipEnd: RelationshipEnd) {
    this.relationshipClass = relationshipClass;
    this.relationshipEnd = relationshipEnd;
    this.customAttributes = new CustomAttributeSet(this);
  }

  /** The document this constraint's relationship class belongs to. */
  public get document(): SchemaDocument {
    return this.relationshipClass.document;
  }

  /** The constraint classes, resolved through the document's schema set, positionally aligned with
   * [Authoring.RelationshipConstraint.constraintClasses]($ecschema-metadata); an entry that does not resolve is `undefined`. */
  public getConstraintClasses(): Array<AnyClass | undefined> {
    return this.constraintClasses.map((c) => this.document.resolveItemOfType(c, AbstractSchemaItemType.Class));
  }

  /** Appends constraint class references from the classes themselves (see [Authoring.SchemaDocument.referenceTo]($ecschema-metadata)). */
  public addConstraintClass(...constraintClasses: AnyClass[]): void {
    for (const constraintClass of constraintClasses)
      this.constraintClasses.push(this.document.referenceTo(constraintClass));
  }

  /** The abstract constraint, resolved through the document's schema set. */
  public getAbstractConstraint(): AnyClass | undefined {
    return this.abstractConstraint === undefined ? undefined : this.document.resolveItemOfType(this.abstractConstraint, AbstractSchemaItemType.Class);
  }

  /** Sets [Authoring.RelationshipConstraint.abstractConstraint]($ecschema-metadata) from the class itself. */
  public setAbstractConstraint(constraintClass: AnyClass): void {
    this.abstractConstraint = this.document.referenceTo(constraintClass);
  }

  /** Sets the common endpoint fields (multiplicity / role label / polymorphic / abstract constraint) and
   * appends any constraint classes, in one call. Provided fields are assigned; omitted fields are left
   * untouched. Returns the constraint so calls can chain. Note `abstractConstraint` is not derived from a
   * single constraint class - it is only required when an endpoint has more than one, so the document
   * leaves it to the author. */
  public set(init: RelationshipConstraintInit): this {
    if (init.multiplicity !== undefined)
      this.multiplicity = init.multiplicity;
    if (init.roleLabel !== undefined)
      this.roleLabel = init.roleLabel;
    if (init.polymorphic !== undefined)
      this.polymorphic = init.polymorphic;
    if (init.abstractConstraint !== undefined)
      this.abstractConstraint = init.abstractConstraint;
    if (init.constraintClasses !== undefined)
      this.constraintClasses.push(...init.constraintClasses);
    addCustomAttributes(this.customAttributes, init.customAttributes);
    return this;
  }
}

/** A directed association between instances allowed by its source and target constraints.
 * @remarks
 * The constraints define allowed classes and multiplicities; [Authoring.RelationshipClass.strength]($ecschema-metadata)
 * and [Authoring.RelationshipClass.strengthDirection]($ecschema-metadata) describe ownership and lifetime. A relationship
 * can have its own properties. Even an abstract relationship needs both endpoints defined.
 * A derived relationship must keep or narrow both endpoint constraints.
 * @alpha
 */
export class RelationshipClass extends ECClass {
  public get schemaItemType(): SchemaItemType.RelationshipClass { return SchemaItemType.RelationshipClass; }
  /** Ownership and lifetime semantics for the related instances.
   * @remarks
   * - `Referencing`: the instances have independent lifetimes; no ownership is implied.
   * - `Holding`: the held instance can be shared by multiple holders and depends on at least one.
   * - `Embedding`: the embedded instance belongs to one owner and shares its lifetime.
   *
   * [Authoring.RelationshipClass.strengthDirection]($ecschema-metadata) chooses the holder/owner end. These are schema
   * semantics; the consuming application or persistence layer implements the lifetime behavior.
   * An absent value means [Authoring.SpecDefaults.relationshipStrength]($ecschema-metadata) (`Referencing`).
   */
  public strength?: StrengthType;
  /** Which endpoint holds or owns the other in a holding or embedding relationship.
   * @remarks
   * `Forward` makes the source the holder/owner; `Backward` makes the target the holder/owner.
   * For example, a backward embedding relationship has its parent at the target and its child
   * at the source. Navigation properties choose their own traversal direction independently.
   * An absent value means [Authoring.SpecDefaults.relationshipStrengthDirection]($ecschema-metadata) (`Forward`).
   */
  public strengthDirection?: StrengthDirection;
  /** The source end. */
  public readonly source = new RelationshipConstraint(this, RelationshipEnd.Source);
  /** The target end. */
  public readonly target = new RelationshipConstraint(this, RelationshipEnd.Target);

  /** Creates a relationship class in `document`. `init` carries strength / direction, the shared
   * class fields, and optional `source` / `target` configuration; any constraint end left out of
   * `init` starts empty and can be configured later via [Authoring.RelationshipConstraint.set]($ecschema-metadata). */
  public constructor(document: SchemaDocument, name: string, init?: RelationshipClassInit) {
    super(document, name, init);
    this.strength = init?.strength;
    this.strengthDirection = init?.strengthDirection;
    if (init?.source !== undefined)
      this.source.set(init.source);
    if (init?.target !== undefined)
      this.target.set(init.target);
  }
}

/** The backing primitive of an [Authoring.Enumeration]($ecschema-metadata) (XML attribute `backingTypeName`).
 * @alpha
 */
export type EnumerationBackingType = "int" | "string";

/** One value of an [Authoring.Enumeration]($ecschema-metadata). The `value` type matches the enumeration's backing type.
 * @alpha
 */
export interface Enumerator {
  /** Stable EC name, unique case-insensitively within the enumeration. */
  name: string;
  /** Stored primitive value, unique within the enumeration and matching its backing type. */
  value: number | string;
  /** Human-readable display text for this value. */
  label?: string;
  /** User-facing explanation of when this value applies. */
  description?: string;
}

/** Complementary data accepted by [Authoring.Enumeration.createEnumerator]($ecschema-metadata).
 * @alpha
 */
export interface EnumeratorInit {
  label?: string;
  description?: string;
}

/** Complementary data accepted by the [Authoring.Enumeration]($ecschema-metadata) constructor.
 * @alpha
 */
export interface EnumerationInit {
  label?: string;
  description?: string;
  /** When `false`, instances may carry values not declared here. Defaults to `true`. */
  isStrict?: boolean;
  /** The declared values, in declaration order; copied into the enumeration. */
  enumerators?: ReadonlyArray<Readonly<Enumerator>>;
}

/** A named set of integer or string values for primitive and primitive-array properties.
 * @remarks
 * Instance data stores the enumerator's value; its name identifies the declaration, and its label
 * supplies display text. [Authoring.Enumeration.isStrict]($ecschema-metadata) determines whether undeclared values are
 * permitted. Renaming or relabeling an enumerator does not change its stored value.
 * @alpha
 */
export class Enumeration extends SchemaItem {
  public get schemaItemType(): SchemaItemType.Enumeration { return SchemaItemType.Enumeration; }
  /** Backing primitive: signed 32-bit `int` or `string`. Every enumerator value must use this type. */
  public backingType: EnumerationBackingType;
  /** Whether property values must be one of the declared values. Defaults to `true`;
   * `false` also permits other values of the backing primitive type. */
  public isStrict: boolean = true;
  /** The declared values in declaration order. */
  public readonly enumerators: Enumerator[] = [];

  /** Creates an enumeration in `document`. `backingType` is mandatory; `init` carries the rest. */
  public constructor(document: SchemaDocument, name: string, backingType: EnumerationBackingType, init?: EnumerationInit) {
    super(document, name);
    this.backingType = backingType;
    if (init) {
      this.label = init.label;
      this.description = init.description;
      if (init.isStrict !== undefined)
        this.isStrict = init.isStrict;
      if (init.enumerators)
        this.enumerators.push(...init.enumerators.map((e) => ({ ...e })));
    }
  }

  /** Creates an enumerator, appends it, and returns it. `value` should match the backing type; the
   * document does not enforce that. */
  public createEnumerator(name: string, value: number | string, init?: EnumeratorInit): Enumerator {
    const enumerator: Enumerator = { name, value, label: init?.label, description: init?.description };
    this.enumerators.push(enumerator);
    return enumerator;
  }

  /** Returns the enumerator with the given name (case-insensitive), or `undefined`. */
  public getEnumerator(name: string): Enumerator | undefined {
    return this.enumerators.find((e) => namesEqual(e.name, name));
  }
}

/** Complementary data accepted by the [Authoring.KindOfQuantity]($ecschema-metadata) constructor.
 * @alpha
 */
export interface KindOfQuantityInit {
  label?: string;
  description?: string;
  /** Ordered display formats; the first is the default. See [Authoring.KindOfQuantity.presentationFormats]($ecschema-metadata) for override syntax. */
  presentationFormats?: string[];
}

/** Defines what a property measures, its storage unit, and its available display formats.
 * @remarks
 * Multiple kinds of quantity can share a phenomenon and persistence unit while serving different
 * purposes, such as short distances and geographic distances. Properties refer to this item through
 * [Authoring.Property.kindOfQuantity]($ecschema-metadata); changing the display format does not change stored values.
 * @alpha
 */
export class KindOfQuantity extends SchemaItem {
  public get schemaItemType(): SchemaItemType.KindOfQuantity { return SchemaItemType.KindOfQuantity; }
  /** Unit in which property values are stored (e.g. `"Units:M"`). Presentation units must be
   * compatible with it. Changing this field does not convert existing instance data. */
  public persistenceUnit: LocalOrFullName;
  /** Maximum acceptable relative error for unit round-trips: absolute error divided by the
   * original value's magnitude. For example, `0.001` permits one part in a thousand. Must be nonnegative;
   * this is a conversion tolerance, independent of display precision. */
  public relativeError: number;
  /** Ordered display formats; the first is the default presentation.
   * @remarks
   * An entry names a format and can override its precision and unit labels, or supply units to a
   * unitless format: `Formats:DefaultRealU(4)[Units:M|m]` displays metres with four decimal places.
   * The grammar is `Schema:Format(precision)[Schema:Unit|label]...`, with up to four units.
   * Precision and labels are optional. An omitted label uses the unit's display label; an empty
   * label (`[Units:M|]`) suppresses it. If the base format already defines units, repeat those
   * units in their original order and change only their labels, not their identities.
   *
   * Units must be compatible with [Authoring.KindOfQuantity.persistenceUnit]($ecschema-metadata). Overrides affect this
   * quantity only; they do not modify the referenced format. Serialized as `presentationUnits`.
   */
  public readonly presentationFormats: string[] = [];

  /** The unit the quantity persists in, resolved through the document's schema set. A unit
   * reference that does not resolve is a warning, not an error: units are moving out of schemas
   * into the external units framework, where the same identifier resolves elsewhere. */
  public getPersistenceUnit(): Unit | InvertedUnit | undefined {
    const item = this.document.resolveItem(this.persistenceUnit);
    return item?.schemaItemType === SchemaItemType.Unit || item?.schemaItemType === SchemaItemType.InvertedUnit ? item : undefined;
  }

  /** Sets [Authoring.KindOfQuantity.persistenceUnit]($ecschema-metadata) from the unit itself (see [Authoring.SchemaDocument.referenceTo]($ecschema-metadata)). */
  public setPersistenceUnit(unit: Unit | InvertedUnit): void {
    this.persistenceUnit = this.document.referenceTo(unit);
  }

  /** Creates a kind of quantity in `document`. `persistenceUnit` and `relativeError` are mandatory. */
  public constructor(document: SchemaDocument, name: string, persistenceUnit: LocalOrFullName, relativeError: number, init?: KindOfQuantityInit) {
    super(document, name);
    this.persistenceUnit = persistenceUnit;
    this.relativeError = relativeError;
    if (init) {
      this.label = init.label;
      this.description = init.description;
      if (init.presentationFormats)
        this.presentationFormats.push(...init.presentationFormats);
    }
  }
}

/** Complementary data accepted by the [Authoring.PropertyCategory]($ecschema-metadata) constructor.
 * @alpha
 */
export interface PropertyCategoryInit {
  /** Display name of the group. */
  label?: string;
  /** User-facing explanation of the properties in this group. */
  description?: string;
  /** Relative display order; larger values place the category earlier. Defaults to zero when absent. */
  priority?: number;
}

/** A UI grouping shared by properties, such as dimensions or operating conditions.
 * @remarks
 * Assign it through [Authoring.Property.category]($ecschema-metadata). Its priority orders categories; a property's own
 * priority orders properties within a class. Categories do not affect stored property values.
 * @alpha
 */
export class PropertyCategory extends SchemaItem {
  public get schemaItemType(): SchemaItemType.PropertyCategory { return SchemaItemType.PropertyCategory; }
  /** Relative display order; larger values place the category earlier. Defaults to zero when absent. */
  public priority?: number;

  /** Creates a property category in `document`. `name` is the only other mandatory argument. */
  public constructor(document: SchemaDocument, name: string, init?: PropertyCategoryInit) {
    super(document, name);
    if (init) {
      this.label = init.label;
      this.description = init.description;
      this.priority = init.priority;
    }
  }
}

// ===== Units / formats family =====
// Effectively frozen: the direction is for units and formats to move out of schemas into the
// external units/formats framework, with a KindOfQuantity referring to them by identifier string.
// These kinds are modeled at full fidelity so existing schemas keep round-tripping, but no new
// capabilities are expected here.

/** A unit system: a named family of units (`"SI"`, `"METRIC"`, `"USCUSTOM"`, ...) that
 * [Authoring.Unit]($ecschema-metadata)s declare membership in. Useful for choosing display units according to a convention;
 * conversion compatibility is determined by the phenomenon, not the unit system.
 * @alpha
 */
export class UnitSystem extends SchemaItem {
  public get schemaItemType(): SchemaItemType.UnitSystem { return SchemaItemType.UnitSystem; }

  /** Creates a unit system in `document`. `name` is the only other mandatory argument. */
  public constructor(document: SchemaDocument, name: string, init?: SchemaItemInit) {
    super(document, name);
    if (init) {
      this.label = init.label;
      this.description = init.description;
    }
  }
}

/** A phenomenon: the measurable quantity kind (length, area, temperature, ...) that units
 * quantify. Unit conversion requires the same phenomenon, even when different phenomena share
 * the same dimensional expression.
 * @alpha
 */
export class Phenomenon extends SchemaItem {
  public get schemaItemType(): SchemaItemType.Phenomenon { return SchemaItemType.Phenomenon; }
  /** Product of phenomena with optional integer exponents, e.g. `"LENGTH(2)"` for area or
   * `"FORCE*LENGTH(-2)"` for pressure. A base phenomenon names itself, e.g. `"LENGTH"`.
   * Use negative exponents for division; the expression has no `/` or `+` operator. */
  public definition: string;

  /** Creates a phenomenon in `document`. `definition` is mandatory; `init` carries the rest. */
  public constructor(document: SchemaDocument, name: string, definition: string, init?: SchemaItemInit) {
    super(document, name);
    this.definition = definition;
    if (init) {
      this.label = init.label;
      this.description = init.description;
    }
  }
}

/** Complementary data accepted by the [Authoring.Unit]($ecschema-metadata) constructor.
 * @alpha
 */
export interface UnitInit extends SchemaItemInit {
  /** Numerator of the conversion factor relating this unit to its definition; defaults to one. */
  numerator?: number;
  /** Nonzero denominator of the conversion factor; defaults to one. */
  denominator?: number;
  /** Additive conversion offset, used for units such as Celsius; defaults to zero. */
  offset?: number;
}

/** A unit of measure defined in terms of other units and constants.
 * @remarks
 * The definition and numeric scale/offset describe conversion within one phenomenon. For example,
 * a centimetre can use definition `"M"` and denominator `100`. Unit systems group conventions;
 * they do not restrict conversion to other units of the same phenomenon.
 *
 * Validation checks required fields and item references. It does not parse the definition's
 * expression or evaluate conversion correctness and dimensional compatibility.
 * @alpha
 */
export class Unit extends SchemaItem {
  public get schemaItemType(): SchemaItemType.Unit { return SchemaItemType.Unit; }
  /** Reference to the [Authoring.Phenomenon]($ecschema-metadata) this unit measures. */
  public phenomenon: LocalOrFullName;
  /** Reference to the [Authoring.UnitSystem]($ecschema-metadata) this unit belongs to. */
  public unitSystem: LocalOrFullName;
  /** Product of units and bracketed constants, with optional integer exponents, e.g. `"[MILLI]*M"`
   * or `"M*S(-1)"`. A base unit names itself, e.g. `"M"`. Use negative exponents for division;
   * the expression has no `/` or `+` operator. */
  public definition: string;
  /** Numerator of the factor relating this unit to its definition. `undefined` reads as `1.0`
   * and is not persisted. */
  public numerator?: number;
  /** Nonzero denominator of the factor relating this unit to its definition. An absent value means `1.0`. */
  public denominator?: number;
  /** Additive conversion offset, used for units such as Celsius. An absent value means `0.0`. */
  public offset?: number;

  /** Creates a unit in `document`. `phenomenon`, `unitSystem`, and `definition` are mandatory. */
  public constructor(document: SchemaDocument, name: string, phenomenon: LocalOrFullName, unitSystem: LocalOrFullName, definition: string, init?: UnitInit) {
    super(document, name);
    this.phenomenon = phenomenon;
    this.unitSystem = unitSystem;
    this.definition = definition;
    if (init) {
      this.label = init.label;
      this.description = init.description;
      this.numerator = init.numerator;
      this.denominator = init.denominator;
      this.offset = init.offset;
    }
  }

  /** The phenomenon this unit measures, resolved through the document's schema set. */
  public getPhenomenon(): Phenomenon | undefined {
    return this.document.resolveItemOfType(this.phenomenon, SchemaItemType.Phenomenon);
  }

  /** The unit system this unit belongs to, resolved through the document's schema set. */
  public getUnitSystem(): UnitSystem | undefined {
    return this.document.resolveItemOfType(this.unitSystem, SchemaItemType.UnitSystem);
  }
}

/** An inverted unit: the reciprocal of another unit, for quantities conventionally stated both
 * ways (e.g. a slope as horizontal-per-vertical inverting vertical-per-horizontal). It derives its
 * phenomenon and conversion from the unit it inverts and carries no definition of its own.
 * Only units with a dimensionless derivation, such as slope, may be inverted.
 * @alpha
 */
export class InvertedUnit extends SchemaItem {
  public get schemaItemType(): SchemaItemType.InvertedUnit { return SchemaItemType.InvertedUnit; }
  /** Reference to the [Authoring.Unit]($ecschema-metadata) this unit is the reciprocal of. */
  public invertsUnit: LocalOrFullName;
  /** Reference to the [Authoring.UnitSystem]($ecschema-metadata) this unit belongs to. */
  public unitSystem: LocalOrFullName;

  /** Creates an inverted unit in `document`. `invertsUnit` and `unitSystem` are mandatory. */
  public constructor(document: SchemaDocument, name: string, invertsUnit: LocalOrFullName, unitSystem: LocalOrFullName, init?: SchemaItemInit) {
    super(document, name);
    this.invertsUnit = invertsUnit;
    this.unitSystem = unitSystem;
    if (init) {
      this.label = init.label;
      this.description = init.description;
    }
  }

  /** The unit this one is the reciprocal of, resolved through the document's schema set. */
  public getInvertsUnit(): Unit | undefined {
    return this.document.resolveItemOfType(this.invertsUnit, SchemaItemType.Unit);
  }

  /** The unit system this unit belongs to, resolved through the document's schema set. */
  public getUnitSystem(): UnitSystem | undefined {
    return this.document.resolveItemOfType(this.unitSystem, SchemaItemType.UnitSystem);
  }
}

/** Complementary data accepted by the [Authoring.Constant]($ecschema-metadata) constructor.
 * @alpha
 */
export interface ConstantInit extends SchemaItemInit {
  /** Numerator scaling the defining expression; defaults to one. */
  numerator?: number;
  /** Nonzero denominator scaling the defining expression; defaults to one. */
  denominator?: number;
}

/** A constant: a fixed quantity usable in unit definitions (e.g. `PI`, or `DECA` as `10`). Like a
 * [Authoring.Unit]($ecschema-metadata) it has a phenomenon and a defining expression, but no unit system - it is not a
 * unit values are stated in.
 * @alpha
 */
export class Constant extends SchemaItem {
  public get schemaItemType(): SchemaItemType.Constant { return SchemaItemType.Constant; }
  /** Reference to the [Authoring.Phenomenon]($ecschema-metadata) this constant belongs to (e.g. a dimensionless ratio
   * like `"NUMBER"` for `PI`). */
  public phenomenon: LocalOrFullName;
  /** Defining expression using the same product/exponent grammar as [Authoring.Unit.definition]($ecschema-metadata).
   * A base constant names itself; other constants scale their definition by numerator/denominator. */
  public definition: string;
  /** Numerator of the constant's value (e.g. `3.14159...` for `PI`). `undefined` reads as `1.0`
   * and is not persisted. */
  public numerator?: number;
  /** Nonzero denominator scaling the defining expression. An absent value means `1.0`. */
  public denominator?: number;

  /** Creates a constant in `document`. `phenomenon` and `definition` are mandatory. */
  public constructor(document: SchemaDocument, name: string, phenomenon: LocalOrFullName, definition: string, init?: ConstantInit) {
    super(document, name);
    this.phenomenon = phenomenon;
    this.definition = definition;
    if (init) {
      this.label = init.label;
      this.description = init.description;
      this.numerator = init.numerator;
      this.denominator = init.denominator;
    }
  }

  /** The phenomenon this constant belongs to, resolved through the document's schema set. */
  public getPhenomenon(): Phenomenon | undefined {
    return this.document.resolveItemOfType(this.phenomenon, SchemaItemType.Phenomenon);
  }
}

/** One unit of a [Authoring.FormatComposite]($ecschema-metadata): a reference to a `Unit` or `InvertedUnit`, plus an
 * optional label overriding the unit's own when values are rendered.
 * @alpha
 */
export interface FormatCompositeUnit {
  /** Reference to the `Unit` or `InvertedUnit`. */
  name: LocalOrFullName;
  /** Display label for this segment. Omit to use the unit's label, or set `""` to suppress it.
   * Labels are rendered when [FormatTraits.ShowUnitLabel]($quantity) is enabled. */
  label?: string;
}

/** The composite specification of a [Authoring.Format]($ecschema-metadata): how a single quantity is split across up to
 * four units of descending magnitude (e.g. feet-and-inches, degrees-minutes-seconds).
 * @alpha
 */
export interface FormatComposite {
  /** Separator between the unit segments. Empty or a single character; `undefined` reads as the
   * spec default ([Authoring.SpecDefaults.compositeSpacer]($ecschema-metadata)). */
  spacer?: string;
  /** Whether zero-valued unit segments are rendered, e.g. the feet segment in `0 ft 6 in`.
   * An absent value means [Authoring.SpecDefaults.compositeIncludeZero]($ecschema-metadata) (`true`). */
  includeZero?: boolean;
  /** One to four compatible units in descending magnitude, each with an optional label override.
   * Units must measure the same phenomenon and convert between each other without an offset. */
  units: FormatCompositeUnit[];
}

/** Complementary data accepted by the [Authoring.Format]($ecschema-metadata) constructor.
 * @alpha
 */
export interface FormatInit extends SchemaItemInit {
  /** Decimal places or fractional denominator, according to the format type. See [Authoring.Format.precision]($ecschema-metadata). */
  precision?: DecimalPrecision | FractionalPrecision;
  /** Rounding increment, active with `ApplyRounding`; zero means round to precision. */
  roundFactor?: number;
  /** Minimum formatted width, padded with leading zeros. */
  minWidth?: number;
  /** Sign rendering; defaults to `OnlyNegative`. */
  showSignOption?: ShowSignOption;
  /** Rendering options combined with bitwise OR. See [Authoring.Format.formatTraits]($ecschema-metadata). */
  formatTraits?: FormatTraits;
  /** Decimal separator; defaults to `"."`. */
  decimalSeparator?: string;
  /** Thousands separator, used with `Use1000Separator`; defaults to `","`. */
  thousandSeparator?: string;
  /** Separator between a value and its unit label; defaults to a space. */
  uomSeparator?: string;
  /** Required for scientific formats: `Normalized` or `ZeroNormalized`. */
  scientificType?: ScientificType;
  /** Digits in the station offset; required for station formats. See [Authoring.Format.stationOffsetSize]($ecschema-metadata). */
  stationOffsetSize?: number;
  /** Separator before the station offset; defaults to `"+"`. */
  stationSeparator?: string;
  /** One to four compatible units in descending size, copied into an owned [Authoring.Format.composite]($ecschema-metadata) object. */
  composite?: Readonly<FormatComposite>;
}

/** Controls numeric display: precision, separators, signs, and optional composite units.
 * @remarks
 * A [Authoring.KindOfQuantity]($ecschema-metadata) selects formats and can override precision or unit labels, or add
 * units to a unitless format. See [Authoring.KindOfQuantity.presentationFormats]($ecschema-metadata) for the syntax.
 * Optional fields retain `undefined` when unset; the documented defaults describe their meaning.
 * EC 3.2 supports decimal, fractional, scientific, and station formats. Other [FormatType]($quantity)
 * members belong to the quantity formatting library and are invalid on a schema format.
 * Validation does not evaluate unit conversions or prove compatibility with a kind of quantity.
 * @alpha
 */
export class Format extends SchemaItem {
  public get schemaItemType(): SchemaItemType.Format { return SchemaItemType.Format; }
  /** The numeric rendering kind (decimal, fractional, scientific, station). */
  public type: FormatType;
  /** Decimal places (`0`–`12`) for decimal, scientific, and station formats; fractional denominator
   * (`1`, `2`, `4`, ..., `256`) for fractional formats. For example, fractional precision `8`
   * rounds to eighths. Set explicitly when the intended display precision matters. */
  public precision?: DecimalPrecision | FractionalPrecision;
  /** Rounding factor applied when the [FormatTraits.ApplyRounding]($quantity) trait is set; `0` rounds
   * to precision. `undefined` reads as the spec default ([Authoring.SpecDefaults.formatRoundFactor]($ecschema-metadata)). */
  public roundFactor?: number;
  /** Minimum formatted width, padded with leading zeros; `undefined` adds no padding.
   * Applies to each component of a composite, counts separators, and never reduces precision. */
  public minWidth?: number;
  /** How the sign is rendered: `NoSign`, `OnlyNegative`, `SignAlways`, or `NegativeParentheses`
   * (e.g. `(10)` for minus ten). An absent value means [Authoring.SpecDefaults.formatShowSignOption]($ecschema-metadata). */
  public showSignOption?: ShowSignOption;
  /** Rendering options combined with bitwise OR, such as
   * `FormatTraits.ShowUnitLabel | FormatTraits.KeepSingleZero`.
   * @remarks
   * `ShowUnitLabel` enables unit labels; add `PrependUnitLabel` to put them before the value.
   * `Use1000Separator` enables digit grouping and `ApplyRounding` enables [Authoring.Format.roundFactor]($ecschema-metadata).
   * `TrailZeroes` retains decimal places up to the precision. An absent value means no traits,
   * the same as [FormatTraits.Uninitialized]($quantity) (`0`).
   */
  public formatTraits?: FormatTraits;
  /** Separator between the integer and fractional digits. Empty or a single character;
   * `undefined` reads as the spec default ([Authoring.SpecDefaults.formatDecimalSeparator]($ecschema-metadata)). */
  public decimalSeparator?: string;
  /** Separator grouping the integer digits by thousands, rendered only with the
   * [FormatTraits.Use1000Separator]($quantity) trait. Empty or a single character; `undefined` reads as
   * the spec default ([Authoring.SpecDefaults.formatThousandSeparator]($ecschema-metadata)). */
  public thousandSeparator?: string;
  /** Separator between the value and the unit label. Empty or a single character; `undefined`
   * reads as the spec default ([Authoring.SpecDefaults.formatUomSeparator]($ecschema-metadata)). */
  public uomSeparator?: string;
  /** Required for scientific formats. `Normalized` uses a mantissa such as `1.234e+3`;
   * `ZeroNormalized` uses `0.1234e+4` for the same value. */
  public scientificType?: ScientificType;
  /** Number of integer digits in the station offset. Required and positive for station formats:
   * with size `2`, a value of `1234.5` is displayed as `12+34.5` before precision and padding rules. */
  public stationOffsetSize?: number;
  /** Separator between the station and offset digits (`"3+25"`). Empty or a single character;
   * `undefined` reads as the spec default ([Authoring.SpecDefaults.formatStationSeparator]($ecschema-metadata)). */
  public stationSeparator?: string;
  /** Units used to display the quantity, such as feet and inches. The smallest unit receives the
   * format's numeric precision; larger units display whole numbers. Without a composite, the
   * format supplies numeric rendering only and the kind of quantity can supply display units. */
  public composite?: FormatComposite;

  /** Creates a format in `document`. `type` is mandatory; `init` carries the rest. */
  public constructor(document: SchemaDocument, name: string, type: FormatType, init?: FormatInit) {
    super(document, name);
    this.type = type;
    if (init) {
      this.label = init.label;
      this.description = init.description;
      this.precision = init.precision;
      this.roundFactor = init.roundFactor;
      this.minWidth = init.minWidth;
      this.showSignOption = init.showSignOption;
      this.formatTraits = init.formatTraits;
      this.decimalSeparator = init.decimalSeparator;
      this.thousandSeparator = init.thousandSeparator;
      this.uomSeparator = init.uomSeparator;
      this.scientificType = init.scientificType;
      this.stationOffsetSize = init.stationOffsetSize;
      this.stationSeparator = init.stationSeparator;
      if (init.composite) {
        this.composite = {
          spacer: init.composite.spacer,
          includeZero: init.composite.includeZero,
          units: init.composite.units.map((u) => ({ name: u.name, label: u.label })),
        };
      }
    }
  }

  /** True when the given trait is set in [Authoring.Format.formatTraits]($ecschema-metadata). */
  public hasFormatTrait(trait: FormatTraits): boolean {
    return this.formatTraits !== undefined && (this.formatTraits & trait) === trait;
  }

  /** The composite's units, resolved through the document's schema set, positionally aligned with
   * `composite.units`; an entry that does not resolve is `undefined`. Empty when there is no
   * composite. */
  public getCompositeUnits(): Array<Unit | InvertedUnit | undefined> {
    return (this.composite?.units ?? []).map((unit) => {
      const item = this.document.resolveItem(unit.name);
      return item?.schemaItemType === SchemaItemType.Unit || item?.schemaItemType === SchemaItemType.InvertedUnit ? item : undefined;
    });
  }
}

// ===== End of units / formats family =====

/** Complementary data shared by every property kind's constructor.
 * @alpha
 */
export interface PropertyInit {
  /** Human-readable display name; consumers fall back to the property name when absent. */
  label?: string;
  /** User-facing explanation of what the property measures or records. */
  description?: string;
  /** Whether instance values may only be initialized, then remain unchanged. Does not restrict schema edits. */
  isReadOnly?: boolean;
  /** Relative importance for display ordering within a class; larger values indicate higher priority. */
  priority?: number;
  /** UI grouping for this property; see [Authoring.Property.category]($ecschema-metadata). */
  category?: LocalOrFullName;
  /** Quantity semantics, storage unit, and display formats for a primitive or primitive-array property.
   * See [Authoring.Property.kindOfQuantity]($ecschema-metadata) for override and schema-update restrictions. */
  kindOfQuantity?: LocalOrFullName;
  /** Property-level custom attributes, added in order. */
  customAttributes?: ReadonlyArray<CustomAttributeProps>;
}

/** Common base of every property kind. `kind` is the discriminant for narrowing.
 *
 * @remarks
 * A property belongs to its declaring [Authoring.ECClass]($ecschema-metadata). A declaration with the same name as an
 * inherited property overrides it and must preserve its property kind, value type, and persistence
 * unit. Labels, descriptions, categories, and priorities can be specialized in derived classes.
 * This object stores only the local declaration; use [Authoring.Property.getBaseProperty]($ecschema-metadata) to inspect
 * inherited metadata.
 * @alpha
 */
export abstract class Property {
  /** Discriminates the property kind. A getter rather than a field, for the same reason as
   * [Authoring.SchemaItem.schemaItemType]($ecschema-metadata): the property is registered with its class from this
   * constructor, before a subclass field initializer would have run. */
  public abstract get kind(): PropertyKind;
  /** Human-readable display name; consumers fall back to the property name when absent. */
  public label?: string;
  /** User-facing explanation of what the property measures or records. */
  public description?: string;
  /** Whether instance values may only be initialized, then remain unchanged. Does not restrict edits
   * to this property definition. An absent value leaves the read-only setting unspecified. */
  public isReadOnly?: boolean;
  /** Relative importance for display ordering within a class; larger values indicate higher priority. */
  public priority?: number;
  /** Reference to the UI grouping for this property (e.g. `"MyDomain:Dimensions"`).
   * The category groups properties; [Authoring.Property.priority]($ecschema-metadata) orders properties within the class.
   * @see [Authoring.Property.getCategory]($ecschema-metadata), [Authoring.Property.setCategory]($ecschema-metadata). */
  public category?: LocalOrFullName;
  /** Quantity semantics, storage unit, and display formats for a primitive or primitive-array property.
   * @remarks
   * Values are stored in the kind of quantity's persistence unit. A property override must preserve
   * that unit. For schema updates, replacing the kind of quantity with another using the same unit
   * is compatible; changing or removing the unit requires an explicit upgrade decision.
   * `SchemaUpgradeCustomAttributes:AllowUnitChange` permits such a metadata correction on import,
   * with matching `From` and `To` units. It does not convert stored values. To change only the
   * display, choose another presentation format.
   * @see [Authoring.Property.getKindOfQuantity]($ecschema-metadata), [Authoring.Property.setKindOfQuantity]($ecschema-metadata). */
  public kindOfQuantity?: LocalOrFullName;
  /** Custom attributes declared on this property. EC inherits base-property attributes unless a
   * local instance of the same attribute class overrides them; this collection stores only local instances. */
  public readonly customAttributes: CustomAttributeSet;

  private _name: string;
  private _declaringClass: ECClass;

  protected constructor(declaringClass: ECClass, name: string, init?: PropertyInit) {
    this._declaringClass = declaringClass;
    this._name = name;
    this.customAttributes = new CustomAttributeSet(this);
    declaringClass[_attach](this);
    if (init) {
      this.label = init.label;
      this.description = init.description;
      this.isReadOnly = init.isReadOnly;
      this.priority = init.priority;
      this.category = init.category;
      this.kindOfQuantity = init.kindOfQuantity;
      addCustomAttributes(this.customAttributes, init.customAttributes);
    }
  }

  /** The property's [ECName]($ecschema-metadata), unique case-insensitively among its class's own declarations.
   * A declaration with an inherited property's name is an override. Renaming preserves object identity and
   * declaration order and updates name lookup; references and derived overrides are not rewritten. */
  public get name(): string {
    return this._name;
  }

  public set name(name: string) {
    if (name === this._name)
      return;
    const previousName = this._name;
    this._name = name;
    this._declaringClass[_nameChanged](this, previousName);
  }

  /** The class this property belongs to. Changed only by [Authoring.ECClass.movePropertyIn]($ecschema-metadata). */
  public get declaringClass(): ECClass {
    return this._declaringClass;
  }

  /** @internal */
  public [_setOwner](declaringClass: ECClass): void {
    this._declaringClass = declaringClass;
  }

  /** The document this property's class belongs to - the scope its references resolve in. */
  public get document(): SchemaDocument {
    return this._declaringClass.document;
  }

  /** `"SchemaName:ClassName.PropertyName"`. */
  public get fullName(): string {
    return `${this._declaringClass.fullName}.${this.name}`;
  }

  /** The property of the same name this one overrides - searching the declaring class's base class
   * first, then its mixins in declaration order, depth first, first match winning - or `undefined`
   * when there is none. Chain it to reach the declaration that introduced the name.
   *
   * Resolved on every call and never stored, so re-parenting a class or swapping a schema in the
   * set takes effect immediately. `undefined` also covers a base class the schema set cannot
   * resolve; the validator is what reports that. Whether the override is a legal one is not checked
   * here either. */
  public getBaseProperty(): AnyProperty | undefined {
    const declaringClass = this._declaringClass;
    const fromBase = declaringClass.getBaseClass()?.getExpandedProperty(this.name);
    if (fromBase !== undefined)
      return fromBase;
    if (declaringClass.isEntity()) {
      for (const mixin of declaringClass.getMixins()) {
        const fromMixin = mixin?.getExpandedProperty(this.name);
        if (fromMixin !== undefined)
          return fromMixin;
      }
    }
    return undefined;
  }

  /** The property category, resolved through the document's schema set. */
  public getCategory(): PropertyCategory | undefined {
    return this.category === undefined ? undefined : this.document.resolveItemOfType(this.category, SchemaItemType.PropertyCategory);
  }

  /** Sets [Authoring.Property.category]($ecschema-metadata) from the category itself (see [Authoring.SchemaDocument.referenceTo]($ecschema-metadata)). */
  public setCategory(category: PropertyCategory): void {
    this.category = this.document.referenceTo(category);
  }

  /** The kind of quantity, resolved through the document's schema set. */
  public getKindOfQuantity(): KindOfQuantity | undefined {
    return this.kindOfQuantity === undefined ? undefined : this.document.resolveItemOfType(this.kindOfQuantity, SchemaItemType.KindOfQuantity);
  }

  /** Sets [Authoring.Property.kindOfQuantity]($ecschema-metadata) from the kind of quantity itself (see [Authoring.SchemaDocument.referenceTo]($ecschema-metadata)). */
  public setKindOfQuantity(kindOfQuantity: KindOfQuantity): void {
    this.kindOfQuantity = this.document.referenceTo(kindOfQuantity);
  }

  /** Narrows to the primitive kinds ([Authoring.PrimitiveProperty]($ecschema-metadata), [Authoring.PrimitiveArrayProperty]($ecschema-metadata)).
   * Includes primitive arrays, matching the same check on `SchemaView`. */
  public isPrimitive(): this is AnyPrimitiveProperty {
    return this.kind === PropertyKind.Primitive || this.kind === PropertyKind.PrimitiveArray;
  }

  /** Narrows to the struct kinds ([Authoring.StructProperty]($ecschema-metadata), [Authoring.StructArrayProperty]($ecschema-metadata)). */
  public isStruct(): this is AnyStructProperty {
    return this.kind === PropertyKind.Struct || this.kind === PropertyKind.StructArray;
  }

  /** Narrows to the array kinds ([Authoring.PrimitiveArrayProperty]($ecschema-metadata), [Authoring.StructArrayProperty]($ecschema-metadata)). */
  public isArray(): this is AnyArrayProperty {
    return this.kind === PropertyKind.PrimitiveArray || this.kind === PropertyKind.StructArray;
  }

  /** Narrows to [Authoring.NavigationProperty]($ecschema-metadata). */
  public isNavigation(): this is NavigationProperty {
    return this.kind === PropertyKind.Navigation;
  }

  /** True when this property is backed by an enumeration rather than a primitive keyword: an
   * enum-backed property is a primitive property whose `typeName` is an enumeration reference.
   * The check is lexical (the primitive keywords are a closed set); the reference itself resolves
   * through the schema set. */
  public isEnumeration(): this is AnyPrimitiveProperty {
    return this.isPrimitive() && parsePrimitiveType(this.typeName) === undefined;
  }

  /** @see isPrimitive */
  public assertPrimitive(): asserts this is AnyPrimitiveProperty {
    if (!this.isPrimitive())
      throw new Error(`Expected a primitive property, got ${PropertyKind[this.kind]} for "${this.name}"`);
  }

  /** @see isStruct */
  public assertStruct(): asserts this is AnyStructProperty {
    if (!this.isStruct())
      throw new Error(`Expected a struct property, got ${PropertyKind[this.kind]} for "${this.name}"`);
  }

  /** @see isArray */
  public assertArray(): asserts this is AnyArrayProperty {
    if (!this.isArray())
      throw new Error(`Expected an array property, got ${PropertyKind[this.kind]} for "${this.name}"`);
  }

  /** @see isNavigation */
  public assertNavigation(): asserts this is NavigationProperty {
    if (!this.isNavigation())
      throw new Error(`Expected a navigation property, got ${PropertyKind[this.kind]} for "${this.name}"`);
  }
}

/** Complementary data accepted by the [Authoring.PrimitiveProperty]($ecschema-metadata) constructor.
 * @alpha
 */
export interface PrimitivePropertyInit extends PropertyInit {
  /** Application-specific interpretation of the primitive value; does not change storage. See [Authoring.PrimitiveProperty.extendedTypeName]($ecschema-metadata). */
  extendedTypeName?: string;
  /** Minimum value (int / long / double only). */
  minValue?: number;
  /** Maximum value (int / long / double only). */
  maxValue?: number;
  /** Minimum length (string / binary only). */
  minLength?: number;
  /** Maximum length (string / binary only). */
  maxLength?: number;
}

/** A primitive (or enumeration-backed) property. `typeName` is a primitive keyword or an
 * enumeration reference; the distinction is lexical, and the reference resolves through the schema set.
 * @alpha
 */
export class PrimitiveProperty extends Property {
  public get kind(): PropertyKind.Primitive { return PropertyKind.Primitive; }
  /** Primitive keyword (e.g. `"string"`, `"int"`) or an enumeration reference.
   *  For enumerations this can be set to their name or full-name (e.g. `"MySchema.MyEnum"` or `"alias.MyEnum"`). */
  public typeName: string;
  /** Application-specific interpretation of the primitive value. Storage remains the base primitive
   * type; consumers without an extended-type handler can still read the underlying value. */
  public extendedTypeName?: string;
  /** Minimum value (int / long / double only). */
  public minValue?: number;
  /** Maximum value (int / long / double only). */
  public maxValue?: number;
  /** Minimum length (string / binary only). */
  public minLength?: number;
  /** Maximum length (string / binary only). */
  public maxLength?: number;

  /** Creates a primitive property on `declaringClass`. `type` may be a `PrimitiveType` or an
   * enumeration reference (e.g. `"MySchema.MyEnum"` or `"alias.MyEnum"`). */
  public constructor(declaringClass: ECClass, name: string, type: PrimitiveType | string, init?: PrimitivePropertyInit) {
    super(declaringClass, name, init);
    this.typeName = typeof type === "string" ? type : primitiveTypeToString(type);
    if (init) {
      this.extendedTypeName = init.extendedTypeName;
      this.minValue = init.minValue;
      this.maxValue = init.maxValue;
      this.minLength = init.minLength;
      this.maxLength = init.maxLength;
    }
  }

  /** The enumeration backing this property, resolved through the document's schema set, or
   * `undefined` when the property is a plain primitive or the reference does not resolve. */
  public getEnumeration(): Enumeration | undefined {
    return this.isEnumeration() ? this.document.resolveItemOfType(this.typeName, SchemaItemType.Enumeration) : undefined;
  }

  /** Points [Authoring.PrimitiveProperty.typeName]($ecschema-metadata) at the enumeration itself (see [Authoring.SchemaDocument.referenceTo]($ecschema-metadata)). */
  public setEnumeration(enumeration: Enumeration): void {
    this.typeName = this.document.referenceTo(enumeration);
  }
}

/** Complementary data accepted by the [Authoring.PrimitiveArrayProperty]($ecschema-metadata) constructor.
 * @alpha
 */
export interface PrimitiveArrayPropertyInit extends PropertyInit {
  /** Application-specific interpretation of each element; does not change storage. See [Authoring.PrimitiveProperty.extendedTypeName]($ecschema-metadata). */
  extendedTypeName?: string;
  /** Minimum element value (int / long / double only). */
  minValue?: number;
  /** Maximum element value (int / long / double only). */
  maxValue?: number;
  /** Minimum element length (string / binary only). */
  minLength?: number;
  /** Maximum element length (string / binary only). */
  maxLength?: number;
  /** Minimum number of elements (default 0). */
  minOccurs?: number;
  /** Maximum number of elements; omit for unbounded. */
  maxOccurs?: number;
}

/** An ordered array of values sharing one primitive type or enumeration.
 * @remarks
 * Value and length bounds apply to each element. [Authoring.PrimitiveArrayProperty.minOccurs]($ecschema-metadata) and
 * [Authoring.PrimitiveArrayProperty.maxOccurs]($ecschema-metadata) constrain the number of elements in the array.
 * @alpha
 */
export class PrimitiveArrayProperty extends Property {
  public get kind(): PropertyKind.PrimitiveArray { return PropertyKind.PrimitiveArray; }
  /** Primitive keyword or enumeration reference of the array element. */
  public typeName: string;
  /** Application-specific interpretation of each element; storage remains the base primitive type.
   * See [Authoring.PrimitiveProperty.extendedTypeName]($ecschema-metadata). */
  public extendedTypeName?: string;
  /** Minimum element value (int / long / double only). */
  public minValue?: number;
  /** Maximum element value (int / long / double only). */
  public maxValue?: number;
  /** Minimum element length (string / binary only). */
  public minLength?: number;
  /** Maximum element length (string / binary only). */
  public maxLength?: number;
  /** Minimum number of elements (default 0). */
  public minOccurs: number = 0;
  /** Maximum number of elements; `undefined` means unbounded. The readers normalize the wire
   * spellings of unbounded (ECXML `maxOccurs="unbounded"`, ECJSON `2147483647`) to `undefined`,
   * and the writers omit the field. */
  public maxOccurs?: number;

  /** Creates a primitive array property on `declaringClass`. `type` may be a `PrimitiveType` or an
   * enumeration reference. */
  public constructor(declaringClass: ECClass, name: string, type: PrimitiveType | string, init?: PrimitiveArrayPropertyInit) {
    super(declaringClass, name, init);
    this.typeName = typeof type === "string" ? type : primitiveTypeToString(type);
    if (init) {
      this.extendedTypeName = init.extendedTypeName;
      this.minValue = init.minValue;
      this.maxValue = init.maxValue;
      this.minLength = init.minLength;
      this.maxLength = init.maxLength;
      if (init.minOccurs !== undefined)
        this.minOccurs = init.minOccurs;
      this.maxOccurs = init.maxOccurs;
    }
  }

  /** The enumeration backing this property's elements, resolved through the document's schema set. */
  public getEnumeration(): Enumeration | undefined {
    return this.isEnumeration() ? this.document.resolveItemOfType(this.typeName, SchemaItemType.Enumeration) : undefined;
  }

  /** Points [Authoring.PrimitiveArrayProperty.typeName]($ecschema-metadata) at the enumeration itself. */
  public setEnumeration(enumeration: Enumeration): void {
    this.typeName = this.document.referenceTo(enumeration);
  }
}

/** An embedded structured value with no independent identity.
 * @remarks
 * The value has exactly the declared struct type; polymorphic values are not supported.
 * Use a navigation property to reference an independently identifiable instance.
 * @alpha
 */
export class StructProperty extends Property {
  public get kind(): PropertyKind.Struct { return PropertyKind.Struct; }
  /** Reference to the `StructClass` this property embeds. */
  public typeName: LocalOrFullName;

  /** Creates a struct property on `declaringClass`. `structClass` is mandatory. */
  public constructor(declaringClass: ECClass, name: string, structClass: LocalOrFullName, init?: PropertyInit) {
    super(declaringClass, name, init);
    this.typeName = structClass;
  }

  /** The struct class this property embeds, resolved through the document's schema set. */
  public getStructClass(): StructClass | undefined {
    return this.document.resolveItemOfType(this.typeName, SchemaItemType.StructClass);
  }

  /** Points [Authoring.StructProperty.typeName]($ecschema-metadata) at the struct class itself (see [Authoring.SchemaDocument.referenceTo]($ecschema-metadata)). */
  public setStructClass(structClass: StructClass): void {
    this.typeName = this.document.referenceTo(structClass);
  }
}

/** Complementary data accepted by the [Authoring.StructArrayProperty]($ecschema-metadata) constructor.
 * @alpha
 */
export interface StructArrayPropertyInit extends PropertyInit {
  /** Minimum number of elements (default 0). */
  minOccurs?: number;
  /** Maximum number of elements; omit for unbounded. */
  maxOccurs?: number;
}

/** An ordered array of embedded structured values, all of the declared struct type.
 * @remarks
 * Elements have no independent identity and cannot use derived struct types. Occurrence bounds
 * constrain the array length; nested struct properties must not form a containment cycle.
 * @alpha
 */
export class StructArrayProperty extends Property {
  public get kind(): PropertyKind.StructArray { return PropertyKind.StructArray; }
  /** Reference to the `StructClass` of the array element. */
  public typeName: LocalOrFullName;
  /** Minimum number of elements (default 0). */
  public minOccurs: number = 0;
  /** Maximum number of elements; `undefined` means unbounded. See [Authoring.PrimitiveArrayProperty.maxOccurs]($ecschema-metadata). */
  public maxOccurs?: number;

  /** Creates a struct array property on `declaringClass`. `structClass` is mandatory. */
  public constructor(declaringClass: ECClass, name: string, structClass: LocalOrFullName, init?: StructArrayPropertyInit) {
    super(declaringClass, name, init);
    this.typeName = structClass;
    if (init) {
      if (init.minOccurs !== undefined)
        this.minOccurs = init.minOccurs;
      this.maxOccurs = init.maxOccurs;
    }
  }

  /** The struct class of the array elements, resolved through the document's schema set. */
  public getStructClass(): StructClass | undefined {
    return this.document.resolveItemOfType(this.typeName, SchemaItemType.StructClass);
  }

  /** Points [Authoring.StructArrayProperty.typeName]($ecschema-metadata) at the struct class itself. */
  public setStructClass(structClass: StructClass): void {
    this.typeName = this.document.referenceTo(structClass);
  }
}

/** A reference to at most one related instance, reached through a relationship.
 * @remarks
 * Declare it on an entity, mixin, or relationship class supported by the starting endpoint. The
 * destination endpoint must have an upper multiplicity of one. Reference the root relationship
 * in its hierarchy; an override cannot substitute a different relationship.
 *
 * For a parent-to-child relationship, a child's `Parent` property traverses `Backward` to the
 * source endpoint. Its source multiplicity must be `(0..1)` or `(1..1)`.
 * @alpha
 */
export class NavigationProperty extends Property {
  public get kind(): PropertyKind.Navigation { return PropertyKind.Navigation; }
  /** Reference to the root [Authoring.RelationshipClass]($ecschema-metadata) this property traverses. */
  public relationshipName: LocalOrFullName;
  /** `Forward` navigates from source to target; `Backward` navigates from target to source.
   * This is independent of the relationship's [Authoring.RelationshipClass.strengthDirection]($ecschema-metadata). */
  public direction: StrengthDirection;

  /** Creates a navigation property on `declaringClass`. `relationship` and `direction` are mandatory. */
  public constructor(declaringClass: ECClass, name: string, relationship: LocalOrFullName, direction: StrengthDirection, init?: PropertyInit) {
    super(declaringClass, name, init);
    this.relationshipName = relationship;
    this.direction = direction;
  }

  /** The relationship class this property traverses, resolved through the document's schema set. */
  public getRelationshipClass(): RelationshipClass | undefined {
    return this.document.resolveItemOfType(this.relationshipName, SchemaItemType.RelationshipClass);
  }

  /** Points [Authoring.NavigationProperty.relationshipName]($ecschema-metadata) at the relationship class itself. */
  public setRelationshipClass(relationshipClass: RelationshipClass): void {
    this.relationshipName = this.document.referenceTo(relationshipClass);
  }
}

/** Union of every property kind.
 * @alpha
 */
export type AnyProperty = PrimitiveProperty | PrimitiveArrayProperty | StructProperty | StructArrayProperty | NavigationProperty;

/** The primitive (or enumeration-backed) property kinds: scalar or array.
 * @alpha
 */
export type AnyPrimitiveProperty = PrimitiveProperty | PrimitiveArrayProperty;

/** The struct property kinds: scalar or array of an embedded struct.
 * @alpha
 */
export type AnyStructProperty = StructProperty | StructArrayProperty;

/** The array property kinds.
 * @alpha
 */
export type AnyArrayProperty = PrimitiveArrayProperty | StructArrayProperty;

/** Union of every EC class kind.
 * @alpha
 */
export type AnyClass = EntityClass | Mixin | View | StructClass | CustomAttributeClass | RelationshipClass;

/** Union of every schema item kind.
 * @alpha
 */
export type AnySchemaItem = AnyClass | Enumeration | KindOfQuantity | PropertyCategory
  | UnitSystem | Phenomenon | Unit | InvertedUnit | Constant | Format;

/** Maps each {@link SchemaItemType} discriminant to its concrete item type, plus the
 * {@link AbstractSchemaItemType} groupings to their union types, so the typed accessors
 * ([Authoring.SchemaDocument.getItemOfType]($ecschema-metadata), [Authoring.SchemaDocument.getItemsOfType]($ecschema-metadata)) can narrow either by
 * a single kind or by a grouping (e.g. `Class` for any class kind).
 * @alpha
 */
export interface SchemaItemTypeMap {
  [SchemaItemType.EntityClass]: EntityClass;
  [SchemaItemType.Mixin]: Mixin;
  [AuthoringSchemaItemType.View]: View;
  [SchemaItemType.StructClass]: StructClass;
  [SchemaItemType.CustomAttributeClass]: CustomAttributeClass;
  [SchemaItemType.RelationshipClass]: RelationshipClass;
  [SchemaItemType.Enumeration]: Enumeration;
  [SchemaItemType.KindOfQuantity]: KindOfQuantity;
  [SchemaItemType.PropertyCategory]: PropertyCategory;
  [SchemaItemType.UnitSystem]: UnitSystem;
  [SchemaItemType.Phenomenon]: Phenomenon;
  [SchemaItemType.Unit]: Unit;
  [SchemaItemType.InvertedUnit]: InvertedUnit;
  [SchemaItemType.Constant]: Constant;
  [SchemaItemType.Format]: Format;
  [AbstractSchemaItemType.Class]: AnyClass;
  [AbstractSchemaItemType.SchemaItem]: AnySchemaItem;
}
