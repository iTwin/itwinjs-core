/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "vitest";
import { ElectronApp } from "@itwin/core-electron/renderer";
import { NativeApp } from "@itwin/core-frontend";
import { usingOfflineScope } from "../HttpRequestHook";
import { TestRpcInterface } from "../../common/RpcInterfaces";
import { ProcessDetector } from "@itwin/core-bentley";
import { TestUtility } from "../TestUtility";

if (ProcessDetector.isElectronAppFrontend) {

  describe("NativeApp startup", () => {
    beforeAll(async () => {
      await TestUtility.startFrontend();
    });
    afterAll(async () => {
      await TestUtility.shutdownFrontend();
    });

    it("should startup offline without errors", async () => {
      await usingOfflineScope(async () => {
        await ElectronApp.shutdown();
        await ElectronApp.startup({ iModelApp: TestUtility.iModelAppOptions }); // restart with no network available
        expect(ElectronApp.isValid).toBe(true);
      });
    });
  });

  describe("NativeApp Storage", () => {
    beforeAll(async () => {
      await TestUtility.startFrontend();
      await TestRpcInterface.getClient().purgeStorageCache();
    });

    afterAll(async () => {
      await TestUtility.shutdownFrontend();
    });

    it("Primitive Types", async () => {
      const test1 = await NativeApp.openStorage("fronted_test_1");
      await test1.removeAll();
      const dataset = [
        { key: "a", value: 100 },
        { key: "b", value: 11.22 },
        { key: "c", value: "Hello World" },
        { key: "d", value: Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 0]) },
        { key: "e", value: undefined },
      ];

      for (const item of dataset) {
        await test1.setData(item.key, item.value);
        const data = await test1.getData(item.key);
        if (item.value instanceof Uint8Array) {
          expect((data as Uint8Array).length).toBe(item.value.length);
        } else {
          expect(data, `${item.key} -> ${item.value} <> ${data}`).toBe(item.value);
        }
      }
      expect((await test1.getKeys()).length).toBe(dataset.length);
      await NativeApp.closeStorage(test1, true);
    });

    it("Override and type check", async () => {
      const test1 = await NativeApp.openStorage("fronted_test_2");
      await test1.setData("key1", undefined);
      expect(await test1.getData("key1")).toBeUndefined();
      expect(await test1.getValueType("key1")).toBe("null");

      await test1.removeData("key1");
      expect(await test1.getData("key1")).toBeUndefined();
      expect(await test1.getValueType("key1")).toBe(undefined);

      await test1.setData("key1", 2222);
      expect(await test1.getData("key1")).toEqual(expect.any(Number));
      expect(await test1.getData("key1")).toBe(2222);
      await test1.removeData("key1");
      expect(await test1.getData("key1")).toBeUndefined();

      await test1.setData("key1", "Hello, World");
      expect(await test1.getData("key1")).toEqual(expect.any(String));
      expect(await test1.getData("key1")).toBe("Hello, World");
      await test1.removeData("key1");
      expect(await test1.getData("key1")).toBeUndefined();

      await test1.setData("key1", true);
      expect(await test1.getData("key1")).toEqual(expect.any(Boolean));
      expect(await test1.getData("key1")).toBe(true);
      await test1.removeData("key1");
      expect(await test1.getData("key1")).toBeUndefined();

      await test1.setData("key1", false);
      expect(await test1.getData("key1")).toEqual(expect.any(Boolean));
      expect(await test1.getData("key1")).toBe(false);
      await test1.removeData("key1");
      expect(await test1.getData("key1")).toBeUndefined();

      const testArray = new Uint8Array([1, 2, 3, 4, 5]);
      await test1.setData("key1", testArray);
      expect(await test1.getData("key1") instanceof Uint8Array).toBe(true);
      expect((await test1.getData("key1") as Uint8Array).length).toBe(testArray.length);
      await test1.removeData("key1");
      expect(await test1.getData("key1")).toBeUndefined();
      await NativeApp.closeStorage(test1, true);
    });
  });

}
