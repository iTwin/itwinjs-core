/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { BentleyError, Logger } from "@itwin/core-bentley";
import { SchemaView, SchemaViewBuilder } from "./SchemaView";
import { StrengthDirection, StrengthType } from "./ECObjects";
import { ClassData, ClassModifier, ClassType, PropertyDef, PropertyKind, schemaViewFormatVersion, SchemaViewPrimitiveType } from "./SchemaViewInterfaces";

/** Binary record tags for the SchemaView blob format.
 * Each tag marks a flat, count-prefixed table. Must stay in sync with the C++ writer. */
enum Tag {
  PropertyDefTable = 0x0A,
  SchemaTable = 0x10,
  EnumTable = 0x20,
  KoQTable = 0x30,
  PropCatTable = 0x31,
  ClassTable = 0x40,
}

const MAGIC = 0x43534348; // "CSCH"

/** Low-level binary reader for the SchemaView blob. */
class BinaryReader {
  private _view: DataView;
  private _bytes: Uint8Array;
  private _pos: number;
  private _strings: string[];

  constructor(data: Uint8Array) {
    this._bytes = data;
    this._view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    this._pos = 0;
    this._strings = [];
  }

  public readU8(): number {
    if (this._pos >= this._bytes.length)
      throw new Error(`SchemaView blob truncated: cannot read u8 at offset ${this._pos} (length ${this._bytes.length})`);
    return this._bytes[this._pos++];
  }
  public readU16(): number { const v = this._view.getUint16(this._pos, true); this._pos += 2; return v; }
  public readU32(): number { const v = this._view.getUint32(this._pos, true); this._pos += 4; return v; }
  public readI32(): number { const v = this._view.getInt32(this._pos, true); this._pos += 4; return v; }
  public readF64(): number { const v = this._view.getFloat64(this._pos, true); this._pos += 8; return v; }
  public get pos(): number { return this._pos; }
  public set pos(v: number) { this._pos = v; }

  /** Read a string-table reference (U32 index) and return the original string. */
  public readSRef(): string {
    const idx = this.readU32();
    if (idx >= this._strings.length)
      throw new Error(`SchemaView blob: string reference ${idx} out of range (string table size ${this._strings.length})`);
    return this._strings[idx];
  }

  /** Validate a count-prefixed table header: the declared count cannot exceed what the remaining
   *  buffer could plausibly hold. Each entry consumes at least `minBytesPerEntry` bytes. */
  public validateCount(count: number, minBytesPerEntry: number, tableName: string): void {
    const remaining = this._bytes.length - this._pos;
    if (count > remaining / Math.max(1, minBytesPerEntry))
      throw new Error(`SchemaView blob: ${tableName} count ${count} exceeds remaining buffer (${remaining} bytes)`);
  }

  /** Parse the string table at the given offset. */
  public parseStringTable(offset: number): void {
    if (offset > this._bytes.length)
      throw new Error(`SchemaView blob: stringTable offset ${offset} is past end of blob (length ${this._bytes.length})`);
    const saved = this._pos;
    this._pos = offset;
    const count = this.readU32();
    // Each entry is at minimum a 4-byte length prefix - a count larger than the remaining bytes
    // cannot possibly be valid and would cause a huge `new Array` allocation on a malformed blob.
    const remaining = this._bytes.length - this._pos;
    if (count > remaining / 4)
      throw new Error(`SchemaView blob: stringTable count ${count} exceeds remaining buffer (${remaining} bytes)`);
    this._strings = new Array(count);
    const decoder = new TextDecoder();
    for (let i = 0; i < count; i++) {
      const len = this.readU32();
      if (len === 0) {
        this._strings[i] = "";
      } else {
        if (len > this._bytes.length - this._pos)
          throw new Error(`SchemaView blob: string entry ${i} has length ${len} but only ${this._bytes.length - this._pos} bytes remain`);
        this._strings[i] = decoder.decode(this._bytes.subarray(this._pos, this._pos + len));
        this._pos += len;
      }
    }
    this._pos = saved;
  }
}

/** Read a U32 that uses 0xFFFFFFFF as a sentinel for "not set". */
function readOptionalU32(reader: BinaryReader): number | undefined {
  const v = reader.readU32();
  return v === 0xFFFFFFFF ? undefined : v;
}

