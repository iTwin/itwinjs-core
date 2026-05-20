/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { type ClassData, ClassModifier, ClassType, type EnumerationData, type EnumeratorData, type KoqData, type PropCategoryData, type PropertyDef, PropertyKind, type PropertyRef, type RelConstraintData, type SchemaData, SchemaViewPrimitiveType } from "./SchemaViewInterfaces";
import { parseSchemaViewBlob } from "./SchemaViewBinaryReader";
import { StrengthDirection, StrengthType } from "./ECObjects";

// Module-local symbol used as the storage key on SchemaView instances. Mirrors the pattern in
// core-backend/src/internal/Symbols.ts (e.g. `_nativeDb` on IModelDb): the data is reachable
// only by code in this module, since the symbol is not exported and not registered globally.
// The flyweight view classes (SchemaView.Schema, SchemaView.Class, etc.) live in the same file
// and access the storage through this symbol.
const _storage = Symbol("SchemaView.storage");

/** Internal runtime storage attached to a SchemaView instance. Carries the immutable data
 * tables built by SchemaViewBuilder plus two mutable caches populated lazily at runtime.
 * @internal
 */
interface SchemaViewStorage extends SchemaViewData {
  readonly transitiveBaseCache: Map<number, ReadonlySet<number>>;
  derivedClassMap: ReadonlyMap<number, readonly number[]> | undefined;
}

/** A property reference paired with the index of the class that declared it. Used for
 * property inheritance resolution - the classIdx tracks where each property originates
 * (base class, mixin, or own) so consumers can discover the declaring class.
 * @internal
 */
export interface ResolvedPropertyRef {
  readonly ref: PropertyRef;
  readonly classIdx: number;
}

/** Internal data bag passed from the builder to the context constructor.
 * @internal
 */
export interface SchemaViewData {
  readonly strings: readonly string[];
  readonly lowerStrings: readonly string[];
  readonly schemas: readonly SchemaData[];
  readonly classes: readonly ClassData[];
  readonly classMixins: readonly number[];
  readonly propDefs: readonly PropertyDef[];
  readonly propertyRefs: readonly PropertyRef[];
  readonly relConstraints: readonly RelConstraintData[];
  readonly constraintClassRefs: readonly number[];
  readonly enumerations: readonly EnumerationData[];
  readonly enumerators: readonly EnumeratorData[];
  readonly koqs: readonly KoqData[];
  readonly propCategories: readonly PropCategoryData[];
  readonly schemaByName: ReadonlyMap<string, number>;
  readonly schemaByAlias: ReadonlyMap<string, number>;
  readonly classByName: ReadonlyMap<number, ReadonlyMap<string, number>>;
  readonly enumByName: ReadonlyMap<number, ReadonlyMap<string, number>>;
  readonly koqByName: ReadonlyMap<number, ReadonlyMap<string, number>>;
  readonly catByName: ReadonlyMap<number, ReadonlyMap<string, number>>;
}

/** Read-only schema metadata view. Optimized for fast lookup and low memory usage.
 *
 * All data is stored in flat arrays. View objects (`SchemaView.Schema`, `SchemaView.Class`, etc.) are
 * stateless wrappers that hold a reference to this view plus an index. They allocate nothing
 * and cache nothing.
 *
 * The view is immutable after construction. Build it via `SchemaViewBuilder` or parse
 * from a binary blob via `fromBinary`.
 * @beta
 */
export class SchemaView {
  /** @internal */
  public readonly [_storage]: SchemaViewStorage;

  private _schemaToken: string;
  private _outdated = false;

  /** @internal */
  constructor(data: SchemaViewData, schemaToken?: string) {
    this[_storage] = {
      ...data,
      transitiveBaseCache: new Map<number, ReadonlySet<number>>(),
      derivedClassMap: undefined,
    };
    this._schemaToken = schemaToken ?? "";
  }

  /** SHA3-256 content hash of the ec_ schema tables at the time this view was built.
   * Empty string if not set (e.g., when built from a builder without a token).
   * @beta
   */
  public get schemaToken(): string { return this._schemaToken; }

  /** True if the host (`IModelDb` / `IModelConnection`) has replaced this view with a newer one.
   * The view remains fully functional - it returns stale data rather than throwing.
   * Consumers who stored a reference can check this flag for diagnostics.
   * @beta
   */
  public get isOutdated(): boolean { return this._outdated; }

  /** Mark this view as outdated. Called by the host when a newer view replaces it.
   * @internal
   */
  public markOutdated(): void { this._outdated = true; }

  /** Number of schemas in the view. */
  public get schemaCount(): number { return this[_storage].schemas.length; }

  /** Number of classes across all schemas. */
  public get classCount(): number { return this[_storage].classes.length; }

  /** Get a schema by name (case-insensitive). */
  public getSchema(name: string): SchemaView.Schema | undefined {
    const idx = this[_storage].schemaByName.get(name.toLowerCase());
    return idx !== undefined ? new SchemaView.Schema(this, idx) : undefined;
  }

  /** Get a schema by alias (case-insensitive). */
  public getSchemaByAlias(alias: string): SchemaView.Schema | undefined {
    const idx = this[_storage].schemaByAlias.get(alias.toLowerCase());
    return idx !== undefined ? new SchemaView.Schema(this, idx) : undefined;
  }

  /** Iterate all schemas. */
  public *getSchemas(): IterableIterator<SchemaView.Schema> {
    for (let i = 0; i < this[_storage].schemas.length; i++)
      yield new SchemaView.Schema(this, i);
  }

  /** Find a class by qualified name ("SchemaName:ClassName" or "SchemaName.ClassName").
   * The namespace part matches schema name first, then alias. Case-insensitive.
   */
  public findClass(qualifiedName: string): SchemaView.Class | undefined {
    const idx = this.resolveClassIdx(qualifiedName);
    return idx !== -1 ? SchemaView.createClass(this, idx) : undefined;
  }

  /** Find a class with `ClassType.View` by qualified name ("SchemaName:ViewName" or "SchemaName.ViewName").
   * Convenience method - equivalent to `findClass()` with a type check.
   */
  public findView(qualifiedName: string): SchemaView.Class | undefined {
    const cls = this.findClass(qualifiedName);
    return cls !== undefined && cls.isView() ? cls : undefined;
  }

  /** Find an enumeration by qualified name ("SchemaName:EnumName" or "SchemaName.EnumName").
   * The namespace part matches schema name first, then alias. Case-insensitive.
   */
  public findEnumeration(qualifiedName: string): SchemaView.Enumeration | undefined {
    const idx = this._resolveSchemaItemIdx(qualifiedName, this[_storage].enumByName);
    return idx !== undefined ? new SchemaView.Enumeration(this, idx) : undefined;
  }

  /** Find a KindOfQuantity by qualified name ("SchemaName:KoqName" or "SchemaName.KoqName").
   * The namespace part matches schema name first, then alias. Case-insensitive.
   */
  public findKindOfQuantity(qualifiedName: string): SchemaView.KindOfQuantity | undefined {
    const idx = this._resolveSchemaItemIdx(qualifiedName, this[_storage].koqByName);
    return idx !== undefined ? new SchemaView.KindOfQuantity(this, idx) : undefined;
  }

  /** Find a PropertyCategory by qualified name ("SchemaName:CategoryName" or "SchemaName.CategoryName").
   * The namespace part matches schema name first, then alias. Case-insensitive.
   */
  public findPropertyCategory(qualifiedName: string): SchemaView.PropertyCategory | undefined {
    const idx = this._resolveSchemaItemIdx(qualifiedName, this[_storage].catByName);
    return idx !== undefined ? new SchemaView.PropertyCategory(this, idx) : undefined;
  }

