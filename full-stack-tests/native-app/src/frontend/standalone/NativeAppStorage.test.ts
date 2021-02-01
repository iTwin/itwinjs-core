/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { ElectronApp } from "@bentley/electron-manager/lib/ElectronFrontend";
import { NativeApp } from "@bentley/imodeljs-frontend";
import { rpcInterfaces } from "../../common/RpcInterfaces";
import { TestUtility } from "../hub/TestUtility";

describe("NativeApp Storage frontend", () => {
  before(async () => {
    await ElectronApp.startup({ iModelApp: { rpcInterfaces } });
    await TestUtility.purgeStorageCache();
  });

  after(async () => {
    await ElectronApp.shutdown();
  });

  it("Primitive Type ", async () => {
    const test1 = await NativeApp.openStorage("fronted_test_1");
    await test1.removeAll();
    const dataset = [
      { key: "a", value: 100 },
      { key: "b", value: 11.22 },
      { key: "c", value: "Hello World" },
      { key: "d", value: Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 0]) },
      { key: "e", value: null },
    ];

    for (const item of dataset) {
      await test1.setData(item.key, item.value);
      const data = await test1.getData(item.key);
      if (item.value instanceof Uint8Array) {
        assert.equal((data as Uint8Array).length, item.value.length);
      } else {
        assert.equal(data, item.value, `${item.key} -> ${item.value} <> ${data}`);
      }
    }
    assert.equal((await test1.getKeys()).length, dataset.length);
    await test1.close(true);
  });

  it("Override and type check", async () => {
    const test1 = await NativeApp.openStorage("fronted_test_2");
    await test1.setData("key1", null);
    assert.isNull(await test1.getData("key1"));

    await test1.removeData("key1");
    assert.isUndefined(await test1.getData("key1"));

    await test1.setData("key1", 2222);
    assert.isNumber(await test1.getData("key1"));
    assert.equal(await test1.getData("key1"), 2222);
    await test1.removeData("key1");
    assert.isUndefined(await test1.getData("key1"));

    await test1.setData("key1", "Hello, World");
    assert.isString(await test1.getData("key1"));
    assert.equal(await test1.getData("key1"), "Hello, World");
    await test1.removeData("key1");
    assert.isUndefined(await test1.getData("key1"));

    await test1.setData("key1", true);
    assert.isBoolean(await test1.getData("key1"));
    assert.equal(await test1.getData("key1"), true);
    await test1.removeData("key1");
    assert.isUndefined(await test1.getData("key1"));

    await test1.setData("key1", false);
    assert.isBoolean(await test1.getData("key1"));
    assert.equal(await test1.getData("key1"), false);
    await test1.removeData("key1");
    assert.isUndefined(await test1.getData("key1"));

    const testArray = new Uint8Array([1, 2, 3, 4, 5]);
    await test1.setData("key1", testArray);
    assert.isTrue(await test1.getData("key1") instanceof Uint8Array);
    assert.equal((await test1.getData("key1") as Uint8Array).length, testArray.length);
    await test1.removeData("key1");
    assert.isUndefined(await test1.getData("key1"));
  });

});
