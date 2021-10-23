/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { LocalSettingsStorage, LocalUiSettings, UiSettingsStatus } from "../../core-react";

import { storageMock } from "../TestUtils";

describe("LocalUiSettings", () => {
  it("default constructor executes successfully", () => {
    const initialLocalUiSettings = new LocalUiSettings(); // eslint-disable-line deprecation/deprecation
    expect(initialLocalUiSettings).to.not.be.undefined;
  });
  it("default LocalSettingsStorage constructor executes successfully", () => {
    const initialLocalUiSettings = new LocalSettingsStorage(); // eslint-disable-line deprecation/deprecation
    expect(initialLocalUiSettings).to.not.be.undefined;
  });
  describe("saveSetting", () => {
    const localUiSettings = new LocalSettingsStorage({ localStorage: storageMock() } as Window);
    it("Should save setting correctly", async () => {
      const result = await localUiSettings.saveSetting("Testing", "TestData", { test123: "4567" });
      expect(result.status).to.equal(UiSettingsStatus.Success);
    });
  });
  describe("getSetting", async () => {
    const localUiSettings = new LocalSettingsStorage({ localStorage: storageMock() } as Window);
    await localUiSettings.saveSetting("Testing", "TestData", { test123: "4567" });
    it("Should load setting correctly", async () => {
      const result = await localUiSettings.getSetting("Testing", "TestData");
      expect(result.status).to.equal(UiSettingsStatus.Success);
      expect(result.setting).to.not.be.null;
      expect(result.setting.test123).to.equal("4567");
    });
    it("Should return error result if setting not found", async () => {
      const result = await localUiSettings.getSetting("Testing", "InvalidTestData");
      expect(result.status).to.equal(UiSettingsStatus.NotFound);
    });
  });
  describe("deleteSetting", async () => {
    const localUiSettings = new LocalSettingsStorage({ localStorage: storageMock() } as Window);
    await localUiSettings.saveSetting("Testing", "TestData", { test123: "4567" });
    let hasSettings = await localUiSettings.hasSetting("Testing", "TestData");
    expect(hasSettings).to.be.true;
    it("Should remove setting correctly", async () => {
      const result = await localUiSettings.deleteSetting("Testing", "TestData");
      expect(result.status).to.equal(UiSettingsStatus.Success);

      hasSettings = await localUiSettings.hasSetting("Testing", "TestData");
      expect(hasSettings).to.be.false;

      const result2 = await localUiSettings.deleteSetting("Testing", "TestData");
      expect(result2.status).to.equal(UiSettingsStatus.NotFound);
      expect(result2.setting).to.be.undefined;
    });
    it("Should return error result if setting not found", async () => {
      const result = await localUiSettings.deleteSetting("Testing", "InvalidTestData");
      expect(result.status).to.equal(UiSettingsStatus.NotFound);
    });
  });
});
