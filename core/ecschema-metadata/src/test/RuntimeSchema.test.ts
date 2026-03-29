/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, describe, expect, it } from "vitest";
import { RuntimeSchemaContext, RuntimeSchemaContextBuilder } from "../RuntimeSchemaContext";
import { createRuntimeProperty, RuntimeRelationshipClass } from "../RuntimeSchema";
import { ClassModifier, ClassType, PropertyKind, RuntimePrimitiveType, StrengthDirection, StrengthType, runtimeSchemasFormatVersion } from "../RuntimeSchemaInterfaces";

// ---------------------------------------------------------------------------
// Minimal binary blob builder for test purposes. Mirrors the C++ writer format.
// ---------------------------------------------------------------------------
class TestBlobBuilder {
  private _buf: number[] = [];
  private _strings: string[] = [""];  // SID 0 = ""
  private _stringMap = new Map<string, number>();

  constructor() {
    this._stringMap.set("", 0);
  }

  public putU8(v: number) { this._buf.push(v & 0xFF); }
  public putU16(v: number) { this._buf.push(v & 0xFF, (v >> 8) & 0xFF); }
  public putU32(v: number) { this._buf.push(v & 0xFF, (v >> 8) & 0xFF, (v >> 16) & 0xFF, (v >> 24) & 0xFF); }
  public putI32(v: number) { this.putU32(v >>> 0); }
  public putF64(v: number) {
    const buf = new ArrayBuffer(8);
    new DataView(buf).setFloat64(0, v, true);
    const bytes = new Uint8Array(buf);
    for (const b of bytes) this._buf.push(b);
  }

  public intern(s: string): number {
    const existing = this._stringMap.get(s);
    if (existing !== undefined) return existing;
    const sid = this._strings.length;
    this._strings.push(s);
    this._stringMap.set(s, sid);
    return sid;
  }

  public putSRef(s: string) { this.putU32(this.intern(s)); }

  /** Build the complete blob with header + current records + string table. */
  public build(): Uint8Array {
    const header: number[] = [];
    // Magic
    header.push(0x48, 0x43, 0x53, 0x43); // "CSCH" little-endian = 0x43534348
    // Version
    header.push(runtimeSchemasFormatVersion);
    // String table offset placeholder (4 bytes)
    header.push(0, 0, 0, 0);

    const records = this._buf;
    const stOffset = header.length + records.length;

    // Patch string table offset at bytes [5..8]
    header[5] = stOffset & 0xFF;
    header[6] = (stOffset >> 8) & 0xFF;
    header[7] = (stOffset >> 16) & 0xFF;
    header[8] = (stOffset >> 24) & 0xFF;

    // Build string table
    const st: number[] = [];
    const encoder = new TextEncoder();
    // count
    const count = this._strings.length;
    st.push(count & 0xFF, (count >> 8) & 0xFF, (count >> 16) & 0xFF, (count >> 24) & 0xFF);
    for (const s of this._strings) {
      const encoded = encoder.encode(s);
      const len = encoded.length;
      st.push(len & 0xFF, (len >> 8) & 0xFF, (len >> 16) & 0xFF, (len >> 24) & 0xFF);
      for (const b of encoded) st.push(b);
    }

    return new Uint8Array([...header, ...records, ...st]);
  }
}

// Tag constants matching RuntimeSchemaBinaryReader.ts (v2 flat format)
const Tag = {
  PropertyDefTable: 0x0A,
  SchemaTable: 0x10,
  EnumTable: 0x20,
  KoQTable: 0x30,
  PropCatTable: 0x31,
  ClassTable: 0x40,
};

/** Helper: write a PropertyDefTable with one or more defs. Each def is a full binary record.
 * Cross-reference fields (enum, struct, koq, cat, navRel) use U32 row IDs, not SRefs. */
function writePropertyDefTable(b: TestBlobBuilder, defs: Array<{
  name: string; kind: PropertyKind; primType: RuntimePrimitiveType;
  extType?: string; enumRowId?: number; structClassRowId?: number;
  koqRowId?: number; catRowId?: number;
  minOccurs?: number; maxOccurs?: number;
  navRelClassRowId?: number; navDir?: number;
  isReadonly?: boolean; isHidden?: boolean; description?: string;
}>) {
  b.putU8(Tag.PropertyDefTable);
  b.putU32(defs.length);
  for (const d of defs) {
    b.putSRef(d.name);
    b.putU8(d.kind);
    b.putU16(d.primType);
    b.putSRef(d.extType ?? "");
    b.putU32(d.enumRowId ?? 0);        // ec_Enumeration.Id
    b.putU32(d.structClassRowId ?? 0); // ec_Class.Id for struct
    b.putU32(d.koqRowId ?? 0);        // ec_KindOfQuantity.Id
    b.putU32(d.catRowId ?? 0);        // ec_PropertyCategory.Id
    b.putU32(d.minOccurs ?? 0);
    b.putU32(d.maxOccurs ?? 0);
    b.putU32(d.navRelClassRowId ?? 0); // ec_Class.Id for nav rel
    b.putU8(d.navDir ?? 0);
    b.putU8(d.isReadonly ? 1 : 0);
    b.putU8(d.isHidden ? 1 : 0);
    b.putSRef(d.description ?? "");
  }
}

