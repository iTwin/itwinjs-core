/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import type { RuntimeSchemaContext } from "./RuntimeSchemaContext";
import { StrengthDirection, StrengthType } from "./ECObjects";
import { ClassModifier, ClassType, PropertyKind, PropertyRef, RuntimePrimitiveType } from "./RuntimeSchemaInterfaces";

/** Lightweight view over a schema in a `RuntimeSchemaContext`. Holds only a context reference and
 * an index - no data duplication, no mutable state.
 * @beta
 */
export class RuntimeSchema {
  /** @internal */
  constructor(
    private readonly _ctx: RuntimeSchemaContext,
    /** @internal */ public readonly idx: number,
  ) { }

  private get _data() { return this._ctx.schemas[this.idx]; }

  /** Row ID from ec_Schema. Matches `ECInstanceId` in ECDbMeta views, e.g.
   * `SELECT * FROM meta.ECSchemaDef WHERE ECInstanceId = ?`.
   *
   * This is not an array index or internal handle - it is the database row ID from the ec_Schema
   * table, carried through the binary blob so consumers can fall back to ECSQL meta-queries for
   * data not included in the runtime context (custom attributes, schema references, etc.).
   */
  public get ecInstanceId(): number { return this._data.ecInstanceId; }
  public get name(): string { return this._ctx.strings[this._data.nameSid]; }
  public get alias(): string { return this._ctx.strings[this._data.aliasSid]; }
  public get label(): string {
    const sid = this._data.labelSid;
    return sid !== 0 ? this._ctx.strings[sid] : this.name;
  }
  public get description(): string {
    const sid = this._data.descriptionSid;
    return sid !== 0 ? this._ctx.strings[sid] : "";
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
    return `${this._ctx.strings[d.nameSid]}.${String(d.versionRead).padStart(2, "0")}.${String(d.versionWrite).padStart(2, "0")}.${String(d.versionMinor).padStart(2, "0")}`;
  }

  /** Find a class by name within this schema (case-insensitive). */
  public getClass(name: string): RuntimeClass | undefined {
    const classMap = this._ctx.classByName.get(this.idx);
    const classIdx = classMap?.get(name.toLowerCase());
    return classIdx !== undefined ? createRuntimeClass(this._ctx, classIdx) : undefined;
  }

  /** Iterate all classes in this schema (excluding views - use `getViews()` for those). */
  public *getClasses(): IterableIterator<RuntimeClass> {
    const d = this._data;
    for (let i = d.classRangeStart; i < d.classRangeStart + d.classCount; i++) {
      if (this._ctx.classes[i].type !== ClassType.View)
        yield createRuntimeClass(this._ctx, i);
    }
  }

  /** Find an enumeration by name within this schema (case-insensitive). */
  public getEnumeration(name: string): RuntimeEnumeration | undefined {
    const map = this._ctx.enumByName.get(this.idx);
    const idx = map?.get(name.toLowerCase());
    return idx !== undefined ? new RuntimeEnumeration(this._ctx, idx) : undefined;
  }

  /** Find a KindOfQuantity by name within this schema (case-insensitive). */
  public getKindOfQuantity(name: string): RuntimeKoQ | undefined {
    const map = this._ctx.koqByName.get(this.idx);
    const idx = map?.get(name.toLowerCase());
    return idx !== undefined ? new RuntimeKoQ(this._ctx, idx) : undefined;
  }

  /** Find a PropertyCategory by name within this schema (case-insensitive). */
  public getPropertyCategory(name: string): RuntimePropertyCategory | undefined {
    const map = this._ctx.catByName.get(this.idx);
    const idx = map?.get(name.toLowerCase());
    return idx !== undefined ? new RuntimePropertyCategory(this._ctx, idx) : undefined;
  }

  /** Find a view by name within this schema (case-insensitive).
   * Views are classes with `ClassType.View` - this is a convenience filter over `getClass()`. */
  public getView(name: string): RuntimeClass | undefined {
    const cls = this.getClass(name);
    return cls !== undefined && cls.isView() ? cls : undefined;
  }

