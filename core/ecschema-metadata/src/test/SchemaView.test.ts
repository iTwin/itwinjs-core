/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { StrengthDirection, StrengthType } from "../ECObjects";
import { SchemaView } from "../SchemaView/SchemaView";
import { SchemaViewBuilder } from "../SchemaView/SchemaViewBuilder";
import { ClassModifier, ClassType, PropertyKind, schemaViewFormatVersion, SchemaViewPrimitiveType } from "../SchemaView/SchemaViewInterfaces";

function makeLabelViews(name: string, label?: string) {
  const builder = new SchemaViewBuilder();
  function namedFields(prefix: string) {
    return {
      nameStringIdx: builder.internString(`${prefix}${name}`),
      labelStringIdx: builder.internString(label ? `${prefix}${label}` : label),
      descriptionStringIdx: 0,
    };
  }

  const schemaIdx = builder.addSchema({
    ...namedFields("Schema"),
    ecInstanceId: 1,
    aliasStringIdx: builder.internString("test"),
    versionRead: 1, versionWrite: 0, versionMinor: 0,
    classRangeStart: 0, classCount: 1,
    enumRangeStart: 0, enumCount: 1,
    koqRangeStart: 0, koqCount: 1,
    catRangeStart: 0, catCount: 1,
    isHidden: false,
  });
  builder.addClass({
    ...namedFields("Class"),
    ecInstanceId: 2,
    schemaIdx,
    type: ClassType.Entity,
    modifier: ClassModifier.None,
    baseClassIdx: -1,
    mixinStartIdx: 0, mixinCount: 0,
    ownPropStart: 0, ownPropCount: 1,
    strength: StrengthType.Referencing,
    strengthDirection: StrengthDirection.Forward,
    sourceConstraintIdx: -1, targetConstraintIdx: -1,
    isHidden: undefined,
  });
  const defIdx = builder.addPropertyDef({
    nameStringIdx: builder.internString(`Property${name}`),
    descriptionStringIdx: 0,
    kind: PropertyKind.Primitive,
    primitiveType: SchemaViewPrimitiveType.String,
    extTypeStringIdx: 0,
    enumIdx: -1, koqIdx: -1, structClassIdx: -1, navRelClassIdx: -1, categoryIdx: -1,
    navDirection: StrengthDirection.Forward,
    isReadOnly: false,
    isHidden: false,
    arrayMinOccurs: undefined, arrayMaxOccurs: undefined,
  });
  builder.addPropertyRef({ ecInstanceId: 3, defIdx, labelStringIdx: namedFields("Property").labelStringIdx, priority: 0 });
  builder.addEnumeration({
    ...namedFields("Enumeration"),
    ecInstanceId: 4,
    schemaIdx,
    primitiveType: SchemaViewPrimitiveType.Integer,
    isStrict: true,
    enumeratorStart: 0, enumeratorCount: 1,
  });
  builder.addEnumerator({ ...namedFields("Enumerator"), value: 1 });
  builder.addKoq({
    ...namedFields("KindOfQuantity"),
    ecInstanceId: 5,
    schemaIdx,
    persistenceUnitStringIdx: builder.internString("Units:M"),
    presentationFormatsStringIdx: 0,
    relativeError: 0.001,
  });
  builder.addPropertyCategory({ ...namedFields("PropertyCategory"), ecInstanceId: 6, schemaIdx, priority: 0 });

  const view = builder.build();
  const schema = view.getSchema(`Schema${name}`)!;
  const cls = schema.getClass(`Class${name}`)!;
  const enumeration = schema.getEnumeration(`Enumeration${name}`)!;
  return [
    ["Schema", schema],
    ["Class", cls],
    ["Property", cls.getProperty(`Property${name}`)!],
    ["Enumeration", enumeration],
    ["Enumerator", enumeration.getEnumeratorByName(`Enumerator${name}`)!],
    ["KindOfQuantity", schema.getKindOfQuantity(`KindOfQuantity${name}`)!],
    ["PropertyCategory", schema.getPropertyCategory(`PropertyCategory${name}`)!],
  ] as const;
}

/** Build the smallest valid SchemaView blob: header + empty PropertyDefTable, SchemaTable,
 * EnumTable, KoQTable, PropCatTable, ClassTable, then a string table with one empty entry. */
function makeMinimalBlob(): Uint8Array {
  // Layout: magic(4) + version(1) + stOffset(4) = 9 bytes header
  // then PropertyDefTable(tag+u32) + SchemaTable(tag+u32) + EnumTable(tag+u32)
  //      + KoQTable(tag+u32) + PropCatTable(tag+u32) + ClassTable(tag+u32) = 6 * 5 = 30 bytes
  // string table at offset 9+30 = 39: u32 count = 0
  const total = 9 + 30 + 4;
  const buf = new Uint8Array(total);
  const view = new DataView(buf.buffer);
  let p = 0;
  view.setUint32(p, 0x43534348, true); p += 4; // "CSCH" magic
  buf[p++] = schemaViewFormatVersion;
  view.setUint32(p, 39, true); p += 4; // stOffset
  // 6 empty tables: tag byte + u32 count = 0
  const tags = [0x0A, 0x10, 0x20, 0x30, 0x31, 0x40];
  for (const tag of tags) {
    buf[p++] = tag;
    view.setUint32(p, 0, true); p += 4;
  }
  // String table: count = 0
  view.setUint32(p, 0, true); p += 4;
  return buf;
}

