/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { ECClassModifier, PrimitiveType, primitiveTypeToString, PropertyKind, SchemaItemType } from "../ECObjects";
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
 * ({@link SchemaDocument.items}, {@link Authoring.EntityClass.properties}) and the
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
  /** The schema items (classes, ...) in declaration order. Prefer the `create*` factories
   * ({@link SchemaDocument.createEntity}, ...) which append here and return a handle; the typed
   * accessors below ({@link SchemaDocument.getEntity}, ...) read it back. */
  public readonly items: Authoring.AnySchemaItem[] = [];

  /** Creates a new document with the given identity. The version is passed as its three numeric
   * components; the document is validity-free, so no range checking happens here (out-of-range or
   * all-zero versions are reported at compile). `init` carries the complementary schema-level data;
   * items are added through {@link SchemaDocument.createEntity} (or `items.push`) afterward, and
   * custom attributes through the public {@link SchemaDocument.customAttributes} set. To build a
   * document from a version *string*, parse it with {@link ECVersion.fromString} at the call site
   * (the deserializers do this); the document itself never parses. */
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

  /** The `RR.WW.mm` version, each component zero-padded to two digits. */
  public get version(): string {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(this.readVersion)}.${pad(this.writeVersion)}.${pad(this.minorVersion)}`;
  }

  /** A read-only {@link SchemaKey} over this document's current name and version, for matching and
   * comparing against other keys (`matches`, `compareByVersion`, the `SchemaMatchType` rules).
   * A new key is constructed on each access. */
  public get key(): SchemaKey {
    return new SchemaKey(this.name, this.readVersion, this.writeVersion, this.minorVersion);
  }

  /** Returns the first item with the given name (case-insensitive), or `undefined`. */
  public getItem(name: string): Authoring.AnySchemaItem | undefined {
    return this.items.find((i) => namesEqual(i.name, name));
  }

  /** Returns the first entity class with the given name, or `undefined`. */
  public getEntity(name: string): Authoring.EntityClass | undefined {
    const item = this.getItem(name);
    return item?.schemaItemType === SchemaItemType.EntityClass ? item : undefined;
  }

  /** Iterates every entity class in declaration order. */
  public *getEntities(): Iterable<Authoring.EntityClass> {
    for (const item of this.items) {
      if (item.schemaItemType === SchemaItemType.EntityClass)
        yield item;
    }
  }

  /** Creates an entity class, appends it to {@link SchemaDocument.items}, and returns it. The
   * blessed front door for adding an entity; equivalent to constructing an
   * {@link Authoring.EntityClass} and pushing it, but it hands back the handle to configure. */
  public createEntity(name: string, init?: Authoring.EntityClassInit): Authoring.EntityClass {
    const entity = new Authoring.EntityClass(name, init);
    this.items.push(entity);
    return entity;
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

  /** A reference to another schema: invariant `name` + `version`, plus this document's local `alias`
   * for it (used to qualify references to that schema's items). */
  export interface SchemaReference {
    name: string;
    version: string;
    alias?: string;
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

  /** An ordered set of custom attribute instances on a container (schema, class, or property). The
   * spec allows at most one instance per CA class and does not guarantee order on round-trip; this
   * preserves insertion order and, consistent with the validity-free stance, does not reject a
   * second instance of the same class.
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

  /** Complementary data accepted by the {@link EntityClass} constructor. */
  export interface EntityClassInit {
    modifier?: ECClassModifier;
    label?: string;
    description?: string;
    /** The single base class reference, if any. */
    baseClass?: LocalOrFullName;
    /** Applied mixin references, in declaration order. */
    mixins?: LocalOrFullName[];
  }

  /** An entity class. Holds primitive properties in 1c-1; other property kinds follow.
   * @alpha
   */
  export class EntityClass extends SchemaItem {
    public readonly schemaItemType = SchemaItemType.EntityClass;
    /** Abstract / sealed / none. */
    public modifier: ECClassModifier = ECClassModifier.None;
    /** The single base class reference (e.g. `"BisCore:PhysicalElement"`), if any. An entity has at
     * most one base class; applied mixins live in {@link EntityClass.mixins}. Due to lack of validation
     * this baseClass may actually refer to the first mixin after xml deserialization, if there is no other base class. */
    public baseClass?: LocalOrFullName;
    /** Applied mixin references, in declaration order. */
    public readonly mixins: LocalOrFullName[] = [];
    /** Class-level custom attributes. */
    public readonly customAttributes = new CustomAttributeSet();
    /** This class's own properties in declaration order. Prefer the `create*` factories, which
     * append here and return a handle. */
    public readonly properties: AnyProperty[] = [];

    /** Creates an entity class. `name` is the only mandatory argument; `init` carries the rest. */
    public constructor(name: string, init?: EntityClassInit) {
      super(name);
      if (init) {
        this.label = init.label;
        this.description = init.description;
        if (init.modifier !== undefined)
          this.modifier = init.modifier;
        this.baseClass = init.baseClass;
        if (init.mixins)
          this.mixins.push(...init.mixins);
      }
    }

    /** Returns this class's own property with the given name (case-insensitive), or `undefined`. */
    public getProperty(name: string): AnyProperty | undefined {
      return this.properties.find((p) => namesEqual(p.name, name));
    }

    /** Creates a primitive property (keyword type), appends it, and returns it. */
    public createPrimitive(name: string, type: PrimitiveType, init?: PrimitivePropertyInit): PrimitiveProperty {
      const prop = new PrimitiveProperty(name, type, init);
      this.properties.push(prop);
      return prop;
    }

    /** Creates an enumeration-backed primitive property, appends it, and returns it. `enumeration` is
     * a reference to an `Enumeration` item. Stored the same way as a keyword primitive (one
     * `typeName` field); the separate method just keeps the reference param strongly typed. */
    public createEnumeration(name: string, enumeration: LocalOrFullName, init?: PrimitivePropertyInit): PrimitiveProperty {
      const prop = new PrimitiveProperty(name, enumeration, init);
      this.properties.push(prop);
      return prop;
    }

    /** Creates a primitive array property (keyword element type), appends it, and returns it. */
    public createPrimitiveArray(name: string, type: PrimitiveType, init?: PrimitiveArrayPropertyInit): PrimitiveArrayProperty {
      const prop = new PrimitiveArrayProperty(name, type, init);
      this.properties.push(prop);
      return prop;
    }

    /** Creates an enumeration-backed array property, appends it, and returns it. */
    public createEnumerationArray(name: string, enumeration: LocalOrFullName, init?: PrimitiveArrayPropertyInit): PrimitiveArrayProperty {
      const prop = new PrimitiveArrayProperty(name, enumeration, init);
      this.properties.push(prop);
      return prop;
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
    /** Reference to a KindOfQuantity (e.g. `"AecUnits:VOLUMETRIC_FLOW"`). */
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
    /** Reference to a KindOfQuantity (e.g. `"AecUnits:VOLUMETRIC_FLOW"`); resolved at compile. */
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

  /** Union of every property kind. Grows as kinds are added. */
  export type AnyProperty = PrimitiveProperty | PrimitiveArrayProperty;

  /** Union of every schema item kind. Grows as kinds are added. */
  export type AnySchemaItem = EntityClass;
}