  /** Iterate all views in this schema. */
  public *getViews(): IterableIterator<RuntimeClass> {
    const d = this._data;
    for (let i = d.classRangeStart; i < d.classRangeStart + d.classCount; i++) {
      if (this._ctx.classes[i].type === ClassType.View)
        yield createRuntimeClass(this._ctx, i);
    }
  }

  /** Iterate all enumerations in this schema. */
  public *getEnumerations(): IterableIterator<RuntimeEnumeration> {
    const d = this._data;
    for (let i = d.enumRangeStart; i < d.enumRangeStart + d.enumCount; i++)
      yield new RuntimeEnumeration(this._ctx, i);
  }

  /** Iterate all KindOfQuantity items in this schema. */
  public *getKindOfQuantities(): IterableIterator<RuntimeKoQ> {
    const d = this._data;
    for (let i = d.koqRangeStart; i < d.koqRangeStart + d.koqCount; i++)
      yield new RuntimeKoQ(this._ctx, i);
  }

  /** Iterate all PropertyCategory items in this schema. */
  public *getPropertyCategories(): IterableIterator<RuntimePropertyCategory> {
    const d = this._data;
    for (let i = d.catRangeStart; i < d.catRangeStart + d.catCount; i++)
      yield new RuntimePropertyCategory(this._ctx, i);
  }
}

/** Lightweight view over a class in a `RuntimeSchemaContext`. For relationship-specific
 * fields (strength, direction, source/target constraints), narrow via `isRelationship()`
 * or `assertRelationship()` to get a `RuntimeRelationshipClass`.
 * @beta
 */
export class RuntimeClass {
  /** @internal */
  constructor(
    protected readonly _ctx: RuntimeSchemaContext,
    /** @internal */ public readonly idx: number,
  ) { }

  protected get _data() { return this._ctx.classes[this.idx]; }

  /** Row ID from ec_Class. Matches `ECInstanceId` in ECDbMeta views, e.g.
   * `SELECT * FROM meta.ECClassDef WHERE ECInstanceId = ?`.
   */
  public get ecInstanceId(): number { return this._data.ecInstanceId; }
  public get name(): string { return this._ctx.strings[this._data.nameSid]; }
  public get label(): string {
    const sid = this._data.labelSid;
    return sid !== 0 ? this._ctx.strings[sid] : this.name;
  }
  public get description(): string {
    const sid = this._data.descriptionSid;
    return sid !== 0 ? this._ctx.strings[sid] : "";
  }
  /** "SchemaName:ClassName" - colon-separated, matching the EC class full name convention.
   * Use either ":" or "." as separator when passing to `findClass()`. */
  public get fullName(): string {
    const d = this._data;
    return `${this._ctx.strings[this._ctx.schemas[d.schemaIdx].nameSid]}:${this._ctx.strings[d.nameSid]}`;
  }
  public get schema(): RuntimeSchema { return new RuntimeSchema(this._ctx, this._data.schemaIdx); }
  public get type(): ClassType { return this._data.type; }
  public get modifier(): ClassModifier { return this._data.modifier; }

  // Type check methods (parallel to RuntimeProperty's isPrimitive/isStruct/etc.)

  // disabling lint rule for these because we explicitly want them to mirror same methods in ecschema-metadata, to make the APIs more compatible
  // eslint-disable-next-line @itwin/prefer-get
  public isEntity(): boolean { return this._data.type === ClassType.Entity; }
  /** Type predicate - narrows to `RuntimeRelationshipClass` for access to strength, direction,
   * source, and target constraint fields. */
  public isRelationship(): this is RuntimeRelationshipClass { return this._data.type === ClassType.Relationship; }
  // eslint-disable-next-line @itwin/prefer-get
  public isStruct(): boolean { return this._data.type === ClassType.Struct; }
  // eslint-disable-next-line @itwin/prefer-get
  public isMixin(): boolean { return this._data.type === ClassType.Mixin; }
  // eslint-disable-next-line @itwin/prefer-get
  public isCustomAttribute(): boolean { return this._data.type === ClassType.CustomAttribute; }
  // eslint-disable-next-line @itwin/prefer-get
  public isView(): boolean { return this._data.type === ClassType.View; }

