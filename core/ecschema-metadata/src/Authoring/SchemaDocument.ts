/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { AbstractSchemaItemType, CustomAttributeContainerType, ECClassModifier, isSupportedSchemaItemType, PrimitiveType, primitiveTypeToString, PropertyKind, RelationshipEnd, SchemaItemType, StrengthDirection, StrengthType } from "../ECObjects";
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
  /** The EC spec version this document was deserialized from (e.g. `"3.2"`), as a hint about its
   * origin. `undefined` for documents created in memory, which are treated as the latest known spec
   * Purely informational */
  public originalECXmlVersionMajor?: number;
  /** Minor version to go along with {@link originalECXmlVersionMajor} version. */
  public originalECXmlVersionMinor?: number;
  /** Points back to the source the schema was deserialized from, e.g., a file path or URL. */
  public source?: string;
  /** Schema references (`name` + `version`, each with its own local `alias`), in declaration order. */
  public readonly references: Authoring.SchemaReference[] = [];
  /** Schema-level custom attributes. */
  public readonly customAttributes = new Authoring.CustomAttributeSet();
  /** The schema items (classes, enumerations, ...) in declaration order. Prefer the `create*` factories
   * ({@link SchemaDocument.createEntity}, ...) which append here and return a handle; the typed
   * accessors below ({@link SchemaDocument.getItemOfType}, ...) read it back. */
  public readonly items: Authoring.AnySchemaItem[] = [];

  /** Creates a new document with the given identity.
   * `init` carries the complementary schema-level data; */
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
      if (init.references)
        this.references.push(...init.references);
    }
  }

  /** A read-only {@link SchemaKey} over this document's current name and version, for matching and
   * comparing against other keys (`matches`, `compareByVersion`, the `SchemaMatchType` rules).
   * A new key is constructed on each access. */
  public get key(): SchemaKey {
    return new SchemaKey(this.name, this.readVersion, this.writeVersion, this.minorVersion);
  }

  /** Adds a schema reference, or replaces the existing reference of the same name (case-insensitive).
   * Returns the stored reference.
   *
   * Pass an explicit {@link Authoring.SchemaReference} to control `name` / `version` / `alias` directly,
   * or pass any {@link Authoring.SchemaReferenceSource} a caller already holds - the reference's `version`
   * is then derived from the source's version components and its `alias` from the source's own alias (the
   * suggested default; set a different `alias` on the returned reference if this document uses one). Both
   * a {@link SchemaDocument} and a `SchemaView` `Schema` satisfy `SchemaReferenceSource` structurally, so
   * either can be passed without this module depending on `SchemaView`. */
  public setSchemaReference(reference: Authoring.SchemaReference): Authoring.SchemaReference;
  public setSchemaReference(source: Authoring.SchemaReferenceSource): Authoring.SchemaReference;
  public setSchemaReference(arg: Authoring.SchemaReference | Authoring.SchemaReferenceSource): Authoring.SchemaReference {
    const reference: Authoring.SchemaReference = "version" in arg
      ? arg
      : { name: arg.name, version: new SchemaKey(arg.name, arg.readVersion, arg.writeVersion, arg.minorVersion).version.toString(), alias: arg.alias };
    const index = this.references.findIndex((r) => namesEqual(r.name, reference.name));
    if (index >= 0)
      this.references[index] = reference;
    else
      this.references.push(reference);
    return reference;
  }

  /** Returns the first item with the given name (case-insensitive), or `undefined`. */
  public getItem(name: string): Authoring.AnySchemaItem | undefined {
    return this.items.find((i) => namesEqual(i.name, name));
  }

  /** Returns the first item with the given name whose kind matches `itemType`, narrowed to that
   * kind's type, or `undefined` (no such name, or a name of a different kind). `itemType` may be a
   * concrete {@link SchemaItemType} or a grouping ({@link AbstractSchemaItemType.Class},
   * {@link AbstractSchemaItemType.SchemaItem}), in which case any member kind matches.
   * Given the large amount of item types we have, this method is to avoid a zoo of getXXX methods. */
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
   * the KoQ persists in (mandatory data). */
  public createKindOfQuantity(name: string, persistenceUnit: Authoring.LocalOrFullName, init?: Authoring.KindOfQuantityInit): Authoring.KindOfQuantity {
    return this._add(new Authoring.KindOfQuantity(name, persistenceUnit, init));
  }

  /** Creates a property category, appends it, and returns it. */
  public createPropertyCategory(name: string, init?: Authoring.PropertyCategoryInit): Authoring.PropertyCategory {
    return this._add(new Authoring.PropertyCategory(name, init));
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
   * (`"BisCore.PhysicalElement"`); The document is validity-free and resolves nothing,
   * so reference correctness is a compile diagnostic - which is why this is a plain string. */
  export type LocalOrFullName = string;

  /** A reference to another schema: invariant `name` + `version`, plus the `alias` this document uses
   * for it within its own scope. */
  export interface SchemaReference {
    name: string;
    version: string;
    /** The alias is `string | null` rather than optional, so skipping it is an explicit decision.
     * Serializing to XML requires an alias on every reference. The JSON format does not carry this field. */
    alias: string | null;
  }

  /** The minimal read shape {@link SchemaDocument.setSchemaReference} needs to derive a
   * {@link SchemaReference} from a schema a caller already holds: its name, alias, and version
   * components. Both {@link SchemaDocument} and a `SchemaView` `Schema` satisfy this structurally, so the
   * convenience works across the read and authoring lanes without this module importing `SchemaView`. */
  export interface SchemaReferenceSource {
    readonly name: string;
    readonly alias: string;
    readonly readVersion: number;
    readonly writeVersion: number;
    readonly minorVersion: number;
  }

  /** Complementary schema-level data accepted by the {@link SchemaDocument} constructor. */
  export interface SchemaDocumentInit {
    label?: string;
    description?: string;
    originalECXmlVersionMajor?: number;
    originalECXmlVersionMinor?: number;
    source?: string;
    references?: SchemaReference[];
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

    /** Adds a custom attribute instance. */
    public add(ca: CustomAttribute): void {
      this._items.push(ca);
    }

    /** Returns the first instance of the named CA class, or `undefined`. Matching is case-insensitive
     * and treats the `:` and `.` separators as equivalent. */
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
  }

  /** Common base of every schema item. `schemaItemType` is the discriminant for narrowing.
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
    public createEnumerator(name: string, value: number | string, init?: { label?: string, description?: string }): Enumerator {
      const enumerator: Enumerator = { name, value, label: init?.label, description: init?.description };
      this.enumerators.push(enumerator);
      return enumerator;
    }
  }

  /** Complementary data accepted by the {@link KindOfQuantity} constructor. */
  export interface KindOfQuantityInit {
    label?: string;
    description?: string;
    /** Conversion tolerance. */
    relativeError?: number;
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
    /** Conversion tolerance. */
    public relativeError?: number;
    /** Presentation format override strings, in declaration order; the first is the default presentation. */
    public readonly presentationFormats: string[] = [];

    /** Creates a kind of quantity. `persistenceUnit` is mandatory; `init` carries the rest. */
    public constructor(name: string, persistenceUnit: LocalOrFullName, init?: KindOfQuantityInit) {
      super(name);
      this.persistenceUnit = persistenceUnit;
      if (init) {
        this.label = init.label;
        this.description = init.description;
        this.relativeError = init.relativeError;
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

  /** Complementary data shared by every property kind's constructor. */
  export interface PropertyInit {
    label?: string;
    description?: string;
    isReadOnly?: boolean;
    priority?: number;
    /** Reference to a PropertyCategory */
    category?: LocalOrFullName;
    /** Reference to a KindOfQuantity (e.g. `"AecUnits:VOLUMETRIC_FLOW"`). Only meaningful on primitive
     * and primitive-array properties (whose values are scalar quantities) */
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

  /** Union of every EC class kind. */
  export type AnyClass = EntityClass | Mixin | StructClass | CustomAttributeClass | RelationshipClass;

  /** Union of every schema item kind modeled so far. The units / formats family (Unit, Format, ...)
   * and View are not modeled yet; this grows as they are added. */
  export type AnySchemaItem = AnyClass | Enumeration | KindOfQuantity | PropertyCategory;

  /** Maps each {@link SchemaItemType} discriminant to its concrete item type, plus the
   * {@link AbstractSchemaItemType} groupings to their union types, so the typed accessors
   * ({@link SchemaDocument.getItemOfType}, {@link SchemaDocument.getItemsOfType}) can narrow either by
   * a single kind or by a grouping (e.g. `Class` for any class kind). Grows as item kinds are added;
   * the units / formats family is not modeled yet. */
  export interface SchemaItemTypeMap {
    [SchemaItemType.EntityClass]: EntityClass;
    [SchemaItemType.Mixin]: Mixin;
    [SchemaItemType.StructClass]: StructClass;
    [SchemaItemType.CustomAttributeClass]: CustomAttributeClass;
    [SchemaItemType.RelationshipClass]: RelationshipClass;
    [SchemaItemType.Enumeration]: Enumeration;
    [SchemaItemType.KindOfQuantity]: KindOfQuantity;
    [SchemaItemType.PropertyCategory]: PropertyCategory;
    [AbstractSchemaItemType.Class]: AnyClass;
    [AbstractSchemaItemType.SchemaItem]: AnySchemaItem;
  }
}