  /** Parse a binary blob into a SchemaView. Synchronous.
   * @param blob - The binary blob from `PRAGMA schema_view`.
   * @param schemaToken - Optional SHA3-256 content hash for cache invalidation.
   * @beta
   */
  public static fromBinary(blob: Uint8Array, schemaToken?: string): SchemaView {
    return parseSchemaViewBlob(blob, schemaToken);
  }

  /** Build from a pre-populated builder (used by the binary parser).
   * @internal
   */
  public static fromBuilder(builder: SchemaViewBuilder, schemaToken?: string): SchemaView {
    return builder.build(schemaToken);
  }

  // --- Internal helpers used by view objects ---

  /** Resolve a qualified "SchemaName:ItemName" (or dot-separated) to an index using the given
   * per-schema name map. Returns undefined if not found. @internal */
  private _resolveSchemaItemIdx(qualifiedName: string, itemByName: ReadonlyMap<number, ReadonlyMap<string, number>>): number | undefined {
    const sep = qualifiedName.indexOf(":");
    const dotSep = sep === -1 ? qualifiedName.indexOf(".") : -1;
    const splitAt = sep !== -1 ? sep : dotSep;
    if (splitAt === -1) return undefined;

    const ns = qualifiedName.substring(0, splitAt).toLowerCase();
    const itemName = qualifiedName.substring(splitAt + 1).toLowerCase();

    let schemaIdx = this[_storage].schemaByName.get(ns);
    if (schemaIdx === undefined)
      schemaIdx = this[_storage].schemaByAlias.get(ns);
    if (schemaIdx === undefined) return undefined;

    return itemByName.get(schemaIdx)?.get(itemName);
  }

  /** @internal */
  public resolveClassIdx(qualifiedName: string): number {
    const sep = qualifiedName.indexOf(":");
    const dotSep = sep === -1 ? qualifiedName.indexOf(".") : -1;
    const splitAt = sep !== -1 ? sep : dotSep;
    if (splitAt === -1) return -1;

    const ns = qualifiedName.substring(0, splitAt).toLowerCase();
    const cn = qualifiedName.substring(splitAt + 1).toLowerCase();

    let schemaIdx = this[_storage].schemaByName.get(ns);
    if (schemaIdx === undefined)
      schemaIdx = this[_storage].schemaByAlias.get(ns);
    if (schemaIdx === undefined) return -1;

    const classMap = this[_storage].classByName.get(schemaIdx);
    const classIdx = classMap?.get(cn);
    return classIdx ?? -1;
  }

  /** @internal */
  public getTransitiveBases(classIdx: number): ReadonlySet<number> {
    const cached = this[_storage].transitiveBaseCache.get(classIdx);
    if (cached !== undefined) return cached;

    const result = new Set<number>();
    this._buildTransitiveBases(classIdx, result);
    this[_storage].transitiveBaseCache.set(classIdx, result);
    return result;
  }

  private _buildTransitiveBases(classIdx: number, result: Set<number>): void {
    const cls = this[_storage].classes[classIdx];
    if (cls === undefined) return; // safety: dangling index from excluded schema

    if (cls.baseClassIdx !== -1 && !result.has(cls.baseClassIdx)) {
      result.add(cls.baseClassIdx);
      this._buildTransitiveBases(cls.baseClassIdx, result);
    }

    for (let i = 0; i < cls.mixinCount; i++) {
      const mixinIdx = this[_storage].classMixins[cls.mixinStartIdx + i];
      if (mixinIdx === -1 || mixinIdx === undefined) continue; // safety: dangling mixin ref
      if (!result.has(mixinIdx)) {
        result.add(mixinIdx);
        this._buildTransitiveBases(mixinIdx, result);
      }
    }
  }

  /** @internal */
  public resolveAllProperties(classIdx: number): readonly ResolvedPropertyRef[] {
    const cls = this[_storage].classes[classIdx];

    if (cls.type === ClassType.View) {
      // Views don't participate in property inheritance - own properties only
      const result: ResolvedPropertyRef[] = [];
      for (let i = 0; i < cls.ownPropCount; i++) {
        const ref = this[_storage].propertyRefs[cls.ownPropStart + i];
        result.push({ ref, classIdx: -1 });
      }
      return result;
    }

    const merged = new Map<string, ResolvedPropertyRef>();
    this._collectProperties(classIdx, merged);
    return Array.from(merged.values());
  }

  private _collectProperties(
    classIdx: number,
    merged: Map<string, ResolvedPropertyRef>,
  ): void {
    const cls = this[_storage].classes[classIdx];
    if (cls === undefined) return; // safety: dangling index from excluded schema

    // 1. Base class (recursive, depth-first)
    if (cls.baseClassIdx !== -1)
      this._collectProperties(cls.baseClassIdx, merged);

    // 2. Mixins in declaration order
    for (let i = 0; i < cls.mixinCount; i++) {
      const mixinIdx = this[_storage].classMixins[cls.mixinStartIdx + i];
      if (mixinIdx === -1 || mixinIdx === undefined) continue; // safety: dangling mixin ref
      this._collectMixinProperties(mixinIdx, merged);
    }

    // 3. Own properties - always override
    for (let i = 0; i < cls.ownPropCount; i++) {
      const ref = this[_storage].propertyRefs[cls.ownPropStart + i];
      const nameKey = this[_storage].lowerStrings[this[_storage].propDefs[ref.defIdx].nameStringIdx];
      merged.set(nameKey, { ref, classIdx });
    }
  }

  private _collectMixinProperties(
    mixinIdx: number,
    merged: Map<string, ResolvedPropertyRef>,
  ): void {
    const mixin = this[_storage].classes[mixinIdx];
    if (mixin === undefined) return; // safety: dangling index from excluded schema

    // Walk mixin's own base chain (mixins can extend other mixins)
    if (mixin.baseClassIdx !== -1)
      this._collectMixinProperties(mixin.baseClassIdx, merged);

    // Mixin's own mixins
    for (let i = 0; i < mixin.mixinCount; i++) {
      const subMixinIdx = this[_storage].classMixins[mixin.mixinStartIdx + i];
      if (subMixinIdx === -1 || subMixinIdx === undefined) continue; // safety: dangling mixin ref
      this._collectMixinProperties(subMixinIdx, merged);
    }

    // Mixin's own properties - only set if not already present (first mixin wins)
    for (let i = 0; i < mixin.ownPropCount; i++) {
      const ref = this[_storage].propertyRefs[mixin.ownPropStart + i];
      const nameKey = this[_storage].lowerStrings[this[_storage].propDefs[ref.defIdx].nameStringIdx];
      if (!merged.has(nameKey))
        merged.set(nameKey, { ref, classIdx: mixinIdx });
    }
  }

  /** @internal */
  public buildDerivedClassMap(): ReadonlyMap<number, readonly number[]> {
    if (this[_storage].derivedClassMap !== undefined) return this[_storage].derivedClassMap;

    const map = new Map<number, number[]>();
    for (let i = 0; i < this[_storage].classes.length; i++) {
      const baseIdx = this[_storage].classes[i].baseClassIdx;
      if (baseIdx !== -1) {
        let arr = map.get(baseIdx);
        if (arr === undefined) {
          arr = [];
          map.set(baseIdx, arr);
        }
        arr.push(i);
      }
    }
    this[_storage].derivedClassMap = map;
    return map;
  }
}

// =====================================================================================
// SchemaView namespace - flyweight view types
// =====================================================================================


/** @beta */
export namespace SchemaView {

