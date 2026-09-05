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
 * is the union of both ({@link ItemKind}).
 * @alpha
 */
export enum AuthoringSchemaItemType {
  /** An ECSQL-backed view. No format has a `View` element: it is an entity class carrying the
   * `ECDbMap:QueryView` custom attribute, which the readers promote and the writers undo.
   * @see {@link View} */
  // eslint-disable-next-line @typescript-eslint/no-shadow -- deliberately named for the View class, as every SchemaItemType member is
  View = "View",
}

/** The discriminant carried by {@link SchemaItem.schemaItemType}.
 * @alpha
 */
export type ItemKind = SchemaItemType | AuthoringSchemaItemType;

/** Whether `kind` satisfies `supported`, which may be a concrete kind or an
 * {@link AbstractSchemaItemType} grouping. Extends {@link isSupportedSchemaItemType} over the
 * authoring-only kinds: a {@link View} is a class, so it answers to the `Class` grouping.
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

/** A collection of {@link SchemaDocument}s that know about each other: the scope every item
 * reference in those documents resolves against, and the authority over their lifetime.
 *
 * A set holds at most **one document per schema name**, compared case-insensitively - `BisCore
 * 1.0.0` and `BisCore 1.0.15` cannot both be in one set. Nothing appears in a set unless someone
 * put it there. There is no locater, no on-demand loading, and no priority chain; use
 * {@link SchemaResolver} to work out *which* schemas a document needs and to load them in.
 *
 * **Every document belongs to exactly one set, always.** That is what keeps a schema graph clean,
 * and it is the one rule to internalize:
 *
 * - `new SchemaDocument(...)` produces a document in a private set of its own, containing only it.
 * - {@link SchemaSet.createSchema} constructs a document directly into this set.
 * - {@link SchemaSet.moveIn} takes a document **out of** the set it is in and puts it here. There
 *   is deliberately no `add` - a document cannot be in two sets, so joining one always means
 *   leaving another.
 * - {@link SchemaSet.moveOut} hands a document back in a fresh private set of its own, so it is
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

  /** Creates a set, optionally moving documents in straight away (see {@link SchemaSet.moveIn}). */
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

  /** Constructs a document and holds it here. Same arguments as the {@link SchemaDocument}
   * constructor. Throws if the set already holds a schema of that name. */
  public createSchema(name: string, alias: string, readVersion: number, writeVersion: number, minorVersion: number, init?: SchemaDocumentInit): SchemaDocument {
    this._requireNameFree(name);
    const document = new SchemaDocument(name, alias, readVersion, writeVersion, minorVersion, init);
    this.moveIn(document);
    return document;
  }

  /** Moves documents into this set, removing each from the set it currently belongs to. A document
   * already in this set is left alone. Throws if this set already holds a *different* document of
   * the same name - call {@link SchemaSet.moveOut} for the incumbent first, so evicting it is
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
   * document ({@link SchemaDocument.resolveItem}) when you have one. */
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
 * An editable, single in-memory ECSchema. Models the latest spec with no validity assumptions: a
 * document may hold duplicate names, dangling references, or missing required fields, and reports
 * them only when validated.
 *
 * Every document belongs to exactly one {@link SchemaSet}, which is the scope its item references
 * resolve against. A document created with `new` gets a private set of its own; see
 * {@link SchemaSet} for how documents move between sets.
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
  /** The invariant schema name. */
  public readonly name: string;
  /** The namespace prefix used when this schema's items are referenced from other schemas. */
  public alias: string;
  /** Read component of the `RR.WW.mm` version. */
  public readVersion: number;
  /** Write component of the `RR.WW.mm` version. */
  public writeVersion: number;
  /** Minor component of the `RR.WW.mm` version. */
  public minorVersion: number;
  /** Optional display label. */
  public label?: string;
  /** Optional description. */
  public description?: string;
  /** Major component of the EC spec version this document was deserialized from (`3` for a 3.2
   * source), as a hint about its origin. `undefined` for documents created in memory, which are
   * treated as the latest known spec. Purely informational. */
  public originalECXmlVersionMajor?: number;
  /** Minor component to go along with {@link originalECXmlVersionMajor} (`2` for a 3.2 source). */
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

  /** Creates a new document with the given identity, in a private {@link SchemaSet} of its own.
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
   * {@link SchemaSet.moveIn} / {@link SchemaSet.moveOut} to change it. */
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
   * {@link SchemaDocument.moveItemIn}, and {@link SchemaDocument.removeItem}. */
  public get items(): ReadonlyArray<AnySchemaItem> {
    return this._items;
  }

  /** Moves items into this document, removing each from the document it currently belongs to - an
   * item belongs to exactly one, the way a document belongs to exactly one {@link SchemaSet}. The
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
   * ({@link SchemaDocument.moveItemIn}). */
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
   * for further configuration. Any object of the {@link SchemaReference} shape can be
   * passed - a hand-written literal, another {@link SchemaDocument}, or a `SchemaView` `Schema` -
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
   * document's {@link SchemaSet}, and returns how many were filled in. References that already have
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
   * {@link SchemaSet}, or `undefined` when the set does not hold it. The set holds one version per
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
   * @see {@link SchemaDocument.resolveDocument} for how a reference maps to a schema. */
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
   * Covers every item kind; dedicated getters like {@link SchemaDocument.getEntity} exist only for
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
   * {@link SchemaDocument.getItemOfType} for the common case. */
  public getEntity(name: string): EntityClass | undefined {
    return this.getItemOfType(name, SchemaItemType.EntityClass);
  }

  /** Iterates every entity class in declaration order. Sugar over {@link SchemaDocument.getItemsOfType}. */
  public getEntities(): IterableIterator<EntityClass> {
    return this.getItemsOfType(SchemaItemType.EntityClass);
  }

  /** Creates an entity class, appends it, and returns it. */
  public createEntity(name: string, init?: EntityClassInit): EntityClass {
    return new EntityClass(this, name, init);
  }

  /** Creates a mixin, appends it, and returns it. `appliesTo` is the entity class the mixin may be
   * applied to (mandatory data). A mixin is abstract by definition regardless of its
   * {@link ECClass.modifier} - see {@link Mixin}. */
  public createMixin(name: string, appliesTo: LocalOrFullName, init?: ClassInit): Mixin {
    return new Mixin(this, name, appliesTo, init);
  }

  /** Creates a struct class, appends it, and returns it. */
  public createStructClass(name: string, init?: ClassInit): StructClass {
    return new StructClass(this, name, init);
  }

  /** Creates a view, appends it, and returns it. `query` is the ECSQL its instances come from
   * (mandatory data). Declare a property per column the query returns - see {@link View}. */
  public createView(name: string, query: string, init?: ClassInit): View {
    return new View(this, name, query, init);
  }

  /** Creates a custom attribute class, appends it, and returns it. `appliesTo` is the bitmask of
   * container kinds the attribute may be applied to (mandatory data). */
  public createCustomAttributeClass(name: string, appliesTo: CustomAttributeContainerType, init?: ClassInit): CustomAttributeClass {
    return new CustomAttributeClass(this, name, appliesTo, init);
  }

  /** Creates a relationship class, appends it, and returns it. Configure the `source` and `target`
   * constraints inline via `init`, or on the returned handle with {@link RelationshipConstraint.set}. */
  public createRelationship(name: string, init?: RelationshipClassInit): RelationshipClass {
    return new RelationshipClass(this, name, init);
  }

  /** Creates an enumeration item, appends it, and returns it. `backingType` is the enumeration's
   * backing primitive (`"int"` or `"string"`). Add values with {@link Enumeration.createEnumerator}.
   * Note: this creates the enumeration *item*; to add an enumeration-backed *property* to a class use
   * {@link ECClass.createEnumeration}. */
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
 * {@link parseMultiplicity} / {@link formatMultiplicity} to work in numbers instead of strings;
 * validation is what reports a malformed one.
 * @alpha
 */
