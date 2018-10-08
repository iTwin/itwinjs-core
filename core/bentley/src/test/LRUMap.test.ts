/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { LRUMap } from "../bentleyjs-core";

describe("LRUMap", () => {

  it("get and set", () => {
    const c = new LRUMap(4);
    assert.equal(c.size, 0);
    assert.equal(c.limit, 4);
    assert.equal(c.oldest, undefined);
    assert.equal(c.newest, undefined);

    c.set("adam", 29)
      .set("john", 26)
      .set("angela", 24)
      .set("bob", 48);
    assert.equal(c.toString(), "adam:29 < john:26 < angela:24 < bob:48");
    assert.equal(c.size, 4);

    assert.equal(c.get("adam"), 29);
    assert.equal(c.get("john"), 26);
    assert.equal(c.get("angela"), 24);
    assert.equal(c.get("bob"), 48);
    assert.equal(c.toString(), "adam:29 < john:26 < angela:24 < bob:48");

    assert.equal(c.get("angela"), 24);
    assert.equal(c.toString(), "adam:29 < john:26 < bob:48 < angela:24");

    c.set("ygwie", 81);
    assert.equal(c.toString(), "john:26 < bob:48 < angela:24 < ygwie:81");
    assert.equal(c.size, 4);
    assert.equal(c.get("adam"), undefined);

    c.set("john", 11);
    assert.equal(c.toString(), "bob:48 < angela:24 < ygwie:81 < john:11");
    assert.equal(c.get("john"), 11);

    const expectedKeys = ["bob", "angela", "ygwie", "john"];
    c.forEach((_v, k) => {
      // sys.sets(k+': '+v);
      assert.equal(k, expectedKeys.shift());
    });

    // removing one item decrements size by one
    const currentSize = c.size;
    assert(c.delete("john") !== undefined);
    assert.equal(currentSize - 1, c.size);
  });

  const verifyEntries = (c: LRUMap<any, any>) => {
    assert.equal(c.size, 4);
    assert.equal(c.limit, 4);
    assert.equal(c.oldest!.key, "adam");
    assert.equal(c.newest!.key, "bob");
    assert.equal(c.get("adam"), 29);
    assert.equal(c.get("john"), 26);
    assert.equal(c.get("angela"), 24);
    assert.equal(c.get("bob"), 48);
  };

  it("tests", () => {
    // with explicit limit
    const c = new LRUMap(4);
    c.assign([
      ["adam", 29],
      ["john", 26],
      ["angela", 24],
      ["bob", 48],
    ]);

    verifyEntries(c);

    const newEntries = [
      ["mimi", 1],
      ["patrick", 2],
      ["jane", 3],
      ["fred", 4],
    ];

    c.assign(newEntries as any);
    assert.equal(c.size, 4);
    assert.equal(c.limit, 4);
    assert.equal(c.oldest!.key, newEntries[0][0]);
    assert.equal(c.newest!.key, newEntries[newEntries.length - 1][0]);
    let i = 0;
    c.forEach((v, k) => {
      assert.equal(k, newEntries[i][0]);
      assert.equal(v, newEntries[i][1]);
      i++;
    });

    // assigning too many items should throw an exception
    assert.throws(() => {
      c.assign([
        ["adam", 29],
        ["john", 26],
        ["angela", 24],
        ["bob", 48],
        ["ken", 30],
      ]);
    }, /overflow/);

    // assigning less than limit should not affect limit but adjust size
    c.assign([
      ["adam", 29],
      ["john", 26],
      ["angela", 24],
    ]);
    assert.equal(c.size, 3);
    assert.equal(c.limit, 4);
  });

  it("delete", () => {
    const c = new LRUMap(4);
    c.assign([
      ["adam", 29],
      ["john", 26],
      ["angela", 24],
      ["bob", 48],
    ]);
    c.delete("adam");
    assert.equal(c.size, 3);
    c.delete("angela");
    assert.equal(c.size, 2);
    c.delete("bob");
    assert.equal(c.size, 1);
    c.delete("john");
    assert.equal(c.size, 0);
    assert.equal(c.oldest, undefined);
    assert.equal(c.newest, undefined);
  });

  it("clear", () => {
    const c = new LRUMap(4);
    c.set("adam", 29);
    c.set("john", 26);
    assert.equal(c.size, 2);
    c.clear();
    assert.equal(c.size, 0);
    assert.equal(c.oldest, undefined);
    assert.equal(c.newest, undefined);
  });

  it("shift", () => {
    const c2 = new LRUMap(4);
    assert.equal(c2.size, 0);
    c2.set("a", 1);
    c2.set("b", 2);
    c2.set("c", 3);
    assert.equal(c2.size, 3);

    let e = c2.shift()!;
    assert.equal(e[0], "a");
    assert.equal(e[1], 1);

    e = c2.shift()!;
    assert.equal(e[0], "b");
    assert.equal(e[1], 2);

    e = c2.shift()!;
    assert.equal(e[0], "c");
    assert.equal(e[1], 3);

    // c2 should be empty
    c2.forEach(() => { assert(false); });
    assert.equal(c2.size, 0);
  });

  it("set", () => {
    // Note: v0.1 allows putting same key multiple times. v0.2 does not.
    const c = new LRUMap(4);
    c.set("a", 1);
    c.set("a", 2);
    c.set("a", 3);
    c.set("a", 4);
    assert.equal(c.size, 1);
    assert.equal(c.newest, c.oldest);
    assert.deepEqual(c.newest, { key: "a", value: 4 });

    c.set("a", 5);
    assert.equal(c.size, 1);
    assert.equal(c.newest, c.oldest);
    assert.deepEqual(c.newest, { key: "a", value: 5 });

    c.set("b", 6);
    assert.equal(c.size, 2);
    assert(c.newest !== c.oldest);

    assert.deepEqual({ key: c!.newest!.key, value: c!.newest!.value }, { key: "b", value: 6 });
    assert.deepEqual({ key: c!.oldest!.key, value: c!.oldest!.value }, { key: "a", value: 5 });

    c.shift();
    assert.equal(c.size, 1);
    c.shift();
    assert.equal(c.size, 0);
    c.forEach(() => { assert(false); });

    const manyEntries = [
      ["mimi", 1],
      ["patrick", 2],
      ["jane", 3],
      ["fred", 4],
      ["fred2", 4],
      ["fred3", 4],
      ["fred4", 4],
      ["fred5", 4],
      ["adam", 29],
      ["john", 26],
      ["angela", 24],
      ["bob", 48],
      ["ken", 30],
    ];
    c.limit = 5;
    for (let i = 0; i < 20; ++i) {
      for (const entry of manyEntries) {
        c.set(entry[0], entry[1]);
      }
    }

    let it2 = c.entries()!;
    assert.deepEqual(it2.next().value, ["adam", 29]);
    assert.deepEqual(it2.next().value, ["john", 26]);
    assert.deepEqual(it2.next().value, ["angela", 24]);
    assert.deepEqual(it2.next().value, ["bob", 48]);
    assert.deepEqual(it2.next().value, ["ken", 30]);
    assert(it2.next().done);

    c.get("john");
    it2 = c.entries()!;
    assert.deepEqual(it2.next().value, ["adam", 29]);
    assert.deepEqual(it2.next().value, ["angela", 24]);
    assert.deepEqual(it2.next().value, ["bob", 48]);
    assert.deepEqual(it2.next().value, ["ken", 30]);
    assert.deepEqual(it2.next().value, ["john", 26]);
    assert(it2.next().done);

    c.get("adam");
    it2 = c.entries()!;
    assert.deepEqual(it2.next().value, ["angela", 24]);
    assert.deepEqual(it2.next().value, ["bob", 48]);
    assert.deepEqual(it2.next().value, ["ken", 30]);
    assert.deepEqual(it2.next().value, ["john", 26]);
    assert.deepEqual(it2.next().value, ["adam", 29]);
    assert(it2.next().done);
  });

  it("entry iterator", () => {
    const c = new LRUMap(4);
    c.assign([
      ["adam", 29],
      ["john", 26],
      ["angela", 24],
      ["bob", 48],
    ]);

    const it2 = c.entries()!;
    assert.deepEqual(it2.next().value, ["adam", 29]);
    assert.deepEqual(it2.next().value, ["john", 26]);
    assert.deepEqual(it2.next().value, ["angela", 24]);
    assert.deepEqual(it2.next().value, ["bob", 48]);
    assert(it2.next().done);
  });

  it("key iterator", () => {
    const c = new LRUMap(4);
    c.assign([
      ["adam", 29],
      ["john", 26],
      ["angela", 24],
      ["bob", 48],
    ]);
    const kit = c.keys()!;
    assert.equal(kit.next().value, "adam");
    assert.equal(kit.next().value, "john");
    assert.equal(kit.next().value, "angela");
    assert.equal(kit.next().value, "bob");
    assert(kit.next().done);
  });

  it("value iterator", () => {
    const c = new LRUMap(4);
    c.assign([
      ["adam", 29],
      ["john", 26],
      ["angela", 24],
      ["bob", 48],
    ]);
    const kit = c.values()!;
    assert.equal(kit.next().value, 29);
    assert.equal(kit.next().value, 26);
    assert.equal(kit.next().value, 24);
    assert.equal(kit.next().value, 48);
    assert(kit.next().done);
  });

  it("toJSON", () => {
    const c = new LRUMap(4);
    c.assign([
      ["adam", 29],
      ["john", 26],
      ["angela", 24],
      ["bob", 48],
    ]);
    const json = c.toJSON();
    assert(json.length === 4);
    assert.deepEqual(json, [
      { key: "adam", value: 29 },
      { key: "john", value: 26 },
      { key: "angela", value: 24 },
      { key: "bob", value: 48 },
    ]);
  });

});
