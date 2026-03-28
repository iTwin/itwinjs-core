/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { Logger } from "@itwin/core-bentley";
import { RuntimeSchemaContext, RuntimeSchemaContextBuilder } from "./RuntimeSchemaContext";
import { type ClassData, ClassModifier, ClassType, type EnumerationData, type EnumeratorData, type KoqData, type PropCategoryData, type PropertyDef, PropertyKind, RuntimePrimitiveType, runtimeSchemasFormatVersion, type SchemaData, StrengthDirection, StrengthType } from "./RuntimeSchemaInterfaces";

/** Binary record tags for the runtime schema format. Must stay in sync with the C++ writer when it is implemented. */
enum Tag {
  Schema = 0x10,
  SchemaRef = 0x11,
  Enum = 0x20,
  KoQ = 0x30,
  PropCat = 0x31,
  Class = 0x40,
  BaseClass = 0x41,
  Property = 0x50,
  PropRef = 0x51,
  RelConstr = 0x70,
  ConstrClass = 0x71,
  EndSchema = 0x1F,
  EndClass = 0x4F,
}

const MAGIC = 0x43534348; // "CSCH"

// ECDbSystem schema stores ExtendedTypeName='Id' for all system properties in older profiles.
// The C++ SchemaReader patches these to canonical names; we mirror that here.
/* eslint-disable @typescript-eslint/naming-convention */
const ecDbSystemExtendedTypes: Record<string, Record<string, string>> = {
  ClassECSqlSystemProperties: { ECInstanceId: "Id", ECClassId: "ClassId" },
  NavigationECSqlSystemProperties: { Id: "NavId", RelECClassId: "NavRelClassId" },
  RelationshipECSqlSystemProperties: {
    SourceECInstanceId: "SourceId", SourceECClassId: "SourceClassId",
    TargetECInstanceId: "TargetId", TargetECClassId: "TargetClassId",
  },
};
/* eslint-enable @typescript-eslint/naming-convention */

/** Low-level binary reader for the runtime schema blob. */
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

  public readU8(): number { return this._bytes[this._pos++]; }
  public readU16(): number { const v = this._view.getUint16(this._pos, true); this._pos += 2; return v; }
  public readU32(): number { const v = this._view.getUint32(this._pos, true); this._pos += 4; return v; }
  public readI32(): number { const v = this._view.getInt32(this._pos, true); this._pos += 4; return v; }
  public readF64(): number { const v = this._view.getFloat64(this._pos, true); this._pos += 8; return v; }
  public get pos(): number { return this._pos; }
  public set pos(v: number) { this._pos = v; }

  /** Read a string-table reference (U32 index) and return the original string. */
  public readSRef(): string {
    const idx = this.readU32();
    return idx < this._strings.length ? this._strings[idx] : "";
  }

  /** Parse the string table at the given offset. */
  public parseStringTable(offset: number): void {
    const saved = this._pos;
    this._pos = offset;
    const count = this.readU32();
    this._strings = new Array(count);
    const decoder = new TextDecoder();
    for (let i = 0; i < count; i++) {
      const len = this.readU32();
      if (len === 0) {
        this._strings[i] = "";
      } else {
        this._strings[i] = decoder.decode(this._bytes.subarray(this._pos, this._pos + len));
        this._pos += len;
      }
    }
    this._pos = saved;
  }
}

/** Temporary per-class data collected during parsing, before cross-references are resolved. */
interface PendingClass {
  schemaIdx: number;
  classIdx: number;
  nameSid: number;
  labelSid: number;
  descriptionSid: number;
  type: ClassType;
  modifier: ClassModifier;
  relStrength: StrengthType;
  relStrengthDir: StrengthDirection;
  baseClasses: Array<{ schemaName: string; className: string; ordinal: number }>;
  properties: PendingProperty[];
  constraints: PendingConstraint[];
  schemaName: string;
}

interface PendingProperty {
  nameSid: number;
  descriptionSid: number;
  kind: PropertyKind;
  primitiveType: RuntimePrimitiveType;
  extTypeSid: number;
  enumName: string;
  structSchemaName: string;
  structClassName: string;
  koqName: string;
  categoryName: string;
  arrayMinOccurs: number;
  arrayMaxOccurs: number;
  navRelSchemaName: string;
  navRelClassName: string;
  navDirection: StrengthDirection;
  isReadonly: boolean;
  priority: number;
  labelSid: number;
}