  /** Lightweight view over a schema in a `SchemaView`. Holds only a view reference and
   * an index - no data duplication, no mutable state.
   * @beta
   */
  export class Schema {
    /** @internal */
    constructor(
      private readonly _ctx: SchemaView,
      /** @internal */ public readonly idx: number,
    ) { }

    private get _data() { return this._ctx[_storage].schemas[this.idx]; }

    /** Row ID from ec_Schema. Matches `ECInstanceId` in ECDbMeta views, e.g.
     * `SELECT * FROM meta.ECSchemaDef WHERE ECInstanceId = ?`.
     *
     * This is not an array index or internal handle - it is the database row ID from the ec_Schema
     * table, carried through the binary blob so consumers can fall back to ECSQL meta-queries for
     * data not included in the schema view (custom attributes, schema references, etc.).
     */
    public get ecInstanceId(): number { return this._data.ecInstanceId; }
    public get name(): string { return this._ctx[_storage].strings[this._data.nameStringIdx]; }
    public get alias(): string { return this._ctx[_storage].strings[this._data.aliasStringIdx]; }
    public get label(): string {
      const sid = this._data.labelStringIdx;
      return sid !== 0 ? this._ctx[_storage].strings[sid] : this.name;
    }
    public get description(): string {
      const sid = this._data.descriptionStringIdx;
      return sid !== 0 ? this._ctx[_storage].strings[sid] : "";
    }
    public get readVersion(): number { return this._data.versionRead; }
    public get writeVersion(): number { return this._data.versionWrite; }
    public get minorVersion(): number { return this._data.versionMinor; }

    /** Reflects the `HiddenSchema` custom attribute from `CoreCustomAttributes`.
     * Schemas marked hidden are typically excluded from UI display but remain accessible programmatically. */
    public get isHidden(): boolean { return this._data.isHidden; }

    /** "SchemaName.RR.WW.mm" - dot-separated, matching the EC schema versioning convention. */
    public get fullName(): string {
      const d = this._data;
      return `${this._ctx[_storage].strings[d.nameStringIdx]}.${String(d.versionRead).padStart(2, "0")}.${String(d.versionWrite).padStart(2, "0")}.${String(d.versionMinor).padStart(2, "0")}`;
    }

    /** Find a class by name within this schema (case-insensitive). */
    public getClass(name: string): Class | undefined {
      const classMap = this._ctx[_storage].classByName.get(this.idx);
      const classIdx = classMap?.get(name.toLowerCase());
      return classIdx !== undefined ? createClass(this._ctx, classIdx) : undefined;
    }

    /** Iterate all classes in this schema (excluding views - use `getViews()` for those). */
    public *getClasses(): IterableIterator<Class> {
      const d = this._data;
      for (let i = d.classRangeStart; i < d.classRangeStart + d.classCount; i++) {
        if (this._ctx[_storage].classes[i].type !== ClassType.View)
          yield createClass(this._ctx, i);
      }
    }

    /** Find an enumeration by name within this schema (case-insensitive). */
    public getEnumeration(name: string): Enumeration | undefined {
      const map = this._ctx[_storage].enumByName.get(this.idx);
      const idx = map?.get(name.toLowerCase());
      return idx !== undefined ? new Enumeration(this._ctx, idx) : undefined;
    }

    /** Find a KindOfQuantity by name within this schema (case-insensitive). */
    public getKindOfQuantity(name: string): KindOfQuantity | undefined {
      const map = this._ctx[_storage].koqByName.get(this.idx);
      const idx = map?.get(name.toLowerCase());
      return idx !== undefined ? new KindOfQuantity(this._ctx, idx) : undefined;
    }

    /** Find a PropertyCategory by name within this schema (case-insensitive). */
    public getPropertyCategory(name: string): PropertyCategory | undefined {
      const map = this._ctx[_storage].catByName.get(this.idx);
      const idx = map?.get(name.toLowerCase());
      return idx !== undefined ? new PropertyCategory(this._ctx, idx) : undefined;
    }

    /** Find a view by name within this schema (case-insensitive).
     * Views are classes with `ClassType.View` - this is a convenience filter over `getClass()`. */
    public getView(name: string): Class | undefined {
      const cls = this.getClass(name);
      return cls !== undefined && cls.isView() ? cls : undefined;
    }

    /** Iterate all views in this schema. */
    public *getViews(): IterableIterator<Class> {
      const d = this._data;
      for (let i = d.classRangeStart; i < d.classRangeStart + d.classCount; i++) {
        if (this._ctx[_storage].classes[i].type === ClassType.View)
          yield createClass(this._ctx, i);
      }
    }

    /** Iterate all enumerations in this schema. */
    public *getEnumerations(): IterableIterator<Enumeration> {
      const d = this._data;
      for (let i = d.enumRangeStart; i < d.enumRangeStart + d.enumCount; i++)
        yield new Enumeration(this._ctx, i);
    }

    /** Iterate all KindOfQuantity items in this schema. */
    public *getKindOfQuantities(): IterableIterator<KindOfQuantity> {
      const d = this._data;
      for (let i = d.koqRangeStart; i < d.koqRangeStart + d.koqCount; i++)
        yield new KindOfQuantity(this._ctx, i);
    }

    /** Iterate all PropertyCategory items in this schema. */
    public *getPropertyCategories(): IterableIterator<PropertyCategory> {
      const d = this._data;
      for (let i = d.catRangeStart; i < d.catRangeStart + d.catCount; i++)
        yield new PropertyCategory(this._ctx, i);
    }
  }

  /** Lightweight view over a class in a `SchemaView`. For relationship-specific
   * fields (strength, direction, source/target constraints), narrow via `isRelationship()`
   * or `assertRelationship()` to get a `SchemaView.RelationshipClass`.
   * @beta
   */
  export class Class {
    /** @internal */
    constructor(
      protected readonly _ctx: SchemaView,
      /** @internal */ public readonly idx: number,
    ) { }

    /** @internal */
    protected get _data() { return this._ctx[_storage].classes[this.idx]; }

    /** Row ID from ec_Class. Matches `ECInstanceId` in ECDbMeta views, e.g.
     * `SELECT * FROM meta.ECClassDef WHERE ECInstanceId = ?`.
     */
    public get ecInstanceId(): number { return this._data.ecInstanceId; }
    public get name(): string { return this._ctx[_storage].strings[this._data.nameStringIdx]; }
    public get label(): string {
      const sid = this._data.labelStringIdx;
      return sid !== 0 ? this._ctx[_storage].strings[sid] : this.name;
    }
    public get description(): string {
      const sid = this._data.descriptionStringIdx;
      return sid !== 0 ? this._ctx[_storage].strings[sid] : "";
    }
    /** "SchemaName:ClassName" - colon-separated, matching the EC class full name convention.
     * Use either ":" or "." as separator when passing to `findClass()`. */
    public get fullName(): string {
      const d = this._data;
      return `${this._ctx[_storage].strings[this._ctx[_storage].schemas[d.schemaIdx].nameStringIdx]}:${this._ctx[_storage].strings[d.nameStringIdx]}`;
    }
    public get schema(): Schema { return new Schema(this._ctx, this._data.schemaIdx); }
    public get type(): ClassType { return this._data.type; }
    public get modifier(): ClassModifier { return this._data.modifier; }

    // Type check methods