/** Temporary per-class data collected during parsing, before cross-references are resolved. */
interface PendingClass {
  schemaIdx: number;
  classIdx: number;
  ecInstanceId: number;
  nameStringIdx: number;
  labelStringIdx: number;
  descriptionStringIdx: number;
  type: ClassType;
  modifier: ClassModifier;
  relStrength: StrengthType;
  relStrengthDir: StrengthDirection;
  baseClasses: Array<{ schemaName: string; className: string; ordinal: number }>;
  propRefs: PendingPropRef[];
  constraints: PendingConstraint[];
  schemaName: string;
  isHidden: boolean | undefined;
}

/** A property reference from the binary PropertyDefTable. During parsing, `preDefIdx` stores the
 *  index into the pre-parsed def array; during resolution it's mapped to the builder's deduped defIdx. */
interface PendingPropRef {
  preDefIdx: number; // index into preParsedDefs (mapped to builder defIdx during resolution)
  ecInstanceId: number;
  labelStringIdx: number;
  priority: number;
}

/** Pre-parsed property definition from the binary PropertyDefTable, with row ID cross-refs. */
interface PreParsedDef {
  name: string;
  description: string;
  kind: PropertyKind;
  primitiveType: SchemaViewPrimitiveType;
  extType: string;
  enumRowId: number;        // ec_Enumeration.Id (0 = none)
  structClassRowId: number; // ec_Class.Id for struct type (0 = none)
  koqRowId: number;         // ec_KindOfQuantity.Id (0 = none)
  catRowId: number;         // ec_PropertyCategory.Id (0 = none)
  arrayMinOccurs: number | undefined;
  arrayMaxOccurs: number | undefined;
  navRelClassRowId: number; // ec_Class.Id for nav relationship (0 = none)
  navDirection: StrengthDirection;
  isReadonly: boolean;
  isHidden: boolean;
}

interface PendingConstraint {
  relEnd: number; // 0=source, 1=target
  isPolymorphic: boolean;
  multiplicityLower: number;
  multiplicityUpper: number;
  roleLabel: string;
  abstractSchemaName: string;
  abstractClassName: string;
  constraintClasses: Array<{ schemaName: string; className: string }>;
}

/** Helper: read a tag byte and validate it matches the expected tag. */
function expectTag(reader: BinaryReader, expected: Tag): void {
  const tag = reader.readU8();
  if (tag !== expected)
    throw new Error(`Expected tag 0x${expected.toString(16)} but found 0x${tag.toString(16)} at offset ${reader.pos - 1}`);
}

/** Parse a schema view blob (binary format) into a `SchemaView`.
 *
 * Layout: Header, PropertyDefTable, SchemaTable, EnumTable, KoQTable, PropCatTable, ClassTable, StringTable.
 * Each table is count-prefixed. Schema items carry their schema's ecInstanceId for ownership resolution.
 * Classes have count-prefixed inline sub-items (base classes, property refs, constraints).
 *
 * Consumers should call `SchemaView.fromBinary` instead - this function is the low-level
 * implementation behind it.
 * @internal
 */