  /** @see isRelationship */
  public assertRelationship(): asserts this is RuntimeRelationshipClass {
    if (!this.isRelationship())
      throw new Error(`Expected a relationship class, got type ${this.type} for "${this.fullName}"`);
  }

  // Modifier checks
  public get isAbstract(): boolean { return this._data.modifier === ClassModifier.Abstract; }
  public get isSealed(): boolean { return this._data.modifier === ClassModifier.Sealed; }

  /** Reflects the `HiddenClass` custom attribute from `CoreCustomAttributes`.
   * Classes marked hidden are typically excluded from UI display but remain accessible programmatically. */
  public get isHidden(): boolean { return this._data.isHidden; }

  // Hierarchy

  /** Single base class. undefined for root classes. */
  public get baseClass(): RuntimeClass | undefined {
    const idx = this._data.baseClassIdx;
    return idx !== -1 ? createRuntimeClass(this._ctx, idx) : undefined;
  }

  /** Applied mixins in declaration order. Only meaningful for entity classes. */
  public get mixins(): readonly RuntimeClass[] {
    const d = this._data;
    if (d.mixinCount === 0) return [];
    const result: RuntimeClass[] = [];
    for (let i = 0; i < d.mixinCount; i++) {
      const mixinIdx = this._ctx.classMixins[d.mixinStartIdx + i];
      if (mixinIdx === -1 || mixinIdx === undefined) continue; // safety: dangling mixin ref from excluded schema
      result.push(createRuntimeClass(this._ctx, mixinIdx));
    }
    return result;
  }

  /** IS-A check. Returns true if this class is, or derives from, `other` (transitively, including mixins).
   * Accepts a `RuntimeClass` or a qualified name string ("SchemaName:ClassName").
   */
  public is(classOrName: RuntimeClass | string): boolean {
    const targetIdx = typeof classOrName === "string"
      ? this._ctx.resolveClassIdx(classOrName)
      : classOrName.idx;
    if (targetIdx === -1) return false;
    if (this.idx === targetIdx) return true;
    return this._ctx.getTransitiveBases(this.idx).has(targetIdx);
  }

  /** Direct derived classes. Expensive on first call (builds reverse map across all classes). */
  public get derivedClasses(): readonly RuntimeClass[] {
    const map = this._ctx.buildDerivedClassMap();
    const indices = map.get(this.idx);
    if (indices === undefined) return [];
    return indices.map((i) => createRuntimeClass(this._ctx, i));
  }

  // Properties

  /** Find a property by name (case-insensitive). Searches own + inherited. */
  public getProperty(name: string): RuntimeProperty | undefined {
    const allProps = this._ctx.resolveAllProperties(this.idx);
    const lowerName = name.toLowerCase();
    for (const rp of allProps) {
      if (this._ctx.lowerStrings[this._ctx.propDefs[rp.ref.defIdx].nameSid] === lowerName)
        return createRuntimeProperty(this._ctx, rp.ref, rp.classIdx);
    }
    return undefined;
  }

  /** All properties including inherited, in inheritance order (base first, then mixins, then own). */
  public getProperties(): readonly RuntimeProperty[] {
    const allRefs = this._ctx.resolveAllProperties(this.idx);
    return allRefs.map((rp) => createRuntimeProperty(this._ctx, rp.ref, rp.classIdx));
  }

  /** Own properties only (not inherited), in ordinal order. */
  public getOwnProperties(): readonly RuntimeProperty[] {
    const d = this._data;
    const result: RuntimeProperty[] = [];
    for (let i = 0; i < d.ownPropCount; i++) {
      const ref = this._ctx.propertyRefs[d.ownPropStart + i];
      result.push(createRuntimeProperty(this._ctx, ref, this.idx));
    }
    return result;
  }
}

/** A relationship class with constraint and strength metadata. Created by `createRuntimeClass()`
 * when the underlying `ClassType` is `Relationship`. Use `cls.isRelationship()` to narrow a
 * `RuntimeClass` to this type.
 * @beta
 */
export class RuntimeRelationshipClass extends RuntimeClass {
  public get strength(): StrengthType { return this._data.strength; }
  public get strengthDirection(): StrengthDirection { return this._data.strengthDirection; }

