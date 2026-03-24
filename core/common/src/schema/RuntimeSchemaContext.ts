/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import type { ClassData, EnumerationData, EnumeratorData, KoqData, PropCategoryData, PropertyDef, PropertyRef, RelConstraintData, SchemaData, ViewData } from "./RuntimeSchemaInterfaces";
import { parseRuntimeSchemaBlob } from "./RuntimeSchemaBinaryReader";
import { RuntimeClass, RuntimeSchema, RuntimeView } from "./RuntimeSchema";

/** Read-only runtime schema metadata context. Optimized for fast lookup and low memory usage.
 *
 * All data is stored in flat arrays. View objects (`RuntimeSchema`, `RuntimeClass`, etc.) are
 * stateless wrappers that hold a reference to this context plus an index. They allocate nothing
 * and cache nothing.
 *
 * The context is immutable after construction. Build it via `RuntimeSchemaContextBuilder` or parse
 * from a binary blob via `fromBinary`.
 * @beta
 */
export class RuntimeSchemaContext {
  /** @internal */ public readonly strings: readonly string[];
  /** @internal */ public readonly lowerStrings: readonly string[];
  /** @internal */ public readonly schemas: readonly SchemaData[];
  /** @internal */ public readonly classes: readonly ClassData[];
  /** @internal */ public readonly classMixins: readonly number[];
  /** @internal */ public readonly propDefs: readonly PropertyDef[];
  /** @internal */ public readonly propertyRefs: readonly PropertyRef[];
  /** @internal */ public readonly relConstraints: readonly RelConstraintData[];
  /** @internal */ public readonly constraintClassRefs: readonly number[];
  /** @internal */ public readonly enumerations: readonly EnumerationData[];
  /** @internal */ public readonly enumerators: readonly EnumeratorData[];
  /** @internal */ public readonly koqs: readonly KoqData[];
  /** @internal */ public readonly propCategories: readonly PropCategoryData[];
  /** @internal */ public readonly views: readonly ViewData[];

  /** @internal */ public readonly schemaByName: ReadonlyMap<string, number>;
  /** @internal */ public readonly schemaByAlias: ReadonlyMap<string, number>;
  /** @internal */ public readonly classByName: ReadonlyMap<number, ReadonlyMap<string, number>>;

  /** @internal */ public readonly inheritedPropsCache = new Map<number, readonly PropertyRef[]>();
  /** @internal */ public readonly transitiveBaseCache = new Map<number, ReadonlySet<number>>();
  /** @internal */ public derivedClassMap: ReadonlyMap<number, readonly number[]> | undefined;

  // Lookup caches for schema items by name within a schema
  /** @internal */ public readonly enumByName: ReadonlyMap<number, ReadonlyMap<string, number>>;
  /** @internal */ public readonly koqByName: ReadonlyMap<number, ReadonlyMap<string, number>>;
  /** @internal */ public readonly catByName: ReadonlyMap<number, ReadonlyMap<string, number>>;
  /** @internal */ public readonly viewByName: ReadonlyMap<number, ReadonlyMap<string, number>>;

  /** @internal */
  constructor(
    strings: readonly string[],
    lowerStrings: readonly string[],
    schemas: readonly SchemaData[],
    classes: readonly ClassData[],
    classMixins: readonly number[],
    propDefs: readonly PropertyDef[],
    propertyRefs: readonly PropertyRef[],
    relConstraints: readonly RelConstraintData[],
    constraintClassRefs: readonly number[],
    enumerations: readonly EnumerationData[],
    enumerators: readonly EnumeratorData[],
    koqs: readonly KoqData[],
    propCategories: readonly PropCategoryData[],
    views: readonly ViewData[],
    schemaByName: ReadonlyMap<string, number>,
    schemaByAlias: ReadonlyMap<string, number>,
    classByName: ReadonlyMap<number, ReadonlyMap<string, number>>,
    enumByName: ReadonlyMap<number, ReadonlyMap<string, number>>,
    koqByName: ReadonlyMap<number, ReadonlyMap<string, number>>,
    catByName: ReadonlyMap<number, ReadonlyMap<string, number>>,
    viewByName: ReadonlyMap<number, ReadonlyMap<string, number>>,
  ) {
    this.strings = strings;
    this.lowerStrings = lowerStrings;
    this.schemas = schemas;
    this.classes = classes;
    this.classMixins = classMixins;
    this.propDefs = propDefs;
    this.propertyRefs = propertyRefs;
    this.relConstraints = relConstraints;
    this.constraintClassRefs = constraintClassRefs;
    this.enumerations = enumerations;
    this.enumerators = enumerators;
    this.koqs = koqs;
    this.propCategories = propCategories;
    this.views = views;
    this.schemaByName = schemaByName;
    this.schemaByAlias = schemaByAlias;
    this.classByName = classByName;
    this.enumByName = enumByName;
    this.koqByName = koqByName;
    this.catByName = catByName;
    this.viewByName = viewByName;
  }

