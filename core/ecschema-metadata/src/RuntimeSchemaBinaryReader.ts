/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { Logger } from "@itwin/core-bentley";
import { RuntimeSchemaContext, RuntimeSchemaContextBuilder } from "./RuntimeSchemaContext";
import { type ClassData, ClassModifier, ClassType, type EnumerationData, type EnumeratorData, type KoqData, type PropCategoryData, type PropertyDef, PropertyKind, RuntimePrimitiveType, runtimeSchemasFormatVersion, type SchemaData, StrengthDirection, StrengthType, type ViewData } from "./RuntimeSchemaInterfaces";

/** Binary record tags for the runtime schema format. Must stay in sync with the C++ writer. */
enum Tag {
  PropertyDefTable = 0x0A,
  View = 0x0C,
  EndView = 0x0D,
  Schema = 0x10,
  SchemaRef = 0x11,
  Enum = 0x20,
  KoQ = 0x30,
  PropCat = 0x31,
  Class = 0x40,
  BaseClass = 0x41,
  PropRef = 0x51,
  RelConstr = 0x70,
  ConstrClass = 0x71,
  EndSchema = 0x1F,
  EndClass = 0x4F,
}

const MAGIC = 0x43534348; // "CSCH"

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
  propRefs: PendingPropRef[];
  constraints: PendingConstraint[];
  schemaName: string;
}

/** A property reference from the binary PropertyDefTable. During parsing, `preDefIdx` stores the
 *  index into the pre-parsed def array; during resolution it's mapped to the builder's deduped defIdx. */
interface PendingPropRef {
  preDefIdx: number; // index into preParsedDefs (mapped to builder defIdx during resolution)
  labelSid: number;
  priority: number;
}