/** Helper: write a SchemaTable with schemas. */
function writeSchemaTable(b: TestBlobBuilder, schemas: Array<{
  name: string; v1?: number; v2?: number; v3?: number; alias?: string;
  label?: string; desc?: string; ecInstanceId: number;
}>) {
  b.putU8(Tag.SchemaTable);
  b.putU32(schemas.length);
  for (const s of schemas) {
    b.putSRef(s.name);
    b.putU16(s.v1 ?? 1); b.putU16(s.v2 ?? 0); b.putU16(s.v3 ?? 0);
    b.putSRef(s.alias ?? "");
    b.putSRef(s.label ?? "");
    b.putSRef(s.desc ?? "");
    b.putU32(s.ecInstanceId);
  }
}

/** Helper: write an empty table (tag + count=0). */
function writeEmptyTable(b: TestBlobBuilder, tag: number) {
  b.putU8(tag);
  b.putU32(0);
}

/** Helper: write a class record into the ClassTable. Writes class data + inline sub-items. */
function writeClassRecord(b: TestBlobBuilder, opts: {
  schemaEcId: number; name: string; type: ClassType; modifier: ClassModifier;
  label?: string; desc?: string; ecInstanceId: number;
  strength?: number; strengthDir?: number;
  baseClasses?: Array<{ schemaName: string; className: string; ordinal: number }>;
  propRefs?: Array<{ defIdx: number; label?: string; priority?: number; ecInstanceId: number }>;
  constraints?: Array<{
    relEnd: number; multLower: number; multUpper: number; isPoly: boolean;
    roleLabel?: string; absSchemaName?: string; absClassName?: string;
    classes?: Array<{ schemaName: string; className: string }>;
  }>;
}) {
  b.putU32(opts.schemaEcId);
  b.putSRef(opts.name);
  b.putU8(opts.type);
  b.putU8(opts.modifier);
  b.putSRef(opts.label ?? "");
  b.putSRef(opts.desc ?? "");
  if (opts.type === ClassType.Relationship) {
    b.putU8(opts.strength ?? 0);
    b.putU8(opts.strengthDir ?? 0);
  }
  b.putU32(opts.ecInstanceId);

  // Base classes (count-prefixed)
  const bases = opts.baseClasses ?? [];
  b.putU16(bases.length);
  for (const bc of bases) {
    b.putSRef(bc.schemaName);
    b.putSRef(bc.className);
    b.putU8(bc.ordinal);
  }

  // Property refs (count-prefixed)
  const props = opts.propRefs ?? [];
  b.putU16(props.length);
  for (const pr of props) {
    b.putU32(pr.defIdx);
    b.putSRef(pr.label ?? "");
    b.putI32(pr.priority ?? 0);
    b.putU32(pr.ecInstanceId);
  }

  // Constraints (count-prefixed, only for relationships)
  if (opts.type === ClassType.Relationship) {
    const constrs = opts.constraints ?? [];
    b.putU8(constrs.length);
    for (const con of constrs) {
      b.putU8(con.relEnd);
      b.putU32(con.multLower);
      b.putU32(con.multUpper);
      b.putU8(con.isPoly ? 1 : 0);
      b.putSRef(con.roleLabel ?? "");
      b.putSRef(con.absSchemaName ?? "");
      b.putSRef(con.absClassName ?? "");
      const classes = con.classes ?? [];
      b.putU8(classes.length);
      for (const cc of classes) {
        b.putSRef(cc.schemaName);
        b.putSRef(cc.className);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Tests using the builder API (no binary blob needed)
// ---------------------------------------------------------------------------
describe("RuntimeSchemaContextBuilder", () => {

  function buildSimpleContext(): RuntimeSchemaContext {
    const b = new RuntimeSchemaContextBuilder();
    const sNameSid = b.internString("TestSchema");
    const sAliasSid = b.internString("ts");

    // Schema
    b.addSchema({
      ecInstanceId: 100,
      nameSid: sNameSid, aliasSid: sAliasSid, labelSid: 0, descriptionSid: 0,
      versionRead: 1, versionWrite: 0, versionMinor: 5,
      classRangeStart: 0, classCount: 0,
      enumRangeStart: 0, enumCount: 0,
      koqRangeStart: 0, koqCount: 0,
      catRangeStart: 0, catCount: 0,
    });

    // Enum
    const ePlainIdx = b.addEnumeration({
      ecInstanceId: 200,
      schemaIdx: 0, nameSid: b.internString("Color"), labelSid: 0, descriptionSid: 0,
      primitiveType: RuntimePrimitiveType.Integer, isStrict: true,
      enumeratorStart: b.enumeratorCount, enumeratorCount: 2,
    });
    b.addEnumerator({ nameSid: b.internString("Red"), labelSid: 0, descriptionSid: 0, value: 0 });
    b.addEnumerator({ nameSid: b.internString("Blue"), labelSid: 0, descriptionSid: 0, value: 1 });

    // KoQ
    b.addKoq({
      ecInstanceId: 300,
      schemaIdx: 0, nameSid: b.internString("Length"), labelSid: 0, descriptionSid: 0,
      persistenceUnitSid: b.internString("Units:M"), presentationUnitsSid: b.internString("Units:MM"),
      relativeError: 0.001,
    });

    // Category
    b.addPropertyCategory({
      ecInstanceId: 400,
      schemaIdx: 0, nameSid: b.internString("General"), labelSid: 0, descriptionSid: 0, priority: 10,
    });

    // Entity class "Element"
    const elemNameSid = b.internString("Element");
    const propStart = b.propertyRefCount;
    const defIdx = b.addPropertyDef({
      nameSid: b.internString("CodeValue"), descriptionSid: 0,
      kind: PropertyKind.Primitive, primitiveType: RuntimePrimitiveType.String,
      extTypeSid: 0, enumIdx: -1, koqIdx: -1, structClassIdx: -1,
      navRelClassIdx: -1, navDirection: StrengthDirection.Forward, categoryIdx: -1,
      isReadOnly: false, isHidden: false, arrayMinOccurs: 0, arrayMaxOccurs: 0,
    });
    b.addPropertyRef({ ecInstanceId: 501, defIdx, labelSid: 0, priority: 0 });

    // Hidden property
    const hiddenDefIdx = b.addPropertyDef({
      nameSid: b.internString("InternalData"), descriptionSid: 0,
      kind: PropertyKind.Primitive, primitiveType: RuntimePrimitiveType.Binary,
      extTypeSid: 0, enumIdx: -1, koqIdx: -1, structClassIdx: -1,
      navRelClassIdx: -1, navDirection: StrengthDirection.Forward, categoryIdx: -1,
      isReadOnly: false, isHidden: true, arrayMinOccurs: 0, arrayMaxOccurs: 0,
    });
    b.addPropertyRef({ ecInstanceId: 502, defIdx: hiddenDefIdx, labelSid: 0, priority: 0 });

    b.addClass({
      ecInstanceId: 600,
      schemaIdx: 0, nameSid: elemNameSid, labelSid: 0, descriptionSid: 0,
      type: ClassType.Entity, modifier: ClassModifier.Abstract,
      baseClassIdx: -1, mixinStartIdx: -1, mixinCount: 0,
      ownPropStart: propStart, ownPropCount: 2,
      strength: StrengthType.Referencing, strengthDirection: StrengthDirection.Forward,
      sourceConstraintIdx: -1, targetConstraintIdx: -1,
    });

    // View "MyView" (stored as a class with ClassType.View)
    const viewPropStart = b.propertyRefCount;
    b.addPropertyRef({ ecInstanceId: 503, defIdx, labelSid: b.internString("Code"), priority: 5 }); // shares CodeValue def
    b.addClass({
      ecInstanceId: 700,
      schemaIdx: 0, nameSid: b.internString("MyView"), labelSid: b.internString("My View"),
      descriptionSid: b.internString("A test view"), modifier: ClassModifier.None,
      type: ClassType.View,
      baseClassIdx: 0, // points to Element
      mixinStartIdx: -1, mixinCount: 0,
      ownPropStart: viewPropStart, ownPropCount: 1,
      strength: StrengthType.Referencing, strengthDirection: StrengthDirection.Forward,
      sourceConstraintIdx: -1, targetConstraintIdx: -1,
    });

    // Update schema ranges
    b.updateSchemaRanges(0, {
      classRangeStart: 0, classCount: 2,
      enumRangeStart: 0, enumCount: 1,
      koqRangeStart: 0, koqCount: 1,
      catRangeStart: 0, catCount: 1,
    });

    return b.build("test-token-123");
  }

  it("should build a context with correct schema count", () => {
    const ctx = buildSimpleContext();
    expect(ctx.schemaCount).toBe(1);
    expect(ctx.classCount).toBe(2); // Element + MyView
  });

  it("should look up schema by name and alias", () => {
    const ctx = buildSimpleContext();
    expect(ctx.getSchema("TestSchema")).toBeDefined();
    expect(ctx.getSchema("testschema")).toBeDefined(); // case-insensitive
    expect(ctx.getSchemaByAlias("ts")).toBeDefined();
    expect(ctx.getSchema("NonExistent")).toBeUndefined();
  });

  it("should look up classes by qualified name", () => {
    const ctx = buildSimpleContext();
    const cls = ctx.findClass("TestSchema:Element");
    expect(cls).toBeDefined();
    expect(cls!.name).toBe("Element");
    expect(cls!.type).toBe(ClassType.Entity);
    expect(cls!.modifier).toBe(ClassModifier.Abstract);

    // Dot separator
    expect(ctx.findClass("TestSchema.Element")).toBeDefined();
    // Alias
    expect(ctx.findClass("ts:Element")).toBeDefined();
    // Not found
    expect(ctx.findClass("TestSchema:Missing")).toBeUndefined();
    // No separator
    expect(ctx.findClass("Element")).toBeUndefined();
  });

  it("should expose hidden property flag", () => {
    const ctx = buildSimpleContext();
    const cls = ctx.findClass("TestSchema:Element")!;
    const props = cls.getProperties();
    expect(props.length).toBe(2);

    const codeValue = cls.getProperty("CodeValue")!;
    expect(codeValue.isHidden).toBe(false);

    const hidden = cls.getProperty("InternalData")!;
    expect(hidden.isHidden).toBe(true);
    expect(hidden.isPrimitive()).toBe(true);
    if (hidden.isPrimitive())
      expect(hidden.primitiveType).toBe(RuntimePrimitiveType.Binary);
  });

  it("should filter hidden properties in display code", () => {
    const ctx = buildSimpleContext();
    const cls = ctx.findClass("TestSchema:Element")!;
    const visible = cls.getProperties().filter((p) => !p.isHidden);
    expect(visible.length).toBe(1);
    expect(visible[0].name).toBe("CodeValue");
  });

  describe("views via builder", () => {
    it("should look up views on schema", () => {
      const ctx = buildSimpleContext();
      const schema = ctx.getSchema("TestSchema")!;
      const view = schema.getView("MyView");
      expect(view).toBeDefined();
      expect(view!.name).toBe("MyView");
      expect(view!.label).toBe("My View");
      expect(view!.description).toBe("A test view");
      expect(view!.modifier).toBe(ClassModifier.None);
    });

    it("should look up views via context.findView", () => {
      const ctx = buildSimpleContext();
      const view = ctx.findView("TestSchema:MyView");
      expect(view).toBeDefined();
      expect(view!.fullName).toBe("TestSchema:MyView");

      // Dot separator
      expect(ctx.findView("TestSchema.MyView")).toBeDefined();
      // Alias
      expect(ctx.findView("ts:MyView")).toBeDefined();
      // Not found
      expect(ctx.findView("TestSchema:MissingView")).toBeUndefined();
    });

    it("should have correct baseClass on view", () => {
      const ctx = buildSimpleContext();
      const view = ctx.findView("TestSchema:MyView")!;
      expect(view.baseClass).toBeDefined();
      expect(view.baseClass!.name).toBe("Element");
    });

    it("should have properties on view", () => {
      const ctx = buildSimpleContext();
      const view = ctx.findView("TestSchema:MyView")!;
      const props = view.getProperties();
      expect(props.length).toBe(1);
      expect(props[0].name).toBe("CodeValue");
      expect(props[0].label).toBe("Code"); // per-ref override
      expect(props[0].priority).toBe(5);
    });

    it("should find view property by name", () => {
      const ctx = buildSimpleContext();
      const view = ctx.findView("TestSchema:MyView")!;
      expect(view.getProperty("CodeValue")).toBeDefined();
      expect(view.getProperty("codevalue")).toBeDefined(); // case-insensitive
      expect(view.getProperty("Missing")).toBeUndefined();
    });

    it("should iterate views on schema", () => {
      const ctx = buildSimpleContext();
      const schema = ctx.getSchema("TestSchema")!;
      const views = [...schema.getViews()];
      expect(views.length).toBe(1);
      expect(views[0].isView()).toBe(true);
      expect(views[0].name).toBe("MyView");
    });
  });

  describe("top-level qualified lookups", () => {
    it("should find enumeration by qualified name", () => {
      const ctx = buildSimpleContext();
      const e = ctx.findEnumeration("TestSchema:Color");
      expect(e).toBeDefined();
      expect(e!.name).toBe("Color");
      expect(e!.isStrict).toBe(true);
      expect([...e!.getEnumerators()].length).toBe(2);

      // By alias
      expect(ctx.findEnumeration("ts:Color")).toBeDefined();
      // Case-insensitive
      expect(ctx.findEnumeration("TESTSCHEMA:COLOR")).toBeDefined();
      // Not found
      expect(ctx.findEnumeration("TestSchema:Missing")).toBeUndefined();
    });

    it("should find KindOfQuantity by qualified name", () => {
      const ctx = buildSimpleContext();
      const k = ctx.findKindOfQuantity("TestSchema:Length");
      expect(k).toBeDefined();
      expect(k!.name).toBe("Length");
      expect(k!.persistenceUnit).toBe("Units:M");
      expect(k!.relativeError).toBeCloseTo(0.001);

      expect(ctx.findKindOfQuantity("ts:Length")).toBeDefined();
      expect(ctx.findKindOfQuantity("TestSchema:Missing")).toBeUndefined();
    });

    it("should find PropertyCategory by qualified name", () => {
      const ctx = buildSimpleContext();
      const c = ctx.findPropertyCategory("TestSchema:General");
      expect(c).toBeDefined();
      expect(c!.name).toBe("General");
      expect(c!.priority).toBe(10);

      expect(ctx.findPropertyCategory("ts:General")).toBeDefined();
      expect(ctx.findPropertyCategory("TestSchema:Missing")).toBeUndefined();
    });

    it("should return undefined for invalid qualified names", () => {
      const ctx = buildSimpleContext();
      // No separator
      expect(ctx.findEnumeration("Color")).toBeUndefined();
      expect(ctx.findKindOfQuantity("Length")).toBeUndefined();
      expect(ctx.findPropertyCategory("General")).toBeUndefined();
      expect(ctx.findView("MyView")).toBeUndefined();
    });
  });

  it("should expose schemaToken and isOutdated", () => {
    const ctx = buildSimpleContext();
    expect(ctx.schemaToken).toBe("test-token-123");
    expect(ctx.isOutdated).toBe(false);
    ctx.markOutdated();
    expect(ctx.isOutdated).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests using hand-crafted binary blobs (test the full parser pipeline)
// ---------------------------------------------------------------------------
describe("RuntimeSchemaContext.fromBinary", () => {

  it("should reject invalid magic", () => {
    const blob = new Uint8Array([0x00, 0x00, 0x00, 0x00, 1, 0, 0, 0, 0]);
    expect(() => RuntimeSchemaContext.fromBinary(blob)).toThrow(/Invalid runtime schema magic/);
  });

  it("should reject unsupported format version", () => {
    // Valid magic but wrong version
    const blob = new Uint8Array([0x48, 0x43, 0x53, 0x43, 99, 9, 0, 0, 0]);
    expect(() => RuntimeSchemaContext.fromBinary(blob)).toThrow(/Unsupported runtime schema version.*99/);
  });

  it("should reject unknown tags", () => {
    const b = new TestBlobBuilder();
    b.putU8(0xFF); // unknown tag where PropertyDefTable tag is expected
    expect(() => RuntimeSchemaContext.fromBinary(b.build())).toThrow(/Expected tag 0xa but found 0xff/);
  });

  it("should parse an empty blob (no schemas)", () => {
    const b = new TestBlobBuilder();
    writePropertyDefTable(b, []);
    writeSchemaTable(b, []);
    writeEmptyTable(b, Tag.EnumTable);
    writeEmptyTable(b, Tag.KoQTable);
    writeEmptyTable(b, Tag.PropCatTable);
    writeEmptyTable(b, Tag.ClassTable);
    const ctx = RuntimeSchemaContext.fromBinary(b.build());
    expect(ctx.schemaCount).toBe(0);
    expect(ctx.classCount).toBe(0);
  });

  it("should parse a blob with a schema and class", () => {
    const b = new TestBlobBuilder();

    writePropertyDefTable(b, [{
      name: "Name", kind: PropertyKind.Primitive, primType: RuntimePrimitiveType.String,
    }]);
    writeSchemaTable(b, [{ name: "MySchema", v1: 1, v2: 0, v3: 3, alias: "ms", label: "My Schema", ecInstanceId: 10 }]);
    writeEmptyTable(b, Tag.EnumTable);
    writeEmptyTable(b, Tag.KoQTable);
    writeEmptyTable(b, Tag.PropCatTable);

    // ClassTable with one class
    b.putU8(Tag.ClassTable); b.putU32(1);
    writeClassRecord(b, {
      schemaEcId: 10, name: "Widget", type: ClassType.Entity, modifier: ClassModifier.None,
      label: "Widget Label", desc: "A widget", ecInstanceId: 20,
      propRefs: [{ defIdx: 0, label: "Widget Name", priority: 100, ecInstanceId: 30 }],
    });

    const ctx = RuntimeSchemaContext.fromBinary(b.build(), "abc");
    expect(ctx.schemaToken).toBe("abc");
    expect(ctx.schemaCount).toBe(1);

    const schema = ctx.getSchema("MySchema")!;
    expect(schema.name).toBe("MySchema");
    expect(schema.alias).toBe("ms");
    expect(schema.readVersion).toBe(1);
    expect(schema.minorVersion).toBe(3);

    const widget = schema.getClass("Widget")!;
    expect(widget.name).toBe("Widget");
    expect(widget.label).toBe("Widget Label");
    expect(widget.type).toBe(ClassType.Entity);

    const props = widget.getProperties();
    expect(props.length).toBe(1);
    expect(props[0].name).toBe("Name");
    expect(props[0].label).toBe("Widget Name");
    expect(props[0].priority).toBe(100);
    expect(props[0].isPrimitive()).toBe(true);
  });

  it("should parse hidden properties from binary", () => {
    const b = new TestBlobBuilder();

    writePropertyDefTable(b, [
      { name: "Visible", kind: PropertyKind.Primitive, primType: RuntimePrimitiveType.String, isHidden: false },
      { name: "Secret", kind: PropertyKind.Primitive, primType: RuntimePrimitiveType.Binary, isHidden: true },
    ]);
    writeSchemaTable(b, [{ name: "S", alias: "s", ecInstanceId: 1 }]);
    writeEmptyTable(b, Tag.EnumTable);
    writeEmptyTable(b, Tag.KoQTable);
    writeEmptyTable(b, Tag.PropCatTable);

    b.putU8(Tag.ClassTable); b.putU32(1);
    writeClassRecord(b, {
      schemaEcId: 1, name: "C", type: ClassType.Entity, modifier: ClassModifier.None, ecInstanceId: 2,
      propRefs: [
        { defIdx: 0, ecInstanceId: 10 },
        { defIdx: 1, ecInstanceId: 11 },
      ],
    });

    const ctx = RuntimeSchemaContext.fromBinary(b.build());
    const cls = ctx.findClass("S:C")!;
    const props = cls.getProperties();
    expect(props.length).toBe(2);

    expect(props[0].name).toBe("Visible");
    expect(props[0].isHidden).toBe(false);

    expect(props[1].name).toBe("Secret");
    expect(props[1].isHidden).toBe(true);
  });

  it("should parse Views from binary", () => {
    const b = new TestBlobBuilder();

    writePropertyDefTable(b, [{
      name: "ViewProp", kind: PropertyKind.Primitive, primType: RuntimePrimitiveType.Integer,
    }]);
    writeSchemaTable(b, [{ name: "TestSchema", alias: "ts", ecInstanceId: 1 }]);
    writeEmptyTable(b, Tag.EnumTable);
    writeEmptyTable(b, Tag.KoQTable);
    writeEmptyTable(b, Tag.PropCatTable);

    b.putU8(Tag.ClassTable); b.putU32(2);
    writeClassRecord(b, {
      schemaEcId: 1, name: "BaseEntity", type: ClassType.Entity, modifier: ClassModifier.Abstract, ecInstanceId: 2,
    });
    writeClassRecord(b, {
      schemaEcId: 1, name: "MyQueryView", type: ClassType.View, modifier: ClassModifier.Sealed,
      label: "Query View Label", desc: "A query view", ecInstanceId: 3,
      baseClasses: [{ schemaName: "TestSchema", className: "BaseEntity", ordinal: 0 }],
      propRefs: [{ defIdx: 0, label: "View Column", priority: 50, ecInstanceId: 20 }],
    });

    const ctx = RuntimeSchemaContext.fromBinary(b.build());

    const schema = ctx.getSchema("TestSchema")!;
    expect([...schema.getClasses()].length).toBe(1);
    expect([...schema.getViews()].length).toBe(1);

    const view = schema.getView("MyQueryView")!;
    expect(view.name).toBe("MyQueryView");
    expect(view.label).toBe("Query View Label");
    expect(view.description).toBe("A query view");
    expect(view.modifier).toBe(ClassModifier.Sealed);

    expect(view.baseClass).toBeDefined();
    expect(view.baseClass!.name).toBe("BaseEntity");

    const props = view.getProperties();
    expect(props.length).toBe(1);
    expect(props[0].name).toBe("ViewProp");
    expect(props[0].label).toBe("View Column");
    expect(props[0].priority).toBe(50);
    expect(props[0].isPrimitive()).toBe(true);
    if (props[0].isPrimitive())
      expect(props[0].primitiveType).toBe(RuntimePrimitiveType.Integer);
  });

  it("should find views via context.findView from binary", () => {
    const b = new TestBlobBuilder();
    writePropertyDefTable(b, []);
    writeSchemaTable(b, [{ name: "S", alias: "sa", ecInstanceId: 1 }]);
    writeEmptyTable(b, Tag.EnumTable);
    writeEmptyTable(b, Tag.KoQTable);
    writeEmptyTable(b, Tag.PropCatTable);

    b.putU8(Tag.ClassTable); b.putU32(1);
    writeClassRecord(b, {
      schemaEcId: 1, name: "V1", type: ClassType.View, modifier: ClassModifier.None, ecInstanceId: 2,
    });

    const ctx = RuntimeSchemaContext.fromBinary(b.build());

    expect(ctx.findView("S:V1")).toBeDefined();
    expect(ctx.findView("S:V1")!.name).toBe("V1");
    expect(ctx.findView("S.V1")).toBeDefined();
    expect(ctx.findView("sa:V1")).toBeDefined();
    expect(ctx.findView("s:v1")).toBeDefined();
    expect(ctx.findView("S:V1")!.baseClass).toBeUndefined();
  });

  it("should handle views with no base class and no properties", () => {
    const b = new TestBlobBuilder();
    writePropertyDefTable(b, []);
    writeSchemaTable(b, [{ name: "S", ecInstanceId: 1 }]);
    writeEmptyTable(b, Tag.EnumTable);
    writeEmptyTable(b, Tag.KoQTable);
    writeEmptyTable(b, Tag.PropCatTable);

    b.putU8(Tag.ClassTable); b.putU32(1);
    writeClassRecord(b, {
      schemaEcId: 1, name: "EmptyView", type: ClassType.View, modifier: ClassModifier.None, ecInstanceId: 2,
    });

    const ctx = RuntimeSchemaContext.fromBinary(b.build());
    const view = ctx.findView("S:EmptyView")!;
    expect(view).toBeDefined();
    expect(view.baseClass).toBeUndefined();
    expect(view.getProperties().length).toBe(0);
    expect(view.getProperty("anything")).toBeUndefined();
  });

  it("should parse enumerations with enumerators from binary", () => {
    const b = new TestBlobBuilder();
    writePropertyDefTable(b, []);
    writeSchemaTable(b, [{ name: "S", ecInstanceId: 1 }]);

    // EnumTable with one enum
    b.putU8(Tag.EnumTable); b.putU32(1);
    b.putU32(1);                             // schemaEcId
    b.putSRef("Status");                     // name
    b.putU8(0x05);                           // primitiveType
    b.putU8(1);                              // isStrict
    b.putSRef("Status Label");              // label
    b.putSRef("");                           // description
    b.putSRef(JSON.stringify([
      { Name: "Active", IntValue: 0, DisplayLabel: "Active" },
      { Name: "Inactive", IntValue: 1 },
    ]));
    b.putU32(50);                            // ecInstanceId

    writeEmptyTable(b, Tag.KoQTable);
    writeEmptyTable(b, Tag.PropCatTable);
    writeEmptyTable(b, Tag.ClassTable);

    const ctx = RuntimeSchemaContext.fromBinary(b.build());
    const e = ctx.findEnumeration("S:Status")!;
    expect(e).toBeDefined();
    expect(e.name).toBe("Status");
    expect(e.isStrict).toBe(true);
    expect(e.label).toBe("Status Label");

    const enumerators = [...e.getEnumerators()];
    expect(enumerators.length).toBe(2);
    expect(enumerators[0].name).toBe("Active");
    expect(enumerators[0].value).toBe(0);
    expect(enumerators[0].label).toBe("Active");
    expect(enumerators[1].name).toBe("Inactive");
    expect(enumerators[1].value).toBe(1);
  });

  it("should parse KoQ from binary", () => {
    const b = new TestBlobBuilder();
    writePropertyDefTable(b, []);
    writeSchemaTable(b, [{ name: "S", ecInstanceId: 1 }]);
    writeEmptyTable(b, Tag.EnumTable);

    // KoQTable with one KoQ
    b.putU8(Tag.KoQTable); b.putU32(1);
    b.putU32(1);                   // schemaEcId
    b.putSRef("Area");             // name
    b.putSRef("Area Label");      // label
    b.putSRef("");                 // description
    b.putSRef("Units:SQ_M");     // persistenceUnit
    b.putF64(0.0001);            // relativeError
    b.putSRef("Units:SQ_FT;Units:SQ_M"); // presentationUnits
    b.putU32(60);                 // ecInstanceId

    writeEmptyTable(b, Tag.PropCatTable);
    writeEmptyTable(b, Tag.ClassTable);

    const ctx = RuntimeSchemaContext.fromBinary(b.build());
    const k = ctx.findKindOfQuantity("S:Area")!;
    expect(k).toBeDefined();
    expect(k.name).toBe("Area");
    expect(k.label).toBe("Area Label");
    expect(k.persistenceUnit).toBe("Units:SQ_M");
    expect(k.relativeError).toBeCloseTo(0.0001);
    expect(k.presentationUnits).toBe("Units:SQ_FT;Units:SQ_M");
  });

  it("should parse PropertyCategory from binary", () => {
    const b = new TestBlobBuilder();
    writePropertyDefTable(b, []);
    writeSchemaTable(b, [{ name: "S", ecInstanceId: 1 }]);
    writeEmptyTable(b, Tag.EnumTable);
    writeEmptyTable(b, Tag.KoQTable);

    // PropCatTable with one category
    b.putU8(Tag.PropCatTable); b.putU32(1);
    b.putU32(1);                    // schemaEcId
    b.putSRef("Geometry");          // name
    b.putSRef("Geometry Info");    // label
    b.putSRef("Geom desc");       // description
    b.putI32(42);                   // priority
    b.putU32(70);                   // ecInstanceId

    writeEmptyTable(b, Tag.ClassTable);

    const ctx = RuntimeSchemaContext.fromBinary(b.build());
    const c = ctx.findPropertyCategory("S:Geometry")!;
    expect(c).toBeDefined();
    expect(c.name).toBe("Geometry");
    expect(c.label).toBe("Geometry Info");
    expect(c.description).toBe("Geom desc");
    expect(c.priority).toBe(42);
  });

  it("should resolve base classes and IS-A from binary", () => {
    const b = new TestBlobBuilder();
    writePropertyDefTable(b, []);
    writeSchemaTable(b, [{ name: "S", ecInstanceId: 1 }]);
    writeEmptyTable(b, Tag.EnumTable);
    writeEmptyTable(b, Tag.KoQTable);
    writeEmptyTable(b, Tag.PropCatTable);

    b.putU8(Tag.ClassTable); b.putU32(2);
    writeClassRecord(b, {
      schemaEcId: 1, name: "Base", type: ClassType.Entity, modifier: ClassModifier.Abstract, ecInstanceId: 2,
    });
    writeClassRecord(b, {
      schemaEcId: 1, name: "Derived", type: ClassType.Entity, modifier: ClassModifier.None, ecInstanceId: 3,
      baseClasses: [{ schemaName: "S", className: "Base", ordinal: 0 }],
    });

    const ctx = RuntimeSchemaContext.fromBinary(b.build());
    const base = ctx.findClass("S:Base")!;
    const derived = ctx.findClass("S:Derived")!;

    expect(derived.baseClass).toBeDefined();
    expect(derived.baseClass!.name).toBe("Base");
    expect(derived.is(base)).toBe(true);
    expect(derived.is("S:Base")).toBe(true);
    expect(base.is(derived)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createRuntimeProperty exhaustiveness
// ---------------------------------------------------------------------------
describe("createRuntimeProperty", () => {
  it("should throw on unknown PropertyKind", () => {
    const b = new RuntimeSchemaContextBuilder();
    b.internString("TestSchema");
    b.addSchema({
      ecInstanceId: 1,
      nameSid: 1, aliasSid: 0, labelSid: 0, descriptionSid: 0,
      versionRead: 1, versionWrite: 0, versionMinor: 0,
      classRangeStart: 0, classCount: 0,
      enumRangeStart: 0, enumCount: 0,
      koqRangeStart: 0, koqCount: 0,
      catRangeStart: 0, catCount: 0,
    });

    b.internString("BadProp");
    // Force an invalid kind value (99) into the def. The builder stores it directly.
    const defIdx = b.addPropertyDef({
      nameSid: 2, descriptionSid: 0,
      kind: 99 as PropertyKind, // invalid
      primitiveType: RuntimePrimitiveType.String,
      extTypeSid: 0, enumIdx: -1, koqIdx: -1, structClassIdx: -1,
      navRelClassIdx: -1, navDirection: StrengthDirection.Forward, categoryIdx: -1,
      isReadOnly: false, isHidden: false, arrayMinOccurs: 0, arrayMaxOccurs: 0,
    });

    b.addPropertyRef({ ecInstanceId: 10, defIdx, labelSid: 0, priority: 0 });

    b.addClass({
      ecInstanceId: 2,
      schemaIdx: 0, nameSid: b.internString("C"), labelSid: 0, descriptionSid: 0,
      type: ClassType.Entity, modifier: ClassModifier.None,
      baseClassIdx: -1, mixinStartIdx: -1, mixinCount: 0,
      ownPropStart: 0, ownPropCount: 1,
      strength: StrengthType.Referencing, strengthDirection: StrengthDirection.Forward,
      sourceConstraintIdx: -1, targetConstraintIdx: -1,
    });

    b.updateSchemaRanges(0, {
      classRangeStart: 0, classCount: 1,
      enumRangeStart: 0, enumCount: 0,
      koqRangeStart: 0, koqCount: 0,
      catRangeStart: 0, catCount: 0,
    });

    const ctx = b.build();
    const cls = ctx.findClass("TestSchema:C")!;

    // getProperties() calls createRuntimeProperty internally
    expect(() => cls.getProperties()).toThrow(/Unknown PropertyKind 99/);
  });
});