interface PendingConstraint {
  relEnd: number; // 0=source, 1=target
  isPolymorphic: boolean;
  abstractSchemaName: string;
  abstractClassName: string;
  constraintClasses: Array<{ schemaName: string; className: string }>;
}

/** Parse a runtime schema blob into a `RuntimeSchemaContext`.
 *
 * The current format uses name-based cross-references (schema:class strings) for base classes,
 * struct types, navigation relationships, enum types, etc. This parser resolves those to
 * numeric indices during population.
 *
 * @beta
 */
export function parseRuntimeSchemaBlob(data: Uint8Array): RuntimeSchemaContext {
  const reader = new BinaryReader(data);

  function requireSchema(): { name: string; schemaIdx: number; classNameToIdx: Map<string, number> } {
    if (currentSchemaInfo === undefined)
      throw new Error("Runtime schema blob: encountered item outside a schema block");
    return currentSchemaInfo;
  }

  function requirePending(): PendingClass {
    if (currentPending === undefined)
      throw new Error("Runtime schema blob: encountered item outside a class block");
    return currentPending;
  }

  function requireConstraint(): PendingConstraint {
    if (currentConstraint === undefined)
      throw new Error("Runtime schema blob: encountered constraint class outside a constraint block");
    return currentConstraint;
  }

  // Header: magic(4) + version(1) + stringTableOffset(4)
  const magic = reader.readU32();
  if (magic !== MAGIC)
    throw new Error(`Invalid runtime schema magic: 0x${magic.toString(16)}, expected 0x${MAGIC.toString(16)}`);
  const version = reader.readU8();
  // The TS reader only supports the current format version. Version negotiation
  // lives in the C++ writer, which accepts a requested version and can produce
  // older formats for backward compatibility with older frontends.
  if (version !== runtimeSchemasFormatVersion)
    throw new Error(`Unsupported runtime schema version: ${version}, expected ${runtimeSchemasFormatVersion}`);
  const stOffset = reader.readU32();

  // Parse the string table first so SRef reads work
  reader.parseStringTable(stOffset);

  const builder = new RuntimeSchemaContextBuilder();

  // Intermediate storage for deferred cross-reference resolution
  const schemas: Array<{ name: string; schemaIdx: number; classNameToIdx: Map<string, number> }> = [];
  const pendingClasses: PendingClass[] = [];

  // Per-schema item name-to-index maps for enums, KoQs, categories
  const enumFullNameToIdx = new Map<string, number>(); // "SchemaName:EnumName" -> enum index
  const koqFullNameToIdx = new Map<string, number>();
  const catFullNameToIdx = new Map<string, number>();

  let currentSchemaInfo: { name: string; schemaIdx: number; classNameToIdx: Map<string, number> } | undefined;
  let currentPending: PendingClass | undefined;
  let currentConstraint: PendingConstraint | undefined;

  // Track range starts for sub-items within each schema
  let schemaClassStart = 0;
  let schemaEnumStart = 0;
  let schemaKoqStart = 0;
  let schemaCatStart = 0;
  let enumCount = 0;
  let koqCount = 0;
  let catCount = 0;
  let classCount = 0;

  while (reader.pos < stOffset) {
    const tag = reader.readU8();
    switch (tag) {
      case Tag.Schema: {
        // Finalize previous schema if any
        if (currentSchemaInfo !== undefined) {
          _finalizeSchemaRanges(builder, schemas.length - 1, schemaClassStart, classCount, schemaEnumStart, enumCount, schemaKoqStart, koqCount, schemaCatStart, catCount);
        }

        const name = reader.readSRef();
        const vRead = reader.readU16();
        const vWrite = reader.readU16();
        const vMinor = reader.readU16();
        const alias = reader.readSRef();
        const label = reader.readSRef();
        const description = reader.readSRef();

        const nameSid = builder.internString(name);
        schemaClassStart = classCount;
        schemaEnumStart = enumCount;
        schemaKoqStart = koqCount;
        schemaCatStart = catCount;

        // Add schema with placeholder ranges (will be updated at end or next schema)
        const schemaData: SchemaData = {
          nameSid,
          aliasSid: builder.internString(alias),
          labelSid: builder.internString(label),
          descriptionSid: builder.internString(description),
          versionRead: vRead,
          versionWrite: vWrite,
          versionMinor: vMinor,
          classRangeStart: 0, classCount: 0,
          enumRangeStart: 0, enumCount: 0,
          koqRangeStart: 0, koqCount: 0,
          catRangeStart: 0, catCount: 0,
          viewRangeStart: 0, viewCount: 0,
        };
        const schemaIdx = builder.addSchema(schemaData);
        currentSchemaInfo = { name, schemaIdx, classNameToIdx: new Map() };
        schemas.push(currentSchemaInfo);
        break;
      }

      case Tag.SchemaRef:
        // Schema references are emitted but not needed - all schemas are in context
        reader.readSRef();
        break;

      case Tag.Enum: {
        const eName = reader.readSRef();
        const ePrimType = reader.readU8();
        const eIsStrict = reader.readU8() !== 0;
        const eLabel = reader.readSRef();
        const eDesc = reader.readSRef();
        const eValuesJson = reader.readSRef();

        const enumeratorStart = builder.enumeratorCount;

        // Parse enum values JSON into individual enumerators.
        // ECDb stores enumerators as JSON with IntValue/StringValue/DisplayLabel/Description.
        // When no Name field exists (EC 3.1 schemas), ecschema-metadata synthesizes names:
        //   - Integer enums: "<EnumName><IntValue>" (e.g., "ECClassModifier0")
        //   - String enums: the StringValue itself (e.g., "DateTime")
        let enumeratorCount = 0;
        if (eValuesJson) {
          try {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            const values = JSON.parse(eValuesJson) as Array<{ Name?: string; IntValue?: number; StringValue?: string; DisplayLabel?: string; Description?: string }>;
            for (const v of values) {
              const value = v.IntValue !== undefined ? v.IntValue : (v.StringValue ?? "");
              const name = v.Name ?? (typeof value === "string" ? value : `${eName}${value}`);
              const eData: EnumeratorData = {
                nameSid: builder.internString(name),
                labelSid: builder.internString(v.DisplayLabel),
                descriptionSid: builder.internString(v.Description),
                value,
              };
              builder.addEnumerator(eData);
              enumeratorCount++;
            }
          } catch { /* ignore malformed JSON */ }
        }

        const enumData: EnumerationData = {
          schemaIdx: requireSchema().schemaIdx,
          nameSid: builder.internString(eName),
          labelSid: builder.internString(eLabel),
          descriptionSid: builder.internString(eDesc),
          primitiveType: ePrimType as RuntimePrimitiveType,
          isStrict: eIsStrict,
          enumeratorStart,
          enumeratorCount,
        };
        const eIdx = builder.addEnumeration(enumData);
        enumFullNameToIdx.set(`${requireSchema().name}:${eName}`.toLowerCase(), eIdx);
        enumCount++;
        break;
      }

      case Tag.KoQ: {
        const kName = reader.readSRef();
        const kLabel = reader.readSRef();
        const kDesc = reader.readSRef();
        const kPersUnit = reader.readSRef();
        const kRelError = reader.readF64();
        const kPresUnits = reader.readSRef();

        const kData: KoqData = {
          schemaIdx: requireSchema().schemaIdx,
          nameSid: builder.internString(kName),
          labelSid: builder.internString(kLabel),
          descriptionSid: builder.internString(kDesc),
          persistenceUnitSid: builder.internString(kPersUnit),
          presentationUnitsSid: builder.internString(kPresUnits),
          relativeError: kRelError,
        };
        const kIdx = builder.addKoq(kData);
        koqFullNameToIdx.set(`${requireSchema().name}:${kName}`.toLowerCase(), kIdx);
        koqCount++;
        break;
      }

      case Tag.PropCat: {
        const pcName = reader.readSRef();
        const pcLabel = reader.readSRef();
        const pcDesc = reader.readSRef();
        const pcPriority = reader.readI32();

        const pcData: PropCategoryData = {
          schemaIdx: requireSchema().schemaIdx,
          nameSid: builder.internString(pcName),
          labelSid: builder.internString(pcLabel),
          descriptionSid: builder.internString(pcDesc),
          priority: pcPriority,
        };
        const pcIdx = builder.addPropertyCategory(pcData);
        catFullNameToIdx.set(`${requireSchema().name}:${pcName}`.toLowerCase(), pcIdx);
        catCount++;
        break;
      }

      case Tag.Class: {
        const cName = reader.readSRef();
        const cType = reader.readU8() as ClassType;
        const cModifier = reader.readU8() as ClassModifier;
        const cLabel = reader.readSRef();
        const cDesc = reader.readSRef();
        let relStrength: StrengthType = StrengthType.Referencing;
        let relStrengthDir: StrengthDirection = StrengthDirection.Forward;
        if (cType === ClassType.Relationship) {
          relStrength = reader.readU8() as StrengthType;
          relStrengthDir = reader.readU8() as StrengthDirection;
        }

        const nameSid = builder.internString(cName);
        const descriptionSid = builder.internString(cDesc);
        // Placeholder ClassData - will be replaced after cross-ref resolution
        const classIdx = builder.addClass({
          schemaIdx: requireSchema().schemaIdx,
          nameSid,
          labelSid: builder.internString(cLabel),
          descriptionSid,
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
        });
        requireSchema().classNameToIdx.set(cName.toLowerCase(), classIdx);

        currentPending = {
          schemaIdx: requireSchema().schemaIdx,
          classIdx,
          nameSid,
          labelSid: builder.internString(cLabel),
          descriptionSid,
          type: cType,
          modifier: cModifier,
          relStrength,
          relStrengthDir,
          baseClasses: [],
          properties: [],
          constraints: [],
          schemaName: requireSchema().name,
        };
        pendingClasses.push(currentPending);
        classCount++;
        break;
      }

      case Tag.BaseClass:
        requirePending().baseClasses.push({
          schemaName: reader.readSRef(),
          className: reader.readSRef(),
          ordinal: reader.readU8(),
        });
        break;

      case Tag.Property: {
        const pName = reader.readSRef();
        const pKind = reader.readU8() as PropertyKind;
        const pPrimType = reader.readU16();
        const pExtType = reader.readSRef();
        const pEnumName = reader.readSRef();
        const pStructSchema = reader.readSRef();
        const pStructClass = reader.readSRef();
        const pKoqName = reader.readSRef();
        const pCatName = reader.readSRef();
        const pArrMin = reader.readU32();
        const pArrMax = reader.readU32();
        const pNavRelSchema = reader.readSRef();
        const pNavRelClass = reader.readSRef();
        const pNavDir = reader.readU8();
        const pIsReadonly = reader.readU8() !== 0;
        const pPriority = reader.readI32();
        const pLabel = reader.readSRef();
        const pDesc = reader.readSRef();

        requirePending().properties.push({
          nameSid: builder.internString(pName),
          descriptionSid: builder.internString(pDesc),
          kind: pKind,
          primitiveType: pPrimType as RuntimePrimitiveType,
          extTypeSid: builder.internString(pExtType),
          enumName: pEnumName,
          structSchemaName: pStructSchema,
          structClassName: pStructClass,
          koqName: pKoqName,
          categoryName: pCatName,
          arrayMinOccurs: pArrMin,
          arrayMaxOccurs: pArrMax,
          navRelSchemaName: pNavRelSchema,
          navRelClassName: pNavRelClass,
          navDirection: pNavDir as StrengthDirection,
          isReadonly: pIsReadonly,
          priority: pPriority,
          labelSid: builder.internString(pLabel),
        });
        break;
      }

      case Tag.RelConstr: {
        const rcEnd = reader.readU8();
        const _rcMultLower = reader.readU32(); // multiplicity lower - not stored
        const _rcMultUpper = reader.readU32(); // multiplicity upper - not stored
        const rcIsPoly = reader.readU8() !== 0;
        const _rcRoleLabel = reader.readSRef(); // role label - not stored
        const rcAbsSchema = reader.readSRef();
        const rcAbsClass = reader.readSRef();

        currentConstraint = {
          relEnd: rcEnd,
          isPolymorphic: rcIsPoly,
          abstractSchemaName: rcAbsSchema,
          abstractClassName: rcAbsClass,
          constraintClasses: [],
        };
        requirePending().constraints.push(currentConstraint);
        break;
      }

      case Tag.ConstrClass:
        requireConstraint().constraintClasses.push({
          schemaName: reader.readSRef(),
          className: reader.readSRef(),
        });
        break;

      case Tag.EndSchema:
      case Tag.EndClass:
        break;

      default:
        throw new Error(`Unknown runtime schema tag 0x${tag.toString(16)} at offset ${reader.pos - 1}`);
    }
  }

  // Finalize last schema's ranges
  if (currentSchemaInfo !== undefined) {
    _finalizeSchemaRanges(builder, schemas.length - 1, schemaClassStart, classCount, schemaEnumStart, enumCount, schemaKoqStart, koqCount, schemaCatStart, catCount);
  }

  // Build a global name resolver: "SchemaName:ClassName" -> classIdx
  const classResolver = new Map<string, number>();
  for (const s of schemas) {
    for (const [lowerName, idx] of s.classNameToIdx)
      classResolver.set(`${s.name.toLowerCase()}:${lowerName}`, idx);
  }

  // Also build alias-based resolver
  // We need to walk schemas array from builder - access via the schemas info we cached
  // For now, skip alias resolution (the writer uses full schema names in cross-refs)

  // ECDbSystem extended type name patching
  const ecDbSysSchema = schemas.find((s) => s.name === "ECDbSystem");
  if (ecDbSysSchema) {
    for (const pc of pendingClasses) {
      if (pc.schemaIdx !== ecDbSysSchema.schemaIdx) continue;
      const classNameStr = builder.getString(pc.nameSid);
      const map = ecDbSystemExtendedTypes[classNameStr];
      if (!map) continue;
      for (const prop of pc.properties) {
        const propNameStr = builder.getString(prop.nameSid);
        const patched = map[propNameStr];
        if (patched)
          prop.extTypeSid = builder.internString(patched);
      }
    }
  }

  // Resolve cross-references and finalize classes.
  // Cross-references to excluded schemas (or any schema not in the blob) result in
  // unresolvable names. Instead of crashing, we skip the dangling entry (for iterable
  // arrays like mixins and constraint classes) or leave -1 (for singular refs like
  // baseClass, structClass, etc., where the view object already returns undefined).
  // A summary warning is logged after parsing so issues are visible in diagnostics.
  const danglingRefs: string[] = [];

  for (const pc of pendingClasses) {
    // Sort base classes by ordinal
    pc.baseClasses.sort((a, b) => a.ordinal - b.ordinal);
    const classFullName = `${pc.schemaName}:${builder.getString(pc.nameSid)}`;

    // Resolve base class (ordinal 0 = primary base, others = mixins)
    let baseClassIdx = -1;
    const mixinStartIdx = pc.baseClasses.length > 1 ? builder.classMixinCount : -1;
    let mixinCount = 0;

    for (const bc of pc.baseClasses) {
      const bcKey = `${bc.schemaName.toLowerCase()}:${bc.className.toLowerCase()}`;
      const bcIdx = classResolver.get(bcKey) ?? -1;
      if (bc.ordinal === 0) {
        if (bcIdx === -1 && bc.schemaName) {
          danglingRefs.push(`${classFullName} -> base class ${bc.schemaName}:${bc.className}`);
        }
        baseClassIdx = bcIdx;
      } else {
        if (bcIdx === -1) {
          danglingRefs.push(`${classFullName} -> mixin ${bc.schemaName}:${bc.className}`);
          continue; // skip dangling mixin - don't add -1 to the mixin array
        }
        builder.addClassMixin(bcIdx);
        mixinCount++;
      }
    }

    // Resolve properties
    const ownPropStart = builder.propertyRefCount;
    for (const prop of pc.properties) {
      const propName = builder.getString(prop.nameSid);

      // Resolve structural refs first - drop the property if any can't be resolved.
      // This must happen before non-structural refs (enum, koq, category) to avoid
      // logging dangling refs for a property that'll be dropped anyway.

      // Resolve struct class
      let structClassIdx = -1;
      if (prop.structSchemaName && prop.structClassName) {
        const key = `${prop.structSchemaName.toLowerCase()}:${prop.structClassName.toLowerCase()}`;
        structClassIdx = classResolver.get(key) ?? -1;
        if (structClassIdx === -1) {
          danglingRefs.push(`Dropped ${classFullName}.${propName}: struct class ${prop.structSchemaName}:${prop.structClassName} not found`);
          continue;
        }
      }

      // Resolve nav relationship class
      let navRelClassIdx = -1;
      if (prop.navRelSchemaName && prop.navRelClassName) {
        const key = `${prop.navRelSchemaName.toLowerCase()}:${prop.navRelClassName.toLowerCase()}`;
        navRelClassIdx = classResolver.get(key) ?? -1;
        if (navRelClassIdx === -1) {
          danglingRefs.push(`Dropped ${classFullName}.${propName}: nav relationship ${prop.navRelSchemaName}:${prop.navRelClassName} not found`);
          continue;
        }
      }

      // Resolve non-structural refs (missing = undefined in API, not a reason to drop)

      // Resolve enum
      let enumIdx = -1;
      if (prop.enumName) {
        const key = prop.enumName.includes(":") ? prop.enumName.toLowerCase() : `${pc.schemaName.toLowerCase()}:${prop.enumName.toLowerCase()}`;
        enumIdx = enumFullNameToIdx.get(key) ?? -1;
        if (enumIdx === -1)
          danglingRefs.push(`${classFullName}.${propName} -> enum ${prop.enumName}`);
      }

      // Resolve KoQ
      let koqIdx = -1;
      if (prop.koqName) {
        const key = prop.koqName.includes(":") ? prop.koqName.toLowerCase() : `${pc.schemaName.toLowerCase()}:${prop.koqName.toLowerCase()}`;
        koqIdx = koqFullNameToIdx.get(key) ?? -1;
      }

      // Resolve category
      let categoryIdx = -1;
      if (prop.categoryName) {
        const key = prop.categoryName.includes(":") ? prop.categoryName.toLowerCase() : `${pc.schemaName.toLowerCase()}:${prop.categoryName.toLowerCase()}`;
        categoryIdx = catFullNameToIdx.get(key) ?? -1;
      }

      const def: PropertyDef = {
        nameSid: prop.nameSid,
        descriptionSid: prop.descriptionSid,
        kind: prop.kind,
        primitiveType: prop.primitiveType,
        extTypeSid: prop.extTypeSid,
        enumIdx,
        koqIdx,
        structClassIdx,
        navRelClassIdx,
        navDirection: prop.navDirection,
        categoryIdx,
        isReadOnly: prop.isReadonly,
        isHidden: false, // TODO: C++ writer needs to check CoreCustomAttributes:HiddenProperty CA
        arrayMinOccurs: prop.arrayMinOccurs,
        arrayMaxOccurs: prop.arrayMaxOccurs,
      };

      const defIdx = builder.addPropertyDef(def);
      builder.addPropertyRef({
        defIdx,
        labelSid: prop.labelSid,
        priority: prop.priority,
      });
    }

    // Resolve constraints
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
          continue; // skip dangling constraint class
        }
        builder.addConstraintClassRef(ccIdx);
        classRefCount++;
      }

      const constraintIdx = builder.addRelConstraint({
        abstractConstraintIdx: absClassIdx,
        polymorphic: con.isPolymorphic,
        classRefStart,
        classRefCount,
      });

      if (con.relEnd === 0)
        sourceConstraintIdx = constraintIdx;
      else
        targetConstraintIdx = constraintIdx;
    }

    // Update the class data with resolved references
    const updatedClass: ClassData = {
      schemaIdx: pc.schemaIdx,
      nameSid: pc.nameSid,
      labelSid: pc.labelSid,
      descriptionSid: pc.descriptionSid,
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
    };
    builder.updateClass(pc.classIdx, updatedClass);
  }

  if (danglingRefs.length > 0) {
    // Log once with all dangling references. This is expected when schemas are excluded
    // from the binary blob (Units, Formats, ECDb internals, pure-CA schemas). Properties with
    // broken structural refs (struct class, nav relationship) are dropped entirely; other dangling
    // refs (enum, base class, mixin, constraint) result in `undefined` for the affected accessor.
    // If unexpected schemas appear here, the exclusion list may need revision.
    const cap = 20;
    const lines = danglingRefs.length <= cap ? danglingRefs : [...danglingRefs.slice(0, cap), `... and ${danglingRefs.length - cap} more`];
    Logger.logWarning("core-common.RuntimeSchema", `${danglingRefs.length} unresolved cross-reference(s) in runtime schema blob (likely from excluded schemas):\n  ${lines.join("\n  ")}`);
  }

  return builder.build();
}

/** Update schema range data after all items for a schema are collected.
 * @internal
 */
function _finalizeSchemaRanges(
  builder: RuntimeSchemaContextBuilder,
  schemaIdx: number,
  classStart: number, classCountVal: number,
  enumStart: number, enumCountVal: number,
  koqStart: number, koqCountVal: number,
  catStart: number, catCountVal: number,
): void {
  builder.updateSchemaRanges(schemaIdx, {
    classRangeStart: classStart,
    classCount: classCountVal - classStart,
    enumRangeStart: enumStart,
    enumCount: enumCountVal - enumStart,
    koqRangeStart: koqStart,
    koqCount: koqCountVal - koqStart,
    catRangeStart: catStart,
    catCount: catCountVal - catStart,
    viewRangeStart: 0,
    viewCount: 0,
  });
}
