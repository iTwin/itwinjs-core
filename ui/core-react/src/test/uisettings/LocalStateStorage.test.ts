/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { LocalStateStorage, UiStateStorageStatus } from "../../core-react";

import { storageMock } from "../TestUtils";

describe("LocalStateStorage", () => {
  it("default LocalStateStorage constructor executes successfully", () => {
    const initialLocalUiSettings = new LocalStateStorage();
    expect(initialLocalUiSettings).to.not.be.undefined;
  });
  describe("saveSetting", () => {
    const localUiSettings = new LocalStateStorage({ localStorage: storageMock() } as Window);
    it("Should save setting correctly", async () => {
      const result = await localUiSettings.saveSetting("Testing", "TestData", { test123: "4567" });
      expect(result.status).to.equal(UiStateStorageStatus.Success);
    });
  });
  describe("getSetting", async () => {
    const localUiSettings = new LocalStateStorage({ localStorage: storageMock() } as Window);
    await localUiSettings.saveSetting("Testing", "TestData", { test123: "4567" });
    it("Should load setting correctly", async () => {
      const result = await localUiSettings.getSetting("Testing", "TestData");
      expect(result.status).to.equal(UiStateStorageStatus.Success);
      expect(result.setting).to.not.be.null;
      expect(result.setting.test123).to.equal("4567");
    });
    it("Should return error result if setting not found", async () => {
      const result = await localUiSettings.getSetting("Testing", "InvalidTestData");
      expect(result.status).to.equal(UiStateStorageStatus.NotFound);
    });
  });
  describe("deleteSetting", async () => {
    const localUiSettings = new LocalStateStorage({ localStorage: storageMock() } as Window);
    await localUiSettings.saveSetting("Testing", "TestData", { test123: "4567" });
    let hasSettings = await localUiSettings.hasSetting("Testing", "TestData");
    expect(hasSettings).to.be.true;
    it("Should remove setting correctly", async () => {
      const result = await localUiSettings.deleteSetting("Testing", "TestData");
      expect(result.status).to.equal(UiStateStorageStatus.Success);

      hasSettings = await localUiSettings.hasSetting("Testing", "TestData");
      expect(hasSettings).to.be.false;

      const result2 = await localUiSettings.deleteSetting("Testing", "TestData");
      expect(result2.status).to.equal(UiStateStorageStatus.NotFound);
      expect(result2.setting).to.be.undefined;
    });
    it("Should return error result if setting not found", async () => {
      const result = await localUiSettings.deleteSetting("Testing", "InvalidTestData");
      expect(result.status).to.equal(UiStateStorageStatus.NotFound);
    });
  });
});