export function parseSchemaViewBlob(data: Uint8Array, schemaToken?: string): SchemaView {
  const reader = new BinaryReader(data);

  // Header: magic(4) + version(1) + stringTableOffset(4)
  const magic = reader.readU32();
  if (magic !== MAGIC)
    throw new Error(`Invalid SchemaView blob magic: 0x${magic.toString(16)}, expected 0x${MAGIC.toString(16)}`);
  const version = reader.readU8();
  if (version !== schemaViewFormatVersion)
    throw new Error(`Unsupported schema view format version: ${version}, expected ${schemaViewFormatVersion}`);
  const stOffset = reader.readU32();
  reader.parseStringTable(stOffset);

  const builder = new SchemaViewBuilder();

  // Cross-reference maps (ecInstanceId -> builder array index)
  const schemaEcIdToIdx = new Map<number, number>();
  const enumRowIdToIdx = new Map<number, number>();
  const koqRowIdToIdx = new Map<number, number>();
  const catRowIdToIdx = new Map<number, number>();
  const classRowIdToIdx = new Map<number, number>();

  // Per-schema metadata for name-based class resolution
  const schemaInfos: Array<{ name: string; schemaIdx: number; classNameToIdx: Map<string, number> }> = [];

  // Per-schema item range tracking (indexed by schemaIdx)
  const schemaEnumStarts: number[] = [];
  const schemaEnumCounts: number[] = [];
  const schemaKoqStarts: number[] = [];
  const schemaKoqCounts: number[] = [];
  const schemaCatStarts: number[] = [];
  const schemaCatCounts: number[] = [];
  const schemaClassStarts: number[] = [];
  const schemaClassCounts: number[] = [];

  // Deferred class data for cross-reference resolution
  const pendingClasses: PendingClass[] = [];

  // ---- PropertyDefTable ----
  expectTag(reader, Tag.PropertyDefTable);
  const defCount = reader.readU32();
  // Each PreParsedDef consumes at least ~30 bytes (mix of u8/u16/u32 fields + string refs).
  // Use a conservative lower bound of 8 bytes to catch wildly oversized counts on malformed blobs.
  reader.validateCount(defCount, 8, "PropertyDefTable");
  const preParsedDefs: PreParsedDef[] = new Array(defCount);
  for (let i = 0; i < defCount; i++) {
    preParsedDefs[i] = {
      name: reader.readSRef(),
      kind: reader.readU8(),
      primitiveType: reader.readU16(),
      extType: reader.readSRef(),
      enumRowId: reader.readU32(),
      structClassRowId: reader.readU32(),
      koqRowId: reader.readU32(),
      catRowId: reader.readU32(),
      arrayMinOccurs: readOptionalU32(reader),
      arrayMaxOccurs: readOptionalU32(reader),
      navRelClassRowId: reader.readU32(),
      navDirection: reader.readU8(),
      isReadonly: reader.readU8() !== 0,
      isHidden: reader.readU8() !== 0,
      description: reader.readSRef(),
    };
  }

  // ---- SchemaTable ----
  expectTag(reader, Tag.SchemaTable);
  const schemaCount = reader.readU32();
  reader.validateCount(schemaCount, 8, "SchemaTable");
  for (let i = 0; i < schemaCount; i++) {
    const name = reader.readSRef();
    const vRead = reader.readU16();
    const vWrite = reader.readU16();
    const vMinor = reader.readU16();
    const alias = reader.readSRef();
    const label = reader.readSRef();
    const description = reader.readSRef();
    const ecInstanceId = reader.readU32();
    const isHidden = reader.readU8() !== 0;

    const schemaIdx = builder.addSchema({
      ecInstanceId,
      nameStringIdx: builder.internString(name),
      aliasStringIdx: builder.internString(alias),
      labelStringIdx: builder.internString(label),
      descriptionStringIdx: builder.internString(description),
      versionRead: vRead,
      versionWrite: vWrite,
      versionMinor: vMinor,
      classRangeStart: 0, classCount: 0,
      enumRangeStart: 0, enumCount: 0,
      koqRangeStart: 0, koqCount: 0,
      catRangeStart: 0, catCount: 0,
      isHidden,
    });
    schemaEcIdToIdx.set(ecInstanceId, schemaIdx);
    schemaInfos.push({ name, schemaIdx, classNameToIdx: new Map() });
    schemaEnumStarts.push(0); schemaEnumCounts.push(0);
    schemaKoqStarts.push(0); schemaKoqCounts.push(0);
    schemaCatStarts.push(0); schemaCatCounts.push(0);
    schemaClassStarts.push(0); schemaClassCounts.push(0);
  }

  /** Track an item's schema ownership and update range counters. */
  function trackItem(schemaEcId: number, globalIdx: number, starts: number[], counts: number[]): number {
    const schemaIdx = schemaEcIdToIdx.get(schemaEcId);
    if (schemaIdx === undefined)
      throw new Error(`SchemaView blob: unknown schema ecInstanceId ${schemaEcId}`);
    if (counts[schemaIdx] === 0)
      starts[schemaIdx] = globalIdx;
    counts[schemaIdx]++;
    return schemaIdx;
  }

  // ---- EnumTable ----
  expectTag(reader, Tag.EnumTable);
  const enumTotalCount = reader.readU32();
  reader.validateCount(enumTotalCount, 8, "EnumTable");
  for (let i = 0; i < enumTotalCount; i++) {
    const schemaEcId = reader.readU32();
    const schemaIdx = trackItem(schemaEcId, i, schemaEnumStarts, schemaEnumCounts);

    const eName = reader.readSRef();
    const ePrimType = reader.readU8();
    const eIsStrict = reader.readU8() !== 0;
    const eLabel = reader.readSRef();
    const eDesc = reader.readSRef();
    const eValuesJson = reader.readSRef();
    const eEcInstanceId = reader.readU32();

    const enumeratorStart = builder.enumeratorCount;
    let enumeratorCount = 0;
    if (eValuesJson) {
      try {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const values = JSON.parse(eValuesJson) as Array<{ Name?: string; IntValue?: number; StringValue?: string; DisplayLabel?: string; Description?: string }>;
        for (const v of values) {
          const value = v.IntValue !== undefined ? v.IntValue : (v.StringValue ?? "");
          const name = v.Name ?? (typeof value === "string" ? value : `${eName}${value}`);
          builder.addEnumerator({
            nameStringIdx: builder.internString(name),
            labelStringIdx: builder.internString(v.DisplayLabel),
            descriptionStringIdx: builder.internString(v.Description),
            value,
          });
          enumeratorCount++;
        }
      } catch (e) {
        Logger.logWarning("ecschema-metadata.SchemaView", `Malformed EnumValues JSON for enumeration "${eName}": ${BentleyError.getErrorMessage(e)}`);
      }
    }

    const eIdx = builder.addEnumeration({
      ecInstanceId: eEcInstanceId,
      schemaIdx,
      nameStringIdx: builder.internString(eName),
      labelStringIdx: builder.internString(eLabel),
      descriptionStringIdx: builder.internString(eDesc),
      primitiveType: ePrimType,
      isStrict: eIsStrict,
      enumeratorStart,
      enumeratorCount,
    });
    enumRowIdToIdx.set(eEcInstanceId, eIdx);
  }

  // ---- KoQTable ----
  expectTag(reader, Tag.KoQTable);
  const koqTotalCount = reader.readU32();
  reader.validateCount(koqTotalCount, 8, "KoQTable");
  for (let i = 0; i < koqTotalCount; i++) {
    const schemaEcId = reader.readU32();
    const schemaIdx = trackItem(schemaEcId, i, schemaKoqStarts, schemaKoqCounts);

    const kName = reader.readSRef();
    const kLabel = reader.readSRef();
    const kDesc = reader.readSRef();
    const kPersUnit = reader.readSRef();
    const kRelError = reader.readF64();
    const kPresUnits = reader.readSRef();
    const kEcInstanceId = reader.readU32();

    const kIdx = builder.addKoq({
      ecInstanceId: kEcInstanceId,
      schemaIdx,
      nameStringIdx: builder.internString(kName),
      labelStringIdx: builder.internString(kLabel),
      descriptionStringIdx: builder.internString(kDesc),
      persistenceUnitStringIdx: builder.internString(kPersUnit),
      presentationFormatsStringIdx: builder.internString(kPresUnits),
      relativeError: kRelError,
    });
    koqRowIdToIdx.set(kEcInstanceId, kIdx);
  }

  // ---- PropCatTable ----
  expectTag(reader, Tag.PropCatTable);
  const catTotalCount = reader.readU32();
  reader.validateCount(catTotalCount, 8, "PropCatTable");
  for (let i = 0; i < catTotalCount; i++) {
    const schemaEcId = reader.readU32();
    const schemaIdx = trackItem(schemaEcId, i, schemaCatStarts, schemaCatCounts);

    const pcName = reader.readSRef();
    const pcLabel = reader.readSRef();
    const pcDesc = reader.readSRef();
    const pcPriority = reader.readI32();
    const pcEcInstanceId = reader.readU32();

    const pcIdx = builder.addPropertyCategory({
      ecInstanceId: pcEcInstanceId,
      schemaIdx,
      nameStringIdx: builder.internString(pcName),
      labelStringIdx: builder.internString(pcLabel),
      descriptionStringIdx: builder.internString(pcDesc),
      priority: pcPriority,
    });
    catRowIdToIdx.set(pcEcInstanceId, pcIdx);
  }

  // ---- ClassTable ----
  expectTag(reader, Tag.ClassTable);
  const classTotalCount = reader.readU32();
  reader.validateCount(classTotalCount, 8, "ClassTable");
  for (let i = 0; i < classTotalCount; i++) {
    const schemaEcId = reader.readU32();
    const schemaIdx = trackItem(schemaEcId, i, schemaClassStarts, schemaClassCounts);
    const schemaInfo = schemaInfos[schemaIdx];

    const cName = reader.readSRef();
    const cType = reader.readU8();
    const cModifier = reader.readU8();
    const cLabel = reader.readSRef();
    const cDesc = reader.readSRef();
    let relStrength: StrengthType = StrengthType.Referencing;
    let relStrengthDir: StrengthDirection = StrengthDirection.Forward;
    if (cType === ClassType.Relationship) {
      relStrength = reader.readU8();
      relStrengthDir = reader.readU8();
    }
    const cEcInstanceId = reader.readU32();
    // Tri-state hidden: 0=undefined (no CA, schema doesn't hide), 1=true (hidden), 2=false (explicitly shown)
    const cHiddenByte = reader.readU8();
    const cIsHidden: boolean | undefined = cHiddenByte === 1 ? true : cHiddenByte === 2 ? false : undefined;

    // Base classes (count-prefixed)
    const baseCount = reader.readU16();
    const baseClasses: Array<{ schemaName: string; className: string; ordinal: number }> = [];
    for (let b = 0; b < baseCount; b++) {
      baseClasses.push({
        schemaName: reader.readSRef(),
        className: reader.readSRef(),
        ordinal: reader.readU8(),
      });
    }

    // Property refs (count-prefixed)
    const propRefCount = reader.readU16();
    const propRefs: PendingPropRef[] = [];
    for (let p = 0; p < propRefCount; p++) {
      propRefs.push({
        preDefIdx: reader.readU32(),
        labelStringIdx: builder.internString(reader.readSRef()),
        priority: reader.readI32(),
        ecInstanceId: reader.readU32(),
      });
    }

    // Constraints (count-prefixed, only for relationships)
    const constraints: PendingConstraint[] = [];
    if (cType === ClassType.Relationship) {
      const constrCount = reader.readU8();
      for (let c = 0; c < constrCount; c++) {
        const rcEnd = reader.readU8();
        const rcMultLower = reader.readU32();
        const rcMultUpper = reader.readU32();
        const rcIsPoly = reader.readU8() !== 0;
        const rcRoleLabel = reader.readSRef();
        const rcAbsSchema = reader.readSRef();
        const rcAbsClass = reader.readSRef();

        // Constraint classes (count-prefixed)
        const ccCount = reader.readU8();
        const constraintClasses: Array<{ schemaName: string; className: string }> = [];
        for (let cc = 0; cc < ccCount; cc++) {
          constraintClasses.push({
            schemaName: reader.readSRef(),
            className: reader.readSRef(),
          });
        }

        constraints.push({
          relEnd: rcEnd,
          isPolymorphic: rcIsPoly,
          multiplicityLower: rcMultLower,
          multiplicityUpper: rcMultUpper,
          roleLabel: rcRoleLabel,
          abstractSchemaName: rcAbsSchema,
          abstractClassName: rcAbsClass,
          constraintClasses,
        });
      }
    }

    const nameStringIdx = builder.internString(cName);
    const classIdx = builder.addClass({
      ecInstanceId: cEcInstanceId,
      schemaIdx,
      nameStringIdx,
      labelStringIdx: builder.internString(cLabel),
      descriptionStringIdx: builder.internString(cDesc),
      type: cType,
      modifier: cModifier,
      baseClassIdx: -1,
      mixinStartIdx: -1,
      mixinCount: 0,
      ownPropStart: 0,
      ownPropCount: 0,
      strength: relStrength,
      strengthDirection: relStrengthDir,
      sourceConstraintIdx: -1,
      targetConstraintIdx: -1,
      isHidden: cIsHidden,
    });
    schemaInfo.classNameToIdx.set(cName.toLowerCase(), classIdx);
    classRowIdToIdx.set(cEcInstanceId, classIdx);

    pendingClasses.push({
      schemaIdx,
      classIdx,
      ecInstanceId: cEcInstanceId,
      nameStringIdx,
      labelStringIdx: builder.internString(cLabel),
      descriptionStringIdx: builder.internString(cDesc),
      type: cType,
      modifier: cModifier,
      relStrength,
      relStrengthDir,
      baseClasses,
      propRefs,
      constraints,
      schemaName: schemaInfo.name,
      isHidden: cIsHidden,
    });
  }

  // ---- Finalize per-schema item ranges ----
  for (let i = 0; i < schemaCount; i++) {
    builder.updateSchemaRanges(i, {
      classRangeStart: schemaClassStarts[i] ?? 0,
      classCount: schemaClassCounts[i] ?? 0,
      enumRangeStart: schemaEnumStarts[i] ?? 0,
      enumCount: schemaEnumCounts[i] ?? 0,
      koqRangeStart: schemaKoqStarts[i] ?? 0,
      koqCount: schemaKoqCounts[i] ?? 0,
      catRangeStart: schemaCatStarts[i] ?? 0,
      catCount: schemaCatCounts[i] ?? 0,
    });
  }

  // Build a global name resolver: "SchemaName:ClassName" -> classIdx
  const classResolver = new Map<string, number>();
  for (const s of schemaInfos) {
    for (const [lowerName, idx] of s.classNameToIdx)
      classResolver.set(`${s.name.toLowerCase()}:${lowerName}`, idx);
  }

  // Resolve pre-parsed defs to PropertyDef objects. Maps preParsedDef index -> builder defIdx.
  const danglingRefs: string[] = [];
  const resolvedDefMap = new Map<number, number>();
  const brokenDefs = new Set<number>();

  for (let i = 0; i < preParsedDefs.length; i++) {
    const prDef = preParsedDefs[i];

    let structClassIdx = -1;
    if (prDef.structClassRowId !== 0) {
      structClassIdx = classRowIdToIdx.get(prDef.structClassRowId) ?? -1;
      if (structClassIdx === -1) {
        brokenDefs.add(i);
        danglingRefs.push(`Dropped properties with struct class rowId ${prDef.structClassRowId}`);
        continue;
      }
    }

    let navRelClassIdx = -1;
    if (prDef.navRelClassRowId !== 0) {
      navRelClassIdx = classRowIdToIdx.get(prDef.navRelClassRowId) ?? -1;
      if (navRelClassIdx === -1) {
        brokenDefs.add(i);
        danglingRefs.push(`Dropped properties with nav relationship rowId ${prDef.navRelClassRowId}`);
        continue;
      }
    }

    let enumIdx = -1;
    if (prDef.enumRowId !== 0) {
      enumIdx = enumRowIdToIdx.get(prDef.enumRowId) ?? -1;
      if (enumIdx === -1)
        danglingRefs.push(`Unresolved enum rowId ${prDef.enumRowId}`);
    }

    let koqIdx = -1;
    if (prDef.koqRowId !== 0)
      koqIdx = koqRowIdToIdx.get(prDef.koqRowId) ?? -1;

    let categoryIdx = -1;
    if (prDef.catRowId !== 0)
      categoryIdx = catRowIdToIdx.get(prDef.catRowId) ?? -1;

    const def: PropertyDef = {
      nameStringIdx: builder.internString(prDef.name),
      descriptionStringIdx: builder.internString(prDef.description),
      kind: prDef.kind,
      primitiveType: prDef.primitiveType,
      extTypeStringIdx: builder.internString(prDef.extType),
      enumIdx,
      koqIdx,
      structClassIdx,
      navRelClassIdx,
      navDirection: prDef.navDirection,
      categoryIdx,
      isReadOnly: prDef.isReadonly,
      isHidden: prDef.isHidden,
      arrayMinOccurs: prDef.arrayMinOccurs,
      arrayMaxOccurs: prDef.arrayMaxOccurs,
    };

    resolvedDefMap.set(i, builder.addPropertyDef(def));
  }

  // Resolve cross-references and finalize classes
  for (const pc of pendingClasses) {
    pc.baseClasses.sort((a, b) => a.ordinal - b.ordinal);
    const classFullName = `${pc.schemaName}:${builder.getString(pc.nameStringIdx)}`;

    let baseClassIdx = -1;
    const mixinStartIdx = pc.baseClasses.length > 1 ? builder.classMixinCount : -1;
    let mixinCount = 0;

    for (const bc of pc.baseClasses) {
      const bcKey = `${bc.schemaName.toLowerCase()}:${bc.className.toLowerCase()}`;
      const bcIdx = classResolver.get(bcKey) ?? -1;
      if (bc.ordinal === 0) {
        if (bcIdx === -1 && bc.schemaName)
          danglingRefs.push(`${classFullName} -> base class ${bc.schemaName}:${bc.className}`);
        baseClassIdx = bcIdx;
      } else {
        if (bcIdx === -1) {
          danglingRefs.push(`${classFullName} -> mixin ${bc.schemaName}:${bc.className}`);
          continue;
        }
        builder.addClassMixin(bcIdx);
        mixinCount++;
      }
    }

    const ownPropStart = builder.propertyRefCount;
    for (const pr of pc.propRefs) {
      if (brokenDefs.has(pr.preDefIdx))
        continue;
      const defIdx = resolvedDefMap.get(pr.preDefIdx);
      if (defIdx === undefined)
        continue;
      builder.addPropertyRef({
        ecInstanceId: pr.ecInstanceId,
        defIdx,
        labelStringIdx: pr.labelStringIdx,
        priority: pr.priority,
      });
    }

    let sourceConstraintIdx = -1;
    let targetConstraintIdx = -1;
    for (const con of pc.constraints) {
      const absKey = con.abstractSchemaName && con.abstractClassName
        ? `${con.abstractSchemaName.toLowerCase()}:${con.abstractClassName.toLowerCase()}`
        : "";
      const absClassIdx = absKey ? (classResolver.get(absKey) ?? -1) : -1;
      if (absClassIdx === -1 && absKey)
        danglingRefs.push(`${classFullName} constraint -> abstract ${con.abstractSchemaName}:${con.abstractClassName}`);

      const classRefStart = builder.constraintClassRefCount;
      let classRefCount = 0;
      for (const cc of con.constraintClasses) {
        const ccKey = `${cc.schemaName.toLowerCase()}:${cc.className.toLowerCase()}`;
        const ccIdx = classResolver.get(ccKey) ?? -1;
        if (ccIdx === -1) {
          danglingRefs.push(`${classFullName} constraint -> class ${cc.schemaName}:${cc.className}`);
          continue;
        }
        builder.addConstraintClassRef(ccIdx);
        classRefCount++;
      }

      const constraintIdx = builder.addRelConstraint({
        abstractConstraintIdx: absClassIdx,
        polymorphic: con.isPolymorphic,
        multiplicityLower: con.multiplicityLower,
        multiplicityUpper: con.multiplicityUpper,
        roleLabelStringIdx: builder.internString(con.roleLabel),
        classRefStart,
        classRefCount,
      });

      if (con.relEnd === 0)
        sourceConstraintIdx = constraintIdx;
      else
        targetConstraintIdx = constraintIdx;
    }

    const updatedClass: ClassData = {
      ecInstanceId: pc.ecInstanceId,
      schemaIdx: pc.schemaIdx,
      nameStringIdx: pc.nameStringIdx,
      labelStringIdx: pc.labelStringIdx,
      descriptionStringIdx: pc.descriptionStringIdx,
      type: pc.type,
      modifier: pc.modifier,
      baseClassIdx,
      mixinStartIdx,
      mixinCount,
      ownPropStart,
      ownPropCount: builder.propertyRefCount - ownPropStart,
      strength: pc.relStrength,
      strengthDirection: pc.relStrengthDir,
      sourceConstraintIdx,
      targetConstraintIdx,
      isHidden: pc.isHidden,
    };
    builder.updateClass(pc.classIdx, updatedClass);
  }

  if (danglingRefs.length > 0) {
    const cap = 20;
    const lines = danglingRefs.length <= cap ? danglingRefs : [...danglingRefs.slice(0, cap), `... and ${danglingRefs.length - cap} more`];
    Logger.logWarning("ecschema-metadata.SchemaView", `${danglingRefs.length} unresolved cross-reference(s) in schema view blob (likely from excluded schemas):\n  ${lines.join("\n  ")}`);
  }

  return builder.build(schemaToken);
}

