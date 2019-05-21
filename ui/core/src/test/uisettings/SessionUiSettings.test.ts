/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module UiSettings */

import { expect } from "chai";
import { SessionUiSettings, UiSettingsStatus } from "../../ui-core";
const storageMock = () => {
  const storage: { [key: string]: any } = {};
  return {
    setItem: (key: string, value: string) => {
      storage[key] = value || "";
    },
    getItem: (key: string) => {
      return key in storage ? storage[key] : null;
    },
    removeItem: (key: string) => {
      delete storage[key];
    },
    get length() {
      return Object.keys(storage).length;
    },
    key: (i: number) => {
      const keys = Object.keys(storage);
      return keys[i] || null;
    },
  };
};
describe("SessionUiSettings", () => {
  it("default constructor executes successfully", () => {
    const initialSessionUiSettings = new SessionUiSettings();
    expect(initialSessionUiSettings).to.not.be.undefined;
  });
  describe("saveSetting", () => {
    const sessionSettings = new SessionUiSettings({ sessionStorage: storageMock() } as Window);
    it("Should save setting correctly", () => {
      const result = sessionSettings.saveSetting("Testing", "TestData", { test123: "4567" });
      expect(result.status).to.equal(UiSettingsStatus.Success);
    });
  });
  describe("getSetting", () => {
    const sessionSettings = new SessionUiSettings({ sessionStorage: storageMock() } as Window);
    sessionSettings.saveSetting("Testing", "TestData", { test123: "4567" });
    it("Should load setting correctly", () => {
      const result = sessionSettings.getSetting("Testing", "TestData");
      expect(result.status).to.equal(UiSettingsStatus.Success);
      expect(result.setting).to.not.be.null;
      expect(result.setting.test123).to.equal("4567");
    });
    it("Should return error result if setting not found", () => {
      const result = sessionSettings.getSetting("Testing", "InvalidTestData");
      expect(result.status).to.equal(UiSettingsStatus.NotFound);
    });
  });
  describe("deleteSetting", () => {
    const sessionSettings = new SessionUiSettings({ sessionStorage: storageMock() } as Window);
    sessionSettings.saveSetting("Testing", "TestData", { test123: "4567" });
    it("Should remove setting correctly", () => {
      const result = sessionSettings.deleteSetting("Testing", "TestData");
      expect(result.status).to.equal(UiSettingsStatus.Success);
      const result2 = sessionSettings.deleteSetting("Testing", "TestData");
      expect(result2.status).to.equal(UiSettingsStatus.NotFound);
      expect(result2.setting).to.be.undefined;
    });
    it("Should return error result if setting not found", () => {
      const result = sessionSettings.deleteSetting("Testing", "InvalidTestData");
      expect(result.status).to.equal(UiSettingsStatus.NotFound);
    });
  });
});