  public get source(): RuntimeRelConstraint | undefined {
    const idx = this._data.sourceConstraintIdx;
    return idx !== -1 ? new RuntimeRelConstraint(this._ctx, idx) : undefined;
  }

  public get target(): RuntimeRelConstraint | undefined {
    const idx = this._data.targetConstraintIdx;
    return idx !== -1 ? new RuntimeRelConstraint(this._ctx, idx) : undefined;
  }
}

/** @internal */
export function createRuntimeClass(ctx: RuntimeSchemaContext, idx: number): RuntimeClass {
  if (ctx.classes[idx].type === ClassType.Relationship)
    return new RuntimeRelationshipClass(ctx, idx);
  return new RuntimeClass(ctx, idx);
}

/** Lightweight view over a property in a `RuntimeSchemaContext`. Subclasses provide
 * type-safe access to kind-specific fields. Use `isPrimitive()`, `isStruct()`,
 * `isArray()`, or `isNavigation()` to narrow, or the corresponding `assert*()` methods.
 * @beta
 */
export abstract class RuntimeProperty {
  /** @internal */
  constructor(
    protected readonly _ctx: RuntimeSchemaContext,
    private readonly _ref: PropertyRef,
    /** Index of the class that declared or contributed this property through inheritance.
     * For own properties, this is the class itself. For inherited properties, this is the
     * base class or mixin that introduced it. -1 for view properties. */
    private readonly _classIdx: number,
  ) { }

  /** @internal */
  protected get _def() { return this._ctx.propDefs[this._ref.defIdx]; }

