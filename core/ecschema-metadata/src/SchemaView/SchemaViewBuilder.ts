/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import type { ClassData, EnumerationData, EnumeratorData, KoqData, PropCategoryData, PropertyDef, PropertyRef, RelConstraintData, SchemaData } from "./SchemaViewInterfaces";
import { SchemaView, type SchemaViewData } from "./SchemaView";

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

  // Lookup maps - owned by the builder so a husk can share and extend them across fragment merges.
  // `build()` and each merge call `extendLookupMaps()`; the view receives these same Map objects
  // via `assembleData()`, so in-place growth is visible.
  private readonly _schemaByName = new Map<string, number>();
  private readonly _schemaByAlias = new Map<string, number>();
  private readonly _classByName = new Map<number, Map<string, number>>();
  private readonly _enumByName = new Map<number, Map<string, number>>();
  private readonly _koqByName = new Map<number, Map<string, number>>();
  private readonly _catByName = new Map<number, Map<string, number>>();
  private _lookupMapsBuiltUpto = 0; // number of schemas whose lookup entries are already built

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

  // The counts below are the base indices fragment merging uses to translate a fragment's local
  // indices into global ones.

  /** The current count of schemas. @internal */
  public get schemaCount(): number { return this._schemas.length; }

  /** The current count of classes. @internal */
  public get classCount(): number { return this._classes.length; }

  /** The current count of enumerations. @internal */
  public get enumerationCount(): number { return this._enumerations.length; }

  /** The current count of KindOfQuantities. @internal */
  public get koqCount(): number { return this._koqs.length; }

  /** The current count of property categories. @internal */
  public get propCategoryCount(): number { return this._propCategories.length; }

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
    this.extendLookupMaps();
    return new SchemaView(this.assembleData(), schemaToken);
  }

  /** Build lookup-map entries for any schemas added since the last call. Idempotent and
   * append-only, so it is safe to call after each fragment merge. A schema's item ranges must
   * already be finalized (via `updateSchemaRanges`) before it is processed.
   * @internal */
  public extendLookupMaps(): void {
    for (let i = this._lookupMapsBuiltUpto; i < this._schemas.length; i++) {
      const s = this._schemas[i];
      this._schemaByName.set(this._lowerStrings[s.nameStringIdx], i);
      if (s.aliasStringIdx !== 0)
        this._schemaByAlias.set(this._lowerStrings[s.aliasStringIdx], i);

      // Build class-by-name map for this schema
      const classMap = new Map<string, number>();
      for (let c = s.classRangeStart; c < s.classRangeStart + s.classCount; c++)
        classMap.set(this._lowerStrings[this._classes[c].nameStringIdx], c);
      this._classByName.set(i, classMap);

      // Build enum-by-name map for this schema
      const eMap = new Map<string, number>();
      for (let e = s.enumRangeStart; e < s.enumRangeStart + s.enumCount; e++)
        eMap.set(this._lowerStrings[this._enumerations[e].nameStringIdx], e);
      this._enumByName.set(i, eMap);

      // Build koq-by-name map for this schema
      const kMap = new Map<string, number>();
      for (let k = s.koqRangeStart; k < s.koqRangeStart + s.koqCount; k++)
        kMap.set(this._lowerStrings[this._koqs[k].nameStringIdx], k);
      this._koqByName.set(i, kMap);

      // Build category-by-name map for this schema
      const cMap = new Map<string, number>();
      for (let p = s.catRangeStart; p < s.catRangeStart + s.catCount; p++)
        cMap.set(this._lowerStrings[this._propCategories[p].nameStringIdx], p);
      this._catByName.set(i, cMap);
    }
    this._lookupMapsBuiltUpto = this._schemas.length;
  }

  /** Assemble a {@link SchemaViewData} bag that references this builder's live arrays and lookup
   * maps. Continued building - fragment merges that append to the arrays and extend the maps in
   * place - is visible through the shared references, so a husk holding this data sees merged
   * schemas without rebuilding. @internal */
  public assembleData(): SchemaViewData {
    return {
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
      schemaByName: this._schemaByName,
      schemaByAlias: this._schemaByAlias,
      classByName: this._classByName,
      enumByName: this._enumByName,
      koqByName: this._koqByName,
      catByName: this._catByName,
    };
  }

  /** Produce a dedup signature for a PropertyDef. Label and priority are excluded because
   * they are per-PropertyRef overrides, not part of the structural definition.
   * Uses SIDs (not lowercase strings) for name/description so that case-preserving names
   * stay distinct - matching the C++ writer's dedup behavior. */
  private _propDefSignature(def: PropertyDef): string {
    return `${def.nameStringIdx}|${def.kind}|${def.primitiveType}|${def.extTypeStringIdx}|${def.enumIdx}|${def.koqIdx}|${def.structClassIdx}|${def.navRelClassIdx}|${def.navDirection}|${def.categoryIdx}|${def.isReadOnly ? 1 : 0}|${def.isHidden ? 1 : 0}|${def.arrayMinOccurs}|${def.arrayMaxOccurs}|${def.descriptionStringIdx}`;
  }
}