    // disabling lint rule for these because we explicitly want them to mirror same methods in ecschema-metadata, to make the APIs more compatible
    // eslint-disable-next-line @itwin/prefer-get
    public isEntity(): boolean { return this._data.type === ClassType.Entity; }
    /** Type predicate - narrows to `SchemaView.RelationshipClass` for access to strength, direction,
     * source, and target constraint fields. */
    public isRelationship(): this is RelationshipClass { return this._data.type === ClassType.Relationship; }
    // eslint-disable-next-line @itwin/prefer-get
    public isStruct(): boolean { return this._data.type === ClassType.Struct; }
    // eslint-disable-next-line @itwin/prefer-get
    public isMixin(): boolean { return this._data.type === ClassType.Mixin; }
    // eslint-disable-next-line @itwin/prefer-get
    public isCustomAttribute(): boolean { return this._data.type === ClassType.CustomAttribute; }
    // eslint-disable-next-line @itwin/prefer-get
    public isView(): boolean { return this._data.type === ClassType.View; }

    /** @see isRelationship */
    public assertRelationship(): asserts this is RelationshipClass {
      if (!this.isRelationship())
        throw new Error(`Expected a relationship class, got type ${this.type} for "${this.fullName}"`);
    }

    // Modifier checks
    public get isAbstract(): boolean { return this._data.modifier === ClassModifier.Abstract; }
    public get isSealed(): boolean { return this._data.modifier === ClassModifier.Sealed; }

    /** Reflects the `HiddenClass` custom attribute from `CoreCustomAttributes`.
     * Returns `true` when this class is directly hidden (via `HiddenClass(Show!=true)` or
     * schema-level `HiddenSchema(ShowClasses!=true)`). Does NOT consider base class inheritance -
     * use `isEffectivelyHidden` for that.
     *
     * Note: `false` means explicitly shown via `HiddenClass(Show=true)`. `undefined` means
     * no `HiddenClass` CA and the schema does not hide its classes. Both are "not hidden" for
     * this property, but `isEffectivelyHidden` distinguishes them when walking the hierarchy. */
    public get isHidden(): boolean | undefined { return this._data.isHidden; }

    /** Computed hidden status that walks the base class chain (not mixins).
     *
     * Returns `true` if this class is hidden or any ancestor in the base class chain is hidden,
     * unless this class or an intermediate class explicitly breaks the chain with
     * `HiddenClass(Show=true)` (i.e. `isHidden === false`).
     *
     * Mixins are intentionally excluded - a hidden mixin represents a hidden capability,
     * not a hidden identity. */
    public get isEffectivelyHidden(): boolean {
      let data: ClassData | undefined = this._data;
      while (data !== undefined) {
        if (data.isHidden === false) return false; // explicit Show=true breaks the chain
        if (data.isHidden === true) return true;
        // undefined: walk to base class via internal array (avoids allocating Class objects)
        data = data.baseClassIdx !== -1 ? this._ctx[_storage].classes[data.baseClassIdx] : undefined;
      }
      return false;
    }

    // Hierarchy

    /** Single base class. undefined for root classes. */
    public get baseClass(): Class | undefined {
      const idx = this._data.baseClassIdx;
      return idx !== -1 ? createClass(this._ctx, idx) : undefined;
    }

    /** Applied mixins in declaration order. Only meaningful for entity classes. */
    public get mixins(): readonly Class[] {
      const d = this._data;
      if (d.mixinCount === 0) return [];
      const result: Class[] = [];
      for (let i = 0; i < d.mixinCount; i++) {
        const mixinIdx = this._ctx[_storage].classMixins[d.mixinStartIdx + i];
        if (mixinIdx === -1 || mixinIdx === undefined) continue; // safety: dangling mixin ref from excluded schema
        result.push(createClass(this._ctx, mixinIdx));
      }
      return result;
    }

    /** IS-A check. Returns true if this class is, or derives from, `other` (transitively, including mixins).
     * Accepts a `SchemaView.Class` or a qualified name string ("SchemaName:ClassName").
     */
    public is(classOrName: Class | string): boolean {
      let targetIdx: number;
      if (typeof classOrName === "string") {
        targetIdx = this._ctx.resolveClassIdx(classOrName);
      } else if (classOrName._ctx === this._ctx) {
        targetIdx = classOrName.idx;
      } else {
        // Cross-view input: indices are not comparable across SchemaView instances.
        // Resolve by qualified name against this view.
        targetIdx = this._ctx.resolveClassIdx(classOrName.fullName);
      }
      if (targetIdx === -1) return false;
      if (this.idx === targetIdx) return true;
      return this._ctx.getTransitiveBases(this.idx).has(targetIdx);
    }

    /** Direct derived classes. Expensive on first call (builds reverse map across all classes). */
    public get derivedClasses(): readonly Class[] {
      const map = this._ctx.buildDerivedClassMap();
      const indices = map.get(this.idx);
      if (indices === undefined) return [];
      return indices.map((i) => createClass(this._ctx, i));
    }

    // Properties

    /** Find a property by name (case-insensitive). Searches own + inherited.
     *
     * Note: this resolves the full property list and linear-scans it on every call. For workloads
     * that hit `getProperty` repeatedly on the same class with different names, a per-class
     * resolved-property map cache could be added on the view. Not done now - measure before
     * optimizing. */
    public getProperty(name: string): Property | undefined {
      const allProps = this._ctx.resolveAllProperties(this.idx);
      const lowerName = name.toLowerCase();
      for (const rp of allProps) {
        if (this._ctx[_storage].lowerStrings[this._ctx[_storage].propDefs[rp.ref.defIdx].nameStringIdx] === lowerName)
          return createProperty(this._ctx, rp.ref, rp.classIdx);
      }
      return undefined;
    }

    /** All properties including inherited, in inheritance order (base first, then mixins, then own). */
    public getProperties(): readonly Property[] {
      const allRefs = this._ctx.resolveAllProperties(this.idx);
      return allRefs.map((rp) => createProperty(this._ctx, rp.ref, rp.classIdx));
    }

    /** Own properties only (not inherited), in ordinal order. */
    public getOwnProperties(): readonly Property[] {
      const d = this._data;
      const result: Property[] = [];
      for (let i = 0; i < d.ownPropCount; i++) {
        const ref = this._ctx[_storage].propertyRefs[d.ownPropStart + i];
        result.push(createProperty(this._ctx, ref, this.idx));
      }
      return result;
    }
  }

  /** A relationship class with constraint and strength metadata. Created by `createClass()`
   * when the underlying `ClassType` is `Relationship`. Use `cls.isRelationship()` to narrow a
   * `SchemaView.Class` to this type.
   * @beta
   */
  export class RelationshipClass extends Class {
    public get strength(): StrengthType { return this._data.strength; }
    public get strengthDirection(): StrengthDirection { return this._data.strengthDirection; }

    public get source(): RelConstraint | undefined {
      const idx = this._data.sourceConstraintIdx;
      return idx !== -1 ? new RelConstraint(this._ctx, idx) : undefined;
    }

    public get target(): RelConstraint | undefined {
      const idx = this._data.targetConstraintIdx;
      return idx !== -1 ? new RelConstraint(this._ctx, idx) : undefined;
    }
  }

  /** @internal */
  export function createClass(ctx: SchemaView, idx: number): Class {
    if (ctx[_storage].classes[idx].type === ClassType.Relationship)
      return new RelationshipClass(ctx, idx);
    return new Class(ctx, idx);
  }

  /** Lightweight view over a property in a `SchemaView`. Subclasses provide
   * type-safe access to kind-specific fields. Use `isPrimitive()`, `isStruct()`,
   * `isArray()`, or `isNavigation()` to narrow, or the corresponding `assert*()` methods.
   * @beta
   */
  export abstract class Property {
    /** @internal */
    constructor(
      protected readonly _ctx: SchemaView,
      private readonly _ref: PropertyRef,
      /** Index of the class that declared or contributed this property through inheritance.
       * For own properties, this is the class itself. For inherited properties, this is the
       * base class or mixin that introduced it. -1 for view properties. */
      private readonly _classIdx: number,
    ) { }