  /** Row ID from ec_Property. Matches `ECInstanceId` in ECDbMeta views, e.g.
   * `SELECT * FROM meta.ECPropertyDef WHERE ECInstanceId = ?`.
   *
   * Stored per-reference (not per-definition) because each class-property pair has a unique
   * ec_Property row even when the structural definition is deduplicated.
   */
  public get ecInstanceId(): number { return this._ref.ecInstanceId; }
  public get name(): string { return this._ctx.strings[this._def.nameSid]; }
  /** Display label. Falls back to the property name if no explicit label is set.
   * Labels are stored per-reference (not per-definition) because EC allows class overrides. */
  public get label(): string {
    const labelSid = this._ref.labelSid;
    return labelSid !== 0 ? this._ctx.strings[labelSid] : this.name;
  }
  public get description(): string {
    const sid = this._def.descriptionSid;
    return sid !== 0 ? this._ctx.strings[sid] : "";
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
  public get declaringClass(): RuntimeClass | undefined {
    return this._classIdx !== -1 ? createRuntimeClass(this._ctx, this._classIdx) : undefined;
  }

  /** Property category, or undefined if none assigned. Available on all property kinds. */
  public get category(): RuntimePropertyCategory | undefined {
    const idx = this._def.categoryIdx;
    return idx !== -1 ? new RuntimePropertyCategory(this._ctx, idx) : undefined;
  }

  // Type guards - real type predicates that narrow `this`

  /** True for `RuntimePrimitiveProperty` and `RuntimePrimitiveArrayProperty`.
   * Matches ecschema-metadata behavior where `isPrimitive()` includes primitive arrays. */
  public isPrimitive(): this is AnyRuntimePrimitiveProperty {
    return this._def.kind === PropertyKind.Primitive || this._def.kind === PropertyKind.PrimitiveArray;
  }
  /** True for `RuntimeStructProperty` and `RuntimeStructArrayProperty`. */
  public isStruct(): this is AnyRuntimeStructProperty {
    return this._def.kind === PropertyKind.Struct || this._def.kind === PropertyKind.StructArray;
  }
  /** True for `RuntimePrimitiveArrayProperty` and `RuntimeStructArrayProperty`. */
  public isArray(): this is AnyRuntimeArrayProperty {
    return this._def.kind === PropertyKind.PrimitiveArray || this._def.kind === PropertyKind.StructArray;
  }
  /** True for `RuntimeNavigationProperty`. */
  public isNavigation(): this is RuntimeNavigationProperty {
    return this._def.kind === PropertyKind.Navigation;
  }
  /** True if this property is backed by an enumeration. Enumerations are a facet of primitive
   * properties - an enum property IS a primitive property with an enum binding. Narrows to
   * `AnyRuntimePrimitiveProperty` so you can access `enumeration`, `primitiveType`, etc. */
  public isEnumeration(): this is AnyRuntimePrimitiveProperty {
    return this._def.enumIdx !== -1;
  }

  // Assert methods - throw on mismatch, narrow `this`

  /** @see isPrimitive */
  public assertPrimitive(): asserts this is AnyRuntimePrimitiveProperty {
    if (!this.isPrimitive())
      throw new Error(`Expected a primitive property, got ${PropertyKind[this.kind]}`);
  }
  /** @see isStruct */
  public assertStruct(): asserts this is AnyRuntimeStructProperty {
    if (!this.isStruct())
      throw new Error(`Expected a struct property, got ${PropertyKind[this.kind]}`);
  }
  /** @see isArray */
  public assertArray(): asserts this is AnyRuntimeArrayProperty {
    if (!this.isArray())
      throw new Error(`Expected an array property, got ${PropertyKind[this.kind]}`);
  }
  /** @see isNavigation */
  public assertNavigation(): asserts this is RuntimeNavigationProperty {
    if (!this.isNavigation())
      throw new Error(`Expected a navigation property, got ${PropertyKind[this.kind]}`);
  }
}

/** A scalar primitive property. May optionally be backed by an enumeration -
 * check `isEnumeration()` or `enumeration`.
 * @beta
 */
export class RuntimePrimitiveProperty extends RuntimeProperty {
  public get primitiveType(): RuntimePrimitiveType { return this._def.primitiveType; }
  public get extendedTypeName(): string | undefined {
    const sid = this._def.extTypeSid;
    return sid !== 0 ? this._ctx.strings[sid] : undefined;
  }
  public get enumeration(): RuntimeEnumeration | undefined {
    const idx = this._def.enumIdx;
    return idx !== -1 ? new RuntimeEnumeration(this._ctx, idx) : undefined;
  }
  public get kindOfQuantity(): RuntimeKoQ | undefined {
    const idx = this._def.koqIdx;
    return idx !== -1 ? new RuntimeKoQ(this._ctx, idx) : undefined;
  }
}

/** An array of primitive values. Same primitive/enum fields as `RuntimePrimitiveProperty`,
 * plus array bounds.
 * @beta
 */
export class RuntimePrimitiveArrayProperty extends RuntimeProperty {
  public get primitiveType(): RuntimePrimitiveType { return this._def.primitiveType; }
  public get extendedTypeName(): string | undefined {
    const sid = this._def.extTypeSid;
    return sid !== 0 ? this._ctx.strings[sid] : undefined;
  }
  public get enumeration(): RuntimeEnumeration | undefined {
    const idx = this._def.enumIdx;
    return idx !== -1 ? new RuntimeEnumeration(this._ctx, idx) : undefined;
  }
  public get kindOfQuantity(): RuntimeKoQ | undefined {
    const idx = this._def.koqIdx;
    return idx !== -1 ? new RuntimeKoQ(this._ctx, idx) : undefined;
  }
  public get arrayMinOccurs(): number | undefined { return this._def.arrayMinOccurs; }
  public get arrayMaxOccurs(): number | undefined { return this._def.arrayMaxOccurs; }
}

/** A scalar struct property. `structClass` is non-nullable - the binary parser drops
 * properties whose struct class can't be resolved (e.g. from excluded schemas).
 * @beta
 */
export class RuntimeStructProperty extends RuntimeProperty {
  public get structClass(): RuntimeClass {
    return createRuntimeClass(this._ctx, this._def.structClassIdx);
  }
}

/** An array of struct values. Same struct field as `RuntimeStructProperty`, plus array bounds.
 * @beta
 */
export class RuntimeStructArrayProperty extends RuntimeProperty {
  public get structClass(): RuntimeClass {
    return createRuntimeClass(this._ctx, this._def.structClassIdx);
  }
  public get arrayMinOccurs(): number | undefined { return this._def.arrayMinOccurs; }
  public get arrayMaxOccurs(): number | undefined { return this._def.arrayMaxOccurs; }
}

/** A navigation property. `relationshipClass` is non-nullable - the binary parser drops
 * properties whose relationship class can't be resolved.
 * @beta
 */
export class RuntimeNavigationProperty extends RuntimeProperty {
  public get direction(): StrengthDirection { return this._def.navDirection; }
  public get relationshipClass(): RuntimeRelationshipClass {
    return createRuntimeClass(this._ctx, this._def.navRelClassIdx) as RuntimeRelationshipClass;
  }
}

/** Any primitive property (scalar or array). Useful for accessing `primitiveType`,
 * `extendedTypeName`, `enumeration`, `kindOfQuantity` after an `isPrimitive()` check.
 * @beta
 */
export type AnyRuntimePrimitiveProperty = RuntimePrimitiveProperty | RuntimePrimitiveArrayProperty;

/** Any struct property (scalar or array). Useful for accessing `structClass` after an `isStruct()` check.
 * @beta
 */
export type AnyRuntimeStructProperty = RuntimeStructProperty | RuntimeStructArrayProperty;

/** Any array property (primitive or struct). Useful for accessing `arrayMinOccurs`/`arrayMaxOccurs`
 * after an `isArray()` check.
 * @beta
 */
export type AnyRuntimeArrayProperty = RuntimePrimitiveArrayProperty | RuntimeStructArrayProperty;

/** Union of all concrete property types.
 * @beta
 */
export type AnyRuntimeProperty = RuntimePrimitiveProperty | RuntimePrimitiveArrayProperty
  | RuntimeStructProperty | RuntimeStructArrayProperty | RuntimeNavigationProperty;

/** @internal */
export function createRuntimeProperty(ctx: RuntimeSchemaContext, ref: PropertyRef, classIdx: number): RuntimeProperty {
  const kind = ctx.propDefs[ref.defIdx].kind;
  switch (kind) {
    case PropertyKind.Primitive: return new RuntimePrimitiveProperty(ctx, ref, classIdx);
    case PropertyKind.PrimitiveArray: return new RuntimePrimitiveArrayProperty(ctx, ref, classIdx);
    case PropertyKind.Struct: return new RuntimeStructProperty(ctx, ref, classIdx);
    case PropertyKind.StructArray: return new RuntimeStructArrayProperty(ctx, ref, classIdx);
    case PropertyKind.Navigation: return new RuntimeNavigationProperty(ctx, ref, classIdx);
    default: throw new Error(`Unknown PropertyKind ${kind as number} for property "${ctx.strings[ctx.propDefs[ref.defIdx].nameSid]}"`);
  }
}

/** Lightweight view over an enumeration in a `RuntimeSchemaContext`.
 * @beta
 */
export class RuntimeEnumeration {
  /** @internal */
  constructor(
    private readonly _ctx: RuntimeSchemaContext,
    /** @internal */ public readonly idx: number,
  ) { }

