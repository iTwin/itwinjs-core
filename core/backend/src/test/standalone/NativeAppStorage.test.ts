/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { IModelJsFs } from "../../IModelJsFs";
import { NativeHost } from "../../NativeHost";
import { NativeAppStorage } from "../../NativeAppStorage";

describe("NativeApp storage backend", () => {
  before(async () => {
    IModelJsFs.purgeDirSync(NativeHost.appSettingsCacheDir);
  });

  it("should persistence primitive type values", () => {
    const test1 = NativeAppStorage.open("backend_test_1");
    test1.removeAll();
    const dataset = [
      { key: "a", value: 100 },
      { key: "b", value: 11.22 },
      { key: "c", value: "Hello World" },
      { key: "d", value: Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 0]) },
      { key: "e", value: undefined },
    ];

    for (const item of dataset) {
      test1.setData(item.key, item.value);
      if (item.value instanceof Uint8Array) {
        assert.equal((test1.getData(item.key) as Uint8Array).length, item.value.length);
      } else {
        assert.equal(test1.getData(item.key), item.value, `${item.key} -> ${item.value} <> ${test1.getData(item.key)}`);
      }
    }
    assert.equal(test1.getKeys().length, dataset.length, "Number keys must match");

    // Close storage show now all function to throw exception
    test1.close();
    assert.throw(() => { test1.close(); });
    assert.throw(() => { test1.setData("t", ""); });
    assert.throw(() => { test1.getData("t"); });
    assert.throw(() => { test1.removeData("t"); });

    // Reopen it.
    const test2 = NativeAppStorage.open("backend_test_1");

    // reopen and test it
    for (const item of dataset) {
      test2.setData(item.key, item.value);
      if (item.value instanceof Uint8Array) {
        assert.equal((test2.getData(item.key) as Uint8Array).length, item.value.length);
      } else {
        assert.equal(test2.getData(item.key), item.value, `${item.key} -> ${item.value} <> ${test2.getData(item.key)}`);
      }
    }

    const test3 = NativeAppStorage.open("backend_test_1");
    // return same storage if it was previously opened
    assert.equal(test3, test2);
    test2.close(true);
    assert.throw(() => { test3.close(); });
  });

  it("should override and type check", () => {
    const test1 = NativeAppStorage.open("backend_test_2");
    test1.removeAll();
    test1.setData("key1", undefined);
    assert.isUndefined(test1.getData("key1"));
    assert.isTrue(test1.hasNullValue("key1"));

    test1.setData("key1", 2222);
    assert.isNumber(test1.getData("key1"));
    assert.equal(test1.getValueType("key1"), "number");
    assert.equal(test1.getData("key1"), 2222);
    assert.equal(test1.getNumber("key1"), 2222);
    assert.equal(test1.getString("key1"), undefined);
    assert.equal(test1.getUint8Array("key1"), undefined);
    assert.equal(test1.getBoolean("key1"), undefined);

    test1.setData("key1", "Hello, World");
    assert.isString(test1.getData("key1"));
    assert.equal(test1.getData("key1"), "Hello, World");
    assert.equal(test1.getString("key1"), "Hello, World");
    assert.equal(test1.getUint8Array("key1"), undefined);
    assert.equal(test1.getBoolean("key1"), undefined);
    assert.equal(test1.getNumber("key1"), undefined);

    test1.setData("key1", true);
    assert.isBoolean(test1.getData("key1"));
    assert.equal(test1.getData("key1"), true);
    assert.equal(test1.getBoolean("key1"), true);
    assert.equal(test1.getString("key1"), undefined);
    assert.equal(test1.getUint8Array("key1"), undefined);
    assert.equal(test1.getNumber("key1"), undefined);

    test1.setData("key1", false);
    assert.isBoolean(test1.getData("key1"));
    assert.equal(test1.getData("key1"), false);
    assert.equal(test1.getBoolean("key1"), false);

    const testArray = new Uint8Array([1, 2, 3, 4, 5]);
    test1.setData("key1", testArray);
    assert.isTrue(test1.getData("key1") instanceof Uint8Array);
    assert.equal(test1.getUint8Array("key1")!.length, testArray.length);
    assert.equal(test1.getBoolean("key1"), undefined);
    assert.equal(test1.getString("key1"), undefined);
    assert.equal(test1.getNumber("key1"), undefined);
    test1.removeAll();
    assert.isFalse(test1.hasNullValue("key1"));
    assert.equal(test1.getKeys().length, 0);
    test1.close(true);
  });

  it("storage open/close", () => {
    const storages: NativeAppStorage[] = [];
    for (let i = 0; i < 20; i++) {
      storages.push(NativeAppStorage.open(`backend_test_3-${i}`));
    }
    storages.forEach((storage) => {
      storage.setData("name", storage.id);
      storage.setData("created_on", Date.now());
    });
    storages.forEach((storage) => {
      storage.close(true);
    });
  });

});