    /** @internal */
    protected get _def() { return this._ctx[_storage].propDefs[this._ref.defIdx]; }

    /** Row ID from ec_Property. Matches `ECInstanceId` in ECDbMeta views, e.g.
     * `SELECT * FROM meta.ECPropertyDef WHERE ECInstanceId = ?`.
     *
     * Stored per-reference (not per-definition) because each class-property pair has a unique
     * ec_Property row even when the structural definition is deduplicated.
     */
    public get ecInstanceId(): number { return this._ref.ecInstanceId; }
    public get name(): string { return this._ctx[_storage].strings[this._def.nameStringIdx]; }
    /** Display label. Falls back to the property name if no explicit label is set.
     * Labels are stored per-reference (not per-definition) because EC allows class overrides. */
    public get label(): string {
      const labelStringIdx = this._ref.labelStringIdx;
      return labelStringIdx !== 0 ? this._ctx[_storage].strings[labelStringIdx] : this.name;
    }
    public get description(): string {
      const sid = this._def.descriptionStringIdx;
      return sid !== 0 ? this._ctx[_storage].strings[sid] : "";
    }
    public get kind(): PropertyKind { return this._def.kind; }
    public get isReadOnly(): boolean { return this._def.isReadOnly; }
    /** Reflects the `HiddenProperty` custom attribute from `CoreCustomAttributes`.
     * Properties marked hidden are typically excluded from UI display but remain accessible programmatically. */
    public get isHidden(): boolean { return this._def.isHidden; }
    /** Display priority. Higher values should be displayed more prominently. 0 means default. */
    public get priority(): number { return this._ref.priority; }

    /** The class that declared or contributed this property through inheritance.
     * For own properties, returns the class itself. For inherited properties, returns the
     * base class or mixin that introduced it. Returns `undefined` for view properties.
     * This is the class array index, not the ec_Class.Id from the database.
     * @beta
     */
    public get declaringClass(): Class | undefined {
      return this._classIdx !== -1 ? createClass(this._ctx, this._classIdx) : undefined;
    }

    /** Property category, or undefined if none assigned. Available on all property kinds. */
    public get category(): PropertyCategory | undefined {
      const idx = this._def.categoryIdx;
      return idx !== -1 ? new PropertyCategory(this._ctx, idx) : undefined;
    }

    // Type guards - real type predicates that narrow `this`

    /** True for `SchemaView.PrimitiveProperty` and `SchemaView.PrimitiveArrayProperty`.
     * Matches ecschema-metadata behavior where `isPrimitive()` includes primitive arrays. */
    public isPrimitive(): this is AnyPrimitiveProperty {
      return this._def.kind === PropertyKind.Primitive || this._def.kind === PropertyKind.PrimitiveArray;
    }
    /** True for `SchemaView.StructProperty` and `SchemaView.StructArrayProperty`. */
    public isStruct(): this is AnyStructProperty {
      return this._def.kind === PropertyKind.Struct || this._def.kind === PropertyKind.StructArray;
    }
    /** True for `SchemaView.PrimitiveArrayProperty` and `SchemaView.StructArrayProperty`. */
    public isArray(): this is AnyArrayProperty {
      return this._def.kind === PropertyKind.PrimitiveArray || this._def.kind === PropertyKind.StructArray;
    }
    /** True for `SchemaView.NavigationProperty`. */
    public isNavigation(): this is NavigationProperty {
      return this._def.kind === PropertyKind.Navigation;
    }
    /** True if this property is backed by an enumeration. Enumerations are a facet of primitive
     * properties - an enum property IS a primitive property with an enum binding. Narrows to
     * `AnyPrimitiveProperty` so you can access `enumeration`, `primitiveType`, etc. */
    public isEnumeration(): this is AnyPrimitiveProperty {
      return this._def.enumIdx !== -1;
    }

    // Assert methods - throw on mismatch, narrow `this`

    /** @see isPrimitive */
    public assertPrimitive(): asserts this is AnyPrimitiveProperty {
      if (!this.isPrimitive())
        throw new Error(`Expected a primitive property, got ${PropertyKind[this.kind]}`);
    }
    /** @see isStruct */
    public assertStruct(): asserts this is AnyStructProperty {
      if (!this.isStruct())
        throw new Error(`Expected a struct property, got ${PropertyKind[this.kind]}`);
    }
    /** @see isArray */
    public assertArray(): asserts this is AnyArrayProperty {
      if (!this.isArray())
        throw new Error(`Expected an array property, got ${PropertyKind[this.kind]}`);
    }
    /** @see isNavigation */
    public assertNavigation(): asserts this is NavigationProperty {
      if (!this.isNavigation())
        throw new Error(`Expected a navigation property, got ${PropertyKind[this.kind]}`);
    }
  }

  /** A scalar primitive property. May optionally be backed by an enumeration -
   * check `isEnumeration()` or `enumeration`.
   * @beta
   */
  export class PrimitiveProperty extends Property {
    public get primitiveType(): SchemaViewPrimitiveType { return this._def.primitiveType; }
    public get extendedTypeName(): string | undefined {
      const sid = this._def.extTypeStringIdx;
      return sid !== 0 ? this._ctx[_storage].strings[sid] : undefined;
    }
    public get enumeration(): Enumeration | undefined {
      const idx = this._def.enumIdx;
      return idx !== -1 ? new Enumeration(this._ctx, idx) : undefined;
    }
    public get kindOfQuantity(): KindOfQuantity | undefined {
      const idx = this._def.koqIdx;
      return idx !== -1 ? new KindOfQuantity(this._ctx, idx) : undefined;
    }
  }

  /** An array of primitive values. Same primitive/enum fields as `PrimitiveProperty`,
   * plus array bounds.
   * @beta
   */
  export class PrimitiveArrayProperty extends Property {
    public get primitiveType(): SchemaViewPrimitiveType { return this._def.primitiveType; }
    public get extendedTypeName(): string | undefined {
      const sid = this._def.extTypeStringIdx;
      return sid !== 0 ? this._ctx[_storage].strings[sid] : undefined;
    }
    public get enumeration(): Enumeration | undefined {
      const idx = this._def.enumIdx;
      return idx !== -1 ? new Enumeration(this._ctx, idx) : undefined;
    }
    public get kindOfQuantity(): KindOfQuantity | undefined {
      const idx = this._def.koqIdx;
      return idx !== -1 ? new KindOfQuantity(this._ctx, idx) : undefined;
    }
    public get arrayMinOccurs(): number | undefined { return this._def.arrayMinOccurs; }
    public get arrayMaxOccurs(): number | undefined { return this._def.arrayMaxOccurs; }
  }

  /** A scalar struct property. `structClass` is non-nullable - the binary parser drops
   * properties whose struct class can't be resolved (e.g. from excluded schemas).
   * @beta
   */
  export class StructProperty extends Property {
    public get structClass(): Class {
      return createClass(this._ctx, this._def.structClassIdx);
    }
  }

  /** An array of struct values. Same struct field as `StructProperty`, plus array bounds.
   * @beta
   */
  export class StructArrayProperty extends Property {
    public get structClass(): Class {
      return createClass(this._ctx, this._def.structClassIdx);
    }
    public get arrayMinOccurs(): number | undefined { return this._def.arrayMinOccurs; }
    public get arrayMaxOccurs(): number | undefined { return this._def.arrayMaxOccurs; }
  }

  /** A navigation property. `relationshipClass` is non-nullable - the binary parser drops
   * properties whose relationship class can't be resolved.
   * @beta
   */
  export class NavigationProperty extends Property {
    public get direction(): StrengthDirection { return this._def.navDirection; }
    public get relationshipClass(): RelationshipClass {
      return createClass(this._ctx, this._def.navRelClassIdx) as RelationshipClass;
    }
  }

