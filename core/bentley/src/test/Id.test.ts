/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
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
    const id1 = new Id64("0x123");
    assert.isTrue(id1.isValid, "good");
    assert.equal(id1.toString(), "0x123");
    assert.equal(id1.value, "0x123");
    assert.equal(id1.getHigh(), 0);
    assert.equal(id1.getLow(), 0x123);
    const one = new Id64("0x1");
    assert.equal(one.value, "0x1");
    const badid = new Id64("0");
    assert.isNotTrue(badid.isValid, "bad");
    assert.equal(badid.value, "0");
    const id2 = new Id64("badness");
    assert.equal(id2.value, "0");
    assert.isNotTrue(id2.isValid);
    const id3 = new Id64("0xtbadness");
    assert.isNotTrue(id3.isValid);
    assert.equal("0", id3.value);
    const id4 = new Id64("0x1234567890abcdef");
    assert.isTrue(id4.isValid);
    assert.equal(id4.getHigh(), 0x123456);
    assert.equal(id4.getLow(), 0x7890abcdef);
    const i5 = "0x20000000011";
    const id5 = new Id64(i5);
    assert.equal(id5.getHigh(), 0x2);
    assert.equal(id5.getLow(), 0x11);
    const o5 = id5.value;
    assert.equal(o5, i5);
    const i55 = new Id64([0x11, 2]);
    assert.isTrue(i55.equals(id5));
    const id6 = new Id64([2000000, 3000]);
    const v6 = id6.value;
    const id7 = new Id64(v6);
    assert.isTrue(id6.equals(id7));
    const id8 = new Id64(id7);
    assert.isTrue(id8.equals(id7));
    const abc: any = { a: 1, b: 2 };
    const id9 = new Id64(abc);
    assert.isNotTrue(id9.isValid, "bad type");
    const badarray: any = ["a", "b"];
    const id10 = new Id64(badarray);
    assert.isNotTrue(id10.isValid, "bad type");

    const t1 = { a: id7 };
    const j7 = JSON.stringify(t1);
    const p1 = JSON.parse(j7);
    const i8 = new Id64(p1.a);
    assert(i8.equals(id7));
    assert.isTrue(i8.equals(id7));

    const id1A = new Id64("0x1");
    const id1B = new Id64(id1A);
    const id1C = new Id64("0x01");
    const id1D = new Id64([1, 0]);
    assert.isTrue(id1A.equals(id1B));
    assert.isTrue(id1A.equals(id1C));
    assert.isTrue(id1A.equals(id1D));

    const sameid = Id64.fromJSON(id1A);
    assert.isTrue(sameid === id1A, "fromJSON with an Id64 should return value");
    const differentId = Id64.fromJSON("0x1");
    assert.isFalse(differentId === id1A, "fromJSON with string should create a new Id64");
    assert.isTrue(differentId.equals(id1A), "but they should be the same value");

    // tests for Id64.toIdSet
    let idset = Id64.toIdSet(id1A);
    assert.instanceOf(idset, Set);
    assert.equal(idset.size, 1, "from Id64");
    assert.isTrue(idset.has(id1A.value));

    idset = Id64.toIdSet([id1A.value, id6.value, i55.value, id8.value, i55.value]);
    assert.instanceOf(idset, Set);
    assert.equal(idset.size, 3, "from string[]");
    assert.isTrue(idset.has(i55.value));

    idset = Id64.toIdSet([id1A, id6, i55, id8, i55]);
    assert.instanceOf(idset, Set);
    assert.equal(idset.size, 3, "from Id64[]");
    assert.isTrue(idset.has(i55.value));

    idset = Id64.toIdSet(i55.value);
    assert.instanceOf(idset, Set);
    assert.equal(idset.size, 1, "from string");
    assert.isTrue(idset.has(i55.value));

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
      expect(id64.value).to.equal(id.str);
      expect(id64.getLow()).to.equal(id.localId);
      expect(id64.getHigh()).to.equal(id.briefcaseId);

      const low = id64.getLowUint32();
      const high = id64.getHighUint32();
      expect(low).to.equal(id.low);
      expect(high).to.equal(id.high);
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