  private get _data() { return this._ctx.enumerations[this.idx]; }

  /** Row ID from ec_Enumeration. Matches `ECInstanceId` in ECDbMeta views, e.g.
   * `SELECT * FROM meta.ECEnumerationDef WHERE ECInstanceId = ?`.
   */
  public get ecInstanceId(): number { return this._data.ecInstanceId; }
  public get name(): string { return this._ctx.strings[this._data.nameSid]; }
  public get label(): string {
    const sid = this._data.labelSid;
    return sid !== 0 ? this._ctx.strings[sid] : this.name;
  }
  public get description(): string {
    const sid = this._data.descriptionSid;
    return sid !== 0 ? this._ctx.strings[sid] : "";
  }
  /** "SchemaName:EnumName" - colon-separated. */
  public get fullName(): string {
    const d = this._data;
    return `${this._ctx.strings[this._ctx.schemas[d.schemaIdx].nameSid]}:${this._ctx.strings[d.nameSid]}`;
  }
  public get schema(): RuntimeSchema { return new RuntimeSchema(this._ctx, this._data.schemaIdx); }
  public get primitiveType(): RuntimePrimitiveType { return this._data.primitiveType; }
  public get isStrict(): boolean { return this._data.isStrict; }

  /** Iterate enumerators in declaration order. */
  public *getEnumerators(): IterableIterator<RuntimeEnumerator> {
    const d = this._data;
    for (let i = d.enumeratorStart; i < d.enumeratorStart + d.enumeratorCount; i++)
      yield new RuntimeEnumerator(this._ctx, i);
  }