  /** Any primitive property (scalar or array). Useful for accessing `primitiveType`,
   * `extendedTypeName`, `enumeration`, `kindOfQuantity` after an `isPrimitive()` check.
   * @beta
   */
  export type AnyPrimitiveProperty = PrimitiveProperty | PrimitiveArrayProperty;

  /** Any struct property (scalar or array). Useful for accessing `structClass` after an `isStruct()` check.
   * @beta
   */
  export type AnyStructProperty = StructProperty | StructArrayProperty;

  /** Any array property (primitive or struct). Useful for accessing `arrayMinOccurs`/`arrayMaxOccurs`
   * after an `isArray()` check.
   * @beta
   */
  export type AnyArrayProperty = PrimitiveArrayProperty | StructArrayProperty;

  /** Union of all concrete property types.
   * @beta
   */
  export type AnyProperty = PrimitiveProperty | PrimitiveArrayProperty
    | StructProperty | StructArrayProperty | NavigationProperty;

  /** @internal */
  export function createProperty(ctx: SchemaView, ref: PropertyRef, classIdx: number): Property {
    const kind = ctx[_storage].propDefs[ref.defIdx].kind;
    switch (kind) {
      case PropertyKind.Primitive: return new PrimitiveProperty(ctx, ref, classIdx);
      case PropertyKind.PrimitiveArray: return new PrimitiveArrayProperty(ctx, ref, classIdx);
      case PropertyKind.Struct: return new StructProperty(ctx, ref, classIdx);
      case PropertyKind.StructArray: return new StructArrayProperty(ctx, ref, classIdx);
      case PropertyKind.Navigation: return new NavigationProperty(ctx, ref, classIdx);
      default: throw new Error(`Unknown PropertyKind ${kind as number} for property "${ctx[_storage].strings[ctx[_storage].propDefs[ref.defIdx].nameStringIdx]}"`);
    }
  }

  /** Lightweight view over an enumeration in a `SchemaView`.
   * @beta
   */
  export class Enumeration {
    /** @internal */
    constructor(
      private readonly _ctx: SchemaView,
      /** @internal */ public readonly idx: number,
    ) { }

    private get _data() { return this._ctx[_storage].enumerations[this.idx]; }

    /** Row ID from ec_Enumeration. Matches `ECInstanceId` in ECDbMeta views, e.g.
     * `SELECT * FROM meta.ECEnumerationDef WHERE ECInstanceId = ?`.
     */
    public get ecInstanceId(): number { return this._data.ecInstanceId; }
    public get name(): string { return this._ctx[_storage].strings[this._data.nameStringIdx]; }
    public get label(): string {
      const sid = this._data.labelStringIdx;
      return sid !== 0 ? this._ctx[_storage].strings[sid] : this.name;
    }
    public get description(): string {
      const sid = this._data.descriptionStringIdx;
      return sid !== 0 ? this._ctx[_storage].strings[sid] : "";
    }
    /** "SchemaName:EnumName" - colon-separated. */
    public get fullName(): string {
      const d = this._data;
      return `${this._ctx[_storage].strings[this._ctx[_storage].schemas[d.schemaIdx].nameStringIdx]}:${this._ctx[_storage].strings[d.nameStringIdx]}`;
    }
    public get schema(): Schema { return new Schema(this._ctx, this._data.schemaIdx); }
    public get primitiveType(): SchemaViewPrimitiveType { return this._data.primitiveType; }
    public get isStrict(): boolean { return this._data.isStrict; }

    /** Iterate enumerators in declaration order. */
    public *getEnumerators(): IterableIterator<Enumerator> {
      const d = this._data;
      for (let i = d.enumeratorStart; i < d.enumeratorStart + d.enumeratorCount; i++)
        yield new Enumerator(this._ctx, i);
    }

    /** Find enumerator by name (case-insensitive). */
    public getEnumeratorByName(name: string): Enumerator | undefined {
      const lower = name.toLowerCase();
      const d = this._data;
      for (let i = d.enumeratorStart; i < d.enumeratorStart + d.enumeratorCount; i++) {
        if (this._ctx[_storage].lowerStrings[this._ctx[_storage].enumerators[i].nameStringIdx] === lower)
          return new Enumerator(this._ctx, i);
      }
      return undefined;
    }

    /** Find enumerator by value. */
    public getEnumerator(value: number | string): Enumerator | undefined {
      const d = this._data;
      for (let i = d.enumeratorStart; i < d.enumeratorStart + d.enumeratorCount; i++) {
        if (this._ctx[_storage].enumerators[i].value === value)
          return new Enumerator(this._ctx, i);
      }
      return undefined;
    }
  }

  /** Thin view over an enumerator.
   * @beta
   */
  export class Enumerator {
    /** @internal */
    constructor(
      private readonly _ctx: SchemaView,
      /** @internal */ public readonly idx: number,
    ) { }

    private get _data() { return this._ctx[_storage].enumerators[this.idx]; }

    public get name(): string { return this._ctx[_storage].strings[this._data.nameStringIdx]; }
    public get label(): string {
      const sid = this._data.labelStringIdx;
      return sid !== 0 ? this._ctx[_storage].strings[sid] : this.name;
    }
    public get description(): string {
      const sid = this._data.descriptionStringIdx;
      return sid !== 0 ? this._ctx[_storage].strings[sid] : "";
    }
    public get value(): number | string { return this._data.value; }
  }

  /** A parsed presentation format override from a KindOfQuantity. Names are alias-qualified
   * as stored in ECDb (e.g. `"f:DefaultRealU"`, `"u:M"`). The alias can be resolved to a
   * full schema name via the schema's alias if needed.
   *
   * Format string syntax: `formatName(precision)[unitName|label][unitName|label]...`
   * @beta
   */
  export interface PresentationFormat {
    /** Format name (alias-qualified), e.g. `"f:DefaultRealU"`. */
    readonly name: string;
    /** Precision override. `undefined` if the format string does not override precision. */
    readonly precision?: number;
    /** Unit overrides as `[unitName, labelOverride]` tuples. `unitName` is alias-qualified
     * (e.g. `"u:M"`). `labelOverride` is `undefined` when no label was specified, or a
     * string (possibly empty) when a `|` separator was present.
     */
    readonly unitAndLabels?: ReadonlyArray<readonly [string, string | undefined]>;
  }

  /** Parse a single format override string into a `PresentationFormat`.
   * @internal
   */
  export function parseFormatString(formatString: string): PresentationFormat {
    const nameMatch = /^([\w.:]+)/.exec(formatString);
    if (!nameMatch)
      return { name: formatString };

    const name = nameMatch[1];
    const precMatch = /\((\d+)\)/.exec(formatString);
    const precision = precMatch ? parseInt(precMatch[1], 10) : undefined;

    const bracketRgx = /\[([^\]]+)\]/g;
    const units: Array<readonly [string, string | undefined]> = [];
    let m;
    while ((m = bracketRgx.exec(formatString)) !== null) {
      const pipeIdx = m[1].indexOf("|");
      units.push(pipeIdx < 0 ? [m[1], undefined] : [m[1].substring(0, pipeIdx), m[1].substring(pipeIdx + 1)]);
    }

