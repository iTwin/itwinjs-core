/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import type { RuntimeSchemaContext } from "./RuntimeSchemaContext";
import { ClassModifier, ClassType, PropertyKind, type PropertyRef, type RuntimePrimitiveType, type StrengthDirection, type StrengthType, type ViewData } from "./RuntimeSchemaInterfaces";

/** Lightweight view over a schema in a `RuntimeSchemaContext`. Holds only a context reference and
 * an index - no data duplication, no mutable state.
 * @beta
 */
export class RuntimeSchema {
  /** @internal */
  constructor(
    private readonly _ctx: RuntimeSchemaContext,
    /** @internal */ public readonly idx: number,
  ) {}

  private get _data() { return this._ctx.schemas[this.idx]; }

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

  /** "SchemaName.RR.WW.mm" */
  public get fullName(): string {
    const d = this._data;
    return `${this._ctx.strings[d.nameSid]}.${String(d.versionRead).padStart(2, "0")}.${String(d.versionWrite).padStart(2, "0")}.${String(d.versionMinor).padStart(2, "0")}`;
  }

  /** Find a class by name within this schema (case-insensitive). */
  public getClass(name: string): RuntimeClass | undefined {
    const classMap = this._ctx.classByName.get(this.idx);
    const classIdx = classMap?.get(name.toLowerCase());
    return classIdx !== undefined ? new RuntimeClass(this._ctx, classIdx) : undefined;
  }