export type Multiplicity = "(0..1)" | "(0..*)" | "(1..1)" | "(1..*)" | (string & {});

/** The bounds of a {@link Multiplicity}, as numbers.
 * @alpha
 */
export interface MultiplicityBounds {
  /** Lower bound; `0` or more. */
  lowerLimit: number;
  /** Upper bound, or `undefined` when unbounded (`*`) - the same convention
   * {@link PrimitiveArrayProperty.maxOccurs} uses. */
  upperLimit?: number;
}

/** Matches `(lo..hi)` with optional surrounding whitespace, `hi` being a number or `*`. */
const multiplicityPattern = /^\(\s*(\d+)\s*\.\.\s*(\d+|\*)\s*\)$/;

/** Reads a multiplicity string into its numeric bounds, or `undefined` when it is not well-formed.
 * Does not judge whether the bounds make sense together - `"(5..2)"` parses; validation is what
 * reports it.
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
 * (`"BisCore.PhysicalElement"`). The document is validity-free and resolves nothing,
 * so reference correctness is a validation finding - which is why this is a plain string. */
export type LocalOrFullName = string;

/** The spec-defined value each optional, defaultable field reads as when absent. The document keeps
 * "set to the default" and "absent" distinct so it can round-trip a source exactly, so these are
 * not applied on construction. They are the single source of truth for what the defaults are: the
 * per-field doc comments below point here, and a writer asked to drop redundant defaults (the
 * `omitDefaults` option of {@link SchemaJsonWriter}) consults this. */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const SpecDefaults = {
  /** A class with no `modifier`. */
  classModifier: ECClassModifier.None,
  /** A mixin's `modifier`. A mixin is abstract by definition, so this is the value `omitDefaults`
   * treats as redundant. An explicit non-abstract modifier on a mixin is meaningless - nothing in
   * this stack enforces or acts on it - but it is kept verbatim rather than silently rewritten
   * (see {@link Mixin}). */
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
 * this document uses for it within its own scope. Both {@link SchemaDocument} and a `SchemaView`
 * `Schema` satisfy this shape structurally, so a schema a caller already holds can be passed
 * directly wherever a reference is expected. */
export interface SchemaReference {
  name: string;
  /** Read component of the referenced `RR.WW.mm` version. */
  readVersion: number;
  /** Write component of the referenced `RR.WW.mm` version. */
  writeVersion: number;
  /** Minor component of the referenced `RR.WW.mm` version. */
  minorVersion: number;
  /** The alias is `string | null` rather than optional, so skipping it is an explicit decision.
   * Serializing to XML requires an alias on every reference. The JSON format does not carry this field. */
  alias: string | null;
}

/** Complementary schema-level data accepted by the {@link SchemaDocument} constructor. */
export interface SchemaDocumentInit {
  label?: string;
  description?: string;
  originalECXmlVersionMajor?: number;
  originalECXmlVersionMinor?: number;
  source?: string;
  /** Set through {@link SchemaDocument.setSchemaReference}, so the same shapes are accepted
   * (a literal, a held {@link SchemaDocument}, a `SchemaView` `Schema`) and the fields are copied. */
  references?: ReadonlyArray<Readonly<SchemaReference>>;
  /** Schema-level custom attributes, added in order. */
  customAttributes?: ReadonlyArray<CustomAttributeProps>;
}

/** A raw ECXML custom-attribute body: the value elements of a custom attribute exactly as the XML
 * reader found them. Held verbatim until the attribute is materialized against its class, and
 * written straight back out when it never is. A type alias over `string`. */
export type XmlString = string;

/** One value inside a {@link CustomAttribute}: a primitive, a nested struct, or an array of either.
 * Primitives are already typed - the conversion from a source format produced them against the
 * custom attribute class, so a `boolean` property is a `boolean` here and not the string `"True"`.
 * @alpha
 */
export type CustomAttributeValue = string | number | boolean | CustomAttributeValues | CustomAttributeValue[];

/** The values of a {@link CustomAttribute}, keyed by the property names of its custom attribute
 * class. This is the canonical ECJSON shape of a custom attribute instance minus its `className`,
 * and it serializes to any output format.
 * @alpha
 */
export interface CustomAttributeValues { [name: string]: CustomAttributeValue }

/** Anything a {@link CustomAttributeSet} can be attached to: a schema, a class, a property, or a
 * relationship constraint. A custom attribute reaches its {@link SchemaDocument} through its
 * container, which is how it finds its own custom attribute class.
 * @alpha
 */
export type CustomAttributeContainer = SchemaDocument | ECClass | Property | RelationshipConstraint;

/** The plain shape accepted by {@link CustomAttributeSet.add}: a custom attribute class name and
 * optional values. The typed helpers for the standard custom attribute classes
 * ({@link CoreCustomAttributes}, {@link ECDbMap}) return this shape.
 * @alpha
 */
export interface CustomAttributeProps {
  className: LocalOrFullName;
  values?: CustomAttributeValues;
}

/** A custom attribute instance: the custom attribute class it instantiates plus its values.
 *
 * A custom attribute attaches extra information to a piece of metadata, and the intent is to treat
 * that information as plain data. The ECXML serialization works against that intent: it carries no
 * types (every value is text) and it names a struct-array entry after the entry's struct class,
 * which ECJSON does not carry at all. So the values of a custom attribute can only be understood -
 * in either direction - with its custom attribute class in hand.
 *
 * The document therefore **materializes lazily**. A custom attribute read from ECXML starts out
 * unmaterialized: its body is held verbatim as an {@link XmlString}. Reading {@link values},
 * editing it, or writing the document to any format materializes it against its custom attribute
 * class, which that class must be resolvable for. Resolution goes through the owning document's
 * {@link SchemaSet} and falls back to built-in definitions of the standard custom attribute classes
 * ({@link CoreCustomAttributes}, {@link ECDbMap}), so the common ones need nothing loaded.
 *
 * {@link CustomAttribute.values} throws when the class cannot be resolved, because the fix - put
 * the custom attribute's schema in the schema set - is something only the caller can do, and a
 * half-typed bag handed back instead would surface the problem somewhere much harder to diagnose.
 * Use {@link CustomAttribute.tryGetValues} where not knowing is legitimate. Writers never throw:
 * they report an issue and, when the target format is the one the attribute came from, pass the
 * verbatim body through.
 *
 * An instance belongs to exactly one container. Prefer {@link CustomAttributeSet.add} over this
 * constructor; both do the same thing.
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
   * {@link CustomAttribute.values} materializes. */
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
   * and it cannot be resolved. The non-throwing form of {@link CustomAttribute.values}, for callers
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
   * so it throws under the same conditions as {@link CustomAttribute.values}. */
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

/** The plain shape a {@link CustomAttribute} renders as: its class name plus either the materialized
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
   * classes return - is constructed here; an existing {@link CustomAttribute} instance is moved
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
   * names are compared by resolved identity, as in {@link get}. Replacement preserves the existing
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
   * one. Matching follows {@link get}. To keep it, add it to another container instead, which moves it. */
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
 * their own (e.g. {@link UnitSystem}) accept this directly; the others extend it. */
export interface SchemaItemInit {
  label?: string;
  description?: string;
}

/** Common base of every schema item. `schemaItemType` is the discriminant for narrowing; the
 * `is*()` / `assert*()` methods below mirror the same checks on `SchemaView`.
 *
 * An item belongs to exactly one {@link SchemaDocument} - the one that resolves its references -
 * from the moment it is constructed. Every item constructor takes that document as its first
 * argument and registers the item with it, which is all the `create*` factories on the document do.
 * @alpha
 */
export abstract class SchemaItem {
  /** Discriminates the item kind. A getter rather than a field: this constructor registers the
   * item with its document, and a subclass field initializer would not have run yet at that point. */
  public abstract get schemaItemType(): ItemKind;
  /** Optional display label. */
  public label?: string;
  /** Optional description. */
  public description?: string;

  private _name: string;
  private _document: SchemaDocument;

  protected constructor(document: SchemaDocument, name: string) {
    this._document = document;
    this._name = name;
    document[_attach](this);
  }

  /** The item name. Changing it preserves this object's identity and declaration position and
   * updates its document's lookup. Stored references to the old name are not rewritten. */
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
   * document and its {@link SchemaSet}. Changed only by {@link SchemaDocument.moveItemIn}. */
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

  /** Narrows to {@link EntityClass}. */
  public isEntity(): this is EntityClass {
    return this.schemaItemType === SchemaItemType.EntityClass;
  }

  /** Narrows to {@link Mixin}. */
  public isMixin(): this is Mixin {
    return this.schemaItemType === SchemaItemType.Mixin;
  }

  /** Narrows to {@link StructClass}. */
  public isStruct(): this is StructClass {
    return this.schemaItemType === SchemaItemType.StructClass;
  }

  /** Narrows to {@link CustomAttributeClass}. */
  public isCustomAttribute(): this is CustomAttributeClass {
    return this.schemaItemType === SchemaItemType.CustomAttributeClass;
  }

  /** Narrows to {@link RelationshipClass}. */
  public isRelationship(): this is RelationshipClass {
    return this.schemaItemType === SchemaItemType.RelationshipClass;
  }

  /** Narrows to {@link View}. */
  public isView(): this is View {
    return this.schemaItemType === AuthoringSchemaItemType.View;
  }

  /** Narrows to {@link AnyClass} - true for every class kind, {@link View} included. */
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

/** Complementary data shared by every class kind's constructor. */
export interface ClassInit {
  modifier?: ECClassModifier;
  label?: string;
  description?: string;
  /** The single base class reference, if any. */
  baseClass?: LocalOrFullName;
  /** Class-level custom attributes, added in order. */
  customAttributes?: ReadonlyArray<CustomAttributeProps>;
  /** Properties to create on the class, in order, as plain declarations rather than constructed
   * objects - see {@link ECClass.createProperties}. */
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
  /** Abstract / sealed / none. `undefined` when the source carried no modifier, which reads as the
   * spec default ({@link SpecDefaults.classModifier}, or {@link SpecDefaults.mixinModifier} for a
   * mixin). The distinction is preserved so a document round-trips exactly. */
  public modifier?: ECClassModifier;
  /** The single base class reference (e.g. `"BisCore:PhysicalElement"`), if any.
   * @see {@link ECClass.getBaseClass} to resolve it, {@link ECClass.setBaseClass} to set it from a class. */
  public baseClass?: LocalOrFullName;
  /** Class-level custom attributes. */
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

  /** Sets {@link ECClass.baseClass} from a class rather than a reference string, adding a schema
   * reference to that class's schema when this document has none (see
   * {@link SchemaDocument.referenceTo}). */
  public setBaseClass(baseClass: AnyClass): void {
    this.baseClass = this.document.referenceTo(baseClass);
  }

  /** This class's own properties in declaration order. Read-only because the class owns them: a
   * property is created into a class and stays there until it is removed or moved. Use the
   * `create*` factories (or the equivalent property constructors), {@link ECClass.movePropertyIn},
   * and {@link ECClass.removeProperty}. */
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
   * @see {@link ECClass.getExpandedProperty} to search base classes and mixins too. */
  public getProperty(name: string): AnyProperty | undefined {
    return this._propertyLookup.get(name);
  }

  /** Removes this class's own property with the given name (case-insensitive) and returns whether
   * there was one. To keep it, move it into another class instead ({@link ECClass.movePropertyIn}). */
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
   * {@link Property.getBaseProperty} and decide for yourself what an inherited label, category or
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
   * {@link ECClass.getExpandedProperties} yields for the name, found without expanding the rest.
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
   * declaration names. @see {@link ECClass.createProperties} */
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

/** Describes a {@link PrimitiveProperty} to create. `type` is a primitive keyword or an enumeration
 * reference, exactly as {@link ECClass.createPrimitive} takes it. */
export interface PrimitivePropertyDeclaration extends PrimitivePropertyInit {
  kind: PropertyKind.Primitive;
  name: string;
  type: PrimitiveType | LocalOrFullName;
}

/** Describes a {@link PrimitiveArrayProperty} to create. */
export interface PrimitiveArrayPropertyDeclaration extends PrimitiveArrayPropertyInit {
  kind: PropertyKind.PrimitiveArray;
  name: string;
  type: PrimitiveType | LocalOrFullName;
}

/** Describes a {@link StructProperty} to create. */
export interface StructPropertyDeclaration extends PropertyInit {
  kind: PropertyKind.Struct;
  name: string;
  structClass: LocalOrFullName;
}

/** Describes a {@link StructArrayProperty} to create. */
export interface StructArrayPropertyDeclaration extends StructArrayPropertyInit {
  kind: PropertyKind.StructArray;
  name: string;
  structClass: LocalOrFullName;
}

/** Describes a {@link NavigationProperty} to create. */
export interface NavigationPropertyDeclaration extends PropertyInit {
  kind: PropertyKind.Navigation;
  name: string;
  relationship: LocalOrFullName;
  direction: StrengthDirection;
}

/** Plain data describing one property to create, discriminated by `kind` - the same discriminant
 * {@link Property.kind} carries, so a declaration reads like the property it produces. Accepted by
 * {@link ECClass.createProperties} and by {@link ClassInit.properties}.
 * @alpha
 */
export type AnyPropertyDeclaration = PrimitivePropertyDeclaration | PrimitiveArrayPropertyDeclaration
  | StructPropertyDeclaration | StructArrayPropertyDeclaration | NavigationPropertyDeclaration;

/** Maps each {@link PropertyKind} discriminant to the property type a declaration of that kind
 * produces, so {@link ECClass.createProperty} returns the concrete kind rather than the union. */
export interface PropertyDeclarationTypeMap {
  [PropertyKind.Primitive]: PrimitiveProperty;
  [PropertyKind.PrimitiveArray]: PrimitiveArrayProperty;
  [PropertyKind.Struct]: StructProperty;
  [PropertyKind.StructArray]: StructArrayProperty;
  [PropertyKind.Navigation]: NavigationProperty;
}

/** Complementary data accepted by the {@link EntityClass} constructor. */
export interface EntityClassInit extends ClassInit {
  /** Applied mixin references, in declaration order. */
  mixins?: LocalOrFullName[];
}

/** An entity class.
 * @alpha
 */
export class EntityClass extends ECClass {
  public get schemaItemType(): SchemaItemType.EntityClass { return SchemaItemType.EntityClass; }
  /** Applied mixin references, in declaration order. An entity has at most one
   * {@link ECClass.baseClass}; mixins are separate. Note that, lacking validation, after XML
   * deserialization a mixin may land in `baseClass` instead (the deserializer cannot tell them
   * apart) when there is no other base class.
   * @see {@link EntityClass.getMixins} to resolve them, {@link EntityClass.addMixin} to add one from a mixin. */
  public readonly mixins: LocalOrFullName[] = [];

  /** Creates an entity class in `document`. `name` is the only other mandatory argument. */
  public constructor(document: SchemaDocument, name: string, init?: EntityClassInit) {
    super(document, name, init);
    if (init?.mixins)
      this.mixins.push(...init.mixins);
  }

  /** The applied mixins, resolved through the document's schema set, positionally aligned with
   * {@link EntityClass.mixins} - an entry that does not resolve is `undefined` rather than dropped,
   * so a caller can tell which one is missing. */
  public getMixins(): Array<Mixin | undefined> {
    return this.mixins.map((mixin) => this.document.resolveItemOfType(mixin, SchemaItemType.Mixin));
  }

  /** Appends a mixin reference from the mixin itself, adding a schema reference to its schema when
   * this document has none (see {@link SchemaDocument.referenceTo}). */
  public addMixin(...mixins: Mixin[]): void {
    for (const mixin of mixins)
      this.mixins.push(this.document.referenceTo(mixin));
  }
}

/** A mixin: an abstract class mixed into entity classes. In ECXML 3.2 it is an entity class carrying
 * an `IsMixin` custom attribute; the document promotes it to a first-class kind.
 *
 * A mixin is **abstract by definition**. Although it still carries the {@link ECClass.modifier}
 * field, that field is conceptually always `Abstract`, and nothing in this stack enforces, defaults,
 * or otherwise acts on it. An explicit non-abstract modifier (e.g. `modifier="None"`) is therefore
 * meaningless and does not round-trip consistently across stacks: ECObjects-native drops a mixin's
 * `None` when writing XML and omits the modifier entirely in ECJSON, whereas this document preserves
 * whatever the source carried. Treat any non-`Abstract` mixin modifier as a likely authoring
 * mistake. `omitDefaults` ({@link SpecDefaults.mixinModifier}) drops a redundant `Abstract` but
 * keeps such an odd value, so a comparison surfaces it rather than hiding it.
 * @alpha
 */
export class Mixin extends ECClass {
  public get schemaItemType(): SchemaItemType.Mixin { return SchemaItemType.Mixin; }
  /** The entity class (including its derived classes) that this mixin may be applied to. (3.2: `IsMixin.AppliesToEntityClass`). */
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

  /** Sets {@link Mixin.appliesTo} from the entity class itself (see {@link SchemaDocument.referenceTo}). */
  public setAppliesTo(entityClass: EntityClass): void {
    this.appliesTo = this.document.referenceTo(entityClass);
  }
}

/** An ECSQL-backed view: a class whose instances are produced by a query rather than stored.
 *
 * No persisted format has a `View` element. In both ECXML and ECJSON a view is an entity class
 * carrying the `ECDbMap:QueryView` custom attribute, which holds the query; the readers promote such
 * a class to this kind and the writers undo the promotion. That is the same treatment {@link Mixin}
 * gets in ECXML, one step further because ECJSON has no view either.
 *
 * The {@link View.query} is stored and round-tripped verbatim - never parsed, and never rewritten
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

/** A struct class - the type of a struct (or struct-array) property's embedded value.
 * @alpha
 */
export class StructClass extends ECClass {
  public get schemaItemType(): SchemaItemType.StructClass { return SchemaItemType.StructClass; }

  /** Creates a struct class in `document`. `name` is the only other mandatory argument. */
  public constructor(document: SchemaDocument, name: string, init?: ClassInit) {
    super(document, name, init);
  }
}

/** A custom attribute class - the definition a {@link CustomAttribute} instance instantiates.
 * @alpha
 */
export class CustomAttributeClass extends ECClass {
  public get schemaItemType(): SchemaItemType.CustomAttributeClass { return SchemaItemType.CustomAttributeClass; }
  /** Bitmask of container kinds an instance of this class may be applied to. The wire form is a
   * delimited string; this is the parsed flags value. */
  public appliesTo: CustomAttributeContainerType;

  /** Creates a custom attribute class in `document`. `appliesTo` is mandatory. */
  public constructor(document: SchemaDocument, name: string, appliesTo: CustomAttributeContainerType, init?: ClassInit) {
    super(document, name, init);
    this.appliesTo = appliesTo;
  }
}

/** Complementary data accepted by the {@link RelationshipClass} constructor. The two constraints are
 * not here - they are created empty and configured on the returned handle. */
/** Complementary data accepted by {@link RelationshipConstraint.set} and by the `source` / `target`
 * fields of {@link RelationshipClassInit}. A pure field initializer: provided scalar fields are
 * assigned and `constraintClasses` are appended; omitted fields are left untouched.
 * @alpha
 */
export interface RelationshipConstraintInit {
  multiplicity?: Multiplicity;
  roleLabel?: string;
  polymorphic?: boolean;
  abstractConstraint?: LocalOrFullName;
  /** Constraint class references; appended to any already present. */
  constraintClasses?: LocalOrFullName[];
  /** Constraint-level custom attributes, added in order. */
  customAttributes?: ReadonlyArray<CustomAttributeProps>;
}

export interface RelationshipClassInit extends ClassInit {
  strength?: StrengthType;
  strengthDirection?: StrengthDirection;
  /** Configures the source constraint in the same pass as the class (see {@link RelationshipConstraint.set}). */
  source?: RelationshipConstraintInit;
  /** Configures the target constraint in the same pass as the class. */
  target?: RelationshipConstraintInit;
}

/** One end (source or target) of a relationship. Not a schema item - it is owned by its
 * {@link RelationshipClass}. A constraint is a custom attribute container, but unlike classes and
 * properties it does not inherit CAs from a base relationship's constraint.
 * @alpha
 */
export class RelationshipConstraint {
  /** Which end of the relationship this constraint describes. */
  public readonly relationshipEnd: RelationshipEnd;
  /** The relationship class this constraint is one end of. */
  public readonly relationshipClass: RelationshipClass;
  /** Multiplicity as an `(lo..hi)` string (e.g. `"(0..1)"`, `"(1..*)"`).
   * @see {@link parseMultiplicity} to read it as numbers. */
  public multiplicity: Multiplicity = "(0..*)";
  /** Role label. The spec requires it; the document leaves it optional and defers to validation. */
  public roleLabel?: string;
  /** Whether the constraint matches derived classes of its constraint classes. `undefined` when the
   * source carried no value, which reads as the spec default ({@link SpecDefaults.constraintPolymorphic}). */
  public polymorphic?: boolean;
  /** The common base/abstract constraint, required when there is more than one constraint class and
   * none is inherited. */
  public abstractConstraint?: LocalOrFullName;
  /** Constraint class references (at least one is required by the spec). */
  public readonly constraintClasses: LocalOrFullName[] = [];
  /** Constraint-level custom attributes. */
  public readonly customAttributes: CustomAttributeSet;

  /** @internal Constructed by its {@link RelationshipClass}. */
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
   * {@link RelationshipConstraint.constraintClasses}; an entry that does not resolve is `undefined`. */
  public getConstraintClasses(): Array<AnyClass | undefined> {
    return this.constraintClasses.map((c) => this.document.resolveItemOfType(c, AbstractSchemaItemType.Class));
  }

  /** Appends constraint class references from the classes themselves (see {@link SchemaDocument.referenceTo}). */
  public addConstraintClass(...constraintClasses: AnyClass[]): void {
    for (const constraintClass of constraintClasses)
      this.constraintClasses.push(this.document.referenceTo(constraintClass));
  }

  /** The abstract constraint, resolved through the document's schema set. */
  public getAbstractConstraint(): AnyClass | undefined {
    return this.abstractConstraint === undefined ? undefined : this.document.resolveItemOfType(this.abstractConstraint, AbstractSchemaItemType.Class);
  }

  /** Sets {@link RelationshipConstraint.abstractConstraint} from the class itself. */
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

/** A relationship class relating instances of its source and target constraint classes.
 * @alpha
 */
export class RelationshipClass extends ECClass {
  public get schemaItemType(): SchemaItemType.RelationshipClass { return SchemaItemType.RelationshipClass; }
  /** How the lifetimes of source and target are related. `undefined` when the source carried no
   * value, which reads as the spec default ({@link SpecDefaults.relationshipStrength}). */
  public strength?: StrengthType;
  /** Which end is the starting point. `undefined` when the source carried no value, which reads as
   * the spec default ({@link SpecDefaults.relationshipStrengthDirection}). */
  public strengthDirection?: StrengthDirection;
  /** The source end. */
  public readonly source = new RelationshipConstraint(this, RelationshipEnd.Source);
  /** The target end. */
  public readonly target = new RelationshipConstraint(this, RelationshipEnd.Target);

  /** Creates a relationship class in `document`. `init` carries strength / direction, the shared
   * class fields, and optional `source` / `target` configuration; any constraint end left out of
   * `init` starts empty and can be configured later via {@link RelationshipConstraint.set}. */
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

/** The backing primitive of an {@link Enumeration} (XML attribute `backingTypeName`). */
export type EnumerationBackingType = "int" | "string";

/** One value of an {@link Enumeration}. The `value` type matches the enumeration's backing type. */
export interface Enumerator {
  name: string;
  value: number | string;
  label?: string;
  description?: string;
}

/** Complementary data accepted by {@link Enumeration.createEnumerator}. */
export interface EnumeratorInit {
  label?: string;
  description?: string;
}

/** Complementary data accepted by the {@link Enumeration} constructor. */
export interface EnumerationInit {
  label?: string;
  description?: string;
  /** When `false`, instances may carry values not declared here. Defaults to `true`. */
  isStrict?: boolean;
  /** The declared values, in declaration order; copied into the enumeration. */
  enumerators?: ReadonlyArray<Readonly<Enumerator>>;
}

/** An enumeration: a named set of `int` or `string` values.
 * @alpha
 */
export class Enumeration extends SchemaItem {
  public get schemaItemType(): SchemaItemType.Enumeration { return SchemaItemType.Enumeration; }
  /** Backing primitive - `"int"` or `"string"`; the enumerators' values must match. */
  public backingType: EnumerationBackingType;
  /** When `false`, undeclared values are allowed. */
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

/** Complementary data accepted by the {@link KindOfQuantity} constructor. */
export interface KindOfQuantityInit {
  label?: string;
  description?: string;
  /** Presentation format override strings, in declaration order; the first is the default. */
  presentationFormats?: string[];
}

/** A kind of quantity: a persistence unit plus optional presentation formats, referenced by
 * properties via {@link PropertyInit.kindOfQuantity}.
 * @alpha
 */
export class KindOfQuantity extends SchemaItem {
  public get schemaItemType(): SchemaItemType.KindOfQuantity { return SchemaItemType.KindOfQuantity; }
  /** The unit reference the quantity persists in (e.g. `"Units:M"`). */
  public persistenceUnit: LocalOrFullName;
  /** Conversion tolerance, as the ratio of absolute error to actual value (`0.001` reads
   * "accurate to one part in a thousand"). */
  public relativeError: number;
  /** Presentation format override strings, in declaration order; the first is the default presentation. */
  public readonly presentationFormats: string[] = [];

  /** The unit the quantity persists in, resolved through the document's schema set. A unit
   * reference that does not resolve is a warning, not an error: units are moving out of schemas
   * into the external units framework, where the same identifier resolves elsewhere. */
  public getPersistenceUnit(): Unit | InvertedUnit | undefined {
    const item = this.document.resolveItem(this.persistenceUnit);
    return item?.schemaItemType === SchemaItemType.Unit || item?.schemaItemType === SchemaItemType.InvertedUnit ? item : undefined;
  }

  /** Sets {@link KindOfQuantity.persistenceUnit} from the unit itself (see {@link SchemaDocument.referenceTo}). */
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

/** Complementary data accepted by the {@link PropertyCategory} constructor. */
export interface PropertyCategoryInit {
  label?: string;
  description?: string;
  /** Display sort order. */
  priority?: number;
}

/** A property category: a UI grouping referenced by properties via {@link PropertyInit.category}.
 * @alpha
 */
export class PropertyCategory extends SchemaItem {
  public get schemaItemType(): SchemaItemType.PropertyCategory { return SchemaItemType.PropertyCategory; }
  /** Display sort order. */
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
 * {@link Unit}s declare membership in. Carries no data beyond the common item envelope.
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
 * quantify. Units of the same phenomenon are mutually convertible.
 * @alpha
 */
export class Phenomenon extends SchemaItem {
  public get schemaItemType(): SchemaItemType.Phenomenon { return SchemaItemType.Phenomenon; }
  /** Defining expression in terms of other phenomena (e.g. `"LENGTH(2)"` for area,
   * `"FORCE*LENGTH(-2)"` for pressure), or the phenomenon's own name for a base
   * phenomenon (e.g. `"LENGTH"`). */
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

/** Complementary data accepted by the {@link Unit} constructor. */
export interface UnitInit extends SchemaItemInit {
  /** Numerator of the factor relating this unit to its definition. */
  numerator?: number;
  /** Denominator of the factor relating this unit to its definition. */
  denominator?: number;
  /** Offset applied when converting to this unit. */
  offset?: number;
}

/** A unit of measure. Its `definition` expresses it in terms of other units and constants;
 * `numerator` / `denominator` / `offset` carry the conversion factor that expression is scaled by.
 * @alpha
 */
export class Unit extends SchemaItem {
  public get schemaItemType(): SchemaItemType.Unit { return SchemaItemType.Unit; }
  /** Reference to the {@link Phenomenon} this unit measures. */
  public phenomenon: LocalOrFullName;
  /** Reference to the {@link UnitSystem} this unit belongs to. */
  public unitSystem: LocalOrFullName;
  /** Defining expression in terms of other units and constants (e.g. `"MILLI*M"`,
   * `"M*SEC(-1)"`), or the unit's own name for a base unit (e.g. `"M"`). */
  public definition: string;
  /** Numerator of the factor relating this unit to its definition. `undefined` reads as `1.0`
   * and is not persisted. */
  public numerator?: number;
  /** Denominator of the factor relating this unit to its definition. `undefined` reads as `1.0`
   * and is not persisted. */
  public denominator?: number;
  /** Offset applied when converting to this unit (e.g. Celsius is kelvin with an offset of
   * `-273.15`). `undefined` reads as `0.0` and is not persisted. */
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
 * phenomenon and conversion from the unit it inverts, so unlike {@link Unit} it carries no
 * definition of its own.
 * @alpha
 */
export class InvertedUnit extends SchemaItem {
  public get schemaItemType(): SchemaItemType.InvertedUnit { return SchemaItemType.InvertedUnit; }
  /** Reference to the {@link Unit} this unit is the reciprocal of. */
  public invertsUnit: LocalOrFullName;
  /** Reference to the {@link UnitSystem} this unit belongs to. */
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

/** Complementary data accepted by the {@link Constant} constructor. */
export interface ConstantInit extends SchemaItemInit {
  /** Numerator of the constant's value. */
  numerator?: number;
  /** Denominator of the constant's value. */
  denominator?: number;
}

/** A constant: a fixed quantity usable in unit definitions (e.g. `PI`, or `DECA` as `10`). Like a
 * {@link Unit} it has a phenomenon and a defining expression, but no unit system - it is not a
 * unit values are stated in.
 * @alpha
 */
export class Constant extends SchemaItem {
  public get schemaItemType(): SchemaItemType.Constant { return SchemaItemType.Constant; }
  /** Reference to the {@link Phenomenon} this constant belongs to (e.g. a dimensionless ratio
   * like `"NUMBER"` for `PI`). */
  public phenomenon: LocalOrFullName;
  /** Defining expression, like {@link Unit.definition} (`"ONE"` for a plain number). */
  public definition: string;
  /** Numerator of the constant's value (e.g. `3.14159...` for `PI`). `undefined` reads as `1.0`
   * and is not persisted. */
  public numerator?: number;
  /** Denominator of the constant's value. `undefined` reads as `1.0` and is not persisted. */
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

/** One unit of a {@link FormatComposite}: a reference to a `Unit` or `InvertedUnit`, plus an
 * optional label overriding the unit's own when values are rendered. */
export interface FormatCompositeUnit {
  /** Reference to the `Unit` or `InvertedUnit`. */
  name: LocalOrFullName;
  /** Label rendered after this unit's segment, overriding the unit's own display label. */
  label?: string;
}

/** The composite specification of a {@link Format}: how a single quantity is split across up to
 * four units of descending magnitude (e.g. feet-and-inches, degrees-minutes-seconds). */
export interface FormatComposite {
  /** Separator between the unit segments. Empty or a single character; `undefined` reads as the
   * spec default ({@link SpecDefaults.compositeSpacer}). */
  spacer?: string;
  /** Whether zero-magnitude segments are rendered. `undefined` reads as the spec default
   * ({@link SpecDefaults.compositeIncludeZero}). */
  includeZero?: boolean;
  /** The composite's units in descending magnitude, each with an optional label override. The spec
   * requires one to four; the document does not enforce that. */
  units: FormatCompositeUnit[];
}

/** Complementary data accepted by the {@link Format} constructor. */
export interface FormatInit extends SchemaItemInit {
  precision?: DecimalPrecision | FractionalPrecision;
  roundFactor?: number;
  minWidth?: number;
  showSignOption?: ShowSignOption;
  formatTraits?: FormatTraits;
  decimalSeparator?: string;
  thousandSeparator?: string;
  uomSeparator?: string;
  scientificType?: ScientificType;
  stationOffsetSize?: number;
  stationSeparator?: string;
  /** Copied into an owned {@link Format.composite} object. */
  composite?: Readonly<FormatComposite>;
}

/** A format: how a quantity value is rendered as a string - numeric type and precision, separators,
 * sign handling, and optionally a {@link FormatComposite} splitting the value across multiple
 * units. Referenced by a `KindOfQuantity`'s presentation format strings, which may override the
 * precision and composite units inline (e.g. `"f:DefaultRealU(4)[u:M]"`).
 * Every field beyond `type` is optional, `undefined` meaning "not set": it reads as the noted
 * default and is not persisted. Note the EC schema spec serializes only the decimal, fractional,
 * scientific, and station types; the remaining {@link FormatType} members belong to the quantity
 * formatting library and validation reports them on a schema format.
 * @alpha
 */
export class Format extends SchemaItem {
  public get schemaItemType(): SchemaItemType.Format { return SchemaItemType.Format; }
  /** The numeric rendering kind (decimal, fractional, scientific, station). */
  public type: FormatType;
  /** Precision of the numeric part: a {@link DecimalPrecision} (decimal places) for decimal-based
   * types, a {@link FractionalPrecision} (fraction denominator) for fractional. `undefined` reads
   * as the type's spec default. */
  public precision?: DecimalPrecision | FractionalPrecision;
  /** Rounding factor applied when the {@link FormatTraits.ApplyRounding} trait is set; `0` rounds
   * to precision. `undefined` reads as the spec default ({@link SpecDefaults.formatRoundFactor}). */
  public roundFactor?: number;
  /** Minimum width of the formatted string, padded to fit; `undefined` pads nothing. */
  public minWidth?: number;
  /** How the sign of the value is rendered. `undefined` reads as the spec default
   * ({@link SpecDefaults.formatShowSignOption}). */
  public showSignOption?: ShowSignOption;
  /** Bitmask of rendering traits ({@link FormatTraits.ShowUnitLabel}, ...). The wire form is a
   * delimited string; this is the parsed flags value. `undefined` reads as no traits, same as
   * {@link FormatTraits.Uninitialized} (`0`). */
  public formatTraits?: FormatTraits;
  /** Separator between the integer and fractional digits. Empty or a single character;
   * `undefined` reads as the spec default ({@link SpecDefaults.formatDecimalSeparator}). */
  public decimalSeparator?: string;
  /** Separator grouping the integer digits by thousands, rendered only with the
   * {@link FormatTraits.Use1000Separator} trait. Empty or a single character; `undefined` reads as
   * the spec default ({@link SpecDefaults.formatThousandSeparator}). */
  public thousandSeparator?: string;
  /** Separator between the value and the unit label. Empty or a single character; `undefined`
   * reads as the spec default ({@link SpecDefaults.formatUomSeparator}). */
  public uomSeparator?: string;
  /** Scientific notation variant; the spec requires it when {@link Format.type} is scientific. */
  public scientificType?: ScientificType;
  /** Number of digits right of the station separator; the spec requires it when
   * {@link Format.type} is station. */
  public stationOffsetSize?: number;
  /** Separator between the station and offset digits (`"3+25"`). Empty or a single character;
   * `undefined` reads as the spec default ({@link SpecDefaults.formatStationSeparator}). */
  public stationSeparator?: string;
  /** The composite specification splitting the value across multiple units, if any. */
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

  /** True when the given trait is set in {@link Format.formatTraits}. */
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

/** Complementary data shared by every property kind's constructor. */
export interface PropertyInit {
  label?: string;
  description?: string;
  isReadOnly?: boolean;
  priority?: number;
  /** Reference to a PropertyCategory */
  category?: LocalOrFullName;
  /** Reference to a KindOfQuantity (e.g. `"AecUnits:VOLUMETRIC_FLOW"`). Only meaningful on primitive
   * and primitive-array properties (whose values are scalar quantities). */
  kindOfQuantity?: LocalOrFullName;
  /** Property-level custom attributes, added in order. */
  customAttributes?: ReadonlyArray<CustomAttributeProps>;
}

/** Common base of every property kind. `kind` is the discriminant for narrowing.
 *
 * A property belongs to exactly one {@link ECClass} from the moment it is constructed. Every
 * property constructor takes that class as its first argument and registers the property with it,
 * which is all the `create*` factories on the class do.
 * @alpha
 */
export abstract class Property {
  /** Discriminates the property kind. A getter rather than a field, for the same reason as
   * {@link SchemaItem.schemaItemType}: the property is registered with its class from this
   * constructor, before a subclass field initializer would have run. */
  public abstract get kind(): PropertyKind;
  /** Optional display label. */
  public label?: string;
  /** Optional description. */
  public description?: string;
  /** Whether the property is read-only. */
  public isReadOnly?: boolean;
  /** Display priority. */
  public priority?: number;
  /** Reference to a PropertyCategory (e.g. `"MyDomain:Cat"`).
   * @see {@link Property.getCategory}, {@link Property.setCategory}. */
  public category?: LocalOrFullName;
  /** Reference to a KindOfQuantity (e.g. `"AecUnits:VOLUMETRIC_FLOW"`). Only meaningful on
   * primitive / primitive-array properties.
   * @see {@link Property.getKindOfQuantity}, {@link Property.setKindOfQuantity}. */
  public kindOfQuantity?: LocalOrFullName;
  /** Property-level custom attributes. */
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

  /** The property name. Changing it preserves this object's identity and declaration position and
   * updates its declaring class's lookup. Stored references and derived overrides are not rewritten. */
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

  /** The class this property belongs to. Changed only by {@link ECClass.movePropertyIn}. */
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

  /** Sets {@link Property.category} from the category itself (see {@link SchemaDocument.referenceTo}). */
  public setCategory(category: PropertyCategory): void {
    this.category = this.document.referenceTo(category);
  }

  /** The kind of quantity, resolved through the document's schema set. */
  public getKindOfQuantity(): KindOfQuantity | undefined {
    return this.kindOfQuantity === undefined ? undefined : this.document.resolveItemOfType(this.kindOfQuantity, SchemaItemType.KindOfQuantity);
  }

  /** Sets {@link Property.kindOfQuantity} from the kind of quantity itself (see {@link SchemaDocument.referenceTo}). */
  public setKindOfQuantity(kindOfQuantity: KindOfQuantity): void {
    this.kindOfQuantity = this.document.referenceTo(kindOfQuantity);
  }

  /** Narrows to the primitive kinds ({@link PrimitiveProperty}, {@link PrimitiveArrayProperty}).
   * Includes primitive arrays, matching the same check on `SchemaView`. */
  public isPrimitive(): this is AnyPrimitiveProperty {
    return this.kind === PropertyKind.Primitive || this.kind === PropertyKind.PrimitiveArray;
  }

  /** Narrows to the struct kinds ({@link StructProperty}, {@link StructArrayProperty}). */
  public isStruct(): this is AnyStructProperty {
    return this.kind === PropertyKind.Struct || this.kind === PropertyKind.StructArray;
  }

  /** Narrows to the array kinds ({@link PrimitiveArrayProperty}, {@link StructArrayProperty}). */
  public isArray(): this is AnyArrayProperty {
    return this.kind === PropertyKind.PrimitiveArray || this.kind === PropertyKind.StructArray;
  }

  /** Narrows to {@link NavigationProperty}. */
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

/** Complementary data accepted by the {@link PrimitiveProperty} constructor. */
export interface PrimitivePropertyInit extends PropertyInit {
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
  /** Extended type name, if any. */
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

  /** Points {@link PrimitiveProperty.typeName} at the enumeration itself (see {@link SchemaDocument.referenceTo}). */
  public setEnumeration(enumeration: Enumeration): void {
    this.typeName = this.document.referenceTo(enumeration);
  }
}

/** Complementary data accepted by the {@link PrimitiveArrayProperty} constructor. */
export interface PrimitiveArrayPropertyInit extends PropertyInit {
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

/** A primitive (or enumeration-backed) array property.
 * @alpha
 */
export class PrimitiveArrayProperty extends Property {
  public get kind(): PropertyKind.PrimitiveArray { return PropertyKind.PrimitiveArray; }
  /** Primitive keyword or enumeration reference of the array element. */
  public typeName: string;
  /** Extended type name, if any. */
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

  /** Points {@link PrimitiveArrayProperty.typeName} at the enumeration itself. */
  public setEnumeration(enumeration: Enumeration): void {
    this.typeName = this.document.referenceTo(enumeration);
  }
}

/** A struct property - an embedded instance of a struct class.
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

  /** Points {@link StructProperty.typeName} at the struct class itself (see {@link SchemaDocument.referenceTo}). */
  public setStructClass(structClass: StructClass): void {
    this.typeName = this.document.referenceTo(structClass);
  }
}

/** Complementary data accepted by the {@link StructArrayProperty} constructor. */
export interface StructArrayPropertyInit extends PropertyInit {
  /** Minimum number of elements (default 0). */
  minOccurs?: number;
  /** Maximum number of elements; omit for unbounded. */
  maxOccurs?: number;
}

/** A struct array property - an array of embedded struct instances.
 * @alpha
 */
export class StructArrayProperty extends Property {
  public get kind(): PropertyKind.StructArray { return PropertyKind.StructArray; }
  /** Reference to the `StructClass` of the array element. */
  public typeName: LocalOrFullName;
  /** Minimum number of elements (default 0). */
  public minOccurs: number = 0;
  /** Maximum number of elements; `undefined` means unbounded. See {@link PrimitiveArrayProperty.maxOccurs}. */
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

  /** Points {@link StructArrayProperty.typeName} at the struct class itself. */
  public setStructClass(structClass: StructClass): void {
    this.typeName = this.document.referenceTo(structClass);
  }
}

/** A navigation property - a reference to a related instance reached through a relationship.
 * @alpha
 */
export class NavigationProperty extends Property {
  public get kind(): PropertyKind.Navigation { return PropertyKind.Navigation; }
  /** Reference to the `RelationshipClass` this property traverses. */
  public relationshipName: LocalOrFullName;
  /** Which end of the relationship this property starts from. */
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

  /** Points {@link NavigationProperty.relationshipName} at the relationship class itself. */
  public setRelationshipClass(relationshipClass: RelationshipClass): void {
    this.relationshipName = this.document.referenceTo(relationshipClass);
  }
}

/** Union of every property kind. */
export type AnyProperty = PrimitiveProperty | PrimitiveArrayProperty | StructProperty | StructArrayProperty | NavigationProperty;

/** The primitive (or enumeration-backed) property kinds: scalar or array. */
export type AnyPrimitiveProperty = PrimitiveProperty | PrimitiveArrayProperty;

/** The struct property kinds: scalar or array of an embedded struct. */
export type AnyStructProperty = StructProperty | StructArrayProperty;

/** The array property kinds. */
export type AnyArrayProperty = PrimitiveArrayProperty | StructArrayProperty;

/** Union of every EC class kind. */
export type AnyClass = EntityClass | Mixin | View | StructClass | CustomAttributeClass | RelationshipClass;

/** Union of every schema item kind. */
export type AnySchemaItem = AnyClass | Enumeration | KindOfQuantity | PropertyCategory
  | UnitSystem | Phenomenon | Unit | InvertedUnit | Constant | Format;

/** Maps each {@link SchemaItemType} discriminant to its concrete item type, plus the
 * {@link AbstractSchemaItemType} groupings to their union types, so the typed accessors
 * ({@link SchemaDocument.getItemOfType}, {@link SchemaDocument.getItemsOfType}) can narrow either by
 * a single kind or by a grouping (e.g. `Class` for any class kind). */
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