  /** Number of schemas in the context. */
  public get schemaCount(): number { return this.schemas.length; }

  /** Number of classes across all schemas. */
  public get classCount(): number { return this.classes.length; }

  /** Number of views across all schemas. */
  public get viewCount(): number { return this.views.length; }

  /** Get a schema by name (case-insensitive). */
  public getSchema(name: string): RuntimeSchema | undefined {
    const idx = this.schemaByName.get(name.toLowerCase());
    return idx !== undefined ? new RuntimeSchema(this, idx) : undefined;
  }

  /** Get a schema by alias (case-insensitive). */
  public getSchemaByAlias(alias: string): RuntimeSchema | undefined {
    const idx = this.schemaByAlias.get(alias.toLowerCase());
    return idx !== undefined ? new RuntimeSchema(this, idx) : undefined;
  }

  /** Iterate all schemas. */
  public *getSchemas(): IterableIterator<RuntimeSchema> {
    for (let i = 0; i < this.schemas.length; i++)
      yield new RuntimeSchema(this, i);
  }

  /** Find a class by qualified name ("SchemaName:ClassName" or "SchemaName.ClassName").
   * The namespace part matches schema name first, then alias. Case-insensitive.
   */
  public findClass(qualifiedName: string): RuntimeClass | undefined {
    const idx = this.resolveClassIdx(qualifiedName);
    return idx !== -1 ? new RuntimeClass(this, idx) : undefined;
  }

  /** Find a view by qualified name ("SchemaName:ViewName" or "SchemaName.ViewName").
   * The namespace part matches schema name first, then alias. Case-insensitive.
   */
  public findView(qualifiedName: string): RuntimeView | undefined {
    const sep = qualifiedName.indexOf(":");
    const dotSep = sep === -1 ? qualifiedName.indexOf(".") : -1;
    const splitAt = sep !== -1 ? sep : dotSep;
    if (splitAt === -1) return undefined;

    const ns = qualifiedName.substring(0, splitAt).toLowerCase();
    const vn = qualifiedName.substring(splitAt + 1).toLowerCase();

    let schemaIdx = this.schemaByName.get(ns);
    if (schemaIdx === undefined)
      schemaIdx = this.schemaByAlias.get(ns);
    if (schemaIdx === undefined) return undefined;

    const viewMap = this.viewByName.get(schemaIdx);
    const viewIdx = viewMap?.get(vn);
    return viewIdx !== undefined ? new RuntimeView(this, viewIdx) : undefined;
  }

  /** Parse a binary blob into a RuntimeSchemaContext. Synchronous. */
  public static fromBinary(blob: Uint8Array): RuntimeSchemaContext {
    return parseRuntimeSchemaBlob(blob);
  }

  /** Build from a pre-populated builder (used by ECSQL loader or binary parser). */
  public static fromBuilder(builder: RuntimeSchemaContextBuilder): RuntimeSchemaContext {
    return builder.build();
  }

  // --- Internal helpers used by view objects ---

  /** @internal */
  public resolveClassIdx(qualifiedName: string): number {
    const sep = qualifiedName.indexOf(":");
    const dotSep = sep === -1 ? qualifiedName.indexOf(".") : -1;
    const splitAt = sep !== -1 ? sep : dotSep;
    if (splitAt === -1) return -1;

    const ns = qualifiedName.substring(0, splitAt).toLowerCase();
    const cn = qualifiedName.substring(splitAt + 1).toLowerCase();

    let schemaIdx = this.schemaByName.get(ns);
    if (schemaIdx === undefined)
      schemaIdx = this.schemaByAlias.get(ns);
    if (schemaIdx === undefined) return -1;

    const classMap = this.classByName.get(schemaIdx);
    const classIdx = classMap?.get(cn);
    return classIdx ?? -1;
  }

  /** @internal */
  public getTransitiveBases(classIdx: number): ReadonlySet<number> {
    const cached = this.transitiveBaseCache.get(classIdx);
    if (cached !== undefined) return cached;

    const result = new Set<number>();
    this._buildTransitiveBases(classIdx, result);
    this.transitiveBaseCache.set(classIdx, result);
    return result;
  }