  /** Iterate all classes in this schema. */
  public *getClasses(): IterableIterator<RuntimeClass> {
    const d = this._data;
    for (let i = d.classRangeStart; i < d.classRangeStart + d.classCount; i++)
      yield new RuntimeClass(this._ctx, i);
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

  /** Find a view by name within this schema (case-insensitive). */
  public getView(name: string): RuntimeView | undefined {
    const map = this._ctx.viewByName.get(this.idx);
    const idx = map?.get(name.toLowerCase());
    return idx !== undefined ? new RuntimeView(this._ctx, idx) : undefined;
  }

  /** Iterate all views in this schema. */
  public *getViews(): IterableIterator<RuntimeView> {
    const d = this._data;
    for (let i = d.viewRangeStart; i < d.viewRangeStart + d.viewCount; i++)
      yield new RuntimeView(this._ctx, i);
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

/** Lightweight view over a class in a `RuntimeSchemaContext`.
 * @beta
 */
export class RuntimeClass {
  /** @internal */
  constructor(
    private readonly _ctx: RuntimeSchemaContext,
    /** @internal */ public readonly idx: number,
  ) {}

  private get _data() { return this._ctx.classes[this.idx]; }

  public get name(): string { return this._ctx.strings[this._data.nameSid]; }
  public get label(): string {
    const sid = this._data.labelSid;
    return sid !== 0 ? this._ctx.strings[sid] : this.name;
  }
  /** "SchemaName:ClassName" */
  public get fullName(): string {
    const d = this._data;
    return `${this._ctx.strings[this._ctx.schemas[d.schemaIdx].nameSid]}:${this._ctx.strings[d.nameSid]}`;
  }
  public get schema(): RuntimeSchema { return new RuntimeSchema(this._ctx, this._data.schemaIdx); }
  public get type(): ClassType { return this._data.type; }
  public get modifier(): ClassModifier { return this._data.modifier; }

  // Type guards
  public get isEntityClass(): boolean { return this._data.type === ClassType.Entity; }
  public get isRelationshipClass(): boolean { return this._data.type === ClassType.Relationship; }
  public get isStructClass(): boolean { return this._data.type === ClassType.Struct; }
  public get isMixin(): boolean { return this._data.type === ClassType.Mixin; }
  public get isAbstract(): boolean { return this._data.modifier === ClassModifier.Abstract; }
  public get isSealed(): boolean { return this._data.modifier === ClassModifier.Sealed; }

  // Hierarchy

  /** Single base class. undefined for root classes. */
  public get baseClass(): RuntimeClass | undefined {
    const idx = this._data.baseClassIdx;
    return idx !== -1 ? new RuntimeClass(this._ctx, idx) : undefined;
  }

  /** Applied mixins in declaration order. Only meaningful for entity classes. */
  public get mixins(): readonly RuntimeClass[] {
    const d = this._data;
    if (d.mixinCount === 0) return [];
    const result: RuntimeClass[] = [];
    for (let i = 0; i < d.mixinCount; i++)
      result.push(new RuntimeClass(this._ctx, this._ctx.classMixins[d.mixinStartIdx + i]));
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
    return indices.map((i) => new RuntimeClass(this._ctx, i));
  }

  // Properties

  /** Find a property by name (case-insensitive). Searches own + inherited. */
  public getProperty(name: string): RuntimeProperty | undefined {
    const allProps = this._ctx.resolveAllProperties(this.idx);
    const lowerName = name.toLowerCase();
    for (const ref of allProps) {
      if (this._ctx.lowerStrings[this._ctx.propDefs[ref.defIdx].nameSid] === lowerName)
        return new RuntimeProperty(this._ctx, ref, this.idx);
    }
    return undefined;
  }

  /** All properties including inherited, in inheritance order (base first, then mixins, then own). */
  public getProperties(): readonly RuntimeProperty[] {
    const allRefs = this._ctx.resolveAllProperties(this.idx);
    return allRefs.map((ref) => new RuntimeProperty(this._ctx, ref, this.idx));
  }

  /** Own properties only (not inherited), in ordinal order. */
  public getOwnProperties(): readonly RuntimeProperty[] {
    const d = this._data;
    const result: RuntimeProperty[] = [];
    for (let i = 0; i < d.ownPropCount; i++) {
      const ref = this._ctx.propertyRefs[d.ownPropStart + i];
      result.push(new RuntimeProperty(this._ctx, ref, this.idx));
    }
    return result;
  }

  // Relationship-specific

  /** Relationship strength. Only meaningful for relationship classes. */
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

/** Lightweight view over a property in a `RuntimeSchemaContext`. Uses a single class with
 * kind-specific accessors rather than a subclass hierarchy.
 * @beta
 */
export class RuntimeProperty {
  /** @internal */
  constructor(
    private readonly _ctx: RuntimeSchemaContext,
    private readonly _ref: PropertyRef,
    private readonly _classIdx: number,
  ) {}

  private get _def() { return this._ctx.propDefs[this._ref.defIdx]; }

  public get name(): string { return this._ctx.strings[this._def.nameSid]; }
  public get label(): string {
    const labelSid = this._ref.labelSid;
    return labelSid !== 0 ? this._ctx.strings[labelSid] : this.name;
  }
  public get kind(): PropertyKind { return this._def.kind; }
  public get isReadOnly(): boolean { return this._def.isReadOnly; }
  public get isHidden(): boolean { return this._def.isHidden; }

  // Type discriminators
  public get isPrimitive(): boolean { return this._def.kind === PropertyKind.Primitive || this._def.kind === PropertyKind.PrimitiveArray; }
  public get isStruct(): boolean { return this._def.kind === PropertyKind.Struct || this._def.kind === PropertyKind.StructArray; }
  public get isArray(): boolean { return this._def.kind === PropertyKind.PrimitiveArray || this._def.kind === PropertyKind.StructArray; }
  public get isNavigation(): boolean { return this._def.kind === PropertyKind.Navigation; }
  public get isEnumeration(): boolean { return this._def.enumIdx !== -1; }

  // Primitive / enum properties
  public get primitiveType(): RuntimePrimitiveType { return this._def.primitiveType; }
  public get extendedTypeName(): string | undefined {
    const sid = this._def.extTypeSid;
    return sid !== 0 ? this._ctx.strings[sid] : undefined;
  }

  // Enumeration
  public get enumeration(): RuntimeEnumeration | undefined {
    const idx = this._def.enumIdx;
    return idx !== -1 ? new RuntimeEnumeration(this._ctx, idx) : undefined;
  }

  // KindOfQuantity
  public get kindOfQuantity(): RuntimeKoQ | undefined {
    const idx = this._def.koqIdx;
    return idx !== -1 ? new RuntimeKoQ(this._ctx, idx) : undefined;
  }

  // Struct
  public get structClass(): RuntimeClass | undefined {
    const idx = this._def.structClassIdx;
    return idx !== -1 ? new RuntimeClass(this._ctx, idx) : undefined;
  }

  // Navigation
  public get direction(): StrengthDirection { return this._def.navDirection; }
  public get relationshipClass(): RuntimeClass | undefined {
    const idx = this._def.navRelClassIdx;
    return idx !== -1 ? new RuntimeClass(this._ctx, idx) : undefined;
  }

  // Array
  public get arrayMinOccurs(): number { return this._def.arrayMinOccurs; }
  public get arrayMaxOccurs(): number { return this._def.arrayMaxOccurs; }

  // Category
  public get category(): RuntimePropertyCategory | undefined {
    const idx = this._def.categoryIdx;
    return idx !== -1 ? new RuntimePropertyCategory(this._ctx, idx) : undefined;
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
  ) {}

  private get _data() { return this._ctx.enumerations[this.idx]; }

  public get name(): string { return this._ctx.strings[this._data.nameSid]; }
  public get label(): string {
    const sid = this._data.labelSid;
    return sid !== 0 ? this._ctx.strings[sid] : this.name;
  }
  public get description(): string {
    const sid = this._data.descriptionSid;
    return sid !== 0 ? this._ctx.strings[sid] : "";
  }
  /** "SchemaName:EnumName" */
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
  ) {}

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

/** Lightweight view over a KindOfQuantity in a `RuntimeSchemaContext`.
 * @beta
 */
export class RuntimeKoQ {
  /** @internal */
  constructor(
    private readonly _ctx: RuntimeSchemaContext,
    /** @internal */ public readonly idx: number,
  ) {}

  private get _data() { return this._ctx.koqs[this.idx]; }

  public get name(): string { return this._ctx.strings[this._data.nameSid]; }
  public get label(): string {
    const sid = this._data.labelSid;
    return sid !== 0 ? this._ctx.strings[sid] : this.name;
  }
  public get description(): string {
    const sid = this._data.descriptionSid;
    return sid !== 0 ? this._ctx.strings[sid] : "";
  }
  /** "SchemaName:KoqName" */
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
  /** Presentation format strings, semicolon-separated. Empty string if none. */
  public get presentationUnits(): string {
    const sid = this._data.presentationUnitsSid;
    return sid !== 0 ? this._ctx.strings[sid] : "";
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
  ) {}

  private get _data() { return this._ctx.propCategories[this.idx]; }

  public get name(): string { return this._ctx.strings[this._data.nameSid]; }
  public get label(): string {
    const sid = this._data.labelSid;
    return sid !== 0 ? this._ctx.strings[sid] : this.name;
  }
  public get description(): string {
    const sid = this._data.descriptionSid;
    return sid !== 0 ? this._ctx.strings[sid] : "";
  }
  /** "SchemaName:CategoryName" */
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
  ) {}

  private get _data() { return this._ctx.relConstraints[this._idx]; }

  public get abstractConstraint(): RuntimeClass | undefined {
    const idx = this._data.abstractConstraintIdx;
    return idx !== -1 ? new RuntimeClass(this._ctx, idx) : undefined;
  }
  public get polymorphic(): boolean { return this._data.polymorphic; }
  public get constraintClasses(): readonly RuntimeClass[] {
    const d = this._data;
    const result: RuntimeClass[] = [];
    for (let i = 0; i < d.classRefCount; i++)
      result.push(new RuntimeClass(this._ctx, this._ctx.constraintClassRefs[d.classRefStart + i]));
    return result;
  }
}

/** Lightweight view over an ECView in a `RuntimeSchemaContext`. An ECView is a queryable
 * projection with properties but no relationship semantics or mixin application. The
 * underlying ECSQL query is intentionally not exposed - runtime consumers only need the
 * view's property shape.
 * @beta
 */
export class RuntimeView {
  /** @internal */
  constructor(
    private readonly _ctx: RuntimeSchemaContext,
    /** @internal */ public readonly idx: number,
  ) {}

  private get _data(): ViewData { return this._ctx.views[this.idx]; }

  public get name(): string { return this._ctx.strings[this._data.nameSid]; }
  public get label(): string {
    const sid = this._data.labelSid;
    return sid !== 0 ? this._ctx.strings[sid] : this.name;
  }
  public get description(): string {
    const sid = this._data.descriptionSid;
    return sid !== 0 ? this._ctx.strings[sid] : "";
  }
  /** "SchemaName:ViewName" */
  public get fullName(): string {
    const d = this._data;
    return `${this._ctx.strings[this._ctx.schemas[d.schemaIdx].nameSid]}:${this._ctx.strings[d.nameSid]}`;
  }
  public get schema(): RuntimeSchema { return new RuntimeSchema(this._ctx, this._data.schemaIdx); }
  public get modifier(): ClassModifier { return this._data.modifier; }

  /** Base class the view projects from. undefined for views not derived from an entity class. */
  public get baseClass(): RuntimeClass | undefined {
    const idx = this._data.baseClassIdx;
    return idx !== -1 ? new RuntimeClass(this._ctx, idx) : undefined;
  }

  /** Find a property by name (case-insensitive). Own properties only - views don't inherit. */
  public getProperty(name: string): RuntimeProperty | undefined {
    const lowerName = name.toLowerCase();
    const d = this._data;
    for (let i = 0; i < d.ownPropCount; i++) {
      const ref = this._ctx.propertyRefs[d.ownPropStart + i];
      if (this._ctx.lowerStrings[this._ctx.propDefs[ref.defIdx].nameSid] === lowerName)
        return new RuntimeProperty(this._ctx, ref, -1);
    }
    return undefined;
  }

  /** All own properties in ordinal order. */
  public getProperties(): readonly RuntimeProperty[] {
    const d = this._data;
    const result: RuntimeProperty[] = [];
    for (let i = 0; i < d.ownPropCount; i++) {
      const ref = this._ctx.propertyRefs[d.ownPropStart + i];
      result.push(new RuntimeProperty(this._ctx, ref, -1));
    }
    return result;
  }
}