  /** Find enumerator by name (case-insensitive). */
  public getEnumeratorByName(name: string): RuntimeEnumerator | undefined {
    const lower = name.toLowerCase();
    const d = this._data;
    for (let i = d.enumeratorStart; i < d.enumeratorStart + d.enumeratorCount; i++) {
      if (this._ctx.lowerStrings[this._ctx.enumerators[i].nameSid] === lower)
        return new RuntimeEnumerator(this._ctx, i);
    }
    return undefined;
  }

  /** Find enumerator by value. */
  public getEnumerator(value: number | string): RuntimeEnumerator | undefined {
    const d = this._data;
    for (let i = d.enumeratorStart; i < d.enumeratorStart + d.enumeratorCount; i++) {
      if (this._ctx.enumerators[i].value === value)
        return new RuntimeEnumerator(this._ctx, i);
    }
    return undefined;
  }
}

/** Thin view over an enumerator.
 * @beta
 */
export class RuntimeEnumerator {
  /** @internal */
  constructor(
    private readonly _ctx: RuntimeSchemaContext,
    /** @internal */ public readonly idx: number,
  ) { }

  private get _data() { return this._ctx.enumerators[this.idx]; }

  public get name(): string { return this._ctx.strings[this._data.nameSid]; }
  public get label(): string {
    const sid = this._data.labelSid;
    return sid !== 0 ? this._ctx.strings[sid] : this.name;
  }
  public get description(): string {
    const sid = this._data.descriptionSid;
    return sid !== 0 ? this._ctx.strings[sid] : "";
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
export interface RuntimePresentationFormat {
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

/** Parse a single format override string into a `RuntimePresentationFormat`.
 * @internal
 */
export function parseFormatString(formatString: string): RuntimePresentationFormat {
  const nameMatch = /^([\w.:]+)/.exec(formatString);
  if (!nameMatch)
    return { name: formatString };

  const name = nameMatch[1];
  const precMatch = /\((\d+)\)/.exec(formatString);
  const precision = precMatch ? parseInt(precMatch[1], 10) : undefined;

  const unitRgx = /\[([^\|\]]+)(?:\|([^\]]*))?\]/g;
  const units: Array<readonly [string, string | undefined]> = [];
  let m;
  while ((m = unitRgx.exec(formatString)) !== null)
    units.push([m[1], m[2] !== undefined ? m[2] : undefined]);

  return { name, precision, unitAndLabels: units.length > 0 ? units : undefined };
}

/** Lightweight view over a KindOfQuantity in a `RuntimeSchemaContext`.
 * @beta
 */
export class RuntimeKoQ {
  /** @internal */
  constructor(
    private readonly _ctx: RuntimeSchemaContext,
    /** @internal */ public readonly idx: number,
  ) { }

  private get _data() { return this._ctx.koqs[this.idx]; }

