/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { Id64, Guid } from "../bentleyjs-core";

class Uint64Id {
  public constructor(public readonly high: number,
                     public readonly low: number,
                     public readonly localId: number,
                     public readonly briefcaseId: number,
                     public readonly str: string) { }
}

describe("Ids", () => {

  it("Id64 should construct properly", () => {
    const id1 = Id64.fromJSON("0x123");
    assert.isTrue(Id64.isValidId64(id1), "good");
    assert.equal(id1, "0x123");
    assert.equal(id1, "0x123");
    assert.equal(Id64.getBriefcaseId(id1), 0);
    assert.equal(Id64.getLocalId(id1), 0x123);
    const one = Id64.fromJSON("0x1");
    assert.equal(one, "0x1");
    const badid = Id64.fromJSON("0");
    assert.isNotTrue(Id64.isValidId64(badid), "bad");
    assert.equal(badid, "0");
    const id2 = Id64.fromJSON("badness");
    assert.equal(id2, "0");
    assert.isNotTrue(Id64.isValidId64(id2));
    const id3 = Id64.fromJSON("0xtbadness");
    assert.isNotTrue(Id64.isValidId64(id3));
    assert.equal("0", id3);
    const id4 = Id64.fromJSON("0x1234567890abcdef");
    assert.isTrue(Id64.isValidId64(id4));
    assert.equal(Id64.getBriefcaseId(id4), 0x123456);
    assert.equal(Id64.getLocalId(id4), 0x7890abcdef);
    const i5 = "0x20000000011";
    const id5 = Id64.fromJSON(i5);
    assert.equal(Id64.getBriefcaseId(id5), 0x2);
    assert.equal(Id64.getLocalId(id5), 0x11);
    const i55 = Id64.fromLocalAndBriefcaseIds(0x11, 2);
    assert.isTrue(i55 === id5);
    const id6 = Id64.fromLocalAndBriefcaseIds(2000000, 3000);
    const v6 = id6;
    const id7 = Id64.fromJSON(v6);
    assert.isTrue(id6 === id7);
    const id8 = Id64.fromJSON(id7);
    assert.isTrue(id8 === id7);
    const abc: any = { a: 1, b: 2 };
    const id9 = Id64.fromJSON(abc);
    assert.isNotTrue(Id64.isValidId64(id9), "bad type");
    const id10 = Id64.fromLocalAndBriefcaseIds("a" as any, "b" as any);
    assert.isNotTrue(Id64.isValidId64(id10), "bad type");

    const t1 = { a: id7 };
    const j7 = JSON.stringify(t1);
    const p1 = JSON.parse(j7);
    const i8 = Id64.fromJSON(p1.a);
    assert(i8 === id7);
    assert.isTrue(i8 === id7);

    const id1A = Id64.fromJSON("0x1");
    const id1B = Id64.fromJSON(id1A);
    const id1C = Id64.fromJSON("0x01");
    const id1D = Id64.fromLocalAndBriefcaseIds(1, 0);
    assert.isTrue(id1A === id1B);
    assert.isTrue(id1A === id1C);
    assert.isTrue(id1A === id1D);

    const sameid = Id64.fromJSON(id1A);
    assert.isTrue(sameid === id1A, "fromJSON with an Id64 should return value");
    const differentId = Id64.fromJSON("0x1");
    assert.isTrue(differentId === id1A, "fromJSON with string should return same string");

    // tests for Id64.toIdSet
    let idset = Id64.toIdSet(id1A);
    assert.instanceOf(idset, Set);
    assert.equal(idset.size, 1, "from Id64");
    assert.isTrue(idset.has(id1A));

    idset = Id64.toIdSet([id1A, id6, i55, id8, i55]);
    assert.instanceOf(idset, Set);
    assert.equal(idset.size, 3, "from string[]");
    assert.isTrue(idset.has(i55));

    idset = Id64.toIdSet([id1A, id6, i55, id8, i55]);
    assert.instanceOf(idset, Set);
    assert.equal(idset.size, 3, "from Id64[]");
    assert.isTrue(idset.has(i55));

    idset = Id64.toIdSet(i55);
    assert.instanceOf(idset, Set);
    assert.equal(idset.size, 1, "from string");
    assert.isTrue(idset.has(i55));

    const idset2 = Id64.toIdSet(idset);
    assert.equal(idset2, idset, "from IdSet");
  });

  it("should construct an Id64 from two 32-bit integers", () => {
    const ids: Uint64Id[] = [
      new Uint64Id(0, 0, 0, 0, "0"),
      new Uint64Id(0x01234567, 0x89abcdef, 0x6789abcdef, 0x00012345, "0x123456789abcdef"),
      new Uint64Id(0xfedcba98, 0x76543210, 0x9876543210, 0x00fedcba, "0xfedcba9876543210"),
      new Uint64Id(0x00000100, 0x00000001, 0x0000000001, 0x00000001, "0x10000000001"),
    ];

    for (const id of ids) {
      const id64 = Id64.fromUint32Pair(id.low, id.high);
      expect(id64).to.equal(id.str);
      expect(Id64.getLocalId(id64)).to.equal(id.localId);
      expect(Id64.getBriefcaseId(id64)).to.equal(id.briefcaseId);

      const low = Id64.getLowerUint32(id64);
      const high = Id64.getUpperUint32(id64);
      expect(low).to.equal(id.low);
      expect(high).to.equal(id.high);
    }
  });

  it("should validate well-formed Id64Strings", () => {
    const goodIds = [
      "0",
      "0x12345678ab",
      "0xcdef987654",
      "0x1",
      "0xa",
      "0xa000000000",
      "0x10000000001",
      "0x11000000000",
      "0xfffffe0000000001",
    ];

    const badIds = [
      "0x0",
      "0x01",
      "0X1",
      "0xg",
      "0x12345678AB",
      "0xCDEF987654",
      "0xffffff0000000000",
      "0xffffffD000000000",
      "0xh0000000001",
      "0xh000000000000001",
      "0x1h00000000000000",
      "0x100000000000000h",
    ];

    for (const goodId of goodIds) {
      assert.isTrue(Id64.isId64(goodId), goodId);
      if ("0" !== goodId)
        assert.isTrue(Id64.isValidId64(goodId), goodId);
    }

    for (const badId of badIds) {
      assert.isFalse(Id64.isId64(badId), badId);
      assert.isFalse(Id64.isValidId64(badId), badId);
    }
  });

  it("Guid should construct properly", () => {
    const v1 = "274e25dc-8407-11e7-bb31-be2e44b06b34"; // a valid v1 id
    const v4 = "3d04156c-4faa-4eac-b20e-353a9e6c0183"; // a valid v4 id
    const id1 = new Guid(v1);
    assert.isTrue(id1.isValid);
    assert.isFalse(Guid.isV4Guid(v1));

    const id4 = new Guid(v4);
    assert.isTrue(id4.isValid);
    assert.isTrue(Guid.isV4Guid(v4));

    const id5 = new Guid(id4);
    assert.isTrue(id5.isValid);
    assert.isTrue(id5.equals(id4));
    assert.equal(JSON.stringify(id4), '"' + v4 + '"');
    assert.isFalse(new Guid("0x123").isValid);
    assert.isFalse(new Guid("badstuff").isValid);
    assert.isFalse(new Guid().isValid);
    assert.isFalse(new Guid("3d04156c-4faa-4eac-b20e-353a9e6c0183d").isValid); // too long
    assert.isFalse(new Guid("3d04156c-4faa-4eac-b20e-353a9e6c018r").isValid); // "r" is invalid
    assert.isTrue(new Guid("3d04156C-4fAa-4eac-b20e-353a9e6c018F").isValid); // should accept uppercase characters
    assert.isFalse(new Guid(false).isValid);

    const id6 = new Guid(true);
    const id7 = new Guid(true);
    assert.isTrue(id6.isValid);
    assert.isDefined(id6.value);
    assert.isTrue(Guid.isGuid(id6.value));
    assert.isTrue(Guid.isV4Guid(id6.value));
    assert.notEqual(id6.toString(), id7.toString());
  });

});
