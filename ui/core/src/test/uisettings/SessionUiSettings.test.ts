/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { SessionSettingsStorage, SessionUiSettings, UiSettingsStatus } from "../../core-react";

import { storageMock } from "../TestUtils";

describe("SessionUiSettings", () => {
  it("default constructor executes successfully", () => {
    const initialSessionUiSettings = new SessionUiSettings(); // eslint-disable-line deprecation/deprecation
    expect(initialSessionUiSettings).to.not.be.undefined;
  });
  it("default SessionSettingsStorage constructor executes successfully", () => {
    const initialSessionUiSettings = new SessionSettingsStorage(); // eslint-disable-line deprecation/deprecation
    expect(initialSessionUiSettings).to.not.be.undefined;
  });
  describe("saveSetting", () => {
    const sessionSettings = new SessionSettingsStorage({ sessionStorage: storageMock() } as Window);
    it("Should save setting correctly", async () => {
      const result = await sessionSettings.saveSetting("Testing", "TestData", { test123: "4567" });
      expect(result.status).to.equal(UiSettingsStatus.Success);
    });
  });
  describe("getSetting", async () => {
    const sessionSettings = new SessionSettingsStorage({ sessionStorage: storageMock() } as Window);
    await sessionSettings.saveSetting("Testing", "TestData", { test123: "4567" });

    it("Should load setting correctly", async () => {
      const result = await sessionSettings.getSetting("Testing", "TestData");
      expect(result.status).to.equal(UiSettingsStatus.Success);
      expect(result.setting).to.not.be.null;
      expect(result.setting.test123).to.equal("4567");
    });
    it("Should return error result if setting not found", async () => {
      const result = await sessionSettings.getSetting("Testing", "InvalidTestData");
      expect(result.status).to.equal(UiSettingsStatus.NotFound);
    });
  });
  describe("deleteSetting", async () => {
    const sessionSettings = new SessionSettingsStorage({ sessionStorage: storageMock() } as Window);
    await sessionSettings.saveSetting("Testing", "TestData", { test123: "4567" });
    let hasSettings = await sessionSettings.hasSetting("Testing", "TestData");
    expect(hasSettings).to.be.true;

    it("Should remove setting correctly", async () => {
      const result = await sessionSettings.deleteSetting("Testing", "TestData");
      expect(result.status).to.equal(UiSettingsStatus.Success);

      hasSettings = await sessionSettings.hasSetting("Testing", "TestData");
      expect(hasSettings).to.be.false;

      const result2 = await sessionSettings.deleteSetting("Testing", "TestData");
      expect(result2.status).to.equal(UiSettingsStatus.NotFound);
      expect(result2.setting).to.be.undefined;
    });

    it("Should return error result if setting not found", async () => {
      const result = await sessionSettings.deleteSetting("Testing", "InvalidTestData");
      expect(result.status).to.equal(UiSettingsStatus.NotFound);
    });
  });
});