describe("SchemaView.parseFormatString", () => {
  it("parses a name-only format string", () => {
    const f = SchemaView.parseFormatString("f:DefaultRealU");
    expect(f.name).to.equal("f:DefaultRealU");
    expect(f.precision).to.be.undefined;
    expect(f.unitAndLabels).to.be.undefined;
  });

  it("parses precision override without units", () => {
    const f = SchemaView.parseFormatString("f:DefaultRealU(4)");
    expect(f.name).to.equal("f:DefaultRealU");
    expect(f.precision).to.equal(4);
    expect(f.unitAndLabels).to.be.undefined;
  });

  it("parses a single unit override without label", () => {
    const f = SchemaView.parseFormatString("f:DefaultRealU(2)[u:M]");
    expect(f.name).to.equal("f:DefaultRealU");
    expect(f.precision).to.equal(2);
    expect(f.unitAndLabels).to.deep.equal([["u:M", undefined]]);
  });

  it("parses a unit override with explicit label", () => {
    const f = SchemaView.parseFormatString("f:DefaultRealU(3)[u:M|meter]");
    expect(f.precision).to.equal(3);
    expect(f.unitAndLabels).to.deep.equal([["u:M", "meter"]]);
  });

  it("parses a unit override with empty label after the pipe", () => {
    const f = SchemaView.parseFormatString("f:DefaultRealU(3)[u:M|]");
    expect(f.unitAndLabels).to.deep.equal([["u:M", ""]]);
  });

  it("parses multi-unit composite format (DMS-style)", () => {
    const f = SchemaView.parseFormatString("f:AngleDMS[u:ARC_DEG|°][u:ARC_MINUTE|'][u:ARC_SECOND|\"]");
    expect(f.name).to.equal("f:AngleDMS");
    expect(f.precision).to.be.undefined;
    expect(f.unitAndLabels).to.deep.equal([
      ["u:ARC_DEG", "°"],
      ["u:ARC_MINUTE", "'"],
      ["u:ARC_SECOND", "\""],
    ]);
  });

  it("returns input as name when no recognizable format prefix is present", () => {
    const f = SchemaView.parseFormatString("");
    expect(f.name).to.equal("");
    expect(f.precision).to.be.undefined;
    expect(f.unitAndLabels).to.be.undefined;
  });
});

describe("SchemaView.fromBinary - happy path", () => {
  it("parses a minimal empty blob", () => {
    const view = SchemaView.fromBinary(makeMinimalBlob(), "test-token");
    expect(view.schemaCount).to.equal(0);
    expect(view.classCount).to.equal(0);
    expect(view.schemaToken).to.equal("test-token");
    expect(view.isOutdated).to.be.false;
  });
});

describe("SchemaView label fallback", () => {
  it.each([
    { name: "OrdinaryName", label: undefined, expected: "OrdinaryName" },
    { name: "Encoded__x0020__Name__x0021____x003f__", label: undefined, expected: "Encoded Name!?" },
    { name: "Unicode__x96EA____xD83D____xDE00__", label: undefined, expected: "Unicode雪😀" },
    { name: "Malformed__x12____xGGGG____x12345__", label: undefined, expected: "Malformed__x12____xGGGG____x12345__" },
    { name: "Empty__x0020__Label", label: "", expected: "Empty Label" },
    { name: "Encoded__x0020__Name", label: "Explicit label", expected: "Explicit label" },
    { name: "Encoded__x0020__Name", label: "Explicit__x0020__Label", expected: "Explicit__x0020__Label" },
    { name: "Same__x0020__Name", label: "Same__x0020__Name", expected: "Same__x0020__Name" },
  ])("resolves $name with label $label", ({ name, label, expected }) => {
    for (const [prefix, item] of makeLabelViews(name, label)) {
      expect(item.label, prefix).toBe(`${prefix}${expected}`);
      expect(item.label, prefix).toBe(`${prefix}${expected}`);
      expect(item.name, prefix).toBe(`${prefix}${name}`);
    }
  });

  it.each([
    { name: "", expected: "" },
    { name: "1 Legacy Value", expected: "1 Legacy Value" },
    { name: "1 Legacy__x0020__Value", expected: "1 Legacy Value" },
  ])("accepts a legacy string enumerator name '$name'", ({ name, expected }) => {
    const builder = new SchemaViewBuilder();
    builder.addEnumerator({
      nameStringIdx: builder.internString(name),
      labelStringIdx: 0,
      descriptionStringIdx: 0,
      value: name,
    });
    const enumerator = new SchemaView.Enumerator(builder.build(), 0);
    expect(enumerator.label).toBe(expected);
    expect(enumerator.name).toBe(name);
  });
});