  private _buildTransitiveBases(classIdx: number, result: Set<number>): void {
    const cls = this.classes[classIdx];

    if (cls.baseClassIdx !== -1 && !result.has(cls.baseClassIdx)) {
      result.add(cls.baseClassIdx);
      this._buildTransitiveBases(cls.baseClassIdx, result);
    }

    for (let i = 0; i < cls.mixinCount; i++) {
      const mixinIdx = this.classMixins[cls.mixinStartIdx + i];
      if (!result.has(mixinIdx)) {
        result.add(mixinIdx);
        this._buildTransitiveBases(mixinIdx, result);
      }
    }
  }

  /** @internal */
  public resolveAllProperties(classIdx: number): readonly PropertyRef[] {
    const cached = this.inheritedPropsCache.get(classIdx);
    if (cached !== undefined) return cached;

    const merged = new Map<string, { ref: PropertyRef; classIdx: number }>();
    this._collectProperties(classIdx, merged);

    const result = Array.from(merged.values(), (v) => v.ref);
    this.inheritedPropsCache.set(classIdx, result);
    return result;
  }

  private _collectProperties(
    classIdx: number,
    merged: Map<string, { ref: PropertyRef; classIdx: number }>,
  ): void {
    const cls = this.classes[classIdx];

    // 1. Base class (recursive, depth-first)
    if (cls.baseClassIdx !== -1)
      this._collectProperties(cls.baseClassIdx, merged);

    // 2. Mixins in declaration order
    for (let i = 0; i < cls.mixinCount; i++) {
      const mixinIdx = this.classMixins[cls.mixinStartIdx + i];
      this._collectMixinProperties(mixinIdx, merged);
    }

    // 3. Own properties - always override
    for (let i = 0; i < cls.ownPropCount; i++) {
      const ref = this.propertyRefs[cls.ownPropStart + i];
      const nameKey = this.lowerStrings[this.propDefs[ref.defIdx].nameSid];
      merged.set(nameKey, { ref, classIdx });
    }
  }

  private _collectMixinProperties(
    mixinIdx: number,
    merged: Map<string, { ref: PropertyRef; classIdx: number }>,
  ): void {
    const mixin = this.classes[mixinIdx];

    // Walk mixin's own base chain (mixins can extend other mixins)
    if (mixin.baseClassIdx !== -1)
      this._collectMixinProperties(mixin.baseClassIdx, merged);

    // Mixin's own mixins
    for (let i = 0; i < mixin.mixinCount; i++) {
      const subMixinIdx = this.classMixins[mixin.mixinStartIdx + i];
      this._collectMixinProperties(subMixinIdx, merged);
    }

    // Mixin's own properties - only set if not already present (first mixin wins)
    for (let i = 0; i < mixin.ownPropCount; i++) {
      const ref = this.propertyRefs[mixin.ownPropStart + i];
      const nameKey = this.lowerStrings[this.propDefs[ref.defIdx].nameSid];
      if (!merged.has(nameKey))
        merged.set(nameKey, { ref, classIdx: mixinIdx });
    }
  }

  /** @internal */
  public buildDerivedClassMap(): ReadonlyMap<number, readonly number[]> {
    if (this.derivedClassMap !== undefined) return this.derivedClassMap;

    const map = new Map<number, number[]>();
    for (let i = 0; i < this.classes.length; i++) {
      const baseIdx = this.classes[i].baseClassIdx;
      if (baseIdx !== -1) {
        let arr = map.get(baseIdx);
        if (arr === undefined) {
          arr = [];
          map.set(baseIdx, arr);
        }
        arr.push(i);
      }
    }
    this.derivedClassMap = map;
    return map;
  }

  /** @internal - Resolve a property by name for a given class (including inherited). */
  public findPropertyRef(classIdx: number, name: string): { ref: PropertyRef; classIdx: number } | undefined {
    const allProps = this.resolveAllProperties(classIdx);
    const lowerName = name.toLowerCase();
    for (const ref of allProps) {
      if (this.lowerStrings[this.propDefs[ref.defIdx].nameSid] === lowerName)
        return { ref, classIdx };
    }
    return undefined;
  }
}

/** Builder for constructing an immutable `RuntimeSchemaContext`.
 *
 * Collects data during population (from binary parsing or ECSQL queries), then freezes it into
 * a context. Handles string interning and property definition deduplication.
 * @beta
 */
export class RuntimeSchemaContextBuilder {
  private readonly _strings: string[] = [""];  // SID 0 = empty string
  private readonly _lowerStrings: string[] = [""];
  private readonly _stringMap = new Map<string, number>(); // lowercase -> SID

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
  private readonly _views: ViewData[] = [];

  // For PropertyDef dedup
  private readonly _propDefMap = new Map<string, number>(); // signature string -> defIdx