/** Pre-parsed property definition from the binary PropertyDefTable, with name-based cross-refs. */
interface PreParsedDef {
  name: string;
  description: string;
  kind: PropertyKind;
  primitiveType: RuntimePrimitiveType;
  extType: string;
  enumSchemaName: string;
  enumName: string;
  structSchemaName: string;
  structClassName: string;
  koqSchemaName: string;
  koqName: string;
  catSchemaName: string;
  categoryName: string;
  arrayMinOccurs: number;
  arrayMaxOccurs: number;
  navRelSchemaName: string;
  navRelClassName: string;
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

interface PendingView {
  schemaIdx: number;
  viewIdx: number;
  nameSid: number;
  labelSid: number;
  descriptionSid: number;
  modifier: ClassModifier;
  baseSchemaName: string;
  baseClassName: string;
  propRefs: PendingPropRef[];
}

/** Parse a runtime schema blob into a `RuntimeSchemaContext`.
 *
 * The binary format uses name-based cross-references (schema:class strings) for base classes,
 * struct types, navigation relationships, enum types, etc. This parser resolves those to
 * numeric indices during population.
 *
 * @beta
 */
export function parseRuntimeSchemaBlob(data: Uint8Array, schemaToken?: string): RuntimeSchemaContext {
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
  if (version !== runtimeSchemasFormatVersion)
    throw new Error(`Unsupported runtime schema version: ${version}, expected ${runtimeSchemasFormatVersion}`);
  const stOffset = reader.readU32();

  // Parse the string table first so SRef reads work
  reader.parseStringTable(stOffset);

  const builder = new RuntimeSchemaContextBuilder();

  // Intermediate storage for deferred cross-reference resolution
  const schemas: Array<{ name: string; schemaIdx: number; classNameToIdx: Map<string, number> }> = [];
  const pendingClasses: PendingClass[] = [];
  const pendingViews: PendingView[] = [];

  // Per-schema item name-to-index maps for enums, KoQs, categories (qualified: "Schema:Name")
  const enumFullNameToIdx = new Map<string, number>();
  const koqFullNameToIdx = new Map<string, number>();
  const catFullNameToIdx = new Map<string, number>();

  // Pre-parsed PropertyDef table - populated when PropertyDefTable tag is encountered
  let preParsedDefs: PreParsedDef[] = [];

  let currentSchemaInfo: { name: string; schemaIdx: number; classNameToIdx: Map<string, number> } | undefined;
  let currentPending: PendingClass | undefined;
  let currentPendingView: PendingView | undefined;
  let currentConstraint: PendingConstraint | undefined;

  // Track range starts for sub-items within each schema
  let schemaClassStart = 0;
  let schemaEnumStart = 0;
  let schemaKoqStart = 0;
  let schemaCatStart = 0;
  let schemaViewStart = 0;
  let enumCount = 0;
  let koqCount = 0;
  let catCount = 0;
  let classCount = 0;
  let viewCount = 0;

  while (reader.pos < stOffset) {
    const tag = reader.readU8();
    switch (tag) {
      case Tag.PropertyDefTable: {
        // Parse the deduplicated property definition table.
        // Each def stores the structural shape; per-class overrides live in PropRef records.
        // The C++ writer now emits schema names for enum/KoQ/category cross-references.
        const defCount = reader.readU32();
        preParsedDefs = new Array(defCount);
        for (let i = 0; i < defCount; i++) {
          preParsedDefs[i] = {
            name: reader.readSRef(),
            kind: reader.readU8() as PropertyKind,
            primitiveType: reader.readU16() as RuntimePrimitiveType,
            extType: reader.readSRef(),
            enumSchemaName: reader.readSRef(),
            enumName: reader.readSRef(),
            structSchemaName: reader.readSRef(),
            structClassName: reader.readSRef(),
            koqSchemaName: reader.readSRef(),
            koqName: reader.readSRef(),
            catSchemaName: reader.readSRef(),
            categoryName: reader.readSRef(),
            arrayMinOccurs: reader.readU32(),
            arrayMaxOccurs: reader.readU32(),
            navRelSchemaName: reader.readSRef(),
            navRelClassName: reader.readSRef(),
            navDirection: reader.readU8() as StrengthDirection,
            isReadonly: reader.readU8() !== 0,
            isHidden: reader.readU8() !== 0,
            description: reader.readSRef(),
          };
        }
        break;
      }

      case Tag.Schema: {
        // Finalize previous schema if any
        if (currentSchemaInfo !== undefined) {
          _finalizeSchemaRanges(builder, schemas.length - 1, schemaClassStart, classCount, schemaEnumStart, enumCount, schemaKoqStart, koqCount, schemaCatStart, catCount, schemaViewStart, viewCount);
        }
        currentPending = undefined;
        currentPendingView = undefined;
        currentConstraint = undefined;

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
        schemaViewStart = viewCount;

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
          propRefs: [],
          constraints: [],
          schemaName: requireSchema().name,
        };
        pendingClasses.push(currentPending);
        classCount++;
        currentConstraint = undefined;
        break;
      }

      case Tag.BaseClass:
        requirePending().baseClasses.push({
          schemaName: reader.readSRef(),
          className: reader.readSRef(),
          ordinal: reader.readU8(),
        });
        break;

      case Tag.PropRef: {
        // Property reference into the pre-parsed PropertyDef table. The def is stored
        // with name-based cross-refs that will be resolved after all schemas are parsed.
        // We just record the def index + per-ref overrides (label, priority) here.
        const prDefIdx = reader.readU32();
        const prLabelSid = builder.internString(reader.readSRef());
        const prPriority = reader.readI32();

        const propRef: PendingPropRef = {
          preDefIdx: prDefIdx,
          labelSid: prLabelSid,
          priority: prPriority,
        };

        if (currentPendingView !== undefined)
          currentPendingView.propRefs.push(propRef);
        else
          requirePending().propRefs.push(propRef);
        break;
      }

      case Tag.RelConstr: {
        const rcEnd = reader.readU8();
        const rcMultLower = reader.readU32();
        const rcMultUpper = reader.readU32();
        const rcIsPoly = reader.readU8() !== 0;
        const rcRoleLabel = reader.readSRef();
        const rcAbsSchema = reader.readSRef();
        const rcAbsClass = reader.readSRef();

        currentConstraint = {
          relEnd: rcEnd,
          isPolymorphic: rcIsPoly,
          multiplicityLower: rcMultLower,
          multiplicityUpper: rcMultUpper,
          roleLabel: rcRoleLabel,
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

      case Tag.EndClass:
        currentPending = undefined;
        currentConstraint = undefined;
        break;

      case Tag.View: {
        const vName = reader.readSRef();
        const vModifier = reader.readU8() as ClassModifier;
        const vLabel = reader.readSRef();
        const vDesc = reader.readSRef();
        const vBaseSchema = reader.readSRef();
        const vBaseClass = reader.readSRef();

        const vNameSid = builder.internString(vName);
        // Placeholder ViewData - will be replaced after cross-ref resolution
        const vIdx = builder.addView({
          schemaIdx: requireSchema().schemaIdx,
          nameSid: vNameSid,
          labelSid: builder.internString(vLabel),
          descriptionSid: builder.internString(vDesc),
          modifier: vModifier,
          baseClassIdx: -1,
          ownPropStart: 0,
          ownPropCount: 0,
        });

        currentPendingView = {
          schemaIdx: requireSchema().schemaIdx,
          viewIdx: vIdx,
          nameSid: vNameSid,
          labelSid: builder.internString(vLabel),
          descriptionSid: builder.internString(vDesc),
          modifier: vModifier,
          baseSchemaName: vBaseSchema,
          baseClassName: vBaseClass,
          propRefs: [],
        };
        pendingViews.push(currentPendingView);
        viewCount++;
        currentPending = undefined;
        currentConstraint = undefined;
        break;
      }

      case Tag.EndView:
        currentPendingView = undefined;
        break;

      case Tag.EndSchema:
        _finalizeSchemaRanges(builder, schemas.length - 1, schemaClassStart, classCount, schemaEnumStart, enumCount, schemaKoqStart, koqCount, schemaCatStart, catCount, schemaViewStart, viewCount);
        currentSchemaInfo = undefined;
        currentPending = undefined;
        currentPendingView = undefined;
        currentConstraint = undefined;
        break;

      default:
        throw new Error(`Unknown runtime schema tag 0x${tag.toString(16)} at offset ${reader.pos - 1}`);
    }
  }

  // Build a global name resolver: "SchemaName:ClassName" -> classIdx
  const classResolver = new Map<string, number>();
  for (const s of schemas) {
    for (const [lowerName, idx] of s.classNameToIdx)
      classResolver.set(`${s.name.toLowerCase()}:${lowerName}`, idx);
  }

  // Resolve pre-parsed defs to PropertyDef objects once. Each pre-parsed def is resolved
  // and added to the builder (with dedup). The result maps preParsedDef index -> builder defIdx.
  const danglingRefs: string[] = [];
  const resolvedDefMap = new Map<number, number>(); // preParsedDef index -> builder's deduped defIdx
  // Some defs are unresolvable (broken structural ref) - track them to skip their PropRefs
  const brokenDefs = new Set<number>();

  for (let i = 0; i < preParsedDefs.length; i++) {
    const prDef = preParsedDefs[i];

    // Resolve structural refs - if either breaks, mark the def as broken
    let structClassIdx = -1;
    if (prDef.structSchemaName && prDef.structClassName) {
      const key = `${prDef.structSchemaName.toLowerCase()}:${prDef.structClassName.toLowerCase()}`;
      structClassIdx = classResolver.get(key) ?? -1;
      if (structClassIdx === -1) {
        brokenDefs.add(i);
        danglingRefs.push(`Dropped properties with struct class ${prDef.structSchemaName}:${prDef.structClassName}`);
        continue;
      }
    }

    let navRelClassIdx = -1;
    if (prDef.navRelSchemaName && prDef.navRelClassName) {
      const key = `${prDef.navRelSchemaName.toLowerCase()}:${prDef.navRelClassName.toLowerCase()}`;
      navRelClassIdx = classResolver.get(key) ?? -1;
      if (navRelClassIdx === -1) {
        brokenDefs.add(i);
        danglingRefs.push(`Dropped properties with nav relationship ${prDef.navRelSchemaName}:${prDef.navRelClassName}`);
        continue;
      }
    }

    // Resolve non-structural refs (missing = undefined in API, not a reason to drop)
    let enumIdx = -1;
    if (prDef.enumSchemaName && prDef.enumName) {
      const key = `${prDef.enumSchemaName.toLowerCase()}:${prDef.enumName.toLowerCase()}`;
      enumIdx = enumFullNameToIdx.get(key) ?? -1;
      if (enumIdx === -1)
        danglingRefs.push(`Unresolved enum ${prDef.enumSchemaName}:${prDef.enumName}`);
    }

    let koqIdx = -1;
    if (prDef.koqSchemaName && prDef.koqName) {
      const key = `${prDef.koqSchemaName.toLowerCase()}:${prDef.koqName.toLowerCase()}`;
      koqIdx = koqFullNameToIdx.get(key) ?? -1;
    }

    let categoryIdx = -1;
    if (prDef.catSchemaName && prDef.categoryName) {
      const key = `${prDef.catSchemaName.toLowerCase()}:${prDef.categoryName.toLowerCase()}`;
      categoryIdx = catFullNameToIdx.get(key) ?? -1;
    }

    const extTypeSid = builder.internString(prDef.extType);

    const def: PropertyDef = {
      nameSid: builder.internString(prDef.name),
      descriptionSid: builder.internString(prDef.description),
      kind: prDef.kind,
      primitiveType: prDef.primitiveType,
      extTypeSid,
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
    const classFullName = `${pc.schemaName}:${builder.getString(pc.nameSid)}`;

    // Resolve base class (ordinal 0 = primary base, others = mixins)
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

    // Wire up property references. Each PendingPropRef references a pre-parsed def index;
    // we map that to the resolved builder defIdx (skipping broken defs).
    const ownPropStart = builder.propertyRefCount;
    for (const pr of pc.propRefs) {
      if (brokenDefs.has(pr.preDefIdx))
        continue; // skip properties whose structural type couldn't be resolved
      const defIdx = resolvedDefMap.get(pr.preDefIdx);
      if (defIdx === undefined)
        continue; // shouldn't happen, but be safe
      builder.addPropertyRef({
        defIdx,
        labelSid: pr.labelSid,
        priority: pr.priority,
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
        roleLabelSid: builder.internString(con.roleLabel),
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

  // Resolve view cross-references
  for (const pv of pendingViews) {
    // Resolve base class
    let baseClassIdx = -1;
    if (pv.baseSchemaName && pv.baseClassName) {
      const bcKey = `${pv.baseSchemaName.toLowerCase()}:${pv.baseClassName.toLowerCase()}`;
      baseClassIdx = classResolver.get(bcKey) ?? -1;
      if (baseClassIdx === -1)
        danglingRefs.push(`View ${builder.getString(pv.nameSid)} -> base class ${pv.baseSchemaName}:${pv.baseClassName}`);
    }

    // Wire up property references
    const ownPropStart = builder.propertyRefCount;
    for (const pr of pv.propRefs) {
      if (brokenDefs.has(pr.preDefIdx))
        continue;
      const defIdx = resolvedDefMap.get(pr.preDefIdx);
      if (defIdx === undefined)
        continue;
      builder.addPropertyRef({
        defIdx,
        labelSid: pr.labelSid,
        priority: pr.priority,
      });
    }

    const updatedView: ViewData = {
      schemaIdx: pv.schemaIdx,
      nameSid: pv.nameSid,
      labelSid: pv.labelSid,
      descriptionSid: pv.descriptionSid,
      modifier: pv.modifier,
      baseClassIdx,
      ownPropStart,
      ownPropCount: builder.propertyRefCount - ownPropStart,
    };
    builder.updateView(pv.viewIdx, updatedView);
  }

  if (danglingRefs.length > 0) {
    const cap = 20;
    const lines = danglingRefs.length <= cap ? danglingRefs : [...danglingRefs.slice(0, cap), `... and ${danglingRefs.length - cap} more`];
    Logger.logWarning("ecschema-metadata.RuntimeSchema", `${danglingRefs.length} unresolved cross-reference(s) in runtime schema blob (likely from excluded schemas):\n  ${lines.join("\n  ")}`);
  }

  return builder.build(schemaToken);
}

/** @internal */
function _finalizeSchemaRanges(
  builder: RuntimeSchemaContextBuilder,
  schemaIdx: number,
  classStart: number, classTotal: number,
  enumStart: number, enumTotal: number,
  koqStart: number, koqTotal: number,
  catStart: number, catTotal: number,
  viewStart: number, viewTotal: number,
): void {
  builder.updateSchemaRanges(schemaIdx, {
    classRangeStart: classStart,
    classCount: classTotal - classStart,
    enumRangeStart: enumStart,
    enumCount: enumTotal - enumStart,
    koqRangeStart: koqStart,
    koqCount: koqTotal - koqStart,
    catRangeStart: catStart,
    catCount: catTotal - catStart,
    viewRangeStart: viewStart,
    viewCount: viewTotal - viewStart,
  });
}
