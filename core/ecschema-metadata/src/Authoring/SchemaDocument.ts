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

/** Case-invariant name comparison. EC names are case-insensitive; comparison is the document's
 * only interpretation of a name, kept deliberately simple. */
function namesEqual(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/** Folds a schema-item full name to a comparable key: the two EC separators (`:` and `.`) are treated
 * as equivalent and case is ignored. Used only to match custom-attribute references by name; the
 * document resolves nothing else about a reference. */
function foldFullName(fullName: string): string {
  return fullName.replace(/\./g, ":").toLowerCase();
}

/**
 * A raw, editable, single in-memory ECSchema. Models the latest spec with no validity assumptions,
 * no cross-reference resolution.
 * The underlying collections
 * ({@link SchemaDocument.items}, {@link Authoring.ECClass.properties}) and the
 * `new Authoring.X(...)` constructors stay public for direct manipulation and power use (clone,
 * merge, programmatic generation). Every type takes its mandatory data as positional arguments and
 * the rest through an optional `init` object, so a single field can be set by name while the others
 * keep their defaults.
 * @example
 * ```ts
 * const doc = new SchemaDocument("MyDomain", "mydom", 1, 0, 0, {
 *   references: [{ name: "BisCore", readVersion: 1, writeVersion: 0, minorVersion: 0, alias: "bis" }],
 * });
 * const pump = doc.createEntity("Pump", { label: "Pump", baseClass: "BisCore:PhysicalElement" });
 * const serial = pump.createPrimitive("SerialNumber", PrimitiveType.String);
 * serial.customAttributes.add({ className: "CoreCustomAttributes.HiddenProperty" });
 * pump.createPrimitive("FlowRate", PrimitiveType.Double, { kindOfQuantity: "AecUnits:VOLUMETRIC_FLOW" });
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
  public readonly references: Authoring.SchemaReference[] = [];
  /** Schema-level custom attributes. */
  public readonly customAttributes = new Authoring.CustomAttributeSet();
  /** The schema items (classes, enumerations, ...) in declaration order. Prefer the `create*` factories
   * ({@link SchemaDocument.createEntity}, ...) which append here and return a handle; the typed
   * accessors below ({@link SchemaDocument.getItemOfType}, ...) read it back. */
  public readonly items: Authoring.AnySchemaItem[] = [];

  /** Creates a new document with the given identity. `init` carries the complementary schema-level
   * data; every field left out keeps its default. */
  public constructor(name: string, alias: string, readVersion: number, writeVersion: number, minorVersion: number, init?: Authoring.SchemaDocumentInit) {
    this.name = name;
    this.alias = alias;
    this.readVersion = readVersion;
    this.writeVersion = writeVersion;
    this.minorVersion = minorVersion;
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
    }
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
   * for further configuration. Any object of the {@link Authoring.SchemaReference} shape can be
   * passed - a hand-written literal, another {@link SchemaDocument}, or a `SchemaView` `Schema` -
   * so a reference is derived from a schema a caller already holds by just passing it. The source's
   * own `alias` is then only the suggested default; set a different one on the returned reference
   * if this document uses one. */
  public setSchemaReference(reference: Readonly<Authoring.SchemaReference>): Authoring.SchemaReference {
    const stored: Authoring.SchemaReference = {
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
  public getSchemaReference(name: string): Authoring.SchemaReference | undefined {
    return this.references.find((r) => namesEqual(r.name, name));
  }

  /** Returns the first item with the given name (case-insensitive), or `undefined`. */
  public getItem(name: string): Authoring.AnySchemaItem | undefined {
    return this.items.find((i) => namesEqual(i.name, name));
  }

  /** Removes and returns the first item with the given name (case-insensitive), or `undefined`. */
  public removeItem(name: string): Authoring.AnySchemaItem | undefined {
    const index = this.items.findIndex((i) => namesEqual(i.name, name));
    return index === -1 ? undefined : this.items.splice(index, 1)[0];
  }

  /** Returns the first item with the given name whose kind matches `itemType`, narrowed to that
   * kind's type, or `undefined` (no such name, or a name of a different kind). `itemType` may be a
   * concrete {@link SchemaItemType} or a grouping ({@link AbstractSchemaItemType.Class},
   * {@link AbstractSchemaItemType.SchemaItem}), in which case any member kind matches.
   * Covers every item kind; dedicated getters like {@link SchemaDocument.getEntity} exist only for
   * the most common ones. */
  public getItemOfType<K extends keyof Authoring.SchemaItemTypeMap>(name: string, itemType: K): Authoring.SchemaItemTypeMap[K] | undefined {
    const item = this.getItem(name);
    return item !== undefined && isSupportedSchemaItemType(item.schemaItemType, itemType) ? item as Authoring.SchemaItemTypeMap[K] : undefined;
  }

  /** Iterates every item of the given kind in declaration order, narrowed to that kind's type.
   * `itemType` may be a concrete {@link SchemaItemType} or a grouping
   * ({@link AbstractSchemaItemType.Class}, {@link AbstractSchemaItemType.SchemaItem}). */
  public *getItemsOfType<K extends keyof Authoring.SchemaItemTypeMap>(itemType: K): IterableIterator<Authoring.SchemaItemTypeMap[K]> {
    for (const item of this.items) {
      if (isSupportedSchemaItemType(item.schemaItemType, itemType))
        yield item as Authoring.SchemaItemTypeMap[K];
    }
  }

  /** Returns the first entity class with the given name, or `undefined`. Sugar over
   * {@link SchemaDocument.getItemOfType} for the common case. */
  public getEntity(name: string): Authoring.EntityClass | undefined {
    return this.getItemOfType(name, SchemaItemType.EntityClass);
  }

  /** Iterates every entity class in declaration order. Sugar over {@link SchemaDocument.getItemsOfType}. */
  public getEntities(): IterableIterator<Authoring.EntityClass> {
    return this.getItemsOfType(SchemaItemType.EntityClass);
  }

  /** Creates an entity class, appends it to {@link SchemaDocument.items}, and returns it. */
  public createEntity(name: string, init?: Authoring.EntityClassInit): Authoring.EntityClass {
    return this._add(new Authoring.EntityClass(name, init));
  }

  /** Creates a mixin, appends it, and returns it. `appliesTo` is the entity class the mixin may be
   * applied to (mandatory data). A mixin defaults to {@link ECClassModifier.Abstract}. */
  public createMixin(name: string, appliesTo: Authoring.LocalOrFullName, init?: Authoring.ClassInit): Authoring.Mixin {
    return this._add(new Authoring.Mixin(name, appliesTo, init));
  }

  /** Creates a struct class, appends it, and returns it. */
  public createStructClass(name: string, init?: Authoring.ClassInit): Authoring.StructClass {
    return this._add(new Authoring.StructClass(name, init));
  }

  /** Creates a custom attribute class, appends it, and returns it. `appliesTo` is the bitmask of
   * container kinds the attribute may be applied to (mandatory data). */
  public createCustomAttributeClass(name: string, appliesTo: CustomAttributeContainerType, init?: Authoring.ClassInit): Authoring.CustomAttributeClass {
    return this._add(new Authoring.CustomAttributeClass(name, appliesTo, init));
  }

  /** Creates a relationship class, appends it, and returns it. Its `source` and `target` constraints
   * are created empty; configure them on the returned handle. */
  public createRelationship(name: string, init?: Authoring.RelationshipClassInit): Authoring.RelationshipClass {
    return this._add(new Authoring.RelationshipClass(name, init));
  }

  /** Creates an enumeration item, appends it, and returns it. `backingType` is the enumeration's
   * backing primitive (`"int"` or `"string"`). Add values with {@link Authoring.Enumeration.createEnumerator}.
   * Note: this creates the enumeration *item*; to add an enumeration-backed *property* to a class use
   * {@link Authoring.ECClass.createEnumeration}. */
  public createEnumeration(name: string, backingType: Authoring.EnumerationBackingType, init?: Authoring.EnumerationInit): Authoring.Enumeration {
    return this._add(new Authoring.Enumeration(name, backingType, init));
  }

  /** Creates a kind of quantity, appends it, and returns it. `persistenceUnit` is the unit reference
   * the KoQ persists in and `relativeError` its conversion tolerance (both mandatory data). */
  public createKindOfQuantity(name: string, persistenceUnit: Authoring.LocalOrFullName, relativeError: number, init?: Authoring.KindOfQuantityInit): Authoring.KindOfQuantity {
    return this._add(new Authoring.KindOfQuantity(name, persistenceUnit, relativeError, init));
  }

  /** Creates a property category, appends it, and returns it. */
  public createPropertyCategory(name: string, init?: Authoring.PropertyCategoryInit): Authoring.PropertyCategory {
    return this._add(new Authoring.PropertyCategory(name, init));
  }

  /** Creates a unit system, appends it, and returns it. */
  public createUnitSystem(name: string, init?: Authoring.SchemaItemInit): Authoring.UnitSystem {
    return this._add(new Authoring.UnitSystem(name, init));
  }

  /** Creates a phenomenon, appends it, and returns it. `definition` is its defining expression
   * (mandatory data). */
  public createPhenomenon(name: string, definition: string, init?: Authoring.SchemaItemInit): Authoring.Phenomenon {
    return this._add(new Authoring.Phenomenon(name, definition, init));
  }

  /** Creates a unit, appends it, and returns it. `phenomenon` and `unitSystem` are item references
   * and `definition` its defining expression (all mandatory data). */
  public createUnit(name: string, phenomenon: Authoring.LocalOrFullName, unitSystem: Authoring.LocalOrFullName, definition: string, init?: Authoring.UnitInit): Authoring.Unit {
    return this._add(new Authoring.Unit(name, phenomenon, unitSystem, definition, init));
  }

  /** Creates an inverted unit, appends it, and returns it. `invertsUnit` references the unit it is
   * the reciprocal of and `unitSystem` the system it belongs to (both mandatory data). */
  public createInvertedUnit(name: string, invertsUnit: Authoring.LocalOrFullName, unitSystem: Authoring.LocalOrFullName, init?: Authoring.SchemaItemInit): Authoring.InvertedUnit {
    return this._add(new Authoring.InvertedUnit(name, invertsUnit, unitSystem, init));
  }

  /** Creates a constant, appends it, and returns it. `phenomenon` is an item reference and
   * `definition` its defining expression (both mandatory data). */
  public createConstant(name: string, phenomenon: Authoring.LocalOrFullName, definition: string, init?: Authoring.ConstantInit): Authoring.Constant {
    return this._add(new Authoring.Constant(name, phenomenon, definition, init));
  }

  /** Creates a format, appends it, and returns it. `type` is the numeric rendering kind (mandatory
   * data). */
  public createFormat(name: string, type: FormatType, init?: Authoring.FormatInit): Authoring.Format {
    return this._add(new Authoring.Format(name, type, init));
  }

  /** Appends a constructed item and returns it - the shared tail of every `create*` factory. */
  private _add<T extends Authoring.AnySchemaItem>(item: T): T {
    this.items.push(item);
    return item;
  }
}

/** Nested authoring types for {@link SchemaDocument}: schema items, properties, and the custom
 * attribute model. All mutable and validity-free, owning their own data. Each type takes its
 * mandatory data positionally and the rest through an optional `init` object.
 * @alpha
 */
export namespace Authoring {
  /** A reference to a schema item, as a plain string. Either a bare local name (`"Pump"` - an item in
   * this same schema) or a full name (`"BisCore:PhysicalElement"`). On input it also tolerates the
   * alias-qualified form (`"bis:PhysicalElement"`) and the dot separator
   * (`"BisCore.PhysicalElement"`). The document is validity-free and resolves nothing,
   * so reference correctness is a compile diagnostic - which is why this is a plain string. */
  export type LocalOrFullName = string;

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
  }

  /** A custom attribute instance: the full name of the CA class it instantiates, plus its property
   * values. The document does not have the CA class definition, so it stores the class as a plain
   * full-name string and an optional property bag, resolving nothing until compile. */
  export interface CustomAttribute {
    /** Full name of the custom attribute class, e.g. `"CoreCustomAttributes.DynamicSchema"`. Either EC
     * separator (`:` or `.`) is accepted and they compare as equal; the class is resolved at compile. */
    className: LocalOrFullName;
    /** Property name -> value. Omitted when the CA carries no values. Values are unvalidated until compile. */
    properties?: { [name: string]: unknown };
  }

  /** An ordered set of custom attribute instances on a container (schema, class, property, or
   * relationship constraint). The spec allows at most one instance per CA class and does not
   * guarantee order on round-trip; this preserves insertion order and, consistent with the
   * validity-free stance, does not reject a second instance of the same class.
   * @alpha
   */
  export class CustomAttributeSet implements Iterable<CustomAttribute> {
    private readonly _items: CustomAttribute[] = [];

    /** The number of custom attribute instances. */
    public get size(): number {
      return this._items.length;
    }

    /** Iterates the custom attribute instances in insertion order. */
    public [Symbol.iterator](): Iterator<CustomAttribute> {
      return this._items[Symbol.iterator]();
    }

    /** Adds a custom attribute instance and returns it, for follow-up configuration in one expression. */
    public add(ca: CustomAttribute): CustomAttribute {
      this._items.push(ca);
      return ca;
    }

    /** Returns the first instance of the named CA class, or `undefined`. Matching is case-insensitive
     * and treats the `:` and `.` separators as equivalent, but compares spellings, not resolved
     * identity: an alias-qualified name (`"bis:HiddenProperty"`) does not match the schema-name form
     * (`"BisCore:HiddenProperty"`) of the same class. */
    public get(className: string): CustomAttribute | undefined {
      const key = foldFullName(className);
      return this._items.find((ca) => foldFullName(ca.className) === key);
    }

    /** True when an instance of the named CA class is present. */
    public has(className: string): boolean {
      return this.get(className) !== undefined;
    }

    /** Removes and returns the first instance of the named CA class, or `undefined`. */
    public remove(className: string): CustomAttribute | undefined {
      const key = foldFullName(className);
      const idx = this._items.findIndex((ca) => foldFullName(ca.className) === key);
      return idx === -1 ? undefined : this._items.splice(idx, 1)[0];
    }

    /** The instances as a plain array, so `JSON.stringify` renders the set transparently. */
    public toJSON(): CustomAttribute[] {
      return [...this._items];
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
   * @alpha
   */
  export abstract class SchemaItem {
    /** Discriminates the item kind. */
    public abstract readonly schemaItemType: SchemaItemType;
    /** The invariant item name. Renaming is a document-level operation (not yet modeled). */
    public readonly name: string;
    /** Optional display label. */
    public label?: string;
    /** Optional description. */
    public description?: string;

    protected constructor(name: string) {
      this.name = name;
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

    /** Narrows to {@link AnyClass} - true for every class kind. */
    public isClass(): this is AnyClass {
      return isSupportedSchemaItemType(this.schemaItemType, AbstractSchemaItemType.Class);
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
  }

  /** Common base of every EC class kind (entity, mixin, struct, custom attribute, relationship). Owns
   * the modifier, the single base-class reference, the custom attributes, and the property collection
   * plus its `create*` factories. Property kinds are valid per-class in the spec (e.g. navigation only
   * on relationship-endpoint classes, structs not recursing) - the document does not enforce that, so
   * every factory is available on every class kind and the compiler reports a misuse.
   * @alpha
   */
  export abstract class ECClass extends SchemaItem {
    /** Abstract / sealed / none. */
    public modifier: ECClassModifier = ECClassModifier.None;
    /** The single base class reference (e.g. `"BisCore:PhysicalElement"`), if any. */
    public baseClass?: LocalOrFullName;
    /** Class-level custom attributes. */
    public readonly customAttributes = new CustomAttributeSet();
    /** This class's own properties in declaration order. Prefer the `create*` factories, which append
     * here and return a handle. */
    public readonly properties: AnyProperty[] = [];

    protected constructor(name: string, init?: ClassInit) {
      super(name);
      if (init) {
        this.label = init.label;
        this.description = init.description;
        if (init.modifier !== undefined)
          this.modifier = init.modifier;
        this.baseClass = init.baseClass;
      }
    }

    /** Returns this class's own property with the given name (case-insensitive), or `undefined`. */
    public getProperty(name: string): AnyProperty | undefined {
      return this.properties.find((p) => namesEqual(p.name, name));
    }

    /** Removes and returns this class's own property with the given name (case-insensitive), or `undefined`. */
    public removeProperty(name: string): AnyProperty | undefined {
      const index = this.properties.findIndex((p) => namesEqual(p.name, name));
      return index === -1 ? undefined : this.properties.splice(index, 1)[0];
    }

    /** Creates a primitive property (keyword type), appends it, and returns it. */
    public createPrimitive(name: string, type: PrimitiveType, init?: PrimitivePropertyInit): PrimitiveProperty {
      return this._addProperty(new PrimitiveProperty(name, type, init));
    }

    /** Creates an enumeration-backed primitive property, appends it, and returns it. `enumeration` is
     * a reference to an `Enumeration` item. Stored the same way as a keyword primitive (one
     * `typeName` field); the separate method just keeps the reference param strongly typed. */
    public createEnumeration(name: string, enumeration: LocalOrFullName, init?: PrimitivePropertyInit): PrimitiveProperty {
      return this._addProperty(new PrimitiveProperty(name, enumeration, init));
    }

    /** Creates a primitive array property (keyword element type), appends it, and returns it. */
    public createPrimitiveArray(name: string, type: PrimitiveType, init?: PrimitiveArrayPropertyInit): PrimitiveArrayProperty {
      return this._addProperty(new PrimitiveArrayProperty(name, type, init));
    }

    /** Creates an enumeration-backed array property, appends it, and returns it. */
    public createEnumerationArray(name: string, enumeration: LocalOrFullName, init?: PrimitiveArrayPropertyInit): PrimitiveArrayProperty {
      return this._addProperty(new PrimitiveArrayProperty(name, enumeration, init));
    }

    /** Creates a struct property, appends it, and returns it. `structClass` is a reference to a
     * `StructClass` item. */
    public createStruct(name: string, structClass: LocalOrFullName, init?: PropertyInit): StructProperty {
      return this._addProperty(new StructProperty(name, structClass, init));
    }

    /** Creates a struct array property, appends it, and returns it. */
    public createStructArray(name: string, structClass: LocalOrFullName, init?: StructArrayPropertyInit): StructArrayProperty {
      return this._addProperty(new StructArrayProperty(name, structClass, init));
    }

    /** Creates a navigation property, appends it, and returns it. `relationship` references the
     * `RelationshipClass` it traverses and `direction` which end it starts from (mandatory data). */
    public createNavigation(name: string, relationship: LocalOrFullName, direction: StrengthDirection, init?: PropertyInit): NavigationProperty {
      return this._addProperty(new NavigationProperty(name, relationship, direction, init));
    }

    /** Appends a constructed property and returns it - the shared tail of every property factory. */
    private _addProperty<T extends AnyProperty>(property: T): T {
      this.properties.push(property);
      return property;
    }
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
    public readonly schemaItemType = SchemaItemType.EntityClass;
    /** Applied mixin references, in declaration order. An entity has at most one {@link ECClass.baseClass};
     * mixins are separate. Note that, lacking validation, after XML deserialization a mixin may land in
     * `baseClass` instead (the deserializer cannot tell them apart) when there is no other base class;
     * the compiler corrects this. */
    public readonly mixins: LocalOrFullName[] = [];

    /** Creates an entity class. `name` is the only mandatory argument; `init` carries the rest. */
    public constructor(name: string, init?: EntityClassInit) {
      super(name, init);
      if (init?.mixins)
        this.mixins.push(...init.mixins);
    }
  }

  /** A mixin: an abstract class mixed into entity classes. In ECXML 3.2 it is an entity class carrying
   * an `IsMixin` custom attribute; the document promotes it to a first-class kind.
   * @alpha
   */
  export class Mixin extends ECClass {
    public readonly schemaItemType = SchemaItemType.Mixin;
    /** The entity class (including its derived classes) that this mixin may be applied to. (3.2: `IsMixin.AppliesToEntityClass`). */
    public appliesTo: LocalOrFullName;

    /** Creates a mixin. `appliesTo` is mandatory. A mixin is always abstract, so the modifier defaults
     * to {@link ECClassModifier.Abstract}. */
    public constructor(name: string, appliesTo: LocalOrFullName, init?: ClassInit) {
      super(name, init);
      this.appliesTo = appliesTo;
      if (init?.modifier === undefined)
        this.modifier = ECClassModifier.Abstract;
    }
  }

  /** A struct class - the type of a struct (or struct-array) property's embedded value.
   * @alpha
   */
  export class StructClass extends ECClass {
    public readonly schemaItemType = SchemaItemType.StructClass;

    /** Creates a struct class. `name` is the only mandatory argument; `init` carries the rest. */
    public constructor(name: string, init?: ClassInit) {
      super(name, init);
    }
  }

  /** A custom attribute class - the definition a {@link CustomAttribute} instance instantiates.
   * @alpha
   */
  export class CustomAttributeClass extends ECClass {
    public readonly schemaItemType = SchemaItemType.CustomAttributeClass;
    /** Bitmask of container kinds an instance of this class may be applied to. The wire form is a
     * delimited string; this is the parsed flags value. */
    public appliesTo: CustomAttributeContainerType;

    /** Creates a custom attribute class. `appliesTo` is mandatory. */
    public constructor(name: string, appliesTo: CustomAttributeContainerType, init?: ClassInit) {
      super(name, init);
      this.appliesTo = appliesTo;
    }
  }

  /** Complementary data accepted by the {@link RelationshipClass} constructor. The two constraints are
   * not here - they are created empty and configured on the returned handle. */
  export interface RelationshipClassInit extends ClassInit {
    strength?: StrengthType;
    strengthDirection?: StrengthDirection;
  }

  /** One end (source or target) of a relationship. Not a schema item - it is owned by its
   * {@link RelationshipClass}. A constraint is a custom attribute container, but unlike classes and
   * properties it does not inherit CAs from a base relationship's constraint.
   * @alpha
   */
  export class RelationshipConstraint {
    /** Which end of the relationship this constraint describes. */
    public readonly relationshipEnd: RelationshipEnd;
    /** Multiplicity as an `(lo..hi)` string (e.g. `"(0..1)"`, `"(1..*)"`). */
    public multiplicity: string = "(0..*)";
    /** Role label. The spec requires it; the document leaves it optional and defers to the compiler. */
    public roleLabel?: string;
    /** Whether the constraint matches derived classes of its constraint classes. */
    public polymorphic: boolean = true;
    /** The common base/abstract constraint, required when there is more than one constraint class and
     * none is inherited. */
    public abstractConstraint?: LocalOrFullName;
    /** Constraint class references (at least one is required by the spec). */
    public readonly constraintClasses: LocalOrFullName[] = [];
    /** Constraint-level custom attributes. */
    public readonly customAttributes = new CustomAttributeSet();

    public constructor(relationshipEnd: RelationshipEnd) {
      this.relationshipEnd = relationshipEnd;
    }
  }

  /** A relationship class relating instances of its source and target constraint classes.
   * @alpha
   */
  export class RelationshipClass extends ECClass {
    public readonly schemaItemType = SchemaItemType.RelationshipClass;
    /** How the lifetimes of source and target are related. Defaults to {@link StrengthType.Referencing}. */
    public strength: StrengthType = StrengthType.Referencing;
    /** Which end is the starting point. Defaults to {@link StrengthDirection.Forward}. */
    public strengthDirection: StrengthDirection = StrengthDirection.Forward;
    /** The source end. */
    public readonly source = new RelationshipConstraint(RelationshipEnd.Source);
    /** The target end. */
    public readonly target = new RelationshipConstraint(RelationshipEnd.Target);

    /** Creates a relationship class. `init` carries strength / direction and the shared class fields;
     * the constraints start empty. */
    public constructor(name: string, init?: RelationshipClassInit) {
      super(name, init);
      if (init?.strength !== undefined)
        this.strength = init.strength;
      if (init?.strengthDirection !== undefined)
        this.strengthDirection = init.strengthDirection;
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
  }

  /** An enumeration: a named set of `int` or `string` values.
   * @alpha
   */
  export class Enumeration extends SchemaItem {
    public readonly schemaItemType = SchemaItemType.Enumeration;
    /** Backing primitive - `"int"` or `"string"`; the enumerators' values must match. */
    public backingType: EnumerationBackingType;
    /** When `false`, undeclared values are allowed. */
    public isStrict: boolean = true;
    /** The declared values in declaration order. */
    public readonly enumerators: Enumerator[] = [];

    /** Creates an enumeration. `backingType` is mandatory; `init` carries the rest. */
    public constructor(name: string, backingType: EnumerationBackingType, init?: EnumerationInit) {
      super(name);
      this.backingType = backingType;
      if (init) {
        this.label = init.label;
        this.description = init.description;
        if (init.isStrict !== undefined)
          this.isStrict = init.isStrict;
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
    public readonly schemaItemType = SchemaItemType.KindOfQuantity;
    /** The unit reference the quantity persists in (e.g. `"Units:M"`). */
    public persistenceUnit: LocalOrFullName;
    /** Conversion tolerance, as the ratio of absolute error to actual value (`0.001` reads
     * "accurate to one part in a thousand"). */
    public relativeError: number;
    /** Presentation format override strings, in declaration order; the first is the default presentation. */
    public readonly presentationFormats: string[] = [];

    /** Creates a kind of quantity. `persistenceUnit` and `relativeError` are mandatory; `init` carries the rest. */
    public constructor(name: string, persistenceUnit: LocalOrFullName, relativeError: number, init?: KindOfQuantityInit) {
      super(name);
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
    public readonly schemaItemType = SchemaItemType.PropertyCategory;
    /** Display sort order. */
    public priority?: number;

    /** Creates a property category. `name` is the only mandatory argument; `init` carries the rest. */
    public constructor(name: string, init?: PropertyCategoryInit) {
      super(name);
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
    public readonly schemaItemType = SchemaItemType.UnitSystem;

    /** Creates a unit system. `name` is the only mandatory argument; `init` carries the rest. */
    public constructor(name: string, init?: SchemaItemInit) {
      super(name);
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
    public readonly schemaItemType = SchemaItemType.Phenomenon;
    /** Defining expression in terms of other phenomena (e.g. `"LENGTH(2)"` for area,
     * `"FORCE*LENGTH(-2)"` for pressure), or the phenomenon's own name for a base
     * phenomenon (e.g. `"LENGTH"`). */
    public definition: string;

    /** Creates a phenomenon. `definition` is mandatory; `init` carries the rest. */
    public constructor(name: string, definition: string, init?: SchemaItemInit) {
      super(name);
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
    public readonly schemaItemType = SchemaItemType.Unit;
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

    /** Creates a unit. `phenomenon`, `unitSystem`, and `definition` are mandatory; `init` carries the rest. */
    public constructor(name: string, phenomenon: LocalOrFullName, unitSystem: LocalOrFullName, definition: string, init?: UnitInit) {
      super(name);
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
  }

  /** An inverted unit: the reciprocal of another unit, for quantities conventionally stated both
   * ways (e.g. a slope as horizontal-per-vertical inverting vertical-per-horizontal). It derives its
   * phenomenon and conversion from the unit it inverts, so unlike {@link Unit} it carries no
   * definition of its own.
   * @alpha
   */
  export class InvertedUnit extends SchemaItem {
    public readonly schemaItemType = SchemaItemType.InvertedUnit;
    /** Reference to the {@link Unit} this unit is the reciprocal of. */
    public invertsUnit: LocalOrFullName;
    /** Reference to the {@link UnitSystem} this unit belongs to. */
    public unitSystem: LocalOrFullName;

    /** Creates an inverted unit. `invertsUnit` and `unitSystem` are mandatory; `init` carries the rest. */
    public constructor(name: string, invertsUnit: LocalOrFullName, unitSystem: LocalOrFullName, init?: SchemaItemInit) {
      super(name);
      this.invertsUnit = invertsUnit;
      this.unitSystem = unitSystem;
      if (init) {
        this.label = init.label;
        this.description = init.description;
      }
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
    public readonly schemaItemType = SchemaItemType.Constant;
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

    /** Creates a constant. `phenomenon` and `definition` are mandatory; `init` carries the rest. */
    public constructor(name: string, phenomenon: LocalOrFullName, definition: string, init?: ConstantInit) {
      super(name);
      this.phenomenon = phenomenon;
      this.definition = definition;
      if (init) {
        this.label = init.label;
        this.description = init.description;
        this.numerator = init.numerator;
        this.denominator = init.denominator;
      }
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
    /** Separator between the unit segments. Empty or a single character; `undefined` reads as `" "`. */
    spacer?: string;
    /** Whether zero-magnitude segments are rendered. `undefined` reads as `true`. */
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
   * formatting library and a compile diagnostic reports them on a schema format.
   * @alpha
   */
  export class Format extends SchemaItem {
    public readonly schemaItemType = SchemaItemType.Format;
    /** The numeric rendering kind (decimal, fractional, scientific, station). */
    public type: FormatType;
    /** Precision of the numeric part: a {@link DecimalPrecision} (decimal places) for decimal-based
     * types, a {@link FractionalPrecision} (fraction denominator) for fractional. `undefined` reads
     * as the type's spec default. */
    public precision?: DecimalPrecision | FractionalPrecision;
    /** Rounding factor applied when the {@link FormatTraits.ApplyRounding} trait is set; `0` rounds
     * to precision. `undefined` reads as `0`. */
    public roundFactor?: number;
    /** Minimum width of the formatted string, padded to fit; `undefined` pads nothing. */
    public minWidth?: number;
    /** How the sign of the value is rendered. `undefined` reads as {@link ShowSignOption.OnlyNegative}. */
    public showSignOption?: ShowSignOption;
    /** Bitmask of rendering traits ({@link FormatTraits.ShowUnitLabel}, ...). The wire form is a
     * delimited string; this is the parsed flags value. `undefined` reads as no traits, same as
     * {@link FormatTraits.Uninitialized} (`0`). */
    public formatTraits?: FormatTraits;
    /** Separator between the integer and fractional digits. Empty or a single character;
     * `undefined` reads as `"."`. */
    public decimalSeparator?: string;
    /** Separator grouping the integer digits by thousands, rendered only with the
     * {@link FormatTraits.Use1000Separator} trait. Empty or a single character; `undefined` reads as `","`. */
    public thousandSeparator?: string;
    /** Separator between the value and the unit label. Empty or a single character; `undefined`
     * reads as `" "`. */
    public uomSeparator?: string;
    /** Scientific notation variant; the spec requires it when {@link Format.type} is scientific. */
    public scientificType?: ScientificType;
    /** Number of digits right of the station separator; the spec requires it when
     * {@link Format.type} is station. */
    public stationOffsetSize?: number;
    /** Separator between the station and offset digits (`"3+25"`). Empty or a single character;
     * `undefined` reads as `"+"`. */
    public stationSeparator?: string;
    /** The composite specification splitting the value across multiple units, if any. */
    public composite?: FormatComposite;

    /** Creates a format. `type` is mandatory; `init` carries the rest. */
    public constructor(name: string, type: FormatType, init?: FormatInit) {
      super(name);
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
  }

  /** Common base of every property kind. `kind` is the discriminant for narrowing.
   * @alpha
   */
  export abstract class Property {
    /** Discriminates the property kind. */
    public abstract readonly kind: PropertyKind;
    /** The invariant property name. */
    public readonly name: string;
    /** Optional display label. */
    public label?: string;
    /** Optional description. */
    public description?: string;
    /** Whether the property is read-only. */
    public isReadOnly?: boolean;
    /** Display priority. */
    public priority?: number;
    /** Reference to a PropertyCategory (e.g. `"MyDomain:Cat"`); resolved at compile. */
    public category?: LocalOrFullName;
    /** Reference to a KindOfQuantity (e.g. `"AecUnits:VOLUMETRIC_FLOW"`); resolved at compile. Only
     * meaningful on primitive / primitive-array properties. */
    public kindOfQuantity?: LocalOrFullName;
    /** Property-level custom attributes. */
    public readonly customAttributes = new CustomAttributeSet();

    protected constructor(name: string, init?: PropertyInit) {
      this.name = name;
      if (init) {
        this.label = init.label;
        this.description = init.description;
        this.isReadOnly = init.isReadOnly;
        this.priority = init.priority;
        this.category = init.category;
        this.kindOfQuantity = init.kindOfQuantity;
      }
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
     * The check is lexical (the primitive keywords are a closed set); the reference itself is only
     * resolved at compile. */
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
   * enumeration reference; the distinction is resolved at compile.
   * @alpha
   */
  export class PrimitiveProperty extends Property {
    public readonly kind = PropertyKind.Primitive;
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

    /** Creates a primitive property. `name` and `type` are mandatory; `type` may be a `PrimitiveType`
     * or an enumeration reference. For enumerations this can be set to their name or
     * full-name (e.g. `"MySchema.MyEnum"` or `"alias.MyEnum"`). `init` carries the rest. */
    public constructor(name: string, type: PrimitiveType | string, init?: PrimitivePropertyInit) {
      super(name, init);
      this.typeName = typeof type === "string" ? type : primitiveTypeToString(type);
      if (init) {
        this.extendedTypeName = init.extendedTypeName;
        this.minValue = init.minValue;
        this.maxValue = init.maxValue;
        this.minLength = init.minLength;
        this.maxLength = init.maxLength;
      }
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
    public readonly kind = PropertyKind.PrimitiveArray;
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
    /** Maximum number of elements; `undefined` means unbounded. */
    public maxOccurs?: number;

    /** Creates a primitive array property. `name` and `type` are mandatory; `init` carries the rest. */
    public constructor(name: string, type: PrimitiveType | string, init?: PrimitiveArrayPropertyInit) {
      super(name, init);
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
  }

  /** A struct property - an embedded instance of a struct class.
   * @alpha
   */
  export class StructProperty extends Property {
    public readonly kind = PropertyKind.Struct;
    /** Reference to the `StructClass` this property embeds. */
    public typeName: LocalOrFullName;

    /** Creates a struct property. `name` and `structClass` are mandatory; `init` carries the rest. */
    public constructor(name: string, structClass: LocalOrFullName, init?: PropertyInit) {
      super(name, init);
      this.typeName = structClass;
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
    public readonly kind = PropertyKind.StructArray;
    /** Reference to the `StructClass` of the array element. */
    public typeName: LocalOrFullName;
    /** Minimum number of elements (default 0). */
    public minOccurs: number = 0;
    /** Maximum number of elements; `undefined` means unbounded. */
    public maxOccurs?: number;

    /** Creates a struct array property. `name` and `structClass` are mandatory; `init` carries the rest. */
    public constructor(name: string, structClass: LocalOrFullName, init?: StructArrayPropertyInit) {
      super(name, init);
      this.typeName = structClass;
      if (init) {
        if (init.minOccurs !== undefined)
          this.minOccurs = init.minOccurs;
        this.maxOccurs = init.maxOccurs;
      }
    }
  }

  /** A navigation property - a reference to a related instance reached through a relationship.
   * @alpha
   */
  export class NavigationProperty extends Property {
    public readonly kind = PropertyKind.Navigation;
    /** Reference to the `RelationshipClass` this property traverses. */
    public relationshipName: LocalOrFullName;
    /** Which end of the relationship this property starts from. */
    public direction: StrengthDirection;

    /** Creates a navigation property. `name`, `relationship`, and `direction` are mandatory; `init`
     * carries the rest. */
    public constructor(name: string, relationship: LocalOrFullName, direction: StrengthDirection, init?: PropertyInit) {
      super(name, init);
      this.relationshipName = relationship;
      this.direction = direction;
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
  export type AnyClass = EntityClass | Mixin | StructClass | CustomAttributeClass | RelationshipClass;

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
}