  /** Intern a string, returning its SID. Empty/undefined strings return 0. */
  public internString(value: string | undefined): number {
    if (value === undefined || value === "") return 0;
    const lower = value.toLowerCase();
    const existing = this._stringMap.get(lower);
    if (existing !== undefined) return existing;
    const sid = this._strings.length;
    this._strings.push(value);
    this._lowerStrings.push(lower);
    this._stringMap.set(lower, sid);
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

  /** Add a view. Returns its index. */
  public addView(data: ViewData): number {
    const idx = this._views.length;
    this._views.push(data);
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

  /** The current count of views (used to set viewRangeStart on SchemaData). */
  public get viewsCount(): number { return this._views.length; }

  /** Get a string by SID. @internal */
  public getString(sid: number): string { return this._strings[sid]; }

  /** Replace class data at the given index (used during deferred cross-ref resolution). @internal */
  public updateClass(classIdx: number, data: ClassData): void { this._classes[classIdx] = data; }

  /** Update range fields on a schema (used after all items for a schema are collected). @internal */
  public updateSchemaRanges(schemaIdx: number, ranges: { classRangeStart: number; classCount: number; enumRangeStart: number; enumCount: number; koqRangeStart: number; koqCount: number; catRangeStart: number; catCount: number; viewRangeStart: number; viewCount: number }): void {
    const s = this._schemas[schemaIdx];
    this._schemas[schemaIdx] = { ...s, ...ranges };
  }

  /** Freeze all data and produce an immutable RuntimeSchemaContext. */
  public build(): RuntimeSchemaContext {
    const schemaByName = new Map<string, number>();
    const schemaByAlias = new Map<string, number>();
    const classByName = new Map<number, Map<string, number>>();
    const enumByName = new Map<number, Map<string, number>>();
    const koqByName = new Map<number, Map<string, number>>();
    const catByName = new Map<number, Map<string, number>>();
    const viewByName = new Map<number, Map<string, number>>();

    // Build schema lookup maps
    for (let i = 0; i < this._schemas.length; i++) {
      const s = this._schemas[i];
      schemaByName.set(this._lowerStrings[s.nameSid], i);
      if (s.aliasSid !== 0)
        schemaByAlias.set(this._lowerStrings[s.aliasSid], i);

      // Build class-by-name map for this schema
      const classMap = new Map<string, number>();
      for (let c = s.classRangeStart; c < s.classRangeStart + s.classCount; c++)
        classMap.set(this._lowerStrings[this._classes[c].nameSid], c);
      classByName.set(i, classMap);

      // Build enum-by-name map for this schema
      const eMap = new Map<string, number>();
      for (let e = s.enumRangeStart; e < s.enumRangeStart + s.enumCount; e++)
        eMap.set(this._lowerStrings[this._enumerations[e].nameSid], e);
      enumByName.set(i, eMap);

      // Build koq-by-name map for this schema
      const kMap = new Map<string, number>();
      for (let k = s.koqRangeStart; k < s.koqRangeStart + s.koqCount; k++)
        kMap.set(this._lowerStrings[this._koqs[k].nameSid], k);
      koqByName.set(i, kMap);

      // Build category-by-name map for this schema
      const cMap = new Map<string, number>();
      for (let p = s.catRangeStart; p < s.catRangeStart + s.catCount; p++)
        cMap.set(this._lowerStrings[this._propCategories[p].nameSid], p);
      catByName.set(i, cMap);

      // Build view-by-name map for this schema
      const vMap = new Map<string, number>();
      for (let v = s.viewRangeStart; v < s.viewRangeStart + s.viewCount; v++)
        vMap.set(this._lowerStrings[this._views[v].nameSid], v);
      viewByName.set(i, vMap);
    }

    return new RuntimeSchemaContext(
      this._strings,
      this._lowerStrings,
      this._schemas,
      this._classes,
      this._classMixins,
      this._propDefs,
      this._propertyRefs,
      this._relConstraints,
      this._constraintClassRefs,
      this._enumerations,
      this._enumerators,
      this._koqs,
      this._propCategories,
      this._views,
      schemaByName,
      schemaByAlias,
      classByName,
      enumByName,
      koqByName,
      catByName,
      viewByName,
    );
  }

  /** Produce a dedup signature for a PropertyDef. */
  private _propDefSignature(def: PropertyDef): string {
    return `${this._lowerStrings[def.nameSid]}|${def.kind}|${def.primitiveType}|${def.extTypeSid}|${def.enumIdx}|${def.koqIdx}|${def.structClassIdx}|${def.navRelClassIdx}|${def.navDirection}|${def.categoryIdx}|${def.isReadOnly ? 1 : 0}|${def.isHidden ? 1 : 0}|${def.arrayMinOccurs}|${def.arrayMaxOccurs}`;
  }
}