    return { name, precision, unitAndLabels: units.length > 0 ? units : undefined };
  }

  /** Lightweight view over a KindOfQuantity in a `SchemaView`.
   * @beta
   */
  export class KindOfQuantity {
    /** @internal */
    constructor(
      private readonly _ctx: SchemaView,
      /** @internal */ public readonly idx: number,
    ) { }

    private get _data() { return this._ctx[_storage].koqs[this.idx]; }

    /** Row ID from ec_KindOfQuantity. Matches `ECInstanceId` in ECDbMeta views, e.g.
     * `SELECT * FROM meta.ECKindOfQuantityDef WHERE ECInstanceId = ?`.
     */
    public get ecInstanceId(): number { return this._data.ecInstanceId; }
    public get name(): string { return this._ctx[_storage].strings[this._data.nameStringIdx]; }
    public get label(): string {
      const sid = this._data.labelStringIdx;
      return sid !== 0 ? this._ctx[_storage].strings[sid] : this.name;
    }
    public get description(): string {
      const sid = this._data.descriptionStringIdx;
      return sid !== 0 ? this._ctx[_storage].strings[sid] : "";
    }
    /** "SchemaName:KoqName" - colon-separated. */
    public get fullName(): string {
      const d = this._data;
      return `${this._ctx[_storage].strings[this._ctx[_storage].schemas[d.schemaIdx].nameStringIdx]}:${this._ctx[_storage].strings[d.nameStringIdx]}`;
    }
    public get schema(): Schema { return new Schema(this._ctx, this._data.schemaIdx); }
    public get relativeError(): number { return this._data.relativeError; }
    /** Persistence unit as a full name string, e.g. "Units:M".
     *
     * On iModels still on ECDb profile `4.0.0.1` (predates the 2018 EC3.2 Units/Formats migration)
     * this string is in legacy FUS format rather than the EC3.2 alias-qualified form.
     * Upgrade the iModel's ECDb profile to get EC3.2 strings.
     */
    public get persistenceUnit(): string {
      const sid = this._data.persistenceUnitStringIdx;
      return sid !== 0 ? this._ctx[_storage].strings[sid] : "";
    }
    // EC XML serializes this as "presentationUnits"; we use "presentationFormats" to align with KindOfQuantity.presentationFormats in ecschema-metadata.
    /** Raw presentation format string as stored in ECDb (`ec_KindOfQuantity.PresentationUnits`).
     * This is a JSON array of format override strings. Empty string if none are defined.
     * Prefer `presentationFormats` for structured access.
     *
     * On iModels still on ECDb profile `4.0.0.1` (predates the 2018 EC3.2 Units/Formats migration)
     * the strings are in legacy FUS format and will not parse via `presentationFormats`.
     * Upgrade the iModel's ECDb profile to get EC3.2 strings.
     */
    public get presentationFormatsRaw(): string {
      const sid = this._data.presentationFormatsStringIdx;
      return sid !== 0 ? this._ctx[_storage].strings[sid] : "";
    }

    /** Presentation formats parsed into structured overrides. Each entry has the format name
     * (alias-qualified, e.g. `"f:DefaultRealU"`), optional precision override, and optional
     * unit-and-label overrides. Returns an empty array if no presentation formats are defined.
     *
     * Example - given a raw string of `["f:DefaultRealU(4)[u:M_PER_SEC_SQ]","f:DefaultRealU(4)[u:CM_PER_SEC_SQ]"]`:
     * ```ts
     * // [
     * //   { name: "f:DefaultRealU", precision: 4, unitAndLabels: [["u:M_PER_SEC_SQ", undefined]] },
     * //   { name: "f:DefaultRealU", precision: 4, unitAndLabels: [["u:CM_PER_SEC_SQ", undefined]] },
     * // ]
     * ```
     */
    public get presentationFormats(): readonly PresentationFormat[] {
      const raw = this.presentationFormatsRaw;
      if (raw === "")
        return [];
      const formats: string[] = JSON.parse(raw);
      return formats.map((f) => parseFormatString(f));
    }
  }

  /** Lightweight view over a PropertyCategory in a `SchemaView`.
   * @beta
   */
  export class PropertyCategory {
    /** @internal */
    constructor(
      private readonly _ctx: SchemaView,
      /** @internal */ public readonly idx: number,
    ) { }

    private get _data() { return this._ctx[_storage].propCategories[this.idx]; }

    /** Row ID from ec_PropertyCategory. Matches `ECInstanceId` in ECDbMeta views, e.g.
     * `SELECT * FROM meta.ECPropertyCategoryDef WHERE ECInstanceId = ?`.
     */
    public get ecInstanceId(): number { return this._data.ecInstanceId; }
    public get name(): string { return this._ctx[_storage].strings[this._data.nameStringIdx]; }
    public get label(): string {
      const sid = this._data.labelStringIdx;
      return sid !== 0 ? this._ctx[_storage].strings[sid] : this.name;
    }
    public get description(): string {
      const sid = this._data.descriptionStringIdx;
      return sid !== 0 ? this._ctx[_storage].strings[sid] : "";
    }
    /** "SchemaName:CategoryName" - colon-separated. */
    public get fullName(): string {
      const d = this._data;
      return `${this._ctx[_storage].strings[this._ctx[_storage].schemas[d.schemaIdx].nameStringIdx]}:${this._ctx[_storage].strings[d.nameStringIdx]}`;
    }
    public get schema(): Schema { return new Schema(this._ctx, this._data.schemaIdx); }
    public get priority(): number { return this._data.priority; }
  }

  /** Lightweight view over a relationship constraint in a `SchemaView`.
   * @beta
   */
  export class RelConstraint {
    /** @internal */
    constructor(
      private readonly _ctx: SchemaView,
      private readonly _idx: number,
    ) { }

    private get _data() { return this._ctx[_storage].relConstraints[this._idx]; }

    public get abstractConstraint(): Class | undefined {
      const idx = this._data.abstractConstraintIdx;
      return idx !== -1 ? createClass(this._ctx, idx) : undefined;
    }
    public get polymorphic(): boolean { return this._data.polymorphic; }
    /** Multiplicity lower bound (0 = unbounded). */
    public get multiplicityLower(): number { return this._data.multiplicityLower; }
    /** Multiplicity upper bound (0 = unbounded). */
    public get multiplicityUpper(): number { return this._data.multiplicityUpper; }
    /** Role label string, or empty if not set. */
    public get roleLabel(): string {
      const sid = this._data.roleLabelStringIdx;
      return sid !== 0 ? this._ctx[_storage].strings[sid] : "";
    }
    public get constraintClasses(): readonly Class[] {
      const d = this._data;
      const result: Class[] = [];
      for (let i = 0; i < d.classRefCount; i++)
        result.push(createClass(this._ctx, this._ctx[_storage].constraintClassRefs[d.classRefStart + i]));
      return result;
    }
  }
}

// =====================================================================================
// SchemaViewBuilder
// =====================================================================================

/** Builder for constructing an immutable `SchemaView`.
 *
 * Collects data during binary blob parsing, then freezes it into a view.
 * Handles string interning and property definition deduplication.
 *
 * Consumers should not use this directly - read views via `IModelDb.getSchemaView`
 * / `IModelConnection.getSchemaView` (or `SchemaView.fromBinary` if you have a raw blob).
 * @internal
 */
export class SchemaViewBuilder {
  private readonly _strings: string[] = [""]; // SID 0 = empty string
  private readonly _lowerStrings: string[] = [""];
  private readonly _stringMap = new Map<string, number>(); // original value -> SID

  private readonly _schemas: SchemaData[] = [];
  private readonly _classes: ClassData[] = [];
  private readonly _classMixins: number[] = [];
  private readonly _propDefs: PropertyDef[] = [];
  private readonly _propertyRefs: PropertyRef[] = [];
  private readonly _relConstraints: RelConstraintData[] = [];
  private readonly _constraintClassRefs: number[] = [];
  private readonly _enumerations: EnumerationData[] = [];
  private readonly _enumerators: EnumeratorData[] = [];
  private readonly _koqs: KoqData[] = [];
  private readonly _propCategories: PropCategoryData[] = [];