describe("SchemaView.fromBinary - malformed blobs", () => {
  it("rejects an empty buffer", () => {
    expect(() => SchemaView.fromBinary(new Uint8Array(0))).to.throw();
  });

  it("rejects a wrong magic number", () => {
    const buf = makeMinimalBlob();
    new DataView(buf.buffer).setUint32(0, 0xDEADBEEF, true);
    expect(() => SchemaView.fromBinary(buf)).to.throw(/magic/i);
  });

  it("rejects an unsupported format version", () => {
    const buf = makeMinimalBlob();
    buf[4] = (schemaViewFormatVersion + 1) & 0xFF;
    expect(() => SchemaView.fromBinary(buf)).to.throw(/version/i);
  });

  it("rejects a stringTable offset past the end of the blob", () => {
    const buf = makeMinimalBlob();
    new DataView(buf.buffer).setUint32(5, buf.length + 100, true);
    expect(() => SchemaView.fromBinary(buf)).to.throw();
  });

  it("rejects a stringTable count larger than the remaining buffer", () => {
    const buf = makeMinimalBlob();
    // String-table starts at offset 39 (per makeMinimalBlob). Overwrite count with a huge value
    // that would make `new Array(count)` allocate gigabytes if not validated.
    new DataView(buf.buffer).setUint32(39, 0xFFFFFFFF, true);
    expect(() => SchemaView.fromBinary(buf)).to.throw(/count|exceeds/i);
  });

  it("rejects a string entry whose length runs past the end of the buffer", () => {
    // Build a blob with one string entry that claims length 1000 but only has a few bytes left.
    const total = 9 + 30 + 4 + 4 + 2;
    const buf = new Uint8Array(total);
    const view = new DataView(buf.buffer);
    let p = 0;
    view.setUint32(p, 0x43534348, true); p += 4;
    buf[p++] = schemaViewFormatVersion;
    view.setUint32(p, 39, true); p += 4;
    const tags = [0x0A, 0x10, 0x20, 0x30, 0x31, 0x40];
    for (const tag of tags) {
      buf[p++] = tag;
      view.setUint32(p, 0, true); p += 4;
    }
    // String table: count = 1, entry length = 1000 (way past EOF), content bytes = 2 only
    view.setUint32(p, 1, true); p += 4;
    view.setUint32(p, 1000, true); p += 4;
    expect(() => SchemaView.fromBinary(buf)).to.throw(/length|remain/i);
  });

  it("rejects a truncated header (cannot read magic)", () => {
    const buf = new Uint8Array(2);
    expect(() => SchemaView.fromBinary(buf)).to.throw();
  });

  it("rejects a missing tag byte after the header", () => {
    // Header only - then no tables. The first expectTag call should fail to read u8.
    const buf = new Uint8Array(9);
    const view = new DataView(buf.buffer);
    view.setUint32(0, 0x43534348, true);
    buf[4] = schemaViewFormatVersion;
    view.setUint32(5, 9, true); // stOffset = 9 (right at EOF, no tables)
    expect(() => SchemaView.fromBinary(buf)).to.throw();
  });

  it("rejects a wrong tag byte", () => {
    const buf = makeMinimalBlob();
    // Replace the PropertyDefTable tag (at offset 9) with a bogus value.
    buf[9] = 0xFF;
    expect(() => SchemaView.fromBinary(buf)).to.throw(/tag/i);
  });
});

describe("SchemaView husk merging", () => {
  // These cover the pure-TS husk lifecycle contract (createMergeable / mergeFragment) without
  // fabricating a full fragment blob - the writer-to-reader blob contract is exercised end to end
  // in the backend tests (core/backend/.../SchemaViewFragmentLoading.test.ts). The empty minimal
  // blob is enough to assert the husk's identity, emptiness, and guard behaviors.

  it("createMergeable returns an empty, current view", () => {
    const view = SchemaView.createMergeable("husk-token");
    expect(view.schemaCount).to.equal(0);
    expect(view.classCount).to.equal(0);
    expect(view.isOutdated).to.be.false;
    expect(view.schemaToken).to.equal("husk-token");
  });

  it("merges an (empty) fragment into the same instance without throwing", () => {
    const view = SchemaView.createMergeable();
    view.mergeFragment(makeMinimalBlob());
    expect(view.schemaCount).to.equal(0);
    // A second empty merge is also a no-op and must not throw.
    view.mergeFragment(makeMinimalBlob());
    expect(view.schemaCount).to.equal(0);
  });

  it("throws when merging into a non-mergeable (fromBinary) view", () => {
    const view = SchemaView.fromBinary(makeMinimalBlob());
    expect(() => view.mergeFragment(makeMinimalBlob())).to.throw(/not mergeable/i);
  });
});