  /** Row ID from ec_KindOfQuantity. Matches `ECInstanceId` in ECDbMeta views, e.g.
   * `SELECT * FROM meta.ECKindOfQuantityDef WHERE ECInstanceId = ?`.
   */
  public get ecInstanceId(): number { return this._data.ecInstanceId; }
  public get name(): string { return this._ctx.strings[this._data.nameSid]; }
  public get label(): string {
    const sid = this._data.labelSid;
    return sid !== 0 ? this._ctx.strings[sid] : this.name;
  }
  public get description(): string {
    const sid = this._data.descriptionSid;
    return sid !== 0 ? this._ctx.strings[sid] : "";
  }
  /** "SchemaName:KoqName" - colon-separated. */
  public get fullName(): string {
    const d = this._data;
    return `${this._ctx.strings[this._ctx.schemas[d.schemaIdx].nameSid]}:${this._ctx.strings[d.nameSid]}`;
  }
  public get schema(): RuntimeSchema { return new RuntimeSchema(this._ctx, this._data.schemaIdx); }
  public get relativeError(): number { return this._data.relativeError; }
  /** Persistence unit as a full name string, e.g. "Units:M". */
  public get persistenceUnit(): string {
    const sid = this._data.persistenceUnitSid;
    return sid !== 0 ? this._ctx.strings[sid] : "";
  }
  // EC XML serializes this as "presentationUnits"; we use "presentationFormats" to align with KindOfQuantity.presentationFormats in ecschema-metadata.
  /** Raw presentation format string as stored in ECDb (`ec_KindOfQuantity.PresentationUnits`).
   * This is a JSON array of format override strings. Empty string if none are defined.
   * Prefer `presentationFormats` for structured access.
   */
  public get presentationFormatsRaw(): string {
    const sid = this._data.presentationFormatsSid;
    return sid !== 0 ? this._ctx.strings[sid] : "";
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
  public get presentationFormats(): readonly RuntimePresentationFormat[] {
    const raw = this.presentationFormatsRaw;
    if (raw === "")
      return [];
    const formats: string[] = JSON.parse(raw);
    return formats.map((f) => parseFormatString(f));
  }
}

/** Lightweight view over a PropertyCategory in a `RuntimeSchemaContext`.
 * @beta
 */
export class RuntimePropertyCategory {
  /** @internal */
  constructor(
    private readonly _ctx: RuntimeSchemaContext,
    /** @internal */ public readonly idx: number,
  ) { }

  private get _data() { return this._ctx.propCategories[this.idx]; }

  /** Row ID from ec_PropertyCategory. Matches `ECInstanceId` in ECDbMeta views, e.g.
   * `SELECT * FROM meta.ECPropertyCategoryDef WHERE ECInstanceId = ?`.
   */
  public get ecInstanceId(): number { return this._data.ecInstanceId; }
  public get name(): string { return this._ctx.strings[this._data.nameSid]; }
  public get label(): string {
    const sid = this._data.labelSid;
    return sid !== 0 ? this._ctx.strings[sid] : this.name;
  }
  public get description(): string {
    const sid = this._data.descriptionSid;
    return sid !== 0 ? this._ctx.strings[sid] : "";
  }
  /** "SchemaName:CategoryName" - colon-separated. */
  public get fullName(): string {
    const d = this._data;
    return `${this._ctx.strings[this._ctx.schemas[d.schemaIdx].nameSid]}:${this._ctx.strings[d.nameSid]}`;
  }
  public get schema(): RuntimeSchema { return new RuntimeSchema(this._ctx, this._data.schemaIdx); }
  public get priority(): number { return this._data.priority; }
}

/** Lightweight view over a relationship constraint in a `RuntimeSchemaContext`.
 * @beta
 */
export class RuntimeRelConstraint {
  /** @internal */
  constructor(
    private readonly _ctx: RuntimeSchemaContext,
    private readonly _idx: number,
  ) { }

  private get _data() { return this._ctx.relConstraints[this._idx]; }

  public get abstractConstraint(): RuntimeClass | undefined {
    const idx = this._data.abstractConstraintIdx;
    return idx !== -1 ? createRuntimeClass(this._ctx, idx) : undefined;
  }
  public get polymorphic(): boolean { return this._data.polymorphic; }
  /** Multiplicity lower bound (0 = unbounded). */
  public get multiplicityLower(): number { return this._data.multiplicityLower; }
  /** Multiplicity upper bound (0 = unbounded). */
  public get multiplicityUpper(): number { return this._data.multiplicityUpper; }
  /** Role label string, or empty if not set. */
  public get roleLabel(): string {
    const sid = this._data.roleLabelSid;
    return sid !== 0 ? this._ctx.strings[sid] : "";
  }
  public get constraintClasses(): readonly RuntimeClass[] {
    const d = this._data;
    const result: RuntimeClass[] = [];
    for (let i = 0; i < d.classRefCount; i++)
      result.push(createRuntimeClass(this._ctx, this._ctx.constraintClassRefs[d.classRefStart + i]));
    return result;
  }
}