  // For PropertyDef dedup
  private readonly _propDefMap = new Map<string, number>(); // signature string -> defIdx

  /** Intern a string, returning its SID. Empty/undefined strings return 0.
   * Interning is case-sensitive - "MyLabel" and "MYLABEL" get distinct SIDs.
   * The `lowerStrings` array provides case-insensitive lookup without mutating display values.
   */
  public internString(value: string | undefined): number {
    if (value === undefined || value === "") return 0;
    const existing = this._stringMap.get(value);
    if (existing !== undefined) return existing;
    const sid = this._strings.length;
    this._strings.push(value);
    this._lowerStrings.push(value.toLowerCase());
    this._stringMap.set(value, sid);
    return sid;
  }

  /** Add a schema. Returns its index. */
  public addSchema(data: SchemaData): number {
    const idx = this._schemas.length;
    this._schemas.push(data);
    return idx;
  }

  /** Add a class. Returns its index. Must be called after the owning schema. */
  public addClass(data: ClassData): number {
    const idx = this._classes.length;
    this._classes.push(data);
    return idx;
  }

  /** Add a property definition with deduplication. Returns the def index (possibly existing). */
  public addPropertyDef(data: PropertyDef): number {
    const sig = this._propDefSignature(data);
    const existing = this._propDefMap.get(sig);
    if (existing !== undefined) return existing;

    const idx = this._propDefs.length;
    this._propDefs.push(data);
    this._propDefMap.set(sig, idx);
    return idx;
  }

  /** Append a property reference to the flat refs array. */
  public addPropertyRef(ref: PropertyRef): void {
    this._propertyRefs.push(ref);
  }

  /** Add an enumeration. Returns its index. */
  public addEnumeration(data: EnumerationData): number {
    const idx = this._enumerations.length;
    this._enumerations.push(data);
    return idx;
  }

  /** Append an enumerator to the flat enumerators array. */
  public addEnumerator(data: EnumeratorData): void {
    this._enumerators.push(data);
  }

  /** Add a KindOfQuantity. Returns its index. */
  public addKoq(data: KoqData): number {
    const idx = this._koqs.length;
    this._koqs.push(data);
    return idx;
  }

  /** Add a PropertyCategory. Returns its index. */
  public addPropertyCategory(data: PropCategoryData): number {
    const idx = this._propCategories.length;
    this._propCategories.push(data);
    return idx;
  }

  /** Add a relationship constraint. Returns its index. */
  public addRelConstraint(data: RelConstraintData): number {
    const idx = this._relConstraints.length;
    this._relConstraints.push(data);
    return idx;
  }

  /** Append a constraint class reference to the flat array. */
  public addConstraintClassRef(classIdx: number): void {
    this._constraintClassRefs.push(classIdx);
  }

  /** Append a mixin class reference to the flat array. */
  public addClassMixin(classIdx: number): void {
    this._classMixins.push(classIdx);
  }

  /** The current count of property refs (used to set ownPropStart on ClassData). */
  public get propertyRefCount(): number { return this._propertyRefs.length; }

  /** The current count of enumerators (used to set enumeratorStart on EnumerationData). */
  public get enumeratorCount(): number { return this._enumerators.length; }

  /** The current count of constraint class refs (used to set classRefStart). */
  public get constraintClassRefCount(): number { return this._constraintClassRefs.length; }

  /** The current count of class mixins (used to set mixinStartIdx). */
  public get classMixinCount(): number { return this._classMixins.length; }

  /** Get a string by SID. @internal */
  public getString(sid: number): string { return this._strings[sid]; }

  /** Replace class data at the given index (used during deferred cross-ref resolution). @internal */
  public updateClass(classIdx: number, data: ClassData): void { this._classes[classIdx] = data; }

  /** Update range fields on a schema (used after all items for a schema are collected). @internal */
  public updateSchemaRanges(schemaIdx: number, ranges: { classRangeStart: number; classCount: number; enumRangeStart: number; enumCount: number; koqRangeStart: number; koqCount: number; catRangeStart: number; catCount: number }): void {
    const s = this._schemas[schemaIdx];
    this._schemas[schemaIdx] = { ...s, ...ranges };
  }

  /** Freeze all data and produce an immutable SchemaView. */
  public build(schemaToken?: string): SchemaView {
    const schemaByName = new Map<string, number>();
    const schemaByAlias = new Map<string, number>();
    const classByName = new Map<number, Map<string, number>>();
    const enumByName = new Map<number, Map<string, number>>();
    const koqByName = new Map<number, Map<string, number>>();
    const catByName = new Map<number, Map<string, number>>();

    // Build schema lookup maps
    for (let i = 0; i < this._schemas.length; i++) {
      const s = this._schemas[i];
      schemaByName.set(this._lowerStrings[s.nameStringIdx], i);
      if (s.aliasStringIdx !== 0)
        schemaByAlias.set(this._lowerStrings[s.aliasStringIdx], i);

      // Build class-by-name map for this schema
      const classMap = new Map<string, number>();
      for (let c = s.classRangeStart; c < s.classRangeStart + s.classCount; c++)
        classMap.set(this._lowerStrings[this._classes[c].nameStringIdx], c);
      classByName.set(i, classMap);

      // Build enum-by-name map for this schema
      const eMap = new Map<string, number>();
      for (let e = s.enumRangeStart; e < s.enumRangeStart + s.enumCount; e++)
        eMap.set(this._lowerStrings[this._enumerations[e].nameStringIdx], e);
      enumByName.set(i, eMap);

      // Build koq-by-name map for this schema
      const kMap = new Map<string, number>();
      for (let k = s.koqRangeStart; k < s.koqRangeStart + s.koqCount; k++)
        kMap.set(this._lowerStrings[this._koqs[k].nameStringIdx], k);
      koqByName.set(i, kMap);

      // Build category-by-name map for this schema
      const cMap = new Map<string, number>();
      for (let p = s.catRangeStart; p < s.catRangeStart + s.catCount; p++)
        cMap.set(this._lowerStrings[this._propCategories[p].nameStringIdx], p);
      catByName.set(i, cMap);
    }

    return new SchemaView({
      strings: this._strings,
      lowerStrings: this._lowerStrings,
      schemas: this._schemas,
      classes: this._classes,
      classMixins: this._classMixins,
      propDefs: this._propDefs,
      propertyRefs: this._propertyRefs,
      relConstraints: this._relConstraints,
      constraintClassRefs: this._constraintClassRefs,
      enumerations: this._enumerations,
      enumerators: this._enumerators,
      koqs: this._koqs,
      propCategories: this._propCategories,
      schemaByName,
      schemaByAlias,
      classByName,
      enumByName,
      koqByName,
      catByName,
    }, schemaToken);
  }

  /** Produce a dedup signature for a PropertyDef. Label and priority are excluded because
   * they are per-PropertyRef overrides, not part of the structural definition.
   * Uses SIDs (not lowercase strings) for name/description so that case-preserving names
   * stay distinct - matching the C++ writer's dedup behavior. */
  private _propDefSignature(def: PropertyDef): string {
    return `${def.nameStringIdx}|${def.kind}|${def.primitiveType}|${def.extTypeStringIdx}|${def.enumIdx}|${def.koqIdx}|${def.structClassIdx}|${def.navRelClassIdx}|${def.navDirection}|${def.categoryIdx}|${def.isReadOnly ? 1 : 0}|${def.isHidden ? 1 : 0}|${def.arrayMinOccurs}|${def.arrayMaxOccurs}|${def.descriptionStringIdx}`;
  }
}
